/** Minimal links used in Python-compatible relationship fields. */
export interface BaseEntity<T extends string = string> {
  type: T
  id: number
}
export interface EntityLink<T extends string = string> extends BaseEntity<T> {
  name?: string
}

export interface CommonFields {
  created_at: string | null
  updated_at: string | null
  created_by: EntityLink<'HumanUser' | 'ApiUser'> | null
  updated_by: EntityLink<'HumanUser' | 'ApiUser'> | null
}

export interface ProjectFields extends CommonFields {
  name: string
  code: string | null
  archived: boolean
  sg_status: string | null
}

export interface AssetFields extends CommonFields {
  code: string
  project: EntityLink<'Project'> | null
  sg_status_list: string | null
  sg_asset_type: string | null
  description: string | null
  shots: EntityLink<'Shot'>[]
}

export interface ShotFields extends CommonFields {
  code: string
  project: EntityLink<'Project'> | null
  sg_sequence: EntityLink<'Sequence'> | null
  sg_status_list: string | null
  description: string | null
  assets: EntityLink<'Asset'>[]
}

export interface TaskFields extends CommonFields {
  content: string
  project: EntityLink<'Project'> | null
  entity: EntityLink | null
  step: EntityLink<'Step'> | null
  sg_status_list: string | null
  task_assignees: EntityLink<'HumanUser' | 'Group'>[]
  due_date: string | null
  start_date: string | null
  duration: number | null
}

export interface VersionFields extends CommonFields {
  code: string
  project: EntityLink<'Project'> | null
  entity: EntityLink | null
  sg_task: EntityLink<'Task'> | null
  sg_status_list: string | null
  description: string | null
}

export interface SequenceFields extends CommonFields {
  code: string
  project: EntityLink<'Project'> | null
  shots: EntityLink<'Shot'>[]
  sg_status_list: string | null
}

export interface HumanUserFields extends CommonFields {
  name: string
  login: string
  email: string | null
  sg_status_list: string | null
}

/** Extend this registry with declaration merging for your site's entities. */
export interface EntitySchema {
  Project: ProjectFields
  Asset: AssetFields
  Shot: ShotFields
  Task: TaskFields
  Version: VersionFields
  Sequence: SequenceFields
  HumanUser: HumanUserFields
}

export type EntityType = keyof EntitySchema & string
export type EntityField<E extends EntityType> =
  | 'id'
  | 'type'
  | (E extends EntityType
      ? (keyof EntitySchema[E] & string) | `${keyof EntitySchema[E] & string}.${string}`
      : never)
export type Entity<E extends EntityType = EntityType> = BaseEntity<E> & EntitySchema[E]
export type SelectedEntity<
  E extends EntityType,
  F extends readonly EntityField<E>[],
> = BaseEntity<E> &
  Pick<EntitySchema[E], Extract<F[number], keyof EntitySchema[E]>> & {
    [P in F[number] as P extends `${string}.${string}` ? P : never]: unknown
  }

export type EntityInput<E extends EntityType> = Partial<Omit<EntitySchema[E], keyof CommonFields>>
export type ExactInput<E extends EntityType, D> = D &
  Record<Exclude<keyof D, keyof EntityInput<E>>, never>
export type MutationResult<
  E extends EntityType,
  D,
  F extends readonly EntityField<E>[] = readonly [],
> = BaseEntity<E> & Pick<EntitySchema[E], Extract<keyof D | F[number], keyof EntitySchema[E]>>
