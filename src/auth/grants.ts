import type { AuthCredentials } from '../types/auth-grants'
import type { AccessTokenProvider, AuthConfig } from '../types/client-options'

/** Encode credentials only at the token exchange boundary. */
export function encodeGrant(credentials: AuthCredentials): URLSearchParams {
  const form = new URLSearchParams({ grant_type: credentials.grantType })
  switch (credentials.grantType) {
    case 'client_credentials':
      form.set('client_id', credentials.clientId)
      form.set('client_secret', credentials.clientSecret)
      break
    case 'password':
      form.set('username', credentials.username)
      form.set('password', credentials.password)
      if (credentials.authToken) form.set('auth_token', credentials.authToken)
      break
    case 'session_token':
      form.set('session_token', credentials.sessionToken)
      break
    case 'refresh_token':
      form.set('refresh_token', credentials.refreshToken)
      break
  }
  if ('scope' in credentials && credentials.scope) form.set('scope', credentials.scope)
  if ('sessionUuid' in credentials && credentials.sessionUuid)
    form.set('session_uuid', credentials.sessionUuid)
  return form
}

export function resolveAuth(auth: AuthConfig): AuthCredentials | AccessTokenProvider {
  switch (auth.type) {
    case 'script':
      return {
        grantType: 'client_credentials',
        clientId: auth.scriptName,
        clientSecret: auth.scriptKey,
        scope: auth.sudoAsLogin ? `sudo_as_login:${auth.sudoAsLogin}` : undefined,
        sessionUuid: auth.sessionUuid,
      }
    case 'password':
      return {
        grantType: 'password',
        username: auth.username,
        password: auth.password,
        authToken: auth.authToken,
        scope: auth.sudoAsLogin ? `sudo_as_login:${auth.sudoAsLogin}` : undefined,
        sessionUuid: auth.sessionUuid,
      }
    case 'session':
      return { grantType: 'session_token', sessionToken: auth.sessionToken }
    case 'refresh':
      return { grantType: 'refresh_token', refreshToken: auth.refreshToken }
    case 'token':
      return auth
  }
}
