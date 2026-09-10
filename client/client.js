window.__ModuleLoader__.load({ id: "dsh-mobile-upgrade", factory: (require) => {
	var React = require("react");
	var inject = ["slots"];

	// Everything this plugin renders lives inside native host slots — no
	// fixed-position body elements, no CSS overrides, no DOM polling.
	//
	//   1. 📎 upload button in the composer's native "conversation.input.left"
	//      slot, wearing the InputBar's own button class (uV2eYG_add) so it is
	//      pixel-identical to the neighbouring + control.
	//      images → synthetic paste event into the Lexical editor (the
	//      engine's own image-attachment path); other files → POST to the
	//      host route, the returned absolute path is pasted in as text.
	//   2. settings extras: ⟳ restart row in the General tab, and the
	//      models/providers editor in the Models tab (localized labels).
	//   3. narrow-screen settle: the fullscreen tool-details overlay — whose
	//      close button is inert upstream — is not rendered on narrow screens.
//   4. narrow drawer: the collapsed rail keeps only the whale toggle;
//      the expanded sidebar floats above full-width content as a drawer
//      (the whale is the host's own toggle, hHd-Xa_collapsed is the state).
//   5. narrow settings: the dialog's side nav becomes horizontal top tabs.
//   6. narrow model menu: the composer's model menu lands full-width.
//   7. network chip: a slot chip next to the paperclip surfaces /api/
//      requests that hang or fail; tapping it probes the service's ping
//      route to tell a slow route from a deadlocked host.
//   8. storm throttle: many sessions streaming at once (or the replay
//      burst right after a reconnect) mutates the document per token, so
//      the document-wide observers run at a capped leading+trailing rate,
//      the settings poller backs off while the host is unreachable, and a
//      rail remount keeps the drawer state for a grace period instead of
//      flapping the drawer — no per-mutation layout work, no frozen input,
//      no white-flashing sidebar. Drawer close taps (scrim, picking a
//      session) retry through a remount instead of landing on a stale
//      toggle and stranding the drawer open.
//
// Optional features are toggled with localStorage keys (value "0" = off):
//   mfx-attach   (default on) — the 📎 upload button
//   mfx-restart  (default on) — the ⟳ restart button
//   mfx-settle   (default on) — the details-overlay settle
//   mfx-drawer   (default on) — the whale-only rail + overlay drawer
//   mfx-settings (default on) — the settings top-tabs layout
//   mfx-modality (default on) — the provider-edit input-modality switches
//   mfx-menus    (default on) — the model menu spanning the phone width
//   mfx-net      (default on) — the stuck-request network chip
// Without a localStorage override, the per-feature toggles of the server-side
// "mobile-ui-fix" settings section decide (they take effect on next load).
var namespaceFlags = null;
var namespaceRevision;
var sectionListeners = [];
var loadNamespaceFlags = function () {};
var NAMESPACE_FLAG_KEYS = {
	attach: "attachEnabled",
	restart: "restartEnabled",
	settle: "settleEnabled",
	drawer: "drawerEnabled",
	settings: "settingsTabsEnabled",
	modality: "modalityEnabled",
	menus: "menusEnabled",
	net: "netEnabled"
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
					if ((entry.ns || entry.name || entry.id) !== "mobile-ui-fix") continue;
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

		// ---------- shared composer helpers (used only inside click handlers) ----------
		function findComposerEditor() {
			var candidates = document.querySelectorAll('[contenteditable="true"]');
			for (var i = 0; i < candidates.length; i++) {
				var rect = candidates[i].getBoundingClientRect();
				if (rect.width > 80 && rect.bottom > window.innerHeight * 0.3) return candidates[i];
			}
			return null;
		}

		function pasteIntoComposer(transfer) {
			var editor = findComposerEditor();
			if (!editor) return false;
			editor.focus();
			var ev = new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true });
			editor.dispatchEvent(ev);
			return true;
		}

		function insertFileIntoComposer(file) {
			var dt = new DataTransfer();
			dt.items.add(file);
			return pasteIntoComposer(dt);
		}

		function insertTextIntoComposer(text) {
			var dt = new DataTransfer();
			dt.setData("text/plain", text);
			return pasteIntoComposer(dt);
		}

		function uploadToHost(file) {
			return new Promise(function (resolve, reject) {
				var xhr = new XMLHttpRequest();
				xhr.open("POST", "/plugins/mobile-ui-fix/upload?filename=" + encodeURIComponent(file.name));
				xhr.setRequestHeader("content-type", "application/octet-stream");
				xhr.onload = function () {
					try {
						var data = JSON.parse(xhr.responseText);
						if (xhr.status === 200 && data.ok) resolve(data.path);
						else reject(new Error(data.error || ("HTTP " + xhr.status)));
					} catch (e) { reject(e); }
				};
				xhr.onerror = function () { reject(new Error("network")); };
				xhr.send(file);
			});
		}

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

		function handleFiles(files) {
			var list = Array.prototype.slice.call(files ?? []);
			var index = 0;
			var next = function () {
				if (index >= list.length) return;
				var file = list[index++];
				// some phone gallery pickers hand images over with an empty
				// mime type — fall back to the extension
				var looksImage = (file.type && file.type.indexOf("image/") === 0) ||
					/\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name || "");
				if (looksImage) {
					toast(insertFileIntoComposer(file) ? "✓ " + file.name : "✗ " + file.name);
					setTimeout(next, 350);
					return;
				}
				toast("↑ " + file.name);
				uploadToHost(file).then(function (path) {
					var ok = insertTextIntoComposer(path);
					toast((ok ? "✓ " : "✗ ") + file.name);
					setTimeout(next, 350);
				}).catch(function (err) {
					toast("✗ " + file.name + ": " + err.message);
					setTimeout(next, 1200);
				});
			};
			next();
		}

		// ---------- 2. 📎 composer attach — native conversation.input.left slot ----------
		if (flag("attach", true)) {
			function PaperclipIcon() {
				return React.createElement(
					"svg",
					{ width: "16", height: "16", viewBox: "0 0 24 24", fill: "none",
					  stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round",
					  strokeLinejoin: "round", "aria-hidden": "true" },
					React.createElement("path", { d: "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" })
				);
			}

			function AttachButton() {
				return React.createElement(
					"span",
					{ style: { display: "contents" } },
					React.createElement("input", {
						type: "file",
						multiple: true,
						style: { display: "none" },
						onChange: function (ev) {
							handleFiles(ev.target.files);
							ev.target.value = "";
						}
					}),
					React.createElement(
						"button",
						{
							type: "button",
							className: "uV2eYG_add",
							title: "上传附件（图片走粘贴附件，其他文件存服务器并插入路径）",
							"aria-label": "上传附件",
							onClick: function (ev) {
								var input = ev.currentTarget.previousElementSibling;
								if (input && input.click) input.click();
							}
						},
						React.createElement(PaperclipIcon)
					)
				);
			}

			ctx.slots.inject("conversation.input.left", function () {
				return ctx.slots.register(
					{ name: "conversation.input.left", id: "mfx-attach", label: function () { return "附件"; } },
					function () { return React.createElement(AttachButton, null); }
				);
			});
		}

		// ---------- 3. ⟳ restart — a settings.general.item row in the General tab ----------
		// The documented additive seat for General-section rows: the row draws
		// its own internals and writes through the plugin's restart route.
		if (flag("restart", true)) {
			function restartLabel() {
				try {
					return (navigator.language || "en").toLowerCase().indexOf("zh") === 0 ? "重启服务" : "Restart service";
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
							fetch("/plugins/mobile-ui-fix/restart", { method: "POST" }).catch(function () {});
							var started = Date.now();
							var timer = setInterval(function () {
								fetch("/plugins/mobile-ui-fix/ping", { cache: "no-store" })
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
						fetch("/plugins/mobile-ui-fix/llm-config", { cache: "no-store" })
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
								fetch("/plugins/mobile-ui-fix/model-input", {
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
			scrim.addEventListener("click", function () {
				closeDrawerRetrying();
			});
			document.body.appendChild(scrim);

			// During a storm the session switch re-renders the sidebar and a
			// one-shot toggle click can land on a toggle that is being
			// remounted — stale or absent — and silently do nothing, leaving
			// the drawer stuck open over the content with nothing left to
			// click. Retry through the remount. The rail's own collapsed
			// class is the truth this loop exits on (or the attempt cap,
			// which degrades to the old one-shot's terminal state only after
			// 3.6s of tries): the mirror class on <html> is unreliable here,
			// because the hysteresis expiry flips it off mid-gap and the
			// remounting rail pops the drawer right back open — bailing on
			// the mirror is exactly how the one-shot close stranded the
			// drawer before. The growing delays ride out a busy main thread;
			// a landed click is seen as collapsed on the next recheck, so
			// the loop stops and cannot toggle forever.
			function closeDrawerRetrying() {
				var delays = [150, 250, 400, 600, 900, 1300];
				var attempt = 0;
				var tryClose = function () {
					try {
						var rail = document.querySelector('[class*="hHd-Xa_root"]');
						if (rail && String(rail.className).indexOf("hHd-Xa_collapsed") !== -1) return;
						if (attempt < delays.length) setTimeout(tryClose, delays[attempt++]);
						var t = rail ? document.querySelector('[class*="hHd-Xa_toggle"]') : null;
						if (t) t.click();
					} catch (e) {}
				};
				tryClose();
			}

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
				   alike, which a white tint never is. */
				"  [class*=\"pI_x6G_sidebarCol\"] { position: fixed; top: 10px; left: 10px; width: 56px;",
				"    height: 56px !important; z-index: 130; overflow: hidden;",
				"    box-shadow: 0 2px 14px rgba(0,0,0,.18); touch-action: none;",
				"    transition: left .28s cubic-bezier(.2,.8,.2,1), top .28s cubic-bezier(.2,.8,.2,1);",
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
			function applyChipPos() {
				var chip = document.querySelector('[class*="pI_x6G_sidebarCol"]');
				if (desktopMQ.matches) {
					// desktop: back to a plain grid column. A drag interrupted
					// by a remount can leave a frozen transition behind, and a
					// stale moved flag would swallow the first click on the
					// restored sidebar — clear both on the way back.
					if (chip) { chip.style.left = ""; chip.style.right = ""; chip.style.top = ""; chip.style.transition = ""; }
					document.documentElement.classList.remove("mfx-chip-right");
					chipDrag.active = false;
					chipDrag.moved = false;
					return;
				}
				chipTop = clampChipTop(chipTop);
				document.documentElement.classList.toggle("mfx-chip-right", chipSide === "right");
				if (!chip) return;
				if (chipSide === "right") { chip.style.left = "auto"; chip.style.right = "10px"; }
				else { chip.style.right = "auto"; chip.style.left = "10px"; }
				chip.style.top = chipTop + "px";
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
				chip.style.transition = "none";
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
				chip.style.right = "auto";
				chip.style.left = chipDrag.curL + "px";
				chip.style.top = chipDrag.curT + "px";
			}, true);
			document.addEventListener("pointerup", function (ev) {
				if (!chipDrag.active) return;
				chipDrag.active = false;
				var chip = document.querySelector('[class*="pI_x6G_sidebarCol"]');
				if (chip) chip.style.transition = "";
				if (!chipDrag.moved) return;
				chipSide = chipDrag.curL + chipDrag.w / 2 < window.innerWidth / 2 ? "left" : "right";
				chipTop = chipDrag.curT;
				try {
					window.localStorage.setItem("mfx-chip-side", chipSide);
					window.localStorage.setItem("mfx-chip-top", String(chipTop));
				} catch (e) {}
				if (chip) void chip.offsetWidth; // flush so the edge snap animates
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
			// frames at a time. Without a grace period every such gap flips
			// the drawer shut and the returning rail flips it straight back
			// open — per-mutation, that loop is the sidebar twitching itself
			// into unclickability. Hold the previous drawer state while the
			// rail is briefly missing; a real close (the rail collapsing)
			// still applies at once because the rail stays mounted.
			var railLastSeen = 0;
			var RAIL_GRACE_MS = 600;
			var syncDrawer = function () {
				try {
					applyChipPos();
					if (desktopMQ.matches) {
						// desktop: the sidebar is a regular grid column, never a drawer
						if (drawerOpen !== false) {
							drawerOpen = false;
							document.documentElement.classList.remove("mfx-drawer-open");
						}
						return;
					}
					var rail = document.querySelector('[class*="hHd-Xa_root"]');
					if (rail) railLastSeen = Date.now();
					else if (drawerOpen && Date.now() - railLastSeen < RAIL_GRACE_MS) return;
					var open = !!rail && String(rail.className).indexOf("hHd-Xa_collapsed") === -1;
					if (open !== drawerOpen) {
						drawerOpen = open;
						document.documentElement.classList.toggle("mfx-drawer-open", open);
					}
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
					if (!document.documentElement.classList.contains("mfx-drawer-open")) return;
					if (ev.target && ev.target.closest && ev.target.closest('[class*="hHd-Xa_toggle"]')) return;
					// picking a session inside the drawer closes it — the host
					// does not collapse what is an overlay here; the close
					// retries so a storm-time remount cannot swallow the click
					// and strand the drawer over the freshly opened session
					setTimeout(function () {
						if (!document.documentElement.classList.contains("mfx-drawer-open")) return;
						if (document.querySelector('[class*="VOzbGW_overlay"]')) return;
						closeDrawerRetrying();
					}, 180);
				} catch (e) {}
			}, true);
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
						// wide screens: hand the landing back to the host
						if (menu.style.left) {
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
		// compact chip next to the paperclip appears only when a request
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
				// toast() lives in the attach block; only delegate when enabled
				if (typeof toast === "function") toast(text);
			}
			function netProbe() {
				var t0 = Date.now();
				var ctl = new AbortController();
				var timer = setTimeout(function () { ctl.abort(); }, 5000);
				netToast("⏳ " + netT("正在探测服务…", "Probing the service…"));
				fetch("/plugins/mobile-ui-fix/ping", { cache: "no-store", signal: ctl.signal })
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
			// re-anchoring it beside the paperclip after host re-renders.
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
	}
	return { name: "dsh-mobile-upgrade", inject: inject, apply: apply };
}});
