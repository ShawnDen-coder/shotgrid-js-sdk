import axios, { type AxiosInstance } from 'axios'
import type { TokenManager } from '../auth/token-manager'
import { ShotGridClientError } from '../types/client-error'
import { toClientError } from './errors'
import { validateApiPath } from './paths'

export interface RequestOptions {
  data?: unknown
  params?: Record<string, unknown>
  contentType?: string
  signal?: AbortSignal
}

/** Authorized transport. Never retries ambiguous write/network failures. */
export class Transport {
  private readonly httpClient: AxiosInstance
  private readonly tokens: TokenManager

  constructor(httpClient: AxiosInstance, tokens: TokenManager) {
    this.httpClient = httpClient
    this.tokens = tokens
  }

  async request<T>(method: string, path: string, options?: RequestOptions): Promise<T> {
    validateApiPath(path)
    options?.signal?.throwIfAborted()
    let tokens = await this.tokens.getTokens()
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await this.httpClient.request<T>({
          method,
          signal: options?.signal,
          url: path,
          params: options?.params,
          data: options?.data,
          maxRedirects: 0,
          headers: {
            Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
            ...(options?.contentType ? { 'Content-Type': options.contentType } : {}),
          },
        })
        return response.data
      } catch (error) {
        if (attempt === 0 && axios.isAxiosError(error) && error.response?.status === 401) {
          tokens = await this.tokens.getTokens(tokens.accessToken)
          continue
        }
        throw toClientError(error)
      }
    }
    throw new ShotGridClientError('Request failed.', { kind: 'unexpected' })
  }
}
