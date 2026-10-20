import assert from 'node:assert/strict'
import test from 'node:test'
import axios, { AxiosError } from 'axios'
import { AuthService, ShotGridClientError } from '../src'

test('auth logging never forwards raw exception text or credentials', async () => {
  const secret = 'DO_NOT_LOG_THIS'
  const logs: unknown[] = []
  const auth = new AuthService({
    baseUrl: 'https://example.com',
    maxRetries: 0,
    logger: { error: (message, context) => logs.push([message, context]) },
    httpClient: axios.create({
      adapter: async (config) => {
        throw new AxiosError(secret, undefined, config)
      },
    }),
  })
  let captured: unknown
  try {
    await auth.authenticate({
      grantType: 'client_credentials',
      clientId: 'script',
      clientSecret: secret,
    })
  } catch (error) {
    captured = error
  }
  assert.equal(logs.length, 1)
  assert.ok(!JSON.stringify(logs).includes(secret))
  assert.ok(!JSON.stringify(captured).includes(secret))
  assert.ok(captured instanceof Error && captured.cause instanceof AxiosError)
})

test('HTTP error causes remain accessible for debugging but are non-enumerable', () => {
  const cause = { headers: { Authorization: 'Bearer secret' } }
  const error = new ShotGridClientError('Failed', { kind: 'http_error', cause })
  assert.equal(error.cause, cause)
  assert.ok(!JSON.stringify(error).includes('Bearer secret'))
  assert.ok(!Object.keys(error).includes('cause'))
})

test('a throwing logger does not mask the actual authentication failure', async () => {
  const auth = new AuthService({
    baseUrl: 'https://example.com',
    maxRetries: 0,
    logger: {
      error: () => {
        throw new Error('Logger offline')
      },
    },
    httpClient: axios.create({
      adapter: async (config) => {
        throw new AxiosError('Network offline', undefined, config)
      },
    }),
  })
  await assert.rejects(auth.authenticate({ grantType: 'session_token', sessionToken: 'session' }), {
    name: 'AuthServiceError',
  })
})
