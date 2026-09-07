# Changelog

## v2.0.2 (2026-09-06)

- **修复：客户端设置卡在 DSH ≥ 0.1.2-rc.1 上加载失败（store 模块更名）**。宿主 rc.1 起客户端 store 引擎包名从 `@deepseek-ai/dsh-client-runtime` 改为 `@deepseek-ai/dsh-client-store`，插件客户端 bundle 此前以旧模块 id 作为 external（`src/client/settings-scope.ts` / `tsdown.config.ts`），在新宿主上 `require` 解析不到而整体加载失败。现改为 `@deepseek-ai/dsh-client-store`（API 同构：`createSnapshotStore(init, opts)` 返回 `{getSnapshot, subscribe, update, set}`），devDep 与 `test/externals-check.mjs` 的平台模块表同步更新，`lib/client.js` 已重建提交。
- **修复：`ClientContext` 类型来源去依赖**。`src/client/index.ts` 的类型导入从已废弃的 `@deepseek-ai/dsh-client-runtime/client` 改为宿主稳定的 `@deepseek-ai/cordis`（与官方 dsh-client-locale 同款写法）。
- **修复：`settingsNamespace` 跨版本依赖移除（C）**。宿主 `@deepseek-ai/dsh-settings` 在 0.1.2-rc.1 移除了 `settingsNamespace` 导出（改内部 `parseSettingsNamespace`），而本插件声明的 `^0.1.0-rc.7` 范围在宿主发正式版后可能被 npm dedupe 提升到宿主版本导致 `SyntaxError`。现改为本地 kebab-case 校验（正则与宿主逐字节一致），`SettingsConflictError` 冲突识别改 duck-typing（`name`/`code` 双判，跨依赖副本 `instanceof` 恒 false 的问题一并消除）。
- **改进：pi-ai 目录依赖显式声明（F）**。`catalog.js` 动态导入 `@earendil-works/pi-ai/providers/all`，此前未在 `package.json` 声明，纯靠宿主恰好安装才能解析；现声明为 `optionalDependencies`，宿主未装时静默降级行为不变。
- **改进：CI 补全验证（F）**。`.github/workflows/ci.yml` 在 `npm test` 之外新增 `npm run typecheck`、`npm run test:smoke`、`npm run test:smoke:failover`，覆盖此前不在 CI 的类型检查与两套端到端测试。
- README 顶部新增版本兼容声明：客户端要求宿主 ≥ 0.1.2-rc.1，宿主侧逻辑兼容 rc.7+。

## v2.0.1 (2026-09-06)

- **修复：插件卸载后全局 fetch 悬空（teardown）**。`setGlobalDispatcher()` 在 undici 8.x 返回 `undefined`，v2.0.0 的 `previous = setGlobalDispatcher(next)` 因此把 `undefined` 当成了「插件安装前的 dispatcher」：dispose 时 `setGlobalDispatcher(undefined)` 抛 `InvalidArgumentError` 被吞掉，全局 dispatcher 仍指向插件已销毁的栈——宿主进程里之后的**所有** fetch 都会失败，直到重启（插件热重载 / 停用即触发）。现在首次 install 用 `getGlobalDispatcher()` 显式捕获原 dispatcher，teardown 精确还原。
- **修复：响应已开始后的直连失败不再重放**。直连路径在 `onResponseStart` 之后（流式响应进行到一半）发生传输层失败时，failover 层此前会经代理重发整个请求，导致一次 dispatch 向下游投递**两份**响应（重复 `onResponseStart`/data）。现在与 undici `RetryHandler` 一致，用 `headersSent` 守卫直接传播错误（`lib/failover-dispatcher.js`）。
- **改进：保存设置不再掐断进行中的流式请求**。被替换的旧 dispatcher 栈改为优雅退役：立即 `close()`（在途请求在旧栈上正常跑完，新请求走新栈），10 分钟宽限期后才强制 `destroy()` 兜底回收卡死的连接。插件卸载（dispose）仍是立即 destroy——此时语义就是「断开」。
- 新增回归测试：`test/installer.test.js`（teardown 还原原 dispatcher、优雅退役、空 teardown 无副作用）；`test/failover-dispatcher.test.js` 新增「mid-response 失败不回退、下游只收到一份响应生命周期」用例。

## v2.0.0 (2026-09-06)

