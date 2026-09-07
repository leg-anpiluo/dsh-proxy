window.__ModuleLoader__.load({
	id: "@anpiluo/dsh-proxy",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_cordis = require("@deepseek-ai/cordis");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		//#region \0dsh-css:/home/anpiluo/dsh-llm-proxy/src/client/proxy-model.module.css.mjs
		const css = ".YqJpcW_card{border:1px solid var(--dsw-alias-border-l2,#d0d7de);background:var(--dsw-alias-bg-layer-3,#fff);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.YqJpcW_card:hover{border-color:var(--dsw-alias-label-dimmed,#8b949e)}.YqJpcW_cardOpen{background:var(--dsw-alias-bg-layer-2,#f6f8fa);border-color:var(--dsw-alias-label-dimmed,#8b949e)}.YqJpcW_header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.YqJpcW_header:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4f8cff);outline-offset:-2px}.YqJpcW_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.YqJpcW_name{color:var(--dsw-alias-label-primary,#1f2329);font-size:15px;font-weight:600;line-height:1.4}.YqJpcW_description{color:var(--dsw-alias-label-tertiary,#6b7280);font-size:13px;line-height:1.5}.YqJpcW_chevron{color:var(--dsw-alias-label-tertiary,#6b7280);flex:none;transition:transform .16s}.YqJpcW_chevronOpen{transform:rotate(180deg)}.YqJpcW_body{border-top:1px solid var(--dsw-alias-border-l2,#d0d7de);flex-direction:column;gap:14px;margin:0 16px;padding:14px 0 8px;display:flex}.YqJpcW_status{color:var(--dsw-alias-label-tertiary,#6b7280);margin:4px 0;font-size:13px;line-height:1.5}.YqJpcW_field{flex-direction:column;gap:4px;display:flex}.YqJpcW_fieldRow{gap:10px;display:flex}.YqJpcW_fieldRow>.YqJpcW_field{flex:1 1 0;min-width:0}.YqJpcW_fieldRowDisabled{opacity:.5}.YqJpcW_checkRow{cursor:pointer;user-select:none;align-items:center;gap:8px;display:inline-flex}.YqJpcW_checkbox{width:15px;height:15px;accent-color:var(--dsw-alias-state-business-primary,#4f8cff);cursor:pointer}.YqJpcW_checkLabel,.YqJpcW_fieldLabel{color:var(--dsw-alias-label-primary,#1f2329);font-size:13px;font-weight:500}.YqJpcW_fieldHint{color:var(--dsw-alias-label-tertiary,#6b7280);font-size:12px;line-height:1.45}.YqJpcW_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#d0d7de);background:var(--dsw-alias-bg-layer-2,#f6f8fa);width:100%;color:var(--dsw-alias-label-primary,#1f2329);color-scheme:light;border-radius:6px;padding:6px 8px;font-size:13px}.YqJpcW_input:focus{outline:2px solid var(--dsw-alias-state-business-primary,#4f8cff);outline-offset:-1px}.YqJpcW_textarea{resize:vertical;min-height:56px;font-family:inherit;}.YqJpcW_rowList{flex-direction:column;gap:6px;margin:0;padding:0;list-style:none;display:flex}.YqJpcW_row{align-items:center;gap:6px;display:flex}.YqJpcW_rowLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-primary,#1f2329);flex:1 1 0;font-size:13px;overflow:hidden}.YqJpcW_select{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#d0d7de);background:var(--dsw-alias-bg-layer-2,#f6f8fa);width:100%;color:var(--dsw-alias-label-primary,#1f2329);color-scheme:light;border-radius:6px;padding:6px 8px;font-size:13px}.YqJpcW_select:focus{outline:2px solid var(--dsw-alias-state-business-primary,#4f8cff);outline-offset:-1px}body[data-ds-dark-theme] .YqJpcW_input,body[data-ds-dark-theme] .YqJpcW_select{color-scheme:dark}.YqJpcW_select option{background:var(--dsw-alias-bg-layer-2,#f6f8fa);color:var(--dsw-alias-label-primary,#1f2329)}.YqJpcW_rowInput{flex:1 1 0;}.YqJpcW_rowInputNarrow{flex:0 110px;}.YqJpcW_rowRemove{border:1px solid var(--dsw-alias-border-l2,#d0d7de);background:var(--dsw-alias-bg-layer-2,#f6f8fa);color:var(--dsw-alias-label-secondary,#4b5563);cursor:pointer;border-radius:6px;flex:none;padding:4px 8px;font-size:12px}.YqJpcW_rowRemove:hover{border-color:var(--dsw-alias-state-error-primary,#d1242f);color:var(--dsw-alias-state-error-primary,#d1242f)}.YqJpcW_rowAdd{border:1px dashed var(--dsw-alias-border-l3,#a6adb4);color:var(--dsw-alias-label-secondary,#4b5563);cursor:pointer;background:0 0;border-radius:6px;align-self:flex-start;padding:4px 10px;font-size:12px}.YqJpcW_rowAdd:hover{border-color:var(--dsw-alias-state-business-primary,#4f8cff);color:var(--dsw-alias-state-business-primary,#4f8cff)}.YqJpcW_footer{align-items:center;gap:10px;margin-top:2px;display:flex}.YqJpcW_primaryButton{background:var(--dsw-alias-button-primary-fill,#4f8cff);color:var(--dsw-alias-label-primary-foreground,#fff);cursor:pointer;border:none;border-radius:6px;padding:6px 14px;font-size:13px;font-weight:500}.YqJpcW_primaryButton:hover{background:var(--dsw-alias-button-primary-hover,#3b76e0)}.YqJpcW_primaryButton:disabled{opacity:.6;cursor:default}.YqJpcW_ghostButton{border:1px solid var(--dsw-alias-border-l2,#d0d7de);background:var(--dsw-alias-bg-layer-2,#f6f8fa);color:var(--dsw-alias-label-secondary,#4b5563);cursor:pointer;border-radius:6px;padding:6px 12px;font-size:13px}.YqJpcW_ghostButton:hover{border-color:var(--dsw-alias-border-l3,#a6adb4)}.YqJpcW_saveStatus{font-size:12px;line-height:1.4}.YqJpcW_saveStatusOk{color:var(--dsw-alias-state-success-primary,#1a7f37)}.YqJpcW_saveStatusError{color:var(--dsw-alias-state-error-primary,#d1242f)}.YqJpcW_saveStatusHint{color:var(--dsw-alias-label-tertiary,#6b7280)}.YqJpcW_testBarHint{color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px;line-height:1.4}.YqJpcW_rowWrap{flex-direction:column;gap:2px;display:flex}.YqJpcW_rowTest{border:1px solid var(--dsw-alias-border-l2,#d0d7de);background:var(--dsw-alias-bg-layer-2,#f6f8fa);color:var(--dsw-alias-label-secondary,#4b5563);cursor:pointer;border-radius:6px;flex:none;padding:4px 8px;font-size:12px}.YqJpcW_rowTest:hover{border-color:var(--dsw-alias-state-business-primary,#4f8cff);color:var(--dsw-alias-state-business-primary,#4f8cff)}.YqJpcW_rowTest:disabled{opacity:.55;cursor:default}.YqJpcW_testResult{padding-left:2px;font-size:12px;line-height:1.4}.YqJpcW_testResultOk{color:var(--dsw-alias-state-success-primary,#1a7f37)}.YqJpcW_testResultError{color:var(--dsw-alias-state-error-primary,#d1242f)}";
		const tagId = "@anpiluo/dsh-proxy/proxy-model.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@anpiluo/dsh-proxy";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var proxy_model_module_css_default = {
			"rowWrap": "YqJpcW_rowWrap",
			"fieldLabel": "YqJpcW_fieldLabel",
			"rowAdd": "YqJpcW_rowAdd",
			"testResultOk": "YqJpcW_testResultOk",
			"primaryButton": "YqJpcW_primaryButton",
			"checkbox": "YqJpcW_checkbox",
			"saveStatusOk": "YqJpcW_saveStatusOk",
			"field": "YqJpcW_field",
			"chevron": "YqJpcW_chevron",
			"testResult": "YqJpcW_testResult",
			"saveStatus": "YqJpcW_saveStatus",
			"rowTest": "YqJpcW_rowTest",
			"cardOpen": "YqJpcW_cardOpen",
			"rowList": "YqJpcW_rowList",
			"name": "YqJpcW_name",
			"description": "YqJpcW_description",
			"saveStatusHint": "YqJpcW_saveStatusHint",
			"status": "YqJpcW_status",
			"rowRemove": "YqJpcW_rowRemove",
			"fieldRow": "YqJpcW_fieldRow",
			"rowInputNarrow": "YqJpcW_rowInputNarrow",
			"input": "YqJpcW_input",
			"rowLabel": "YqJpcW_rowLabel",
			"checkLabel": "YqJpcW_checkLabel",
			"fieldHint": "YqJpcW_fieldHint",
			"select": "YqJpcW_select",
			"rowInput": "YqJpcW_rowInput",
			"testResultError": "YqJpcW_testResultError",
			"checkRow": "YqJpcW_checkRow",
			"footer": "YqJpcW_footer",
			"row": "YqJpcW_row",
			"card": "YqJpcW_card",
			"header": "YqJpcW_header",
			"body": "YqJpcW_body",
			"headText": "YqJpcW_headText",
			"ghostButton": "YqJpcW_ghostButton",
			"chevronOpen": "YqJpcW_chevronOpen",
			"saveStatusError": "YqJpcW_saveStatusError",
			"textarea": "YqJpcW_textarea",
			"testBarHint": "YqJpcW_testBarHint",
			"fieldRowDisabled": "YqJpcW_fieldRowDisabled"
		};
		//#endregion
		//#region src/client/ProxyModelCard.tsx
		/**
		* 模型代理 plugin card: one card inside 设置 → 插件 → 可配置插件
		* (the `settings.plugin.item` slot, declared at runtime by
		* @deepseek-ai/dsh-client-ui-settings-plugins). The header names the plugin
		* and discloses the configurable items in place — the proxy endpoint
		* (host + port), the 走代理的模型 multi-select (populated from the configured
		* model list via the host bridge), and the retry policy (retries + interval).
		* Written through the llm-proxy settings scope (official path with the rc.6
		* bridge fallback). Changes apply live on the host — no restart needed.
		*
		* Everything else stays on the DIRECT path by default; only the selected
		* models' baseURL hosts route through the proxy. Loopback is always direct.
		*/
		/** Schema defaults mirrored from lib/index.js (reset target + base merge). */
		const DEFAULTS = {
			proxyHost: "127.0.0.1",
			proxyPort: 7897,
			proxiedModels: [],
			multimodalModels: [],
			retries: 3,
			retryIntervalMs: 1e3,
			failoverEnabled: true,
			failoverProxy: "",
			negativeCacheTtlMs: 6e4
		};
		/** Fields surfaced in the UI, in write order. */
		const UI_FIELDS = [
			"proxyHost",
			"proxyPort",
			"proxiedModels",
			"multimodalModels",
			"retries",
			"retryIntervalMs",
			"failoverEnabled",
			"failoverProxy",
			"negativeCacheTtlMs"
		];
		/** JSON-compatible deep equality (the card values are plain JSON). */
		function deepEqual(a, b) {
			return JSON.stringify(a) === JSON.stringify(b);
		}
		/** Build a fresh empty form. */
		function emptyForm() {
			return {
				proxyHost: "",
				proxyPort: String(DEFAULTS.proxyPort),
				proxiedModels: [],
				multimodalModels: [],
				retries: String(DEFAULTS.retries),
				retryIntervalMs: String(DEFAULTS.retryIntervalMs),
				failoverEnabled: DEFAULTS.failoverEnabled,
				failoverProxy: DEFAULTS.failoverProxy,
				negativeCacheTtlMs: String(DEFAULTS.negativeCacheTtlMs)
			};
		}
		/** Hydrate the form from a resolved config value. */
		function formFromConfig(value) {
			return {
				proxyHost: value.proxyHost ?? "",
				proxyPort: String(value.proxyPort ?? DEFAULTS.proxyPort),
				proxiedModels: [...value.proxiedModels ?? []],
				multimodalModels: [...value.multimodalModels ?? []],
				retries: String(value.retries ?? DEFAULTS.retries),
				retryIntervalMs: String(value.retryIntervalMs ?? DEFAULTS.retryIntervalMs),
				failoverEnabled: value.failoverEnabled ?? DEFAULTS.failoverEnabled,
				failoverProxy: value.failoverProxy ?? DEFAULTS.failoverProxy,
				negativeCacheTtlMs: String(value.negativeCacheTtlMs ?? DEFAULTS.negativeCacheTtlMs)
			};
		}
		/** Extract one top-level field's plain-JSON value from the form. */
		function fieldFromForm(form, field) {
			switch (field) {
				case "proxyHost": return form.proxyHost.trim();
				case "proxyPort": return Number(form.proxyPort);
				case "proxiedModels": return [...form.proxiedModels];
				case "multimodalModels": return [...form.multimodalModels];
				case "retries": return Number(form.retries);
				case "retryIntervalMs": return Number(form.retryIntervalMs);
				case "failoverEnabled": return form.failoverEnabled === true;
				case "failoverProxy": return form.failoverProxy.trim();
				case "negativeCacheTtlMs": return Number(form.negativeCacheTtlMs);
			}
		}
		/** Validate the draft; returns an error key or null. */
		function validateForm(form) {
			if (form.proxyHost.trim() === "") return "invalidEmpty";
			if (!/^\d+$/.test(form.proxyPort.trim())) return "invalidRange";
			const port = Number(form.proxyPort);
			if (port < 1 || port > 65535) return "invalidRange";
			if (!/^\d+$/.test(form.retries.trim())) return "invalidRange";
			if (!/^\d+$/.test(form.retryIntervalMs.trim())) return "invalidRange";
			if (Number(form.retries) > 10) return "invalidRange";
			if (Number(form.retryIntervalMs) > 6e4) return "invalidRange";
			if (!/^\d+$/.test(form.negativeCacheTtlMs.trim())) return "invalidRange";
			if (Number(form.negativeCacheTtlMs) > 36e5) return "invalidRange";
			const failoverProxy = form.failoverProxy.trim();
			if (failoverProxy !== "" && !/^https?:\/\//.test(failoverProxy) && !/^socks5?:\/\//.test(failoverProxy)) return "invalidProxyUrl";
			return null;
		}
		/** Compute the field writes that land the form on the resolved value. */
		function diffWrites(form, snapshot) {
			const value = snapshot.value;
			const base = snapshot.base;
			const writes = [];
			for (const field of UI_FIELDS) {
				const next = fieldFromForm(form, field);
				const current = value?.[field];
				if (deepEqual(next, current)) continue;
				const baseValue = base?.[field];
				if (deepEqual(next, baseValue)) writes.push({
					field,
					op: "unset"
				});
				else writes.push({
					field,
					op: "set",
					value: next
				});
			}
			return writes;
		}
		/** Merge the composition base over the schema defaults (reset target). */
		function mergeDefaults(base) {
			return {
				proxyHost: base?.proxyHost ?? DEFAULTS.proxyHost,
				proxyPort: base?.proxyPort ?? DEFAULTS.proxyPort,
				proxiedModels: base?.proxiedModels ?? DEFAULTS.proxiedModels,
				multimodalModels: base?.multimodalModels ?? DEFAULTS.multimodalModels,
				retries: base?.retries ?? DEFAULTS.retries,
				retryIntervalMs: base?.retryIntervalMs ?? DEFAULTS.retryIntervalMs,
				failoverEnabled: base?.failoverEnabled ?? DEFAULTS.failoverEnabled,
				failoverProxy: base?.failoverProxy ?? DEFAULTS.failoverProxy,
				negativeCacheTtlMs: base?.negativeCacheTtlMs ?? DEFAULTS.negativeCacheTtlMs
			};
		}
		/** One labeled field; numeric fields use type="number" so non-digits are rejected by the browser. */
		function TextField(props) {
			const { label, hint, value, onChange, placeholder, testId, type = "text", min, max, step } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: proxy_model_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: proxy_model_module_css_default.fieldLabel,
						children: label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: proxy_model_module_css_default.input,
						type,
						value,
						placeholder,
						min,
						max,
						step,
						"data-testid": testId,
						onChange: (event) => onChange(event.target.value)
					}),
					hint !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: proxy_model_module_css_default.fieldHint,
						children: hint
					})
				]
			});
		}
		/** The card body: the configurable items form plus the save/reset footer. */
		function CardBody(props) {
			const { scope, useSnapshot, t } = props;
			const snapshot = useSnapshot();
			const [form, setForm] = (0, react.useState)(() => emptyForm());
			const [saving, setSaving] = (0, react.useState)(false);
			const [saved, setSaved] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const hydratedRef = (0, react.useRef)(false);
			const [models, setModels] = (0, react.useState)([]);
			const [modelsError, setModelsError] = (0, react.useState)(null);
			const [testingKey, setTestingKey] = (0, react.useState)(null);
			const [testResults, setTestResults] = (0, react.useState)({});
			(0, react.useEffect)(() => {
				if (snapshot.status === "ready" && !hydratedRef.current) {
					hydratedRef.current = true;
					setForm(formFromConfig(snapshot.value));
				}
			}, [snapshot.status]);
			(0, react.useEffect)(() => {
				if (models.length > 0 || modelsError !== null) return;
				let cancelled = false;
				scope.listModels().then((rows) => {
					if (!cancelled) setModels(rows);
				}).catch(() => {
					if (!cancelled) setModelsError(t("statusUnavailable"));
				});
				return () => {
					cancelled = true;
				};
			}, [
				models.length,
				modelsError,
				scope,
				t
			]);
			if (snapshot.status === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: proxy_model_module_css_default.status,
				children: t("statusLoading")
			});
			if (snapshot.status === "unavailable") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: proxy_model_module_css_default.status,
				children: t("statusUnavailable")
			});
			const handleSave = async () => {
				const validation = validateForm(form);
				if (validation !== null) {
					setSaved(false);
					setError(t(validation));
					return;
				}
				const writes = diffWrites(form, snapshot);
				if (writes.length === 0) {
					setSaved(true);
					setError(null);
					return;
				}
				setSaving(true);
				setError(null);
				const result = await scope.mutate(writes);
				setSaving(false);
				if (result.ok) setSaved(true);
				else {
					setSaved(false);
					setError(result.message ?? t("saveError"));
				}
			};
			const handleReset = async () => {
				setSaving(true);
				setError(null);
				const result = await scope.mutate(UI_FIELDS.map((field) => ({
					field,
					op: "unset"
				})));
				setSaving(false);
				if (result.ok) {
					setForm(formFromConfig(mergeDefaults(snapshot.base)));
					setSaved(true);
				} else {
					setSaved(false);
					setError(result.message ?? t("saveError"));
				}
			};
			const toggleModel = (key) => {
				setSaved(false);
				const selected = form.proxiedModels.includes(key) ? form.proxiedModels.filter((k) => k !== key) : [...form.proxiedModels, key];
				setForm({
					...form,
					proxiedModels: selected
				});
			};
			const toggleMultimodal = (key) => {
				setSaved(false);
				const selected = form.multimodalModels.includes(key) ? form.multimodalModels.filter((k) => k !== key) : [...form.multimodalModels, key];
				setForm({
					...form,
					multimodalModels: selected
				});
			};
			const handleTest = async (key) => {
				setTestingKey(key);
				const result = await scope.test(key);
				setTestResults((previous) => ({
					...previous,
					[key]: result
				}));
				setTestingKey(null);
			};
			/** One-line test detail: ✓ 连接成功 · 200 · 38ms · 经代理 · 多模态已开启 / ✗ 连接失败：… */
			const formatTestDetail = (result) => {
				if (result.ok) {
					const parts = [];
					if (typeof result.status === "number") parts.push(String(result.status));
					if (typeof result.latencyMs === "number") parts.push(`${result.latencyMs}ms`);
					parts.push(result.viaProxy ? t("testViaProxy") : t("testDirect"));
					if (result.multimodal) parts.push(t("testMultimodalOn"));
					return parts.length > 0 ? ` · ${parts.join(" · ")}` : "";
				}
				return `：${result.message ?? result.code ?? t("testFail")}`;
			};
			/** Display label for a model row: `[厂商] 模型名`; the vendor prefix is
			* dropped when the model name already carries it (e.g. B.AI names are
			* already "deepseek-v4-flash（B.AI）", so the bracketed prefix would just
			* repeat the same text). */
			const rowLabel = (row) => row.providerLabel !== "" && !row.name.includes(row.providerLabel) ? `[${row.providerLabel}] ${row.name}` : row.name;
			/**
			* Models still selectable (not yet proxied), in config order. Every listed
			* model is offered regardless of whether its provider already resolves a
			* baseURL host: a provider without one simply routes nothing until the user
			* fills its baseURL in the Models page (the host resolver skips empty hosts
			* instead of erroring), so hiding those rows only made the list look
			* partial.
			*/
			const selectableModels = () => models.filter((row) => !form.proxiedModels.includes(row.key));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: proxy_model_module_css_default.body,
				"data-testid": "proxy-model-form",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: proxy_model_module_css_default.fieldRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
							label: t("fieldProxyHost"),
							hint: t("fieldProxyHostHint"),
							value: form.proxyHost,
							placeholder: DEFAULTS.proxyHost,
							testId: "field-proxyHost",
							onChange: (value) => {
								setSaved(false);
								setForm({
									...form,
									proxyHost: value
								});
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
							label: t("fieldProxyPort"),
							hint: t("fieldProxyPortHint"),
							value: form.proxyPort,
							placeholder: String(DEFAULTS.proxyPort),
							testId: "field-proxyPort",
							type: "number",
							min: 1,
							max: 65535,
							step: 1,
							onChange: (value) => {
								setSaved(false);
								setForm({
									...form,
									proxyPort: value
								});
							}
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: proxy_model_module_css_default.field,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: proxy_model_module_css_default.fieldLabel,
								children: t("fieldProxiedModels")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: proxy_model_module_css_default.fieldHint,
								children: t("fieldProxiedModelsHint")
							}),
							modelsError !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: proxy_model_module_css_default.status,
								children: modelsError
							}) : models.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: proxy_model_module_css_default.status,
								children: t("statusLoading")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: proxy_model_module_css_default.rowList,
								children: form.proxiedModels.map((key) => {
									const row = models.find((m) => m.key === key);
									const result = testResults[key];
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
										className: proxy_model_module_css_default.rowWrap,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: proxy_model_module_css_default.row,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: proxy_model_module_css_default.rowLabel,
													children: row ? rowLabel(row) : key
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: proxy_model_module_css_default.rowTest,
													"data-testid": "test-proxied-model",
													disabled: testingKey !== null,
													onClick: () => {
														handleTest(key);
													},
													children: testingKey === key ? t("testing") : t("test")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: proxy_model_module_css_default.rowRemove,
													"data-testid": "remove-proxied-model",
													onClick: () => toggleModel(key),
													children: t("remove")
												})
											]
										}), result !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: `${proxy_model_module_css_default.testResult} ${result.ok ? proxy_model_module_css_default.testResultOk : proxy_model_module_css_default.testResultError}`,
											"data-testid": "test-proxied-result",
											children: [
												result.ok ? "✓ " : "✗ ",
												result.ok ? t("testOk") : t("testFail"),
												formatTestDetail(result)
											]
										})]
									}, key);
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								className: proxy_model_module_css_default.select,
								"data-testid": "add-proxied-model",
								value: "",
								disabled: models.length === 0,
								onChange: (event) => {
									if (event.target.value !== "") toggleModel(event.target.value);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "",
									children: t("selectModel")
								}), selectableModels().map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: row.key,
									children: rowLabel(row)
								}, row.key))]
							}),
							form.proxiedModels.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: proxy_model_module_css_default.testBarHint,
								children: t("testBarHint")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: proxy_model_module_css_default.field,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: proxy_model_module_css_default.fieldLabel,
								children: t("fieldMultimodalModels")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: proxy_model_module_css_default.fieldHint,
								children: t("fieldMultimodalModelsHint")
							}),
							modelsError !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: proxy_model_module_css_default.status,
								children: modelsError
							}) : models.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: proxy_model_module_css_default.status,
								children: t("statusLoading")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: proxy_model_module_css_default.rowList,
								children: form.multimodalModels.map((key) => {
									const row = models.find((m) => m.key === key);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
										className: proxy_model_module_css_default.row,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: proxy_model_module_css_default.rowLabel,
											children: row ? rowLabel(row) : key
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: proxy_model_module_css_default.rowRemove,
											"data-testid": "remove-multimodal-model",
											onClick: () => toggleMultimodal(key),
											children: t("remove")
										})]
									}, key);
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								className: proxy_model_module_css_default.select,
								"data-testid": "add-multimodal-model",
								value: "",
								disabled: models.length === 0,
								onChange: (event) => {
									if (event.target.value !== "") toggleMultimodal(event.target.value);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "",
									children: t("selectModel")
								}), models.filter((row) => !form.multimodalModels.includes(row.key)).map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
									value: row.key,
									children: [rowLabel(row), row.inputModalities.includes("image") ? `（${t("multimodalBadge")}）` : ""]
								}, row.key))]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: proxy_model_module_css_default.fieldRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
							label: t("fieldRetries"),
							hint: t("fieldRetriesHint"),
							value: form.retries,
							placeholder: String(DEFAULTS.retries),
							testId: "field-retries",
							type: "number",
							min: 0,
							max: 10,
							step: 1,
							onChange: (value) => {
								setSaved(false);
								setForm({
									...form,
									retries: value
								});
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
							label: t("fieldRetryIntervalMs"),
							hint: t("fieldRetryIntervalMsHint"),
							value: form.retryIntervalMs,
							placeholder: String(DEFAULTS.retryIntervalMs),
							testId: "field-retryIntervalMs",
							type: "number",
							min: 0,
							max: 6e4,
							step: 1,
							onChange: (value) => {
								setSaved(false);
								setForm({
									...form,
									retryIntervalMs: value
								});
							}
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: proxy_model_module_css_default.field,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: proxy_model_module_css_default.fieldLabel,
								children: t("fieldFailoverEnabled")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: proxy_model_module_css_default.checkRow,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									className: proxy_model_module_css_default.checkbox,
									"data-testid": "field-failoverEnabled",
									checked: form.failoverEnabled,
									onChange: (event) => {
										setSaved(false);
										setForm({
											...form,
											failoverEnabled: event.target.checked
										});
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: proxy_model_module_css_default.checkLabel,
									children: form.failoverEnabled ? t("failoverOn") : t("failoverOff")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: proxy_model_module_css_default.fieldHint,
								children: t("fieldFailoverEnabledHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: form.failoverEnabled ? proxy_model_module_css_default.fieldRow : proxy_model_module_css_default.fieldRowDisabled,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
									label: t("fieldFailoverProxy"),
									hint: t("fieldFailoverProxyHint"),
									value: form.failoverProxy,
									placeholder: `${DEFAULTS.proxyHost}:${DEFAULTS.proxyPort}`,
									testId: "field-failoverProxy",
									onChange: (value) => {
										setSaved(false);
										setForm({
											...form,
											failoverProxy: value
										});
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
									label: t("fieldNegativeCacheTtlMs"),
									hint: t("fieldNegativeCacheTtlMsHint"),
									value: form.negativeCacheTtlMs,
									placeholder: String(DEFAULTS.negativeCacheTtlMs),
									testId: "field-negativeCacheTtlMs",
									type: "number",
									min: 0,
									max: 36e5,
									step: 1e3,
									onChange: (value) => {
										setSaved(false);
										setForm({
											...form,
											negativeCacheTtlMs: value
										});
									}
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: proxy_model_module_css_default.footer,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: proxy_model_module_css_default.primaryButton,
								"data-testid": "save-proxy-model",
								disabled: saving || !snapshot.writable,
								onClick: () => {
									handleSave();
								},
								children: saving ? t("saving") : t("save")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: proxy_model_module_css_default.ghostButton,
								"data-testid": "reset-proxy-model",
								disabled: saving || !snapshot.writable,
								onClick: () => {
									handleReset();
								},
								children: t("reset")
							}),
							saved && !error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: `${proxy_model_module_css_default.saveStatus} ${proxy_model_module_css_default.saveStatusOk}`,
								children: t("saved")
							}),
							error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: `${proxy_model_module_css_default.saveStatus} ${proxy_model_module_css_default.saveStatusError}`,
								children: [
									t("saveError"),
									"：",
									error
								]
							})
						]
					})
				]
			});
		}
		/**
		* The 模型代理 plugin card: a header naming the plugin over a line describing
		* what its settings govern, disclosing the configurable items in place.
		* Renders nothing (returns null) until the slot outlet supplies the inject
		* face; the section itself stacks cards and reports their count.
		*/
		function ProxyModelCard(props) {
			const { scope, useSnapshot, t } = props;
			const [open, setOpen] = (0, react.useState)(false);
			if (scope === void 0 || useSnapshot === void 0 || t === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: proxy_model_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: proxy_model_module_css_default.header,
					"aria-expanded": open,
					"aria-label": `${t(open ? "collapse" : "expand")}: ${t("title")}`,
					"data-testid": "proxy-model-card-header",
					onClick: () => setOpen((current) => !current),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: proxy_model_module_css_default.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: proxy_model_module_css_default.name,
							children: t("title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: proxy_model_module_css_default.description,
							children: t("description")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { className: proxy_model_module_css_default.chevron + (open ? ` ${proxy_model_module_css_default.chevronOpen}` : "") })]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CardBody, {
					scope,
					useSnapshot,
					t
				})]
			});
		}
		//#endregion
		//#region src/client/settings-scope.ts
		/**
		* rc.6-compatible settings scope for dsh-proxy.
		*
		* rc.6 host-apiproxy serves only a hard-coded namespace allowlist, so the
		* official settings scope answers "unavailable" for the `llm-proxy`
		* namespace. This binder wraps the official scope: when it reports the
		* namespace ready the wrapper is a pass-through; when it reports
		* unavailable, a same-origin bridge controller takes over and serves the
		* same SettingsScope contract from this package's host-side bridge routes
		* (/api/dsh-proxy/settings). The Host keeps the bridge loopback-only.
		*/
		/** Settings namespace owned by the plugin (mirrors lib/settings.js). */
		const LLM_PROXY_NAMESPACE = "llm-proxy";
		/** Bridge route prefix (same-origin, loopback-only). */
		const SETTINGS_BRIDGE_PREFIX = "/api/dsh-proxy/settings";
		/** True when the value is a well-formed bridge RPC result. */
		function isBridgeResult(value) {
			if (typeof value !== "object" || value === null) return false;
			const record = value;
			if (typeof record.ok !== "boolean") return false;
			if (record.ok) return typeof record.value === "object" && record.value !== null;
			return typeof record.code === "string" && typeof record.message === "string";
		}
		/** Build the fetch-backed settings face for the bridge routes. */
		function createBridgeApi(fetchFn) {
			const post = async (path, body) => {
				try {
					const response = await fetchFn(SETTINGS_BRIDGE_PREFIX + path, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(body)
					});
					if (!response.ok) return {
						ok: false,
						code: "internal",
						message: "bridge HTTP " + response.status
					};
					const parsed = await response.json();
					if (!isBridgeResult(parsed)) return {
						ok: false,
						code: "internal",
						message: "bridge malformed response"
					};
					return parsed;
				} catch {
					return {
						ok: false,
						code: "internal",
						message: "settings bridge unreachable"
					};
				}
			};
			return {
				describe: () => post("/describe", {}),
				mutate: (payload) => post("/mutate", payload),
				models: async () => {
					const result = await post("/models", {});
					if (!result.ok || typeof result.value !== "object" || result.value === null) return [];
					const value = result.value;
					if (!Array.isArray(value.models)) return [];
					return value.models.filter(isModelRow);
				},
				test: async (key) => {
					const result = await post("/test", { key });
					if (!result.ok || typeof result.value !== "object" || result.value === null) return {
						key,
						ok: false,
						code: result.code ?? "internal",
						message: result.message ?? "test failed"
					};
					return result.value;
				}
			};
		}
		/** Type guard for a bridge model row. */
		function isModelRow(row) {
			if (typeof row !== "object" || row === null) return false;
			const record = row;
			return typeof record.key === "string" && typeof record.name === "string" && typeof record.providerLabel === "string" && typeof record.host === "string";
		}
		/**
		* A minimal SettingsScopeController over the bridge face, mirroring the
		* official controller's ordering (serialized queue, revision-fenced writes,
		* recovery read after a refusal).
		*/
		var BridgeScopeController = class {
			api;
			store;
			tail = Promise.resolve();
			disposed = false;
			constructor(fetchFn) {
				this.api = createBridgeApi(fetchFn);
				this.store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
					status: "loading",
					value: void 0,
					base: void 0,
					user: void 0,
					revision: void 0,
					writable: false,
					mode: "host"
				});
			}
			getSnapshot() {
				return this.store.getSnapshot();
			}
			subscribe(listener) {
				return this.store.subscribe(listener);
			}
			/** Queue a Host refresh through the bridge. */
			load() {
				return this.enqueue(() => this.read());
			}
			mutate(fields) {
				return this.enqueue(() => this.writeBatch(fields));
			}
			listModels() {
				return this.api.models();
			}
			test(key) {
				return this.enqueue(() => this.api.test(key));
			}
			async dispose() {
				this.disposed = true;
				await this.tail;
			}
			enqueue(operation) {
				if (this.disposed) return Promise.resolve(void 0);
				const task = this.tail.then(async () => {
					if (this.disposed) return void 0;
					return operation();
				});
				this.tail = task.then(() => void 0, () => void 0);
				return task;
			}
			async read() {
				let response;
				try {
					response = await this.api.describe();
				} catch {
					if (!this.disposed) this.markUnavailable();
					return;
				}
				if (!response.ok || this.disposed) {
					if (!this.disposed) this.markUnavailable();
					return;
				}
				const value = response.value;
				const view = (value.namespaces ?? []).find((candidate) => candidate.ns === LLM_PROXY_NAMESPACE);
				if (view === void 0) {
					this.store.update((draft) => {
						draft.status = "unavailable";
						draft.writable = value.writable !== false;
					});
					return;
				}
				this.accept(view, value.writable !== false);
			}
			async writeBatch(fields) {
				const revision = this.getSnapshot().revision;
				const ops = fields.map(({ field, op, value }) => op === "set" ? {
					op,
					path: [field],
					value
				} : {
					op,
					path: [field]
				});
				let response;
				try {
					response = await this.api.mutate({
						ns: LLM_PROXY_NAMESPACE,
						ops,
						...revision === void 0 ? {} : { expectedRevision: revision }
					});
				} catch {
					await this.read();
					return {
						ok: false,
						code: "internal",
						message: "settings bridge unreachable"
					};
				}
				if (!response.ok || this.disposed) {
					const refusal = response.ok === false ? response : {
						ok: false,
						code: "internal",
						message: "settings bridge unreachable"
					};
					await this.read();
					return {
						ok: false,
						code: refusal.code,
						message: refusal.message
					};
				}
				this.accept(response.value, this.getSnapshot().writable);
				return { ok: true };
			}
			accept(view, writable) {
				this.store.update((draft) => {
					draft.revision = view.revision;
					draft.base = view.base;
					draft.user = view.user;
					draft.writable = writable;
					if (view.value === void 0 || view.value === null) return;
					draft.status = "ready";
					draft.value = view.value;
				});
			}
			markUnavailable() {
				this.store.update((draft) => {
					draft.status = "unavailable";
				});
			}
		};
		/** Normalize any scope snapshot into the shared snapshot shape. */
		function snapshotOf(snapshot) {
			return snapshot;
		}
		/** Wrap the official settings scope with the bridge fallback. */
		function createCompatScope(primary, fetchFn) {
			const fallback = new BridgeScopeController(fetchFn);
			const store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
				status: "loading",
				value: void 0,
				base: void 0,
				user: void 0,
				revision: void 0,
				writable: false,
				mode: "host"
			});
			let fallbackStarted = false;
			const project = () => {
				const primarySnapshot = snapshotOf(primary.getSnapshot());
				if (primarySnapshot.status === "ready") return primarySnapshot;
				const bridgeSnapshot = fallback.getSnapshot();
				if (bridgeSnapshot.status === "ready") return bridgeSnapshot;
				if (primarySnapshot.status === "loading" || bridgeSnapshot.status === "loading") return {
					...primarySnapshot,
					status: "loading"
				};
				return primarySnapshot;
			};
			const publish = () => {
				store.set({
					...project(),
					mode: "host"
				});
			};
			const startFallback = () => {
				if (fallbackStarted) return;
				fallbackStarted = true;
				fallback.load();
			};
			const unsubscribes = [primary.subscribe(() => {
				publish();
				if (snapshotOf(primary.getSnapshot()).status !== "ready") startFallback();
			}), fallback.subscribe(publish)];
			if (snapshotOf(primary.getSnapshot()).status !== "ready") startFallback();
			publish();
			const active = () => {
				if (snapshotOf(primary.getSnapshot()).status === "ready") return primary;
				return fallback;
			};
			return {
				getSnapshot: () => store.getSnapshot(),
				subscribe: (listener) => store.subscribe(listener),
				load: async () => {
					fallbackStarted = true;
					await fallback.load();
				},
				listModels: () => fallback.listModels(),
				test: (key) => fallback.test(key),
				mutate: async (fields) => {
					const backend = active();
					if (backend === fallback) {
						if (fallback.getSnapshot().status !== "ready") await fallback.load();
						return fallback.mutate(fields);
					}
					const official = backend;
					let firstFailure;
					for (const { field, op, value } of fields) try {
						if (op === "set") await official.set(field, value);
						else await official.unset(field);
					} catch {
						firstFailure ??= {
							ok: false,
							code: "internal",
							message: "settings write failed"
						};
					}
					return firstFailure ?? { ok: true };
				},
				dispose: async () => {
					for (const unsubscribe of unsubscribes.splice(0)) unsubscribe();
					await fallback.dispose();
					await primary.dispose();
				}
			};
		}
		/** True when the value exposes the official settings binder's bind() seam. */
		function isBinderFace(value) {
			return typeof value === "object" && value !== null && typeof value.bind === "function";
		}
		/**
		* The rc.6 compatibility binder, provided as the `llmProxySettings` service.
		* Rides the official binder first and hands the bridge controller in only
		* when the official scope settles as unavailable, so official behaviour stays
		* untouched wherever it works and the Host remains the authority.
		*/
		var LlmProxySettingsBinder = class extends _deepseek_ai_cordis.Service {
			constructor(ctx) {
				super(ctx, "llmProxySettings");
			}
			bind() {
				const ctx = this.ctx;
				const official = ctx.get("settingsScope");
				if (!isBinderFace(official)) throw new Error("llmProxySettings: the official settingsScope binder is unavailable");
				const scope = createCompatScope(official.bind({ namespace: LLM_PROXY_NAMESPACE }), (input, init) => fetch(input, init));
				ctx.effect(() => {
					const remote = ctx.get("remote");
					const disposers = [];
					if (remote !== void 0 && typeof remote.$on === "function") disposers.push(remote.$on("settings/document-updated", (namespace) => {
						if (namespace !== void 0 && namespace !== "llm-proxy") return;
						scope.load();
					}));
					disposers.push(ctx.on("connection/reset", () => {
						scope.load();
					}));
					return () => {
						for (const dispose of disposers) dispose();
						scope.dispose();
					};
				}, "dsh-proxy: compat scope invalidation");
				return scope;
			}
		};
		//#endregion
		//#region src/client/locales.ts
		/**
		* The `settings.llm-proxy` locale dictionaries for the 模型代理 section.
		* Keys track exactly the UI-surfaced fields (proxyHost/proxyPort,
		* proxiedModels, retries/retryIntervalMs).
		*/
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			nav: "模型代理",
			title: "模型代理（dsh-proxy）",
			description: "选中的模型请求走代理并自动重试；直连失败自动回退代理。",
			statusLoading: "加载中…",
			statusUnavailable: "设置服务不可用，无法读取或写入代理配置。",
			fieldProxyHost: "代理地址（proxyHost）",
			fieldProxyHostHint: "代理服务器主机或 IP，不必是本机。",
			fieldProxyPort: "代理端口（proxyPort）",
			fieldProxyPortHint: "代理服务端口（1–65535）。",
			fieldProxiedModels: "走代理的模型（proxiedModels）",
			fieldProxiedModelsHint: "按 API 地址走代理：选中一个模型会将该地址下的所有模型都路由到代理。",
			fieldRetries: "重试次数（retries）",
			fieldRetriesHint: "请求失败（网络错误 / 429 / 5xx）时的最大重试次数（0–10）。",
			fieldRetryIntervalMs: "重试间隔（retryIntervalMs）",
			fieldRetryIntervalMsHint: "每次重试之间的等待毫秒数（0–60000）。",
			selectModel: "选择模型…",
			remove: "移除",
			save: "保存",
			saving: "保存中…",
			saved: "已保存，立即生效",
			reset: "恢复默认",
			saveError: "保存失败",
			invalidRange: "端口或数值超出允许范围。",
			invalidEmpty: "代理地址不能为空。",
			invalidProxyUrl: "回退代理地址需以 http://、https:// 或 socks5:// 开头，或留空。",
			expand: "展开",
			collapse: "收起",
			fieldMultimodalModels: "多模态模型（multimodalModels）",
			fieldMultimodalModelsHint: "勾选后模型声明支持图片输入，DSH 不再拒绝发图；取消勾选自动还原。",
			fieldFailoverEnabled: "直连失败自动回退（failoverEnabled）",
			fieldFailoverEnabledHint: "未走代理的请求（搜索、网页抓取、国内 API）直连失败时，自动经代理重发一次；走代理的模型不受影响。",
			fieldFailoverProxy: "回退代理（failoverProxy）",
			fieldFailoverProxyHint: "留空复用上方主代理；也可填专用回退地址（http://、https:// 或 socks5:// 开头）。",
			fieldNegativeCacheTtlMs: "回退记忆时长（negativeCacheTtlMs）",
			fieldNegativeCacheTtlMsHint: "直连失败经代理成功后，该地址在此时长内直接走代理不再试直连（毫秒，0 为每次都先试直连）。",
			failoverOn: "已开启",
			failoverOff: "已关闭",
			multimodalBadge: "🖼 多模态",
			test: "测试连接",
			testing: "测试中…",
			testOk: "连接成功",
			testFail: "连接失败",
			testViaProxy: "经代理",
			testDirect: "直连",
			testMultimodalOn: "多模态已开启",
			testBarHint: "「测试连接」走已保存的配置，改代理勾选后请先保存再测试。"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			nav: "Proxy Model",
			title: "Proxy Model (dsh-proxy)",
			description: "Selected models route through the proxy with automatic retries; failing direct connections fall back to the proxy.",
			statusLoading: "Loading…",
			statusUnavailable: "Settings service unavailable; the proxy configuration cannot be read or written.",
			fieldProxyHost: "Proxy host (proxyHost)",
			fieldProxyHostHint: "Proxy server hostname or IP; does not have to be this machine.",
			fieldProxyPort: "Proxy port (proxyPort)",
			fieldProxyPortHint: "Proxy service port (1–65535).",
			fieldProxiedModels: "Proxied models (proxiedModels)",
			fieldProxiedModelsHint: "Proxy routing is per API base URL: selecting one model also routes all models sharing that host.",
			fieldRetries: "Retries (retries)",
			fieldRetriesHint: "Max retry attempts on failure (network error / 429 / 5xx), 0–10.",
			fieldRetryIntervalMs: "Retry interval (retryIntervalMs)",
			fieldRetryIntervalMsHint: "Milliseconds between retry attempts (0–60000).",
			selectModel: "Select model…",
			remove: "Remove",
			save: "Save",
			saving: "Saving…",
			saved: "Saved, applied live",
			reset: "Reset to defaults",
			saveError: "Save failed",
			invalidRange: "Port or numeric value out of range.",
			invalidEmpty: "Proxy host must not be empty.",
			invalidProxyUrl: "The failover proxy URL must start with http://, https:// or socks5://, or be empty.",
			expand: "Expand",
			collapse: "Collapse",
			fieldMultimodalModels: "Multimodal models (multimodalModels)",
			fieldMultimodalModelsHint: "Checked models are advertised as accepting image input; unchecking restores the official defaults.",
			fieldFailoverEnabled: "Direct failover (failoverEnabled)",
			fieldFailoverEnabledHint: "When a NON-proxied request (search, web fetch, domestic APIs) fails at transport level, it is replayed once through the proxy; pinned proxied models are unaffected.",
			fieldFailoverProxy: "Failover proxy (failoverProxy)",
			fieldFailoverProxyHint: "Empty reuses the main proxy above; or set a dedicated endpoint (http://, https:// or socks5://).",
			fieldNegativeCacheTtlMs: "Failover memory (negativeCacheTtlMs)",
			fieldNegativeCacheTtlMsHint: "After a fallback succeeds, the host skips direct for this long (ms; 0 retries direct on every request).",
			failoverOn: "on",
			failoverOff: "off",
			multimodalBadge: "🖼 Multimodal",
			test: "Test",
			testing: "Testing…",
			testOk: "Connected",
			testFail: "Failed",
			testViaProxy: "via proxy",
			testDirect: "direct",
			testMultimodalOn: "multimodal on",
			testBarHint: "Test uses the saved routing; save before testing a newly proxied model."
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.llm-proxy";
		/** Required services (cordis fiber inject). */
		const inject = [
			"slots",
			"locale",
			"settingsScope",
			"remote"
		];
		/**
		* Register the 模型代理 plugin card once the `settings.plugin.item`
		* declaration is on the ledger, and bind the llm-proxy settings scope.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-proxy: copy dictionaries");
			const scope = new LlmProxySettingsBinder(ctx).bind();
			const useSnapshot = () => (0, react.useSyncExternalStore)(scope.subscribe, scope.getSnapshot);
			const t = ctx.locale.bind(NS);
			const injected = () => ({
				scope,
				useSnapshot,
				t
			});
			ctx.slots.inject("settings.plugin.item", function* () {
				yield ctx.slots.register({
					name: "settings.plugin.item",
					key: "llm-proxy",
					locale: NS,
					inject: injected
				}, ProxyModelCard);
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map