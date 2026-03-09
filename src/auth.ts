import { logger } from '@logger'
import type {
  AccessTokenResponse,
  AuthCredentials,
  AuthTokens,
  ShotGridErrorResponse,
} from '@types'
import axios, { AxiosError, type AxiosInstance } from 'axios'

export interface AuthServiceOptions {
  baseUrl: string
  apiVersion?: 'v1' | 'v1.1'
  timeoutMs?: number
  maxRetries?: number
  retryBaseDelayMs?: number
  httpClient?: AxiosInstance
}

export class AuthServiceError extends Error {
  readonly status?: number
  readonly code?: number
  readonly title?: string
  readonly detail?: string
  readonly cause?: unknown

  constructor(
    message: string,
    options?: {
      status?: number
      code?: number
      title?: string
      detail?: string
      cause?: unknown
    },
  ) {
    super(message)
    this.name = 'AuthServiceError'
    this.status = options?.status
    this.code = options?.code
    this.title = options?.title
    this.detail = options?.detail
    this.cause = options?.cause
  }
}

export class AuthService {
  private readonly tokenUrl: string
  private readonly httpClient: AxiosInstance
  private readonly maxRetries: number
  private readonly retryBaseDelayMs: number

  constructor(options: AuthServiceOptions) {
    const apiVersion = options.apiVersion ?? 'v1.1'
    const normalizedBaseUrl = AuthService.normalizeBaseUrl(options.baseUrl)
    this.tokenUrl = `${normalizedBaseUrl}/api/${apiVersion}/auth/access_token`
    this.maxRetries = Math.max(0, options.maxRetries ?? 2)
    this.retryBaseDelayMs = Math.max(50, options.retryBaseDelayMs ?? 300)

    this.httpClient =
      options.httpClient ??
      axios.create({
        timeout: options.timeoutMs ?? 15_000,
      })
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthTokens> {
    return this.requestAccessToken(credentials)
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const grant: Extract<AuthCredentials, { grantType: 'refresh_token' }> = {
      grantType: 'refresh_token',
      refreshToken,
    }
    return this.requestAccessToken(grant)
  }

  private async requestAccessToken(credentials: AuthCredentials): Promise<AuthTokens> {
    const payload = this.toFormPayload(credentials)
    const totalAttempts = this.maxRetries + 1

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const tokens = await this.requestAccessTokenOnce(payload)
        if (attempt > 0) {
          logger.info('ShotGrid auth succeeded after retry', {
            grantType: credentials.grantType,
            attempt: attempt + 1,
            totalAttempts,
          })
        }
        return tokens
      } catch (error) {
        const hasNextAttempt = attempt < this.maxRetries
        const retryable = AuthService.shouldRetry(error)
        if (!hasNextAttempt || !retryable) {
          logger.error('ShotGrid auth request failed', {
            grantType: credentials.grantType,
            attempt: attempt + 1,
            totalAttempts,
            retryable,
            status: AuthService.getHttpStatus(error),
            error: AuthService.getErrorMessage(error),
          })
          throw AuthService.toAuthServiceError(error)
        }

        const delayMs = this.getRetryDelayMs(attempt)
        logger.warn('ShotGrid auth request retry scheduled', {
          grantType: credentials.grantType,
          attempt: attempt + 1,
          nextAttempt: attempt + 2,
          totalAttempts,
          delayMs,
          status: AuthService.getHttpStatus(error),
          error: AuthService.getErrorMessage(error),
        })

        await AuthService.sleep(delayMs)
      }
    }

