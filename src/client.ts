import { logger } from '@logger'
import { AuthService, AuthServiceError } from '@auth'
import type {
  AuthCredentials,
  AuthTokens,
  ShotGridClientOptions,
  ShotGridErrorResponse,
} from '@types'
import { ShotGridClientError } from '@types'
import axios, { AxiosError, type AxiosInstance } from 'axios'

export class ShotGridClient {
  private readonly authService: AuthService
  private readonly httpClient: AxiosInstance
  private readonly credentials: AuthCredentials
  private readonly leewayMs: number
  private tokens: AuthTokens | null = null

  constructor(options: ShotGridClientOptions) {
    const normalizedBaseUrl = ShotGridClient.normalizeBaseUrl(options.baseUrl)
    const apiVersion = options.apiVersion ?? 'v1.1'
    this.leewayMs = options.leewayMs ?? 30_000
    this.credentials = options.credentials

    this.httpClient = axios.create({
      baseURL: `${normalizedBaseUrl}/api/${apiVersion}`,
      timeout: options.timeoutMs ?? 15_000,
      headers: { Accept: 'application/json' },
    })

    this.authService = new AuthService({
      baseUrl: options.baseUrl,
      apiVersion: options.apiVersion,
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
      retryBaseDelayMs: options.retryBaseDelayMs,
      httpClient: this.httpClient,
    })
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('GET', path, { params })
  }

  async post<T>(path: string, body?: unknown, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', path, { data: body, params })
  }

  async search<T>(entityType: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', `/entity/${entityType}/_search`, {
      data: body,
      contentType: 'application/vnd+shotgun.api3_hash+json',
    })
  }

  async put<T>(path: string, body?: unknown, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('PUT', path, { data: body, params })
  }

  async delete<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('DELETE', path, { params })
  }

  private async ensureValidToken(): Promise<string> {
    if (this.tokens === null) {
      logger.info('ShotGridClient: no token cached, authenticating', {
        grantType: this.credentials.grantType,
      })
      this.tokens = await ShotGridClient.acquireTokens(() =>
        this.authService.authenticate(this.credentials),
      )
      return this.tokens.accessToken
    }

    if (this.tokens.expiresAt - this.leewayMs < Date.now()) {
      logger.info('ShotGridClient: token near expiry, attempting refresh')
      try {
        this.tokens = await this.authService.refresh(this.tokens.refreshToken)
      } catch (error) {
        logger.warn('ShotGridClient: refresh failed, falling back to full auth', {
          error: ShotGridClient.getErrorMessage(error),
        })
        this.tokens = await ShotGridClient.acquireTokens(() =>
          this.authService.authenticate(this.credentials),
        )
      }
    }

    return this.tokens.accessToken
  }

  private async request<T>(
    method: string,
    path: string,
    options?: { data?: unknown; params?: Record<string, unknown>; contentType?: string },
  ): Promise<T> {
    const accessToken = await this.ensureValidToken()

    try {
      const response = await this.httpClient.request<T>({
        method,
        url: path,
        params: options?.params,
        data: options?.data,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(options?.contentType ? { 'Content-Type': options.contentType } : {}),
        },
      })
      return response.data
    } catch (error) {
      throw ShotGridClient.toClientError(error)
    }
  }

  private static async acquireTokens(fn: () => Promise<AuthTokens>): Promise<AuthTokens> {
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

  private static toClientError(error: unknown): ShotGridClientError {
    if (error instanceof AxiosError) {
      const status = error.response?.status
      const errorPayload = error.response?.data as ShotGridErrorResponse | undefined
      const firstError = errorPayload?.errors?.[0]

      const detail = firstError?.detail
      const title = firstError?.title
      const code = firstError?.code

      const message = detail ?? title ?? error.message ?? 'ShotGrid request failed.'

      return new ShotGridClientError(message, {
        kind: 'http_error',
        status,
        code,
        title,
        detail,
        cause: error,
      })
    }

    return new ShotGridClientError(ShotGridClient.getErrorMessage(error), {
      kind: 'unexpected',
      cause: error,
    })
  }

  private static normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, '')
  }

  private static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    return 'Unknown error'
  }
}
