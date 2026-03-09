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
