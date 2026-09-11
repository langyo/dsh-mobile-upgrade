# dsh-mobile-upgrade

English | [简体中文](docs/zh-Hans/README.md) | [繁體中文](docs/zh-Hant/README.md) | [日本語](docs/ja/README.md) | [한국어](docs/ko/README.md) | [Español](docs/es/README.md) | [Français](docs/fr/README.md) | [Deutsch](docs/de/README.md) | [Русский](docs/ru/README.md)

Mobile quality-of-life fixes for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) web profile, shipped as a single plugin. Everything renders through the host's own slots and state signals — no layout takeover, no floating widgets, no DOM polling of chat content.

## What you get

- **Composer attachment upload** — a paperclip button beside the composer's tool row. Images go through the editor's native paste-attachment path; any other file is uploaded to the server and its absolute path is pasted into the draft so the agent can read it with its file tools.
- **Restart row** — a "Restart service" entry in Settings → General. Confirms first, restarts the `dsh` process, and reloads the page automatically once the service answers again.
- **Input-modality switches** — text/image/video checkboxes on every model row of the native provider editor, writing the model's `input` array into `settings.yaml` (with a backup next to the file). Catalog models without a user-customised route show the switches read-only.
- **Narrow-screen drawer** — below 1024px the sidebar collapses to a small corner chip that keeps the host's own toggle; expanding it floats the full sidebar as a drawer over full-width content, and picking a session closes it again. The chip and the drawer swap atomically (no geometry animation to freeze on a busy main thread), and a tap that closes the drawer collapses it in that same frame instead of waiting for the host's re-render — so a phone running many sessions cannot strand the drawer half-expanded, and the closed chip never sits white over a rail the host has already emptied.
- **Narrow settings tabs** — below 700px the settings dialog's side navigation becomes a row of horizontally scrollable tabs.
- **Full-width model menu** — below 700px the composer's model menu re-anchors to exactly the phone width (12px margins) instead of landing past the screen edge, while the host keeps owning the vertical placement above the trigger.
- **Scrollable question card** — below 1024px a pending question can no longer bury its own choices: the question is capped into its own scroll region, so a long question scrolls in place while the option list below keeps whatever room is left and the options, the submit row and the minimize/close buttons stay on screen and reachable. A short question is untouched, and the card still hugs its content.
- **Details-overlay settle** — the fullscreen tool-details overlay whose close control is inert in the current host is not rendered on narrow screens, so it cannot trap the chat.
- **Storm-safe reactivity** — the drawer/menu observers and the settings poller react to a burst of streaming messages at a capped rate and back off while the host is unreachable, a rail remount during a reconnect keeps the drawer state instead of flapping it, and drawer close taps retry through a remount instead of landing on a stale toggle: many sessions streaming at once no longer freeze input or twitch the sidebar into unclickability, whether it is open or closed.
- **Subagent-catalog guard** — the host serves the subagent catalog by enumerating the whole session corpus per request (~1s on a long history), and its client asks on every selection, chip hover, and membership event. The plugin wraps that refresh: a parent with no children in the live session list is never asked, a parent is re-asked at most once per 2.5s, and refresh starts are spaced apart — a subagent fan-out no longer starves the host with full-corpus scans.
- **Click-to-open lineage chips** — on desktop the subagent chips ("N subagents" and the subagent title switcher) open on hover only in the current host; a click does nothing. The plugin translates a click on a chip into the hover event pair the host already understands, so clicking toggles the tree open/closed (ancestor crumbs keep their navigate-on-click).
- **Narrow-header collector** — below 1024px the session header's chips (lineage, jobs, preset) are wider than the phone and hover-only. They fold into one pill (`≡ title · N agents · M jobs`); tapping it opens a full-width sheet with the session lineage (each ancestor tappable, each with its descendant count), the subagent tree rooted at the family root — rows render from the live session list, branches fetch their catalog on demand through the guarded refresh — and this session's background jobs. On desktop nothing changes.
- **Session-list render throttle** — the host pushes a whole-value projection frame for every projection change of every attached session, and a running subagent's timing view changes on every committed event, so a busy background fleet streams 50-150 frames/s into the page. Each frame used to re-render the whole session list (one rebuild walks every summary plus an O(n²) cache sweep — measured as most of the main-thread time, freezing the page until reload). The plugin coalesces those re-renders onto an adaptive trailing interval while the values keep flowing into the per-session stores unchanged, so background streaming no longer freezes the page — on any session, new or old.
- **Self-update** — the client bundle is served immutable per revision, so a phone tab can keep running an older build for days. The page compares the revision it booted with against the one the server publishes now and reloads itself once the page has been idle (never while a draft is being typed), or offers a tappable banner.
- **Per-feature toggles** — the plugin installs a `dsh-mobile-upgrade` section in Settings → Plugins with a switch per feature.

## Screenshots

The floating chip, the session drawer, the narrow-screen settings tabs and the composer attach button (annotated):

| | |
|---|---|
| ![Floating chip](res/shot-floating-chip.png) | ![Session drawer](res/shot-drawer.png) |
| ![Settings tabs](res/shot-settings-tabs.png) | ![Composer attach](res/shot-composer-attach.png) |

## Install

```sh
dsh plugin --profile web add dsh-mobile-upgrade
```

Restart `dsh web`, then open the web profile on your phone: the paperclip sits in the composer, the restart row in Settings → General, and the feature toggles in Settings → Plugins → dsh-mobile-upgrade.

Requires `dsh` 0.1.2-rc.1 or newer.

## Configuration

The plugin's settings card takes:

| Key | Default | Meaning |
|---|---|---|
| `uploadDir` | `<dsh home>/mobile-uploads` | Where non-image uploads are stored |
| `restartEnabled` | `true` | Offer the restart row and its route |

## Feature toggles

Every feature above can be switched in Settings → Plugins → dsh-mobile-upgrade (effective on the next page load), or overridden per device with a `localStorage` key — `mfx-attach`, `mfx-restart`, `mfx-settle`, `mfx-drawer`, `mfx-settings`, `mfx-modality`, `mfx-menus`, `mfx-net`, `mfx-questions`, `mfx-selfupdate`, `mfx-agents`, `mfx-header`, `mfx-listthrottle` — where the value `"0"` turns a feature off.

## Limitations

- The client hooks specific host UI elements by their hashed CSS class names (menu, drawer toggle, provider editor, session-header chips). A host build that renames them degrades individual features until this plugin catches up; everything else keeps working. The question card's question region is found through the card's own `data-question-key` hook instead, so a host rebuild that merely rehashes its CSS modules keeps it working.
- The header collector and the lineage click shim ride the host's own data (the live session list and its subagent catalogs); they add no requests beyond the guarded branch fetches, and a tap on a row whose mode is still loading completes on its own once that catalog lands.
- Input-modality switches can only patch provider routes you have customised yourself; catalog-only routes are read-only by design, because fabricating a catalog section collapses the model directory.

## Security notes

The plugin's HTTP routes (upload, restart, settings editing) perform no authentication of their own — they trust the `dsh` web surface they are loaded into. Put the deployment behind whatever gate protects the rest of the UI (reverse-proxy auth, loopback binding) before exposing it beyond localhost.

## Community Links

- [Linux.Do](https://linux.do) — A community for sharing and discussing technology.

## License

Distributed under the [Synthetic Source License (SySL), Version 1.0](LICENSE).

> NOTICE: This software includes code generated by artificial intelligence. See the LICENSE file for the Synthetic Source License terms, including model disclosure requirements.