- **包更名**：npm 包名从 `@superfish058/dsh-llm-proxy` 改为 `@anpiluo/dsh-proxy`（本仓库 fork 自上游 v1.1.0，安装命令相应变为 `dsh plugin --profile web add @anpiluo/dsh-proxy` 或 `github:leg-anpiluo/dsh-proxy#v2.0.0`；client bundle ID 同步更名，设置卡加载不受影响）。
- **直连失败自动回退（failover）**：未走代理的请求（网络搜索、web_fetch、国内模型 API——一切走全局 fetch 且不在「走代理的模型」里的目标）在直连传输层失败（连接拒绝 / DNS 失败 / 超时 / 连接重置，响应未开始）时，自动经代理重发一次（`lib/failover-dispatcher.js`）。走代理的模型不受影响——它们没有直连路径可回退，主代理挂了错误直接暴露，不会被同一个死代理二次重试。默认开启，回退端点默认复用主代理（`proxyHost:proxyPort`），也可用 `failoverProxy` 指定专用回退地址（支持 `http://`、`https://`、`socks5://`，SOCKS5 走 undici 8 原生 `Socks5ProxyAgent`）。该功能吸收了 dsh-proxy-switch 插件的核心场景，且在 dispatcher 层实现（TLS 校验正常、连接池复用、无手写 body 重放）。
- **失败主机负缓存（negativeCacheTtlMs）**：某地址直连失败、经代理成功后，在 TTL 窗口内（默认 60s）后续请求直接走代理，不再重复支付直连超时；窗口内一次直连成功即清除条目，直连恢复可自动切回。设为 0 则每次请求都先试直连。
- **重试分工收窄**：`RetryAgent` 的传输层错误码从 9 个收窄为 `ECONNRESET` / `EPIPE` / `UND_ERR_SOCKET`（连接已建立后的中途断开）；CONNECT 级失败（ECONNREFUSED / ENOTFOUND / 超时等）归 failover 层处理，避免死路径被「重试 3 次 × 回退 1 次」放大锤打。429/5xx 重试语义不变。
- **设置卡「直连回退」分区**：新增 `failoverEnabled`（开关）、`failoverProxy`（回退地址，留空复用主代理，格式校验 http/https/socks5）、`negativeCacheTtlMs` 三个配置项，保存即生效；开关关闭时子表单置灰。
- dispatcher 栈变为 `RetryAgent(FailoverDispatcher(RoutingDispatcher))`，日志相应更新；`RoutingDispatcher` 仅重构出 `routeOf()`（行为不变，原 11 个路由测试原样通过）。
- 新增测试 `test/failover-dispatcher.test.js`（21 个用例，fake undici shim）与 `test/failover-smoke-test.mjs`（12 项端到端检查，真实 undici + 本地双服务器：直连存活、直连死亡回退、负缓存命中与过期、禁用回退、流式 body 不回退）。

## v1.1.0 (2026-08-24)

- **测试连接**：走代理的模型列表每行新增「测试连接」按钮。宿主侧新增 loopback 桥接端点 `POST /api/dsh-llm-proxy/settings/test`，对被勾选模型发一个最小 `chat/completions` 探测请求（走插件自己的全局 dispatcher，即真实代理路径），返回 HTTP 状态 / 耗时 / 是否经代理 / 多模态是否开启；网络超时、认证失败、限流、服务端错误都有明确提示（`lib/connection-test.js`）。
- 凭据不出宿主机：探测请求的 `Authorization` 头在宿主侧组装，卡片只收到结构化结果字段。
- 客户端卡片每行显示 ✓ 连接成功（状态 · 耗时 · 经代理/直连 · 多模态）或 ✗ 连接失败（原因），新增 zh/en 文案与样式。
- **测试连接可靠性修复**：
  - `findTestTarget` 改为基于 `listModels` 匹配，设置卡 UI 能勾选的模型测试必然可解析；`llm-deepseek` 为空文档（`llm-deepseek: {}`）时回退官方内置目录（默认 `https://api.deepseek.com` + `DEEPSEEK_API_KEY`），官方 DeepSeek 模型不再报「未找到模型」。
  - 测试失败时读取并脱敏显示提供方响应 body（截断 2KB），HTTP 400/401/… 直接给出真实原因而不是只有状态码。
  - 探测请求 `max_tokens` 从 1 调整为 8：B.AI 等提供方要求 `max_tokens > 2`，旧值会返回 HTTP 400。
  - 新增 `lib/deepseek-official.js` 共享 llm-deepseek 官方默认（baseURL / apiKeyEnv / 内置模型目录），`listModels` / `findTestTarget` / `resolveProxyHosts` 三处统一回退。
  - 设置卡文案精简：测试连接提示（小字，注明「走已保存配置、改勾选后先保存」）、走代理按 API 地址整组生效、多模态说明。
