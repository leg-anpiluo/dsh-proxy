# @superfish058/dsh-llm-proxy

[![npm](https://img.shields.io/npm/v/@superfish058/dsh-llm-proxy)](https://www.npmjs.com/package/@superfish058/dsh-llm-proxy)

DSH 模型代理插件：给 LLM 请求按「目标域名」分流——选中的模型走代理，其余直连，失败自动重试。

## 它是干嘛的

- **按模型走代理**：在 DSH 设置页（插件 → 可配置插件 → 模型代理）勾选需要走代理的模型（如 `deepseek-v4-flash`），该模型的请求自动经 `proxyHost:proxyPort`（默认 `127.0.0.1:7897`，即 Clash）转发；未勾选的模型（DeepSeek、小米、通义等国内 API）保持直连。路由按模型的 **API 地址（baseURL host）** 生效：选中一个模型后，同一地址下的所有模型都会走代理（例如 B.AI 的 `deepseek-v4-flash` 与 `deepseek-v4-flash-vision-exp` 共享 `api.b.ai`）。
- **失败自动重试**：对断连（ECONNRESET 等）、HTTP 429 限流、5xx 错误自动重试（默认 3 次、间隔 1s），减少免费额度被瞬时错误打断。
- **模型列表与官方一致（v1.0.3 / v1.1.0）**：只配了 `apiKeyEnv`、没写 `models` 的 provider（如 `xiaomi`），其模型从 pi-ai 内置目录（`@earendil-works/pi-ai`）回退补齐；`llm-deepseek` 命名空间即使保持默认空文档（`llm-deepseek: {}`）也回退官方内置目录（`https://api.deepseek.com` + `DEEPSEEK_API_KEY`），`deepseek-official/*` 模型开箱可用。勾选列表与 DSH 官方模型选择器完全同步。
- **retryPolicy 镜像（v1.0.3）**：卡片上的 `retries`/`retryIntervalMs` 会镜像进被勾选 provider 的官方 `retryPolicy`（驱动设置页可见的 `(retry/maximum)` 提示），取消勾选自动还原官方默认值——一套配置同时驱动传输层重试与官方重试 UI。
- **多模态模型镜像（v1.0.9）**：DSH 官方模型声明里，部分**支持图像识别**的模型（如 `deepseek-v4-flash-vision-exp`）没有可供用户勾选「图像输入」的配置入口，选中后发图会被 DSH 以 `UNSUPPORTED_CONTENT` 拒绝。在设置卡「多模态模型」区勾选这些模型后，插件把 `image` 写进所属 provider 的模型声明（pi-ai 的 `models[].input` / 目录型 `modelOverrides[].input`，官方 DeepSeek 的 `models[].inputModalities`），使 DSH 允许对该模型发图；取消勾选自动还原官方默认。注意：该功能只对真正支持图像输入的模型（如 vision 模型）有意义，纯文本模型（如 `deepseek-v4-flash`）勾选后 DSH 虽放行，实际请求仍会因模型不支持图像而报错。
- **测试连接（v1.1.0）**：走代理的模型列表每行新增「测试连接」按钮，探测请求走插件自己的全局 dispatcher（即真实代理路径：勾选模型经代理、其余直连），返回 HTTP 状态 / 耗时 / 经代理或直连 / 多模态开启状态；失败时直接显示提供方返回的错误 body（脱敏、截断），如 B.AI 的 `max_tokens` 限制一眼可见。注意：测试走**已保存**的配置——改了勾选后请先点「保存」再测试。
- **保存即生效，无需重启**：设置写入 `llm-proxy` 命名空间后运行时整体替换 dispatcher，不碰 `settings.yaml` 里的供应商配置。冷启动时若 provider 命名空间（`llm-pi-ai`/`llm-deepseek`）尚未注册，插件会带退避重试直到可解析代理域名，不再需要手动"恢复默认再保存"。

## 用什么技术

- **undici 全局 Dispatcher 注入**：`RoutingDispatcher`（按 hostname 路由）+ 官方 `RetryAgent`（重试）包一层自定义 dispatcher 挂到 Node 全局。LLM 请求（OpenAI SDK → undici fetch）自动经过它，位于 LLM 适配器之下、供应商之上。
- **Cordis 插件**：宿主侧注册 `llm-proxy` 设置命名空间（`lib/settings.js`）；浏览器侧设置卡片（`src/client/`，挂 `settings.plugin.item` slot，走官方 transport、bridge 兜底）。
- **客户端构建**：tsdown（Rolldown）打包 `lib/client.js`，经 `window.__ModuleLoader__` 注入前端。

## 适合什么场景

- 国内网络访问**境外模型 API**（如 `api.b.ai`）超时/不可达——代理已就绪，只想让特定模型走。
- **免费额度**被 429/5xx 打断，需要自动重试扛过限流窗口。
- 想**按模型粒度**控制代理，而不是全局开代理连累国内直连 API。

## 安装

```sh
# 方式一：npm 包（v1.0.4 起，含预构建 lib，秒装）
dsh plugin --profile web add @superfish058/dsh-llm-proxy

# 方式二：GitHub 发布产物（v1.0.3 tag，含构建好的 lib；pnpm 会解析为对应提交的 codeload tarball）
dsh plugin --profile web add github:superfish058/dsh-llm-proxy#v1.0.3

# 方式三：本地源码联调（改源码后需 npm run build 重建）
dsh plugin --profile web add C:/path/to/dsh-llm-proxy
```

若提示 build 授权，把 `@superfish058/dsh-llm-proxy` 加进 profile 的 `pnpm-workspace.yaml` → `onlyBuiltDependencies`。装完重启 `dsh web`（托盘退出 → 启动）。

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `proxyHost` / `proxyPort` | `127.0.0.1:7897` | 代理地址（Clash 等），可不在本机 |
| `proxiedModels` | `[]` | 走代理的模型，`<providerId>/<modelId>`，其余直连 |
| `multimodalModels` | `[]` | 多模态镜像：勾选**支持图像识别但官方声明/UI 没有图像输入入口**的模型（如 `deepseek-v4-flash-vision-exp`），插件在所属 provider 声明中标记支持图片输入（pi-ai 写 `input`、官方 DeepSeek 写 `inputModalities`），发图不再被 DSH 拒绝；纯文本模型（如 `deepseek-v4-flash`）勾选无意义；取消勾选自动还原 |
| `retries` / `retryIntervalMs` | `3` / `1000` | 失败重试次数与间隔（ms） |

## 验证

重启后日志出现：

```
dsh-llm-proxy: global dispatcher → RetryAgent(RoutingDispatcher) (proxy=127.0.0.1:7897, ...)
```

模型选择器里选中代理模型，流式响应正常、仅该模型域名走代理即成功。

## 测试

```sh
npm test              # 单元测试（路由 + 重试，无网络）
npm run test:smoke    # 端到端（真实 undici + 本地服务器）
```
