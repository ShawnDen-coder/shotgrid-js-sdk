import type { FilterOperator } from './query'
import type { EntityField, EntitySchema, EntityType } from './schema'

type FieldValue<E extends EntityType, K extends EntityField<E>> = K extends 'id'
  ? number
  : K extends 'type'
    ? E
    : K extends keyof EntitySchema[E]
      ? EntitySchema[E][K]
      : unknown
type Comparable<V> = V extends readonly (infer Item)[] ? Item : V
type TimeUnit = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'

/** Typed operands for fluent filters; Python-style filters remain the flexible escape hatch. */
export type FilterArguments<
  E extends EntityType,
  K extends EntityField<E>,
  O extends FilterOperator,
> = O extends 'in_last' | 'not_in_last' | 'in_next' | 'not_in_next'
  ? [amount: number, unit: TimeUnit] | [range: readonly [number, TimeUnit]]
  : O extends 'in_calendar_day' | 'in_calendar_week' | 'in_calendar_month' | 'in_calendar_year'
    ? [offset: number]
    : O extends 'in' | 'not_in'
      ?
          | [values: readonly Comparable<FieldValue<E, K>>[]]
          | [first: Comparable<FieldValue<E, K>>, ...rest: Comparable<FieldValue<E, K>>[]]
      : O extends 'between' | 'not_between'
        ?
            | [lower: FieldValue<E, K>, upper: FieldValue<E, K>]
            | [range: readonly [FieldValue<E, K>, FieldValue<E, K>]]
        : O extends 'is' | 'is_not'
          ? [value: Comparable<FieldValue<E, K>> | null]
          : O extends 'less_than' | 'greater_than'
            ? [value: NonNullable<FieldValue<E, K>>]
            : [value: string]
