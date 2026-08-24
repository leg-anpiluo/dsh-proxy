# Changelog

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
- README 新增 npm 安装方式（`dsh plugin add @superfish058/dsh-llm-proxy`）
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
