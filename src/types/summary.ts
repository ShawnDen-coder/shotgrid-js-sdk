import type { EntityField, EntityType } from './schema'

export type SummaryType =
  | 'record_count'
  | 'count'
  | 'sum'
  | 'maximum'
  | 'minimum'
  | 'average'
  | 'earliest'
  | 'latest'
  | 'percentage'
  | 'status_percentage'
  | 'status_percentage_as_float'
  | 'status_list'
  | 'checked'
  | 'unchecked'
export interface SummaryField<E extends EntityType> {
  field: EntityField<E>
  type: SummaryType
}
export interface SummaryOptions<E extends EntityType> {
  filter_operator?: 'all' | 'any'
  include_archived_projects?: boolean
  grouping?: readonly {
    field: EntityField<E>
    type:
      | 'exact'
      | 'tens'
      | 'hundreds'
      | 'thousands'
      | 'tensofthousands'
      | 'hundredsofthousands'
      | 'millions'
      | 'day'
      | 'week'
      | 'month'
      | 'quarter'
      | 'year'
      | 'clustered_date'
      | 'oneday'
      | 'fivedays'
      | 'entitytype'
    direction: 'asc' | 'desc'
  }[]
  signal?: AbortSignal
}
export interface SummaryGroup {
  group_name: string
  group_value: unknown
  summaries: Record<string, unknown>
  groups?: SummaryGroup[]
}
export interface SummaryResult {
  summaries: Record<string, unknown>
  groups: SummaryGroup[]
}
