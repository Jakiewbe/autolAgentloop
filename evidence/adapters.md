# T7 工具 / 模型 / 会话接口 实测证据

- 生成时间：2026-11-04 18:10 (+0800)，执行者：model-probes
- 主机：Windows 10 19045；bash=git-bash；node v24.12.0 / npm 11.12.1 / pnpm 11.9.0 / git 2.56.0.windows.2
- 标注体系：**[实测]** 真实调用且落盘原始日志；**[源码]** 已安装产物中定位到文件:行号；**[文件]** 仅确认配置文件/凭据存在；**[未验证]** 未取得证据
- 原始日志目录：`evidence/raw/adapters/`（文件名时间戳+工具名），脚本目录 `evidence/raw/adapters/scripts/`，工作目录 `evidence/raw/adapters/work/`，asar 抽取产物 `evidence/raw/adapters/asar/`
- 密钥纪律：全文不含任何 token/key 值，仅记录“已配置/缺失 + 路径 + 长度级别”。

## 1. Codex 通道

### 1.1 安装版 / 调用版

| 项 | 值 |
|---|---|
| 入口 A（旧，默认 bin 目录） | `C:\Users\chs\AppData\Local\OpenAI\Codex\bin\codex.exe` — **codex-cli 0.130.0-alpha.5**（245812016 B, mtime 2026-05-11）[实测] |
| 入口 B（桌面版自带） | `C:\Users\chs\AppData\Local\OpenAI\Codex\bin\22cfb1d302613eae\codex.exe` — **codex-cli 0.166.0-alpha.5.1**（368970544 B, mtime 2026-10-30）[实测] |
| PATH | bash `command -v codex` = 未找到；pwsh `Get-Command codex` = 无结果 → **必须用绝对路径调用** [实测] |
| CODEX_HOME | `C:\Users\chs\.codex`（未设置环境变量时的默认值同样指向该目录）[实测] |
| 鉴权来源 | `CODEX_HOME\auth.json` 4191 B，`auth_mode=chatgpt`，`has_OPENAI_API_KEY=false`，token 键名 id_token/access_token/refresh_token/account_id，`last_refresh=2026-10-30T08:50:34Z`；`codex login status` → "Logged in using ChatGPT" [文件] |
| 模型/配置来源 | `CODEX_HOME\config.toml` 9549 B（mtime 2026-11-04 15:37）：L1 `model = "gpt-6.1-sol"`、L5 `personality="pragmatic"`、L6 `model_reasoning_effort="high"`、L8 `approval_policy="never"`、L10 `sandbox_mode="danger-full-access"`；**无 model_provider / 无 profiles**，第 3-4 行为注释掉的 `base_url=http://127.0.0.1:8317/v1`（8317 端口当前无监听）[文件] |

### 1.2 关键结论：版本决定成败（Lead 18:00 的 400 已复现并定位）

同一时刻、同一 CODEX_HOME、同一 prompt、同一 model=gpt-6.1-sol：

| 二进制 | 结果 | 证据 |
|---|---|---|
| 0.130.0-alpha.5 | exit 1，无 turn.completed，错误 `{"type":"error","status":400,...,"message":"The 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}` | `20261104T180330+0800_codex-ab_old.jsonl` |
| 0.166.0-alpha.5.1 | exit 0，21 s，正文 `PROBE-AB-OK`，turn.completed=1 | `20261104T180330+0800_codex-ab_new.jsonl` |

→ **不是账号/套餐对该模型关闭，也不是 exec 与非交互鉴权路径差异；是二进制版本差异。** 0.130 服务端已判定 "model_not_found"，同时该版本刷新模型目录也失败（`unknown variant "max"`），说明旧二进制与新模型目录/服务端不兼容。

### 1.3 当前真实可用的非交互命令（已实测）

```bash
# 单次回合（纯文本输出，含 "tokens used" 统计）
"C:/Users/chs/AppData/Local/OpenAI/Codex/bin/22cfb1d302613eae/codex.exe" \
  exec --skip-git-repo-check -C "D:/path/to/workdir" "你的任务"
# → exit_code=0, elapsed_s=20, stdout 末行 "PROBE-PLAIN-OK"；证据 20261104T180440+0800_codex_plain.stdout.txt

# 结构化事件（含 thread_id 与 usage）
".../22cfb1d302613eae/codex.exe" exec --skip-git-repo-check --json -C "<wd>" "你的任务"

# 会话接续（注意：resume 不支持 -C；必须带 --skip-git-repo-check）
cd "<wd>"
".../22cfb1d302613eae/codex.exe" exec resume <thread_id> --skip-git-repo-check --json "追问"
```

