import { securePrefixedId } from "./secure-id.ts"

/**
 * In-memory transaction workflow coordinator.
 *
 * IMPORTANT: this is not a database transaction and must never be used as the
 * authority for wallets, payments, rewards, orders, or entitlements. Those
 * domains must use their server-side RPC/ledger/intent lifecycle.
 *
 * Registered operations are executed in order. A failed operation triggers
 * compensations for already-executed operations in reverse order. A successful
 * commit therefore requires an executor for every registered operation.
 */
export interface Transaction {
  id: string
  status: "pending" | "committed" | "rolled_back" | "failed"
  operations: Operation[]
  startTime: number
  endTime?: number
  error?: Error
}

export interface Operation {
  id: string
  type: string
  data: unknown
  /** Legacy descriptive metadata; never executed as code. */
  reverse?: unknown
  /** Real operation handler. */
  execute?: () => void | Promise<void>
  /** Compensating handler for a successfully executed operation. */
  compensate?: () => void | Promise<void>
  status: "pending" | "executed" | "rolled_back"
}

export class TransactionManager {
  private activeTransactions = new Map<string, Transaction>()
  private completedTransactions: Transaction[] = []
  private readonly MAX_HISTORY = 50

  beginTransaction(): Transaction {
    const transaction: Transaction = {
      id: this.generateId(),
      status: "pending",
      operations: [],
      startTime: Date.now(),
    }
    this.activeTransactions.set(transaction.id, transaction)
    return transaction
  }

  addOperation(
    transactionId: string,
    operation: Omit<Operation, "id" | "status">,
  ): boolean {
    const transaction = this.activeTransactions.get(transactionId)
    if (!transaction || transaction.status !== "pending") return false
    transaction.operations.push({ ...operation, id: this.generateId("op"), status: "pending" })
    return true
  }

  async commitTransaction(transactionId: string): Promise<boolean> {
    const transaction = this.activeTransactions.get(transactionId)
    if (!transaction || transaction.status !== "pending") return false

    try {
      for (const operation of transaction.operations) {
        if (typeof operation.execute !== "function") {
          throw new Error(`Operation ${operation.type || operation.id} has no executor`)
        }
        await operation.execute()
        operation.status = "executed"
      }
      transaction.status = "committed"
      transaction.endTime = Date.now()
      this.finish(transaction)
      return true
    } catch (error) {
      transaction.error = error instanceof Error ? error : new Error(String(error))
      const rollbackOk = await this.compensateExecuted(transaction)
      transaction.status = rollbackOk ? "rolled_back" : "failed"
      transaction.endTime = Date.now()
      this.finish(transaction)
      return false
    }
  }

  async rollbackTransaction(transactionId: string): Promise<boolean> {
    const transaction = this.activeTransactions.get(transactionId)
    if (!transaction || transaction.status !== "pending") return false
    const ok = await this.compensateExecuted(transaction)
    transaction.status = ok ? "rolled_back" : "failed"
    transaction.endTime = Date.now()
    this.finish(transaction)
    return ok
  }

  /**
   * Convenience lifecycle wrapper for a single callback. It tracks success or
   * failure only; arbitrary callback side effects cannot be rolled back. Use
   * registered execute/compensate operations when compensation is required.
   */
  async executeTransaction<T>(
    callback: (transactionId: string) => Promise<T>,
  ): Promise<{ success: boolean; data?: T; error?: Error }> {
    const transaction = this.beginTransaction()
    try {
      const data = await callback(transaction.id)
      transaction.status = "committed"
      transaction.endTime = Date.now()
      this.finish(transaction)
      return { success: true, data }
    } catch (error) {
      transaction.error = error instanceof Error ? error : new Error(String(error))
      transaction.status = "failed"
      transaction.endTime = Date.now()
      this.finish(transaction)
      return { success: false, error: transaction.error }
    }
  }

  getTransactionStatus(transactionId: string): Transaction | null {
    const active = this.activeTransactions.get(transactionId)
    if (active) return active
    return this.completedTransactions.find((item) => item.id === transactionId) ?? null
  }

  getActiveTransactions(): Transaction[] {
    return [...this.activeTransactions.values()]
  }

  getTransactionHistory(): Transaction[] {
    return [...this.completedTransactions]
  }

  isOperationAtomic(operation: Operation): boolean {
    return operation.status === "executed" && typeof operation.compensate === "function"
  }

  private async compensateExecuted(transaction: Transaction): Promise<boolean> {
    let ok = true
    for (const operation of [...transaction.operations].reverse()) {
      if (operation.status !== "executed") continue
      if (typeof operation.compensate !== "function") {
        ok = false
        continue
      }
      try {
        await operation.compensate()
        operation.status = "rolled_back"
      } catch {
        ok = false
      }
    }
    return ok
  }

  private finish(transaction: Transaction): void {
    this.activeTransactions.delete(transaction.id)
    this.completedTransactions.push(transaction)
    if (this.completedTransactions.length > this.MAX_HISTORY) {
      this.completedTransactions.splice(0, this.completedTransactions.length - this.MAX_HISTORY)
    }
  }

  protected generateId(prefix = "tx"): string {
    // IDs are generated with Web Crypto; do not downgrade to Math.random().
    return securePrefixedId(prefix)
  }

  clearHistory(): void {
    this.completedTransactions = []
  }
}

export class Savepoint {
  id: string
  timestamp: number
  state: unknown

  constructor(id: string, state: unknown) {
    this.id = id
    this.timestamp = Date.now()
    this.state = state
  }
}

export class NestedTransactionManager extends TransactionManager {
  private savepoints = new Map<string, Savepoint>()

  createSavepoint(state: unknown): Savepoint {
    const savepoint = new Savepoint(this.generateId("sp"), state)
    this.savepoints.set(savepoint.id, savepoint)
    return savepoint
  }

  restoreSavepoint(savepointId: string): unknown {
    const savepoint = this.savepoints.get(savepointId)
    if (!savepoint) return null
    this.savepoints.delete(savepointId)
    return savepoint.state
  }
}

export const transactionManager = new TransactionManager()
export const nestedTransactionManager = new NestedTransactionManager()
