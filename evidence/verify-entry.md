# 验证入口交付与实测证据（2026-11-05）

交付物：`deploy/verify-entry/verify-entry.ps1` + `deploy/verify-entry/verify-model.mjs`（契约与哈希见 `deploy/verify-entry/README.md`）。
本轮范围：只修验证入口 + 交接材料；未执行安装、join、init、up、try、service install，未改 B 的账本/脚本/分支，未动活动路由，未重发身份密钥。

## 1. 交付字节

| 文件 | 字节 | SHA256 |
| --- | --- | --- |
| `deploy/verify-entry/verify-entry.ps1` | 1754 | `a95d0a7d2d338b129fb59e06eedb5c7ae657f375fd7e569723e8167fba572092` |
| `deploy/verify-entry/verify-model.mjs` | 9185 | `c313bbaa2fb79348f773050a7c62e84cf3613671046f3a80bd56a74c2dfcd9de` |
| `deploy/verify-entry/README.md` | 10110 | 契约文件，不作为被校验对象 |

判分器依赖 `deploy/B-reviewed/agent_result.mjs`：2441 B / `0bead26b5e5cad1239682b9e38b6b2582398760971f163dabdbef3ba7f8b5a6f`（原包文件，未改）。审核包 `deploy/B-reviewed-delivery.zip` 未改，sha256 仍 `e0b4fb5b…9853`。

## 2. 原 `verify-b.ps1` 的真实失败（不是文档推测）

命令（12:07，PowerShell 5.1，真实 codex 0.166.0-alpha.5.1）：

```text
powershell -NoProfile -ExecutionPolicy Bypass -File deploy/B-reviewed/verify-b.ps1 -Agent codex ^
  -Executable C:\Users\chs\AppData\Local\OpenAI\Codex\bin\22cfb1d302613eae\codex.exe ^
  -Model deepseek-v4.1-flash-1017 -OutputDirectory evidence/raw/verify-entry/orig-run
```

结果：`codex.exe : Reading additional input from stdin...` → `NativeCommandError`，定位 `verify-b.ps1:24`；`model.stderr.log` **0 字节**、`model.stdout.jsonl` **未生成**；外层 `exit=0`（脚本自己没跑到推出码那步）。

根因链（三条各自独立成立）：

1. `& $Executable @agentArgs 2> $stderrFile` 未重定向 stdin → codex 打印提示并等输入；
2. 同一行在 `$ErrorActionPreference='Stop'` 下把原生 stderr 转成 `NativeCommandError` → 脚本终止；
3. 终止点在第 24 行，`WriteAllText`、判分、退出码三段都没执行，所以「外壳成功、结果为空」。

另两条与 stdin 无关的缺陷：`-OutputDirectory` 默认值在 param 绑定阶段用 `$PSScriptRoot`（PS 5.1 为空）→ 不传就报 `Join-Path : 无法将参数绑定到参数"Path"`（`verify-b.ps1:6`）；`$stdout -join "`n"` 重新按 UTF-8 写盘，编码、行尾、末尾换行都被改写。

## 3. 新入口实测矩阵（Windows PowerShell 5.1，全部真实执行）

目录：`evidence/raw/verify-entry/tests/`（每项含 `model.stdout.jsonl`、`model.stderr.log`、`verify-result.json`）。

