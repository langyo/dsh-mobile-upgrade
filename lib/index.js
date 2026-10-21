/**
 * dsh-mobile-upgrade — host half.
 *
 * Routes (all under /plugins/dsh-mobile-upgrade):
 *   POST /restart                  flushes { ok } then exits; systemd
 *       Restart=always brings the service back within seconds.
 *   GET  /ping                     liveness probe used by the restart row.
 *   GET  /llm-config               the user-customised llm-pi-ai providers
 *       from the host settings service.
 *   POST /model-input              edits one model's input modality array in
 *       the host settings service (the active profile's settings document).
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
// Await the host's ESM dependency graph during concurrent plugin loading.
// Requiring its CJS entry can race with cosmokit's in-flight ESM import.
import z from '@deepseek-ai/schemastery'

export const name = 'dsh-mobile-upgrade'

/** HTTP prefix every route of this plugin is served under. */
const ROUTE_PREFIX = `/plugins/${name}`

/**
 * Names this plugin answered to before it was renamed. Kept only for the two
 * compatibility paths below; nothing writes them.
 *
 * The settings namespace is read once so existing toggles are not reset (see
 * legacyToggleValues). The route prefix is still served because a browser tab that
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

// yaml is this plugin's own dependency, loaded lazily when needed.
// Resolve it from wherever the module actually lives:
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

/** The pre-0.2 plugin's settings file; dsh 0.2 renamed it to .imported. */
/** The host's DSH_HOME, with the empty and ~ spellings dsh expands. */
function dshHomePath() {
  const raw = process.env.DSH_HOME
  if (raw === undefined || raw === '') return path.join(os.homedir(), '.dsh')
  if (raw === '~') return os.homedir()
  if (raw.startsWith('~/') || raw.startsWith('~\\')) return path.join(os.homedir(), raw.slice(2))
  return raw
}
const SETTINGS_PATH = path.join(dshHomePath(), 'settings.yaml')

/** One-shot marker: an explicit unset must not be re-added by a later boot. */
const MIGRATION_MARKER = path.join(path.dirname(SETTINGS_PATH), '.dsh-mobile-upgrade-toggles-migrated')

let yamlLib = null
function loadYaml() {
  if (!yamlLib) yamlLib = hostRequire('yaml')
  return yamlLib
}

/** One switch per feature: `[description, default]`. */
const TOGGLES = {
  restartEnabled: ['Offer the restart row in the General settings tab', true],
  modalityEnabled: ['Input-modality switches in the provider editor', true],
  settleEnabled: ['Hide the fullscreen details panel on narrow screens', true],
  drawerEnabled: ['Drawer-style sidebar on narrow screens', true],
  settingsTabsEnabled: ['Top-tabs settings layout on narrow screens', true],
  menusEnabled: ['Full-width model menu on narrow screens', true],
  netEnabled: ['Track stuck or failed API requests and surface them in the bottom-left connection card', true],
  questionsEnabled: ['Scrollable question region on narrow screens', true],
  selfUpdateEnabled: ['Reload the page when the plugin is upgraded', true],
  agentsEnabled: ['Guard subagent catalog refreshes and let the header chips open on click', true],
  headerEnabled: ['Collector pill and full-width sheet for the session header on narrow screens', true],
  listThrottleEnabled: ['Throttle session list re-renders while background sessions stream', true],
  connectionCardEnabled: ['Connection status card with manual refresh and request warnings at the bottom-left corner', true],
}

/** Composition base for the form, and the shape used to filter legacy values. */
const BASE_TOGGLES = Object.fromEntries(Object.entries(TOGGLES).map(([key, [, fallback]]) => [key, fallback]))

/**
 * A Config field whose meta carries the volatile flag. dsh 0.2's settings form
 * renders only those fields, and the loader updates their refs in place
 * instead of re-applying the plugin. schemastery spells that `volatile()`;
 * the helper keeps older copies (where the method is absent) constructible.
 */
function toggleField(description, fallback) {
  const field = z.boolean().default(fallback).description(description)
  if (typeof field.volatile === 'function') return field.volatile()
  return typeof field.extra === 'function' ? field.extra('volatile', true) : field
}

