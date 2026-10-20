import assert from 'node:assert/strict'
import test from 'node:test'
import axios from 'axios'
import { ShotGridClient } from '../src'
import { httpError, response, tokenResponse } from './helpers'

test('external token provider shares acquisition and recovers a rejected token once', async () => {
  let acquired = 0
  const httpClient = axios.create({
    baseURL: 'https://example.com/api/v1.1',
    adapter: async (config) => {
      assert.ok(!config.url?.endsWith('access_token'))
      if (config.headers.get('Authorization') === 'Bearer token-1') throw httpError(config, 401)
      return response(config, { data: [] })
    },
  })
  const sg = new ShotGridClient({
    baseUrl: 'https://example.com',
    httpClient,
    auth: {
      type: 'token',
      getAccessToken: async () => {
        acquired++
        await new Promise((resolve) => setTimeout(resolve, 10))
        return { accessToken: `token-${acquired}` }
      },
    },
  })
  await Promise.all(Array.from({ length: 10 }, () => sg.find('Asset', [])))
  assert.equal(acquired, 2)
})

test('refresh outage does not trigger a second full login; short-lived tokens are cached', async () => {
  let logins = 0
  let refreshed = 0
  const httpClient = axios.create({
    baseURL: 'https://example.com/api/v1.1',
    adapter: async (config) => {
      if (config.url?.endsWith('access_token')) {
        if (String(config.data).includes('grant_type=refresh_token')) {
          refreshed++
          throw httpError(config, 503)
        }
        logins++
        return response(config, tokenResponse('old', 10))
      }
      if (config.url === '/failed') throw httpError(config, 401)
      return response(config, { data: [] })
    },
  })
  const sg = new ShotGridClient({
    baseUrl: 'https://example.com',
    httpClient,
    credentials: { grantType: 'client_credentials', clientId: 'script', clientSecret: 'key' },
  })
  await sg.find('Asset', [])
  await sg.find('Asset', [])
  assert.equal(logins, 1)
  await assert.rejects(sg.rest.get('/failed'), { kind: 'auth_failed', status: 503 })
  assert.equal(refreshed, 1)
  assert.equal(logins, 1)
})

test('friendly script authentication preserves sudo scope and session UUID', async () => {
  let form: URLSearchParams | undefined
  const httpClient = axios.create({
    adapter: async (config) => {
      form = new URLSearchParams(String(config.data))
      return response(config, tokenResponse())
    },
  })
  const sg = new ShotGridClient({
    baseUrl: 'https://example.com',
    httpClient,
    auth: {
      type: 'script',
      scriptName: 'script',
      scriptKey: 'key',
      sudoAsLogin: 'artist',
      sessionUuid: 'uuid',
    },
  })
  await sg.connect()
  assert.equal(form?.get('client_id'), 'script')
  assert.equal(form?.get('scope'), 'sudo_as_login:artist')
  assert.equal(form?.get('session_uuid'), 'uuid')
})

test('invalid token payloads fail with an auth error', async () => {
  const httpClient = axios.create({
    adapter: async (config) =>
      response(config, {
        token_type: 42,
        access_token: 'access',
        expires_in: 1,
        refresh_token: 'refresh',
      }),
  })
  const sg = new ShotGridClient({
    baseUrl: 'https://example.com',
    httpClient,
    credentials: { grantType: 'session_token', sessionToken: 'session' },
  })
  await assert.rejects(sg.connect(), { kind: 'auth_failed' })
})

test('a failed refresh-only client never retries its possibly consumed grant on later calls', async () => {
  let calls = 0
  const httpClient = axios.create({
    adapter: async (config) => {
      calls++
      throw httpError(config, 503)
    },
  })
  const sg = new ShotGridClient({
    baseUrl: 'https://example.com',
    httpClient,
    auth: { type: 'refresh', refreshToken: 'one-use' },
  })
  await assert.rejects(sg.connect(), { kind: 'auth_failed' })
  await assert.rejects(sg.connect(), { kind: 'auth_failed' })
  assert.equal(calls, 1)
})