resume 实测细节 [实测]：
- `exec resume <id> --skip-git-repo-check --json "..."` → exit 0，22 s，返回**同一个** thread_id `01a1a603-e209-7a60-a6a7-10cc40af42b3`，上下文命中（回答上一个回合的 `PROBE-AB-OK`），usage `{"input_tokens":58160,"cached_input_tokens":42240,"output_tokens":20}`。证据 `20261104T180517+0800_codex_resume2.jsonl`
- 漏写 `--skip-git-repo-check` → 立即失败 exit 1，stderr `Not inside a trusted directory and --skip-git-repo-check was not specified.`。证据 `20261104T180440+0800_codex_resume.stderr.txt`
- `exec resume -C <wd>` → exit 2，`error: unexpected argument '-C' found`（历史证据见 17:43 记录）

### 1.4 能力矩阵（Codex）

| 能力 | 结果 | 证据 |
|---|---|---|
| 读取文件 | 通过：回合内 `pwsh -Command "Get-Content -LiteralPath .\answer.txt -Raw"`，exit 0，正确回显 PROBE-CODE-7F3A | `20261104T174104+0800_codex166_gpt-6.1-sol.jsonl` |
| 受控编辑 | 通过：创建 edit.txt，磁盘实测 10 字节、内容恰为 `EDIT-OK-42`、无尾换行 | `20261104T174154+0800_codex166_edit_run_check.jsonl` |
| 运行检查 | 通过：`node -e "console.log(21*2)"` stdout `42` exit 0；`node -e "process.exit(3)"` exit 3 并被正确识别为非零 | 同上 |
| 接续 | 通过（见 1.3） | `20261104T180517+0800_codex_resume2.jsonl` |
| 取消 | 通过：`timeout -k 3 20` 包住 `Start-Sleep -Seconds 120` 的回合，20 s 后 SIGTERM → exit 124，jsonl 无 `turn.completed`（turn 未完成），事后 wmic 检查无残留 pwsh / codex exec 进程 | `20261104T175103+0800_codex166_cancel_sigterm.jsonl` / `.meta.txt` |
| 失败识别 | 通过：400 以 `{"type":"error"}`+`{"type":"turn.failed"}` 双事件呈现，exit 1；缺 flag 的用法错误 exit 2 且 stderr 明确 | `20261104T180330+0800_codex-ab_old.jsonl`、`20261104T180440+0800_codex_resume.stderr.txt` |
| 用量可观测 | 通过：`turn.completed.usage` 提供 input/cached_input/cache_write/output/reasoning_output tokens | 1.4 各 jsonl |
| 套餐额度 | **[未验证]** codex 无 quota/剩余额度字段暴露；`codex debug models` 只返回模型目录 | `20261104T173938+0800_codex_debug_models.json` |
| 额外扣款 | **[未验证]** auth_mode=chatgpt（订阅型），日志无计价字段，无法判断是否产生额外费用；未知，不填 0 | — |

已知噪声（不影响判定）：每个回合 stderr 有 `failed to load skill ...SKILL.md: missing YAML frontmatter` 若干条。

## 2. Claude Code 通道

### 2.1 安装版 / 鉴权路径判定

| 项 | 值 |
|---|---|
| 入口 | `C:\Users\chs\AppData\Roaming\npm\claude.ps1`（bash shim `/c/Users/chs/AppData/Roaming/npm/claude`），**2.1.153 (Claude Code)** [实测] |
| 原生 Anthropic 订阅 | **否**：`~/.claude/.credentials.json`(421 B) 只有 `mcpOAuth.plugin:vercel:...*` 键，无 `claudeAiOauth`/无 access_token ⇒ 不存在原生订阅登录凭据 [文件] |
| 实际路由 | OpenCode Go 网关：`~/.claude/settings.json` → `env.ANTHROPIC_BASE_URL = https://opencode.ai/zen/go`，`env.ANTHROPIC_AUTH_TOKEN` 已配置（`sk-` 前缀，长度 67，值未记录）[文件] |
| 模型映射（settings.json） | `ANTHROPIC_MODEL=deepseek-v4-flash`；`opus→kimi-k3`、`sonnet→qwen3.6-plus`、`haiku→deepseek-v4-flash`、`fable→kimi-k3`；顶层 `model="opus[1m]"`、`effortLevel="high"` [文件] |
| 辅助凭据 | `~/.claude/settings.local.json` → `apiKeyHelper = C:\Users\chs\proxy-tools\claude-api-key-helper.cmd`（文件存在 120 B）；`~/.claude/config.json` → `{"primaryApiKey":"any"}` [文件] |
| 环境变量 | bash 中 ANTHROPIC_BASE_URL/AUTH_TOKEN/API_KEY/MODEL、CLAUDE_CODE_OAUTH_TOKEN、OPENAI_* **全部未设置**（全部来自 settings.json 的 env 注入）[实测] |