// The native Settings → Plugins form on dsh >= 0.2. `Config` is what cordis
// and dsh read; the `schema` alias remains for older consumers.
export const Config = z.object(Object.fromEntries(Object.entries(TOGGLES).map(([key, [description, fallback]]) => [
  key,
  toggleField(description, fallback),
]))).description('Mobile UI customization')
export const schema = Config

/**
 * Toggle values left in a pre-0.2 plugin's settings.yaml (which dsh 0.2
 * imports once and renames to settings.yaml.imported). A partial current-name
 * section must not drop the pre-rename keys, so the two sections are merged
 * per key with the current name winning.
 * @returns the recognised toggle values, or an empty object.
 */
function legacyToggleValues() {
  for (const file of [`${SETTINGS_PATH}.imported`, SETTINGS_PATH]) {
    let document
    try {
      document = loadYaml().parseDocument(fs.readFileSync(file, 'utf8')).toJS()
    } catch {
      continue
    }
    const current = document?.[name]
    const legacy = document?.[LEGACY_SETTINGS_NS]
    const values = {}
    for (const [key, fallback] of Object.entries(BASE_TOGGLES)) {
      const picked = (current !== null && typeof current === 'object' ? current[key] : undefined)
        ?? (legacy !== null && typeof legacy === 'object' ? legacy[key] : undefined)
      if (typeof picked === typeof fallback) values[key] = picked
    }
    if (Object.keys(values).length > 0) return values
  }
  return {}
}

/** Read a Config field that is a volatile ref on dsh >= 0.2, a plain value before. */
function toggleValue(value) {
  return value !== null && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value
}

/** The dsh >= 0.2 settings service, or null when it is unavailable. */
function settingsService(ctx) {
  const settings = ctx.get('settings')
  return settings !== undefined && typeof settings.describe === 'function' && typeof settings.mutate === 'function' ? settings : null
}

/** The settings service, or a route-level error. */
function requireSettings(ctx) {
  const settings = settingsService(ctx)
  if (settings === null) throw new Error('settings service is not available')
  return settings
}

/** The described form for one profile entry id, or undefined when absent. */
function settingsRow(settings, ns) {
  const rows = settings.describe({ redactSecrets: true })
  return Array.isArray(rows) ? rows.find((row) => row.ns === ns) : undefined
}

/**
 * The user-customised provider profiles from the llm-pi-ai form, reduced to
 * the fields the modality editor needs. The full provider entries can carry
 * headers/credentials, and llm-pi-ai marks none of them as secret.
 */
function readProvidersFromSettings(settings) {
  const row = settingsRow(settings, 'llm-pi-ai')
  const providers = row?.user?.providers
  if (providers === null || typeof providers !== 'object' || Array.isArray(providers)) return {}
  const view = {}
  for (const [id, provider] of Object.entries(providers)) {
    if (provider === null || typeof provider !== 'object' || Array.isArray(provider)) continue
    const safe = {}
    if (Array.isArray(provider.models)) {
      safe.models = provider.models.map((model) => {
        if (model === null || typeof model !== 'object' || Array.isArray(model)) return model
        const entry = { id: model.id }
        if (Array.isArray(model.input)) entry.input = model.input.slice()
        return entry
      })
    }
    if (provider.modelOverrides !== null && typeof provider.modelOverrides === 'object' && !Array.isArray(provider.modelOverrides)) {
      safe.modelOverrides = {}
      for (const [modelId, override] of Object.entries(provider.modelOverrides)) {
        if (override === null || typeof override !== 'object' || Array.isArray(override)) continue
        const entry = {}
        if (Array.isArray(override.input)) entry.input = override.input.slice()
        safe.modelOverrides[modelId] = entry
      }
    }
    view[id] = safe
  }
  return view
}

/**
 * Edit one model's input array through the settings service, which writes the
 * profile patch and updates the llm-pi-ai config refs live.
 */
