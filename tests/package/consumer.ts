import type { EntityLink, ShotGridClient } from 'shotgrid-js-sdk'
import type { SelectedEntity } from 'shotgrid-js-sdk/types'

declare module 'shotgrid-js-sdk' {
  interface AssetFields {
    sg_consumer_label: string | null
  }
  interface EntitySchema {
    ConsumerEntity: { code: string; asset: EntityLink<'Asset'> | null }
  }
}

export async function consumer(sg: ShotGridClient) {
  const asset = await sg.findOne('Asset', [], ['code', 'sg_consumer_label'])
  if (asset) {
    const code: string = asset.code
    const label: string | null = asset.sg_consumer_label
    void [code, label]
    // @ts-expect-error not selected
    asset.project
  }
  const custom = await sg.find('ConsumerEntity', [], ['asset'])
  const type: 'Asset' | undefined = custom[0].asset?.type
  void type
  // @ts-expect-error published field checking must remain strict
  await sg.find('Asset', [], ['not_a_field'])
  // @ts-expect-error example-only extensions must not leak into the package
  await sg.find('Asset', [], ['sg_pipeline_tag'])
}

export async function fluentConsumer(sg: ShotGridClient) {
  const records = await sg.query('Asset').where('id', 'in', [1, 2]).select('code').all()
  const record: SelectedEntity<'Asset', readonly ['code']> = records[0]
  void record
  // @ts-expect-error published fluent operand inference must remain strict
  sg.query('Asset').where('id', 'is', 'bad-id')
  // @ts-expect-error select narrows the public result
  records[0].project
}
