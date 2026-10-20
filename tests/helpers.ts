import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { ShotGridClient } from '../src'

export const tokenResponse = (access = 'access', expires = 3600) => ({
  token_type: 'Bearer',
  access_token: access,
  refresh_token: `refresh-${access}`,
  expires_in: expires,
})
export function response(config: InternalAxiosRequestConfig, data: unknown, status = 200) {
  return { data, status, statusText: 'OK', headers: {}, config }
}
export function httpError(config: InternalAxiosRequestConfig, status: number) {
  return new AxiosError('HTTP error', undefined, config, undefined, {
    data: { errors: [{ code: 103, detail: 'API rejected request' }] },
    status,
    statusText: 'error',
    headers: new AxiosHeaders(),
    config,
  })
}
export function fixture(
  handler: (config: InternalAxiosRequestConfig) => unknown | Promise<unknown>,
) {
  const calls: InternalAxiosRequestConfig[] = []
  const httpClient = axios.create({
    baseURL: 'https://example.com/api/v1.1',
    adapter: async (config) => {
      if (config.url?.endsWith('access_token')) return response(config, tokenResponse())
      calls.push(config)
      return response(config, await handler(config))
    },
  })
  const sg = new ShotGridClient({
    baseUrl: 'https://example.com',
    auth: { type: 'script', scriptName: 'script', scriptKey: 'key' },
    httpClient,
    maxRetries: 0,
  })
  return { sg, calls }
}
export function record(id: number, attributes: Record<string, unknown> = {}) {
  return { type: 'Asset', id, attributes }
}
