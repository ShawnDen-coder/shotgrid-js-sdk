import type { EntityField, EntityType, Filters, FindOptions } from '../types'
import { toRestFilters } from './filters'

/** One REST page is an implementation detail of the Python-compatible iterator. */
export function prepareQuery<E extends EntityType>(
  filters: Filters<E>,
  fields: readonly EntityField<E>[],
  options: FindOptions<E>,
) {
  const limit = options.limit ?? 0
  const page = options.page ?? 0
  if (!Number.isSafeInteger(limit) || limit < 0 || !Number.isSafeInteger(page) || page < 0) {
    throw new TypeError('limit and page must be non-negative safe integers.')
  }
  if (page > 0 && limit === 0) throw new TypeError('A positive page requires a positive limit.')
  const offset = page > 0 ? (page - 1) * limit : 0
  if (!Number.isSafeInteger(offset)) throw new TypeError('Requested page offset is too large.')
  return {
    filters: toRestFilters(filters, options.filter_operator),
    limit,
    offset,
    pageSize: limit > 0 ? Math.min(limit, 500) : 500,
    params: {
      fields: fields.filter((field) => field !== 'type').join(','),
      sort: options.order?.length
        ? options.order
            .map((item) => `${item.direction === 'desc' ? '-' : ''}${item.field_name}`)
            .join(',')
        : 'id',
      'options[return_only]': options.retired_only ? 'retired' : 'active',
      'options[include_archived_projects]': options.include_archived_projects ?? true,
    },
  }
}
