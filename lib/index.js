/**
 * dsh-mobile-upgrade — host half.
 *
 * Routes (all under /plugins/dsh-mobile-upgrade):
 *   POST /upload?filename=<name>   raw body = file bytes; saved under the
 *       configured upload dir; responds { ok, path } so the client can paste
 *       the absolute path into the composer for the agent's file tools.
 *   POST /restart                  flushes { ok } then exits; systemd
 *       Restart=always brings the service back within seconds.
 *   GET  /ping                     liveness probe used by the restart row.
 *   GET  /llm-config               the llm-pi-ai providers from settings.yaml.
 *   POST /llm-config               replaces the llm-pi-ai providers (backup
 *       written next to the file first).
 *   POST /model-input              edits one model's input modality array.
 *
 * This plugin adds no auth of its own — it trusts the dsh web surface it is
 * loaded into. Put the deployment behind whatever gate the rest of the UI
 * uses (reverse-proxy basic auth, loopback binding, ...) before exposing it.
 */

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'

export const name = 'dsh-mobile-upgrade'

/** HTTP prefix every route of this plugin is served under. */
const ROUTE_PREFIX = `/plugins/${name}`

/**
 * Names this plugin answered to before it was renamed. Kept only for the two
 * compatibility paths below; nothing writes them.
 *
 * The settings namespace is read once so existing toggles are not reset (see
 * legacyToggles). The route prefix is still served because a browser tab that
 * loaded the client bundle from before the rename keeps calling it: 404ing
 * there would break that tab's restart row, which is also the only thing that
 * would ever reload it onto the new bundle. Both can go once no resident client
 * can predate the rename.
 */
const LEGACY_SETTINGS_NS = 'mobile-ui-fix'
const LEGACY_ROUTE_PREFIX = '/plugins/mobile-ui-fix'

/**
 * The route below whichever prefix this plugin is served under, or null when
 * the request is not ours at all.
 * @param pathname - request path.
 * @returns '' for the prefix itself, or the '/…' remainder.
 */
function subRoute(pathname) {
  for (const prefix of [ROUTE_PREFIX, LEGACY_ROUTE_PREFIX]) {
    if (pathname === prefix) return ''
    if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length)
  }
  return null
}

// schemastery is a host package (declared as a peer); yaml is this plugin's
// own dependency. Both are resolved from wherever the module actually lives:
// next to this package when installed normally, or in the running dsh install
// when the plugin is symlinked from outside (process.argv[1] is dsh's bin).
function hostRequire(id) {
  const parents = [import.meta.url, process.argv[1], process.execPath]
  for (const parent of parents) {
    if (!parent) continue
    try {
      return createRequire(parent)(id)
    } catch {}
  }
  throw new Error(`cannot resolve ${id} from the dsh install`)
}

const z = hostRequire('@deepseek-ai/schemastery')

const UPLOAD_DIR = path.join(
  process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh'),
  'mobile-uploads',
)

export const schema = z.object({
  uploadDir: z.string().default(UPLOAD_DIR).description('Directory where composer uploads are stored'),
  restartEnabled: z.boolean().default(true).description('Offer the restart row in the General settings tab'),
})

// settings namespace: makes the plugin visible in the plugins list with
// native toggles; the client reads these through the settings mirror
export const NAMESPACE_SCHEMA = z.object({
  attachEnabled: z.boolean().default(true).description('Composer attachment upload button'),
  restartEnabled: z.boolean().default(true).description('Restart row in the General settings tab'),
  modalityEnabled: z.boolean().default(true).description('Input-modality switches in the provider editor'),
  settleEnabled: z.boolean().default(true).description('Hide the fullscreen details panel on narrow screens'),
  drawerEnabled: z.boolean().default(true).description('Drawer-style sidebar on narrow screens'),
  settingsTabsEnabled: z.boolean().default(true).description('Top-tabs settings layout on narrow screens'),
  menusEnabled: z.boolean().default(true).description('Full-width model menu on narrow screens'),
  netEnabled: z.boolean().default(true).description('Network status chip for stuck API requests'),
  questionsEnabled: z.boolean().default(true).description('Scrollable question region on narrow screens'),
}).description('Mobile UI customization')

/** Composition base for the section, also the shape used to filter legacy values. */
const BASE_TOGGLES = {
  attachEnabled: true,
  restartEnabled: true,
  modalityEnabled: true,
  settleEnabled: true,
  drawerEnabled: true,
  settingsTabsEnabled: true,
  menusEnabled: true,
  netEnabled: true,
  questionsEnabled: true,
}

/**
 * The plugin shipped its settings section under its pre-rename name. Those
 * values are still in users' settings.yaml, so read them once and use them as
 * the composition base instead of the hard defaults — a rename must not
 * silently reset toggles. Nothing is written: the new section persists from
 * the first change made under it.
 * @returns the recognised legacy toggles, or an empty object.
 */
function legacyToggles() {
  let section
  try {
    const YAML = loadYaml()
    section = YAML.parseDocument(fs.readFileSync(SETTINGS_PATH, 'utf8')).toJS()?.[LEGACY_SETTINGS_NS]
  } catch {
    return {}
  }
  if (section === null || typeof section !== 'object' || Array.isArray(section)) return {}
  const recognised = {}
  for (const [key, fallback] of Object.entries(BASE_TOGGLES)) {
    if (typeof section[key] === typeof fallback) recognised[key] = section[key]
  }
  return recognised
}

