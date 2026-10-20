/** Logging is opt-in; console and application loggers can implement this interface. */
export interface SdkLogger {
  info?: (message: string, context?: Record<string, unknown>) => void
  warn?: (message: string, context?: Record<string, unknown>) => void
  error?: (message: string, context?: Record<string, unknown>) => void
}