### 2.2 实测结果：非交互回合全部失败

`claude -p "<prompt>" --model <M> --output-format json`，工作目录 `evidence/raw/adapters/work/claude-min`：

| 请求模型 | exit | 结果 | 耗时 |
|---|---|---|---|
| 默认（`opus[1m]`→kimi-k3） | 1 | `API Error: 400 Upstream request failed: Model is unavailable.` | 8 s |
| deepseek-v4-flash | 1 | 400 Model is unavailable | 7 s |
| qwen3.6-plus | 1 | 400 Model is unavailable | 6 s |
| kimi-k3 | 1 | **401** `Failed to authenticate. API Error: 401 Upstream request failed: Go requires a credential` | 193 s |
| kimi-k2.7-code | 1 | 401 Go requires a credential | 199 s |
| deepseek-v4-pro | 1 | 401 Go requires a credential | 203 s |

共同点：`is_error=true`、`modelUsage={}`、`total_cost_usd=0`、usage 全 0、`num_turns=1`、session_id 每次都生成（如 `b2a424c3-ec6c-47c3-8eec-895f49bc3f58`）。
证据：`20261104T175217+0800_claude_p.json`、`20261104T175241+0800_claude_p_model-*.json`、`20261104T175629+0800_claude_p_model-*.json`。

判定：
- Claude Code 走的是 **OpenCode Go 网关**，不是原生 Anthropic 订阅；
- 该链路上的凭据被网关拒绝（Go 模型返回 401 "requires a credential"，非 Go 型号名返回 400 "Model is unavailable"）；
- 因此 claude 通道当前**不可用**：读取文件 / 受控编辑 / 运行检查 / 接续 / 取消 全部 **[未验证]**（失败发生在首个上游请求，无 turn）。
- 附带观测：每次失败都有 SessionEnd hook 报错 `claude-mem ... failed: Hook cancelled`（plugins：claude-mem@thedotmack、superpowers@obra）→ hook 链在非交互模式下不完整。

未改任何 claude 配置（未动 settings.json / 未换模型 / 未登录登出）。

## 3. OpenCode 通道

| 项 | 值 |
|---|---|
| 入口 | `C:\Users\chs\AppData\Roaming\npm\opencode`（sh shim）、`opencode.ps1`、`opencode.cmd` — **1.14.29** [实测] |
| 配置来源 | `C:\Users\chs\.config\opencode\opencode.json`(766 B)：`provider.opencode.name="OpenCode Go"`、`npm=@ai-sdk/openai-compatible`、`options.baseURL=https://opencode.ai/zen/go/v1`、`options.apiKey` 已配置（未记录）；声明模型 deepseek-v4-flash/pro、glm-5.2、kimi-k2.7-code、mimo-v2.5-pro [文件] |
| 凭据文件 | `C:\Users\chs\.local\share\opencode\auth.json`(432 B)（键值未读）[文件] |
| 模型目录 | `opencode models` 可列出 `opencode/deepseek-v4.1-flash`、`opencode/deepseek-v4-pro`、`opencode/kimi-k2.5`、`opencode/glm-5.x`、claude-* 等（provider 前缀 opencode）[实测] |

### 3.1 实测结果（取消一项未验证，其余通过）

