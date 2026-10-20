import type {
  EntityType,
  FilterCondition,
  FilterGroup,
  Filters,
  RestFilterCondition,
  RestFilterGroup,
} from '../types'

/** Python flattens condition arguments; REST expects one value (possibly an array). */
function condition<E extends EntityType>(filter: FilterCondition<E>): RestFilterCondition {
  const [field, operator, ...values] = filter
  if (!field || !operator || !values.length)
    throw new TypeError('A filter requires a field, operator and value.')
  if (
    [
      'in',
      'not_in',
      'between',
      'not_between',
      'in_last',
      'not_in_last',
      'in_next',
      'not_in_next',
    ].includes(operator)
  ) {
    return [field, operator, values.length === 1 && Array.isArray(values[0]) ? values[0] : values]
  }
  if (values.length !== 1) throw new TypeError(`Filter operator ${operator} expects one value.`)
  return [field, operator, values[0]]
}

export function toRestFilters<E extends EntityType>(
  filters: Filters<E>,
  operator: 'all' | 'any' = 'all',
): RestFilterGroup {
  const group: FilterGroup<E> = Array.isArray(filters)
    ? { filter_operator: operator, filters }
    : (filters as FilterGroup<E>)
  if (group.filter_operator !== 'all' && group.filter_operator !== 'any') {
    throw new TypeError('filter_operator must be all or any.')
  }
  return {
    logical_operator: group.filter_operator === 'all' ? 'and' : 'or',
    conditions: group.filters.map((item) =>
      Array.isArray(item)
        ? condition(item as FilterCondition<E>)
        : toRestFilters(item as FilterGroup<E>),
    ),
  }
}
