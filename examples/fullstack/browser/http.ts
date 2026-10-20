import type { AssetDto } from '../shared'

/** Browser calls the application's endpoint; it never receives script credentials. */
export async function fetchAssets(projectId: number, signal?: AbortSignal): Promise<AssetDto[]> {
  const response = await fetch(`/api/assets?projectId=${encodeURIComponent(projectId)}`, {
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) throw new Error('Could not load assets.')
  return response.json()
}
