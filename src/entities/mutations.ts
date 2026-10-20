import type { MultiEntityUpdateMode } from '../types'

export function mutationData(
  data: object,
  modes: Readonly<Record<string, MultiEntityUpdateMode | undefined>> = {},
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...data }
  for (const [field, mode] of Object.entries(modes)) {
    if (mode === undefined) continue
    if (!['set', 'add', 'remove'].includes(mode))
      throw new TypeError(`Invalid update mode for ${field}.`)
    if (!Object.hasOwn(data, field) || !Array.isArray(result[field])) {
      throw new TypeError(`Multi-entity update mode requires an array value for ${field}.`)
    }
    result[field] = { multi_entity_update_mode: mode, value: result[field] }
  }
  return result
}

export function returnFieldParams(
  data: object,
  extra: readonly string[] = [],
): Record<string, unknown> {
  return { 'options[fields]': [...new Set([...Object.keys(data), ...extra])].join(',') }
}
