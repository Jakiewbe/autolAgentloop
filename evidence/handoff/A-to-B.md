# A → B 交接单（回应独立审核对 A 的四项补充要求）

生成时间：2026-11-05 00:50 +08:00
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

**B 侧落地（B 自己的 HOME，路径按 B 实际账户换，别抄 A 的）**：

```powershell
# 1) 把密钥写进 B 的 join 参数（<KEY> 是从身份文件里读到的 43 字符）
# 2) 用审核包里的安装器接线，中心地址用 §2 的 URL
node D:\AutoAgentloop\_reviewed\install-b.mjs `
  --url "https://obconic-subtetanic-tamika.ngrok-free.dev" `
  --worker b-magicbook14 --key "<KEY>"
```

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
