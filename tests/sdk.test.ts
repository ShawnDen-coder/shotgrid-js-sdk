import assert from 'node:assert/strict'
import test from 'node:test'
import axios, { type AxiosAdapter, AxiosError, AxiosHeaders } from 'axios'
import { AuthService, ShotGridClient } from '../src/index'

const credentials = {
  grantType: 'client_credentials' as const,
  clientId: 'script',
  clientSecret: 'secret',
}
const token = (access = 'access') => ({
  token_type: 'Bearer',
  access_token: access,
  refresh_token: 'refresh',
  expires_in: 3600,
})
function setup(handler: AxiosAdapter) {
  const httpClient = axios.create({
    baseURL: 'https://example.shotgrid.autodesk.com/api/v1.1',
    adapter: handler,
  })
  return new ShotGridClient({
    baseUrl: 'https://example.shotgrid.autodesk.com',
    credentials,
    httpClient,
    maxRetries: 0,
  })
}
function failure(config: Parameters<AxiosAdapter>[0], status: number) {
  return new AxiosError('failed', undefined, config, undefined, {
    data: { errors: [{ detail: 'Denied' }] },
    status,
    statusText: 'error',
    headers: new AxiosHeaders(),
    config,
  })
}

test('concurrent requests share authentication and preserve response envelopes', async () => {
  let auth = 0
  const client = setup(async (config) => {
    if (config.url?.endsWith('access_token')) {
      auth++
      await new Promise((resolve) => setTimeout(resolve, 10))
      return { data: token(), status: 200, statusText: 'OK', headers: {}, config }
    }
    assert.equal(config.headers.get('Authorization'), 'Bearer access')
    return { data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config }
  })
  const results = await Promise.all(Array.from({ length: 20 }, () => client.rest.list('Project')))
  assert.equal(auth, 1)
  assert.deepEqual(results[0], { data: [] })
})

test('concurrent 401 responses share one refresh and replay once', async () => {
  let auth = 0
  let refresh = 0
  const client = setup(async (config) => {
    if (config.url?.endsWith('access_token')) {
      auth++
      if (String(config.data).includes('grant_type=refresh_token')) refresh++
      await new Promise((resolve) => setTimeout(resolve, 10))
      return {
        data: token(auth === 1 ? 'old' : 'new'),
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }
    if (config.headers.get('Authorization') === 'Bearer old') throw failure(config, 401)
    return { data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config }
  })
  await Promise.all(Array.from({ length: 10 }, () => client.rest.list('Project')))
  assert.equal(refresh, 1)
  assert.equal(auth, 2)
})

test('persistent 401 is surfaced after one recovery', async () => {
  let requests = 0
  const client = setup(async (config) => {
    if (config.url?.endsWith('access_token'))
      return { data: token(String(requests)), status: 200, statusText: 'OK', headers: {}, config }
    requests++
    throw failure(config, 401)
  })
  await assert.rejects(client.rest.list('Project'), {
    status: 401,
    kind: 'http_error',
    message: 'Denied',
  })
  assert.equal(requests, 2)
})

test('search selects array and hash media types; absolute paths fail before auth', async () => {
  const media: unknown[] = []
  const client = setup(async (config) => {
    if (config.url?.endsWith('access_token'))
      return { data: token(), status: 200, statusText: 'OK', headers: {}, config }
    media.push(config.headers.get('Content-Type'))
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
  })
  await assert.rejects(client.rest.get('https://other.example/entity'))
  await assert.rejects(client.rest.get('/%2e%2e/entity'))
  await client.rest.search('Project', { filters: [['id', 'is', 1]] })
  await client.rest.search('Project', { filters: { logical_operator: 'and', conditions: [] } })
  assert.deepEqual(media, [
    'application/vnd+shotgun.api3_array+json',
    'application/vnd+shotgun.api3_hash+json',
  ])
})

test('single-use refresh grants are never retried on network failure', async () => {
  let calls = 0
  const auth = new AuthService({
    baseUrl: 'https://example.com',
    maxRetries: 3,
    httpClient: axios.create({
      adapter: async (config) => {
        calls++
        throw new AxiosError('network', 'ERR_NETWORK', config)
      },
    }),
  })
  await assert.rejects(auth.refresh('one-use'))
  assert.equal(calls, 1)
})

test('all grant payloads encode credentials and optional fields', async () => {
  const forms: URLSearchParams[] = []
  const auth = new AuthService({
    baseUrl: 'https://example.com',
    httpClient: axios.create({
      adapter: async (config) => {
        forms.push(new URLSearchParams(String(config.data)))
        assert.equal(config.headers.get('Content-Type'), 'application/x-www-form-urlencoded')
        return { data: token(), status: 200, statusText: 'OK', headers: {}, config }
      },
    }),
  })
  await auth.authenticate({
    ...credentials,
    clientSecret: 'a&b+c',
    scope: 'sudo_as_login:artist',
    sessionUuid: 'uuid',
  })
  await auth.authenticate({
    grantType: 'password',
    username: 'artist',
    password: 'p&ss',
    authToken: '123456',
  })
  await auth.authenticate({ grantType: 'session_token', sessionToken: 'session' })
  await auth.refresh('refresh')
  assert.equal(forms[0].get('client_secret'), 'a&b+c')
  assert.equal(forms[0].get('session_uuid'), 'uuid')
  assert.equal(forms[1].get('auth_token'), '123456')
  assert.equal(forms[1].get('password'), 'p&ss')
  assert.equal(forms[2].get('session_token'), 'session')
  assert.equal(forms[3].get('refresh_token'), 'refresh')
})

test('invalid refresh falls back to full authentication', async () => {
  let login = 0
  const client = setup(async (config) => {
    if (config.url?.endsWith('access_token')) {
      if (String(config.data).includes('grant_type=refresh_token')) throw failure(config, 401)
      login++
      return {
        data: token(login === 1 ? 'old' : 'new'),
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }
    if (config.headers.get('Authorization') === 'Bearer old') throw failure(config, 401)
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
  })
  await client.rest.list('Project')
  assert.equal(login, 2)
})

test('entity mutations use documented verbs and payloads without network retries', async () => {
  const seen: Array<[string | undefined, string | undefined, unknown]> = []
  const client = setup(async (config) => {
    if (config.url?.endsWith('access_token'))
      return { data: token(), status: 200, statusText: 'OK', headers: {}, config }
    seen.push([config.method, config.url, config.data ? JSON.parse(config.data) : undefined])
    if (config.url === '/entity/Project/5') throw failure(config, 503)
    return { data: { data: { id: 1 } }, status: 200, statusText: 'OK', headers: {}, config }
  })
  await client.rest.create('Project', { name: 'Demo' })
  await client.rest.update('Project', 1, { name: 'Updated' })
  await client.rest.remove('Project', 1)
  await assert.rejects(client.rest.update('Project', 5, {}), { status: 503 })
  assert.deepEqual(
    seen.map((row) => row.slice(0, 2)),
    [
      ['post', '/entity/Project'],
      ['put', '/entity/Project/1'],
      ['delete', '/entity/Project/1'],
      ['put', '/entity/Project/5'],
    ],
  )
  assert.deepEqual(seen[0][2], { name: 'Demo' })
})