- 新增测试 `test/connection-test.test.js`（19 个用例）。

## v1.0.9 (2026-08-24)

- **多模态模型镜像**：新增设置项 `multimodalModels`。用户在设置卡「多模态模型」区勾选模型后，宿主侧 `syncMultimodal()` 会把 `[text, image]` 镜像写进所属 provider 命名空间（`llm-pi-ai` 的 `models[].input` 或目录型 `modelOverrides[].input`；`llm-deepseek` 的 `models[].inputModalities`），取消勾选自动还原官方默认；已声明为文本的模型发图不再被 `UNSUPPORTED_CONTENT` 拒绝（对应 B.AI / 官方识图模型）。
- 客户端卡片新增「多模态模型」区（`ProxyModelCard.tsx`）+ zh/en 文案 + 🖼 多模态徽章。
- **深色模式保存按钮修复**：主按钮文字色改用 DSH 官方主按钮一致的 `--dsw-alias-label-primary-foreground`（替换此前会让深色下偏灰的 `--dsw-alias-label-primary-inverted`），深色下文字从混浊的 `#353638` 修正为清晰近黑 `#0f1115`，与平台标准完全一致。
- **设置卡「一直加载中」修复**：`LlmProxySettingsBinder` 兼容层此前只在官方 scope 报告 `unavailable` 时才启动桥接兜底，且 `project()` 会把「官方仍 loading」直接透出——一旦官方 describe 镜像没有沉降出本命名空间的视图，卡片会永久停在「加载中」，即使桥接已经 `ready`。现改为只要官方不是 `ready` 就启动桥接，并在取值时优先任意已 `ready` 的来源（官方 → 桥接），构建时也先 `publish()` 一次，避免卡在初始 loading。
- 原生 `<select>/<input>` 深色模式修复（`color-scheme` + `body[data-ds-dark-theme]` 兜底）。
- 新增测试 `test/multimodal-mirror.test.js`（5 个用例）。

## v1.0.8 (2026-08-21)

- **深色模式修复**：客户端卡片 CSS 用了 7 个主题不存在的别名变量（`--dsw-alias-line-default` / `line-strong` / `accent-default` / `accent-strong` / `bg-subtle` / `danger-default` / `success-default`），深色模式下全部回退浅色硬编码，导致按钮文字浅色+浅底不可读、边框浅色刺眼；已替换为主题真实存在的变量（`border-l2` / `border-l3` / `state-business-primary` / `state-error-primary` / `state-success-primary` / `button-primary-fill` / `button-primary-hover` / `bg-layer-2`），主按钮文字色改用 `--dsw-alias-label-primary-inverted`（浅色=白字，深色=深灰字）

## v1.0.7 (2026-08-19)

- **rc.7 兼容修复**：官方 `settings.plugin.item` 槽位由 `list`（要求 `id`）改为 `keyed`（要求 `key`），注册参数同步改为 `key: 'llm-proxy'`，修复 rc.7 上「Failed to load plugins … keyed slot requires options.key」
- 构建依赖（`dsh-settings` / `dsh-client-*`）升至 `0.1.0-rc.7`，类型声明与 rc.7 运行时一致

## v1.0.6 (2026-08-19)

- 客户端卡片文案字典与官方 `settings.plugins` 规范对齐（小版本直发，未单独记录）

## v1.0.5 (2026-08-19)

- 客户端卡片文案字典与官方 `settings.plugins` 规范对齐（小版本直发，未单独记录）

## v1.0.4 (2026-08-19)

- npm 发布元数据：新增 `repository` / `publishConfig.access=public` / `author` / `homepage` / `bugs`
- README 新增 npm 安装方式（`dsh plugin add @anpiluo/dsh-proxy`）
- 新增 GitHub Actions CI（build + test）

## v1.0.3 (2026-08-19)

- pi-ai 目录回退：只配了 `apiKeyEnv`、未写 `models` 的 provider（如 `xiaomi`），模型列表从 pi-ai 内置目录补齐，与官方模型选择器同步
- retryPolicy 镜像：卡片 `retries`/`retryIntervalMs` 镜像进选中 provider 官方 `retryPolicy`，取消勾选自动还原

## v1.0.2 (2026-08-18)

- 冷启动 provider 命名空间未注册时的退避重试，不再需要手动「恢复默认再保存」

## v1.0.1 (2026-08-18)

- 客户端 bundle id 作用域化；精简中文 README

## v1.0.0 (2026-08-18)

- 首版：按模型走代理（Clash 等）+ 失败自动重试，设置页实时生效
