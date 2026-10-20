import { ShotGridClient } from 'shotgrid-js-sdk'

/** Run this on the server; never expose a script key through VITE_* variables. */
export async function findProject(baseUrl: string, scriptName: string, scriptKey: string) {
  const sg = new ShotGridClient({
    baseUrl,
    auth: { type: 'script', scriptName, scriptKey },
  })
  return sg.findOne('Project', [['id', 'is', 122]], ['name'])
}
