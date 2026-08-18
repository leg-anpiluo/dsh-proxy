# @superfish058/dsh-llm-proxy

Model-level proxy routing **+ retry** for DSH LLM requests, with a Web settings page (模型代理) in the DSH 设置 UI.

## Problem

- DSH's LLM adapter (`pi-ai` → OpenAI SDK → undici fetch) exposes **no per-provider proxy knob**.
- `NODE_USE_ENV_PROXY` is only honored at **process start** — a plugin cannot set it at runtime.
- Result: overseas model endpoints (e.g. `api.b.ai`) time out from a mainland network.
- Bonus problem: free-tier quotas get exhausted by transient 429s and 5xx — there is no built-in throttle, but a retry policy keeps requests alive through rate-limit windows.

## Solution

On apply, the plugin installs a **custom undici `RoutingDispatcher`** (wrapped in undici's official `RetryAgent`) as the *global dispatcher*. Every LLM request is routed by **target hostname**:

1. Loopback hosts (`localhost`, `127.0.0.1`, `::1`) → **direct** (always).
2. Hosts whose models are selected in **走代理的模型** → the configured **proxy** (`proxyHost:proxyPort`).
3. Everything else → **direct** (domestic APIs: DeepSeek, Xiaomi, Qwen, Zhipu, …).

The default is DIRECT — the model is the unit of intent: pick the models that need the proxy, everything else stays on the direct path.

**Retry** (`retries` / `retryIntervalMs`, default 3 / 1000ms): the undici `RetryAgent` replays the request on transport errors (ECONNRESET, ECONNREFUSED, …), HTTP 429 and 5xx (500/502/503/504). LLM calls are POST, so the method list is overridden to include POST.

Because each provider has a distinct baseURL host, this gives per-provider routing with a single mechanism — below the LLM adapter. `ctx.llm` providers and `settings.yaml` stay untouched, and **no process restart is needed**: the dispatcher swap is live from the first request.

> **Connection-pool pitfall (undici 8.x, fixed in v1.0.0)**: the `ProxyAgent`'s
> internal proxy-side pool defaults to keep-alive. When the proxy (e.g.
> Clash) silently closes an idle CONNECT tunnel, undici keeps reusing the
> dead socket and the request hangs until timeout — surfaced as
> `Request timed out` / `HeadersTimeoutError`, intermittently (reproduced:
> 2/10 requests fail with 2.5s idle gaps while a raw tunnel succeeds 10/10).
> The dispatcher now constructs the proxy agent with
> `clientFactory + pipelining: 0` so every tunnel is a fresh connection
> (verified 10/10 on the full RetryAgent(RoutingDispatcher) path).

## Web settings page（模型代理）

The DSH 设置 page shows a **模型代理** plugin card inside **插件 → 可配置插件** (the official `settings.plugin.item` slot, declared by `@deepseek-ai/dsh-client-ui-settings-plugins`). Opening the card reveals the configurable items:

- **代理地址 / 代理端口** (`proxyHost` / `proxyPort`, default `127.0.0.1:7897`) — the proxy does not have to live on this machine.
- **走代理的模型** (`proxiedModels`) — a dropdown populated from the configured model list (llm-pi-ai + llm-deepseek namespaces via a host bridge); add multiple models, each routes its baseURL host through the proxy.
- **重试次数 / 重试间隔** (`retries` / `retryIntervalMs`) — retry policy for failed requests.

Saving writes the settings namespace `llm-proxy` and **re-applies the dispatcher live** (no restart).

- Host half (`lib/settings.js`): registers the `llm-proxy` settings namespace (same `Config` schema; the cordis.patch.yml config is the composition `base`) and watches it for committed changes. Because rc.6 host-apiproxy only exposes a hard-coded namespace allowlist, the namespace is also re-served to the browser over a **loopback-only bridge** (`/api/dsh-llm-proxy/settings/{describe,mutate,models}`) — the same pattern the official dsh-web-ui settings plugin uses.
- Browser half (`src/client/`): registers the `settings.plugin.item` card and binds a compat settings scope (official transport first, bridge fallback), so the card works on any host. The card draws its own form; the section stacks cards and reports their count.
- When no settings seam exists (tests, bare config), the plugin falls back to applying the patch config directly.

> **Bridge status (rc.6 temporary)**: the settings bridge is a *temporary rc.6 compatibility
> seam — `settings.register()`/namespace exposure is not yet public on the host side
> (`api-proxy` serves a hard-coded allowlist), so the `llm-proxy` namespace is re-served
> loopback-only. Once the official host exposes `settings.register()` for third-party
> namespaces, the bridge routes (`lib/settings.js`) and the bridge fallback half of
> `src/client/settings-scope.ts` can be removed; the card itself stays, riding the
> official transport only.

Rebuild the browser half after editing `src/client/`:

```bash
npm run build        # tsdown → lib/client.js (window.__ModuleLoader__ closure)
npm run typecheck    # tsc --noEmit
```

Then restart `dsh web` (tray exit → start) to load the new host half and re-serve the client bundle.

## Install

```sh
# GitHub (source, builds on install — grant the allowBuilds prompt once)
dsh plugin --profile web add github:superfish058/dsh-llm-proxy

# or from a local checkout
dsh plugin --profile web add C:/path/to/dsh-llm-proxy
```

Git-hosted installs run the package's `prepare` script (tsdown); pnpm ≥10 asks you to authorize builds once — copy the printed key into the profile's `pnpm-workspace.yaml` and re-run `add`. To skip the build allowance entirely, use a tarball instead:

```sh
pnpm pack        # → dsh-llm-proxy-1.0.0.tgz
dsh plugin --profile web add ./dsh-llm-proxy-1.0.0.tgz
```

Then restart `dsh web` (tray exit → start). No other change needed.

## Config

| Field | Default | Meaning |
|---|---|---|
| `proxyHost` | `127.0.0.1` | Proxy hostname/IP; does not have to be this machine. |
| `proxyPort` | `7897` | Proxy port (1–65535). |
| `proxiedModels` | `[]` | Model keys that route through the proxy, `<providerId>/<modelId>` (resolved against the llm-pi-ai / llm-deepseek model list); everything else stays direct. |
| `retries` | `3` | Max retry attempts on failure (transport error / 429 / 5xx), 0–10. |
| `retryIntervalMs` | `1000` | Delay between retry attempts, ms (0–60000). |

> The plugin shipped its model-level design as v1.0.0 (previous internal iterations
> used `proxyUrl`/`routes`/`rateLimits`; if you carried a user layer from those,
> delete the old `llm-proxy:` section from `settings.yaml` and configure the new fields).

## Verify

After restart, `dsh web` logs show:

```
dsh-llm-proxy: global dispatcher → RetryAgent(RoutingDispatcher) (proxy=127.0.0.1:7897, proxiedHosts=[api.b.ai], retries=3×1000ms)
```

Then select the b.ai model in the model picker — streaming should work, and only its host (`api.b.ai`) goes through the proxy.

## Test

```bash
npm test            # unit tests (routing + RetryAgent retry, no network)
npm run test:client # client-bundle build check (run npm run build first)
npm run test:smoke  # end-to-end against real undici + local servers (routing + 503 retry)
npm run test:global # proves the dispatcher also intercepts Node's GLOBAL fetch
npm run test:load   # plugin entry load with a fake cordis ctx
```
