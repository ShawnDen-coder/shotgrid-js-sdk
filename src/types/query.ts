import type { EntityField, EntityLink, EntitySchema, EntityType } from './schema'

export type FilterOperator =
  | 'is'
  | 'is_not'
  | 'less_than'
  | 'greater_than'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'between'
  | 'not_between'
  | 'in'
  | 'not_in'
  | 'in_last'
  | 'not_in_last'
  | 'in_next'
  | 'not_in_next'
  | 'type_is'
  | 'type_is_not'
  | 'in_calendar_day'
  | 'in_calendar_week'
  | 'in_calendar_month'
  | 'in_calendar_year'
  | 'name_contains'
  | 'name_not_contains'
  | 'name_is'
  | 'name_starts_with'
  | 'name_ends_with'

export type FilterCondition<E extends EntityType = EntityType> = readonly [
  field: EntityField<E>,
  operator: FilterOperator,
  value: unknown,
  ...values: unknown[],
]
export interface FilterGroup<E extends EntityType = EntityType> {
  filter_operator: 'all' | 'any'
  filters: readonly (FilterCondition<E> | FilterGroup<E>)[]
}
export type Filters<E extends EntityType = EntityType> =
  | readonly (FilterCondition<E> | FilterGroup<E>)[]
  | FilterGroup<E>

export interface FindOptions<E extends EntityType = EntityType> {
  order?: readonly { field_name: EntityField<E>; direction: 'asc' | 'desc' }[]
  filter_operator?: 'all' | 'any'
  /** 0 means all matching records; a positive page returns just that logical page. */
  limit?: number
  page?: number
  retired_only?: boolean
  include_archived_projects?: boolean
  signal?: AbortSignal
}

export type FindOneOptions<E extends EntityType = EntityType> = Omit<
  FindOptions<E>,
  'limit' | 'page'
>
export type MultiEntityUpdateMode = 'set' | 'add' | 'remove'
type MultiEntityField<E extends EntityType> = E extends EntityType
  ? {
      [K in keyof EntitySchema[E]]: NonNullable<EntitySchema[E][K]> extends readonly EntityLink[]
        ? K
        : never
    }[keyof EntitySchema[E]] &
      string
  : never
export type MultiEntityUpdateModes<E extends EntityType = EntityType> = Partial<
  Record<MultiEntityField<E>, MultiEntityUpdateMode>
>
