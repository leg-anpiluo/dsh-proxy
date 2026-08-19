# @superfish058/dsh-llm-proxy

DSH 模型代理插件：给 LLM 请求按「目标域名」分流——选中的模型走代理，其余直连，失败自动重试。

## 它是干嘛的

- **按模型走代理**：在 DSH 设置页（插件 → 可配置插件 → 模型代理）勾选需要走代理的模型（如 `deepseek-v4-flash`），该模型的请求自动经 `proxyHost:proxyPort`（默认 `127.0.0.1:7897`，即 Clash）转发；未勾选的模型（DeepSeek、小米、通义等国内 API）保持直连。
- **失败自动重试**：对断连（ECONNRESET 等）、HTTP 429 限流、5xx 错误自动重试（默认 3 次、间隔 1s），减少免费额度被瞬时错误打断。
- **保存即生效，无需重启**：设置写入 `llm-proxy` 命名空间后运行时整体替换 dispatcher，不碰 `settings.yaml` 里的供应商配置。

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
# 方式一：GitHub 发布产物（v1.0.1，含构建好的 lib，无需本地构建）
dsh plugin --profile web add https://codeload.github.com/superfish058/dsh-llm-proxy/tar.gz/v1.0.1

# 方式二：本地源码联调（改源码后需 npm run build 重建）
dsh plugin --profile web add C:/path/to/dsh-llm-proxy
```

CLI 不接受 URL 时，把上面 URL 写进 `~/.dsh/profiles/web/package.json` 的 dependencies 后执行 `pnpm install`。装完重启 `dsh web`（托盘退出 → 启动）。

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `proxyHost` / `proxyPort` | `127.0.0.1:7897` | 代理地址（Clash 等），可不在本机 |
| `proxiedModels` | `[]` | 走代理的模型，`<providerId>/<modelId>`，其余直连 |
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
