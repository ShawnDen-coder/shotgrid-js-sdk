import assert from 'node:assert/strict'
import test from 'node:test'
import { createClientProvider } from '../src'
import { fixture, record } from './helpers'

test('client providers are lazy and reuse clients without a global identity cache', () => {
  let created = 0
  const { sg, calls } = fixture(() => ({ data: [] }))
  const provider = createClientProvider(() => {
    created++
    return sg
  })
  assert.equal(created, 0)
  assert.equal(provider(), provider())
  assert.equal(created, 1)
  provider().query('Asset').where('code', 'is', 'Hero').select('code')
  assert.equal(calls.length, 0)
  const separate = fixture(() => ({ data: [] })).sg
  assert.notEqual(createClientProvider(() => separate)(), provider())
})

test('fluent queries are lazy and branches keep independent fields, filters and ordering', async () => {
  const { sg, calls } = fixture(() => ({ data: [record(1, { code: 'Hero' })] }))
  const base = sg.query('Asset').where('project', 'is', { type: 'Project', id: 123 })
  const heroes = base.where('code', 'is', 'Hero').select('code').orderBy('code').limit(10)
  const others = base
    .where('code', 'is', 'Prop')
    .select('sg_status_list')
    .orderBy('id', 'desc')
    .limit(1)
  assert.equal(calls.length, 0)
  assert.equal((await heroes.all())[0].code, 'Hero')
  await others.first()
  assert.equal(calls[0].params.fields, 'code')
  assert.equal(calls[0].params.sort, 'code')
  assert.equal(calls[1].params.fields, 'sg_status_list')
  assert.equal(calls[1].params.sort, '-id')
  assert.deepEqual(JSON.parse(calls[0].data).filters.conditions.at(-1), ['code', 'is', 'Hero'])
  assert.deepEqual(JSON.parse(calls[1].data).filters.conditions.at(-1), ['code', 'is', 'Prop'])
})

test('fluent first respects the selected logical page and any filters', async () => {
  const { sg, calls } = fixture((config) => ({ data: [record(config.params['page[number]'])] }))
  const result = await sg
    .entity('Asset')
    .query()
    .whereAny(['code', 'is', 'Hero'], ['code', 'is', 'Prop'])
    .select('id')
    .limit(10)
    .page(2)
    .retiredOnly()
    .includeArchivedProjects(false)
    .first()
  assert.equal(result?.id, 2)
  assert.equal(calls[0].params['page[number]'], 2)
  assert.equal(calls[0].params['page[size]'], 10)
  assert.equal(calls[0].params['options[return_only]'], 'retired')
  assert.equal(calls[0].params['options[include_archived_projects]'], false)
  assert.equal(JSON.parse(calls[0].data).filters.conditions[0].logical_operator, 'or')
})

test('fluent first returns null and bad limits fail locally', async () => {
  const { sg } = fixture(() => ({ data: [] }))
  assert.equal(await sg.query('Asset').first(), null)
  assert.throws(() => sg.query('Asset').limit(-1), TypeError)
  assert.throws(() => sg.query('Asset').page(1.5), TypeError)
})
