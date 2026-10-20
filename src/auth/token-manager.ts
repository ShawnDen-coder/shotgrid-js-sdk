import type { AuthCredentials } from '../types/auth-grants'
import type { AuthTokens } from '../types/auth-tokens'
import { ShotGridClientError } from '../types/client-error'
import type { AccessTokenProvider } from '../types/client-options'
import { AuthServiceError } from './errors'
import type { AuthService } from './service'

type TokenState = Pick<AuthTokens, 'accessToken' | 'tokenType' | 'expiresAt' | 'expiresIn'> & {
  refreshToken?: string
}

/** Owns the rotating token pair and the single in-flight acquisition. */
export class TokenManager {
  private tokens: TokenState | null = null
  private tokenRequest: Promise<TokenState> | null = null
  private refreshOnlyFailure: unknown
  private readonly authService: AuthService
  private readonly credentials: AuthCredentials | AccessTokenProvider
  private readonly leewayMs: number

  constructor(
    authService: AuthService,
    credentials: AuthCredentials | AccessTokenProvider,
    leewayMs = 30_000,
  ) {
    this.authService = authService
    this.credentials = credentials
    this.leewayMs = Math.max(0, leewayMs)
  }

  async authenticate(): Promise<void> {
    await this.getTokens()
  }

  async getTokens(rejectedToken?: string): Promise<TokenState> {
    if (this.tokenRequest) return this.tokenRequest
    if (this.refreshOnlyFailure !== undefined) throw this.refreshOnlyFailure
    const current = this.tokens
    if (
      current &&
      current.accessToken !== rejectedToken &&
      current.expiresAt - Math.min(this.leewayMs, current.expiresIn * 500) > Date.now()
    ) {
      return current
    }

    // Once an exchange starts, the old refresh token may be consumed even if its
    // response is lost. Never reuse that pair on a later automatic attempt.
    this.tokens = null
    this.tokenRequest = TokenManager.acquireTokens(async () => {
      if ('type' in this.credentials) {
        const provided = await this.credentials.getAccessToken()
        const expiresAt = provided.expiresAt ?? Infinity
        if (
          typeof provided.accessToken !== 'string' ||
          provided.accessToken.length === 0 ||
          (expiresAt !== Infinity && (!Number.isFinite(expiresAt) || expiresAt <= Date.now()))
        ) {
          throw new TypeError('Token provider must return a non-empty, unexpired access token.')
        }
        return {
          accessToken: provided.accessToken,
          tokenType: 'Bearer',
          expiresAt,
          expiresIn: (expiresAt - Date.now()) / 1000,
        }
      }
      if (current?.refreshToken) {
        try {
          return await this.authService.refresh(current.refreshToken)
        } catch (error) {
          // Only invalid credentials justify fallback; outages must not trigger another login.
          if (
            !(error instanceof AuthServiceError) ||
            (error.status !== 400 && error.status !== 401) ||
            this.credentials.grantType === 'refresh_token'
          )
            throw error
        }
      }
      return this.authService.authenticate(this.credentials)
    })
    try {
      this.tokens = await this.tokenRequest
      return this.tokens
    } catch (error) {
      if ('grantType' in this.credentials && this.credentials.grantType === 'refresh_token') {
        this.refreshOnlyFailure = error
      }
      throw error
    } finally {
      this.tokenRequest = null
    }
  }

  private static async acquireTokens(fn: () => Promise<TokenState>): Promise<TokenState> {
    try {
      return await fn()
    } catch (error) {
      if (error instanceof AuthServiceError) {
        throw new ShotGridClientError(error.message, {
          kind: 'auth_failed',
          status: error.status,
          code: error.code,
          title: error.title,
          detail: error.detail,
          cause: error,
        })
      }
      throw new ShotGridClientError('Authentication failed.', {
        kind: 'auth_failed',
        cause: error,
      })
    }
  }
}
