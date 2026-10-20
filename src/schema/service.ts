import { snakeCase } from '../entities/names'
import type { RestClient } from '../http/rest-client'
import type { EntityType, JsonApiResponse } from '../types'

export interface SchemaProperty<T = unknown> {
  value: T
  editable: boolean
}
export interface EntitySchemaInfo {
  name: SchemaProperty<string>
  visible: SchemaProperty<boolean>
}
export interface FieldSchemaInfo {
  data_type: SchemaProperty<string>
  name: SchemaProperty<string>
  [property: string]: unknown
}

export class SchemaService {
  private readonly rest: RestClient
  constructor(rest: RestClient) {
    this.rest = rest
  }

  async entityRead(projectId?: number): Promise<Record<string, EntitySchemaInfo>> {
    const response = await this.rest.schema<JsonApiResponse<Record<string, EntitySchemaInfo>>>(
      undefined,
      projectId,
    )
    return response.data
  }

  async fieldRead(
    entity: EntityType,
    field?: string,
    projectId?: number,
  ): Promise<Record<string, FieldSchemaInfo>> {
    const base = `/schema/${encodeURIComponent(snakeCase(entity))}/fields`
    const response = await this.rest.get<JsonApiResponse<Record<string, FieldSchemaInfo>>>(
      field ? `${base}/${encodeURIComponent(field)}` : base,
      projectId === undefined ? undefined : { project_id: projectId },
    )
    // A single field endpoint returns that field's schema directly.
    return field ? { [field]: response.data as unknown as FieldSchemaInfo } : response.data
  }
}
