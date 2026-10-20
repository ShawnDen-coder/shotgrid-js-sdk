import axios, { AxiosError, type AxiosInstance } from 'axios'
import { emitLog } from '../logging'
import type { AccessTokenResponse, AuthCredentials, AuthTokens, SdkLogger } from '../types'
import { AuthServiceError, toAuthServiceError } from './errors'
import { encodeGrant } from './grants'
import { isAccessTokenResponse, toAuthTokens } from './tokens'

export interface AuthServiceOptions {
  baseUrl: string
  apiVersion?: 'v1' | 'v1.1'
  timeoutMs?: number
  maxRetries?: number
  retryBaseDelayMs?: number
  httpClient?: AxiosInstance
  logger?: SdkLogger
}

export class AuthService {
  private readonly logger?: SdkLogger
  private readonly tokenUrl: string
  private readonly httpClient: AxiosInstance
  private readonly maxRetries: number
  private readonly retryBaseDelayMs: number

  constructor(options: AuthServiceOptions) {
    this.logger = options.logger
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
    const payload = encodeGrant(credentials)
    // Refresh tokens are single-use; a lost response cannot safely be retried.
    const maxRetries = credentials.grantType === 'refresh_token' ? 0 : this.maxRetries
    const totalAttempts = maxRetries + 1

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const tokens = await this.requestAccessTokenOnce(payload)
        if (attempt > 0) {
          emitLog(this.logger, 'info', 'ShotGrid auth succeeded after retry', {
            grantType: credentials.grantType,
            attempt: attempt + 1,
            totalAttempts,
          })
        }
        return tokens
      } catch (error) {
        const hasNextAttempt = attempt < maxRetries
        const retryable = AuthService.shouldRetry(error)
        if (!hasNextAttempt || !retryable) {
          emitLog(this.logger, 'error', 'ShotGrid auth request failed', {
            grantType: credentials.grantType,
            attempt: attempt + 1,
            totalAttempts,
            retryable,
            status: AuthService.getHttpStatus(error),
          })
          throw toAuthServiceError(error)
        }

        const delayMs = this.getRetryDelayMs(attempt)
        emitLog(this.logger, 'warn', 'ShotGrid auth request retry scheduled', {
          grantType: credentials.grantType,
          attempt: attempt + 1,
          nextAttempt: attempt + 2,
          totalAttempts,
          delayMs,
          status: AuthService.getHttpStatus(error),
        })

        await AuthService.sleep(delayMs)
      }
    }

    throw new AuthServiceError('ShotGrid authentication failed after retries.')
  }

  private async requestAccessTokenOnce(payload: URLSearchParams): Promise<AuthTokens> {
    const response = await this.httpClient.post<AccessTokenResponse>(this.tokenUrl, payload, {
      maxRedirects: 0,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    if (!isAccessTokenResponse(response.data)) {
      throw new AuthServiceError('ShotGrid token response format is invalid.')
    }

    return toAuthTokens(response.data)
  }

  private getRetryDelayMs(attempt: number): number {
    const exponential = this.retryBaseDelayMs * 2 ** attempt
    const jitter = Math.floor(Math.random() * 100)
    return exponential + jitter
  }

  private static normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, '')
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

  private static async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }
}
