import type { SdkLogger } from './types/logger'

/** Logging is observational: a broken browser/application logger must not change auth behavior. */
export function emitLog(
  logger: SdkLogger | undefined,
  level: keyof SdkLogger,
  message: string,
  context: Record<string, unknown>,
): void {
  try {
    logger?.[level]?.(message, context)
  } catch {
    // Logging transports can fail independently of the SDK request.
  }
}