| 能力 | 结果 | 证据 |
|---|---|---|
| 非交互运行 | 通过：`opencode run "..." --model opencode/deepseek-v4.1-flash --format json` → exit 0，7 s | `20261104T180603+0800_oc_run1.json` |
| 实际模型 ID | `--model opencode/deepseek-v4.1-flash` 被接受并出结果；**但事件流里没有 `modelID`/`providerID` 字段**，解析后无法从输出反证真实模型 ⇒ 模型标识属“不可观测”，只能信 CLI 入参 [未验证/部分] | 同上（grep 结果为空） |
| 会话标识 | `sessionID = ses_e59fa1b94ffedoBOtpJ4sVNzQ7`，由事件流带出 [实测] | 同上 |
| 接续（显式 session） | 通过：`opencode run "..." --session ses_e59f... --model ... --format json` → exit 0，5 s，同 sessionID，正文回 `PROBE-OC-A1`（上下文保留） | `20261104T180624+0800_oc_resume_session.json` |
| 接续（--continue） | 通过：同一工作目录下解析到同一 sessionID，exit 0，5 s（模型自述看不到 session id，属预期） | `20261104T180624+0800_oc_continue.json` |
| 受控编辑（默认权限，未加 --dangerously-skip-permissions） | 通过：创建 `probe-oc-edit.txt`，磁盘 9 字节、内容 `OC-EDIT-7`、无尾换行；模型读回 hex `4f 43 2d 45 44 49 54 2d 37` | `20261104T180650+0800_oc_edit.json` |
| 取消 | **[未验证]**：`20261104T180650+0800_oc_cancel.json` 与同名 stderr 都是 0 字节，只有 exit 124，没有「任务已开始 → 取消 → 进程结束」的可核对记录。原写「通过」证据不足。补测法：先让 opencode 写出一行事件到文件（证明已开始），再 SIGTERM，记录 exit 与事后进程 | 0 字节，不作通过依据 |
| token 可观测 | 通过：每个 step 都带 `tokens{total,input,output,reasoning,cache{write,read}}` | 3.1 各 json |
| 费用可观测 | **按次给出 `cost`（USD）**：run1 `0.00501834`、resume `0.00013518`、continue `0.00017568`、edit 多步合计约 `0.0059` [实测数值] |
| 套餐额度 | **[未验证]** CLI 不暴露剩余额度；`cost` 是否为实扣金额未知（可能只是估算），不从 0 填。 |

推荐给 app 的用法：显式 `--session <id>` 最稳（`--continue` 依赖“当前目录最近会话”，多进程并发时会串话）。

## 4. DSH 已安装版 ACP 能力（源码级）

### 4.1 路径澄清（重要）

任务书给的源码路径 `D:\DSH\resources\app.asar\dsh\packages\acp\acp` **在本机不存在**：`app.asar` 是单文件（182,766,714 B，mtime 2026-10-29 22:02），非目录；asar 内只有编译产物，无 `packages/` 源码树（对 18,234 个条目做路径扫描，`packages/acp` 命中 0）。
实际可核查位置（asar 内）：`dsh/node_modules/@deepseek-ai/dsh-acp` —— **@deepseek-ai/dsh-acp 0.2.1-rc.5**，`package.json` 的 `repository.directory = packages/acp/acp`，即就是该源码目录的发布产物；已抽取到 `evidence/raw/adapters/asar/dsh-acp/`（含 `lib/index.js` 57,526 B、README.md 13,276 B）。抽取脚本：`evidence/raw/adapters/scripts/asar_extract.js`。

### 4.2 initialize 能力集合 [源码]

`asar/dsh-acp/lib/index.js:1183-1206`：
```
protocolVersion: PROTOCOL_VERSION
agentInfo: { name: "deepseek-harness-acp", version: "0.0.1" }
agentCapabilities:
  mcpCapabilities: { http: true }
  promptCapabilities: { image: <按当前模型能力探测>, audio: false, embeddedContext: false }
  sessionCapabilities: { close: {}, list: {}, resume: {} }
authMethods: []
```
README.md:64 同义描述："Stable ACP v1 plus `session/list`, `session/resume`, `session/close`, and Streamable HTTP MCP support"。
**没有 loadSession / session/load**；README.md:175 明列不支持："No transcript replay or interactive extensions — session deletion, fork, `session/load`, modes, commands, plans, terminals, client filesystem operations, and elicitation"。

方法注册：`lib/index.js:1362-1367` 依次 `initialize / authenticate / session.new / session.list / session.resume / session.prompt / session.cancel / session.close`。

### 4.3 session/resume 的真实约束 [源码]

