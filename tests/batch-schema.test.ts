import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, record } from './helpers'

test('Python batch keys map to one atomic REST batch and ordered flat results', async () => {
  const { sg, calls } = fixture(() => ({ data: [record(1, { code: 'Hero' }), record(1), null] }))
  const result = await sg.batch([
    { request_type: 'create', entity_type: 'Asset', data: { code: 'Hero' } },
    {
      request_type: 'update',
      entity_type: 'Asset',
      entity_id: 1,
      data: { shots: [] },
      multi_entity_update_modes: { shots: 'remove' },
    },
    { request_type: 'delete', entity_type: 'Asset', entity_id: 1 },
  ])
  assert.deepEqual(result, [{ type: 'Asset', id: 1, code: 'Hero' }, { type: 'Asset', id: 1 }, true])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/entity/_batch')
  assert.deepEqual(JSON.parse(calls[0].data).requests, [
    {
      request_type: 'create',
      entity: 'Asset',
      data: { code: 'Hero' },
      options: { fields: ['code'] },
    },
    {
      request_type: 'update',
      entity: 'Asset',
      record_id: 1,
      data: { shots: { multi_entity_update_mode: 'remove', value: [] } },
    },
    { request_type: 'delete', entity: 'Asset', record_id: 1 },
  ])
})

test('empty batch avoids HTTP and malformed batch length fails', async () => {
  const { sg, calls } = fixture(() => ({ data: [] }))
  assert.deepEqual(await sg.batch([]), [])
  assert.equal(calls.length, 0)
  await assert.rejects(
    sg.batch([{ request_type: 'delete', entity_type: 'Asset', entity_id: 1 }]),
    /one result/,
  )
})

test('schema reads remove envelopes and wrap single fields by name', async () => {
  const field = {
    data_type: { value: 'text', editable: false },
    name: { value: 'Code', editable: true },
  }
  const { sg, calls } = fixture((config) => {
    if (config.url?.endsWith('/code')) return { data: field }
    if (config.url?.endsWith('/fields')) return { data: { code: field } }
    return { data: { Asset: { name: { value: 'Asset', editable: false } } } }
  })
  assert.ok((await sg.schema.entityRead()).Asset)
  assert.deepEqual(await sg.schema.fieldRead('Asset'), { code: field })
  assert.deepEqual(await sg.schema.fieldRead('Asset', 'code', 123), { code: field })
  assert.equal(calls[2].url, '/schema/asset/fields/code')
  assert.equal(calls[2].params.project_id, 123)
})

test('summaries normalize filters and preserve Python include-archived default', async () => {
  const result = { summaries: { id: 12 }, groups: [] }
  const { sg, calls } = fixture(() => ({ data: result }))
  assert.deepEqual(await sg.summarize('Asset', [], [{ field: 'id', type: 'count' }]), result)
  assert.equal(calls[0].url, '/entity/assets/_summarize')
  assert.deepEqual(JSON.parse(calls[0].data), {
    filters: { logical_operator: 'and', conditions: [] },
    summary_fields: [{ field: 'id', type: 'count' }],
    options: { include_archived_projects: true },
  })
  await assert.rejects(
    sg.summarize(
      'Asset',
      [],
      [
        { field: 'id', type: 'count' },
        { field: 'id', type: 'sum' },
      ],
    ),
    /one summary/,
  )
})
