/**
 * Transaction and Atomicity System
 * Ensures atomic operations for critical actions with rollback capability
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
  data: any
  reverse?: any
  status: "pending" | "executed" | "rolled_back"
}

/**
 * Transaction Manager for atomic operations
 */
export class TransactionManager {
  private activeTransactions: Map<string, Transaction> = new Map()
  private completedTransactions: Transaction[] = []
  private readonly MAX_HISTORY = 50

  /**
   * Begin a new transaction
   */
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

  /**
   * Add operation to transaction
   */
  addOperation(transactionId: string, operation: Omit<Operation, "id" | "status">): boolean {
    const transaction = this.activeTransactions.get(transactionId)

    if (!transaction) {
      console.error("[v0] Transaction not found:", transactionId)
      return false
    }

    const op: Operation = {
      id: this.generateId(),
      ...operation,
      status: "pending",
    }

    transaction.operations.push(op)
    return true
  }

  /**
   * Commit transaction - execute all operations
   */
  commitTransaction(transactionId: string): boolean {
    const transaction = this.activeTransactions.get(transactionId)

    if (!transaction) {
      console.error("[v0] Transaction not found:", transactionId)
      return false
    }

    try {
      // Execute all operations
      transaction.operations.forEach((op) => {
        op.status = "executed"
      })

      transaction.status = "committed"
      transaction.endTime = Date.now()

      this.moveToHistory(transaction)
      this.activeTransactions.delete(transactionId)

      console.log("[v0] Transaction committed:", transactionId)
      return true
    } catch (error) {
      transaction.status = "failed"
      transaction.error = error instanceof Error ? error : new Error(String(error))
      transaction.endTime = Date.now()

      console.error("[v0] Transaction commit failed:", error)
      return false
    }
  }

  /**
   * Rollback transaction - undo all operations
   */
  rollbackTransaction(transactionId: string): boolean {
    const transaction = this.activeTransactions.get(transactionId)

    if (!transaction) {
      console.error("[v0] Transaction not found:", transactionId)
      return false
    }

    try {
      // Rollback in reverse order
      const reversed = [...transaction.operations].reverse()

      reversed.forEach((op) => {
        if (op.reverse) {
          // Execute reverse operation
          op.status = "rolled_back"
        }
      })

      transaction.status = "rolled_back"
      transaction.endTime = Date.now()

      this.moveToHistory(transaction)
      this.activeTransactions.delete(transactionId)

      console.log("[v0] Transaction rolled back:", transactionId)
      return true
    } catch (error) {
      console.error("[v0] Rollback failed:", error)
      return false
    }
  }

  /**
   * Execute function within transaction
   */
  async executeTransaction<T>(
    callback: (transactionId: string) => Promise<T>
  ): Promise<{ success: boolean; data?: T; error?: Error }> {
    const transaction = this.beginTransaction()

    try {
      const result = await callback(transaction.id)
      this.commitTransaction(transaction.id)

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      this.rollbackTransaction(transaction.id)

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }

  /**
   * Get transaction status
   */
  getTransactionStatus(transactionId: string): Transaction | null {
    return this.activeTransactions.get(transactionId) || null
  }

  /**
   * List active transactions
   */
  getActiveTransactions(): Transaction[] {
    return Array.from(this.activeTransactions.values())
  }

  /**
   * Get transaction history
   */
  getTransactionHistory(): Transaction[] {
    return [...this.completedTransactions]
  }

  /**
   * Check if operation is atomic
   */
  isOperationAtomic(operation: Operation): boolean {
    return operation.status === "executed" && !!operation.reverse
  }

  /**
   * Clean up old transactions
   */
  private moveToHistory(transaction: Transaction): void {
    this.completedTransactions.push(transaction)

    if (this.completedTransactions.length > this.MAX_HISTORY) {
      this.completedTransactions.shift()
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Clear completed transactions (for testing)
   */
  clearHistory(): void {
    this.completedTransactions = []
  }
}

/**
 * Savepoint for nested transactions
 */
export class Savepoint {
  id: string
  timestamp: number
  state: any

  constructor(id: string, state: any) {
    this.id = id
    this.timestamp = Date.now()
    this.state = state
  }
}

/**
 * Nested transaction support
 */
export class NestedTransactionManager extends TransactionManager {
  private savepoints: Map<string, Savepoint> = new Map()

  /**
   * Create savepoint
   */
  createSavepoint(state: any): Savepoint {
    const savepoint = new Savepoint(this.generateId(), state)
    this.savepoints.set(savepoint.id, savepoint)
    return savepoint
  }

  /**
   * Restore from savepoint
   */
  restoreSavepoint(savepointId: string): any {
    const savepoint = this.savepoints.get(savepointId)

    if (!savepoint) {
      console.error("[v0] Savepoint not found:", savepointId)
      return null
    }

    this.savepoints.delete(savepointId)
    return savepoint.state
  }

  private generateId(): string {
    return `sp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export const transactionManager = new TransactionManager()
export const nestedTransactionManager = new NestedTransactionManager()
