import axios from 'axios'
import { resolveAuth } from './auth/grants'
import { AuthService } from './auth/service'
import { TokenManager } from './auth/token-manager'
import { BatchService } from './entities/batch'
import type { EntityQuery } from './entities/builder'
import { EntityRepository } from './entities/repository'
import { EntityService } from './entities/service'
import { SummaryService } from './entities/summary'
import { RestClient } from './http/rest-client'
import { Transport } from './http/transport'
import { SchemaService } from './schema/service'
import type { EntityType, ShotGridClientOptions } from './types'

/** Public composition root; business logic belongs to the individual services. */
export class ShotGridClient {
  readonly rest: RestClient
  readonly auth: Pick<TokenManager, 'authenticate'>
  readonly schema: SchemaService
  readonly find: EntityService['find']
  readonly findOne: EntityService['findOne']
  readonly iterate: EntityService['iterate']
  readonly create: EntityService['create']
  readonly update: EntityService['update']
  readonly delete: EntityService['delete']
  readonly revive: EntityService['revive']
  readonly batch: BatchService['execute']
  readonly summarize: SummaryService['summarize']
  private readonly entities: EntityService

  constructor(options: ShotGridClientOptions) {
    const baseUrl = options.baseUrl.replace(/\/+$/, '')
    const apiVersion = options.apiVersion ?? 'v1.1'
    const http =
      options.httpClient ??
      axios.create({
        baseURL: `${baseUrl}/api/${apiVersion}`,
        timeout: options.timeoutMs ?? 15_000,
        headers: { Accept: 'application/json' },
      })
    const source = options.auth ? resolveAuth(options.auth) : options.credentials
    const tokens = new TokenManager(
      new AuthService({ ...options, httpClient: http }),
      source,
      options.leewayMs,
    )
    this.auth = { authenticate: () => tokens.authenticate() }
    this.rest = new RestClient(new Transport(http, tokens))
    this.entities = new EntityService(this.rest)
    this.schema = new SchemaService(this.rest)
    this.find = this.entities.find.bind(this.entities)
    this.findOne = this.entities.findOne.bind(this.entities)
    this.iterate = this.entities.iterate.bind(this.entities)
    this.create = this.entities.create.bind(this.entities)
    this.update = this.entities.update.bind(this.entities)
    this.delete = this.entities.delete.bind(this.entities)
    this.revive = this.entities.revive.bind(this.entities)
    const batches = new BatchService(this.rest)
    this.batch = batches.execute.bind(batches)
    const summaries = new SummaryService(this.rest)
    this.summarize = summaries.summarize.bind(summaries)
  }

  entity<E extends EntityType>(entity: E): EntityRepository<E> {
    return new EntityRepository(this.entities, entity)
  }

  query<E extends EntityType>(entity: E): EntityQuery<E> {
    return this.entity(entity).query()
  }

  connect(): Promise<void> {
    return this.auth.authenticate()
  }
  /** @deprecated Use connect() or auth.authenticate(). */
  authenticate(): Promise<void> {
    return this.connect()
  }
}
