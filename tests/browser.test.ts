import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import test from 'node:test'
import { build } from 'vite'

async function browserModules(entry: Record<string, string>) {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: { write: false, minify: false, target: 'es2022', lib: { entry, formats: ['es'] } },
  })
  return (Array.isArray(result) ? result : [result]).flatMap((bundle) => {
    if (!('output' in bundle)) throw new Error('Expected a completed browser build.')
    return bundle.output.flatMap((chunk) =>
      chunk.type === 'chunk' ? Object.keys(chunk.modules) : [],
    )
  })
}

test('browser RPC and framework recipes do not bundle the server SDK or server router', async () => {
  const modules = await browserModules({
    rpc: resolve('examples/fullstack/browser/client.ts'),
    http: resolve('examples/fullstack/browser/http.ts'),
    react: resolve('examples/fullstack/browser/react.ts'),
    vue: resolve('examples/fullstack/browser/vue.ts'),
  })
  const forbidden = modules.filter((id) =>
    /\/src\/(auth|client|http)\b|\/fullstack\/server\/|\/@orpc\/server\//.test(id),
  )
  assert.deepEqual(forbidden, [])
  assert.ok(!modules.some((id) => id.includes('axios')))
})

test('core SDK also bundles for browsers without Node logging or Node builtin shims', async () => {
  const modules = await browserModules({ sdk: resolve('src/index.ts') })
  assert.ok(!modules.some((id) => id.includes('browser-external') || id.startsWith('node:')))
})
