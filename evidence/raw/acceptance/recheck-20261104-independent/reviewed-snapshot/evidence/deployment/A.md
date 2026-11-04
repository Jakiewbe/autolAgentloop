# 双机部署 · A 侧（唯一中台 + A 执行端）

采集时间：2026-11-04 18:17–18:37（Asia/Shanghai）。主机：DESKTOP-LM7RKI1。
本文件只写**实际跑过**的；没跑过的单列在 §7。B 侧见 `evidence/deployment/B.md`（尚未产出）。

## 1. 部署包与版本（固定版本，不跟上游浮动）

| 项 | 值 |
| --- | --- |
| 上游 | `KKKKhazix/agent-autoloop`（MIT，数字生命卡兹克） |
| 基线提交 | `96b6c9c71671c8096f2da1c7a6ffbd19a1a6866a`（`app/` 为 detached HEAD，未建分支、未 commit） |
| 版本号 | `1.0.0` |
| 部署包 | `deploy/agent-autoloop-96b6c9c7-win2.tar.gz`（321572 B，工作树，排除 `node_modules`/`.git`；win1 是 19:00 那版，不含会话接续，保留但不再作为验收材料） |
| 部署包 sha256 | `caf7048f4b6a5463e28ee6dca156b978f9c31173d17f31d96107f8ef980072a3` |
| 改动补丁 | `evidence/raw/app/windows-changes.patch`（1582 行，`git diff --binary`，含 5 个新代码文件 + `pnpm-lock.yaml`） |
| 补丁 sha256 | `0faca142e8ff3a0fdb2a6aab685696218ea3ec4cf8b0814d83e8e922533804ed` |
| 运行时 | Node `v24.12.0`（`C:\Program Files\nodejs\node.exe`） |
| 本机 `AGENT_AUTOLOOP_HOME` | `C:\Users\chs\.agent-autoloop`（默认值，未用环境变量覆盖） |

包与补丁二选一即可复现同一份代码：B 用同一包解压，或 `git checkout 96b6c9c71671 && git apply windows-changes.patch`。两种方式都要先核对上表 sha256。

## 2. 装了什么、装在哪

| 位置 | 内容 | 性质 |
| --- | --- | --- |
| `C:\Users\chs\.agent-autoloop\config.json` | `url`/`hub.listen`/`hub.publicUrl`/`worker{name,key}`/`source{name,key}`/`owner`/`channels.desktop{key}` | 私密（含密钥），**不进证据** |
| 同上 `rules.json` | 来源 `local`、Agent `Agent`（`use: command`）、通道 `desktop`、试跑规则 `试一下` | 可审 |
| 同上 `master.key` / `hub.db*` | 主密钥与事实库 | 私密 |
| 同上 `logs\up.log` | 后台启动的重定向输出 | 可审 |
| `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\agent-autoloop.cmd` | 登录即 `up`、退出 10 秒后重起、输出追加 `logs\up.log` | 可审，删除即撤销 |
| `~/.codex/skills/agent-autoloop` | junction（`linkSkill()` 建） | 可删 |

部署前现场有一个 **17:40 的测试残留 HOME**（`hub.db`/`master.key`/`rules.json[command:["true"]]`/`try/`，无 `config.json`，3350 未监听），整体改名为 `C:\Users\chs\.agent-autoloop-residue-20261104-1740` 保留未删；另有失败的首次 init 半成品改名为 `C:\Users\chs\.agent-autoloop-failed-init-20261104-1817`。两者都不进证据（含 master.key）。

## 3. 唯一中台 + A 执行端

- 中台与执行端是同一个进程（`up` 同时起 hub 与 worker `desktop-lm7rki1`）：日志 `[hub] listening on 127.0.0.1:3350`、`[worker] worker desktop-lm7rki1 started`（`evidence/raw/deploy/20261104-182300-up.log`）。
- 监听地址固定 `127.0.0.1:3350`：不绑 `0.0.0.0`，本机以外默认不可达（与 `evidence/network.md` §3 的访问范围一致）。
- **重复启动拒绝**：已有进程时再 `up` → `已经在跑了（进程 56328）`，不起第二个中台、不改库（`evidence/raw/deploy/20261104-183000-service-restart.log` §1）。
- 同一台机器不跑第二个 `AGENT_AUTOLOOP_HOME`：第二个 HOME 会有自己的 `hub.db` 与 Startup 脚本（`label()` 带哈希后缀），本部署没建。

## 4. 启动、重启与恢复（实测）

| 步骤 | 命令 | 结果 |
| --- | --- | --- |
| 启动 | `node bin/agent-autoloop.ts up`（后台） | pid 56328，3350 LISTENING |
| 端到端 | `try` → `answer 1 1` → `status` | 2 轮完成，卡片 #1「蓝色」已答，第 2 轮结束语「你选了蓝色，试跑通过」 |
| 强杀 | `taskkill /PID 56328 /F` | 端口关闭，无残留子进程 |
| 重新拉起 | 再次 `up` | pid 53264，`status` 仍显示 2 轮与已答卡片，`why 2` 时间线完整（18:21:04 规则版本 → 18:22:21 事件/回答/领取 → 18:22:56 结束） |
| 后台启动 | `service install` | 写入 Startup `.cmd`（内容见表 §2）；**首次 EPERM、第二次成功**，见 `evidence/windows-runtime.md` §7.3 |

