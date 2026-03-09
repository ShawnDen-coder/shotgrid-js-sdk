import { Logger } from 'tslog'

interface LoggerEnv {
  VITE_LOG_LEVEL?: string
  LOG_LEVEL?: string
}

const resolveEnv = (): LoggerEnv => {
  const viteEnv = (import.meta as { env?: LoggerEnv }).env
  const nodeEnv =
    typeof globalThis !== 'undefined' && 'process' in globalThis
      ? ((globalThis as { process?: { env?: LoggerEnv } }).process?.env ?? undefined)
      : undefined

  return viteEnv ?? nodeEnv ?? {}
}

const env = resolveEnv()

const logLevelMap: Record<string, number> = {
  silly: 0,
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  fatal: 6,
}
const minLevel = logLevelMap[env.VITE_LOG_LEVEL ?? env.LOG_LEVEL ?? 'info'] ?? 3

export const logger = new Logger({
  name: 'shotgrid-js-sdk',
  minLevel,
  prettyLogTemplate: '{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}.{{ms}} {{logLevelName}} | ',
})
