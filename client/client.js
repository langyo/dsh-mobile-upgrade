window.__ModuleLoader__.load({ id: "dsh-mobile-upgrade", factory: (require) => {
	var React = require("react");
	var inject = ["slots", "sessions"];

	// Identity shared with the host half: the settings section key and the
	// route prefix both derive from the package name, so the two halves can
	// only ever name this plugin in one way.
	var PLUGIN_ID = "dsh-mobile-upgrade";
	var ROUTE_PREFIX = "/plugins/" + PLUGIN_ID;

	// The build this bundle is. Kept in step with package.json by
	// scripts/check-manifest.mjs, and surfaced in the settings row plus the
	// self-update banner below so a device can always say what it runs.
	var BUILD = "0.8.1";

	// Everything this plugin renders lives inside native host slots — no
	// fixed-position body elements, no CSS overrides, no DOM polling.
	//
	//   1. settings extras: ⟳ restart row in the General tab, and the
	//      models/providers editor in the Models tab (localized labels).
	//   2. narrow-screen settle: the fullscreen tool-details overlay — whose
	//      close button is inert upstream — is not rendered on narrow screens.
//   3. narrow drawer: the collapsed rail keeps only the whale toggle;
//      the expanded sidebar floats above full-width content as a drawer
//      (the whale is the host's own toggle, hHd-Xa_collapsed is the state).
//      The takeover flips atomically — no geometry transition to freeze on a
//      busy main thread — and a tap that closes it moves the geometry in the
//      same frame instead of waiting for the host's re-render.
//   4. narrow settings: the dialog's side nav becomes horizontal top tabs.
//   5. narrow model menu: the composer's model menu lands full-width.
//   6. network chip: a slot chip next to the composer controls surfaces /api/
//      requests that hang or fail; tapping it probes the service's ping
//      route to tell a slow route from a deadlocked host.
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
//      the document-wide observers run at a capped leading+trailing rate,
//      the settings poller backs off while the host is unreachable, and a
//      rail remount keeps the drawer state for a grace period instead of
//      flapping the drawer — no per-mutation layout work, no frozen input,
//      no white-flashing sidebar. A host state that does not survive the
//      settle window is ignored entirely, so a remount's transient
//      collapsed/expanded frame cannot move the takeover, and drawer close
//      taps (the whale, the scrim, a session row) collapse it on the spot and
//      then chase the host's toggle only if its own state has not followed.
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
//
// Optional features are toggled with localStorage keys (value "0" = off):
//   mfx-restart  (default on) — the ⟳ restart button
//   mfx-settle   (default on) — the details-overlay settle
//   mfx-drawer   (default on) — the whale-only rail + overlay drawer
//   mfx-settings (default on) — the settings top-tabs layout
//   mfx-modality (default on) — the provider-edit input-modality switches
//   mfx-menus    (default on) — the model menu spanning the phone width
//   mfx-net      (default on) — the stuck-request network chip
//   mfx-questions (default on) — the capped, scrollable question region
//   mfx-selfupdate (default on) — reload the page when the plugin is upgraded
//   mfx-agents   (default on) — the catalog-refresh guard + click-to-open chips
//   mfx-header   (default on) — the narrow-header collector pill + sheet
//   mfx-listthrottle (default on) — the session-list render throttle
// Without a localStorage override, this plugin's own settings section decides
// the per-feature toggles (they take effect on next load).
var namespaceFlags = null;
var namespaceRevision;
var sectionListeners = [];
var loadNamespaceFlags = function () {};
var NAMESPACE_FLAG_KEYS = {
	restart: "restartEnabled",
	settle: "settleEnabled",
	drawer: "drawerEnabled",
	settings: "settingsTabsEnabled",
	modality: "modalityEnabled",
	menus: "menusEnabled",
	net: "netEnabled",
	questions: "questionsEnabled",
	selfupdate: "selfUpdateEnabled",
	agents: "agentsEnabled",
	header: "headerEnabled",
	listthrottle: "listThrottleEnabled"
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
	function apply(ctx, config) {
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
			describe.then(function (res) {
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
		nsPoll();
		// Leading+trailing throttle shared by the document-wide observers
		// below: the first call in a quiet period runs at once so taps stay
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
		// ---------- 1. details-overlay suppression on narrow screens ----------
		// On narrow viewports the tool-details panel becomes a fullscreen
		// overlay with a close button that does nothing (tried: programmatic
		// click, trusted click, Escape, outside taps) — the panel traps the
		// chat behind it. The host offers no sanctioned close (ctx.layout is
		// empty), so until upstream ships a working close, the overlay is
		// simply not rendered on narrow screens.
		if (flag("settle", true)) {
			var dstyle2 = document.createElement("style");
			dstyle2.id = "mfx-settle-style";
			dstyle2.textContent = [
				"@media (max-width: 1023px) {",
				"  [class*=\"_2ctAZa_root\"] { display: none !important; }",
				"}"
			].join("\n");
			document.head.appendChild(dstyle2);
		}

		// ---------- shared toast (used by the network chip below) ----------
		var toastEl = null;
		function toast(text) {
			if (!toastEl) {
				toastEl = document.createElement("div");
				toastEl.style.cssText = "position:fixed;left:50%;bottom:88px;transform:translateX(-50%);" +
					"z-index:90;font-size:12px;color:#eee;background:rgba(20,20,24,.88);" +
					"padding:5px 12px;border-radius:8px;max-width:76vw;white-space:nowrap;" +
					"overflow:hidden;text-overflow:ellipsis;pointer-events:none";
				document.body.appendChild(toastEl);
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
					var base = (navigator.language || "en").toLowerCase().indexOf("zh") === 0 ? "重启服务" : "Restart service";
					return base + " · v" + BUILD;
				} catch (e) { return "Restart service"; }
			}
			function restartConfirm() {
				try {
					return (navigator.language || "en").toLowerCase().indexOf("zh") === 0
						? "重启 dsh 服务？页面将在服务恢复后自动刷新。"
						: "Restart the dsh service? The page reloads once it is back.";
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
		// ---------- 3b. multimodal switches inside the native provider edit form ----------
		// Appends an input-modality switch group (text/image/video) to every
		// model row of the native provider editor; toggles write the model's
		// input array through the plugin route (provider + model id), which
		// edits settings.yaml with a backup. The host form's own save issues
		// minimal path ops and never touches the input field.
		if (flag("modality", true)) {
			var effectiveModels = null;
			function findEffectiveModels(node, route, depth) {
				if (!node || typeof node !== "object" || depth > 6) return null;
				if (Array.isArray(node)) {
					for (var i = 0; i < node.length; i++) {
						var r = findEffectiveModels(node[i], route, depth + 1);
						if (r) return r;
					}
					return null;
				}
				var ident = node.name ?? node.key ?? node.id ?? node.route;
				if ((ident === route || (typeof ident === "string" && ident.indexOf(route) !== -1)) && Array.isArray(node.models)) return node.models;
				var keys = Object.keys(node);
				for (var j = 0; j < keys.length; j++) {
					var r2 = findEffectiveModels(node[keys[j]], route, depth + 1);
					if (r2) return r2;
				}
				return null;
			}
			function loadEffectiveModalities(route) {
				try {
					if (!ctx.remote || !ctx.remote.llm || !ctx.remote.llm.listProviders) return Promise.resolve();
					return Promise.resolve(ctx.remote.llm.listProviders()).then(function (res) {
						var value = res && res.value !== undefined ? res.value : res;
						effectiveModels = value;
						ensureModalitySwitches();
					}).catch(function () {});
				} catch (e) { return Promise.resolve(); }
			}
			function effectiveModelInput(route, modelId) {
				if (!effectiveModels) return null;
				var models = findEffectiveModels(effectiveModels, route, 0);
				if (!models) return null;
				var m = models.find(function (x) { return x && x.id === modelId; });
				return m && Array.isArray(m.input) ? m.input : null;
			}
			function mfxEl(tag, cssText, text) {
				var el = document.createElement(tag);
				if (cssText) el.style.cssText = cssText;
				if (text !== undefined) el.textContent = text;
				return el;
			}
			function T(zh, en) {
				try { return (navigator.language || "en").toLowerCase().indexOf("zh") === 0 ? zh : en; }
				catch (e) { return en; }
			}
			var modalityCache = null;
			var modalityRoute = null;

			function currentModelInput(route, modelId) {
				if (!modalityCache || !modalityCache[route]) return null;
				var section = modalityCache[route];
				var fromList = (section.models ?? []).find(function (x) { return x && x.id === modelId; });
				if (fromList && Array.isArray(fromList.input)) return fromList.input;
				var overrides = section.modelOverrides;
				if (overrides && overrides[modelId] && Array.isArray(overrides[modelId].input)) return overrides[modelId].input;
				return null;
			}

			var ensureModalitySwitches = function () {
				try {
					var panel = document.querySelector('[class*="VOzbGW_panel"]');
					if (!panel) return;
					var routeEl = panel.querySelector('[class*="zGbnIq_editorRoute"]');
					var route = routeEl ? routeEl.textContent.trim() : null;
					if (!route) return;
					if (route !== modalityRoute || !modalityCache) {
						// (re)load the on-disk state for this route
						modalityRoute = route;
						fetch(ROUTE_PREFIX + "/llm-config", { cache: "no-store" })
							.then(function (r) { return r.json(); })
							.then(function (d) {
								if (d.ok) { modalityCache = d.providers ?? {}; ensureModalitySwitches(); }
							})
							.catch(function () {});
						loadEffectiveModalities(route);
						return;
					}
					if (!effectiveModels) { loadEffectiveModalities(route); return; }
					var entries = panel.querySelectorAll('[class*="zGbnIq_modelEntry"]');
					Array.prototype.forEach.call(entries, function (entry) {
						var existing = entry.querySelector(".mfx-modality");
						if (existing) {
							// late config arrival: re-sync toggle states from disk
							if (modalityCache && modalityCache[route]) {
								var mid = (entry.querySelector("input") || {}).value || "";
								var cur = currentModelInput(route, mid) ?? [];
								entry.querySelectorAll("input[data-mod]").forEach(function (cb) {
									if (cb._busy) return;
									var want = cur.indexOf(cb.getAttribute("data-mod")) !== -1;
									if (cb.checked !== want) cb.checked = want;
								});
							}
							return;
						}
						var idInput = entry.querySelector('input');
						var modelId = idInput ? idInput.value.trim() : "";
						var known = false;
						if (modelId && modalityCache && modalityCache[route] &&
							Array.isArray(modalityCache[route].models)) {
							// only user-customised routes are patchable; catalog models
							// keep their declared modalities (read-only display)
							known = modalityCache[route].models.some(function (x) { return x && x.id === modelId; });
						}
						var bar = mfxEl("div", "display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:6px 0 2px;padding:0 2px;font-size:12px;color:var(--dsw-alias-label-secondary);");
						bar.className = "mfx-modality";
						bar.appendChild(mfxEl("span", "font-size:12px;opacity:.75;flex:none;", T("输入模态", "Input")));
						var current = effectiveModelInput(route, modelId)
							?? currentModelInput(route, modelId)
							?? ["text"];
						["text", "image", "video"].forEach(function (mod) {
							var lb = mfxEl("label", "display:flex;align-items:center;gap:4px;cursor:pointer;flex:none;color:var(--dsw-alias-label-primary);");
							lb.title = known ? "" : T("表单保存后生效", "Takes effect after the form is saved");
							var cb = mfxEl("input");
							cb.style.cssText = "accent-color:var(--dsw-alias-brand-primary);width:14px;height:14px;margin:0;cursor:pointer;";
							cb.type = "checkbox";
							cb.checked = known && current.indexOf(mod) !== -1;
							cb.disabled = !known;
							cb.addEventListener("change", function () {
								var input = ["text", "image", "video"].filter(function (m) {
									return bar.querySelector('input[data-mod="' + m + '"]').checked;
								});
								cb._busy = true;
								fetch(ROUTE_PREFIX + "/model-input", {
									method: "POST",
									headers: { "content-type": "application/json" },
									body: JSON.stringify({ provider: route, modelId: modelId, input: input })
								})
								.then(function (r) { return r.json(); })
								.then(function (d) {
									cb._busy = false;
									if (!d.ok) bar.title = "✗ " + (d.error || "save failed");
								})
								.catch(function () { cb._busy = false; });
							});
							cb.setAttribute("data-mod", mod);
							lb.appendChild(cb);
							lb.appendChild(mfxEl("span", "", mod));
							bar.appendChild(lb);
						});
						entry.appendChild(bar);
					});
				} catch (e) {}
			};
			setInterval(ensureModalitySwitches, 900);
		}
		// ---------- 4. narrow drawer: the collapsed rail keeps only the whale;
		// the expanded sidebar floats above full-width content as a drawer ----------
		// The whale button is the host's own sidebar toggle (hHd-Xa_toggle);
		// hHd-Xa_collapsed on the rail root is the state signal.
		if (flag("drawer", true)) {
			// The narrow/desktop decision must use the same measure as the
			// drawer's own @media (max-width: 1023px) rules. window.innerWidth
			// counts a classic scrollbar that media widths exclude (and
			// fractional zoom can land between the two), so a desktop window
			// near 1024px could classify as desktop in the JS while the CSS
			// still styles it as mobile: the chip swallows the sidebar and
			// the expanded rail renders inside the closed chip with no
			// drawer-open class to rescue it. One shared query decides for
			// both sides, so the modes can no longer disagree.
			var desktopMQ = window.matchMedia("(min-width: 1024px)");
			var scrim = document.createElement("div");
			scrim.id = "mfx-scrim";
			// No click listener on the scrim itself: a tap on it is a trusted
			// click that the document handler below already reads as "close".
			// Wiring both was a real defect — two chases started from one tap,
			// their toggle clicks cancelled each other, the host's rail stayed
			// expanded and the mirror reopened the drawer once the intent
			// expired (measured: 12 clicks in 6 cancelling pairs, reopen at
			// 2.8s). One entry point, one chase.
			document.body.appendChild(scrim);


			var dstyle = document.createElement("style");
			dstyle.id = "mfx-drawer-style";
			dstyle.textContent = [
				"#mfx-scrim { position: fixed; inset: 0; z-index: 120; background: rgba(0,0,0,.32); display: none; }",
				"@media (max-width: 1023px) {",
				/* the content column always spans the full width — the rail never
				   reserves a grid track, not even when collapsed. Explicit
				   placement: the fixed-position chip leaves the grid flow, and
				   without pinning, auto-placement drops the center column into
				   the 0px first track (blank content) and the details column
				   into the full-width second track. */
				"  [class*=\"pI_x6G_frame\"] { grid-template-columns: 0px minmax(0,1fr) 0px !important; }",
				"  [class*=\"pI_x6G_frame\"] > [class*=\"pI_x6G_sidebarCol\"] { grid-column: 1; }",
				"  [class*=\"pI_x6G_frame\"] > [class*=\"pI_x6G_centerCol\"] { grid-column: 2; }",
				"  [class*=\"pI_x6G_frame\"] > [class*=\"pI_x6G_detailsCol\"] { grid-column: 3; }",
				/* the rail floats: an AssistiveTouch-style translucent circle when
				   collapsed, the full drawer when open. No filter/blur here — a
				   filter would turn the chip into the containing block for the
				   fixed-position settings dialog that portals inside the sidebar
				   subtree. The gray tint is visible on light and dark pages
				   alike, which a white tint never is.
				   No transition on the geometry either: the chip and the drawer
				   are two settled states, and animating between them is what the
				   phone report caught frozen halfway. A transition advances with
				   frames, so on a main thread busy with streaming sessions the
				   takeover paints at whatever offset the last rendered frame
				   reached — and because every mirror flip restarts it, the drawer
				   can sit at a half-expanded position for seconds. Flipping the
				   two states atomically costs a slide and buys a takeover that
				   is never in between. */
				"  [class*=\"pI_x6G_sidebarCol\"] { position: fixed; top: 10px; left: 10px; width: 56px;",
				"    height: 56px !important; z-index: 130; overflow: hidden;",
				"    box-shadow: 0 2px 14px rgba(0,0,0,.18); touch-action: none;",
				"    background: rgba(128,132,140,.28) !important; }",
				"  html:not(.mfx-drawer-open) [class*=\"pI_x6G_sidebarCol\"] { border-radius: 50% !important; }",
				"  [class*=\"hHd-Xa_root\"][class*=\"hHd-Xa_collapsed\"] { height: auto !important;",
				"    min-height: 0 !important; padding: 0 !important; }",
				/* the toggle fills the circle exactly: the host root carries its
				   own 18px top padding that pushed the whale below center, and
				   width/height 100% resolved against that padded box — anchor
				   the toggle to the chip itself instead */
				"  [class*=\"hHd-Xa_root\"][class*=\"hHd-Xa_collapsed\"] [class*=\"hHd-Xa_toggle\"]",
				"  { position: absolute !important; inset: 0 !important; width: 100% !important;",
				"    height: 100% !important; display: grid !important; place-items: center !important;",
				"    margin: 0 !important; padding: 0 !important; }",
				/* collapsed: hide everything except the whale toggle */
				"  [class*=\"hHd-Xa_root\"][class*=\"hHd-Xa_collapsed\"] [class*=\"hHd-Xa_newSession\"],",
				"  [class*=\"hHd-Xa_root\"][class*=\"hHd-Xa_collapsed\"] [class*=\"bhn1Oq_iconButton\"],",
				"  [class*=\"hHd-Xa_root\"][class*=\"hHd-Xa_collapsed\"] [class*=\"bhn1Oq_searchButton\"],",
				"  [class*=\"hHd-Xa_root\"][class*=\"hHd-Xa_collapsed\"] [data-slot=\"sidebar.footer.action\"],",
				"  [class*=\"hHd-Xa_root\"][class*=\"hHd-Xa_collapsed\"] [class*=\"VOzbGW_railRow\"] { display: none !important; }",
				/* expanded: the full drawer, always on the side the chip is
				   attached to; !important also neutralizes the inline
				   left/right/top the drag position stores */
				"  html.mfx-drawer-open [class*=\"pI_x6G_sidebarCol\"] { width: min(280px, 84vw); bottom: 0;",
				"    height: auto !important; top: 0 !important; left: 0 !important; right: auto !important;",
				"    border-radius: 0 !important; box-shadow: 0 0 44px rgba(0,0,0,.4);",
				"    background: none !important; -webkit-backdrop-filter: none; backdrop-filter: none; }",
				"  html.mfx-drawer-open.mfx-chip-right [class*=\"pI_x6G_sidebarCol\"] { left: auto !important; right: 0 !important; }",
				"  html.mfx-drawer-open #mfx-scrim { display: block; }",
				"}"
			].join("\n");
			document.head.appendChild(dstyle);

			var drawerOpen = null;
			// AssistiveTouch-style chip position: persisted attachment side and
			// vertical offset; the drawer opens on the attached side
			var chipSide = "left";
			var chipTop = 10;
			try {
				if (window.localStorage.getItem("mfx-chip-side") === "right") chipSide = "right";
				var savedTop = parseInt(window.localStorage.getItem("mfx-chip-top"), 10);
				if (!isNaN(savedTop)) chipTop = savedTop;
			} catch (e) {}
			function clampChipTop(t) {
				return Math.max(10, Math.min(window.innerHeight - 66, t));
			}
			// Applied chip geometry, so the writes below can be skipped when
			// nothing moved: this runs on every throttled observer pass and every
			// 800ms tick, and each write invalidates style for a fixed element
			// that floats over the whole page — during a storm that is pure
			// overhead for a value that has not changed.
			var chipApplied = { el: undefined, side: null, edge: null, top: null, desktop: null };
			function applyChipPos() {
				var chip = document.querySelector('[class*="pI_x6G_sidebarCol"]');
				if (chipApplied.el !== chip) {
					// a remount hands over a fresh element with no inline geometry
					chipApplied.el = chip;
					chipApplied.edge = null;
					chipApplied.top = null;
				}
				if (desktopMQ.matches) {
					// desktop: back to a plain grid column. A drag interrupted
					// by a remount can leave a stale moved flag that would
					// swallow the first click on the restored sidebar — clear
					// both the inline position and the flag on the way back.
					if (chipApplied.desktop !== true) {
						chipApplied.desktop = true;
						if (chip) { chip.style.left = ""; chip.style.right = ""; chip.style.top = ""; }
						document.documentElement.classList.remove("mfx-chip-right");
						chipApplied.side = null;
						chipApplied.edge = null;
						chipApplied.top = null;
					}
					chipDrag.active = false;
					chipDrag.moved = false;
					return;
				}
				chipApplied.desktop = false;
				chipTop = clampChipTop(chipTop);
				if (chipApplied.side !== chipSide) {
					chipApplied.side = chipSide;
					document.documentElement.classList.toggle("mfx-chip-right", chipSide === "right");
				}
				if (!chip) return;
				if (chipApplied.edge !== chipSide) {
					chipApplied.edge = chipSide;
					if (chipSide === "right") { chip.style.left = "auto"; chip.style.right = "10px"; }
					else { chip.style.right = "auto"; chip.style.left = "10px"; }
				}
				if (chipApplied.top !== chipTop) {
					chipApplied.top = chipTop;
					chip.style.top = chipTop + "px";
				}
			}
			var chipDrag = { active: false, moved: false, x: 0, y: 0, l: 0, t: 0, w: 56, curL: 10, curT: 10 };
			document.addEventListener("pointerdown", function (ev) {
				if (desktopMQ.matches) return;
				if (document.documentElement.classList.contains("mfx-drawer-open")) return;
				var chip = ev.target && ev.target.closest ? ev.target.closest('[class*="pI_x6G_sidebarCol"]') : null;
				if (!chip) return;
				chipDrag.active = true;
				chipDrag.moved = false;
				chipDrag.x = ev.clientX;
				chipDrag.y = ev.clientY;
				var r = chip.getBoundingClientRect();
				chipDrag.l = r.left;
				chipDrag.t = r.top;
				chipDrag.w = r.width;
				chipDrag.curL = r.left;
				chipDrag.curT = r.top;
				// no transition to suspend: the geometry flips atomically, so a
				// drag only writes the position it is already painting
			}, true);
			document.addEventListener("pointermove", function (ev) {
				if (!chipDrag.active) return;
				var dx = ev.clientX - chipDrag.x;
				var dy = ev.clientY - chipDrag.y;
				var chip = document.querySelector('[class*="pI_x6G_sidebarCol"]');
				if (!chip) return;
				if (!chipDrag.moved && Math.abs(dx) + Math.abs(dy) > 8) {
					// capture only once a real drag starts: capturing on
					// pointerdown would retarget the later click to the chip
					// and the host's toggle would never see the tap
					chipDrag.moved = true;
					try { chip.setPointerCapture(ev.pointerId); } catch (e) {}
				}
				if (!chipDrag.moved) return;
				chipDrag.curL = Math.max(8, Math.min(window.innerWidth - chipDrag.w - 8, chipDrag.l + dx));
				chipDrag.curT = clampChipTop(chipDrag.t + dy);
				// the drag writes the position itself, so the applied-geometry
				// cache no longer describes the element: invalidate the edge so
				// the release still snaps the chip back to its side
				chipApplied.edge = null;
				chip.style.right = "auto";
				chip.style.left = chipDrag.curL + "px";
				chip.style.top = chipDrag.curT + "px";
			}, true);
			document.addEventListener("pointerup", function (ev) {
				if (!chipDrag.active) return;
				chipDrag.active = false;
				var chip = document.querySelector('[class*="pI_x6G_sidebarCol"]');
				if (!chipDrag.moved) return;
				chipSide = chipDrag.curL + chipDrag.w / 2 < window.innerWidth / 2 ? "left" : "right";
				chipTop = chipDrag.curT;
				try {
					window.localStorage.setItem("mfx-chip-side", chipSide);
					window.localStorage.setItem("mfx-chip-top", String(chipTop));
				} catch (e) {}
				// the edge snap is instant now (no transition), so there is no
				// reflow to flush and no animation to catch mid-flight
				applyChipPos();
			}, true);
			document.addEventListener("click", function (ev) {
				if (!chipDrag.moved) return;
				if (ev.target && ev.target.closest && ev.target.closest('[class*="pI_x6G_sidebarCol"]')) {
					// a drag must not flip the drawer on release
					ev.stopPropagation();
					ev.preventDefault();
					chipDrag.moved = false;
				}
			}, true);
			// A reconnect resync unmounts and remounts the rail root for a few
			// frames at a time, and the host re-renders it constantly while
			// sessions stream. That churn used to be mirrored, and two attempts
			// to be clever about it (a settle window before obeying, and clicking
			// the host's toggle to bring it along) produced exactly the two phone
			// reports this block exists to prevent: the drawer closing under a tap
			// that had nothing to do with closing it, and the drawer appearing by
			// itself while the user was typing — a click sent to "help" flipped
			// the host's rail and the mirror obeyed the flip.
			//
			// So the takeover's state is the user's, full stop:
			//
			//   * the host's rail class is read ONCE, to start in whatever state
			//     the host is in, and never again decides anything;
			//   * the whale is the host's own button — tapping it flips the host
			//     and this plugin together, which is why the plugin reads the
			//     state it can see rather than the host's class;
			//   * the scrim and a session row are ours — closing through them asks
			//     the host to collapse exactly once, and if that click is swallowed
			//     the takeover stays closed anyway, because a closed takeover hides
			//     the rail inside the 56px chip and the host being open underneath
			//     costs nothing.
			var railLastSeen = 0;
			var RAIL_GRACE_MS = 600;
			var initialized = false;
			var drawerStart = Date.now();
			var pendingOpen = false;
			var hostAskedOnce = false;
			function railRoot() {
				try { return document.querySelector('[class*="hHd-Xa_root"]'); } catch (e) { return null; }
			}
			function railCollapsed() {
				var rail = railRoot();
				if (!rail) return null;
				return String(rail.className).indexOf("hHd-Xa_collapsed") !== -1;
			}
			function setDrawer(open) {
				drawerOpen = open;
				document.documentElement.classList.toggle("mfx-drawer-open", open);
				if (open) pendingOpen = false;
			}
			// No rescue look any more. An earlier version painted the collapsed
			// rail's own look inside the chip while the host caught up; the rules
			// it needed (pin the whale, drop the rail's chrome) turned the whole
			// takeover into one giant stretched whale whenever the host was slow
			// to answer, and it could sit there for as long as the host took —
			// the frozen panel in the phone screenshot. A chip showing a 56px
			// crop for a few hundred ms is a far smaller price.
			function observeDrawer() {
				var rail = railRoot();
				if (rail) railLastSeen = Date.now();
				var collapsed = railCollapsed();
				if (!initialized) {
					if (collapsed === null) {
						// the rail is not mounted yet: wait for it rather than
						// guessing the takeover's first state
						if (Date.now() - drawerStart < 4000) return;
						collapsed = true;
					}
					initialized = true;
					setDrawer(collapsed === false);
					return;
				}
				if (!drawerOpen && collapsed === true && hostAskedOnce) hostAskedOnce = false;
				if (!drawerOpen && pendingOpen && collapsed === false) {
					// the whale was tapped and the host has now laid its rail out:
					// this is that open landing, whenever it arrives. No time
					// window — a busy phone can take seconds, and a window that
					// expired first left the drawer shut with no way to tell.
					setDrawer(true);
					return;
				}
				// The host sitting open under a closed takeover is harmless (the
				// chip clips it) and must NOT reopen the takeover.
			}
			// Closing is ours: the geometry moves in the tap's own task, the chip
			// gets the collapsed rail's look while the host catches up, and the
			// host's own toggle is clicked at most once per close gesture — never
			// on a timer, never twice, so it can never toggle the host back.
			function collapseDrawer(hostAlreadyToggling) {
				pendingOpen = false;
				setDrawer(false);
				if (railCollapsed() === false && !hostAskedOnce) {
					hostAskedOnce = true;
					var delay = hostAlreadyToggling ? 600 : 250;
					setTimeout(function () {
						if (railCollapsed() !== false) return;
						var t = document.querySelector('[class*="hHd-Xa_toggle"]');
						if (t) t.click();
					}, delay);
				}
			}
			var syncDrawer = function () {
				try {
					applyChipPos();
					if (desktopMQ.matches) {
						// desktop: the sidebar is a regular grid column, never a drawer
						if (drawerOpen !== false) setDrawer(false);
						return;
					}
					observeDrawer();
				} catch (e) {}
			};
			// Every streaming token mutates the document, so in a multi-session
			// storm this observer fires per token and each run costs full-
			// document queries — a class flip restyles the entire page. Cap the
			// reaction at a leading+trailing 200ms: taps still sync instantly
			// through the click handler below, the storm collapses into at
			// most five runs per second.
			var syncDrawerThrottled = mfxThrottle(syncDrawer, 200);
			setInterval(syncDrawer, 800);
			window.addEventListener("resize", syncDrawerThrottled);
			syncDrawer();
			// instant sync + overlay manners, attached to the document: the
			// sidebar column is not mounted yet when the plugin applies, and
			// the host remounts the rail root on toggle (hence childList)
			try {
				new MutationObserver(syncDrawerThrottled).observe(document.documentElement,
					{ subtree: true, attributes: true, attributeFilter: ["class"], childList: true });
			} catch (e) {}
			document.addEventListener("click", function (ev) {
				setTimeout(syncDrawer, 0);
				try {
					// Only a real tap drives the takeover's own state. The chase
					// below clicks the host's toggle itself, and a synthetic click
					// must not read as a second tap: it would re-enter this
					// handler, restart the chase while the first one is still
					// running, and the two would toggle the rail back and forth
					// forever (measured: the scrim close left the host's rail
					// expanded with the chase clicking every few hundred ms).
					if (!ev.isTrusted) return;
					var target = ev.target;
					var onToggle = target && target.closest && target.closest('[class*="hHd-Xa_toggle"]');
					// The whale both opens and closes. The open is the host's
					// own: this click already toggled its rail, so the takeover
					// takes the geometry as soon as the host has the content for
					// it (see observeDrawer, which the rail's own class watch
					// drives). The close is ours, on the spot.
					if (onToggle && !desktopMQ.matches) {
						if (drawerOpen) {
							collapseDrawer(true);
						} else {
							// The host flips its rail on this same click; the
							// geometry waits for that commit so the panel never
							// opens over a rail that is still the chip. Its class
							// watch calls back within a frame — or seconds later,
							// if the phone is busy with streaming sessions, and
							// that is fine: the open lands whenever it lands.
							pendingOpen = true;
						}
						return;
					}
					if (!document.documentElement.classList.contains("mfx-drawer-open")) return;
					if (document.querySelector('[class*="VOzbGW_overlay"]')) return;
					// Two taps close the takeover, and only two:
					//   * the scrim — our own element, the only thing that
					//     really is "outside";
					//   * a session row's own body, which is the user opening a
					//     session.
					// Everything else leaves the drawer standing: a control
					// nested in a row, the row's ⋯ menu, "Show N more sessions",
					// unfolding a workspace, the search box, the sidebar's own
					// menu trigger — and every popup the host portals out to the
					// document body, which is what made an earlier "anything
					// outside the sidebar column closes it" reading fold the
					// drawer out from under the user on almost every control
					// they touched.
					var onScrim = !!(target && (target.id === "mfx-scrim"
						|| (target.closest && target.closest("#mfx-scrim"))));
					var row = target && target.closest ? target.closest('[class*="sessionRow"]') : null;
					var control = target && target.closest
						? target.closest('button, [role="button"], input, select, textarea') : null;
					// a control inside the row is the row's own affordance, not a
					// session pick
					var picksSession = !!row && (!control || control === row);
					if (onScrim || picksSession) collapseDrawer(false);
				} catch (e) {}
			}, true);
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
					banner.textContent = "插件已更新到 v" + BUILD + " · 点此刷新";
					banner.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:96px;" +
						"z-index:200;max-width:88vw;padding:10px 16px;border:none;border-radius:12px;" +
						"font-size:13px;line-height:18px;color:#fff;background:#3355dd;" +
						"box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:pointer";
					banner.addEventListener("click", function () { reloading = true; location.reload(); });
					document.body.appendChild(banner);
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

		// ---------- 5. settings dialog: the side nav becomes top tabs on narrow screens ----------
		if (flag("settings", true)) {
			var sstyle = document.createElement("style");
			sstyle.id = "mfx-settings-style";
			sstyle.textContent = [
				"@media (max-width: 700px) {",
				"  [class*=\"VOzbGW_panel\"] { display: flex !important; flex-direction: column !important;",
				"    position: relative !important; }",
				"  [class*=\"VOzbGW_panel\"] [class*=\"VOzbGW_close\"] { position: absolute !important;",
				"    top: 16px !important; right: 12px !important; }",
				/* the content header (actions + close) collapses once the close
				   lives beside the title — no dead gap under the tab row */
				"  [class*=\"VOzbGW_panel\"] [class*=\"VOzbGW_header\"] { min-height: 0 !important;",
				"    height: auto !important; padding: 0 !important; margin: 0 !important; }",
				"  [class*=\"VOzbGW_panel\"] [class*=\"VOzbGW_nav\"] { display: block !important; width: 100% !important;",
				"    flex: none !important; padding-bottom: 8px !important; }",
				"  [class*=\"VOzbGW_panel\"] [class*=\"VOzbGW_navList\"] { display: flex !important;",
				"    flex-direction: row !important; width: 100% !important;",
				"    overflow-x: auto !important; gap: 6px !important; padding: 2px 4px !important; }",
				"  [class*=\"VOzbGW_panel\"] [class*=\"VOzbGW_navCell\"] { display: flex !important;",
				"    flex-direction: row !important; align-items: center !important; width: auto !important;",
				"    flex: none !important; white-space: nowrap !important; }",
				"  [class*=\"VOzbGW_panel\"] [class*=\"VOzbGW_navLabel\"] { display: inline-block !important;",
				"    width: auto !important; max-width: none !important; overflow: visible !important;",
				"    padding: 0 !important; }",
				"  [class*=\"VOzbGW_panel\"] [class*=\"VOzbGW_navCell\"] svg { flex: none !important;",
				"    width: 16px !important; height: 16px !important; border: none !important;",
				"    padding: 0 !important; }",
				/* kill the host's stray column-mode indicator lines under the labels */
				"  [class*=\"VOzbGW_panel\"] [class*=\"VOzbGW_navCell\"]::before,",
				"  [class*=\"VOzbGW_panel\"] [class*=\"VOzbGW_navCell\"]::after,",
				"  [class*=\"VOzbGW_panel\"] [class*=\"VOzbGW_navLabel\"]::before,",
				"  [class*=\"VOzbGW_panel\"] [class*=\"VOzbGW_navLabel\"]::after { content: none !important;",
				"    display: none !important; }",
				"  [class*=\"VOzbGW_panel\"] [class*=\"VOzbGW_navLabel\"] { border: none !important;",
				"    box-shadow: none !important; text-decoration: none !important; }",
				/* uniform pill look; the active cell keeps the host's gray fill */
				"  [class*=\"VOzbGW_panel\"] [class*=\"VOzbGW_navCell\"] { border-radius: 10px !important;",
				"    border: 1px solid rgba(128,128,128,.30) !important; padding: 8px 14px !important; }",
				"  [class*=\"VOzbGW_panel\"] [class*=\"VOzbGW_navCell\"]:not([class*=\"VOzbGW_active\"])",
				"  { background: transparent !important; }",
				"  [class*=\"VOzbGW_panel\"] [class*=\"VOzbGW_navList\"] { scrollbar-width: none !important; }",
				"  [class*=\"VOzbGW_panel\"] [class*=\"VOzbGW_navList\"]::-webkit-scrollbar",
				"  { display: none !important; }",
				"  [class*=\"VOzbGW_panel\"] [class*=\"VOzbGW_content\"] { flex: 1 1 auto !important; width: 100% !important;",
				"    min-height: 0 !important; overflow-y: auto !important; padding-top: 0 !important; }",
				"}"
			].join("\n");
			document.head.appendChild(sstyle);
		}

		// ---------- 6. narrow model menu: the menu lands full-width on phones ----------
		// The host pins the two-level composer model menu (ModelSelect) to its
		// trigger with right:0 + width:max-content, so on a phone the box lands
		// past the left viewport edge and clips the model names. On narrow
		// screens the menu is re-anchored in viewport coordinates — exactly the
		// phone width minus margins — while the host keeps owning the vertical
		// placement (absolute above the trigger, so the keyboard moving the
		// composer carries the menu along). Absolute offsets also dodge the
		// fixed-position containing-block traps of the glassy composer card.
		if (flag("menus", true)) {
			var MFX_MENU_MARK = "_7KE1Ra_menu"; // ModelSelect.module.css "menu"
			var placeMenus = function () {
				var narrow = window.innerWidth <= 700;
				var menus = document.querySelectorAll('[class*="' + MFX_MENU_MARK + '"]');
				Array.prototype.forEach.call(menus, function (menu) {
					if (!narrow) {
						// wide screens: hand the landing back to the host — but
						// only undo our own placement, identified by the styles
						// the narrow branch always sets (width, or right:auto).
						// Since 0.1.5 the host positions this menu itself with an
						// inline left/top pair; wiping left unconditionally threw
						// the menu to the viewport's left edge on desktop.
						if (menu.style.width || menu.style.right) {
							menu.style.boxSizing = "";
							menu.style.left = "";
							menu.style.right = "";
							menu.style.width = "";
							menu.style.minWidth = "";
							menu.style.maxWidth = "";
						}
						return;
					}
					var root = menu.parentElement;
					if (!root) return;
					var r = root.getBoundingClientRect();
					if (r.width === 0 && r.height === 0) return;
					// border-box: the host menu is content-box, so its own
					// padding would otherwise widen the box past the margins
					menu.style.boxSizing = "border-box";
					menu.style.left = (12 - r.left) + "px";
					menu.style.right = "auto";
					menu.style.width = (window.innerWidth - 24) + "px";
					menu.style.minWidth = "0";
					menu.style.maxWidth = "none";
				});
			};
			// the menu mounts on open and remounts across pane switches; the
			// observer restyles it before its first paint, the interval catches
			// layout drift the observer misses. The observer callback is
			// throttled: streaming tokens append nodes continuously, and an
			// unthrottled substring querySelectorAll per mutation starves
			// input handling during a multi-session storm.
			var placeMenusThrottled = mfxThrottle(placeMenus, 250);
			try {
				new MutationObserver(placeMenusThrottled).observe(document.body,
					{ subtree: true, childList: true });
			} catch (e) {}
			window.addEventListener("resize", placeMenusThrottled);
			setInterval(placeMenus, 1000);
			placeMenus();
		}

		// ---------- 7. network chip: surface stuck /api/ requests ----------
		// The host talks to /api/... through window.fetch and some routes
		// (e.g. /api/session/list) can hang without any UI feedback, leaving
		// "is the service dead or is this route slow" unanswerable. A thin
		// wrapper around window.fetch tracks in-flight /api/ requests; a
		// compact chip next to the composer controls appears only when a request
		// crosses the stuck threshold or fails outright. Tapping it runs a
		// liveness probe against the plugin's ping route to separate "the
		// service is alive, this route is slow" from "the host is not
		// answering at all".
		if (flag("net", true)) {
			var NET_STUCK_MS = 10000;
			var NET_KEEP_MS = 20000;
			var netT = function (zh, en) {
				try { return (navigator.language || "en").toLowerCase().indexOf("zh") === 0 ? zh : en; }
				catch (e) { return en; }
			};
			var netInflight = [];
			var netRecent = [];

			function netTick() {
				if (typeof netChipTick === "function") netChipTick();
			}
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
					// window — cap the list so the per-second chip tooltip
					// build stays bounded
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
				netToast("⏳ " + netT("正在探测服务…", "Probing the service…"));
				fetch(ROUTE_PREFIX + "/ping", { cache: "no-store", signal: ctl.signal })
					.then(function () {
						clearTimeout(timer);
						netToast("✓ " + netT("服务存活（ping " + (Date.now() - t0) + "ms）——卡住的是 API 路由本身", "Service alive (ping " + (Date.now() - t0) + "ms) — the API route itself is stuck"));
					})
					.catch(function () {
						clearTimeout(timer);
						netToast("✗ " + netT("服务无响应（5s 超时）——宿主可能卡死，可在 设置 → 通用 里重启服务", "No answer within 5s — the host may be deadlocked; restart it from Settings → General"));
					});
			}
			// The chip is plain DOM, not a slot component: when /api/ hangs the
			// host stops re-rendering entirely, so a React seat would never
			// refresh exactly when it matters. Our own ticker owns the element,
			// re-anchoring it beside the composer controls after host re-renders.
			var netChip = null;
			function netChipTick() {
				var now = Date.now();
				var stuck = netInflight.filter(function (r) { return now - r.start >= NET_STUCK_MS; });
				var failed = netRecent.filter(function (r) { return !r.ok; });
				var visible = stuck.length > 0 || failed.length > 0;
				if (!visible) {
					if (netChip) netChip.style.display = "none";
					return;
				}
				if (!netChip || !netChip.isConnected) {
					var anchor = document.querySelector("button.uV2eYG_add");
					if (!anchor || !anchor.parentElement) return;
					if (!netChip) {
						netChip = document.createElement("button");
						netChip.type = "button";
						netChip.id = "mfx-net-chip";
						netChip.addEventListener("click", netProbe);
					}
					anchor.parentElement.insertBefore(netChip, anchor.nextSibling);
				}
				var hot = stuck.length > 0;
				netChip.style.display = "flex";
				netChip.style.alignItems = "center";
				netChip.style.height = "28px";
				netChip.style.margin = "0 4px";
				netChip.style.padding = "0 8px";
				netChip.style.borderRadius = "14px";
				netChip.style.border = "1px solid " + (hot ? "rgba(214,128,32,.55)" : "rgba(196,64,64,.55)");
				netChip.style.background = hot ? "rgba(214,128,32,.12)" : "rgba(196,64,64,.10)";
				netChip.style.color = "inherit";
				netChip.style.cursor = "pointer";
				netChip.style.fontSize = "12px";
				netChip.style.flex = "none";
				netChip.textContent = hot ? "⏳ " + stuck.length : "⚠";
				netChip.title = stuck.map(function (r) { return r.path + "  " + Math.round((now - r.start) / 1000) + "s"; })
					.concat(failed.map(function (r) { return r.path + "  " + (r.ok ? Math.round(r.ms / 1000) + "s" : netT("失败", "failed")); }))
					.join("\n");
				netChip.setAttribute("aria-label", netT("网络状态", "Network status"));
			}
			// one steady 1s tick drives the chip whether or not anything is
			// in flight — it must run while the host is frozen to hide and
			// re-anchor the element as requests settle
			setInterval(netTick, 1000);
			window.__mfxNetDebug = function () {
				return {
					patched: !!window.__mfxFetchPatched,
					inflight: netInflight.map(function (r) { return { p: r.path, ms: Date.now() - r.start }; }),
					recent: netRecent.length,
					chip: netChip ? (netChip.isConnected ? "attached" : "detached") : "absent"
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
		// Below 1024px — the same boundary the drawer takeover uses, so a
		// rotated phone is covered too — the question becomes its own capped
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
			// observer is the same throttled leading+trailing pass the drawer
			// and menu hooks use, so a token flood costs at most five runs a
			// second of two lookups and a string compare.
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
		// chips feel dead and the network chip lights up.
		//
		// The guard wraps the session manager's refreshSubagents (the single
		// choke point every caller — select, catalog-open, stale re-arm,
		// reconnect — goes through) and adds three client-side brakes while
		// keeping the host's own per-parent single-flight semantics:
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
				var manager = svc.manager && typeof svc.manager.refreshSubagents === "function"
					? svc.manager : null;
				var target = manager !== null ? manager
					: (typeof svc.refreshSubagents === "function" ? svc : null);
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
				var origRefresh = target.refreshSubagents;
				target.__mfxOrigRefresh = origRefresh;
				// A forced refresh bypasses the brakes (sheet retry button,
				// pending navigation): the user asked for THIS fetch.
				mfxForceCatalogRefresh = function (parentSessionId) {
					return Promise.resolve(origRefresh.call(target, parentSessionId));
				};
				target.refreshSubagents = function (parentSessionId) {
					try {
						var view = agentsChildrenIndex();
						var snap = view !== null ? view.snap : null;
						var kids = view !== null ? view.index : null;
						var catalog = snap !== null && snap.subagentsByParent
							? snap.subagentsByParent[parentSessionId] : undefined;
						var byIdLoaded = snap !== null && snap.byId
							&& Object.keys(snap.byId).length > 0;
						var childless = byIdLoaded
							&& (!kids || !kids[parentSessionId])
							&& (catalog === undefined
								|| (catalog.state === "ready" && (catalog.entries || []).length === 0));
						// An error catalog is not evidence of childlessness —
						// the host's own Retry must stay able to refetch.
						if (childless) {
							agentsStats.skippedChildless++;
							return Promise.resolve();
						}
						// A catalog someone is watching (an open menu — the
						// host's chip or this plugin's sheet) keeps its live
						// membership refreshes: the cooldown must not eat the
						// 50ms-debounced follow-up a new child schedules, or
						// the open tree goes stale until it is reopened. The
						// 350ms start gap below still spaces the fetches.
						var openNow = false;
						try {
							openNow = target.openCatalogs instanceof Set
								&& target.openCatalogs.has(parentSessionId);
						} catch (e) {}
						if (!openNow
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

			function mfxT(zh, en) {
				try {
					return (navigator.language || "en").toLowerCase().indexOf("zh") === 0 ? zh : en;
				} catch (e) { return en; }
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
				var catalogs = useSessions(function (s) { return s.subagentsByParent; });
				var jobs = useSessions(function (s) { return s.jobsBySession[sessionId]; }) || [];
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

				// sheet open: subscribe the root catalog for live membership
				// updates (the host debounces those; the agents guard spaces
				// the refetches), and fetch it if absent — through the forced
				// path, so a childless root still resolves to its empty ready
				// catalog instead of a perpetual loading row
				React.useEffect(function () {
					if (!open) return undefined;
					var sessions = ctx.sessions;
					if (!sessions) return undefined;
					try {
						var catalog = catalogs[rootId];
						if (catalog === undefined || catalog.state === "error") {
							var force = mfxForceCatalogRefresh;
							if (force !== null) void force(rootId);
							else void sessions.refreshSubagents(rootId);
						}
						sessions.setSubagentCatalogOpen(rootId, true);
						// branches kept expanded from a previous open resume
						// their live-membership subscription
						for (var pid in expandedRef.current) {
							sessions.setSubagentCatalogOpen(pid, true);
						}
					} catch (e) {}
					return function () {
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
						if (entry.kind === "child" && entry.id === pending.id) {
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
						sessions.setSubagentCatalogOpen(pid, true);
						var force = mfxForceCatalogRefresh;
						if (force !== null) void force(pid);
						else void sessions.refreshSubagents(pid);
					} catch (e) {}
				}

				function toggleBranch(pid) {
					if (expandedRef.current[pid]) {
						delete expandedRef.current[pid];
						try { ctx.sessions.setSubagentCatalogOpen(pid, false); } catch (e) {}
					} else {
						expandedRef.current[pid] = 1;
						// expanding fetches only what is missing; a ready
						// catalog just resumes its live subscription
						var catalog = catalogs[pid];
						if (catalog === undefined || catalog.state === "error") forceCatalog(pid);
						else {
							try { ctx.sessions.setSubagentCatalogOpen(pid, true); } catch (e) {}
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
						&& entry.kind === "child" && parentId !== undefined) {
						address = { parentSessionId: parentId, childSessionId: id, mode: entry.mode };
					}
					if (address === null && isSubagent) {
						// open(id) resolves an address internally only when the
						// parent's catalog is loaded — otherwise the child
						// would land on a broken generic route
						var pid = summary.parentId;
						var cat = catalogs[pid];
						var found = false;
						if (cat !== undefined && cat.entries !== undefined) {
							for (var i = 0; i < cat.entries.length; i++) {
								if (cat.entries[i].kind === "child" && cat.entries[i].id === id) { found = true; break; }
							}
						}
						if (!found) {
							pendingNavRef.current = { id: id, at: Date.now() };
							forceCatalog(pid);
							return;
						}
					}
					try {
						if (address !== null) sessions.openSubagent(address);
						else sessions.open(id);
					} catch (e1) {
						try { sessions.open(id); } catch (e2) {}
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
							if (entry.kind !== "child" || seen[entry.id]) continue;
							models.push({
								id: entry.id,
								title: entry.label || entry.id,
								running: entry.activity === "running",
								entry: entry
							});
						}
					}
					var loading = cat === undefined || cat.state === "loading";
					if (models.length === 0 && loading) {
						out.push(React.createElement("div", {
							key: "ld" + pid,
							style: { padding: "8px 12px 8px " + (10 + level * 14) + "px", opacity: ".6", fontSize: "12px" }
						}, mfxT("正在加载代理目录…", "Loading the agent catalog…")));
						return;
					}
					if (models.length === 0 && cat !== undefined && cat.state === "error") {
						out.push(React.createElement("div", {
							key: "er" + pid,
							style: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px" }
						},
							React.createElement("span", { style: { fontSize: "12px", color: MFX_ERROR, flex: "1 1 auto" } },
								mfxT("目录加载失败", "The catalog failed to load")),
							React.createElement("button", {
								type: "button", onClick: function () { forceCatalog(pid); bump(); },
								style: { flex: "none", padding: "4px 10px", borderRadius: "8px", border: "1px solid rgba(128,128,140,.4)", background: "transparent", color: "inherit", fontSize: "12px", cursor: "pointer" }
							}, mfxT("重试", "Retry"))));
						return;
					}
					for (i = 0; i < models.length; i++) {
						var model = models[i];
						var entry2 = model.entry;
						var expandable = entry2 !== undefined && entry2 !== null
							? !!entry2.hasChildren
							: !!(tree.kids[model.id] && tree.kids[model.id].length);
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
									"aria-label": mfxT("展开子代理", "Expand subagents"),
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
						if (cat.entries[i].kind === "child" && cat.entries[i].id === childId) return cat.entries[i];
					}
					return undefined;
				}

				if (!narrow || useSessions === undefined) return null;

				var sheet = null;
				if (open && createPortalFn !== null) {
					var body = [];
					// lineage
					if (lineage.length > 1) {
						body.push(sectionLabel(mfxT("会话层级", "Session lineage")));
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
					body.push(sectionLabel(mfxT("子代理（", "Subagents (") + rootStats.count + mfxT("）", ")")));
					var treeOut = [];
					branchRows(rootId, 0, treeOut);
					if (treeOut.length === 0) {
						treeOut.push(React.createElement("div", {
							key: "none",
							style: { padding: "8px 12px", opacity: ".6", fontSize: "12px" }
						}, mfxT("没有子代理", "No subagents")));
					}
					body.push.apply(body, treeOut);
					// jobs
					if (jobs.length > 0) {
						body.push(sectionLabel(mfxT("后台任务（", "Background jobs (") + jobs.length + mfxT("）", ")")));
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
							"aria-label": mfxT("会话、子代理与后台任务", "Sessions, subagents and background jobs"),
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
									"aria-label": mfxT("关闭", "Close"),
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
							"aria-label": mfxT("查看会话层级、子代理与后台任务", "View the session lineage, subagents and background jobs"),
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
							rootStats.count > 0 ? mfxBadge(mfxT(String(rootStats.count) + " 个代理", rootStats.count + " agents"), rootStats.running > 0 ? MFX_RUNNING : null) : null,
							jobs.length > 0 ? mfxBadge(liveJobs > 0
								? mfxT(String(liveJobs) + " 个任务", liveJobs + " jobs")
								: mfxT(String(jobs.length) + " 个任务", jobs.length + " jobs"), liveJobs > 0 ? MFX_RUNNING : null) : null)),
					sheet);
			}

			ctx.slots.inject("conversation.session.header.actions", function () {
				return ctx.slots.register({
					name: "conversation.session.header.actions",
					id: "mfx-header-collector",
					// the pill replaces the whole header row on phones; on
					// desktops it renders null and the host chips stay
					order: -20,
					label: function () { return mfxT("顶部收纳", "Header collector"); }
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
