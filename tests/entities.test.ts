import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, httpError, record } from './helpers'

test('find sends Python defaults and flattens attributes/relations with numeric IDs', async () => {
  const { sg, calls } = fixture(() => ({
    data: [
      {
        type: 'Asset',
        id: '42',
        attributes: { code: 'Hero', metadata: { data: 'keep' } },
        relationships: {
          project: { type: 'Project', id: '7', name: 'Demo' },
          shots: [{ type: 'Shot', id: '9' }],
        },
        links: { self: '/assets/42' },
      },
    ],
    links: { next: null },
  }))
  const assets = await sg.find('Asset', [])
  assert.deepEqual(assets, [
    {
      type: 'Asset',
      id: 42,
      code: 'Hero',
      metadata: { data: 'keep' },
      project: { type: 'Project', id: 7, name: 'Demo' },
      shots: [{ type: 'Shot', id: 9 }],
    },
  ])
  assert.equal(calls[0].url, '/entity/assets/_search')
  assert.equal(calls[0].params.fields, 'id')
  assert.equal(calls[0].params.sort, 'id')
  assert.equal(calls[0].params['options[include_archived_projects]'], true)
  assert.equal(calls[0].params['options[return_only]'], 'active')
})

test('nested Python filters and variadic operands are translated without changing caller input', async () => {
  const { sg, calls } = fixture(() => ({ data: [] }))
  const filters = [
    ['code', 'in', 'Hero', 'Prop'],
    {
      filter_operator: 'any',
      filters: [
        ['created_at', 'in_last', 1, 'DAY'],
        ['id', 'between', 1, 10],
      ],
    },
  ] as const
  await sg.find('Asset', filters, ['code'], {
    filter_operator: 'any',
    include_archived_projects: false,
    retired_only: true,
    order: [{ field_name: 'code', direction: 'desc' }],
  })
  assert.deepEqual(JSON.parse(calls[0].data), {
    filters: {
      logical_operator: 'or',
      conditions: [
        ['code', 'in', ['Hero', 'Prop']],
        {
          logical_operator: 'or',
          conditions: [
            ['created_at', 'in_last', [1, 'DAY']],
            ['id', 'between', [1, 10]],
          ],
        },
      ],
    },
  })
  assert.equal(filters[0][2], 'Hero')
  assert.equal(calls[0].params.sort, '-code')
  assert.equal(calls[0].params['options[return_only]'], 'retired')
  assert.equal(calls[0].params['options[include_archived_projects]'], false)
})

test('find follows pagination while retaining the original filters and fields', async () => {
  const { sg, calls } = fixture((config) => {
    const page = config.params['page[number]']
    return {
      data: [record(page)],
      links: { next: page === 1 ? '/api/v1.1/entity/assets?page%5Bnumber%5D=2' : null },
    }
  })
  assert.deepEqual(
    (await sg.find('Asset', [], ['code'])).map((item) => item.id),
    [1, 2],
  )
  assert.equal(calls.length, 2)
  assert.equal(calls[1].params.fields, 'code')
})

test('find limit stops without fetching the next page and findOne returns null', async () => {
  const { sg, calls } = fixture(() => ({
    data: [record(1), record(2)],
    links: { next: '?page[number]=2' },
  }))
  assert.equal((await sg.find('Asset', [], ['code'], { limit: 1 })).length, 1)
  assert.equal(calls.length, 1)
  const empty = fixture(() => ({ data: [] }))
  assert.equal(await empty.sg.findOne('Asset', []), null)
  assert.equal(empty.calls[0].params['page[size]'], 1)
})

test('logical page offsets work for limits larger than a REST page', async () => {
  const { sg, calls } = fixture((config) => {
    const page = config.params['page[number]'] as number
    const start = (page - 1) * 500
    return {
      data: Array.from({ length: 500 }, (_, i) => record(start + i + 1)),
      links: { next: `?page[number]=${page + 1}` },
    }
  })
  const result = await sg.find('Asset', [], ['id'], { page: 2, limit: 750 })
  assert.equal(result.length, 750)
  assert.equal(result[0].id, 751)
  assert.equal(result.at(-1)?.id, 1500)
  assert.deepEqual(
    calls.map((c) => c.params['page[number]']),
    [2, 3],
  )
})

test('iterator stops fetching when the consumer breaks', async () => {
  const { sg, calls } = fixture(() => ({ data: [record(1)], links: { next: '?page[number]=2' } }))
  for await (const asset of sg.entity('Asset').iterate([], ['code'])) {
    assert.equal(asset.id, 1)
    break
  }
  assert.equal(calls.length, 1)
})

test('invalid paging and repeating next links fail instead of looping', async () => {
  const { sg, calls } = fixture(() => ({ data: [record(1)], links: { next: '?page[number]=1' } }))
  await assert.rejects(sg.find('Asset', [], ['id'], { limit: -1 }), TypeError)
  await assert.rejects(sg.find('Asset', [], ['id'], { page: 1 }), TypeError)
  assert.equal(calls.length, 0)
  await assert.rejects(sg.find('Asset', []), /non-advancing/)
})

test('create/update return flat records and request written plus additional fields', async () => {
  const { sg, calls } = fixture(() => ({
    data: {
      ...record(12, { code: 'Hero', sg_status_list: 'ip' }),
      relationships: { project: null },
    },
  }))
  const asset = await sg.create('Asset', { code: 'Hero' }, ['sg_status_list'])
  assert.deepEqual(asset, {
    type: 'Asset',
    id: 12,
    code: 'Hero',
    sg_status_list: 'ip',
    project: null,
  })
  assert.equal(calls[0].params['options[fields]'], 'code,sg_status_list')
  await sg.update('Asset', 12, { shots: [{ type: 'Shot', id: 8 }] }, { shots: 'add' })
  assert.deepEqual(JSON.parse(calls[1].data), {
    shots: { multi_entity_update_mode: 'add', value: [{ type: 'Shot', id: 8 }] },
  })
  assert.equal(calls[1].params['options[fields]'], 'shots')
})

test('delete returns false for retired records and preserves missing-record errors', async () => {
  const retired = fixture(() => ({ data: [record(1)] }))
  assert.equal(await retired.sg.delete('Asset', 1), false)
  assert.equal(retired.calls.length, 1)
  const active = fixture((config) => (config.method === 'post' ? { data: [] } : undefined))
  assert.equal(await active.sg.delete('Asset', 1), true)
  assert.equal(active.calls[1].method, 'delete')
  const missing = fixture((config) => {
    if (config.method === 'delete') throw httpError(config, 404)
    return { data: [] }
  })
  await assert.rejects(missing.sg.delete('Asset', 99), { status: 404 })
})

test('revive respects the did_revive boolean', async () => {
  const { sg, calls } = fixture(() => ({ data: record(1), meta: { did_revive: false } }))
  assert.equal(await sg.revive('Asset', 1), false)
  assert.equal(calls[0].params.revive, true)
  assert.equal(calls[0].url, '/entity/assets/1')
})

test('an already aborted query makes no HTTP request', async () => {
  const { sg, calls } = fixture(() => ({ data: [] }))
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(sg.find('Asset', [], ['id'], { signal: controller.signal }), {
    name: 'AbortError',
  })
  assert.equal(calls.length, 0)
})
