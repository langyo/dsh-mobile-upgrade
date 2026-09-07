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
//
// Optional features are toggled with localStorage keys (value "0" = off):
//   mfx-attach   (default on) — the 📎 upload button
//   mfx-restart  (default on) — the ⟳ restart button
//   mfx-settle   (default on) — the details-overlay settle
//   mfx-drawer   (default on) — the whale-only rail + overlay drawer
//   mfx-settings (default on) — the settings top-tabs layout
//   mfx-modality (default on) — the provider-edit input-modality switches
//   mfx-menus    (default on) — the model menu spanning the phone width
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
	menus: "menusEnabled"
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
		loadNamespaceFlags = function () {
			try {
				if (!ctx.remote || !ctx.remote.settings || !ctx.remote.settings.describe) return Promise.resolve();
				return Promise.resolve(ctx.remote.settings.describe()).then(function (res) {
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
				}).catch(function () {});
			} catch (e) { return Promise.resolve(); }
		};
		loadNamespaceFlags();
		setInterval(loadNamespaceFlags, 4000);
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
			var scrim = document.createElement("div");
			scrim.id = "mfx-scrim";
			scrim.addEventListener("click", function () {
				var t = document.querySelector('[class*="hHd-Xa_toggle"]');
				if (t) t.click();
			});
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
				/* the rail floats: a small translucent whale chip when collapsed,
				   the full drawer when open. No filter/blur here — a filter would
				   turn the chip into the containing block for the fixed-position
				   settings dialog that portals inside the sidebar subtree. */
				"  [class*=\"pI_x6G_sidebarCol\"] { position: fixed; top: 0; left: 0; width: 56px;",
				"    height: 60px !important; z-index: 130; overflow: hidden; border-radius: 0 0 14px 0;",
				"    box-shadow: 0 1px 10px rgba(0,0,0,.14); transition: width .22s ease;",
				"    background: color-mix(in srgb, canvas 70%, transparent) !important; }",
				"  [class*=\"hHd-Xa_root\"][class*=\"hHd-Xa_collapsed\"] { height: auto !important;",
				"    min-height: 0 !important; }",
				/* collapsed: hide everything except the whale toggle */
				"  [class*=\"hHd-Xa_root\"][class*=\"hHd-Xa_collapsed\"] [class*=\"hHd-Xa_newSession\"],",
				"  [class*=\"hHd-Xa_root\"][class*=\"hHd-Xa_collapsed\"] [class*=\"bhn1Oq_iconButton\"],",
				"  [class*=\"hHd-Xa_root\"][class*=\"hHd-Xa_collapsed\"] [class*=\"bhn1Oq_searchButton\"],",
				"  [class*=\"hHd-Xa_root\"][class*=\"hHd-Xa_collapsed\"] [data-slot=\"sidebar.footer.action\"],",
				"  [class*=\"hHd-Xa_root\"][class*=\"hHd-Xa_collapsed\"] [class*=\"VOzbGW_railRow\"] { display: none !important; }",
				/* expanded: the full drawer */
				"  html.mfx-drawer-open [class*=\"pI_x6G_sidebarCol\"] { width: min(280px, 84vw); bottom: 0;",
				"    height: auto !important; border-radius: 0; box-shadow: 0 0 44px rgba(0,0,0,.4);",
				"    background: none !important; -webkit-backdrop-filter: none; backdrop-filter: none; }",
				"  html.mfx-drawer-open #mfx-scrim { display: block; }",
				"  html.mfx-drawer-open #mfx-scrim { display: block; }",
				"}"
			].join("\n");
			document.head.appendChild(dstyle);

			var drawerOpen = null;
			var syncDrawer = function () {
				try {
					if (window.innerWidth >= 1024) {
						// desktop: the sidebar is a regular grid column, never a drawer
						if (drawerOpen !== false) {
							drawerOpen = false;
							document.documentElement.classList.remove("mfx-drawer-open");
						}
						return;
					}
					var rail = document.querySelector('[class*="hHd-Xa_root"]');
					var open = !!rail && String(rail.className).indexOf("hHd-Xa_collapsed") === -1;
					if (open !== drawerOpen) {
						drawerOpen = open;
						document.documentElement.classList.toggle("mfx-drawer-open", open);
					}
				} catch (e) {}
			};
			setInterval(syncDrawer, 800);
			window.addEventListener("resize", syncDrawer);
			syncDrawer();
			// instant sync + overlay manners, attached to the document: the
			// sidebar column is not mounted yet when the plugin applies, and
			// the host remounts the rail root on toggle (hence childList)
			try {
				new MutationObserver(syncDrawer).observe(document.documentElement,
					{ subtree: true, attributes: true, attributeFilter: ["class"], childList: true });
			} catch (e) {}
			document.addEventListener("click", function (ev) {
				setTimeout(syncDrawer, 0);
				try {
					if (!document.documentElement.classList.contains("mfx-drawer-open")) return;
					if (ev.target && ev.target.closest && ev.target.closest('[class*="hHd-Xa_toggle"]')) return;
					// picking a session inside the drawer closes it — the host
					// does not collapse what is an overlay here
					setTimeout(function () {
						if (!document.documentElement.classList.contains("mfx-drawer-open")) return;
						if (document.querySelector('[class*="VOzbGW_overlay"]')) return;
						var t = document.querySelector('[class*="hHd-Xa_toggle"]');
						if (t) t.click();
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
			// layout drift the observer misses
			try {
				new MutationObserver(placeMenus).observe(document.body,
					{ subtree: true, childList: true });
			} catch (e) {}
			window.addEventListener("resize", placeMenus);
			setInterval(placeMenus, 1000);
			placeMenus();
		}
	}
	return { name: "dsh-mobile-upgrade", inject: inject, apply: apply };
}});
