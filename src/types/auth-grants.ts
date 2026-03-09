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
  | RefreshTokenGrant
