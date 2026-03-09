import type { JsonApiRecord } from '@types'

export interface ProjectAttributes {
  name: string
}

export type ProjectRecord = JsonApiRecord<ProjectAttributes> & { type: 'Project' }
