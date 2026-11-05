# A → B 交接单（回应独立审核对 A 的四项补充要求）

生成时间：2026-11-05 00:50 +08:00（01:45 修正：安装器参数名、回执路径、验证脚本参数与已知缺陷、身份交接清单）
生成机器：A / DESKTOP-LM7RKI1
对应审核：d834119a800a1b326da00965d5cd30076e57723a（2 PASS / 2 FAIL / 3 证据不足）
本单只回答**对 A 的补充要求**四项；B 侧现场结论仍以 B 自己的材料为准，本单不替 B 声明任何通过。

---

## 1. 指定哈希的真实审核包传到 B

| 项 | 值 |
| --- | --- |
| 文件 | `deploy/B-reviewed-delivery.zip` |
| 字节 | 414436 |
| sha256 | `e0b4fb5b2e03bd9701cf8af42d9c7f9af0106dc09fd1c3018fd64e427394d853` |
| 审核要求原值 | 同左，逐字一致（实测见 §5.1） |
| 成员 | `agent-autoloop-reviewed.zip`(409043)、`agent_result.mjs`、`delivery.json`、`install-b.mjs`(4460)、`manifest.json`(32262)、`README.md`、`verify-b.ps1`(2022) |

传递通道：本包已随 `main` 分支发布（仓库公开，包内不含任何凭据；审核第 5 项已判 PASS）。

B 侧命令（PowerShell，落盘后先校验再解压）：

```powershell
$u = "https://github.com/Jakiewbe/autolAgentloop/raw/main/deploy/B-reviewed-delivery.zip"
Invoke-WebRequest -Uri $u -OutFile "$env:USERPROFILE\Downloads\B-reviewed-delivery.zip"
(Get-FileHash "$env:USERPROFILE\Downloads\B-reviewed-delivery.zip" -Algorithm SHA256).Hash.ToLower()
# 必须是 e0b4fb5b2e03bd9701cf8af42d9c7f9af0106dc09fd1c3018fd64e427394d853，不等就停手回传实际值
Expand-Archive "$env:USERPROFILE\Downloads\B-reviewed-delivery.zip" -DestinationPath "D:\AutoAgentloop\_reviewed" -Force
```

包内 `verify-b.ps1` 与 `install-b.mjs` 原样保留（本轮未改这两个文件；它们的守卫顺序与阻断缺陷属于 B 侧待修项，不在 A 的改动范围内）。

## 2. B 可达的中心地址

| 项 | 值 |
| --- | --- |
| URL | `https://obconic-subtetanic-tamika.ngrok-free.dev` |
| 隧道 | ngrok 3.35.0，`ngrok http 3350`，出站连接；中心本体仍只听 `127.0.0.1:3350` |
| TLS | 校验通过（`ssl_verify_result=0`） |
| 无密钥访问 | `GET /v1/state` → 401 |
| owner 键 | `GET /v1/state` → 200 |
| B worker 键 | `GET /v1/work?claim=…&wait=0` → 200 `{"job":null,"cancel":[]}` |
| 机器可读 | `evidence/raw/handoff/tunnel-info.json` |
| 复现脚本 | `tools/checks/tunnel-up.sh`（已跑，复用既有隧道） |
| 日志 | `evidence/raw/handoff/20261105-0032-ngrok-tunnel.log`、`…-0047-ngrok-tunnel.log` |

**必须说清的限制（不夸大）**：

- 这是**免费档 ngrok 随机域名**：隧道进程一停或重开，域名就换。域名是会变的，不是稳定生产地址；以 `tunnel-info.json` 的 `public_url` 为准。
- 想要固定地址需要两步人工操作（A 侧无法代做）：登录 ngrok 控制台领一个免费 static domain，然后改用 `ngrok http 3350 --url=<保留域名>`。`ngrok` 配置文件里只有 authtoken，没有 API key，所以 A 侧无法通过 API 预约域名。
- cpolar 通道本轮仍不可用：`~/.cpolar/cpolar.yml` 无 authtoken，运行即报 `not found authtoken`。
- 安全性依据不是「域名保密」，而是应用层密钥：无密钥 401、密钥种类不符 401（实测 §5.2）。地址只发给 B，不写进公开仓库。
- 这一层只解决**可达**；跨机六项联调仍要 B 真正 join 之后才能测，A 不预先声称通过。