日志：`evidence/raw/deploy/20261104-183000-service-restart.log`。

## 5. 管理入口清单（哪些接好了，哪些没有）

| 能力 | 入口 | 状态 | 依据 |
| --- | --- | --- | --- |
| 看项目/机器/任务状态 | `agent-autoloop status` | 可用 | 上面 §4 的 status 输出（在跑/排队/今天做完/等你、Agent 与通道在线、最近卡片、最近几轮） |
| 查某一轮证据 | `agent-autoloop why <轮次> [--json]` | 可用 | §4 `why 2` 时间线 |
| 回答问题 | `agent-autoloop answer <卡片> <序号>` / `resolve` | 可用 | 卡片 #1 回答后触发第 2 轮 |
| 暂停项目 / 停止任务 | `agent-autoloop stop <轮次>`、项目暂停 | **未实测**（停止路径只在 `tests/windows-runtime.test.ts` 里验过 taskkill 整树）；不标可用 | — |
| 查证据文件 | 本机 `evidence/` 目录；`why --json` 原始事实 | 部分可用（本机可用，远程未接） | — |
| 远程管理入口 | — | **未接**：中台绑 127.0.0.1，跨网管理需要 `evidence/network.md` 选的隧道/VPN 落地后才能开；cpolar 现有隧道指向 8080/3389，与本服务无关 | `evidence/raw/preflight/20261104-183000-network-facts.txt` |

## 6. 身份与密钥（服务启动后实测）

`evidence/raw/deploy/20261104-182600-auth-probe.txt`（探针脚本 `evidence/raw/deploy/auth-probe.mjs`，只打印状态码）：

| 请求 | 状态 | 返回 |
| --- | --- | --- |
| 无 `authorization` | 401 | 要接单程序自己的密钥 |
| 随便一串 Bearer | 401 | 同上 |
| 拿 owner 密钥当 worker | 401 | 同上 |
| 拿 source 密钥当 worker | 401 | 同上 |
| worker 自己的密钥 | 200 | `{"job":null,"cancel":[]}` |

结论：密钥按种类分离，错种类/无凭据都领不到任务；worker 身份由密钥决定，不接受请求参数改写。

## 7. 模型通道（本机实测，配置未改）

| 通道 | 用哪个二进制/命令 | 结论 |
| --- | --- | --- |
| Codex（部署使用） | `C:\Users\chs\AppData\Local\OpenAI\Codex\bin\22cfb1d302613eae\codex.exe`（0.166.0-alpha.5.1），命令数组 `exec {resumeArgs} --skip-git-repo-check {cwdArgs} --json {prompt}` | 可用：`try` 两轮均 exit 0（32s/29s）；第二轮**接在同一个 codex thread 上**（同一 rollout 文件、2 条 UserMessage、无新文件），见下 |
| Codex（PATH 同名旧版） | `…\Codex\bin\codex.exe`（0.130.0-alpha.5） | 不可用：`400 model_not_found`；PATH 里没有 codex，**必须写全路径** |
| OpenCode | `opencode run … --model opencode/deepseek-v4.1-flash --format json` | 可用（7s，会话可用 `--session <id>` 接续）；本部署未接 |
| Claude Code | `claude -p` | 不可用（上游鉴权 400/401），不作为主路径 |
| DSH ACP | `@deepseek-ai/dsh-acp` 0.2.1-rc.5 | 仅源码核查：无 `session/load`、`turn.model` 不生效（见 `evidence/adapters.md`） |

会话接续（20:43–20:58 实测，原文 `evidence/raw/deploy/20261104-2058-resume-verify.txt`）：适配器按 `{resumeArgs}` / `{cwdArgs}` 展开成 `exec resume <thread_id> --skip-git-repo-check`（接续不要再给 `-C`），并从 `--json` 输出里取最后一条 `agent_message` 当这一轮的话、把 `thread_id` 上交中台。实测 run 8（提问，新建 `rollout-2026-11-04T19-47-11-01a1a662-…`）→ answer → run 9（回答「蓝色」，**同一 thread，无新 rollout**，mtime 19:48）→ 卡片 #4「你选了蓝色，试跑通过」。

仍未接的：Claude Code（上游 400/401）；opencode 只做了 CLI 探针，没有接进中台（接的时候用 `{sessionArgs}`，ID 取事件流里的 `sessionID`）。

## 8. 未完成 / 未验证

1. **B 侧全部未做**：B 目录、`join`、Startup、通道登记都等 B 盘点报告（`evidence/preflight/B.md` 仍缺，T3 依赖未解）。
2. **远程管理入口未接**：A 中台只见 127.0.0.1；不同网络访问未验证（`evidence/network.md` §5 已声明不声称通过）。
3. **未做真实注销/登录验证**：Startup 脚本只验证了内容与生成，没有在重新登录条件下跑。
4. **`stop`/项目暂停 未实测**：不标可用。
5. **费用与额度未知**：`status` 显示「Token 没上报、费用没上报」；codex 套餐额度没有接口，按 T9 以轮数/时限为硬限。
6. **webhook/通道走查**：桌面通道在 Windows 上恒不可用（`plugins/desktop` 判断 launchctl），本部署的卡片是从 CLI 读的。
