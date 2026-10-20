import type { MultiEntityUpdateModes } from './query'
import type { EntityInput, EntityLink, EntityType } from './schema'

type Operation<E extends EntityType> =
  | { request_type: 'create'; entity_type: E; data: EntityInput<E> }
  | {
      request_type: 'update'
      entity_type: E
      entity_id: number
      data: EntityInput<E>
      multi_entity_update_modes?: MultiEntityUpdateModes<E>
    }
  | { request_type: 'delete'; entity_type: E; entity_id: number }

export type BatchRequest = { [E in EntityType]: Operation<E> }[EntityType]
export type BatchResult = (EntityLink & Record<string, unknown>) | boolean
