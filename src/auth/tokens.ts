import type { AccessTokenResponse, AuthTokens } from '../types/auth-tokens'

export function toAuthTokens(response: AccessTokenResponse): AuthTokens {
  const issuedAt = Date.now()
  const expiresAt = issuedAt + response.expires_in * 1000

  return {
    tokenType: response.token_type,
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresIn: response.expires_in,
    issuedAt,
    expiresAt,
  }
}

export function isAccessTokenResponse(value: unknown): value is AccessTokenResponse {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<AccessTokenResponse>
  return (
    typeof candidate.token_type === 'string' &&
    candidate.token_type.toLowerCase() === 'bearer' &&
    typeof candidate.access_token === 'string' &&
    candidate.access_token.length > 0 &&
    typeof candidate.expires_in === 'number' &&
    Number.isFinite(candidate.expires_in) &&
    candidate.expires_in > 0 &&
    typeof candidate.refresh_token === 'string' &&
    candidate.refresh_token.length > 0
  )
}
