import { entityPath } from '../http/paths'
import type { RestClient } from '../http/rest-client'
import type {
  EntityField,
  EntityInput,
  EntityType,
  ExactInput,
  Filters,
  FindOneOptions,
  FindOptions,
  JsonApiRecord,
  JsonApiResponse,
  MultiEntityUpdateModes,
  MutationResult,
  SelectedEntity,
} from '../types'
import { mutationData, returnFieldParams } from './mutations'
import { restEntityName } from './names'
import { prepareQuery } from './query'
import { flattenRecord, validateEntityId } from './records'

/** Python-style entity semantics over the REST transport. */
export class EntityService {
  private readonly rest: RestClient
  constructor(rest: RestClient) {
    this.rest = rest
  }

  async find<E extends EntityType, const F extends readonly EntityField<E>[] = readonly ['id']>(
    entity: E,
    filters: Filters<E>,
    fields?: F,
    options: FindOptions<E> = {},
  ): Promise<SelectedEntity<E, F>[]> {
    const records: SelectedEntity<E, F>[] = []
    for await (const record of this.iterate(entity, filters, fields, options)) records.push(record)
    return records
  }

  async findOne<E extends EntityType, const F extends readonly EntityField<E>[] = readonly ['id']>(
    entity: E,
    filters: Filters<E>,
    fields?: F,
    options: FindOneOptions<E> = {},
  ): Promise<SelectedEntity<E, F> | null> {
    const records = await this.find(entity, filters, fields, { ...options, page: 0, limit: 1 })
    return records[0] ?? null
  }

  async *iterate<E extends EntityType, const F extends readonly EntityField<E>[] = readonly ['id']>(
    entity: E,
    filters: Filters<E>,
    fields?: F,
    options: FindOptions<E> = {},
  ): AsyncGenerator<SelectedEntity<E, F>> {
    const query = prepareQuery(filters, fields ?? ['id'], options)
    const pathEntity = restEntityName(entity)
    // Compute logical offsets independently of REST's page size, including limits >500.
    let page = Math.floor(query.offset / query.pageSize) + 1
    let skip = query.offset % query.pageSize
    let yielded = 0
    const seen = new Set<string>()
    while (true) {
      options.signal?.throwIfAborted()
      const response = await this.rest.search<JsonApiResponse<JsonApiRecord[]>>(
        pathEntity,
        { filters: query.filters },
        {
          signal: options.signal,
          params: { ...query.params, 'page[size]': query.pageSize, 'page[number]': page },
        },
      )
      if (!Array.isArray(response.data)) throw new TypeError('Expected a list of entity records.')
      for (const record of response.data) {
        if (skip > 0) {
          skip--
          continue
        }
        yield flattenRecord(record) as SelectedEntity<E, F>
        yielded++
        if (query.limit > 0 && yielded >= query.limit) return
      }
      const next = response.links?.next
      if (!next || response.data.length === 0) return
      // Never follow server-provided hosts; use only the next page number, with fixed query parameters.
      const nextUrl = new URL(next, 'https://pagination.invalid')
      const nextPage = Number(nextUrl.searchParams.get('page[number]') ?? page + 1)
      if (!Number.isSafeInteger(nextPage) || nextPage <= page || seen.has(next)) {
        throw new TypeError('ShotGrid returned a non-advancing pagination link.')
      }
      seen.add(next)
      page = nextPage
    }
  }

  async create<
    E extends EntityType,
    const D extends EntityInput<E>,
    const F extends readonly EntityField<E>[] = readonly [],
  >(entity: E, data: ExactInput<E, D>, returnFields?: F): Promise<MutationResult<E, D, F>> {
    const response = await this.rest.create(
      restEntityName(entity),
      mutationData(data),
      returnFieldParams(data, returnFields),
    )
    return flattenRecord(response.data) as MutationResult<E, D, F>
  }

  async update<E extends EntityType, const D extends EntityInput<E>>(
    entity: E,
    id: number,
    data: ExactInput<E, D>,
    modes?: MultiEntityUpdateModes<E>,
  ): Promise<MutationResult<E, D>> {
    validateEntityId(id)
    const response = await this.rest.update(
      restEntityName(entity),
      id,
      mutationData(data, modes),
      returnFieldParams(data),
    )
    return flattenRecord(response.data) as MutationResult<E, D>
  }

  async delete(entity: EntityType, id: number): Promise<boolean> {
    validateEntityId(id)
    // REST returns 204 rather than Python's boolean. Check retired state explicitly;
    // never translate all 404s into false because missing entities must still fail.
    const retired = await this.findOne(entity, [['id', 'is', id]], ['id'], { retired_only: true })
    if (retired) return false
    await this.rest.remove(restEntityName(entity), id)
    return true
  }

  async revive(entity: EntityType, id: number): Promise<boolean> {
    validateEntityId(id)
    const response = await this.rest.post<
      JsonApiResponse<JsonApiRecord> & { meta?: { did_revive?: boolean } }
    >(entityPath(restEntityName(entity), id), undefined, { revive: true })
    if (typeof response.meta?.did_revive !== 'boolean')
      throw new TypeError('Revive response is missing meta.did_revive.')
    return response.meta.did_revive
  }
}
