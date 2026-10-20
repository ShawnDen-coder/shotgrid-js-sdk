import type { SelectedEntity } from 'shotgrid-js-sdk/types'

export type AssetDto = SelectedEntity<'Asset', readonly ['code', 'sg_status_list']>
