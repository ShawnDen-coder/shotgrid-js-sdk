export interface JsonApiRecord<TAttributes extends object = object> {
  type: string
  id: string
  attributes: TAttributes
}

export interface JsonApiResponse<TData> {
  data: TData
  links: { self: string; next?: string; prev?: string }
}
