import { createClientProvider, ShotGridClient } from 'shotgrid-js-sdk'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing server environment variable: ${name}`)
  return value
}

// Export one provider from one server module. Import this in routes/services.
// It is scoped to this script identity, not to arbitrary application users.
export const getShotGrid = createClientProvider(
  () =>
    new ShotGridClient({
      baseUrl: requiredEnv('SHOTGRID_BASE_URL'),
      auth: {
        type: 'script',
        scriptName: requiredEnv('SHOTGRID_SCRIPT_NAME'),
        scriptKey: requiredEnv('SHOTGRID_SCRIPT_KEY'),
      },
    }),
)
