/**
 * dsh-mobile-ui-fix — host half.
 *
 * Routes (all under /plugins/mobile-ui-fix):
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

// Host packages (schemastery, yaml) are not the plugin's own dependencies.
// Resolve them from wherever they live: the profile tree next to this package
// when installed normally, or the running dsh install when the plugin is
// symlinked from outside (process.argv[1] is dsh's own bin).
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
}).description('Mobile UI customization')

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
  const logger = ctx.logger('mobile-ui-fix')

  // settings namespace: makes the plugin appear in the plugins list with
  // native toggles; the client reads these through the settings mirror
  const defaults = {
    attachEnabled: true,
    restartEnabled: true,
    modalityEnabled: true,
    settleEnabled: true,
    drawerEnabled: true,
    settingsTabsEnabled: true,
    menusEnabled: true,
  }
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, 'mobile-ui-fix', NAMESPACE_SCHEMA, defaults, {
      validate: () => {},
      setSource: () => {},
      onChange: () => {},
    })
  })

  ctx.inject(['webServer'], (scoped) => {
    const webServer = scoped.get('webServer')
    webServer.register({
      kind: 'prefix',
      path: '/plugins/mobile-ui-fix',
      handler: async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://x')
        const pathname = url.pathname

        if (req.method === 'POST' && pathname === '/plugins/mobile-ui-fix/restart') {
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

        if (req.method === 'GET' && pathname === '/plugins/mobile-ui-fix/ping') {
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          res.end(JSON.stringify({ ok: true }))
          return
        }

        if (req.method === 'GET' && pathname === '/plugins/mobile-ui-fix/llm-config') {
          try {
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
            res.end(JSON.stringify({ ok: true, providers: readProviders() }))
          } catch (error) {
            res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ ok: false, error: String(error) }))
          }
          return
        }

        if (req.method === 'POST' && pathname === '/plugins/mobile-ui-fix/model-input') {
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

        if (req.method === 'POST' && pathname === '/plugins/mobile-ui-fix/upload') {
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
      },
    })
    logger.info('mobile-ui-fix routes ready under /plugins/mobile-ui-fix')
  })
}