async function saveModelInputViaSettings(settings, provider, modelId, input) {
  const row = settingsRow(settings, 'llm-pi-ai')
  if (row === undefined) throw new Error('llm-pi-ai settings are not available')
  const userModels = row.user?.providers?.[provider]?.models
  if (!Array.isArray(userModels)) throw new Error(`provider ${provider} has no custom model catalog to patch`)
  const index = userModels.findIndex((model) => model && model.id === modelId)
  if (index === -1) throw new Error(`model not found: ${modelId}`)
  const documentPath = settings.documentPath
  if (typeof documentPath === 'string' && documentPath.length > 0) {
    await fsp.copyFile(documentPath, `${documentPath}.bak-mfx`)
    await fsp.chmod(`${documentPath}.bak-mfx`, 0o600).catch(() => {})
  }
  const modalityPath = ['providers', provider, 'models', index, 'input']
  await settings.mutate('llm-pi-ai', [input.length > 0
    ? { op: 'set', path: modalityPath, value: input }
    : { op: 'unset', path: modalityPath }], row.revision)
}

export function apply(ctx, config) {
  const logger = ctx.logger(name)

  // Settings: dsh >= 0.2 renders the plugin's Config schema as the native
  // Settings → Plugins form and the client reads it through the settings
  // mirror. The host imports a pre-0.2 settings.yaml after the loader settles;
  // run our migration at the same point (never during activation, when
  // dsh-settings still filters this fiber out) and only for keys the profile
  // form has not set explicitly.
  ctx.inject(['settings'], (settingsCtx) => {
    const settings = settingsCtx.settings
    if (typeof settings?.describe !== 'function' || typeof settings?.update !== 'function') return
    Promise.resolve(ctx.root.loader.await()).then(async () => {
      if (fs.existsSync(MIGRATION_MARKER)) return
      const legacy = legacyToggleValues()
      if (Object.keys(legacy).length === 0) return
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const row = settings.describe({ redactSecrets: true }).find((candidate) => candidate.ns === name)
          if (row === undefined) return
          const user = row.user ?? {}
          const patch = {}
          for (const [key, value] of Object.entries(legacy)) {
            if (user[key] === undefined) patch[key] = value
          }
          if (Object.keys(patch).length === 0) {
            fs.writeFileSync(MIGRATION_MARKER, '1\n', { mode: 0o600 })
            return
          }
          await settings.update(row.ns, patch, row.revision)
          fs.writeFileSync(MIGRATION_MARKER, '1\n', { mode: 0o600 })
          return
        } catch (error) {
          if (attempt === 0 && error?.code === 'SETTINGS_CONFLICT') continue
          throw error
        }
      }
    }).catch((error) => logger.warn(`legacy settings migration failed: ${String(error)}`))
  })

  // ---- projection broadcast throttle --------------------------------------
  //
  // The session control stream broadcasts one whole-value frame for EVERY
  // projection change of EVERY attached session to EVERY connected client.
  // One projection (subagentTiming) re-objects on every committed event
  // while a subagent turn is active, so a fleet of running agents emits a
  // continuous 50-150 frames/s — measured on this deployment — and each
  // frame is a full JSON write over every open websocket plus a list-render
  // kick on every connected page. Whole-value frames plus the client's
  // higher-seq-wins apply rule make intermediate values droppable, so each
  // (session, key) identity's latest emission is held and flushed together
  // on one timer: every client still converges on the current value, at
  // human rather than event rate. Duration tickers (subagentTiming) and the
  // per-turn rail outline (turnOutline — its whole-log payload is the
  // largest frame a long session produces) converge on a 1s cadence; every
  // other key on 250ms.
  //
  // The registry's listener Set is replaced with a facade: registrations
  // and disposals keep addressing the ORIGINAL functions (an `onChanged`
  // disposer removes exactly what it added), while iteration yields
  // throttle wrappers resolved per original — nothing upstream observes
  // the facade, and a plugin reload re-installs nothing (guard flag).
  ctx.inject(['sessionProjections'], (scoped) => {
    try {
      const reg = scoped.sessionProjections ?? scoped.get?.('sessionProjections')
      if (!reg || !reg.listeners || typeof reg.listeners.add !== 'function') {
        logger.warn('projection broadcast throttle: registry not reachable')
        return
      }
      if (reg.__mfxBroadcastThrottle) return
      reg.__mfxBroadcastThrottle = true

      const TICK_MS = 250
      const KEY_MS = { subagentTiming: 1000, turnOutline: 1000 }
      const real = reg.listeners
      const wrappers = new Map()
      // One pending slot per (wrapper, session, key): each registered
      // listener has its own wrapper, so two consumers never starve each
      // other through a shared (session, key) slot.
      let wrapperSeq = 0
      const pending = new Map() // "<wid>\u0000<sid>\u0000<key>" -> { listener, args, due }
      let timer = null

      const flush = () => {
        timer = null
        const now = Date.now()
        let again = false
        for (const [id, entry] of pending) {
          if (now < entry.due) { again = true; continue }
          pending.delete(id)
          // swallowed deliberately below: one listener's failure must not
          // stall the shared flush — but it stays visible in the log.
          try { entry.listener(...entry.args) } catch (error) { logger.warn(`throttled projection listener failed: ${String(error)}`) }
        }
        if (again && pending.size > 0) {
          timer = setTimeout(flush, TICK_MS)
          timer.unref?.()
        }
      }

      const throttled = (listener) => {
        const wid = ++wrapperSeq
        return (session, key, value, seq) => {
          const id = `${wid}\u0000${session.id}\u0000${key}`
          const held = pending.get(id)
          if (held !== undefined) {
            held.args = [session, key, value, seq]
            return
          }
          pending.set(id, {
            listener,
            args: [session, key, value, seq],
            due: Date.now() + (KEY_MS[key] ?? TICK_MS),
          })
          if (timer === null) {
            timer = setTimeout(flush, TICK_MS)
            timer.unref?.()
          }
        }
      }

      const facade = {
        add: (fn) => real.add(fn),
        has: (fn) => real.has(fn),
        delete: (fn) => { wrappers.delete(fn); return real.delete(fn) },
        clear: () => { wrappers.clear(); real.clear() },
        get size() { return real.size },
        [Symbol.iterator]: function* () {
          for (const fn of real) {
            let wrapped = wrappers.get(fn)
            if (wrapped === undefined) {
              wrapped = throttled(fn)
              wrappers.set(fn, wrapped)
            }
            yield wrapped
          }
        },
      }
      reg.listeners = facade
      logger.info('projection broadcast throttle installed')
    } catch (error) {
      logger.warn(`projection broadcast throttle failed: ${String(error)}`)
    }
  })

  ctx.inject(['webServer'], (scoped) => {
    const webServer = scoped.get('webServer')
    const handler = async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://x')
        const route = subRoute(url.pathname)

        if (req.method === 'POST' && route === '/restart') {
          if (toggleValue(config.restartEnabled) === false) {
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
            const providers = readProvidersFromSettings(requireSettings(ctx))
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
            res.end(JSON.stringify({ ok: true, providers }))
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
              // Only user-customised routes may be patched. Creating a section
              // for a catalog provider (modelOverrides included) reads back as
              // an unserviceable route and collapses the whole directory.
              await saveModelInputViaSettings(requireSettings(ctx), provider, modelId, input)
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

        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'not found' }))
    }

    // Both prefixes, one handler: see LEGACY_ROUTE_PREFIX. Keep the
    // registrations' disposers: a host-module reload disposes this fiber and
    // re-applies the plugin, and the web server rejects a duplicate prefix
    // route, so the routes must leave the table with the fiber.
    const disposers = []
    try {
      for (const prefix of [ROUTE_PREFIX, LEGACY_ROUTE_PREFIX]) {
        disposers.push(webServer.register({ kind: 'prefix', path: prefix, handler }))
      }
    } finally {
      scoped.effect(() => () => {
        for (const dispose of disposers) {
          try { dispose() } catch {}
        }
      })
    }
    logger.info(`routes ready under ${ROUTE_PREFIX}`)
  })
}
