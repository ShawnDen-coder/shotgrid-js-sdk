import type { EntityLink, JsonApiRecord } from '../types'

function numericId(value: string | number): number {
  const id = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) throw new TypeError(`Invalid entity ID: ${value}`)
  return id
}

/** Only normalize relationship values; arbitrary attribute JSON is left untouched. */
function relationship(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(relationship)
  if (!value || typeof value !== 'object') return value
  if ('data' in value) return relationship(value.data)
  if (
    'type' in value &&
    'id' in value &&
    typeof value.type === 'string' &&
    (typeof value.id === 'string' || typeof value.id === 'number')
  ) {
    return { ...value, id: numericId(value.id) }
  }
  return value
}

export function flattenRecord(record: JsonApiRecord): EntityLink & Record<string, unknown> {
  if (!record || typeof record.type !== 'string' || record.id === undefined) {
    throw new TypeError('Invalid entity record returned by ShotGrid.')
  }
  const relations = Object.fromEntries(
    Object.entries(record.relationships ?? {}).map(([key, value]) => [key, relationship(value)]),
  )
  return { ...record.attributes, ...relations, type: record.type, id: numericId(record.id) }
}

export function validateEntityId(id: number): void {
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new TypeError('Entity ID must be a positive safe integer.')
}