    throw new AuthServiceError('ShotGrid authentication failed after retries.')
  }

  private async requestAccessTokenOnce(payload: URLSearchParams): Promise<AuthTokens> {
    const response = await this.httpClient.post<AccessTokenResponse>(this.tokenUrl, payload, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    if (!AuthService.isAccessTokenResponse(response.data)) {
      throw new AuthServiceError('ShotGrid token response format is invalid.')
    }

    return AuthService.toAuthTokens(response.data)
  }

  private getRetryDelayMs(attempt: number): number {
    const exponential = this.retryBaseDelayMs * 2 ** attempt
    const jitter = Math.floor(Math.random() * 100)
    return exponential + jitter
  }

  private toFormPayload(credentials: AuthCredentials): URLSearchParams {
    switch (credentials.grantType) {
      case 'client_credentials':
        return this.toClientCredentialsForm(credentials)

      case 'password':
        return this.toPasswordForm(credentials)

      case 'session_token':
        return this.toSessionTokenForm(credentials)

      case 'refresh_token':
        return this.toRefreshTokenForm(credentials)
    }
  }

  private toClientCredentialsForm(
    credentials: Extract<AuthCredentials, { grantType: 'client_credentials' }>,
  ): URLSearchParams {
    const form = new URLSearchParams()
    form.set('grant_type', 'client_credentials')
    form.set('client_id', credentials.clientId)
    form.set('client_secret', credentials.clientSecret)
    this.appendOptionalScopeAndSession(form, credentials)
    return form
  }

  private toPasswordForm(
    credentials: Extract<AuthCredentials, { grantType: 'password' }>,
  ): URLSearchParams {
    const form = new URLSearchParams()
    form.set('grant_type', 'password')
    form.set('username', credentials.username)
    form.set('password', credentials.password)
    if (credentials.authToken) {
      form.set('auth_token', credentials.authToken)
    }
    this.appendOptionalScopeAndSession(form, credentials)
    return form
  }

  private toSessionTokenForm(
    credentials: Extract<AuthCredentials, { grantType: 'session_token' }>,
  ): URLSearchParams {
    const form = new URLSearchParams()
    form.set('grant_type', 'session_token')
    form.set('session_token', credentials.sessionToken)
    return form
  }

  private toRefreshTokenForm(
    credentials: Extract<AuthCredentials, { grantType: 'refresh_token' }>,
  ): URLSearchParams {
    const form = new URLSearchParams()
    form.set('grant_type', 'refresh_token')
    form.set('refresh_token', credentials.refreshToken)
    return form
  }

  private appendOptionalScopeAndSession(
    form: URLSearchParams,
    credentials: { scope?: string; sessionUuid?: string },
  ): void {
    if (credentials.scope) {
      form.set('scope', credentials.scope)
    }
    if (credentials.sessionUuid) {
      form.set('session_uuid', credentials.sessionUuid)
    }
  }

  private static toAuthTokens(response: AccessTokenResponse): AuthTokens {
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

  private static normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, '')
  }

  private static isAccessTokenResponse(value: unknown): value is AccessTokenResponse {
    if (!value || typeof value !== 'object') {
      return false
    }

    const candidate = value as Partial<AccessTokenResponse>
    return (
      typeof candidate.token_type === 'string' &&
      typeof candidate.access_token === 'string' &&
      typeof candidate.expires_in === 'number' &&
      typeof candidate.refresh_token === 'string'
    )
  }

  private static shouldRetry(error: unknown): boolean {
    if (!(error instanceof AxiosError)) {
      return false
    }

    if (!error.response) {
      return true
    }

    const status = error.response.status
    return status === 429 || status >= 500
  }

  private static getHttpStatus(error: unknown): number | undefined {
    if (error instanceof AxiosError) {
      return error.response?.status
    }
    return undefined
  }

  private static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    return 'Unknown error'
  }

  private static async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }

  private static toAuthServiceError(error: unknown): AuthServiceError {
    if (error instanceof AuthServiceError) {
      return error
    }

    if (error instanceof AxiosError) {
      const status = error.response?.status
      const errorPayload = error.response?.data as ShotGridErrorResponse | undefined
      const firstError = errorPayload?.errors?.[0]

      const detail = firstError?.detail
      const title = firstError?.title
      const code = firstError?.code

      const message = detail || title || error.message || 'ShotGrid authentication failed.'

      return new AuthServiceError(message, {
        status,
        code,
        title,
        detail,
        cause: error,
      })
    }

    return new AuthServiceError('Unexpected authentication error.', {
      cause: error,
    })
  }
}
