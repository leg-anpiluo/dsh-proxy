/**
 * The `settings.llm-proxy` locale dictionaries for the 模型代理 section.
 * Keys track exactly the UI-surfaced fields (proxyHost/proxyPort,
 * proxiedModels, retries/retryIntervalMs).
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  nav: '模型代理',
  title: '模型代理（dsh-llm-proxy）',
  description: '选中的模型请求走代理并自动重试。',
  statusLoading: '加载中…',
  statusUnavailable: '设置服务不可用，无法读取或写入代理配置。',
  fieldProxyHost: '代理地址（proxyHost）',
  fieldProxyHostHint: '代理服务器主机或 IP，不必是本机。',
  fieldProxyPort: '代理端口（proxyPort）',
  fieldProxyPortHint: '代理服务端口（1–65535）。',
  fieldProxiedModels: '走代理的模型（proxiedModels）',
  fieldProxiedModelsHint: '从已配置模型中选择需要走代理的；未选中的模型全部直连。',
  fieldRetries: '重试次数（retries）',
  fieldRetriesHint: '请求失败（网络错误 / 429 / 5xx）时的最大重试次数（0–10）。',
  fieldRetryIntervalMs: '重试间隔（retryIntervalMs）',
  fieldRetryIntervalMsHint: '每次重试之间的等待毫秒数（0–60000）。',
  selectModel: '选择模型…',
  selectedModels: '已选择',
  remove: '移除',
  save: '保存',
  saving: '保存中…',
  saved: '已保存，立即生效',
  reset: '恢复默认',
  saveError: '保存失败',
  invalidRange: '端口或数值超出允许范围。',
  invalidEmpty: '代理地址不能为空。',
  expand: '展开',
  collapse: '收起',
}

/** English dictionary, checked complete against the zh key set. */
export const en: Record<keyof typeof zh, string> = {
  nav: 'Proxy Model',
  title: 'Proxy Model (dsh-llm-proxy)',
  description: 'Selected models route through the proxy with automatic retries.',
  statusLoading: 'Loading…',
  statusUnavailable: 'Settings service unavailable; the proxy configuration cannot be read or written.',
  fieldProxyHost: 'Proxy host (proxyHost)',
  fieldProxyHostHint: 'Proxy server hostname or IP; does not have to be this machine.',
  fieldProxyPort: 'Proxy port (proxyPort)',
  fieldProxyPortHint: 'Proxy service port (1–65535).',
  fieldProxiedModels: 'Proxied models (proxiedModels)',
  fieldProxiedModelsHint: 'Pick the models that route through the proxy; unselected models stay direct.',
  fieldRetries: 'Retries (retries)',
  fieldRetriesHint: 'Max retry attempts on failure (network error / 429 / 5xx), 0–10.',
  fieldRetryIntervalMs: 'Retry interval (retryIntervalMs)',
  fieldRetryIntervalMsHint: 'Milliseconds between retry attempts (0–60000).',
  selectModel: 'Select model…',
  selectedModels: 'Selected',
  remove: 'Remove',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved, applied live',
  reset: 'Reset to defaults',
  saveError: 'Save failed',
  invalidRange: 'Port or numeric value out of range.',
  invalidEmpty: 'Proxy host must not be empty.',
  expand: 'Expand',
  collapse: 'Collapse',
}

export type ProxyKey = keyof typeof zh