| # | 场景 | 输入要点 | 期望 | 实际退出码 | 关键输出 |
| --- | --- | --- | --- | --- | --- |
| 01 | 缺必填参数 | 不给 `-Model` | 参数校验失败，不调用 | 1 | PS 绑定错误 `MissingMandatoryParameter… Model` |
| 02 | 可执行路径不存在 | `stubs/nope.exe` | 明确失败，不调用 | 2 | `executable does not exist or is not a file` |
| 03 | 模型非零退出 | 桩：合法 JSONL + `exit /b 3` | 判分不通过 | 1 | `judgeError: 进程退出码为 3`，stdout 仍存 80 B |
| 04 | 输出非 JSON | 桩：`this is not json` | 判分不通过 | 1 | `Unexpected token 'h', "this is not json" is not valid JSON` |
| 05 | 等待 stdin | 桩：`pause` | 不得挂起 | 1 | 1 s 返回；判分器拒绝非 JSON 输出 |
| 06 | 参数保真 + 通过路径 | 桩回显 argv 并把令牌当最终文本 | 8 个 argv 不被拆；判分通过 | 0 | `passed:true`、`session: stub-args-thread` |
| 07 | 字节保真 | 桩写 CRLF + 中文 + 末尾换行 | 落盘字节一致 | 1 | 落盘 sha256 与桩输出 sha256 同为 `f2258820…e354`（判分因无 `turn.completed` 失败，符合预期） |
| 09 | 含空格路径 | 同一桩放在 `stubs/with space/` | 参数不被截断 | 0 | 提示词整条到达：`Reply with only this token: AGENT_VERIFY_…` |
| 10 | 真实 codex + 显式 `-m deepseek-v4.1-flash-1017` | A 的 ChatGPT 账号 | 如实失败 | 1 | `The 'deepseek-v4.1-flash-1017' model is not supported when using Codex with a ChatGPT account`（环境事实，非入口缺陷） |
| 11 | 真实 codex + `-Model auto`（不传 `-m`） | 默认模型 | 通过 | 0 | 22 s；4 行 JSONL；`thread_id 01a1a9e7-964b-7202-bc71-74344e5618c1`；最终文本 = 随机令牌 |
| 12 | 真实 claude | `claude.cmd` + `-SettingsFile` | 如实失败 | 1 | 199 s；`{"type":"result","subtype":"success","is_error":true,"api_error_status":401,"result":"Failed to authenticate. API Error: 401 Upstream request failed: Go requires a credential"}` |
| 13 | LF 版脚本可执行 | 桩，`-Model m` | 通过 | 0 | 证明仓库里的 LF 字节在本机 PS 5.1 可直接跑 |

**结论口径**：01/02 证明「输入不合法就不发起调用」；03/04/07 证明「跑完了但结果不合格，绝不返回成功」；11 证明「真实成功时保存原生退出码、完整输出、判分结果」；05/06/09 证明 stdin、参数、空格路径三项工程细节；10/12 证明失败被原样报出，没有被入口吞掉。

## 4. 判分器的口径（未改，供 B 对齐）

`agent_result.mjs` 的 `verifyAgentResult`：

```text
exitCode !== 0                                  → throw 进程退出码为 N
stdout 每一非空行 JSON.parse                    → 任何非 JSON 行即失败
codex: 必须有 turn.completed，且不得有 turn.failed / error
codex: text = 最后一条 item.completed 且 item.type === "agent_message" 的 text
text.trim() !== expected                        → throw 实际最终回复与检查标识不一致
thread.started.thread_id 必须是非空字符串
claude: 最后一条 result 必须 subtype==="success" 且 is_error 为假
```

**usage 不在判分条件里**，本交付不额外校验、也不清零掩盖。

## 5. A 已验 / 仍需 B 验

A 已验：上面 13 项，全在本机 Windows PowerShell 5.1 真实执行。

仍需 B 实机：

1. B 的 codex / claude 真实模型 ID 能否通过（A 的账号只接受默认模型，不能替代）；
2. B 的包装器把 `verify-b.ps1` 换成 `verify-entry.ps1` 后整链是否成立；
3. B 本机 `agent_result.mjs` 的 sha256 是否等于 `0bead26b…5a6f`（入口运行时自动校验，不符退出 2）；
4. B 的 PowerShell 版本与执行策略下是否需要 `-ExecutionPolicy Bypass`（本入口沿用原调用形式）。

## 6. 未做与边界

- 未执行任何安装/联调动作；未改 B 的账本、脚本、分支；未重发或公开传输身份密钥（`C:/Users/chs/agent-autoloop-handoff/b-magicbook14.worker.key` 保持人工交付，本文件不含其内容）。
- 未调整活动路由：A 侧 `b-magicbook14` 的 `command` 仍是占位的裸 `codex`，等 B 回传真实绝对路径与模型后再改。
- 中心 `127.0.0.1:3350` 与 ngrok 隧道保持运行，本文件不涉及地址变更。
