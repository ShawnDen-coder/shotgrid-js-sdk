import type { RestClient } from '../http/rest-client'
import type { BatchRequest, BatchResult, RestBatchRequest } from '../types'
import { mutationData } from './mutations'
import { flattenRecord, validateEntityId } from './records'

export class BatchService {
  private readonly rest: RestClient
  constructor(rest: RestClient) {
    this.rest = rest
  }

  async execute(requests: readonly BatchRequest[]): Promise<BatchResult[]> {
    if (!requests.length) return []
    const body = requests.map((operation): RestBatchRequest => {
      if (operation.request_type !== 'create') validateEntityId(operation.entity_id)
      switch (operation.request_type) {
        case 'create':
          return {
            request_type: 'create',
            entity: operation.entity_type,
            data: mutationData(operation.data),
            options: { fields: Object.keys(operation.data) },
          }
        case 'update':
          return {
            request_type: 'update',
            entity: operation.entity_type,
            record_id: operation.entity_id,
            data: mutationData(operation.data, operation.multi_entity_update_modes),
          }
        case 'delete':
          return {
            request_type: 'delete',
            entity: operation.entity_type,
            record_id: operation.entity_id,
          }
      }
      throw new TypeError('Unsupported batch operation.')
    })
    const response = await this.rest.batch(body)
    if (!Array.isArray(response.data) || response.data.length !== requests.length) {
      throw new TypeError('Batch response must contain one result per operation.')
    }
    return response.data.map((item, index) => {
      if (requests[index].request_type === 'delete') {
        // A successful atomic REST batch may represent a delete with null/record.
        return typeof item === 'boolean' ? item : true
      }
      if (!item || typeof item === 'boolean')
        throw new TypeError('Expected a record for a batch mutation.')
      return flattenRecord(item)
    })
  }
}
