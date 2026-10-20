export interface JsonApiRecord<TAttributes extends object = object> {
  type: string
  id: string | number
  relationships?: Record<string, unknown>
  links?: { self: string }
  attributes?: TAttributes
}

export interface JsonApiResponse<TData> {
  data: TData
  links?: { self?: string; next?: string | null; prev?: string | null }
}
