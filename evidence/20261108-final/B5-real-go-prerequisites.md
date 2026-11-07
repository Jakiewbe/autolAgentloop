# B5 真实 Go 调用：需要什么前置才能验（环境缺口清单）

本机**没有**真实 Go 调用能力，这条是环境缺口，不拿替身冒充。上一轮用 `evidence/probes/fake-claude.js` + `fake-claude.cmd` + `fake-go-settings.json` 只验了命令行参数拼装与 stream-json 解析，**不算真实调用**。

## 1. claude CLI 的安装与版本要求

| 项 | 现状 | 需要 |
| --- | --- | --- |
| 可执行文件 | `where claude` 找不到；`C:\Users\19082\.local\bin\claude.exe` 不存在 | 安装 Claude Code CLI（npm 包 `@anthropic-ai/claude-code`，`npm i -g`），或 A 侧提供同版本可执行文件 |
| 全局 npm 现状 | `@openai/codex@0.167.0`、`@playwright/mcp@0.0.73`、`opencode-ai@1.17.13`、`openskills@1.5.0` —— 无 `@anthropic-ai/claude-code` | 同上 |
| 必须支持的参数 | 代码里已经硬编码（`plugins/claude-go/agent.ts:9-25`） | `-p`、`--output-format json`、`--settings`、`--strict-mcp-config`、`--resume` / `--session-id`、`--model`、`--permission-mode plan|acceptEdits|bypassPermissions`、`--add-dir`、`--disallowedTools=` |
| Node | v24.12.0（满足 CLI 的 `>=18/20` 类要求） | 保持 |
| 版本核对方式 | — | 装完先 `claude --version` 与 `claude -p "hi" --output-format json` 冒烟，再走适配器 |

## 2. 凭据类型

| 需要 | 说明 |
| --- | --- |
| Go 供应商的 API 凭据 | 走 `--settings <私有配置>` 传入，形状是 `{"env":{"ANTHROPIC_BASE_URL":"<Go 网关地址>", ...}}` + 该网关要求的 token/key。上一轮替身用的 `fake-go-settings.json` 只有 `ANTHROPIC_BASE_URL=http://127.0.0.1:9/stand-in`，是占位，不是真凭据 |
| 适配器侧 | `turn.command = [program, settingsPath]` 两项都必须给（缺一个直接抛「Claude/Go 的 command 必须提供执行文件和私有配置路径」） |
| 不能用的 | 把 key 写进 rules.json / 提交进仓库；settings 文件属私有配置，放 HOME 或 `secrets.env` 之外单独路径 |

## 3. 网络白名单

| 目标 | 用途 | 现状 |
| --- | --- | --- |
| Go 网关域名（`ANTHROPIC_BASE_URL` 的 host） | 真实模型调用 | 本机**无**该地址、无凭据 |
| `https://obconic-subtetanic-tamika.ngrok-free.dev` | 中台（A 侧 hub） | 通（19:28:59Z / 19:30:19Z 均 200），但历史上大量 404/503 |
| `github.com:443` | B4 clone / B7 push | 本轮多次连接被 reset / 超时（见 B4） |

## 4. A 侧真实返回体字段（用于对表）

- `total_cost_usd` 在 **result 顶层**。
- `usage` 里**没有** `cost`，只有 `input_tokens` / `output_tokens` / `cache_read_input_tokens` 这类计数。
- 所以：F1 修好之后 `claude-go.read()` 必须把顶层算出来的 `sessionUsage` 删掉，否则 `worker/worker.ts:92 sessionRise` 会把本地估价当成真实花费记进去。

## 5. 结论

真实 Go 调用**未验**。要闭合需要同时满足：① 装上 Claude Code CLI 并冒烟通过；② 拿到 Go 网关地址 + 凭据并写成私有 settings 文件；③ 该网关出网可达；④ 有一轮真实活（或 `scripts/real-agents.ts` 这类脚本）跑通后，用 A 侧真实返回体核对 `total_cost_usd` 顶层、`usage` 无 cost、以及记账里没有 `cost`。缺任何一条都只能停在替身级别。
