import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)

for (const format of ['esm', 'cjs']) {
  test(`published ${format} entry supports Python-style usage`, async () => {
    const { ShotGridClient } =
      format === 'esm' ? await import('../dist/index.mjs') : require('../dist/index.cjs')
    const axios = (await import('axios')).default
    const httpClient = axios.create({
      baseURL: 'https://example.com/api/v1.1',
      adapter: async (config) => ({
        config,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { data: [{ type: 'Asset', id: 1, attributes: { code: 'Hero' } }] },
      }),
    })
    const sg = new ShotGridClient({
      baseUrl: 'https://example.com',
      httpClient,
      auth: { type: 'token', getAccessToken: () => ({ accessToken: 'test-token' }) },
    })
    assert.deepEqual(await sg.findOne('Asset', [], ['code']), {
      type: 'Asset',
      id: 1,
      code: 'Hero',
    })
  })
}
