// Comprehensive error handling and recovery strategies

export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public isDev: boolean = false,
    public context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NetworkError extends AppError {
  constructor(message: string = 'Network request failed', context?: Record<string, unknown>) {
    super('NETWORK_ERROR', message, 0, false, context)
    this.name = 'NetworkError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, false, context)
    this.name = 'ValidationError'
  }
}

export class AuthError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super('AUTH_ERROR', message, 401, false, context)
    this.name = 'AuthError'
  }
}

export class OfflineError extends AppError {
  constructor(message: string = 'Device is offline', context?: Record<string, unknown>) {
    super('OFFLINE_ERROR', message, 0, false, context)
    this.name = 'OfflineError'
  }
}

/**
 * Structured error logger with context preservation
 */
export class ErrorLogger {
  private logs: Array<{
    timestamp: number
    level: 'error' | 'warn' | 'info'
    error: Error
    context?: Record<string, unknown>
  }> = []

  private readonly MAX_LOGS = 100

  /**
   * Log an error with context
   */
  logError(error: Error, context?: Record<string, unknown>): void {
    const entry = {
      timestamp: Date.now(),
      level: 'error' as const,
      error,
      context,
    }

    this.logs.push(entry)
    this.trimLogs()

    console.error('[v0] Error:', error, context)

    // Send to analytics (if available)
    this.sendToAnalytics(entry)
  }

  /**
   * Log a warning
   */
  logWarning(message: string, context?: Record<string, unknown>): void {
    const error = new Error(message)
    const entry = {
      timestamp: Date.now(),
      level: 'warn' as const,
      error,
      context,
    }

    this.logs.push(entry)
    this.trimLogs()

    console.warn('[v0] Warning:', message, context)
  }

  /**
   * Log info message
   */
  logInfo(message: string, context?: Record<string, unknown>): void {
    const error = new Error(message)
    const entry = {
      timestamp: Date.now(),
      level: 'info' as const,
      error,
      context,
    }

    this.logs.push(entry)
    this.trimLogs()

    console.log('[v0] Info:', message, context)
  }

  /**
   * Get all logs
   */
  getLogs() {
    return [...this.logs]
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = []
  }

  /**
   * Get error count
   */
  getErrorCount(): number {
    return this.logs.filter((l) => l.level === 'error').length
  }

  /**
   * Trim old logs
   */
  private trimLogs(): void {
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS)
    }
  }

  /**
   * Send error to analytics (stub for integration)
   */
  private sendToAnalytics(entry: any): void {
    // This would integrate with your analytics service
    // e.g., Sentry, LogRocket, etc.
  }
}

/**
 * Recovery strategies for different error types
 */
export const recoveryStrategies = {
  /**
   * Network error recovery
   */
  networkError: {
    userMessage: 'Connection problem. Please check your internet connection.',
    action: 'retry',
    delayMs: 2000,
  },

  /**
   * Authentication error recovery
   */
  authError: {
    userMessage: 'Your session has expired. Please log in again.',
    action: 'redirect',
    target: '/login',
  },

  /**
   * Validation error recovery
   */
  validationError: {
    userMessage: 'Invalid input. Please check your data and try again.',
    action: 'highlight',
  },

  /**
   * Server error recovery
   */
  serverError: {
    userMessage: 'Server error. Our team has been notified. Please try again later.',
    action: 'retry',
    delayMs: 5000,
  },

  /**
   * Offline recovery
   */
  offlineError: {
    userMessage: 'You are offline. Your changes will sync when you reconnect.',
    action: 'queue',
  },
}

/**
 * Get appropriate user message for an error
 */
export function getUserMessage(error: Error): string {
  if (error instanceof NetworkError) {
    return recoveryStrategies.networkError.userMessage
  }

  if (error instanceof AuthError) {
    return recoveryStrategies.authError.userMessage
  }

  if (error instanceof ValidationError) {
    return recoveryStrategies.validationError.userMessage
  }

  if (error instanceof OfflineError) {
    return recoveryStrategies.offlineError.userMessage
  }

  return 'An unexpected error occurred. Please try again.'
}

/**
 * Get recovery action for an error
 */
export function getRecoveryAction(error: Error): string {
  if (error instanceof NetworkError) {
    return recoveryStrategies.networkError.action
  }

  if (error instanceof AuthError) {
    return recoveryStrategies.authError.action
  }

  if (error instanceof ValidationError) {
    return recoveryStrategies.validationError.action
  }

  if (error instanceof OfflineError) {
    return recoveryStrategies.offlineError.action
  }

  return 'retry'
}

// Export singleton
export const errorLogger = new ErrorLogger()
