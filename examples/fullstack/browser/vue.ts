import { useQuery } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import type { AssetListInput, AssetQueries } from './client'

export function createAssetComposables(queries: AssetQueries) {
  return {
    useAssets(input: MaybeRefOrGetter<AssetListInput>) {
      return useQuery(
        computed(() =>
          queries.assets.list.queryOptions({
            input: toValue(input),
            staleTime: 30_000,
            retry: false,
          }),
        ),
      )
    },
  }
}
