import type {
  EntityField,
  EntityInput,
  EntityType,
  ExactInput,
  Filters,
  FindOneOptions,
  FindOptions,
  MultiEntityUpdateModes,
} from '../types'
import { EntityQuery } from './builder'
import type { EntityService } from './service'

/** Optional bound-entity syntax; all semantics live in EntityService. */
export class EntityRepository<E extends EntityType> {
  private readonly service: EntityService
  private readonly type: E
  constructor(service: EntityService, type: E) {
    this.service = service
    this.type = type
  }

  query(): EntityQuery<E> {
    return new EntityQuery(this.service, this.type, ['id'])
  }

  find<const F extends readonly EntityField<E>[] = readonly ['id']>(
    filters: Filters<E>,
    fields?: F,
    options?: FindOptions<E>,
  ) {
    return this.service.find(this.type, filters, fields, options)
  }
  findOne<const F extends readonly EntityField<E>[] = readonly ['id']>(
    filters: Filters<E>,
    fields?: F,
    options?: FindOneOptions<E>,
  ) {
    return this.service.findOne(this.type, filters, fields, options)
  }
  iterate<const F extends readonly EntityField<E>[] = readonly ['id']>(
    filters: Filters<E>,
    fields?: F,
    options?: FindOptions<E>,
  ) {
    return this.service.iterate(this.type, filters, fields, options)
  }
  create<const D extends EntityInput<E>, const F extends readonly EntityField<E>[] = readonly []>(
    data: ExactInput<E, D>,
    returnFields?: F,
  ) {
    return this.service.create(this.type, data, returnFields)
  }
  update<const D extends EntityInput<E>>(
    id: number,
    data: ExactInput<E, D>,
    modes?: MultiEntityUpdateModes<E>,
  ) {
    return this.service.update(this.type, id, data, modes)
  }
  delete(id: number) {
    return this.service.delete(this.type, id)
  }
  revive(id: number) {
    return this.service.revive(this.type, id)
  }
}