## 3. `b-magicbook14` 专属 worker 身份文件

| 项 | 值 |
| --- | --- |
| 密钥种类/名字 | `worker b-magicbook14`（`key list` 已登记，2026-11-04T16:33:53Z） |
| 长度 | 43 字符 base64url |
| 前缀 | `e4Hu8j`（供 B 肉眼核对，不足以冒用） |
| 身份文件 | `C:\Users\chs\agent-autoloop-handoff\b-magicbook14.worker.key`（单行，无换行） |
| 文件 sha256 | `a221bdfd990c3fc9d89241a43f6be065a04d3be661988f8e91a78151b0ef695f`（这是**文件**哈希，可用它核对传输完整性，不等于密钥本身） |
| 签发记录 | `evidence/raw/handoff/20261105-0048-b-worker-key-probe.log`（只含状态码，不含密钥） |

**为什么不进仓库**：`Jakiewbe/autolAgentloop` 匿名可访问（HTTP 200），把 worker 密钥提交上去等于公开签发凭据。所以密钥只在 A 本机文件里，请用你选的人工通道（U 盘、面对面、你自己的私聊）传给 B，不要走公开链接。

**人工交接清单（A 侧已就绪，等 B 确认；文件没进仓库、没进聊天）**：

| 步骤 | 谁做 | 动作 | 完成的判据 |
| --- | --- | --- | --- |
| 1 | A | 把 `b-magicbook14.worker.key`（43 字节单行）拷到**你选的人工通道**（U 盘 / 面对面 / 你自己的私聊或网盘私有目录） | 通道里有一份 43 字节文件 |
| 2 | B | 收到后落到自己的私有目录，例如 `C:\Users\<B账户>\agent-autoloop-handoff\b-magicbook14.worker.key` | 文件存在 |
| 3 | B | 算哈希并核对 | `(Get-FileHash -Algorithm SHA256 <文件>).Hash` 小写等于 `a221bdfd990c3fc9d89241a43f6be065a04d3be661988f8e91a78151b0ef695f`，且 `(Get-Item <文件>).Length` = 43 |
| 4 | B | 回三条给 A：收到的文件哈希、所在路径、是否 43 字节 | A 侧三条与本节表格逐字一致 |
| 5 | B | 安装成功后删掉通道里的中间副本，别留在聊天记录或公共网盘 | 通道里不再有副本 |

核对哈希比核对密钥内容更安全：哈希相同就说明传输没坏，而且把哈希贴出来也不泄露密钥。

**A 侧现状（2026-11-05T01:45 复核）**：文件仍在 `C:\Users\chs\agent-autoloop-handoff\b-magicbook14.worker.key`，43 字节、无换行、sha256 与本节一致；全仓库明文检索该密钥 0 命中，`git ls-files` 里 `.key` 文件 0 个。也就是说，到这一刻它**还没到 B**——第 3 项和第 4 项要等你走完人工通道。

**B 侧落地（B 自己的 HOME，路径按 B 实际账户换，别抄 A 的）**：

```powershell
# 0) 审核包解压到 D:\AutoAgentloop\_reviewed（7 个成员平铺，install-b.mjs 就在这一层）
# 1) 身份文件先落到 B 自己的私有目录，不要让密钥出现在命令行历史或聊天里
#    例：C:\Users\<B账户>\agent-autoloop-handoff\b-magicbook14.worker.key
# 2) 安装（参数名是 --center-url / --worker-name / --worker-key-file）
node D:\AutoAgentloop\_reviewed\install-b.mjs `
  --center-url "https://obconic-subtetanic-tamika.ngrok-free.dev" `
  --worker-key-file "C:\Users\<B账户>\agent-autoloop-handoff\b-magicbook14.worker.key" `
  --worker-name b-magicbook14