`lib/index.js:1250-1297`：
- `params.cwd` 必须与持久化 header 的 cwd 完全一致（`sameDirectory`），否则 `invalidParams: session cwd does not match`（1259、1276-1278）；
- 若会话是 subagent 或带 `parentSession` → `invalidParams: session is not resumable`（1258）；
- 会话已激活 → `invalidParams: session is already active`（1254）；
- 返回**只有 `{ configOptions }`**（1288），不回放任何历史；历史需客户端自行读取持久化。
- 恢复路径 `AcpSession.resume`：`ctx.agents.resume({ resumeSessionId: options.sessionId, ... })`（712-731，尤其 715）。

### 4.4 model / reasoning 的真实入口 [源码]

- 配置项 ID：`MODEL_CONFIG_ID = "model"`（305）、`REASONING_CONFIG_ID = "reasoning_effort"`（306）。
- 只能通过 **`session/set_config_option`** 改变：`lib/index.js:1332` `return { configOptions: await record.setConfig(params.configId, params.value, signal) }`；`session/new` 与 `session/resume` 都返回完整 `configOptions`（1242、1288）。
- README.md:70："`session/set_config_option` — A serialized update to the advertised `model` or `reasoning_effort`"；README.md:80："Session configuration offers opaque provider/model choices ... and a `reasoning_effort` selector"；README.md:149："A model change starts the next ACP turn on the new route"。
- `session/prompt` 实现（796-867）只读 `params.prompt` 与路由快照：`const promptSelection = this.modelControl.snapshot()`（827），随后把 selection 绑到该 message id（839 `pendingSelections.set(message.id, promptSelection)`）—— **prompt 请求体里没有任何 model/effort 字段入口**。
- effort 落地到 provider：`dsh-llm-deepseek/README.md:85` "reasoning effort as `output_config.effort`"。

### 4.5 会话标识是否稳定传到底层 [源码 + 部分未验证]

- ACP 侧：`newSession` 用 `randomUUID()` 生成 sessionId（1213），并以 `ctx.agents.create({ sessionId: options.sessionId, ... })` 固定（696）；之后所有更新回包都用 `this.agent.session.id`（775、889、901、909、1164、1312），prompt/cancel 按该 id 查表分发（1351-1358）⇒ **ACP 层稳定，不会漂移**。
- Provider 侧：`dsh-llm-deepseek/lib/index.js:2241` `...options.sessionId === void 0 ? {} : { "x-deepseek-harness-session-id": String(options.sessionId) }`，并在 2209-2210 把 `sessionId` 放进请求体 options ⇒ **只有调用方把 sessionId 传进 provider 请求时，Go 侧才看得到该会话标识**。
- 缺口：`options.sessionId` 的填充点（LLM 调用方）在已抽取包（acp / agent / llm / llm-deepseek）中均未命中（`grep -rn "sessionId" dsh-agent/lib/index.js` 只有 workspace 事件用的 sessionId）⇒ **该段属未验证**，需在完整仓库（packages/llm、packages/agent 源码）或活体抓包确认。

### 4.6 协议层对照：session/load 与 session/resume 的语义差 [源码]

SDK `@agentclientprotocol/sdk` **1.4.0**（`asar/sdk/dist/acp.js`）：
- `:1550-1563` 对 `resumeSession` 的定义："Resumes an existing session **without returning previous messages**... The agent should resume the session context, allowing the conversation to continue **without replaying the message history (unlike `session/load`)**"；仅当 agent 声明 `session.resume` 能力时可用。
- `session/load` 是协议里的另一条方法（`:1556`、`http-stream.js:16` 提到 "Agents must authorize `session/load`"），需要 agent 显式提供；DSH 0.2.1-rc.5 未注册该 handler（`dsh-acp/lib/index.js:1362-1367`），且 initialize 未声明 `loadSession`。
→ 用 `session/load` 打 DSH 会落到未处理方法（错误形态属推断，**未做活体验证**）；即使用 `session/resume`，客户端也**拿不到历史回放**，必须自己从持久化读取渲染。

## 5. 三条兼容差异：逐条结论

