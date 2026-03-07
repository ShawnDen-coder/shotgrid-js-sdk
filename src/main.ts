import { AuthService } from './auth'
import type { AuthCredentials } from './types'

type SupportedGrantType = 'client_credentials' | 'password' | 'session_token'
type ApiVersion = 'v1' | 'v1.1'

interface EnvConfig {
  VITE_SHOTGRID_GRANT_TYPE?: SupportedGrantType
  VITE_SHOTGRID_BASE_URL?: string
  VITE_SHOTGRID_API_VERSION?: ApiVersion
  VITE_SHOTGRID_CLIENT_ID?: string
  VITE_SHOTGRID_CLIENT_SECRET?: string
  VITE_SHOTGRID_USERNAME?: string
  VITE_SHOTGRID_PASSWORD?: string
  VITE_SHOTGRID_AUTH_TOKEN?: string
  VITE_SHOTGRID_SESSION_TOKEN?: string
}

const env = import.meta.env as unknown as EnvConfig

const grantType = env.VITE_SHOTGRID_GRANT_TYPE ?? 'client_credentials'
const apiVersion = env.VITE_SHOTGRID_API_VERSION ?? 'v1.1'

const must = (key: keyof EnvConfig): string => {
  const value = env[key]
  if (!value || value.trim() === '') {
    throw new Error(`环境变量 ${String(key)} 未配置。`)
  }
  return value
}

const buildCredentials = (): AuthCredentials => {
  switch (grantType) {
    case 'client_credentials':
      return {
        grantType: 'client_credentials',
        clientId: must('VITE_SHOTGRID_CLIENT_ID'),
        clientSecret: must('VITE_SHOTGRID_CLIENT_SECRET'),
      }

    case 'password':
      return {
        grantType: 'password',
        username: must('VITE_SHOTGRID_USERNAME'),
        password: must('VITE_SHOTGRID_PASSWORD'),
        authToken: env.VITE_SHOTGRID_AUTH_TOKEN || undefined,
      }

    case 'session_token':
      return {
        grantType: 'session_token',
        sessionToken: must('VITE_SHOTGRID_SESSION_TOKEN'),
      }
  }
}

const maskToken = (token: string): string => {
  if (token.length <= 16) {
    return '***'
  }
  return `${token.slice(0, 8)}...${token.slice(-8)}`
}

const run = async (): Promise<void> => {
  console.info('ShotGrid auth debug started', {
    grantType,
    apiVersion,
  })

  const service = new AuthService({
    baseUrl: must('VITE_SHOTGRID_BASE_URL'),
    apiVersion,
  })

  const credentials = buildCredentials()
  const tokens = await service.authenticate(credentials)

  const output = {
    ok: true,
    tokenType: tokens.tokenType,
    expiresIn: tokens.expiresIn,
    expiresAt: new Date(tokens.expiresAt).toISOString(),
    accessTokenPreview: maskToken(tokens.accessToken),
    refreshTokenPreview: maskToken(tokens.refreshToken),
  }

  console.log('ShotGrid auth success:', output)
}

void run().catch((error: unknown) => {
  console.error('ShotGrid auth failed:', error)
})
