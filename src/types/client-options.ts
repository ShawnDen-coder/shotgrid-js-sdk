import type { AxiosInstance } from 'axios'
import type { AuthCredentials } from './auth-grants'
import type { SdkLogger } from './logger'

export interface ProvidedAccessToken {
  accessToken: string
  /** Epoch milliseconds; omit when the provider manages expiry itself. */
  expiresAt?: number
}
export interface AccessTokenProvider {
  type: 'token'
  getAccessToken: () => ProvidedAccessToken | Promise<ProvidedAccessToken>
}
export type AuthConfig =
  | {
      type: 'script'
      scriptName: string
      scriptKey: string
      sudoAsLogin?: string
      sessionUuid?: string
    }
  | {
      type: 'password'
      username: string
      password: string
      authToken?: string
      sudoAsLogin?: string
      sessionUuid?: string
    }
  | { type: 'session'; sessionToken: string }
  | { type: 'refresh'; refreshToken: string }
  | AccessTokenProvider

interface ClientOptions {
  baseUrl: string
  apiVersion?: 'v1' | 'v1.1'
  timeoutMs?: number
  /** Retry count for non-refresh token exchanges only. */
  maxRetries?: number
  retryBaseDelayMs?: number
  /** Inject an Axios instance configured with the site's API baseURL. */
  httpClient?: AxiosInstance
  leewayMs?: number
  logger?: SdkLogger
}

export type ShotGridClientOptions = ClientOptions &
  ({ auth: AuthConfig; credentials?: never } | { credentials: AuthCredentials; auth?: never })