```

**参数对照（本节 2026-11-05T01:40 修正：旧版写作 `--url / --worker / --key`，安装器不认）**：

| 用途 | 正确参数 | 旧版误写 | 说明 |
| --- | --- | --- | --- |
| 中心地址 | `--center-url` | ~~`--url`~~ | 必填；必须是无内嵌凭据的 http(s) 地址 |
| 身份文件路径 | `--worker-key-file` | ~~`--key`~~ | 必填；指向**文件**而不是把 43 字符贴在命令行 |
| worker 名字 | `--worker-name` | ~~`--worker`~~ | 可选，默认 `b-magicbook14` |
| 安装根目录 | `--root` | — | 可选，默认 `D:/AutoAgentloop`；运行时解到 `<root>\runtime\<包哈希前12位>` |

安装器自带三道检查，任一不过就退出、不写任何东西：中心 `/healthz` 必须 2xx；身份必须能被 `/v1/work` 接受；`agent-autoloop-reviewed.zip` 与 `manifest.json` 里每个文件的哈希必须逐一相符。若 `~/.agent-autoloop/config.json` 或目标版本目录已存在，它直接报错停手（保留现场），不会覆盖。

**回执**：安装成功后写 `D:\AutoAgentloop\B-install-receipt.json`（= `--root` + `B-install-receipt.json`），字段 `machine/worker/package_sha256/pid/app/status/model_verified/cross_network_task_verified`。其中 `status` 固定为 `worker-started-only`，后两项固定 `false` —— 安装器只证明「进程起来了」，模型和跨机任务要另外实测。

**验证入口（固定交付；原 `verify-b.ps1` 一个字节都没动）**

原包里那份 `verify-b.ps1` 在真实 codex 上**跑不通**，不是文档推测：实测报 `codex.exe : Reading additional input from stdin...` → `NativeCommandError`（`verify-b.ps1:24`），`model.stderr.log` 0 字节、`model.stdout.jsonl` 根本没生成，外层还显示 `exit=0`。根因三条：stdin 没关（codex 等输入）、原生 stderr 在 `$ErrorActionPreference='Stop'` 下被当成终止性错误、`-OutputDirectory` 默认值在 param 绑定阶段用 `$PSScriptRoot`（PS 5.1 下为空，不传该参数直接 `Join-Path : 无法将参数绑定到参数"Path"`，`verify-b.ps1:6`）。

所以**改用同参数名的固定入口**，包本身和它的哈希都不受影响：

| 文件 | 字节 | SHA256 |
| --- | --- | --- |
| `deploy/verify-entry/verify-entry.ps1` | 1754 | `a95d0a7d2d338b129fb59e06eedb5c7ae657f375fd7e569723e8167fba572092` |
| `deploy/verify-entry/verify-model.mjs` | 9185 | `c313bbaa2fb79348f773050a7c62e84cf3613671046f3a80bd56a74c2dfcd9de` |

唯一有效版本是**远端提交里的这两个文件**（`.gitattributes` 已对 `*.ps1` 设 `-text`，仓库里就是 LF、1754 字节）；下载后先 `sha256` 对上再跑，不要自己改换行。判分器仍用 B 自己解压出来的原包 `agent_result.mjs`（2441 B / `0bead26b5e5cad1239682b9e38b6b2582398760971f163dabdbef3ba7f8b5a6f`），入口每次运行前会校验它，哈希不符直接退出 2，不会用改过的判分器放行。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File <下载目录>\verify-entry.ps1 ^
  -Agent codex ^
  -Executable "C:\Users\<B账户>\AppData\Local\OpenAI\Codex\bin\<目录>\codex.exe" ^
  -Model deepseek-v4.1-flash-1017 ^
  -Validator "D:\AutoAgentloop\_reviewed\agent_result.mjs" ^
  -OutputDirectory "C:\Users\<B账户>\agent-autoloop-verify"
```

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `-Agent` | 是 | `codex` 或 `claude` |
| `-Executable` | 是 | 已存在的文件；`.exe` 直调，`.cmd`/`.bat` 经 `cmd /d /s /c`（路径含空格已实测可用） |
| `-Model` | 是 | B 本机实测可用的模型 ID；**`auto` 只对 codex 有效**，含义是「不传 `-m`，用 CLI 默认模型」 |
| `-SettingsFile` | claude 必填 | 已存在的 claude 配置 json |
| `-OutputDirectory` | 否 | 默认脚本同目录 `verification-output\` |
| `-Validator` | 否 | 默认脚本同目录的 `agent_result.mjs` |

**退出码**：`0` 判分通过；`1` 真实跑完但判分不通过（非零退出、非 JSON 行、无 `turn.completed`、出现 `turn.failed`/`error`、回答不是令牌、无会话编号）；`2` 输入或依赖问题（此时**没有**发起模型调用）；`3` 程序起不来。

**产物**（全部落在 `-OutputDirectory`）：`model.stdout.jsonl`（stdout 原始字节，不转码不裁剪）、`model.stderr.log`、`verify-result.json`（`passed`、`nativeExitCode`、`signal`、`agentArgs`、两个输出的 `bytes`/`sha256`、`judge{path,sha256,passed,session,error}`）。判分口径与原包一致：**usage 不参与判定**。

**A 本机已验证**（Windows PowerShell 5.1，证据 `evidence/verify-entry.md` §3）：参数正确进入真实调用并**通过**（codex 0.166.0-alpha.5.1、`-Model auto`、22 s、`thread_id` 非空、最终文本逐字等于随机令牌）；缺参退出 1、路径不存在退出 2；退出码 3、非 JSON 行、无 `turn.completed`、令牌不符四种都返回失败；stdin 不等待（`pause` 桩 1 s）；CRLF + 中文输出落盘字节与桩输出 sha256 完全相同；含空格路径的 8 个 argv 全部还原。claude 分支走到真实 CLI 后如实失败（199 s、exit 1、`401 Upstream request failed: Go requires a credential`）。

**仍需 B 实机验证**：B 的 codex/claude 真实模型能否通过（A 的账号只接受默认模型，**不能用 A 的成功替代 B**）、B 的包装器接入后整链、B 本机 `agent_result.mjs` 哈希是否等于原版、B 的 PowerShell 执行策略。

**二进制的归属**：A 侧换二进制/升版本只影响 A 自己的通道，**解决不了 B 的路径或版本问题**。A 路由里 `b-magicbook14` 的 `command[0]` 最终要填 B 实测出来的程序绝对路径，模型名与版本也以 B 的真实结果为准；B 没回的这段时间 A 不改路由、不开联调。

**联调窗口（A 侧从现在起保持在线）**：中心 `127.0.0.1:3350` 与隧道入口都在跑，保活记录每 60 秒一条写进 `evidence/raw/handoff/tunnel-uptime.log`（字段：时间、本机 `/healthz` 码、隧道 `/healthz` 码、ngrok 进程数）。脚本 `tools/checks/tunnel-uptime.sh`。**地址只在这个进程活着时有效**：ngrok 进程重启会换随机域名，届时 A 会重新发布并在本单追加一行；B 若 `/healthz` 连续失败，先找 A 要新地址，不要改参数硬试。

**回传给 A 的信息（B 填；缺任何一组 A 都不改规则、不开联调）**：

```text
1) codex 绝对路径 : <B 上 which/where.exe 出来的完整路径>
2) codex 版本     : <codex --version 原始输出>
3) 模型实测结果    : <verify-b.ps1 或原生命令的退出码 + 是否回出 AGENT_VERIFY_ 令牌 + 日志路径>
4) 修复版提交号    : <B 自己仓库的 commit，附独立复核结论所在文件>
5) 安装状态       : <是否已获准安装、B-install-receipt.json 的 package_sha256 与 pid、installation-*.log 路径>
6) 身份文件回执    : <路径 + 完整 sha256 + 字节数，不回密钥内容>
```

为什么要这三组：A 侧规则里 `b-magicbook14` 的 `command` 现在写的是裸 `codex`，A 不知道 B 的 PATH 里有没有它；而 A 本机实测 `0.130.0-alpha.5` 必撞 `400 model_not_found`、`0.166.0-alpha.5.1` 才通——版本不同结论就不同。**A 不会用「A 本机成功」替代 B 的成功**。

**A 侧尚未核对的、必须由 B 补齐的三项**：B 上 codex 的绝对路径（A 不猜）、B 的 codex 版本（0.130 在 A 侧必 400，0.166 才通）、`deepseek-v4.1-flash-1017` 在 B 上的真实返回。

**撤销**：`node app/bin/agent-autoloop.ts key remove worker b-magicbook14`（A 侧执行即失效；已实测同一命令对旧密钥返回「密钥已失效」）。

**诚实标注**：A 侧用这把密钥向 `/v1/work` 发过一次探测请求（拿 `job:null`），这会让中台把 `b-magicbook14` 的 `seenAt` 刷新一次。所以「B 在线」不能只看 A 的状态页——真在线要以 B 自己的心跳和 B 的日志为准。

## 4. A 侧登记的 worker、模型、工作目录

`%USERPROFILE%\.agent-autoloop\rules.json`（活动配置，改动前备份见 `evidence/raw/handoff/rules.before-b-register.json`，sha256 `45f0e60e81f6912c3414e9b12bd0e7a2842592791fb0ceb964b4f2b54a2cab83`）：

```json
"b-magicbook14": {
  "name": "B / MagicBook14",
  "worker": "b-magicbook14",
  "use": "command",
  "command": ["codex", "exec", "{resumeArgs}", "--skip-git-repo-check", "{cwdArgs}", "--json", "{prompt}"],
  "model": "deepseek-v4.1-flash-1017",
  "access": "edit",
  "timeout": 30
}
```

```json
{
  "name": "B-接线验证",
  "when": { "source": "local", "types": ["b.ping.*"] },
  "to": "b-magicbook14",
  "cwd": "D:\\AutoAgentloop",
  "prompt": "这是 A 与 B 的接线验证，只在当前目录下建一个文件 b-ping.txt …",
  "tell": "never"
}
```

| 登记项 | 值 | 依据 |
| --- | --- | --- |
| worker 名 | `b-magicbook14` | 与 B 报告 §5 的 join 实测同名 |
| 模型 | `deepseek-v4.1-flash-1017` | B 报告 §6：M1 claude 与 M2 codex 都用这个模型名实测成功 |
| 工作目录 | `D:\AutoAgentloop` | B 报告 §1：B 的采集/工作目录 |
| 运行时能力 | `capacity` 由 B 的 join 决定，A 侧默认单机 1 个开发任务 | `evidence/scheduling.md` §2 |

**两条必须由 B 确认的前提（A 现在给不出，也不假装已满足）**：

1. `command[0]` 写的是裸 `codex`，靠 B 的 PATH 解析。B 报告里是带路径的 `codex.exe`，如果 `codex` 不在 B 的 PATH 上，第一条任务会以 `spawn codex ENOENT` 失败。B 确认后改这一格为 B 的绝对路径即可（这是 B 的现场事实，A 不替 B 猜路径）。
2. B 的 codex 是 0.130.0-alpha.5（B 报告 M2）。A 侧同一通道在 0.130 上会撞 `400 model_not_found`，0.166 才通过（`evidence/adapters.md`）。所以 B 若沿用 0.130，本轮要先在自己机器上核对 `-m deepseek-v4.1-flash-1017` 是否稳定；不稳就换二进制或在 B 侧改用 claude 适配器。

**顺带修掉一个真 bug（否则上面登记不会生效）**：`app/host/server.ts:97-101` 原来用 `RULES_FILE.split("/").at(-1)` 取文件名，Windows 路径只有反斜杠，切出来还是整条路径，于是 `rules.json` 的任何改动都被 watcher 忽略——改规则必须重启中台才生效。已改为 `basename(RULES_FILE)`，并实测：改 `b-magicbook14` 的 `name` → 3 秒内状态页变；改回来 → 3 秒内变回；全过程 pid 62124 未变（`evidence/raw/handoff/20261105-0045-center-restart.log`）。

## 4.5 六项跨机联调怎么对账（B 修好、接上之后逐项做）

**开跑前置条件（缺一不开跑）**：

1. B 修复版的新提交号已给出，并完成独立复核（复核结论附在 B 自己的材料里）；
2. B 回传 codex 绝对路径、版本、模型实测结果三组值；
3. 复核通过且获准安装，B 侧**真实安装完成**（有 `B-install-receipt.json` 与 `installation-*.log`）；
4. A 按上面三组值核对并调整 `b-magicbook14` 的 `command`/`model`，不沿用 A 本机结论。

**执行顺序约束**：取消测试（第 4 项）与断线重启测试（第 5 项）**必须在同一个 B 执行端上依次进行**——先取消、确认进程退出与残留为 0，再做断线重启；不要并发，否则「谁来接这轮活」分不清，两侧日志也无法对应。

B 报告 §7 列的六项，A 侧的准备与判据如下。**每一项都要「A 的中心回执 + B 的进程/日志」两侧同时成立才算过**，只有一侧成立记未验证。

| # | 项 | A 侧做什么 | A 侧留什么证据 | B 侧要回什么 |
| --- | --- | --- | --- | --- |
| 1 | A 派发 → B 执行 → 回传 | 命中 `B-接线验证` 规则（`b.ping.*`），用 `node bin/agent-autoloop.ts event ...` 投事件 | `/v1/state` 里的 run 记录 + `why` 时间线 | 进程退出码、`worker/runs/*/exit-N`、改动文件内容 |
| 2 | 临时目录改文件 + 检查 + 回传 | 规则 `cwd` 限 `D:\AutoAgentloop\try` 一类临时目录，不碰业务目录 | run 的 deliverable 摘要 + 卡片文本 | 文件哈希、目录列表 |
| 3 | 同会话第二轮核对会话号 | 用 `answer` 回第 1 轮的卡片，触发第 2 轮 | 两轮 `session` 字段是否相同 | B 侧 rollout/thread id |
| 4 | 取消任务后进程退出 | `node bin/agent-autoloop.ts stop <run>` | cancel 记录 + 中心状态 | `taskkill` 前后进程列表、残留数 |
| 5 | 断线重连 / 执行端重启 | 保持中心不动，B 重启执行端后看是否续领、是否重复执行 | run 不重复、`lease` 变化 | 重启前后 pid、重连日志 |
| 6 | 登录启动入口 | A 侧只核对配置存在（不动 B 的注销） | `rules.json`/`config.json` 快照 | `HKCU\...\Run` 与 Startup 项的实际存在性与内容 |

注意顺序：1 → 2 → 3 是链式的（第 3 项要第 1 项先成），4 与 5 可并行，6 独立且涉及 B 的登录状态，**要 B 自己决定什么时候做**，A 不替 B 动注册表。

## 5. 实测记录（本节所有数字都来自下面这些日志）

### 5.1 包哈希

```
$ sha256sum deploy/B-reviewed-delivery.zip
e0b4fb5b2e03bd9701cf8af42d9c7f9af0106dc09fd1c3018fd64e427394d853 *deploy/B-reviewed-delivery.zip
```

### 5.2 密钥种类隔离（`evidence/raw/handoff/20261105-0048-b-worker-key-probe.log`）

| 请求 | 结果 |
| --- | --- |
| B worker 键 → `/v1/work?claim=…` | 200 `{"job":null,"cancel":[]}` |
| B worker 键 → `/v1/state` | 401 `要本人自己的密钥` |
| A worker 键 → `/v1/work` | 200 |
| owner 键 → `/v1/work` | 401 `要接单程序自己的密钥` |
| owner 键 → `/v1/state` | 200 |
| 乱写键 → `/v1/work` | 401 |
| 无 Authorization → `/v1/work` | 401 |

### 5.3 规则热加载（`…-0045-center-restart.log`）

| 时点 | 观测 |
| --- | --- |
| 重启前 | pid 60464（旧代码，改动规则不生效） |
| 重启后 | pid 62124，`/healthz` 200，`state.agents` 出现 `b-magicbook14|b-magicbook14|B / MagicBook14` |
| 改 name（不重启） | 3 秒后 `after_patch=B / MagicBook14 (reload-probe)` |
| 改回（不重启） | 3 秒后 `after_revert=B / MagicBook14`，`runs=13` 不变，pid 仍 62124 |

## 6. 本轮仍未做（不写通过）

- B 真正 join、A 派发 → B 执行 → 回传（六项跨机联调一项未测；要等 B 用 §3 的身份接上）。
- B 侧守卫脚本的阻断缺陷（审核 FAIL 3）与 `deploy-b/` 哈希表漏 3 文件（审核 FAIL 6）：属 B 的改动。
- B 的 codex 管道退出码原生捕获（审核证据不足 1）：属 B 的证据补采。
- 固定域名（需人工在 ngrok 控制台操作）。
## 7. 发布记录（发布后再核对，不是自证）

| 项 | 值 |
| --- | --- |
| 提交 | `43b3c6f59e4bd50629a3dcb1b33fa92509dba594`（`main`） |
| 远端 main HEAD | `git ls-remote` 返回同值 |
| 包直链 | `https://github.com/Jakiewbe/autolAgentloop/raw/main/deploy/B-reviewed-delivery.zip` |
| 匿名下载实测 | `http=200`，414436 字节 |
| 下载后哈希 | `e0b4fb5b2e03bd9701cf8af42d9c7f9af0106dc09fd1c3018fd64e427394d853`，与本地 `cmp` 逐字节相同 |
| 日志 | `evidence/raw/handoff/20261105-0055-remote-package-check.log` |

这把「A 手上有包」升级成「B 能从公开地址按哈希取到同一个包」。仍不等于 B 已收到——B 侧的下载、校验、解压、安装要由 B 自己留证。

## 8. 2026-11-05T10:05 状态快照（交接就绪，等 B）

| 项 | 状态 | 依据 |
| --- | --- | --- |
| 身份文件 | 已备好，**尚未到 B** | `C:\Users\chs\agent-autoloop-handoff\b-magicbook14.worker.key`，43 字节，sha256 `a221bdfd…695f` |
| 交接卡（不含密钥） | 已生成 | `C:\Users\chs\agent-autoloop-handoff\TRANSFER-CARD.txt`，sha256 `c617aab1c8be88610def3831a24b88e92d619d640ba193ebc3b09d423b98db63` |
| 交接状态机 | `awaiting_b_confirmation` | `evidence/raw/handoff/identity-handoff-state.json` |
| 中心 | 在线 | `127.0.0.1:3350` LISTENING（pid 62124），`/healthz` 200 |
| 隧道 | 在线 | `https://obconic-subtetanic-tamika.ngrok-free.dev`，`/healthz` 200，ngrok pid 50924 |
| 保活记录 | 持续写入 | `evidence/raw/handoff/tunnel-uptime.log`，10:01–10:04 连续 `local=200 tunnel=200` |
| 六项联调 | 0/6，**未开跑** | 缺 B 的提交号、复核结论、三组实测值、真实安装回执 |
| 代码改动 | 暂停 | 本轮只改文档与证据，不动 `app/` |

**下一步不在 A**：等 B ① 收下身份文件并回传路径/哈希/字节数；② 给出修复版提交号并完成独立复核；③ 回传 codex 路径、版本、模型实测结果。三项齐了且 B 真实安装完成、获准联调，A 才调路由并开跑六项（取消与断线重启在同一执行端依次做）。
