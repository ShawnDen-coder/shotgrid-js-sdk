// Compiled, never executed. These assertions guard the published TypeScript API.
import { type EntityLink, ShotGridClient } from '../src'

declare module '../src' {
  interface AssetFields {
    sg_studio_label: string | null
  }
  interface EntitySchema {
    StudioEntity: { code: string; asset: EntityLink<'Asset'> | null }
  }
}

export async function checkTypes(sg: ShotGridClient) {
  const assets = await sg.find('Asset', [['code', 'is', 'Hero']], ['code', 'project'])
  const code: string = assets[0].code
  const type: 'Asset' = assets[0].type
  const id: number | undefined = assets[0].project?.id
  void [code, type, id]
  // @ts-expect-error unselected fields must not be available
  assets[0].sg_status_list
  const ids = await sg.find('Asset', [])
  // @ts-expect-error default projection returns only id/type
  ids[0].code
  // @ts-expect-error typo in field name
  await sg.find('Asset', [], ['coed'])
  // @ts-expect-error fields from another entity
  await sg.find('Project', [], ['task_assignees'])
  // @ts-expect-error invalid filter field
  await sg.find('Asset', [['missing_field', 'is', 1]])
  // @ts-expect-error invalid filter operator
  await sg.find('Asset', [['code', 'equals', 'Hero']])
  // @ts-expect-error unregistered entity
  await sg.find('NotRegistered', [])
  const nullable = await sg.findOne('Asset', [], ['code'])
  // @ts-expect-error result may be null
  nullable.code
  const created = await sg.create('Asset', { code: 'Hero' }, ['sg_status_list'])
  const createdCode: string = created.code
  const status: string | null = created.sg_status_list
  void [createdCode, status]
  // @ts-expect-error field not written or requested
  created.project
  // @ts-expect-error wrong value type
  await sg.create('Asset', { code: 12 })
  // @ts-expect-error unknown mutation field
  await sg.create('Asset', { code: 'Hero', bogus: true })
  // @ts-expect-error link target has the wrong entity type
  await sg.update('Asset', 1, { project: { type: 'Shot', id: 3 } })
  // @ts-expect-error metadata is read-only in typed mutation methods
  await sg.update('Asset', 1, { created_at: 'yesterday' })
  // @ts-expect-error only multi-entity relationship fields accept update modes
  await sg.update('Asset', 1, { code: 'Hero' }, { code: 'add' })
  const updated = await sg.entity('Asset').update(1, { code: 'Hero' })
  const updatedCode: string = updated.code
  void updatedCode
  const custom = await sg.find('Asset', [], ['sg_studio_label'])
  const label: string | null = custom[0].sg_studio_label
  void label
  const studio = await sg.findOne('StudioEntity', [], ['asset'])
  const linked: 'Asset' | undefined = studio?.asset?.type
  void linked
  await sg.find('Task', [['entity.Asset.code', 'is', 'Hero']], ['entity.Asset.code'])
  await sg.batch([
    { request_type: 'update', entity_type: 'Asset', entity_id: 1, data: { code: 'Hero' } },
  ])
  // @ts-expect-error wrong batch input field type
  await sg.batch([{ request_type: 'create', entity_type: 'Asset', data: { code: 1 } }])
}

new ShotGridClient({
  baseUrl: 'https://example.com',
  auth: { type: 'script', scriptName: 'script', scriptKey: 'key' },
})
// @ts-expect-error credentials and auth are mutually exclusive
new ShotGridClient({
  baseUrl: 'https://example.com',
  auth: { type: 'session', sessionToken: 'session' },
  credentials: { grantType: 'session_token', sessionToken: 'session' },
})

export async function checkFluentTypes(sg: ShotGridClient) {
  const assets = await sg.query('Asset').where('code', 'is', 'Hero').select('code', 'project').all()
  const code: string = assets[0].code
  void code
  // @ts-expect-error unselected field
  assets[0].sg_status_list
  // @ts-expect-error typo in selection
  sg.query('Asset').select('coed')
  // @ts-expect-error wrong operand type for a numeric ID
  sg.query('Asset').where('id', 'is', 'not-a-number')
  // @ts-expect-error wrong relationship target
  sg.query('Asset').where('project', 'is', { type: 'Shot', id: 1 })
  // @ts-expect-error temporal units are checked
  sg.query('Asset').where('created_at', 'in_last', 1, 'MINUTE')
  sg.query('Asset').where('created_at', 'in_last', 1, 'DAY')
  sg.query('Asset').where('id', 'in', [1, 2])
  sg.query('Asset').where('shots', 'is', { type: 'Shot', id: 1 })
  const first = await sg.entity('Asset').query().select('code').first()
  // @ts-expect-error first may be null
  first.code
}
