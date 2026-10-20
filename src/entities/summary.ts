import { entityPath } from '../http/paths'
import type { RestClient } from '../http/rest-client'
import type {
  EntityType,
  Filters,
  JsonApiResponse,
  SummaryField,
  SummaryOptions,
  SummaryResult,
} from '../types'
import { toRestFilters } from './filters'
import { restEntityName } from './names'

export class SummaryService {
  private readonly rest: RestClient
  constructor(rest: RestClient) {
    this.rest = rest
  }

  async summarize<E extends EntityType>(
    entity: E,
    filters: Filters<E>,
    summaryFields: readonly SummaryField<E>[],
    options: SummaryOptions<E> = {},
  ): Promise<SummaryResult> {
    if (new Set(summaryFields.map((item) => item.field)).size !== summaryFields.length) {
      throw new TypeError('Only one summary per field is supported.')
    }
    const response = await this.rest.request<JsonApiResponse<SummaryResult>>(
      'POST',
      `${entityPath(restEntityName(entity))}/_summarize`,
      {
        contentType: 'application/vnd+shotgun.api3_hash+json',
        signal: options.signal,
        data: {
          filters: toRestFilters(filters, options.filter_operator),
          summary_fields: summaryFields,
          grouping: options.grouping,
          options: { include_archived_projects: options.include_archived_projects ?? true },
        },
      },
    )
    return response.data
  }
}
