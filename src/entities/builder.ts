import type {
  EntityField,
  EntityType,
  FilterArguments,
  FilterCondition,
  FilterGroup,
  FilterOperator,
  Filters,
  FindOptions,
  SelectedEntity,
} from '../types'
import type { EntityService } from './service'

/** Immutable query descriptions; only terminal operations perform HTTP requests. */
export class EntityQuery<
  E extends EntityType,
  F extends readonly EntityField<E>[] = readonly ['id'],
> {
  private readonly service: EntityService
  private readonly type: E
  private readonly fields: F
  private readonly filters: readonly (FilterCondition<E> | FilterGroup<E>)[]
  private readonly options: FindOptions<E>

  constructor(
    service: EntityService,
    type: E,
    fields: F,
    filters: readonly (FilterCondition<E> | FilterGroup<E>)[] = [],
    options: FindOptions<E> = {},
  ) {
    this.service = service
    this.type = type
    this.fields = fields
    this.filters = filters
    this.options = options
  }

  private withOptions(options: Partial<FindOptions<E>>): EntityQuery<E, F> {
    return new EntityQuery(this.service, this.type, this.fields, this.filters, {
      ...this.options,
      ...options,
    })
  }

  select<const P extends readonly EntityField<E>[]>(...fields: P): EntityQuery<E, P> {
    return new EntityQuery(this.service, this.type, fields, this.filters, this.options)
  }

  where<K extends EntityField<E>, O extends FilterOperator>(
    field: K,
    operator: O,
    ...values: FilterArguments<E, K, O>
  ): EntityQuery<E, F> {
    const [value, ...rest] = values
    const condition: FilterCondition<E> = [field, operator, value, ...rest]
    return new EntityQuery(
      this.service,
      this.type,
      this.fields,
      [...this.filters, condition],
      this.options,
    )
  }

  /** Add a nested group; all filter()/where() calls are ANDed together. */
  filter(filters: Filters<E>): EntityQuery<E, F> {
    const group: FilterGroup<E> = Array.isArray(filters)
      ? { filter_operator: 'all', filters }
      : (filters as FilterGroup<E>)
    return new EntityQuery(
      this.service,
      this.type,
      this.fields,
      [...this.filters, group],
      this.options,
    )
  }

  whereAny(...conditions: readonly (FilterCondition<E> | FilterGroup<E>)[]): EntityQuery<E, F> {
    return this.filter({ filter_operator: 'any', filters: conditions })
  }

  orderBy(field: EntityField<E>, direction: 'asc' | 'desc' = 'asc'): EntityQuery<E, F> {
    return this.withOptions({
      order: [...(this.options.order ?? []), { field_name: field, direction }],
    })
  }

  limit(limit: number): EntityQuery<E, F> {
    if (!Number.isSafeInteger(limit) || limit < 0)
      throw new TypeError('limit must be a non-negative safe integer.')
    return this.withOptions({ limit })
  }

  page(page: number): EntityQuery<E, F> {
    if (!Number.isSafeInteger(page) || page < 0)
      throw new TypeError('page must be a non-negative safe integer.')
    return this.withOptions({ page })
  }

  retiredOnly(retired = true): EntityQuery<E, F> {
    return this.withOptions({ retired_only: retired })
  }
  includeArchivedProjects(include = true): EntityQuery<E, F> {
    return this.withOptions({ include_archived_projects: include })
  }
  signal(signal: AbortSignal): EntityQuery<E, F> {
    return this.withOptions({ signal })
  }

  all(): Promise<SelectedEntity<E, F>[]> {
    return this.service.find(this.type, this.filters, this.fields, this.options)
  }

  async first(): Promise<SelectedEntity<E, F> | null> {
    if (!this.options.page) {
      return this.service.findOne(this.type, this.filters, this.fields, this.options)
    }
    for await (const record of this.iterate()) return record
    return null
  }

  iterate(): AsyncGenerator<SelectedEntity<E, F>> {
    return this.service.iterate(this.type, this.filters, this.fields, this.options)
  }
}