const SETTINGS_PATH = path.join(
  process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh'),
  'settings.yaml',
)

let yamlLib = null
function loadYaml() {
  if (!yamlLib) yamlLib = hostRequire('yaml')
  return yamlLib
}

function readProviders() {
  const YAML = loadYaml()
  const doc = YAML.parseDocument(fs.readFileSync(SETTINGS_PATH, 'utf8'))
  return doc.toJS()?.['llm-pi-ai']?.providers ?? {}
}

function sanitizeFilename(name) {
  const base = path.basename(String(name ?? 'file')).replace(/[^\w.\-\u4e00-\u9fff]+/g, '_')
  return base === '' || base === '.' || base === '..' ? 'file' : base
}

function saveSettingsDocument(doc) {
  return fsp.writeFile(SETTINGS_PATH, String(doc))
}

export function apply(ctx, config) {
  const logger = ctx.logger(name)

  // settings namespace: makes the plugin appear in the plugins list with
  // native toggles; the client reads these through the settings mirror
  const defaults = { ...BASE_TOGGLES, ...legacyToggles() }
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, name, NAMESPACE_SCHEMA, defaults, {
      validate: () => {},
      setSource: () => {},
      onChange: () => {},
    })
  })

  ctx.inject(['webServer'], (scoped) => {
    const webServer = scoped.get('webServer')
    const handler = async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://x')
        const route = subRoute(url.pathname)

        if (req.method === 'POST' && route === '/restart') {
          if (config.restartEnabled === false) {
            res.writeHead(404, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ error: 'restart disabled by config' }))
            return
          }
          // The response is flushed first, then the process exits —
          // systemd Restart=always brings dsh back within seconds.
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ ok: true }))
          setTimeout(() => { process.exit(0) }, 300)
          return
        }

        if (req.method === 'GET' && route === '/ping') {
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          res.end(JSON.stringify({ ok: true }))
          return
        }

        if (req.method === 'GET' && route === '/llm-config') {
          try {
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
            res.end(JSON.stringify({ ok: true, providers: readProviders() }))
          } catch (error) {
            res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ ok: false, error: String(error) }))
          }
          return
        }

        if (req.method === 'POST' && route === '/model-input') {
          let body = ''
          req.on('data', (chunk) => {
            body += chunk
            if (body.length > 1e5) req.destroy()
          })
          req.on('end', async () => {
            try {
              const parsed = JSON.parse(body || '{}')
              const provider = String(parsed.provider ?? '')
              const modelId = String(parsed.modelId ?? '')
              const input = parsed.input
              if (!provider || !modelId) throw new Error('provider and modelId are required')
              if (!Array.isArray(input)) throw new Error('input must be an array')
              const YAML = loadYaml()
              const doc = YAML.parseDocument(await fsp.readFile(SETTINGS_PATH, 'utf8'))
              const sectionPath = ['llm-pi-ai', 'providers', provider]
              const userModels = doc.getIn([...sectionPath, 'models'])
              // Only user-customised routes may be patched. Creating a section
              // for a catalog provider (modelOverrides included) reads back as
              // an unserviceable route and collapses the whole directory.
              if (!Array.isArray(userModels)) throw new Error(`provider ${provider} has no custom model catalog to patch`)
              const index = userModels.findIndex((m) => m && m.id === modelId)
              if (index === -1) throw new Error(`model not found: ${modelId}`)
              const modalityPath = [...sectionPath, 'models', index, 'input']
              if (input.length) doc.setIn(modalityPath, input)
              else doc.deleteIn(modalityPath)
              await fsp.copyFile(SETTINGS_PATH, SETTINGS_PATH + '.bak-mfx')
              await saveSettingsDocument(doc)
              logger.info(`model input modalities updated: ${provider}/${modelId} -> [${input.join(',')}]`)
              res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
              res.end(JSON.stringify({ ok: true }))
            } catch (error) {
              logger.warn(`model-input save failed: ${String(error)}`)
              res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
              res.end(JSON.stringify({ ok: false, error: String(error) }))
            }
          })
          return
        }

        if (req.method === 'POST' && route === '/upload') {
          const uploadDir = config.uploadDir ?? UPLOAD_DIR
          const filename = sanitizeFilename(url.searchParams.get('filename'))
          await fsp.mkdir(uploadDir, { recursive: true })
          const stamp = new Date().toISOString().replace(/[:.]/g, '-')
          const dest = path.join(uploadDir, `${stamp}-${filename}`)
          try {
            await new Promise((resolve, reject) => {
              const out = fs.createWriteStream(dest)
              req.on('error', reject)
              out.on('error', reject)
              out.on('finish', resolve)
              req.pipe(out)
            })
            logger.info(`mobile upload saved: ${dest} (${req.headers['content-length'] ?? '?'} bytes)`)
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ ok: true, path: dest, filename }))
          } catch (error) {
            logger.warn(`mobile upload failed: ${String(error)}`)
            res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ ok: false, error: String(error) }))
          }
          return
        }

        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'not found' }))
    }

    // Both prefixes, one handler: see LEGACY_ROUTE_PREFIX.
    for (const prefix of [ROUTE_PREFIX, LEGACY_ROUTE_PREFIX]) {
      webServer.register({ kind: 'prefix', path: prefix, handler })
    }
    logger.info(`routes ready under ${ROUTE_PREFIX}`)
  })
}
