# B5 · 真实 Go 调用可行性（事实核对，未包装、未伪造）

采集时间 2026-11-07 11:53 +08:00。

## 1 本机有没有能讲 Claude 协议的 CLI

| 检查 | 命令 | 结果 |
|---|---|---|
| 是否存在 `claude` | `command -v claude` | 未找到（PATH 无） |
| npm 全局包 | `npm ls -g --depth=0` | 只有 `@openai/codex@0.167.0`、`@playwright/mcp@0.0.73`、`opencode-ai@1.17.13`、`openskills@1.5.0` |
| 系统目录里有没有 claude.exe/claude.cmd/claude.ps1 | 递归扫 C:\Program Files、C:\Program Files (x86)、%LOCALAPPDATA%\Programs、%APPDATA%\npm | 无命中 |
| `codex` | `codex --version` | `codex-cli 0.167.0`（讲 Codex 协议，不是 Claude 协议） |
| `opencode` | `opencode --version` | `1.17.13`，实体在 `C:\Users\19082\AppData\Roaming\npm\node_modules\opencode-ai\bin\opencode.exe`（165,897,096 B），shim 为同目录 `opencode` / `opencode.cmd` / `opencode.ps1` |

## 2 opencode 能不能充当 claude-go 的执行文件

`plugins/claude-go/agent.ts:1` 的注释写明：*Go uses the existing Claude protocol; the deployment supplies its executable and private provider settings explicitly*，`command()` 需要 `[program, settings]` 两个参数，并拼出：

```
<program> -p <prompt> --output-format json --settings <settings> --strict-mcp-config
  (--resume <id> | --session-id <id>) [--model m]
  --permission-mode {plan|acceptEdits|bypassPermissions} --add-dir <folder>
  --disallowedTools=EnterWorktree,ExitWorktree
```

opencode 1.17.13 的非交互入口是 `opencode run [message..]`，`--help` 与 `opencode run --help` 里只有：
`-c/--continue`、`-s/--session`、`--fork`、`--share`、`-m/--model`、`--agent`、`--print-logs`、`--log-level`、`--pure`、`--command`。
**没有** `-p`/`--print`、`--output-format`、`--settings`、`--strict-mcp-config`、`--permission-mode`、`--add-dir`。

→ 差异在**协议层**（参数契约不同），不是包装层。上一轮记录的 ".cmd 被拒 exit 127、.exe 打用法 exit 1" 与此一致：shim 与 exe 都不接受 Claude 参数，一个按"命令不存在"失败，一个按"用法错误"退出。任何用 .cmd 把它套成 claude 的做法都是冒充，不做。

## 3 结论（二选一中的后者）

**明确标注：本机无法验证真实 Go 调用。**

缺三样，缺一不可：
1. 讲 Claude 协议的 CLI —— 例如 `npm i -g @anthropic-ai/claude-code` 之后的 `claude`（安装需网络与包管理权限，本机未装）；
2. 部署方提供的私有 provider settings 文件（claude-go 的第二个参数，本机没有）；
3. 该 provider 的凭据（按要求不跨机传输，本机不具备）。

## 4 三者齐备后的一次只读验证（届时执行，不是现在）

```powershell
$env:AGENT_AUTOLOOP_HOME = 'D:\AutoAgentloop\work\agent-autoloop\.home'   # 自有子目录，见 B4 第 4 节
claude -p "只回一句 ok" --output-format json --settings <SETTINGS_JSON> --strict-mcp-config --permission-mode plan --add-dir <FOLDER>
```
判定：退出码 0、stdout 是可解析 JSON、且 `plugins/claude-go/agent.ts:read()` 能从中取到 `usage`（Go 侧再删掉 `cost`）→ 才算"能讲 Claude 协议"。任何一项缺失即记未验。

**未做且不做**：用 .cmd 包装冒充、手写 usage.cost、把回放脚本当真实调用。
