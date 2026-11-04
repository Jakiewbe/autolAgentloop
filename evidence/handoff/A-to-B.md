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

**模型实测（`verify-b.ps1` 的必填参数）**：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\AutoAgentloop\_reviewed\verify-b.ps1 `
  -Agent codex `
  -Executable "C:\Users\<B账户>\AppData\Local\OpenAI\Codex\bin\<hash目录>\codex.exe" `
  -Model deepseek-v4.1-flash-1017
```

| 参数 | 必填 | 取值 |
| --- | --- | --- |
| `-Agent` | 是 | 只能是 `codex` 或 `claude`（其他值在参数校验阶段就被拒） |
| `-Executable` | 是 | 必须是**存在的文件**路径；不存在的路径直接 throw |
| `-Model` | 是 | B 本机实测可用的模型 ID |
| `-SettingsFile` | `-Agent claude` 时必填 | claude 的私有配置；文件不存在直接 throw |
| `-OutputDirectory` | 否 | 默认脚本同目录下 `verification-output\`，写 `model.stdout.jsonl` 与 `model.stderr.log` |

**已知缺陷与修正版（2026-11-05T01:40 实测）**：原 `verify-b.ps1` 把 `-OutputDirectory` 的默认值写成 `(Join-Path $PSScriptRoot 'verification-output')`，在本机 PowerShell 5.1 下 `$PSScriptRoot` 求值为空，**不显式传 `-OutputDirectory` 就在参数绑定阶段报错**（`Join-Path : 无法将参数绑定到参数"Path"，因为该参数为空字符串`，`verify-b.ps1:6`），此时还没跑到任何模型调用。两种解法：

1. 调用时显式带上 `-OutputDirectory "C:\Users\<B账户>\agent-autoloop-verify"`——已实测可以正常往下跑并写出 `model.stdout.jsonl`/`model.stderr.log`；
2. 用同目录的 **`verify-b-fixed.ps1`**：把默认值移进脚本体，不传 `-OutputDirectory` 也能跑，其余参数与校验逻辑不变。

**这个修正版的字节哈希以远端为准**：GitHub 上 `main` 的 `deploy/B-reviewed/verify-b-fixed.ps1` 是 2527 字节、sha256 `23458837f2782638dc6599d4d8582ddbf14afe1360f738fcd82daf69856beab9`（LF 换行，已实测在 PowerShell 5.1 下能正常执行）；A 工作副本是 2563 字节 CRLF 版本、sha256 `36c964e32c039c158d422c4d4ad648a25442226182945f7fadd1b05b653a7e31`，两者内容等价。请按你实际拿到的**那一份**算哈希，不要按段落里另一个数去对。

原包里那份 `verify-b.ps1` 不动，审核包哈希 `e0b4fb5b…9853` 因此仍然成立。

它给模型一个本次随机生成的 `AGENT_VERIFY_<guid>` 令牌，要求模型只回这个令牌，再用 `agent_result.mjs` 校验 stdout、退出码和令牌是否一致；不通过就 throw。**它只证明模型真能回话，不证明编辑、命令执行或双机部署**。

**联调窗口（A 侧从现在起保持在线）**：中心 `127.0.0.1:3350` 与隧道入口都在跑，保活记录每 60 秒一条写进 `evidence/raw/handoff/tunnel-uptime.log`（字段：时间、本机 `/healthz` 码、隧道 `/healthz` 码、ngrok 进程数）。脚本 `tools/checks/tunnel-uptime.sh`。**地址只在这个进程活着时有效**：ngrok 进程重启会换随机域名，届时 A 会重新发布并在本单追加一行；B 若 `/healthz` 连续失败，先找 A 要新地址，不要改参数硬试。

**回传给 A 的三组值（B 填，A 据此调路由；缺任何一组 A 都不改规则）**：

```text
1) codex 绝对路径 : <B 上 which/where.exe 出来的完整路径>
2) codex 版本     : <codex --version 原始输出>
3) 模型实测结果    : <verify-b.ps1 或原生命令的退出码 + 是否回出 AGENT_VERIFY_ 令牌 + 日志路径>
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