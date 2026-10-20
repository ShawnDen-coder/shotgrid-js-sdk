/** REST paths use plural snake_case, while batch bodies use API type names. */
export function snakeCase(entity: string): string {
  return entity
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/([a-zA-Z])(\d+)/g, '$1_$2')
    .toLowerCase()
}

export function restEntityName(entity: string): string {
  const singular = snakeCase(entity)
  if (/[^aeiou]y$/.test(singular)) return `${singular.slice(0, -1)}ies`
  if (/(s|x|z|ch|sh)$/.test(singular)) return `${singular}es`
  return `${singular}s`
}
