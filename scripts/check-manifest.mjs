#!/usr/bin/env node
/**
 * Dependency-free manifest and identity guard.
 *
 * Two failure modes this exists for, both already paid for once:
 *
 * 1. Half-finished rename. This plugin was renamed (dsh-mobile-ui-fix ->
 *    dsh-mobile-upgrade) and the rename had to be carried by hand through the
 *    host half, the client half and nine translated READMEs. Anything still
 *    spelling the retired name means the two halves disagree about which
 *    settings section and which route prefix they own.
 * 2. A declaration a marketplace depends on quietly going missing: `dsh.bundle`
 *    makes the package installable, `engines.dsh` is what compatibility is
 *    judged on, and an `exports` target outside `files` is a broken install
 *    that only shows up after publish.
 *
 * Every expectation is derived from package.json, so the next rename is one
 * edit there plus whatever this file then reports.
 *
 * No dependencies, no network, no lockfile — it runs in CI before any install.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []
const checked = []

/** Record a failure with the file it was found in. */
function fail(where, message) {
  problems.push(`${where}: ${message}`)
}

/** Record a passing expectation, so the output says what was actually verified. */
function ok(message) {
  checked.push(message)
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const name = pkg.name
if (typeof name !== 'string' || name === '') throw new Error('package.json has no name')

/** Every file in the tree except the VCS directory and installed packages. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.isFile()) out.push(relative(root, full).split(sep).join('/'))
  }
  return out
}

const files = walk(root)
const text = (path) => readFileSync(join(root, path), 'utf8')

// --- installability and the declarations a marketplace reads ---------------

const bundle = pkg.dsh?.bundle?.patch
if (typeof bundle !== 'string' || bundle === '') {
  fail('package.json', 'dsh.bundle.patch is missing — the package is not installable as a profile layer')
} else {
  ok(`dsh.bundle.patch = ${bundle}`)
}

if (typeof pkg.engines?.dsh !== 'string' || pkg.engines.dsh === '') {
  fail('package.json', 'engines.dsh is missing — marketplaces cannot judge host compatibility without it')
} else {
  ok(`engines.dsh = ${pkg.engines.dsh}`)
}

// --- every published entry point must exist and be inside `files` ----------

const published = Array.isArray(pkg.files) ? pkg.files : []
if (published.length === 0) fail('package.json', 'files is empty — npm would publish the whole checkout')

/** Whether `files` publishes this path (an entry, or something inside one). */
function isPublished(path) {
  return published.some((entry) => path === entry || path.startsWith(entry.endsWith('/') ? entry : `${entry}/`))
}

for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
  const path = typeof target === 'string' ? target.replace(/^\.\//, '') : null
  if (path === null) {
    fail('package.json', `exports["${subpath}"] is not a plain path`)
    continue
  }
  if (path === 'package.json') continue
  if (!files.includes(path)) fail('package.json', `exports["${subpath}"] -> ${path} does not exist`)
  else if (!isPublished(path)) fail('package.json', `exports["${subpath}"] -> ${path} is outside files`)
}
ok(`exports: ${Object.keys(pkg.exports ?? {}).length} entry point(s) exist and are published`)

if (typeof bundle === 'string' && !isPublished(bundle.replace(/^\.\//, ''))) {
  fail('package.json', `dsh.bundle.patch -> ${bundle} is outside files — the layer cannot load after install`)
}

// --- the bundle patch must insert this exact plugin id ---------------------

if (typeof bundle === 'string' && files.includes(bundle.replace(/^\.\//, ''))) {
  const patch = text(bundle.replace(/^\.\//, ''))
  for (const key of ['id', 'name']) {
    if (!new RegExp(`^[ \\t]*(?:-[ \\t]*)?${key}:[ \\t]*${name}[ \\t]*$`, 'm').test(patch)) {
      fail(bundle, `insert entry does not set ${key}: ${name}`)
    }
  }
  ok(`${bundle} inserts ${name}`)
}

// --- both halves must agree on the identity taken from the package name ----
//
// Each pattern is built from `name`, never spelled out: a pattern that hardcodes
// the current name keeps passing after a rename, which is the exact half-rename
// this file exists to catch (the host would serve one set of routes while the
// client polls another, and every route would 404).

const host = 'lib/index.js'
const client = 'client/client.js'
/** Regex-escape a literal so the package name can be embedded safely. */
const quoted = (value) => `"${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`

if (!files.includes(host) || !files.includes(client)) {
  fail('package.json', 'lib/index.js and client/client.js are both required')
} else {
  for (const [path, pattern, what] of [
    [host, /installSection\(ctx, name,/, 'settings section key'],
    [host, /const ROUTE_PREFIX = `\/plugins\/\$\{name\}`/, 'route prefix'],
    [client, new RegExp(`var PLUGIN_ID = ${quoted(name)}`), 'plugin id'],
    [client, /var ROUTE_PREFIX = "\/plugins\/" \+ PLUGIN_ID/, 'route prefix'],
    [client, /\(entry\.ns \|\| entry\.name \|\| entry\.id\) !== PLUGIN_ID/, 'settings section match'],
    [client, /return \{ name: PLUGIN_ID,/, 'module face'],
  ]) {
    if (!pattern.test(text(path))) fail(path, `${what} does not match the package name`)
  }
  ok(`host half derives its identity from package.json and the client half matches "${name}"`)
}

// --- the rename must not creep back ----------------------------------------

const retired = ['mobile-ui-fix']
// Two intentional survivors in the host half — the retired settings namespace
// and the retired route prefix, both compatibility reads — plus this file, which
// has to spell the retired name out in order to look for it.
const allowlist = new Map([[host, 2], ['scripts/check-manifest.mjs', Number.POSITIVE_INFINITY]])
for (const path of files) {
  const body = text(path)
  for (const old of retired) {
    const hits = body.split(old).length - 1
    const allowed = allowlist.get(path) ?? 0
    if (hits > allowed) {
      fail(path, `mentions the retired name "${old}" ${hits} time(s); only ${allowed} legacy reference(s) allowed`)
    }
  }
}
ok('retired name survives only as the documented legacy settings key')

// --- the documented install command must be identical in every README ------

const install = `dsh plugin --profile web add ${name}`
const readmes = files.filter((path) => /(^|\/)README\.md$/.test(path))
if (readmes.length === 0) fail('docs', 'no README found')
for (const path of readmes) {
  if (!text(path).includes(install)) fail(path, `does not document the install command "${install}"`)
}
ok(`${readmes.length} README(s) document "${install}"`)

// --- report ----------------------------------------------------------------

if (problems.length > 0) {
  console.error(`check-manifest: ${problems.length} problem(s)\n`)
  for (const problem of problems) console.error(`  ✗ ${problem}`)
  console.error('')
  process.exit(1)
}

console.log(`check-manifest: ok (${name}@${pkg.version})`)
for (const line of checked) console.log(`  ✓ ${line}`)
