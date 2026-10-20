import { useQuery } from '@tanstack/react-query'
import type { AssetListInput, AssetQueries } from './client'

/** An application recipe, not a second SDK cache or a mandatory framework dependency. */
export function createAssetHooks(queries: AssetQueries) {
  return {
    useAssets(input: AssetListInput) {
      return useQuery(queries.assets.list.queryOptions({ input, staleTime: 30_000, retry: false }))
    },
  }
}
