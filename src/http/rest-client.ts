import type { JsonApiRecord, JsonApiResponse, RestBatchRequest, SearchRequest } from '../types'
import { entityPath } from './paths'
import type { RequestOptions, Transport } from './transport'

/** Raw REST responses and request bodies, without Python compatibility transforms. */
export class RestClient {
  private readonly transport: Transport
  constructor(transport: Transport) {
    this.transport = transport
  }

  request<T>(method: string, path: string, options?: RequestOptions): Promise<T> {
    return this.transport.request<T>(method, path, options)
  }
  get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('GET', path, { params })
  }
  post<T>(path: string, data?: unknown, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', path, { data, params })
  }
  put<T>(path: string, data?: unknown, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('PUT', path, { data, params })
  }
  delete<T = void>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('DELETE', path, { params })
  }
  search<T = JsonApiResponse<JsonApiRecord[]>>(
    entity: string,
    body?: SearchRequest,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>('POST', `${entityPath(entity)}/_search`, {
      ...options,
      data: body,
      contentType: Array.isArray(body?.filters)
        ? 'application/vnd+shotgun.api3_array+json'
        : 'application/vnd+shotgun.api3_hash+json',
    })
  }
  list<T extends object = Record<string, unknown>>(
    entity: string,
    params?: Record<string, unknown>,
  ) {
    return this.get<JsonApiResponse<JsonApiRecord<T>[]>>(entityPath(entity), params)
  }
  read<T extends object = Record<string, unknown>>(
    entity: string,
    id: number | string,
    params?: Record<string, unknown>,
  ) {
    return this.get<JsonApiResponse<JsonApiRecord<T>>>(entityPath(entity, id), params)
  }
  create<T extends object = Record<string, unknown>>(
    entity: string,
    data: Record<string, unknown>,
    params?: Record<string, unknown>,
  ) {
    return this.post<JsonApiResponse<JsonApiRecord<T>>>(entityPath(entity), data, params)
  }
  update<T extends object = Record<string, unknown>>(
    entity: string,
    id: number | string,
    data: Record<string, unknown>,
    params?: Record<string, unknown>,
  ) {
    return this.put<JsonApiResponse<JsonApiRecord<T>>>(entityPath(entity, id), data, params)
  }
  remove(entity: string, id: number | string): Promise<void> {
    return this.delete(entityPath(entity, id))
  }
  batch<T = JsonApiResponse<(JsonApiRecord | boolean | null)[]>>(
    requests: readonly RestBatchRequest[],
  ): Promise<T> {
    return this.post<T>('/entity/_batch', { requests })
  }
  schema<T = unknown>(entity?: string, projectId?: number): Promise<T> {
    return this.get<T>(
      entity ? `/schema/${encodeURIComponent(entity)}` : '/schema',
      projectId === undefined ? undefined : { project_id: projectId },
    )
  }
}
