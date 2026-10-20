import type { EntityLink, ShotGridClient } from 'shotgrid-js-sdk'

// A studio can add fields and entities without changing the SDK.
declare module 'shotgrid-js-sdk' {
  interface AssetFields {
    sg_pipeline_tag: string | null
  }
  interface EntitySchema {
    CustomEntity01: { code: string; project: EntityLink<'Project'> | null }
  }
}

export async function studioWorkflow(sg: ShotGridClient) {
  const project = { type: 'Project' as const, id: 123 }
  const assets = await sg.find(
    'Asset',
    [
      ['project', 'is', project],
      {
        filter_operator: 'any',
        filters: [
          ['sg_status_list', 'is', 'ip'],
          ['sg_status_list', 'is', 'wtg'],
        ],
      },
    ],
    ['code', 'sg_pipeline_tag'],
    {
      order: [{ field_name: 'code', direction: 'asc' }],
      limit: 100,
    },
  )

  const asset = await sg.findOne('Asset', [['code', 'is', 'Hero']], ['code', 'project'])
  if (asset) console.log(asset.code, asset.project?.id)

  const created = await sg.create('Asset', { code: 'Hero', project }, ['sg_status_list'])
  await sg.update('Asset', created.id, { sg_status_list: 'ip' })
  await sg.batch([
    {
      request_type: 'update',
      entity_type: 'Asset',
      entity_id: created.id,
      data: { sg_status_list: 'fin' },
    },
  ])

  for await (const item of sg.entity('Asset').iterate([], ['code'])) {
    console.log(item.code)
  }
  return assets
}
