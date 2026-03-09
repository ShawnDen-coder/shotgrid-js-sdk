import { ShotGridClient } from '@client'
import { logger } from '@logger'
import type { JsonApiResponse } from '@types'
import type { ProjectRecord } from './entities'

const { env } = import.meta

const client = new ShotGridClient({
  baseUrl: env.VITE_SHOTGRID_BASE_URL ?? '',
  apiVersion: (env.VITE_SHOTGRID_API_VERSION as 'v1' | 'v1.1') ?? 'v1.1',
  credentials: {
    grantType: 'client_credentials',
    clientId: env.VITE_SHOTGRID_CLIENT_ID ?? '',
    clientSecret: env.VITE_SHOTGRID_CLIENT_SECRET ?? '',
  },
})

const result = await client.search<JsonApiResponse<ProjectRecord[]>>('Project', {
  filters: {
    logical_operator: 'and',
    conditions: [['id', 'is', 122]],
  },
  fields: ['id', 'name'],
})

const project = result.data

logger.info('ShotGrid client ready', { project })
