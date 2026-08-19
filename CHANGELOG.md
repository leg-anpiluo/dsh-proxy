# Changelog

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