| # | 差异 | 已安装版实际行为 | 证据 | 结论 |
|---|---|---|---|---|
| 1 | Autoloop 用 `session/load`，DSH 用 `session/resume` | initialize 未声明 load；只注册 session/new、session/list、session/resume、session/prompt、session/cancel、session/close；README 明列 `session/load` 不支持 | `asar/dsh-acp/lib/index.js:1183-1206`、`:1362-1367`；`README.md:64,175` | **失败（不兼容）**：Autoloop 必须改走 `session/resume`；resume 前 cwd 必须与创建时逐字一致，且拿不到历史回放 |
| 2 | 通用 ACP bridge 未应用 `turn.model` / `turn.effort` | `session/prompt` 无 model/effort 入参；模型与 effort 只有 `session/set_config_option(configId="model"/"reasoning_effort")` 一条路，且改动在“下一个 ACP turn”生效 | `lib/index.js:305-306,796-867(827,839),1332`；`README.md:70,80,149` | **失败（不生效）**：把 model/effort 塞进 prompt 的 bridge 会被静默忽略；必须改成会话级 config option，并在 resume/new 后用返回的 configOptions 重建状态 |
| 3 | DSH 到 Go 的会话标识传递 | ACP sessionId = randomUUID，贯穿 create/resume/prompt/updates；provider 仅当传入 options.sessionId 时才发 `x-deepseek-harness-session-id` 头 | `lib/index.js:696,715,775,889,901,909,1164,1213,1312`；`dsh-llm-deepseek/lib/index.js:2209-2210,2241` | **部分通过 / 关键一环未验证**：ACP 层稳定可证；provider 头是条件性的，调用方填充点未定位 |

补充：Go 网关侧当前只有 OpenCode 通道可用（3.1），Claude Code 走同一网关被 401 拒绝（2.2）——若 DSH 要接 Go，应按 OpenCode 的 `/zen/go/v1` + apiKey（`@ai-sdk/openai-compatible`）形态接通，而非 Anthropic 兼容形态。

## 6. 未验证项（含具体原因）

1. **Claude Code 任何真实回合**：上游鉴权/模型名均被网关拒绝（400/401），读取/编辑/运行/接续/取消全部无法取得证据。原因：Go 网关不接受 settings.json 里的 ANTHROPIC_AUTH_TOKEN（未改配置、未登录）。
2. **claude SessionEnd hook 行为**：每次失败都报 `claude-mem ... Hook cancelled`，是否影响真实回合未知。
3. **Codex 套餐额度 / 额外扣款**：CLI 与日志均无 quota/billing 字段；auth_mode=chatgpt，无法判定是否额外计费（不填 0）。
4. **Codex `--profile` / `-c model=...` 覆盖**：未测（会改动运行时参数，本轮只做只读探测）。
5. **OpenCode 实际模型 ID**：`--format json` 事件流无 modelID/providerID，只能采信 CLI 入参。
6. **OpenCode 思考流 / reasoning effort**：`--thinking`、`--variant` 未测。
7. **DSH ACP 活体调用**：PATH 无 dsh CLI，未启动独立 ACP stdio 服务进程；本节全部为已安装产物源码证据（含 README），非运行时抓包。
8. **`options.sessionId` 填充点**：见 4.5。
9. **DSH ACP 的 usage_update 上报**：`lib/index.js:626-632` 显示存在 `sessionUpdate:"usage_update"`（依赖 `contextWindow`），但未做活体验证。

## 6.1 接进中台之后的实测（2026-11-04 20:43–20:58，Lead 补做）

Codex 通道已经接进 agent-autoloop 中台，不是「探针能用、中台没接」。命令适配器本轮补了三件事（`app/plugins/command/agent.ts`）：

1. 占位符 `{resumeArgs}`：有会话时展开成 `resume <会话ID>`，首轮展开成空；`{cwdArgs}`：首轮展开成 `-C <目录>`，接续时展开成空（codex 的 resume 不接受 -C）。另加 `{sessionArgs}`（`--session <id>`，给 opencode）与 `{session}`（裸 ID）。
2. JSON 行输出取正文：stdout 每行都是 JSON 时，取**最后一条** `item.type == "agent_message"` 的 text 作为这一轮的话；前半段「我打算怎么做」的旁白不再冒充结论。混合/坏行原样返回，不猜。
3. 会话 ID 上报：输出里出现 `thread_id` / `threadId` / `sessionID` / `session_id` 的 JSON 行，就当作会话 ID 交给中台，下一轮用它接续。

线上 `~/.agent-autoloop/rules.json` 的 Agent 命令（备份 `evidence/raw/deploy/rules.before-resume.json`）：

```
"<...>\bin\22cfb1d302613eae\codex.exe" exec {resumeArgs} --skip-git-repo-check {cwdArgs} --json {prompt}
```

