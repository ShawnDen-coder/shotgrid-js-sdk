import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'

const files = [
  'README.md',
  'CONTRIBUTING.md',
  ...readdirSync('docs')
    .filter((name) => name.endsWith('.md') && !name.endsWith('.zh-CN.md'))
    .map((name) => `docs/${name}`),
]

for (const file of files) {
  const translated = file.replace(/\.md$/, '.zh-CN.md')
  const english = readFileSync(file, 'utf8')
  const chinese = readFileSync(translated, 'utf8')
  // Compare structure rather than prose, so either language can be edited idiomatically.
  for (const pattern of [/^#+/gm, /^```[^\n]*/gm]) {
    assert.deepEqual(chinese.match(pattern), english.match(pattern), `${file}: section/code parity`)
  }
  assert.equal(chinese.match(/^\|/gm)?.length, english.match(/^\|/gm)?.length, `${file}: tables`)
  for (const [path, text] of [
    [file, english],
    [translated, chinese],
  ]) {
    for (const language of [file, translated]) {
      assert.ok(text.includes(`](${basename(language)})`), `${path}: language switch`)
    }
    for (const [, target] of text.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^[a-z]+:/i.test(target) || target.startsWith('#')) continue
      assert.ok(existsSync(resolve(dirname(path), target.split('#')[0])), `${path}: ${target}`)
    }
  }
}
console.log(`Checked ${files.length} English/Chinese documentation pairs and local links.`)
