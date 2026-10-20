export type RestFilterCondition = [field: string, operator: string, value: unknown]

export interface RestFilterGroup {
  logical_operator: 'and' | 'or'
  conditions: (RestFilterCondition | RestFilterGroup)[]
}

export interface SearchRequest {
  filters?: RestFilterCondition[] | RestFilterGroup
  fields?: string[]
  sort?: string
  page?: { size?: number; number?: number }
  options?: { return_only?: 'active' | 'retired' }
}

export type RestBatchRequest =
  | {
      request_type: 'create'
      entity: string
      data: Record<string, unknown>
      options?: { fields?: string[] }
    }
  | {
      request_type: 'update'
      entity: string
      record_id: number
      data: Record<string, unknown>
      options?: { fields?: string[] }
    }
  | { request_type: 'delete'; entity: string; record_id: number }