实测（原文 `evidence/raw/deploy/20261104-2058-resume-verify.txt`，日志 `20261104-2055-up.log`）：

| 轮次 | 日志 | codex 会话文件 |
| --- | --- | --- |
| 第一轮（run 8，提问） | `run 8 (试一下) turn 1 started, pid 36264` → `run 8: done` | 新建 `rollout-2026-11-04T19-47-11-01a1a662-...jsonl` |
| 第二轮（run 9，回答「蓝色」后） | `run 9 (试一下) turn 1 started, pid 35368` → `run 9: done` | **没有新建 rollout**，仍写 01a1a662；该文件 `UserMessage` 2 条、提到「蓝色」14 行、mtime 19:48 |

结论：中台第二次派单真的接在同一个 codex thread 上，没有重开新会话、没有把首轮提示词再跑一遍；卡片 #4 的结论是「你选了蓝色，试跑通过」，与首轮规则要求一致。

还剩的边界：a) 卡住/失败时中台不重开新会话（见 `evidence/scheduling.md` §7）；b) Claude Code 仍未接通（见 §5、§6 第 1 条）；c) opencode 的中台接入未做（只有 CLI 探针结论），要接时用 `{sessionArgs}`，ID 从事件流 `sessionID` 取。

## 7. 给 app-source 的落地建议（只读结论；本轮已按 1、2 落地，见 §6.1）

1. Codex 适配器：二进制写死到 `...\bin\22cfb1d302613eae\codex.exe`（或用版本探测≥0.166 后降级到别的入口），子命令固定 `exec --skip-git-repo-check --json`；resume 用 `exec resume <thread> --skip-git-repo-check`（无 `-C`，靠 cwd 定位）。
2. 取消语义：Codex 用 SIGTERM（exit 124 语义）并确认无 `turn.completed`，事后无残留 → 可据此判定“已取消”。OpenCode 只测到 SIGTERM 后 exit 124，日志 0 字节、没有「已开始」的证据 ⇒ **[未验证]**，不写通过；补测后才能定。
3. OpenCode 适配器：`opencode run --model opencode/<id> --format json`，会话标识以事件里的 `sessionID` 为准，接续用 `--session`；不要依赖 `--continue`。
4. DSH 适配器：只用 `session/resume`（+cwd 严格一致），模型/effort 用 `session/set_config_option`，不要下发 turn.model/effort；取消用 `session/cancel`（服务端按 sessionId 分发）。
5. Claude Code 通道当前不可作为主路径（鉴权失败）。

## 8. 证据文件索引（相对 `evidence/raw/adapters/`）

- Codex 版本/失败复现：`20261104T180330+0800_codex-ab_old.jsonl`、`20261104T180330+0800_codex-ab_new.jsonl`
- Codex 纯文本可用命令：`20261104T180440+0800_codex_plain.stdout.txt` / `.stderr.txt`
- Codex resume：`20261104T180517+0800_codex_resume2.jsonl`；失败对照 `20261104T180440+0800_codex_resume.stderr.txt`
- Codex 编辑+运行检查：`20261104T174154+0800_codex166_edit_run_check.jsonl`
- Codex 取消：`20261104T175103+0800_codex166_cancel_sigterm.jsonl` / `.meta.txt`
- Claude：`20261104T175217+0800_claude_p.json`、`20261104T175241+0800_claude_p_model-*.json`、`20261104T175629+0800_claude_p_model-*.json`
- OpenCode：`20261104T180603+0800_oc_run1.json`、`20261104T180624+0800_oc_resume_session.json`、`20261104T180624+0800_oc_continue.json`、`20261104T180650+0800_oc_edit.json`、`20261104T180650+0800_oc_cancel.json`
- DSH ACP 源码抽取：`asar/dsh-acp/lib/index.js`、`asar/dsh-acp/README.md`、`asar/dsh-llm-deepseek/lib/index.js`
- 脚本：`scripts/codex_ab.sh`、`scripts/codex_plain_resume.sh`、`scripts/codex_resume2.sh`、`scripts/codex_cancel_sigterm.sh`、`scripts/claude_probe.sh`、`scripts/claude_probe_models.sh`、`scripts/opencode_run1.sh`、`scripts/opencode_resume.sh`、`scripts/opencode_edit_cancel.sh`、`scripts/asar_list.js`、`scripts/asar_extract.js`、`scripts/asar_find.js`
