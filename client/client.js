window.__ModuleLoader__.load({ id: "dsh-mobile-upgrade", factory: (require) => {
	var React = require("react");
	var inject = ["slots", "sessions", "remote", "remote.settings"];
	/* faces beyond this list are read through the optional ctx.get() lookup —
	   never declared in `inject` and never touched as bare properties: a
	   declared-but-missing service keeps the whole plugin from activating
	   (cordis fiber gate), and direct property access on an undeclared name
	   throws. The collector degrades per-face instead (no jobs service -> no
	   job rows; no uiWorkspace -> legacy open paths). */

	// Identity shared with the host half: the settings section key and the
	// route prefix both derive from the package name, so the two halves can
	// only ever name this plugin in one way.
	var PLUGIN_ID = "dsh-mobile-upgrade";
	var ROUTE_PREFIX = "/plugins/" + PLUGIN_ID;

	// The build this bundle is. Kept in step with package.json by
	// scripts/check-manifest.js, and surfaced in the settings row plus the
	// self-update banner below so a device can always say what it runs.
	var BUILD = "0.8.13";

	// Most of what this plugin renders lives inside native host slots; the
	// documented exceptions are the connection chip and card, the self-update
	// banner, and the shared toast — fixed-position
	// plain-DOM overlays that must stay alive while the host's own React
	// tree is frozen or wedged.
	//
	//   1. settings extras: the ⟳ restart row in the General tab.
	//   3. network watch: a wrapper around window.fetch tracks /api/ requests
//      that hang or fail; the warnings light the bottom-left connection
//      chip and list inside the connection card (with a ping probe to
//      tell a slow route from a deadlocked host). Nothing renders beside
//      the composer any more — the old chip sat in the middle of the
//      input row exactly where the eye writes.
//   7. narrow question card: the pending-question takeover's question is
//      capped into its own scroll region, so a long question can no longer
//      push the choices — and, on small viewports, the submit row and the
//      minimize/close buttons — outside the card's clipped height.
//   8. self-update: a phone tab can sit on a cached page for days, and the
//      bundle is served immutable per revision, so the page compares the
//      revision it booted with against the one the server advertises now and
//      reloads itself (idle, or through a banner it can tap).
//   9. storm throttle: many sessions streaming at once (or the replay
//      burst right after a reconnect) mutates the document per token, so
//      the question card's document-wide observer runs at a capped
//      leading+trailing rate and the settings poller backs off while the
//      host is unreachable — no per-mutation layout work and no frozen
//      input while the host's own narrow-screen layout does its thing.
// 10. agents guard: the host serves the subagent catalog by enumerating the
//      ENTIRE session corpus per request (~1s at a 2400-session history),
//      and its client fires one on every selection, hover-open, and
//      membership event while a catalog menu is open. The guard wraps the
//      refresh choke point: childless parents (per the live list) are never
//      asked, a parent is re-asked at most once per 2.5s, and refresh
//      starts are spaced 350ms apart.
// 11. desktop lineage click: the host's subagent chips open on hover only —
//      the count trigger carries no onClick, so a click does nothing. A
//      capture click shim translates a tap on a chip into the
//      mouseover/mouseout pair the host's own hover machinery already
//      understands, making click a proper toggle (ancestor crumbs keep
//      their navigate click).
// 12. narrow header collector: below 1024px the header's chips (lineage,
//      jobs, preset) are wider than the phone and hover-only. They fold
//      into one pill (title + agent/job badges); tapping it opens a
//      full-width sheet with the lineage, the live subagent tree (rows
//      from the session list; branches fetch their catalog on demand,
//      guarded), and this session's background jobs.
// 13. list render throttle: the host's control stream pushes a whole-value
//      projection frame for EVERY projection change of EVERY attached
//      session — a running subagent's timing view changes on each
//      committed event, so a busy background fleet emits 50-150 frames/s.
//      Each frame used to mark the session LIST notifier dirty, and one
//      list rebuild walks every summary (2400+) plus an O(n^2) entry-cache
//      sweep — measured as ~90% of main-thread time while background
//      sessions streamed, freezing the page hard. The throttle keeps
//      values flowing into the per-session stores unchanged (seq-ordered,
//      nothing lost) and only schedules the list rebuild on a trailing
//      interval that adapts to the measured rebuild cost, so the page
//      stays interactive no matter how hard the background streams.
// 14. connection card: the host's bottom-left connection control reacts to
//      a click with nothing observable — the retry it requests dives back
//      into the same wedged transport, the recovery pill is an
//      unclickable div on a 2s timer, and the narrow rail/drawer sidebar
//      never renders the control at all. A plain-DOM chip anchors the
//      status at the bottom-left corner (surviving a frozen host React
//      tree, the same reason the network watch is plain DOM) and pops a
//      semi-persistent card: the card stays while the pointer is inside
//      it, auto-dismisses otherwise, and carries the two actions that do
//      work — an immediate reconnect through the connection service, and
//      a full manual page refresh, the one recovery a wedged page always
//      honors. The stuck/failed request watch (6) reports through this
//      same chip and card — a badge on the chip, a request list plus a
//      liveness probe inside the card — so network warnings surface
//      bottom-left and nowhere near the composer.
//
// Optional features are toggled with localStorage keys (value "0" = off):
//   mfx-restart  (default on) — the ⟳ restart button
//   mfx-net      (default on) — stuck/failed request tracking, surfaced in the connection card
//   mfx-questions (default on) — the capped, scrollable question region
//   mfx-selfupdate (default on) — reload the page when the plugin is upgraded
//   mfx-agents   (default on) — the catalog-refresh guard + click-to-open chips
//   mfx-header   (default on) — the narrow-header collector pill + sheet
//   mfx-listthrottle (default on) — the session-list render throttle
//   mfx-conn     (default on) — the connection card with manual refresh
// Without a localStorage override, this plugin's own settings section decides
// the per-feature toggles (they take effect on next load).
var namespaceFlags = null;
var namespaceRevision;
var sectionListeners = [];
var loadNamespaceFlags = function () {};
var NAMESPACE_FLAG_KEYS = {
	restart: "restartEnabled",
	net: "netEnabled",
	questions: "questionsEnabled",
	selfupdate: "selfUpdateEnabled",
	agents: "agentsEnabled",
	header: "headerEnabled",
	listthrottle: "listThrottleEnabled",
	conn: "connectionCardEnabled"
};
function flag(name, dflt) {
	try {
		var v = window.localStorage.getItem("mfx-" + name);
		if (v !== null) return v !== "0";
	} catch (e) {}
	var key = NAMESPACE_FLAG_KEYS[name];
	if (key && namespaceFlags && namespaceFlags[key] !== undefined) {
		return namespaceFlags[key] !== false;
	}
	return dflt;
}
// UI locale for every user-facing string in this bundle: "hans", "hant"
// or "en". The old per-section checks keyed on indexOf("zh") === 0,
// which served the Simplified strings to Traditional Chinese users
// (zh-Hant-TW, zh-TW, zh-HK, zh-MO). Subtag rule: a "hant" script tag or
// a TW/HK/MO region means Traditional; any other zh-* is Simplified
// (bare "zh" defaults to Simplified, the language's default script).
// Deliberately uncached: navigator.language is read per call, which
// keeps multi-boot test harnesses honest at a string-compare's cost.
function mfxUiLocale() {
	var lang = "";
	try { lang = String(navigator.language || "").toLowerCase(); } catch (e) {}
	if (lang.indexOf("zh") !== 0) return "en";
	if (lang.indexOf("hant") !== -1 || /^zh-(?:hant-)?(?:tw|hk|mo)(?:-|$)/.test(lang)) return "hant";
	return "hans";
}
// Every section keeps its short local helper name (T/netT/connT/mfxT)
// but hands its arguments to this shared resolver, so the call sites
// read Simplified, Traditional, English left to right.
function mfxTr(hans, hant, en) {
	var l = mfxUiLocale();
	return l === "hant" ? hant : l === "hans" ? hans : en;
}
	async function apply(ctx, config) {
		// One line a user (or their agent) can grep the console for to answer
		// "is the plugin even running on this page?" — the report that opens
		// this section was a page where it was not, and nothing else on the
		// page said so.
		try { console.info("[dsh-mobile-upgrade] " + BUILD + " active"); } catch (e) {}
		// The settings mirror is polled so the namespace switches stay in
		// sync with per-device localStorage overrides. During a connection
		// disturbance this is exactly the traffic that must not pile up:
		// one describe in flight at most, and an escalating backoff while
		// the host rejects, instead of a fresh attempt every 4s into a
		// reconnecting transport.
		var nsBusy = false;
		var nsFails = 0;
		loadNamespaceFlags = function () {
			if (nsBusy) return;
			nsBusy = true;
			var describe;
			try {
				if (!ctx.remote || !ctx.remote.settings || !ctx.remote.settings.describe) {
					nsBusy = false;
					return;
				}
				describe = Promise.resolve(ctx.remote.settings.describe());
			} catch (e) {
				nsBusy = false;
				return;
			}
			return describe.then(function (res) {
				nsBusy = false;
				nsFails = 0;
				var view = res && res.value !== undefined ? res.value : res;
				var namespaces = view && view.namespaces ? view.namespaces : [];
				for (var i = 0; i < namespaces.length; i++) {
					var entry = namespaces[i];
					if ((entry.ns || entry.name || entry.id) !== PLUGIN_ID) continue;
					if (entry.revision !== undefined) namespaceRevision = entry.revision;
					var value = entry.value !== undefined ? entry.value : entry;
					if (value && typeof value === "object") {
						namespaceFlags = value;
						sectionListeners.splice(0).forEach(function (fn) {
							try { fn(); } catch (e) {}
						});
					}
					break;
				}
			}).catch(function () {
				nsBusy = false;
				nsFails++;
			});
		};
		var nsPoll = function () {
			loadNamespaceFlags();
			setTimeout(nsPoll, nsFails === 0 ? 4000 : Math.min(4000 * Math.pow(2, nsFails), 60000));
		};
		// Feature flags are read synchronously at mount; take the first mirror
		// (bounded) so a page loaded after a toggle change applies the stored
		// values. The poll below keeps later changes in sync.
		await Promise.race([
			loadNamespaceFlags() || Promise.resolve(),
			new Promise(function (resolve) { setTimeout(resolve, 2000); }),
		]);
		nsPoll();
		// Leading+trailing throttle for the document-wide observers below:
		// the first call in a quiet period runs at once so taps stay
		// snappy, and a burst — a streaming token flood, a reconnect resync —
		// collapses into a single trailing run instead of one full pass per
		// DOM mutation.
		function mfxThrottle(fn, ms) {
			var last = -Infinity;
			var timer = null;
			return function () {
				var now = Date.now();
				if (now - last >= ms) {
					last = now;
					fn();
					return;
				}
				if (timer) return;
				timer = setTimeout(function () {
					timer = null;
					last = Date.now();
					fn();
				}, ms - (now - last));
			};
		}
		// ---------- shared overlay home: plain-DOM overlays mount inside the app root ----------
		// The plugin's fixed-position plain-DOM overlays (the
		// toast, the self-update banner, the connection chip and card) used to
		// append to <body>. A skin breaks that arrangement without touching any
		// of this plugin's code: a video-background skin has to lift the app
		// container above its media layer (whale-fantasy ships
		// `body > #root { position: relative; z-index: 2 }` — its own docs call
		// this the skin's most load-bearing rule), and that turns #root into a
		// stacking context. A body-level overlay then sits outside that whole
		// context, so its z-index is compared against #root as a unit rather
		// than against the app's chrome: a body-level scrim once stacked above
		// the host's own opened sidebar and swallowed every tap in it (the
		// 2026-10-06 report; skin off, everything worked — the scrim is gone
		// with the retired drawer takeover, but the lesson generalizes to
		// every overlay this plugin still mounts).
		// Mounting each overlay in the same container the app lives in keeps
		// the designed order — chips and toast (90s) under the app's higher
		// layers, banner 200 above them — for any z-index a skin hands
		// #root. #root is the React mount container, not a React-managed
		// element: React appends its own children and leaves foreign trailing
		// nodes alone. position:fixed still spans the viewport because skins
		// only add z-index/position to #root, never transform/filter — the
		// containing-block trap the host's own fixed layers already document.
		// A navigation can still rebuild #root wholesale, so a
		// slow watchdog re-homes anything that rode the replaced tree.
		var overlayEls = [];
		function overlayHome() {
			return document.getElementById("root") || document.body;
		}
		function overlayMount(el) {
			overlayEls.push(el);
			overlayHome().appendChild(el);
		}
		setInterval(function () {
			var home = overlayHome();
			for (var i = 0; i < overlayEls.length; i++) {
				var el = overlayEls[i];
				if (el.parentElement !== home) home.appendChild(el);
			}
		}, 800);

		// ---------- shared toast (used by the network watch's probe below) ----------
		var toastEl = null;
		function toast(text) {
			if (!toastEl) {
				toastEl = document.createElement("div");
				toastEl.style.cssText = "position:fixed;left:50%;bottom:88px;transform:translateX(-50%);" +
					"z-index:90;font-size:12px;color:#eee;background:rgba(20,20,24,.88);" +
					"padding:5px 12px;border-radius:8px;max-width:76vw;white-space:nowrap;" +
					"overflow:hidden;text-overflow:ellipsis;pointer-events:none";
				overlayMount(toastEl);
			}
			toastEl.textContent = text;
			toastEl.style.display = "block";
			clearTimeout(toastEl._t);
			toastEl._t = setTimeout(function () { toastEl.style.display = "none"; }, 2200);
		}

		// ---------- 3. ⟳ restart — a settings.general.item row in the General tab ----------
		// The documented additive seat for General-section rows: the row draws
		// its own internals and writes through the plugin's restart route.
		if (flag("restart", true)) {
			function restartLabel() {
				try {
					var base = mfxTr("重启服务", "重新啟動服務", "Restart service");
					return base + " · v" + BUILD;
				} catch (e) { return "Restart service"; }
			}
			function restartConfirm() {
				try {
					return mfxTr(
						"重启 dsh 服务？页面将在服务恢复后自动刷新。",
						"重新啟動 dsh 服務？頁面將在服務恢復後自動重新整理。",
						"Restart the dsh service? The page reloads once it is back.");
				} catch (e) { return "Restart the dsh service?"; }
			}
			var RESTART_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path></svg>';
			function RestartIcon() {
				return React.createElement(
					"svg",
					{ width: "16", height: "16", viewBox: "0 0 24 24", fill: "none",
					  stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round",
					  strokeLinejoin: "round", "aria-hidden": "true" },
					React.createElement("path", { d: "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" }),
					React.createElement("path", { d: "M21 3v5h-5" })
				);
			}
			function RestartGeneralItem() {
				return React.createElement(
					"button",
					{
						type: "button",
						title: restartLabel(),
						"aria-label": restartLabel(),
						style: {
							display: "flex", alignItems: "center", gap: "8px", width: "100%",
							margin: "2px 0", padding: "9px 12px", borderRadius: "8px",
							border: "1px solid rgba(128,128,128,.35)", background: "transparent",
							color: "inherit", cursor: "pointer", fontSize: "13px"
						},
						onClick: function () {
							if (!window.confirm(restartConfirm())) return;
							fetch(ROUTE_PREFIX + "/restart", { method: "POST" }).catch(function () {});
							var started = Date.now();
							var timer = setInterval(function () {
								fetch(ROUTE_PREFIX + "/ping", { cache: "no-store" })
									.then(function (r) {
										if (r.ok && Date.now() - started > 3000) {
											clearInterval(timer);
											location.reload();
										}
									})
									.catch(function () {});
							}, 1500);
						}
					},
					React.createElement(RestartIcon),
					restartLabel()
				);
			}
			ctx.slots.inject("settings.general.item", function () {
				return ctx.slots.register({
					name: "settings.general.item",
					id: "mfx-restart",
					order: 90
				}, RestartGeneralItem);
			});
		}
		// ---------- 9. self-update: a phone tab must not run yesterday's bundle ----------
		// The client bundle is served immutable per revision, so a page loaded
		// before an upgrade keeps running the old code until the page itself is
		// reloaded — on a phone, where a tab can sit in the background for days,
		// that is how a fix appears "not to work" while nobody is running it.
		// The boot manifest already records the revision this page booted with,
		// so the page can compare it against the revision the server publishes
		// now (fetched with no-store, or the cached HTML would answer) and get
		// itself onto the new build: silently once the page has been idle and
		// is not holding a half-typed draft, otherwise through a banner that
		// reloads on a tap.
		if (flag("selfupdate", true)) {
			var bootRev = null;
			try {
				var bootEntries = (window.__DSH_BOOT__ && window.__DSH_BOOT__.entries) || [];
				for (var be = 0; be < bootEntries.length; be++) {
					if (bootEntries[be] && bootEntries[be].id === PLUGIN_ID) bootRev = bootEntries[be].rev || null;
				}
			} catch (e) {}
			if (bootRev) {
				var lastTouch = Date.now();
				var noteTouch = function () { lastTouch = Date.now(); };
				document.addEventListener("pointerdown", noteTouch, true);
				document.addEventListener("keydown", noteTouch, true);
				var banner = null;
				var bannerShown = false;
				var reloading = false;
				var offerReload = function () {
					if (bannerShown) return;
					bannerShown = true;
					banner = document.createElement("button");
					banner.type = "button";
					banner.id = "mfx-update-banner";
					banner.textContent = mfxTr("插件已更新到 v", "外掛已更新到 v", "Plugin updated to v") + BUILD
					+ mfxTr(" · 点此刷新", " · 點此重新整理", " · click to reload");
					banner.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:96px;" +
						"z-index:200;max-width:88vw;padding:10px 16px;border:none;border-radius:12px;" +
						"font-size:13px;line-height:18px;color:#fff;background:#3355dd;" +
						"box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:pointer";
					banner.addEventListener("click", function () { reloading = true; location.reload(); });
					overlayMount(banner);
				};
				var checkBuild = function () {
					if (reloading) return;
					var timer = setTimeout(function () { reloading = true; }, 8000);
					fetch("/", { cache: "no-store", credentials: "same-origin" }).then(function (r) {
						clearTimeout(timer);
						return r.ok ? r.text() : "";
					}).then(function (html) {
						if (!html || reloading) return;
						var m = new RegExp('"id"\\s*:\\s*"' + PLUGIN_ID + '"[^}]*?"rev"\\s*:\\s*"([^"]+)"').exec(html);
						if (!m || m[1] === bootRev) return;
						// a newer build is published: take it now if the page is
						// quiet, otherwise offer it — a reload must never eat a
						// draft someone is typing
						var idle = Date.now() - lastTouch > 45000;
						var el = document.activeElement;
						var typing = !!el && (/^(INPUT|TEXTAREA)$/.test(el.tagName)
							|| el.isContentEditable === true);
						if (idle && !typing && !document.hidden) {
							reloading = true;
							location.reload();
							return;
						}
						offerReload();
					}).catch(function () { clearTimeout(timer); });
				};
				setTimeout(checkBuild, 15000);
				setInterval(checkBuild, 120000);
				document.addEventListener("visibilitychange", function () {
					if (!document.hidden) setTimeout(checkBuild, 1500);
				});
			}
		}

		// Shared stuck/failed request state: section 7 fills it, the
		// connection card (7b) renders it. It lives in apply's scope so the
		// card can read it across the two independent feature gates — with
		// the watch off, the card simply never shows a network section.
		var netWatch = null;

		// ---------- 7. network watch: track stuck / failed /api/ requests ----------
		// The host talks to /api/... through window.fetch and some routes
		// (e.g. /api/session/list) hang or fail without UI feedback worth
		// reading. A thin wrapper around window.fetch tracks in-flight /api/
		// requests and remembers the ones that cross the stuck threshold or
		// fail outright. This feature no longer owns pixels next to the
		// composer: its old chip sat in the middle of the input row, lit up
		// precisely while the page was struggling, and a hover tooltip was
		// the only way to read what failed. The warnings now surface in the
		// bottom-left connection chip and card (7b), which already owns the
		// recovery actions; the probe below keeps its old job of separating
		// "the service is alive, this route is slow" from "the host is not
		// answering at all".
		if (flag("net", true)) {
			var NET_STUCK_MS = 10000;
			var NET_KEEP_MS = 20000;
			var netT = function (zh, hant, en) {
				return mfxTr(zh, hant, en);
			};
			var netInflight = [];
			var netRecent = [];

			function netTrack(url) {
				var path = String(url).split("?")[0];
				var cut = path.indexOf("/api/");
				if (cut === -1) return null;
				var entry = { path: path.slice(cut), start: Date.now() };
				netInflight.push(entry);
				return entry;
			}
			function netSettle(entry, ok) {
				var i = netInflight.indexOf(entry);
				if (i === -1) return;
				netInflight.splice(i, 1);
				var ms = Date.now() - entry.start;
				if (!ok || ms > NET_STUCK_MS) {
					netRecent.push({ path: entry.path, ms: ms, ok: ok, at: Date.now() });
					netRecent = netRecent.filter(function (r) { return Date.now() - r.at < NET_KEEP_MS; });
					// a storm can fail dozens of requests inside the keep
					// window — cap the list so the per-second snapshot and
					// row build stay bounded
					if (netRecent.length > 50) netRecent = netRecent.slice(-50);
				}
			}
			if (!window.__mfxFetchPatched) {
				window.__mfxFetchPatched = true;
				var mfxOrigFetch = window.fetch.bind(window);
				window.fetch = function (input, init) {
					var url = typeof input === "string" ? input : (input && input.url) || "";
					var entry = netTrack(url);
					if (!entry) return mfxOrigFetch(input, init);
					return mfxOrigFetch(input, init).then(
						function (res) { netSettle(entry, !!(res && res.ok)); return res; },
						function (err) { netSettle(entry, false); throw err; }
					);
				};
			}
			function netToast(text) {
				toast(text);
			}
			function netProbe() {
				var t0 = Date.now();
				var ctl = new AbortController();
				var timer = setTimeout(function () { ctl.abort(); }, 5000);
				netToast("⏳ " + netT("正在探测服务…", "正在探測服務…", "Probing the service…"));
				fetch(ROUTE_PREFIX + "/ping", { cache: "no-store", signal: ctl.signal })
					.then(function () {
						clearTimeout(timer);
						netToast("✓ " + netT("服务存活（ping " + (Date.now() - t0) + "ms）——卡住的是 API 路由本身", "服務存活（ping " + (Date.now() - t0) + "ms）——卡住的是 API 路由本身", "Service alive (ping " + (Date.now() - t0) + "ms) — the API route itself is stuck"));
					})
					.catch(function () {
						clearTimeout(timer);
						netToast("✗ " + netT("服务无响应（5s 超时）——宿主可能卡死，可在 设置 → 通用 里重启服务", "服務無回應（5s 逾時）——宿主可能卡死，可在 設定 → 一般 裡重新啟動服務", "No answer within 5s — the host may be deadlocked; restart it from Settings → General"));
					});
			}
			// No pixel of this feature lives in the composer any more — the
			// connection card below reads the watch through this snapshot:
			// stuck (in flight past the threshold), failed (settled !ok) and
			// slow (settled ok but past the threshold — context rows only,
			// they never light the chip). Pruning by time happens here, so a
			// failure ages out even when nothing else settles afterwards.
			netWatch = {
				t: netT,
				probe: netProbe,
				snapshot: function () {
					var now = Date.now();
					var cut = now - NET_KEEP_MS;
					if (netRecent.length > 0) {
						netRecent = netRecent.filter(function (r) { return r.at >= cut; });
					}
					var stuck = [];
					var i;
					for (i = 0; i < netInflight.length; i++) {
						var r = netInflight[i];
						if (now - r.start >= NET_STUCK_MS) {
							stuck.push({ path: r.path, s: Math.round((now - r.start) / 1000) });
						}
					}
					var failed = [];
					var slow = [];
					for (i = 0; i < netRecent.length; i++) {
						var e = netRecent[i];
						(e.ok ? slow : failed).push({ path: e.path, s: Math.round(e.ms / 1000) });
					}
					return {
						// t rides along because the conn card reads the snapshot
						// alone: netWatch.t is not reachable from there.
						t: netT,
						stuck: stuck,
						failed: failed,
						slow: slow,
						count: stuck.length + failed.length,
						hot: stuck.length > 0
					};
				}
			};
			window.__mfxNetDebug = function () {
				return {
					patched: !!window.__mfxFetchPatched,
					inflight: netInflight.map(function (r) { return { p: r.path, ms: Date.now() - r.start }; }),
					recent: netRecent.length,
					surfaced: "conn-card"
				};
			};
		}

		// ---------- 7b. connection card: hover-kept status popup with manual refresh ----------
		// The host's own control is CSS-module-classed and React-rendered,
		// both of which fail exactly when this matters: a wedged host stops
		// re-rendering, and a rebundled host rehashes the classes. So this
		// feature is plain DOM on a fixed anchor (the network watch's own
		// reasoning) driven directly by the connection service's state
		// signal, which lives in the page and keeps firing through a host
		// freeze. The chip is the persistent status; the card above it is
		// the semi-persistent tooltip the host never had — pinned while the
		// pointer is inside it, auto-dismissed otherwise — and its buttons
		// are the actions the user can trust: reconnect now (through the
		// same connection service the host's control uses) and a full
		// manual refresh, which recovers even a page whose transport state
		// is beyond repair.
		//
		// The card also absorbs the network watch (7): a badge on the chip
		// counts stuck/failed /api/ requests, the card lists them (with the
		// slow-recovered ones as dimmed context) and carries the liveness
		// probe. The card stays closed when only the badge lights — the
		// chip alone is the "something is off" signal, and popping a panel
		// per failed poller would be exactly the composer interruption
		// this merge removes.
		if (flag("conn", true)) {
			var connT = function (zh, hant, en) {
				return mfxTr(zh, hant, en);
			};
			var CONN_RECOVERED_MS = 4000;
			var CONN_CARD_AUTO_MS = 12000;
			var CONN_RECOVER_AUTO_MS = 4000;
			var CONN_LEAVE_GRACE_MS = 1500;
			var connStyle = document.createElement("style");
			connStyle.id = "mfx-conn-style";
			connStyle.textContent = [
				// The host indicator this feature replaces: its root element
				// carries both an _indicator_ fragment and _warning_/_success_
				// (CSS-module local names), so the pair match survives a class
				// rehash and simply stops matching (both controls show, a
				// benign degradation) if the host renames the locals.
				"[class*=\"_indicator_\"][class*=\"_warning_\"],",
				"[class*=\"_indicator_\"][class*=\"_success_\"] { display: none !important; }",
				"#mfx-conn-chip { position: fixed; left: 12px; bottom: 12px; z-index: 92; display: none;",
				"  align-items: center; gap: 7px; height: 30px; padding: 0 12px 0 10px; border-radius: 15px;",
				"  border: 1px solid rgba(128,128,128,.4); background: rgba(24,24,28,.94); color: #eee;",
				"  font-family: inherit; font-size: 12px; font-weight: 500; line-height: 18px; cursor: pointer;",
				"  box-shadow: 0 4px 14px rgba(0,0,0,.3); }",
				"#mfx-conn-chip[data-on=\"1\"] { display: inline-flex; }",
				"#mfx-conn-chip[data-state=\"disconnected\"] { border-color: rgba(214,88,80,.6); }",
				"#mfx-conn-chip[data-state=\"connecting\"] { border-color: rgba(214,138,48,.6); }",
				"#mfx-conn-chip[data-state=\"recovered\"] { border-color: rgba(84,178,106,.6); }",
				// net lighting wins over the state colours (same specificity,
				// later rules): a warning must stay visible once the transport
				// itself is back
				"#mfx-conn-chip[data-net=\"hot\"] { border-color: rgba(214,138,48,.7); }",
				"#mfx-conn-chip[data-net=\"err\"] { border-color: rgba(214,88,80,.7); }",
				"#mfx-conn-chip .mfx-conn-dot { width: 8px; height: 8px; border-radius: 50%; background: #54b26a; flex: none; }",
				"#mfx-conn-chip[data-state=\"disconnected\"] .mfx-conn-dot { background: #d65850; }",
				"#mfx-conn-chip[data-state=\"connecting\"] .mfx-conn-dot { background: #d68a30;",
				"  animation: mfx-conn-pulse 1.2s ease-in-out infinite; }",
				"#mfx-conn-chip[data-net=\"hot\"] .mfx-conn-dot { background: #d68a30; }",
				"#mfx-conn-chip[data-net=\"err\"] .mfx-conn-dot { background: #d65850; }",
				"#mfx-conn-chip .mfx-conn-badge { flex: none; display: none; padding: 1px 6px; border-radius: 8px;",
				"  font-size: 11px; font-weight: 600; line-height: 14px;",
				"  background: rgba(214,88,80,.16); border: 1px solid rgba(214,88,80,.5); }",
				"#mfx-conn-chip[data-net=\"hot\"] .mfx-conn-badge { background: rgba(214,138,48,.16); border-color: rgba(214,138,48,.5); }",
				"@keyframes mfx-conn-pulse { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }",
				"#mfx-conn-card { position: fixed; left: 12px; bottom: 48px; z-index: 93;",
				"  width: min(320px, calc(100vw - 24px)); box-sizing: border-box; padding: 14px; border-radius: 14px;",
				"  border: 1px solid rgba(128,128,128,.4); background: rgba(24,24,28,.96); color: #eee;",
				"  font-family: inherit; font-size: 13px; line-height: 20px; box-shadow: 0 8px 28px rgba(0,0,0,.4);",
				"  display: none; }",
				"#mfx-conn-card[data-open=\"1\"] { display: block; }",
				"#mfx-conn-card .mfx-conn-head { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; }",
				"#mfx-conn-card .mfx-conn-title { flex: 1; min-width: 0; font-weight: 600; font-size: 13px; }",
				"#mfx-conn-card .mfx-conn-x { flex: none; width: 24px; height: 24px; display: inline-flex;",
				"  align-items: center; justify-content: center; border: none; border-radius: 6px; background: transparent;",
				"  color: inherit; font-size: 14px; line-height: 1; cursor: pointer; }",
				"#mfx-conn-card .mfx-conn-x:hover { background: rgba(255,255,255,.1); }",
				"#mfx-conn-card .mfx-conn-body { margin: 0 0 12px; color: rgba(238,238,238,.72); }",
				"#mfx-conn-card .mfx-conn-actions { display: flex; gap: 8px; }",
				"#mfx-conn-card .mfx-conn-btn { flex: 1; height: 32px; border-radius: 8px;",
				"  border: 1px solid rgba(128,128,128,.4); background: transparent; color: #eee;",
				"  font-family: inherit; font-size: 12px; font-weight: 500; cursor: pointer; }",
				"#mfx-conn-card .mfx-conn-btn:hover { background: rgba(255,255,255,.08); }",
				"#mfx-conn-card .mfx-conn-btn.mfx-conn-primary { background: #4f7cd6; border-color: #4f7cd6; color: #fff; }",
				"#mfx-conn-card .mfx-conn-btn.mfx-conn-primary:hover { background: #5d89de; }",
				"#mfx-conn-card .mfx-conn-net { display: none; margin: 12px 0; padding-top: 10px;",
				"  border-top: 1px solid rgba(128,128,128,.25); }",
				"#mfx-conn-card .mfx-conn-net[data-on=\"1\"] { display: block; }",
				"#mfx-conn-card .mfx-conn-nethead { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; }",
				"#mfx-conn-card .mfx-conn-nettitle { flex: 1; min-width: 0; font-weight: 600; font-size: 12px; }",
				"#mfx-conn-card .mfx-conn-netprobe { flex: none; height: 22px; padding: 0 10px; border-radius: 6px;",
				"  border: 1px solid rgba(128,128,128,.4); background: transparent; color: #eee;",
				"  font-family: inherit; font-size: 11px; cursor: pointer; }",
				"#mfx-conn-card .mfx-conn-netprobe:hover { background: rgba(255,255,255,.08); }",
				"#mfx-conn-card .mfx-conn-netlist { max-height: 132px; overflow-y: auto;",
				"  overscroll-behavior: contain; font-size: 11px; line-height: 17px;",
				"  color: rgba(238,238,238,.72); }",
				"#mfx-conn-card .mfx-conn-netrow { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
				"@media (max-width: 1023px) {",
				"  #mfx-conn-chip { left: 10px; bottom: calc(env(safe-area-inset-bottom, 0px) + 84px); }",
				"  #mfx-conn-card { left: 10px; bottom: calc(env(safe-area-inset-bottom, 0px) + 118px); }",
				"}"
			].join("\n");
			document.head.appendChild(connStyle);

			var connChip = document.createElement("button");
			connChip.type = "button";
			connChip.id = "mfx-conn-chip";
			connChip.setAttribute("aria-label", connT("连接与网络状态", "連線與網路狀態", "Connection and network status"));
			connChip.setAttribute("aria-haspopup", "dialog");
			connChip.setAttribute("aria-expanded", "false");
			var connChipDot = document.createElement("span");
			connChipDot.className = "mfx-conn-dot";
			var connChipLabel = document.createElement("span");
			connChip.appendChild(connChipDot);
			connChip.appendChild(connChipLabel);
			var connChipBadge = document.createElement("span");
			connChipBadge.className = "mfx-conn-badge";
			connChip.appendChild(connChipBadge);

			var connCard = document.createElement("div");
			connCard.id = "mfx-conn-card";
			connCard.setAttribute("role", "status");
			var connHead = document.createElement("div");
			connHead.className = "mfx-conn-head";
			var connTitle = document.createElement("span");
			connTitle.className = "mfx-conn-title";
			var connX = document.createElement("button");
			connX.type = "button";
			connX.className = "mfx-conn-x";
			connX.setAttribute("aria-label", connT("关闭", "關閉", "Close"));
			connX.textContent = "✕";
			connHead.appendChild(connTitle);
			connHead.appendChild(connX);
			var connBody = document.createElement("div");
			connBody.className = "mfx-conn-body";
			// The network section: the stuck/failed request list the old
			// composer chip used to carry as a hover tooltip, plus the
			// liveness probe. Hidden entirely while the watch reports
			// nothing (or while the watch feature is off).
			var connNet = document.createElement("div");
			connNet.className = "mfx-conn-net";
			connNet.setAttribute("data-on", "0");
			var connNetHead = document.createElement("div");
			connNetHead.className = "mfx-conn-nethead";
			var connNetTitle = document.createElement("span");
			connNetTitle.className = "mfx-conn-nettitle";
			var connNetProbe = document.createElement("button");
			connNetProbe.type = "button";
			connNetProbe.className = "mfx-conn-netprobe";
			var connNetList = document.createElement("div");
			connNetList.className = "mfx-conn-netlist";
			connNetHead.appendChild(connNetTitle);
			connNetHead.appendChild(connNetProbe);
			connNet.appendChild(connNetHead);
			connNet.appendChild(connNetList);
			connNetProbe.addEventListener("click", function (e) {
				e.stopPropagation();
				try { if (netWatch && netWatch.probe) netWatch.probe(); } catch (err) {}
			});
			var connActions = document.createElement("div");
			connActions.className = "mfx-conn-actions";
			var connReconnectBtn = document.createElement("button");
			connReconnectBtn.type = "button";
			connReconnectBtn.className = "mfx-conn-btn";
			var connRefreshBtn = document.createElement("button");
			connRefreshBtn.type = "button";
			connRefreshBtn.className = "mfx-conn-btn mfx-conn-primary";
			connActions.appendChild(connReconnectBtn);
			connActions.appendChild(connRefreshBtn);
			connCard.appendChild(connHead);
			connCard.appendChild(connBody);
			connCard.appendChild(connNet);
			connCard.appendChild(connActions);
			overlayMount(connChip);
			overlayMount(connCard);

			var connSvc = null;
			var connState = "connected";
			var connRecoveredUntil = 0;
			var connCardOpen = false;
			var connCardOpenedAt = 0;
			var connPointerIn = false;
			var connPointerLeftAt = 0;
			var connHoverOpenedAt = 0;
			var connNetSig = "";

			function connEffState() {
				if (connState === "connected") return Date.now() < connRecoveredUntil ? "recovered" : "connected";
				return connState;
			}
			function connRender() {
				var eff = connEffState();
				// The watch is read live on every render (the 500ms tick):
				// stuck and failed requests light the chip without any wiring
				// from the fetch wrapper, and age out as they expire.
				var net = null;
				try { net = netWatch ? netWatch.snapshot() : null; } catch (e) { net = null; }
				var netCount = net ? net.count : 0;
				connChip.setAttribute("data-state", eff);
				connChip.setAttribute("data-on", (eff !== "connected" || netCount > 0) ? "1" : "0");
				connChip.setAttribute("data-net",
					net && net.hot ? "hot" : (netCount > 0 ? "err" : "0"));
				connChip.setAttribute("aria-expanded", connCardOpen ? "true" : "false");
				if (eff === "connected" && netCount > 0) {
					// Transport healthy, requests not: the label names the
					// count, the badge keeps the number next to whatever the
					// label shows.
					connChipLabel.textContent = net.hot
						? net.t(netCount + " 个请求卡住", netCount + " 個請求卡住", netCount + " request" + (netCount === 1 ? "" : "s") + " stuck")
						: net.t(netCount + " 个请求失败", netCount + " 個請求失敗", netCount + " request" + (netCount === 1 ? "" : "s") + " failed");
				} else {
					connChipLabel.textContent = eff === "disconnected"
						? connT("连接已断开", "連線已斷開", "Disconnected")
						: eff === "connecting" ? connT("自动重连中", "自動重連中", "Reconnecting")
						: connT("已重连", "已重連", "Reconnected");
				}
				if (netCount > 0) {
					// "inline", not "": the class rule hides the badge with
					// display:none, so resetting the inline value would fall
					// straight back to hidden — the badge must override it.
					connChipBadge.style.display = "inline";
					connChipBadge.textContent = "⚠ " + netCount;
					connChipBadge.title = net.t(netCount + " 个请求卡住或失败", netCount + " 個請求卡住或失敗", netCount + " stuck or failed request" + (netCount === 1 ? "" : "s"));
				} else {
					connChipBadge.style.display = "none";
					connChipBadge.textContent = "";
					connChipBadge.title = "";
				}
				connTitle.textContent = eff === "disconnected"
					? connT("连接已断开", "連線已斷開", "Disconnected")
					: eff === "connecting" ? connT("正在自动重连", "正在自動重連", "Reconnecting") + "…"
					: connT("已重新连接", "已重新連線", "Reconnected");
				connBody.textContent = eff === "disconnected"
					? connT("与服务器的连接已断开，网络恢复后会自动重试；长时间未恢复时，手动刷新可以完整重建页面。",
						"與伺服器的連線已斷開，網路恢復後會自動重試；長時間未恢復時，手動重新整理可以完整重建頁面。",
						"The connection to the server is down; retries resume automatically once the network returns. If it stays down, a manual refresh rebuilds the page fully.")
					: eff === "connecting"
					? connT("连接中断，正在自动重试。若反复重连无效，手动刷新是始终可靠的恢复方式。",
						"連線中斷，正在自動重試。若反覆重連無效，手動重新整理是始終可靠的恢復方式。",
						"The connection dropped and automatic retries are running. If reconnecting keeps changing nothing, a manual refresh always recovers.")
					: connT("连接已恢复，会话数据正在自动同步。", "連線已恢復，會話資料正在自動同步。", "The connection is back; session data is resyncing automatically.");
				connReconnectBtn.style.display = eff === "recovered" ? "none" : "";
				connReconnectBtn.textContent = "⟳ " + connT("立即重连", "立即重連", "Reconnect now");
				connRefreshBtn.textContent = "↻ " + connT("手动刷新", "手動重新整理", "Manual refresh");
				// The line set and its signature are built on every render
				// tick (bounded: at most the in-flight requests plus 50
				// recent entries), but the row DOM is rebuilt only when the
				// signature actually changed: a streaming page settles many
				// requests per second, and rebuilding identical rows would
				// churn layout for nothing. Rows are built with textContent —
				// the paths come from live fetch URLs.
				var lines = [];
				if (net) {
					var si;
					for (si = 0; si < net.stuck.length; si++) {
						lines.push({ m: "⏳", p: net.stuck[si].path, s: net.stuck[si].s + "s" });
					}
					var fi;
					for (fi = 0; fi < net.failed.length; fi++) {
						lines.push({ m: "✗", p: net.failed[fi].path, s: net.t("失败", "失敗", "failed") });
					}
					var li;
					for (li = 0; li < net.slow.length; li++) {
						lines.push({ m: "◔", p: net.slow[li].path, s: net.slow[li].s + "s" });
					}
				}
				if (lines.length === 0) {
					connNet.setAttribute("data-on", "0");
					connNetSig = "";
				} else {
					connNet.setAttribute("data-on", "1");
					var sig = lines.map(function (l) { return l.m + "|" + l.p + "|" + l.s; }).join("\n");
					if (sig !== connNetSig) {
						connNetSig = sig;
						connNetTitle.textContent = net.t("网络请求", "網路請求", "Network requests");
						connNetProbe.textContent = net.t("探测服务", "探測服務", "Probe");
						while (connNetList.firstChild) connNetList.removeChild(connNetList.firstChild);
						for (var ri = 0; ri < lines.length; ri++) {
							var row = document.createElement("div");
							row.className = "mfx-conn-netrow";
							row.textContent = lines[ri].m + " " + lines[ri].p + " · " + lines[ri].s;
							row.title = lines[ri].p;
							connNetList.appendChild(row);
						}
					}
				}
				connCard.setAttribute("data-open", connCardOpen ? "1" : "0");
			}
			function connOpenCard() {
				if (!connCardOpen) {
					connCardOpen = true;
					connCardOpenedAt = Date.now();
					// A stale pointer-leave stamp from a previous open would
					// close this one through the grace path before its own
					// lifetime has meaning (a touch tap right after a hover
					// dismissal is the reported sequence).
					connPointerLeftAt = 0;
				}
				connRender();
			}
			function connCloseCard() {
				connCardOpen = false;
				connRender();
			}
			connChip.addEventListener("click", function (e) {
				e.stopPropagation();
				// A mouse hover opens the card through pointerenter below; a
				// click landing within the hover-open race window must not
				// toggle it straight back closed. Only hover-originated opens
				// carry the stamp, so repeated taps keep toggling normally.
				if (connCardOpen && connHoverOpenedAt > 0 && Date.now() - connHoverOpenedAt < 350) return;
				if (connCardOpen) connCloseCard();
				else connOpenCard();
			});
			function connPin(inside, mouse) {
				connPointerIn = inside;
				if (!inside && mouse) {
					connPointerLeftAt = Date.now();
					// Re-baseline the auto-dismiss clock on leave: a card
					// pinned past its auto window must fall to the leave
					// grace, not snap shut by an already-expired auto timer.
					if (connCardOpen) connCardOpenedAt = Date.now();
				}
			}
			connChip.addEventListener("pointerenter", function (e) {
				// Only a real mouse hover previews the card; a touch tap's
				// synthetic enter would otherwise open the card ahead of the
				// click that is supposed to toggle it (open-then-close in one
				// tap, stranding touch users with no way back in).
				if (e.pointerType !== "mouse") return;
				connPin(true, true);
				if (!connCardOpen) {
					connHoverOpenedAt = Date.now();
					connOpenCard();
				}
			});
			connChip.addEventListener("pointerleave", function (e) { connPin(false, e.pointerType === "mouse"); });
			connCard.addEventListener("pointerenter", function (e) {
				connPin(true, e.pointerType === "mouse");
				// Pinning re-arms the auto-dismiss clock: without this, a card
				// hovered past its auto window would snap shut on leave
				// instead of honouring the leave grace.
				if (connCardOpen) connCardOpenedAt = Date.now();
			});
			connCard.addEventListener("pointerleave", function (e) { connPin(false, e.pointerType === "mouse"); });
			connX.addEventListener("click", function (e) {
				e.stopPropagation();
				connCloseCard();
			});
			document.addEventListener("pointerdown", function (e) {
				if (!connCardOpen) return;
				var t = e.target;
				if (t && t.closest && (t.closest("#mfx-conn-card") || t.closest("#mfx-conn-chip"))) return;
				connCloseCard();
			}, true);
			connReconnectBtn.addEventListener("click", function () {
				try { if (connSvc && typeof connSvc.reconnect === "function") connSvc.reconnect(); } catch (e) {}
			});
			connRefreshBtn.addEventListener("click", function () { location.reload(); });
			// One steady tick owns the timed behaviours (recovery expiry,
			// auto-dismiss) so they run even while the host tree is frozen.
			setInterval(function () {
				try {
					var now = Date.now();
					if (connCardOpen && !connPointerIn) {
						var auto = connEffState() === "recovered" ? CONN_RECOVER_AUTO_MS : CONN_CARD_AUTO_MS;
						if (now - connCardOpenedAt > auto) connCloseCard();
						else if (connPointerLeftAt > 0
							&& now - connPointerLeftAt > CONN_LEAVE_GRACE_MS
							&& now - connCardOpenedAt > CONN_LEAVE_GRACE_MS) connCloseCard();
					}
					connRender();
				} catch (e) {}
			}, 500);
			function connOnState(next) {
				if (next !== "connected" && next !== "connecting" && next !== "disconnected") return;
				var was = connState;
				connState = next;
				if (next === "connected") {
					if (was !== "connected") {
						connRecoveredUntil = Date.now() + CONN_RECOVERED_MS;
						// A card still open from the outage switches to the
						// recovered copy; re-arm its clock so the recovery
						// message holds for its own full window instead of
						// expiring with the outage's elapsed auto timer.
						if (connCardOpen) connCardOpenedAt = Date.now();
					}
				} else if (was === "connected") {
					// An outage begins: surface the chip and pop the card once.
					connOpenCard();
				}
				connRender();
			}
			function connBind() {
				try {
					var svc = null;
					if (typeof ctx.get === "function") svc = ctx.get("connection");
					if (!svc && ctx.connection) svc = ctx.connection;
					if (!svc || !svc.state || typeof svc.state.subscribe !== "function") return false;
					connSvc = svc;
					svc.state.subscribe(function () {
						try { connOnState(svc.state.getSnapshot()); } catch (e) {}
					});
					connOnState(svc.state.getSnapshot());
					return true;
				} catch (e) {
					return false;
				}
			}
			var connTries = 0;
			(function connAwait() {
				if (connBind()) return;
				if (++connTries >= 120) return;
				setTimeout(connAwait, 500);
			})();
			connRender();
			window.__mfxConnDebug = function () {
				var netCount = null;
				try { netCount = netWatch ? netWatch.snapshot().count : null; } catch (e) {}
				return {
					service: !!connSvc,
					state: connState,
					eff: connEffState(),
					card: connCardOpen ? "open" : "closed",
					pointer: connPointerIn ? "in" : "out",
					net: netCount,
					chip: connChip.isConnected ? "attached" : "detached"
				};
			};
		}

		// ---------- 8. narrow question card: the question scrolls in place ----------
		// The pending-question takeover — the card the agent's ask tool raises
		// over the composer — keeps the question in its header (eyebrow +
		// title) and the choices in a scrollable body below it. Only the body
		// scrolls and the host caps the card at min(60vh, 520px) with overflow
		// hidden, so the header is the one region with no ceiling: a question
		// long enough to reach that cap eats the card. Measured in the live UI
		// at 412x915 with a ~380-character question, a 441px header inside the
		// 520px card leaves the option region 11px tall holding 324px of rows —
		// every choice sits outside its own scrollport and cannot be tapped,
		// which is the phone report "the question pushes the answers below".
		// On shorter viewports the fixed parts go too: at 360x640 and 915x412
		// the option region is 0px and the footer lands below the card and off
		// the viewport.
		//
		// Below 1024px — the boundary of the host's own narrow-screen layout,
		// so a rotated phone is covered too — the question becomes its own capped
		// scroll region and hands the rest of the card to the option list,
		// which already scrolls. Both regions are then reachable: swipe the
		// question to read it, swipe the options to pick one, with the header
		// buttons, the pager and the submit row pinned outside both. The cap is
		// viewport-relative to stay inside the host's own min(60vh, 520px)
		// budget: 24vh of question leaves the remaining 36vh to the option list
		// and the ~68px of footer and padding, which keeps the fixed parts
		// inside the card on any viewport above ~190px tall. overscroll-behavior
		// keeps a drag inside the region from running the conversation
		// underneath it.
		//
		// A question inside the cap is untouched — no scrollbar, card still
		// hugging its content. The option region is deliberately left alone
		// beyond what the cap frees for it: a min-height floor there was tried
		// and dropped, because it also inflates the card when the question is
		// short (a 5-row question with no options grew by 50px of blank body),
		// and the cap alone already guarantees the region its share.
		//
		// The region is picked out by the card's own hooks rather than by
		// hashed class names, so a host rebuild that rehashes its CSS modules
		// cannot silently drop this: data-question-key on the takeover frame
		// scopes it, the question block inside is matched by class-name suffix
		// (hash-proof) with a structural fallback
		// (> section > header > div:first-child) for a host that renames the
		// local class. Losing both hooks degrades to the host's behaviour, not
		// to a broken card.
		if (flag("questions", true)) {
			var qstyle = document.createElement("style");
			qstyle.id = "mfx-questions-style";
			qstyle.textContent = [
				"@media (max-width: 1023px) {",
				"  [data-question-key] [class*=\"_headingBlock\"],",
				"  [data-question-key] > section > header > div:first-child {",
				"    max-height: min(24vh, 200px);",
				"    overflow-y: auto;",
				"    overscroll-behavior: contain;",
				/* auto on one axis would make the other a scroll container too and
				   hand a long unbroken token (a path, a hash) its own horizontal
				   scrollbar inside the region; break it instead of clipping it,
				   the way the card clips it today. */
				"    overflow-x: hidden;",
				"    overflow-wrap: anywhere;",
				"  }",
				"}"
			].join("\n");
			document.head.appendChild(qstyle);

			// A batch of questions is one card: the pager swaps the question
			// text into the very same nodes, so the browser keeps the region's
			// scroll offset and paging from one long question to the next lands
			// mid-question — a defect the cap itself introduces, since the
			// region only became scrollable here. Reset the offset when the
			// question text actually changes (and only then: re-renders during
			// streaming must not yank a region the user is reading). The
			// observer runs through the shared leading+trailing throttle, so
			// a token flood costs at most five runs a second of two lookups
			// and a string compare.
			var qText = null;
			var syncQuestionScroll = function () {
				try {
					var card = document.querySelector("[data-question-key]");
					if (!card) { qText = null; return; }
					var heading = card.querySelector("[class*=\"_headingBlock\"]");
					if (!heading) return;
					var text = (heading.querySelector("h2") || heading).textContent;
					if (text === qText) return;
					qText = text;
					heading.scrollTop = 0;
				} catch (e) {}
			};
			var syncQuestionScrollThrottled = mfxThrottle(syncQuestionScroll, 200);
			try {
				new MutationObserver(syncQuestionScrollThrottled).observe(document.documentElement,
					{ subtree: true, childList: true, characterData: true });
			} catch (e) {}
			syncQuestionScroll();
		}

		// ---------- 11. agents guard: catalog refreshes stop hammering the host ----------
		// The subagent catalog (the "N subagents" chips and their trees) is
		// served by a host route that enumerates the ENTIRE session corpus on
		// every call: with a 2400-session history one request costs a full
		// second of host time. The host client fires one on every session
		// selection, every hover-open of a chip, and — while a catalog menu is
		// open — after every membership event (50ms debounce). A workflow
		// fanning out subagents turns that into a request storm that starves
		// the very host that has to answer it, which is exactly when the
		// chips feel dead and the connection card lights up.
		//
		// The guard wraps the session controller's refreshProjections (the
		// single choke point every caller — select, catalog-open, stale
		// re-arm, reconnect — goes through) and adds three client-side brakes
		// while keeping the host's own per-parent single-flight semantics:
		//   * a parent with no subagent children in the live session list
		//     (and no prior catalog entries) can have no catalog children —
		//     the corpus scan is skipped outright. The list baseline arrives
		//     before this fires at startup, so cold starts are unaffected;
		//   * a parent whose last refresh settled less than
		//     AGENTS_COOLDOWN_MS ago is not refreshed again;
		//   * refresh starts are spaced at least AGENTS_GAP_MS apart, so a
		//     burst of selections/hovers collapses into a spaced trickle
		//     instead of a parallel pile of full-corpus scans.
		var mfxForceCatalogRefresh = null;
		if (flag("agents", true)) {
			var AGENTS_COOLDOWN_MS = 2500;
			var AGENTS_GAP_MS = 350;
			var agentsStats = { skippedChildless: 0, skippedCooldown: 0, started: 0 };
			var agentsLastOk = {};
			var agentsLastStart = 0;
			var agentsKidCache = { src: null, index: null };

			function agentsChildrenIndex() {
				try {
					var list = ctx.sessions && ctx.sessions.list;
					if (!list || !list.getSnapshot) return null;
					var snap = list.getSnapshot();
					if (agentsKidCache.src === snap) return { snap: snap, index: agentsKidCache.index };
					var index = {};
					var byId = snap.byId || {};
					for (var key in byId) {
						var row = byId[key];
						if (row && row.origin === "subagent" && row.parentId) {
							(index[row.parentId] || (index[row.parentId] = [])).push(key);
						}
					}
					agentsKidCache.src = snap;
					agentsKidCache.index = index;
					return { snap: snap, index: index };
				} catch (e) { return null; }
			}

			function installAgentsGuard() {
				var svc = ctx.sessions;
				if (!svc) return;
				var manager = svc.manager && typeof svc.manager.refreshProjections === "function"
					? svc.manager : null;
				var target = manager !== null ? manager
					: (typeof svc.refreshProjections === "function" ? svc : null);
				if (target === null) return;
				if (target.__mfxAgentsGuarded) {
					// a plugin reload re-runs apply(): keep the forced-refresh
					// escape hatch pointing at the one original method
					mfxForceCatalogRefresh = function (parentSessionId) {
						return Promise.resolve(target.__mfxOrigRefresh.call(target, parentSessionId));
					};
					return;
				}
				target.__mfxAgentsGuarded = true;
				var origRefresh = target.refreshProjections;
				target.__mfxOrigRefresh = origRefresh;
				// A forced refresh bypasses the brakes (sheet retry button,
				// pending navigation): the user asked for THIS fetch.
				mfxForceCatalogRefresh = function (parentSessionId) {
					return Promise.resolve(origRefresh.call(target, parentSessionId));
				};
				target.refreshProjections = function (parentSessionId) {
					try {
						var view = agentsChildrenIndex();
						var snap = view !== null ? view.snap : null;
						var kids = view !== null ? view.index : null;
						/* the projections store is loaded on demand: a parent with
						   no loaded projection at all is NOT evidence of
						   childlessness — the fetch has to run once so the
						   ready-empty state (the actual skip evidence) can
						   exist. Only a READY, EMPTY catalog combined with no
						   byId children rows proves childlessness. */
						var projection = snap !== null && snap.projectionsBySession
							? snap.projectionsBySession[parentSessionId] : undefined;
						var catalogEntries = projection !== undefined && projection.values
							? projection.values.subagentCatalog : undefined;
						var byIdLoaded = snap !== null && snap.byId
							&& Object.keys(snap.byId).length > 0;
						var childless = byIdLoaded
							&& (!kids || !kids[parentSessionId])
							&& projection !== undefined
							&& (projection.state === "ready" || projection.state === undefined)
							&& (catalogEntries || []).length === 0;
						if (childless) {
							agentsStats.skippedChildless++;
							return Promise.resolve();
						}
						// An error catalog is not evidence of childlessness —
						// the host's own Retry must stay able to refetch.
						// A catalog sitting in the error state is likewise
						// exempt from the cooldown below: a retry tap inside
						// 2.5s of the failed attempt must actually run.
						// openCatalogs is a pre-0.2 seat (gone from the 0.2
						// manager — membership is push-fed there), so the
						// exemption rides the projection state instead.
						var openNow = false;
						var projectionErrored = projection !== undefined
							&& projection.state === "error";
						try {
							openNow = target.openCatalogs instanceof Set
								&& target.openCatalogs.has(parentSessionId);
						} catch (e) {}
						if (!openNow && !projectionErrored
							&& Date.now() - (agentsLastOk[parentSessionId] || 0) < AGENTS_COOLDOWN_MS) {
							agentsStats.skippedCooldown++;
							return Promise.resolve();
						}
					} catch (e) {}
					var wait = Math.max(0, agentsLastStart + AGENTS_GAP_MS - Date.now());
					agentsLastStart = Date.now() + wait;
					agentsStats.started++;
					var run = function () {
						return Promise.resolve(origRefresh.call(target, parentSessionId)).then(
							function (result) {
								agentsLastOk[parentSessionId] = Date.now();
								return result;
							},
							function (error) {
								delete agentsLastOk[parentSessionId];
								throw error;
							}
						);
					};
					return wait > 0
						? new Promise(function (resolve) {
							setTimeout(function () { resolve(run()); }, wait);
						})
						: run();
				};
			}
			installAgentsGuard();
			window.__mfxAgentsDebug = function () {
				return JSON.parse(JSON.stringify(agentsStats));
			};
		}

		// ---------- 12. desktop lineage chips open on click ----------
		// The host's subagent chips (the "N subagents" count and the subagent
		// title switcher) only open on HOVER: the count trigger carries no
		// onClick at all, so a click does nothing and moving the mouse away
		// closes the menu 120ms later — "hover opens it, clicking never does".
		// The chips keep their hover behavior; this shim translates a real
		// CLICK on a chip into the hover event pair the host already
		// understands (React delegates mouseenter/leave from native
		// mouseover/mouseout), so click becomes a toggle:
		//   closed + click  -> mouseover  -> opens (through the host's 150ms
		//                                   hover timer, with its refresh)
		//   open   + click  -> mouseout   -> closes (the host's 120ms close)
		// Ancestor-crumb switchers are left alone: their click navigates to
		// the parent session, which is correct.
		if (flag("agents", true)) {
			function lineageChipRoot(btn, prefix) {
				var node = btn.parentElement;
				var guard = 0;
				while (node && guard++ < 4) {
					if (String(node.className || "").indexOf(prefix + "_root") !== -1) return node;
					node = node.parentElement;
				}
				return null;
			}
			document.addEventListener("click", function (ev) {
				try {
					var target = ev.target;
					if (!target || !target.closest) return;
					var nav = target.closest('nav[class*="_crumbs"]');
					if (!nav) return;
					var btn = target.closest("button");
					if (!btn || !nav.contains(btn)) return;
					var classes = String(btn.className || "").split(/\s+/);
					var prefix = null;
					for (var i = 0; i < classes.length; i++) {
						if (/_ancestorSwitcherTrigger$/.test(classes[i])) return; // host: click navigates
					}
					for (var j = 0; j < classes.length; j++) {
						var m = /^([A-Za-z0-9_-]+)_(?:switcherTrigger|trigger)$/.exec(classes[j]);
						if (m !== null) { prefix = m[1]; break; }
					}
					if (prefix === null) return;
					var root = lineageChipRoot(btn, prefix);
					if (root === null) return;
					var isOpen = btn.getAttribute("aria-expanded") === "true";
					root.dispatchEvent(new MouseEvent(isOpen ? "mouseout" : "mouseover", {
						bubbles: true,
						cancelable: true,
						view: window,
						relatedTarget: isOpen ? document.body : null
					}));
				} catch (e) {}
			}, true);
		}

		// ---------- 13. narrow header: one collector pill, one full-width sheet ----------
		// Below 1024px the session header's own controls cannot fit a phone:
		// the breadcrumb lineage (one chip per ancestor), the jobs count, the
		// preset label — a row far wider than the viewport, and the chips it
		// is made of open on hover, which a phone cannot do at all. On narrow
		// screens this feature folds the whole row into ONE pill:
		//   [≡ current title …] (dot) 64 agents · 3 jobs
		// Tapping it opens a full-width sheet (portal, 10px margins) with
		//   * the lineage — every ancestor up to the root, each row tappable,
		//     each with its descendant count;
		//   * the subagent tree rooted at the family root — rows render from
		//     the LIVE session list (titles and running dots arrive with the
		//     baseline, no request), branches expand on demand and only then
		//     fetch that branch's catalog (through the guarded refresh);
		//   * this session's background jobs, mirroring the host's list.
		// Popups opened from here span the phone width — the same treatment
		// the model menu already gets. On wide screens nothing changes.
		if (flag("header", true)) {
			var createPortalFn = null;
			try { createPortalFn = require("react-dom").createPortal; } catch (e) {}

			function mfxT(zh, hant, en) {
				return mfxTr(zh, hant, en);
			}

			/* Host 0.2 rewired the data under this feature:
			   * subagent catalogs moved from a list-snapshot `subagentsByParent`
			     map to per-session PROJECTIONS (`projectionsBySession`, values
			     include `subagentCatalog` rows { id, mode, label }) that a
			     session loads on demand via `refreshProjections`;
			   * background jobs moved out of the list snapshot entirely —
			     `ctx.jobs.state` is its own observable ({ rows, observed }) fed
			     while `ctx.jobs.watchRows(sessionId)` holds the feed open;
			   * `openSubagent`/`open` left the sessions face — navigation goes
			     through `ctx.uiWorkspace.openSession(idOrAddress)`.
			   The helpers below bridge the pill onto those faces. All host
			   reads are feature-detected: an older host keeps its paths, a
			   newer one must never throw inside a slot render (a throw hands
			   the entry to the host's error boundary, which is exactly how
			   this feature died as a blank header row). */

			// One React hook over a plain observable source
			// ({ getSnapshot, subscribe }), identity-compared.
			function mfxObservableHook(source) {
				return function (selector) {
					var statePair = React.useState(function () { return selector(source.getSnapshot()); });
					var value = statePair[0];
					var setValue = statePair[1];
					React.useEffect(function () {
						var update = function () {
							var next;
							try { next = selector(source.getSnapshot()); } catch (e) { return; }
							setValue(function (prev) { return prev === next ? prev : next; });
						};
						update();
						return source.subscribe(update);
					}, []);
					return value;
				};
			}

			var mfxJobsHook = null;
			// optional lookup: the jobs service does not exist on hosts older
			// than 0.1.7 — the collector then simply carries no job rows
			function mfxJobsFace() {
				try {
					if (typeof ctx.get === "function") return ctx.get("jobs") || null;
				} catch (e) {}
				return null;
			}
			function mfxEnsureJobsHook() {
				if (mfxJobsHook !== null) return mfxJobsHook;
				var face = mfxJobsFace();
				var source = face && face.state && typeof face.state.getSnapshot === "function"
					&& typeof face.state.subscribe === "function" ? face.state : null;
				if (source === null) {
					source = { getSnapshot: function () { return {}; }, subscribe: function () { return function () {}; } };
				}
				mfxJobsHook = mfxObservableHook(source);
				return mfxJobsHook;
			}

			// The host's own derivation for catalog dropdowns (ui-subagent):
			// idle + no data = loading; entries gain a live running flag from
			// the session list rows.
			function mfxDerivedCatalogs(projections, byId) {
				var out = {};
				var key;
				for (key in (projections || {})) {
					var snapshot = projections[key];
					if (!snapshot) continue;
					var raw = snapshot.values ? snapshot.values.subagentCatalog : undefined;
					var entries = [];
					var i;
					for (i = 0; raw && i < raw.length; i++) {
						var entry = raw[i];
						var summary = byId ? byId[entry.id] : undefined;
						entries.push({
							id: entry.id,
							mode: entry.mode,
							label: entry.label,
							running: !!(summary && summary.running)
						});
					}
					out[key] = {
						state: snapshot.state === "idle" ? (raw === undefined ? "loading" : "ready") : snapshot.state,
						error: snapshot.error,
						entries: entries
					};
				}
				return out;
			}

			var hstyle = document.createElement("style");
			hstyle.id = "mfx-header-style";
			hstyle.textContent = [
				"@media (max-width: 1023px) {",
				// The host's own header chips fold away; the collector pill
				// (data-mfx-collector on its root) takes the whole row. The
				// slot outlet renders one display:contents anchor
				// div[data-slot=...] around the entry list, so the sibling
				// chips are the anchor's children, not the container's.
				"  nav[class*=\"_crumbs\"] { display: none !important; }",
				"  [class*=\"_headerActions\"] { flex: 1 1 auto !important; min-width: 0 !important; }",
				"  [data-slot=\"conversation.session.header.actions\"] > *:not([data-mfx-collector])",
				"  { display: none !important; }",
				"  [class*=\"_headerUtilities\"] { display: none !important; }",
				// view tabs, if a session grows more than one, scroll instead
				// of overflowing the row
				"  [class*=\"_tabs\"] { overflow-x: auto !important; scrollbar-width: none !important; }",
				"  [class*=\"_tabs\"]::-webkit-scrollbar { display: none !important; }",
				"}"
			].join("\n");
			document.head.appendChild(hstyle);

			var narrowHeaderMQ = null;
			try { narrowHeaderMQ = window.matchMedia("(max-width: 1023px)"); } catch (e) {}
			function useMfxNarrow() {
				var st = React.useState(function () { return !!(narrowHeaderMQ && narrowHeaderMQ.matches); });
				React.useEffect(function () {
					if (!narrowHeaderMQ || !narrowHeaderMQ.addEventListener) return undefined;
					var fn = function () { st[1](narrowHeaderMQ.matches); };
					narrowHeaderMQ.addEventListener("change", fn);
					return function () {
						try { narrowHeaderMQ.removeEventListener("change", fn); } catch (e) {}
					};
				}, []);
				return st[0];
			}

			var MFX_SHEET_Z = 145;
			var MFX_RUNNING = "#34a853";
			var MFX_IDLE = "#8a8f98";
			var MFX_WARN = "#d68020";
			var MFX_ERROR = "#c64040";

			function mfxDot(color, pulse) {
				return React.createElement("span", {
					style: {
						flex: "none", width: "8px", height: "8px", borderRadius: "50%",
						background: color, boxShadow: pulse ? "0 0 0 3px " + color + "40" : "none"
					}
				});
			}

			function mfxBadge(text, color) {
				return React.createElement("span", {
					style: {
						flex: "none", padding: "1px 7px", borderRadius: "8px",
						fontSize: "11px", lineHeight: "16px", whiteSpace: "nowrap",
						border: "1px solid " + (color || "rgba(128,128,140,.4)"),
						color: "inherit", background: "rgba(128,128,140,.12)"
					}
				}, text);
			}

			function mfxChevron(open) {
				return React.createElement("svg", {
					width: "14", height: "14", viewBox: "0 0 24 24", fill: "none",
					stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round",
					strokeLinejoin: "round", "aria-hidden": "true",
					style: { transform: open ? "rotate(90deg)" : "none", transition: "transform 120ms ease", flex: "none" }
				}, React.createElement("path", { d: "m9 18 6-6-6-6" }));
			}

			function mfxBurger() {
				return React.createElement("svg", {
					width: "16", height: "16", viewBox: "0 0 24 24", fill: "none",
					stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round",
					strokeLinejoin: "round", "aria-hidden": "true", style: { flex: "none" }
				},
					React.createElement("path", { d: "M4 6h16" }),
					React.createElement("path", { d: "M4 12h10" }),
					React.createElement("path", { d: "M4 18h16" }));
			}

			function mfxCloseIcon() {
				return React.createElement("svg", {
					width: "16", height: "16", viewBox: "0 0 24 24", fill: "none",
					stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round",
					strokeLinejoin: "round", "aria-hidden": "true", style: { flex: "none" }
				}, React.createElement("path", { d: "M18 6 6 18" }), React.createElement("path", { d: "m6 6 12 12" }));
			}

			function mfxDuration(ms) {
				var total = Math.max(0, Math.floor(ms / 1000));
				var h = Math.floor(total / 3600);
				var m = Math.floor(total / 60) % 60;
				var s = total % 60;
				var two = function (n) { return (n < 10 ? "0" : "") + n; };
				return h > 0 ? h + ":" + two(m) + ":" + two(s) : m + ":" + two(s);
			}

			function mfxJobColor(status) {
				if (status === "running") return MFX_RUNNING;
				if (status === "stopping" || status === "killed") return MFX_WARN;
				if (status === "failed") return MFX_ERROR;
				return MFX_IDLE;
			}

			var mfxRowTextStyle = {
				flex: "1 1 auto", minWidth: "0", overflow: "hidden",
				whiteSpace: "nowrap", textOverflow: "ellipsis", textAlign: "left",
				fontSize: "13px", lineHeight: "18px", color: "inherit"
			};
			var mfxRowButtonStyle = {
				flex: "1 1 auto", minWidth: "0", display: "flex", alignItems: "center",
				gap: "8px", minHeight: "38px", padding: "6px 10px", border: "none",
				borderRadius: "9px", background: "transparent", color: "inherit",
				cursor: "pointer"
			};
			var mfxChevButtonStyle = {
				flex: "none", width: "32px", height: "32px", display: "grid",
				placeItems: "center", border: "none", borderRadius: "8px",
				background: "transparent", color: "inherit", cursor: "pointer"
			};

			function CollectorPill(props) {
				var sessionId = props.sessionId;
				var useSessions = props.useSessions;
				var narrow = useMfxNarrow();
				var byId = useSessions(function (s) { return s.byId; });
				var projections = useSessions(function (s) { return s.projectionsBySession; });
				var catalogs = React.useMemo(function () { return mfxDerivedCatalogs(projections, byId); }, [projections, byId]);
				var jobsHook = mfxEnsureJobsHook();
				// no try/catch here on purpose: mfxEnsureJobsHook guarantees a
				// source whose getSnapshot cannot throw and the selector reads
				// a plain object — a catch around a hook CALL would let a
				// half-initialized render complete and corrupt the hook order
				var jobs = jobsHook(function (s) { return (s.rows || {})[sessionId]; }) || [];
				// hold the host's per-session job feed open while the pill is
				// mounted — the rows above only populate for a watched session.
				// Gated on narrow: desktop keeps the exact 0.8.3 footprint.
				React.useEffect(function () {
					if (!narrow) return undefined;
					var face = mfxJobsFace();
					if (!face || typeof face.watchRows !== "function") return undefined;
					try { return face.watchRows(sessionId); } catch (e) { return undefined; }
				}, [sessionId, narrow]);
				var openState = React.useState(false);
				var open = openState[0], setOpen = openState[1];
				var topState = React.useState(52);
				var top = topState[0], setTop = topState[1];
				var nowState = React.useState(0);
				var now = nowState[0], setNow = nowState[1];
				var pillRef = React.useRef(null);
				var expandedRef = React.useRef(null);
				if (expandedRef.current === null) expandedRef.current = {};
				var pendingNavRef = React.useRef(null);
				var bumpState = React.useState(0);
				var bump = function () { bumpState[1](bumpState[0] + 1); };

				// lineage chain: root ... current (same walk the host header does)
				var lineage = React.useMemo(function () {
					var chain = [];
					var seen = {};
					var cursor = sessionId;
					var guard = 0;
					while (cursor !== undefined && cursor !== null && guard++ < 64 && !seen[cursor]) {
						seen[cursor] = 1;
						var row = byId[cursor];
						if (row === undefined) break;
						chain.unshift({
							id: cursor,
							title: row.displayTitle || cursor,
							subagent: row.origin === "subagent",
							running: !!row.running
						});
						if (row.origin !== "subagent" || !row.parentId) break;
						cursor = row.parentId;
					}
					return chain;
				}, [byId, sessionId]);
				var rootId = lineage.length > 0 ? lineage[0].id : sessionId;
				var currentTitle = (byId[sessionId] && byId[sessionId].displayTitle) || sessionId;

				// live children index + per-node subtree stats, all from the
				// session list: titles, running dots and counts need no request
				var tree = React.useMemo(function () {
					var kids = {};
					for (var key in byId) {
						var row = byId[key];
						if (row && row.origin === "subagent" && row.parentId) {
							(kids[row.parentId] || (kids[row.parentId] = [])).push(row);
						}
					}
					var stats = {};
					var visit = function (id, depth) {
						if (depth > 32) return { count: 0, running: 0 };
						var list = kids[id] || [];
						var total = 0;
						var running = 0;
						for (var i = 0; i < list.length; i++) {
							total++;
							if (list[i].running) running++;
							var sub = stats[list[i].id];
							if (sub === undefined) {
								sub = visit(list[i].id, depth + 1);
								stats[list[i].id] = sub;
							}
							total += sub.count;
							running += sub.running;
						}
						return { count: total, running: running };
					};
					for (var pid in kids) {
						if (stats[pid] === undefined) stats[pid] = visit(pid, 0);
					}
					return { kids: kids, stats: stats };
				}, [byId]);
				var rootStats = tree.stats[rootId] || { count: 0, running: 0 };

				var liveJobs = 0;
				var ji;
				for (ji = 0; ji < jobs.length; ji++) {
					if (jobs[ji].status === "running" || jobs[ji].status === "stopping") liveJobs++;
				}

				// a session switch closes the sheet and folds every branch
				React.useEffect(function () {
					setOpen(false);
					expandedRef.current = {};
				}, [sessionId]);

				// the clock ticks only while the sheet shows something alive
				React.useEffect(function () {
					if (!open) return undefined;
					if (liveJobs === 0 && rootStats.running === 0) return undefined;
					setNow(Date.now());
					var timer = setInterval(function () { setNow(Date.now()); }, 1000);
					return function () { clearInterval(timer); };
				}, [open, liveJobs, rootStats.running]);

				// Escape closes the sheet
				React.useEffect(function () {
					if (!open) return undefined;
					var onKey = function (event) {
						if (event.key === "Escape") setOpen(false);
					};
					document.addEventListener("keydown", onKey);
					return function () { document.removeEventListener("keydown", onKey); };
				}, [open]);

				// sheet open: fetch the root catalog if absent — through the
				// forced path, so a childless root still resolves to its empty
				// ready catalog instead of a perpetual loading row. Live
				// membership needs no subscription seat on host 0.2+: catalog
				// events arrive as projection frames for every attached
				// session; the legacy open-catalog seat is kept for older
				// hosts that still push per-observer.
				React.useEffect(function () {
					if (!open) return undefined;
					var sessions = ctx.sessions;
					if (!sessions) return undefined;
					try {
						var catalog = catalogs[rootId];
						if (catalog === undefined || catalog.state === "error" || catalog.state === "loading") {
							var force = mfxForceCatalogRefresh;
							if (force !== null) void force(rootId);
							else if (typeof sessions.refreshProjections === "function") void sessions.refreshProjections(rootId);
						}
						// setSubagentCatalogOpen is a pre-0.2 seat (the 0.2
						// manager pushes catalog membership via projection
						// frames — no per-observer registration to open/close)
						if (typeof sessions.setSubagentCatalogOpen === "function") sessions.setSubagentCatalogOpen(rootId, true);
						// branches kept expanded from a previous open resume
						// their live-membership subscription
						for (var pid in expandedRef.current) {
							if (typeof sessions.setSubagentCatalogOpen === "function") sessions.setSubagentCatalogOpen(pid, true);
						}
					} catch (e) {}
					return function () {
						if (typeof sessions.setSubagentCatalogOpen !== "function") return undefined;
						var pid;
						for (pid in expandedRef.current) {
							try { sessions.setSubagentCatalogOpen(pid, false); } catch (e) {}
						}
						try { sessions.setSubagentCatalogOpen(rootId, false); } catch (e) {}
					};
				}, [open, rootId]);

				// a tap on a row whose mode is not known yet (catalog still
				// loading) parks itself here; when the forced refresh lands,
				// the navigation completes on its own
				React.useEffect(function () {
					var pending = pendingNavRef.current;
					if (pending === null) return;
					if (Date.now() - pending.at > 6000) {
						pendingNavRef.current = null;
						return;
					}
					var summary = byId[pending.id];
					if (summary === undefined || summary.origin !== "subagent") {
						pendingNavRef.current = null;
						return;
					}
					var cat = catalogs[summary.parentId];
					if (cat === undefined || cat.entries === undefined) return;
					for (var i = 0; i < cat.entries.length; i++) {
						var entry = cat.entries[i];
						if (entry.id === pending.id) {
							pendingNavRef.current = null;
							navigateTo(pending.id, entry, summary.parentId);
							return;
						}
					}
				}, [catalogs, byId]);

				function closeSheet() { setOpen(false); }

				// Bypass the agents guard: these fetches answer a user gesture
				// (an error retry, a row tapped while its mode was still
				// unknown), so they must actually run.
				function forceCatalog(pid) {
					var sessions = ctx.sessions;
					if (sessions === undefined || pid === undefined) return;
					try {
						if (typeof sessions.setSubagentCatalogOpen === "function") sessions.setSubagentCatalogOpen(pid, true);
						var force = mfxForceCatalogRefresh;
						if (force !== null) void force(pid);
						else if (typeof sessions.refreshProjections === "function") void sessions.refreshProjections(pid);
					} catch (e) {}
				}

				function toggleBranch(pid) {
					if (expandedRef.current[pid]) {
						delete expandedRef.current[pid];
						try {
							if (typeof ctx.sessions.setSubagentCatalogOpen === "function") ctx.sessions.setSubagentCatalogOpen(pid, false);
						} catch (e) {}
					} else {
						expandedRef.current[pid] = 1;
						// expanding fetches only what is missing; a ready
						// catalog just resumes its live subscription
						var catalog = catalogs[pid];
						if (catalog === undefined || catalog.state === "error") forceCatalog(pid);
						else {
							try {
								if (typeof ctx.sessions.setSubagentCatalogOpen === "function") ctx.sessions.setSubagentCatalogOpen(pid, true);
							} catch (e) {}
						}
					}
					bump();
				}

				function navigateTo(id, entry, parentId) {
					var sessions = ctx.sessions;
					if (sessions === undefined) return;
					var summary = byId[id];
					var isSubagent = summary !== undefined && summary.origin === "subagent";
					var address = null;
					try { address = sessions.subagentAddress(id) || null; } catch (e) {}
					if (address === null && entry !== null && entry !== undefined
						&& parentId !== undefined) {
						address = { parentSessionId: parentId, childSessionId: id, mode: entry.mode };
					}
					if (address === null && isSubagent) {
						// an address the controller cannot resolve means the
						// parent's catalog is not loaded yet — park the tap and
						// fetch, so the child does not land on a broken route
						var pid = summary.parentId;
						var cat = catalogs[pid];
						var found = false;
						if (cat !== undefined && cat.entries !== undefined) {
							for (var i = 0; i < cat.entries.length; i++) {
								if (cat.entries[i].id === id) { found = true; break; }
							}
						}
						if (!found) {
							pendingNavRef.current = { id: id, at: Date.now() };
							forceCatalog(pid);
							return;
						}
					}
					// host 0.2 routes everything through the workspace face:
					// openSession accepts a bare session id or an addressed
					// child; the legacy sessions.open/openSubagent paths stay
					// as feature-detected fallbacks for older hosts
					try {
						var workspace = null;
						if (typeof ctx.get === "function") workspace = ctx.get("uiWorkspace") || null;
						if (workspace && typeof workspace.openSession === "function") {
							workspace.openSession(address !== null ? address : id);
						} else if (address !== null && typeof sessions.openSubagent === "function") {
							sessions.openSubagent(address);
						} else if (typeof sessions.open === "function") {
							sessions.open(id);
						}
					} catch (e1) {
						try { if (typeof sessions.open === "function") sessions.open(id); } catch (e2) {}
					}
					closeSheet();
				}

				function openSheet() {
					var rect = pillRef.current !== null ? pillRef.current.getBoundingClientRect() : null;
					var t = rect !== null ? rect.bottom + 6 : 52;
					var capped = Math.max(8, Math.min(t, window.innerHeight - 140));
					setTop(capped);
					setOpen(true);
				}

				function sectionLabel(text) {
					return React.createElement("div", {
						key: "sec" + text,
						style: {
							padding: "10px 12px 4px", fontSize: "11px", letterSpacing: ".06em",
							textTransform: "uppercase", opacity: ".55", fontWeight: 600, whiteSpace: "nowrap",
							overflow: "hidden", textOverflow: "ellipsis"
						}
					}, text);
				}

				function branchRows(pid, level, out) {
					var cat = catalogs[pid];
					var kids = tree.kids[pid] || [];
					var seen = {};
					var models = [];
					var i;
					for (i = 0; i < kids.length; i++) {
						seen[kids[i].id] = 1;
						models.push({
							id: kids[i].id,
							title: kids[i].displayTitle || kids[i].id,
							running: !!kids[i].running,
							entry: catalogEntry(cat, kids[i].id)
						});
					}
					if (cat !== undefined && cat.entries !== undefined) {
						for (i = 0; i < cat.entries.length; i++) {
							var entry = cat.entries[i];
							if (seen[entry.id]) continue;
							models.push({
								id: entry.id,
								title: entry.label || entry.id,
								running: entry.running === true,
								entry: entry
							});
						}
					}
					var loading = cat === undefined || cat.state === "loading";
					if (models.length === 0 && loading) {
						out.push(React.createElement("div", {
							key: "ld" + pid,
							style: { padding: "8px 12px 8px " + (10 + level * 14) + "px", opacity: ".6", fontSize: "12px" }
						}, mfxT("正在加载代理目录…", "正在載入代理目錄…", "Loading the agent catalog…")));
						return;
					}
					if (models.length === 0 && cat !== undefined && cat.state === "error") {
						out.push(React.createElement("div", {
							key: "er" + pid,
							style: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px" }
						},
							React.createElement("span", { style: { fontSize: "12px", color: MFX_ERROR, flex: "1 1 auto" } },
								mfxT("目录加载失败", "目錄載入失敗", "The catalog failed to load")),
							React.createElement("button", {
								type: "button", onClick: function () { forceCatalog(pid); bump(); },
								style: { flex: "none", padding: "4px 10px", borderRadius: "8px", border: "1px solid rgba(128,128,140,.4)", background: "transparent", color: "inherit", fontSize: "12px", cursor: "pointer" }
							}, mfxT("重试", "重試", "Retry"))));
						return;
					}
					for (i = 0; i < models.length; i++) {
						var model = models[i];
						var entry2 = model.entry;
						/* catalog rows carry no hasChildren hint on host 0.2:
						   a branch is expandable unless its own catalog is a
						   known-empty leaf (the host's dropdown uses the same
						   rule); list-only rows fall back to the live tree */
						var expandable;
						if (entry2 !== undefined && entry2 !== null) {
							var own = catalogs[entry2.id];
							expandable = !(own !== undefined && own.state === "ready" && own.entries.length === 0);
						} else {
							expandable = !!(tree.kids[model.id] && tree.kids[model.id].length);
						}
						var st = tree.stats[model.id] || { count: 0, running: 0 };
						var isExpanded = !!expandedRef.current[model.id];
						out.push(React.createElement("div", {
							key: "c" + model.id,
							style: { display: "flex", alignItems: "center", paddingLeft: (6 + level * 14) + "px" }
						},
							React.createElement("button", {
								type: "button",
								style: mfxRowButtonStyle,
								onClick: (function (rowModel) {
									return function () { navigateTo(rowModel.id, rowModel.entry, pid); };
								})(model)
							},
								mfxDot(model.running ? MFX_RUNNING : MFX_IDLE, model.running),
								React.createElement("span", { style: mfxRowTextStyle }, model.title),
								st.count > 0 ? mfxBadge(String(st.count) + (st.running > 0 ? " · " + st.running + "↑" : "")) : null
							),
							expandable
								? React.createElement("button", {
									type: "button",
									style: mfxChevButtonStyle,
									"aria-expanded": isExpanded,
									"aria-label": mfxT("展开子代理", "展開子代理", "Expand subagents"),
									onClick: (function (rowId) {
										return function () { toggleBranch(rowId); };
									})(model.id)
								}, mfxChevron(isExpanded))
								: React.createElement("span", { style: { flex: "none", width: "32px" } })));
						if (isExpanded && expandable) branchRows(model.id, level + 1, out);
					}
				}

				function catalogEntry(cat, childId) {
					if (cat === undefined || cat.entries === undefined) return undefined;
					for (var i = 0; i < cat.entries.length; i++) {
						if (cat.entries[i].id === childId) return cat.entries[i];
					}
					return undefined;
				}

				if (!narrow || useSessions === undefined) return null;

				var sheet = null;
				if (open && createPortalFn !== null) {
					var body = [];
					// lineage
					if (lineage.length > 1) {
						body.push(sectionLabel(mfxT("会话层级", "會話層級", "Session lineage")));
						for (var li = 0; li < lineage.length; li++) {
							(function (node, index) {
								var isCurrent = index === lineage.length - 1;
								var st = tree.stats[node.id] || { count: 0, running: 0 };
								body.push(React.createElement("button", {
									key: "ln" + node.id,
									type: "button",
									style: mfxRowButtonStyle,
									onClick: function () { if (!isCurrent) navigateTo(node.id, undefined, undefined); }
								},
									mfxDot(node.running ? MFX_RUNNING : (isCurrent ? MFX_IDLE : MFX_IDLE), node.running),
									React.createElement("span", {
										style: Object.assign({}, mfxRowTextStyle, { fontWeight: isCurrent ? 600 : 400 })
									}, node.title),
									node.subagent ? mfxBadge("sub", null) : null,
									st.count > 0 ? mfxBadge(String(st.count), null) : null));
							})(lineage[li], li);
						}
					}
					// subagent tree rooted at the family root
					body.push(sectionLabel(mfxT("子代理（", "子代理（", "Subagents (") + rootStats.count + mfxT("）", "）", ")")));
					var treeOut = [];
					branchRows(rootId, 0, treeOut);
					if (treeOut.length === 0) {
						treeOut.push(React.createElement("div", {
							key: "none",
							style: { padding: "8px 12px", opacity: ".6", fontSize: "12px" }
						}, mfxT("没有子代理", "沒有子代理", "No subagents")));
					}
					body.push.apply(body, treeOut);
					// jobs
					if (jobs.length > 0) {
						body.push(sectionLabel(mfxT("后台任务（", "背景任務（", "Background jobs (") + jobs.length + mfxT("）", "）", ")")));
						for (var jbi = 0; jbi < jobs.length; jbi++) {
							(function (job) {
								var live = job.status === "running" || job.status === "stopping";
								var elapsed = live
									? (now > 0 ? now : Date.now()) - job.startedAt
									: (job.finishedAt ?? job.startedAt) - job.startedAt;
								body.push(React.createElement("div", {
									key: "job" + job.id,
									style: { display: "flex", alignItems: "center", gap: "8px", padding: "7px 12px", fontSize: "12px" }
								},
									mfxDot(mfxJobColor(job.status), live),
									React.createElement("span", {
										style: {
											flex: "none", padding: "0 6px", borderRadius: "5px",
											background: "rgba(128,128,140,.16)", fontSize: "11px", lineHeight: "17px"
										}
									}, job.kind || "?"),
									React.createElement("span", { style: mfxRowTextStyle, title: job.label }, job.label || job.id),
									React.createElement("span", {
										style: { flex: "none", opacity: ".6", maxWidth: "38%", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
										title: job.detail || job.status
									}, job.detail || job.status),
									React.createElement("span", { style: { flex: "none", opacity: ".6", fontVariantNumeric: "tabular-nums" } },
										mfxDuration(elapsed))));
							})(jobs[jbi]);
						}
					}
					sheet = createPortalFn(React.createElement(React.Fragment, null,
						React.createElement("div", {
							key: "mfx-sheet-backdrop",
							onClick: closeSheet,
							style: { position: "fixed", inset: "0", zIndex: MFX_SHEET_Z - 1, background: "rgba(0,0,0,.25)" }
						}),
						React.createElement("div", {
							key: "mfx-sheet",
							role: "dialog",
							"aria-modal": "true",
							"aria-label": mfxT("会话、子代理与后台任务", "會話、子代理與背景任務", "Sessions, subagents and background jobs"),
							style: {
								position: "fixed", left: "10px", right: "10px", top: top + "px",
								maxHeight: "calc(100vh - " + (top + 12) + "px)", zIndex: MFX_SHEET_Z,
								overflowY: "auto", overscrollBehavior: "contain",
								borderRadius: "14px", border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,140,.35))",
								background: "var(--dsw-specific-menu, #23252b)",
								color: "var(--dsw-alias-label-primary, #e6e6e9)",
								boxShadow: "0 12px 40px rgba(0,0,0,.4)"
							}
						},
							React.createElement("div", {
								style: {
									display: "flex", alignItems: "center", gap: "8px",
									padding: "10px 10px 6px 14px", position: "sticky", top: "0",
									background: "inherit", borderBottom: "1px solid rgba(128,128,140,.2)"
								}
							},
								React.createElement("span", {
									style: { flex: "1 1 auto", minWidth: "0", fontWeight: 600, fontSize: "13px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }
								}, currentTitle),
								rootStats.running > 0 ? mfxDot(MFX_RUNNING, true) : null,
								React.createElement("button", {
									type: "button", onClick: closeSheet,
									"aria-label": mfxT("关闭", "關閉", "Close"),
									style: { flex: "none", width: "30px", height: "30px", display: "grid", placeItems: "center", border: "none", borderRadius: "8px", background: "transparent", color: "inherit", cursor: "pointer" }
								}, mfxCloseIcon())),
							body)), document.body);
				}

				return React.createElement(React.Fragment, null,
					React.createElement("div", {
						"data-mfx-collector": "1",
						style: { flex: "1 1 auto", minWidth: 0, display: "flex" }
					},
						React.createElement("button", {
							ref: pillRef,
							type: "button",
							onClick: openSheet,
							"aria-expanded": open,
							"aria-label": mfxT("查看会话层级、子代理与后台任务", "檢視會話層級、子代理與背景任務", "View the session lineage, subagents and background jobs"),
							style: {
								flex: "1 1 auto", minWidth: 0, display: "flex", alignItems: "center",
								gap: "8px", height: "30px", padding: "0 10px", borderRadius: "9px",
								border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,140,.35))",
								background: "transparent", color: "inherit", cursor: "pointer", fontSize: "12px"
							}
						},
							mfxBurger(),
							React.createElement("span", {
								style: {
									flex: "1 1 auto", minWidth: 0, overflow: "hidden",
									whiteSpace: "nowrap", textOverflow: "ellipsis",
									textAlign: "left", fontWeight: 500, fontSize: "13px"
								}
							}, currentTitle),
							rootStats.count > 0 ? mfxBadge(mfxT(String(rootStats.count) + " 个代理", String(rootStats.count) + " 個代理", rootStats.count + " agents"), rootStats.running > 0 ? MFX_RUNNING : null) : null,
							jobs.length > 0 ? mfxBadge(liveJobs > 0
								? mfxT(String(liveJobs) + " 个任务", String(liveJobs) + " 個任務", liveJobs + " jobs")
								: mfxT(String(jobs.length) + " 个任务", String(jobs.length) + " 個任務", jobs.length + " jobs"), liveJobs > 0 ? MFX_RUNNING : null) : null)),
					sheet);
			}

			ctx.slots.inject("conversation.session.header.actions", function () {
				return ctx.slots.register({
					name: "conversation.session.header.actions",
					id: "mfx-header-collector",
					// the pill replaces the whole header row on phones; on
					// desktops it renders null and the host chips stay
					order: -20,
					label: function () { return mfxT("顶部收纳", "頂部收納", "Header collector"); }
				}, CollectorPill);
			});
		}

		// ---------- 14. list render throttle ----------
		// The host's session control stream pushes one whole-value frame per
		// projection change of EVERY attached session to EVERY client. One
		// projection (subagentTiming) re-objects on every committed event
		// while a subagent turn is active, so a fleet of running agents
		// emits a continuous 50-150 frames/s — and each frame marks the
		// session LIST notifier dirty, whose rebuild walks every summary
		// (2400+ here) plus an O(n^2) entry-cache sweep. Measured on this
		// deployment: ~90% of main-thread time in buildListSnapshot while
		// background sessions streamed; a phone needed a page reload.
		//
		// The wrap changes only WHEN the list re-renders, never WHAT it
		// renders: projection frames keep landing in the per-session stores
		// immediately (seq-ordered, whole-value, nothing lost), queue and
		// per-session notifiers stay untouched (steering rows and the open
		// conversation still update instantly), and the list notifier's
		// dirty mark is coalesced onto a trailing timer. The interval
		// adapts to the measured cost of the rebuild itself (5x, clamped
		// to [150ms, 1s]) so a big session history can never outrun the
		// device: the rebuild stays at most ~20% duty cycle.
		var listThrottleStats = { coalesced: 0, flushes: 0, intervalMs: 200, rebuildEmaMs: 0 };
		if (flag("listthrottle", true)) {
			try {
				var svcLT = ctx.sessions;
				var managerLT = svcLT && svcLT.manager ? svcLT.manager
					: (svcLT && typeof svcLT.refreshList === "function" ? svcLT : null);
				var notifierLT = managerLT && managerLT.notifier
					&& typeof managerLT.notifier.markDirty === "function"
					? managerLT.notifier : null;
				if (notifierLT !== null && !notifierLT.__mfxListThrottle) {
					notifierLT.__mfxListThrottle = true;
					var origMarkDirty = notifierLT.markDirty.bind(notifierLT);
					var LT_MIN_MS = 150, LT_MAX_MS = 1000;
					var ltInterval = 200;
					var ltPending = false, ltTimer = null;
					var ltFlush = function () {
						ltTimer = null;
						if (!ltPending) return;
						ltPending = false;
						listThrottleStats.flushes++;
						origMarkDirty();
					};
					// The dirty bit goes down IMMEDIATELY, the notify is what
					// coalesces. The manager's list snapshot is a cache whose
					// only refresh path is notifier.rebuild, and list
					// mutations (recordMutation) write this.summaries
					// directly: a fork's synchronous-addressability contract
					// reads getListSnapshot() a microtask after the mutation,
					// gated by ensureFresh()'s dirty check. Deferring the bit
					// would serve that read a stale cache and break fork and
					// create; deferring only origMarkDirty (the subscriber
					// notify + flush) keeps the 150fps render storm coalesced
					// while on-demand reads keep rebuilding synchronously —
					// and a read-rebuilt cache (ensureFresh clears the bit)
					// still notifies on the trailing timer, which re-marks
					// dirty before its microtask flush.
					notifierLT.markDirty = function () {
						notifierLT.dirty = true;
						if (ltPending) { listThrottleStats.coalesced++; return; }
						ltPending = true;
						if (ltTimer !== null) return;
						ltTimer = setTimeout(ltFlush, ltInterval);
					};
					// Adapt the interval to the real rebuild cost: the
					// manager's notifier rebuilds the list snapshot, so
					// timing that callback measures exactly the work each
					// flush buys. An EMA keeps one outlier rebuild from
					// spiking the interval; reads of a clean cache cost ~0
					// and pull it back down.
					if (typeof notifierLT.rebuild === "function" && !notifierLT.__mfxListTimed) {
						notifierLT.__mfxListTimed = true;
						var origRebuild = notifierLT.rebuild;
						notifierLT.rebuild = function () {
							var t0 = Date.now();
							var out = origRebuild.apply(this, arguments);
							var cost = Date.now() - t0;
							listThrottleStats.rebuildEmaMs = listThrottleStats.rebuildEmaMs === 0
								? cost
								: listThrottleStats.rebuildEmaMs * 0.7 + cost * 0.3;
							var next = Math.min(LT_MAX_MS, Math.max(LT_MIN_MS, Math.ceil(listThrottleStats.rebuildEmaMs * 5)));
							if (next !== ltInterval) {
								ltInterval = next;
								listThrottleStats.intervalMs = next;
							}
							return out;
						};
					}
					window.__mfxListThrottleDebug = function () {
						return JSON.parse(JSON.stringify(listThrottleStats));
					};
				}
			} catch (e) {}
		}
	}
	return { name: PLUGIN_ID, inject: inject, apply: apply };
}});
