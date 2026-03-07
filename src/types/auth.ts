export type AuthGrantType =
  | 'client_credentials'
  | 'password'
  | 'session_token'
  | 'refresh_token'

export interface AccessTokenResponse {
  token_type: string
  access_token: string
  expires_in: number
  refresh_token: string
}

export interface AuthTokens {
  tokenType: string
  accessToken: string
  refreshToken: string
  expiresIn: number
  issuedAt: number
  expiresAt: number
}

export interface ClientCredentialsGrant {
  grantType: 'client_credentials'
  clientId: string
  clientSecret: string
  scope?: string
  sessionUuid?: string
}

export interface PasswordGrant {
  grantType: 'password'
  username: string
  password: string
  authToken?: string
  scope?: string
  sessionUuid?: string
}

export interface SessionTokenGrant {
  grantType: 'session_token'
  sessionToken: string
}

export interface RefreshTokenGrant {
  grantType: 'refresh_token'
  refreshToken: string
}

export type AuthCredentials =
  | ClientCredentialsGrant
  | PasswordGrant
  | SessionTokenGrant

export interface TokenStore {
  get(): Promise<AuthTokens | null> | AuthTokens | null
  set(tokens: AuthTokens): Promise<void> | void
  clear(): Promise<void> | void
}

export interface AuthProvider {
  getCredentials(): Promise<AuthCredentials> | AuthCredentials
}

export interface AuthConfig {
  refreshLeewaySeconds?: number
  retryOnUnauthorized?: boolean
}

export interface AuthEventMap {
  authenticated: { tokens: AuthTokens }
  refreshed: { tokens: AuthTokens }
  invalidated: { reason?: string }
  authFailed: { error: unknown }
}

export type AuthEvent = keyof AuthEventMap

export type AuthEventHandler<T extends AuthEvent = AuthEvent> = (
  event: T,
  payload: AuthEventMap[T],
) => void
