# B-final-report — B 通宵任务单 B-OVERNIGHT-20261108

机器：MAGICBOOK14-ZZ（用户 chs），仓库 D:\AutoAgentloop，worker-only。
执行时间：2026-11-08 03:19 起（UTC 19:19 起），报告生成 03:4x。
证据根：evidence/20261108-final/（INDEX.sha256 见本目录，校验命令 `cd evidence && sha256sum -c 20261108-final/INDEX.sha256`）。

## 0. 一句话结论

B1/B2/B3/B4/B5/B6 全部有交付物；**B2 的「done 计数继续增长」未验**（中台没派活），**B5 真实 Go 调用仍是环境缺口**（无 claude CLI、无 Go 凭据），**B4 的 clone 走的是本机代理而非直连**（github.com 主 IP 被掐）。三处均照抄，不美化。

## 1. 各任务状态

| 任务 | 状态 | 证据 | 关键数字 |
| --- | --- | --- | --- |
| B1 溯源对账 | **完成** | B1-trace-reconciliation.md、b1/ | 244 文件；修复前全树指纹 6a2dae9a…，修复后 46123495…；9 路径 sha256 全列 |
| B1.3 `delete result.sessionUsage;` | **答案：没有** | b1/nine-paths.sha256 | 修复前 sha256 ed0697ad…（≠ A 侧 8dd8c405…），旧行是 `if (result.usage) delete result.usage.cost;` |
| B2 F1 修复 | **完成（done 计数未验）** | B2-f1-fix.md、b2/、before/ | 改后 sha256 235e804e…；判据 pass 1/0 → 还原 fail 1 → 再修 pass 1/0 |
| B2 重启与心跳 | **完成** | b2/、b3/06-after-migration.txt | 新 up.pid 22156；19:30:19Z `/v1/work?claim=beat` HTTP 200 |
| B2 done 计数增长 | **未验** | — | 中台 `job:null`，worker/runs 仍 22 个（最新 35-1，11-06 14:47） |
| B3 ACL 方案乙 | **完成（含一处偏离）** | B3-acl-migration.md、b3/ | privateDirectory 从 ERR → OK；心跳 19:28:59Z / 19:30:19Z 均 200 |
| B4 推送闭环 | **完成（clone 走代理；B7 终版推送已直连）** | B4-network-and-clone.md、b4/ | clone 1 次成功 3 s；HEAD b12ec1c；sha256sum -c **57/57 OK** |
| B5 真实 Go 调用 | **未验（环境缺口）** | B5-real-go-prerequisites.md、b5/ | 无 claude CLI、无 Go 网关凭据 |
| B6 test:windows | **完成** | B6-test-windows.md、b6/ | 484/484/0/0，94319 ms，EXIT=0；跑后无残留任务/监听/新临时家目录 |
| B7 交付 | **完成** | 本报告、INDEX.sha256、b7/ | 分支 b-final-20261108 |

## 2. 必须先让 A 知道的三件事

### 2.1 计划任务改名了

HOME 迁到 `D:\AutoAgentloop\home` 后，服务名由 HOME 派生（`host/service.ts:14-17`）：

- 旧：`\agent-autoloop`（**已注销，不存在了**）
- 新：**`agent-autoloop-09bbb91a`**（= `agent-autoloop-` + sha256(HOME) 前 8 位）

任何按名字 `agent-autoloop` 判活的监控会直接看不见 worker。A 侧看板/巡检脚本要改成前缀匹配 `agent-autoloop*` 或改用新名。

### 2.2 B3 动了一次 DACL（范围最小，任务单假设不成立）

任务单说 `D:\AutoAgentloop\home` 是「自己可写、不需要改 DACL」——**实测不成立**：目录能写，但 `host/files.ts:5-17 privateDirectory()` 里 `$acl.SetOwner($owner)` 抛 `UnauthorizedAccessException`。根因不是 WRITE_DAC（owner 隐式有），是缺 **WRITE_OWNER**；`D:\AutoAgentloop` 给 chs 的显式 ACE 只有 `0x180000`（不可继承），子目录只继承到 Everyone DENY + AU Modify。

处理：只在 `D:\AutoAgentloop\home` 这一个目录加一条可继承的 TakeOwnership（0x80000）ACE 给当前用户，随后产品块 OK，那条 ACE 被产品整块替换掉，不留残余。**没有** WRITE_DAC、没有在根目录动手、没有自我剥夺、没有向下传播（这与任务单禁掉的那条不是同一操作，但仍是一次 DACL 写入，请 A 判定）。

### 2.3 github.com 直连一度断了（B4 走本机 CONNECT 代理，B7 终版推送已恢复直连）

DNS 给的是 20.205.243.166，该 IP 的 443 超时；换 140.82.121.3 / 20.27.177.113 立刻 200。非管理员改不了 hosts，所以 B4 用 `b4/ip-proxy.js`（127.0.0.1:18080，仅 CONNECT，钉 IP）配合一次性 `git -c http.proxy=…`，未改任何全局配置，TLS/SNI 仍是 github.com。**19:50Z 起直连恢复（`curl https://github.com/` 200），B7 终版推送与新 clone 复验都改回直连，1 次即成功。** 代理已停。

## 3. 回滚命令（各自一条）

**B2（撤销 F1 修复 + 重启）**

```bash
cp /d/AutoAgentloop/evidence/20261108-final/before/agent.ts.release /d/AutoAgentloop/release/b-c067fdb-20261107/plugins/claude-go/agent.ts \
&& AGENT_AUTOLOOP_HOME=D:/AutoAgentloop/home node /d/AutoAgentloop/release/b-c067fdb-20261107/bin/agent-autoloop.ts service install
```

**B3（HOME 迁回旧目录 + 重启）**

```bash
AGENT_AUTOLOOP_HOME=D:/AutoAgentloop/home node /d/AutoAgentloop/release/b-c067fdb-20261107/bin/agent-autoloop.ts service remove \
&& AGENT_AUTOLOOP_HOME=C:/Users/19082/.agent-autoloop node /d/AutoAgentloop/release/b-c067fdb-20261107/bin/agent-autoloop.ts service install
```

回滚后任务名回到 `\agent-autoloop`，数据仍是旧 HOME 里那 22 个 runs。新目录 `D:\AutoAgentloop\home` 保留不删。

**B4 代理（关掉即可）**

```bash
pkill -f "node ip-proxy.js"
```

## 4. 本轮改了哪些文件（全量）

| 文件 | 改动 | 改前 sha256 | 改后 sha256 |
| --- | --- | --- | --- |
| release\b-c067fdb-20261107\plugins\claude-go\agent.ts | 第 29–30 行换 `delete result.sessionUsage;` | ed0697ad… | 235e804e… |
| work\agent-autoloop\plugins\claude-go\agent.ts | 同上 | ed0697ad… | 235e804e… |

除此之外：新建 `D:\AutoAgentloop\home`（新 HOME，含 config.json + worker/ + logs/），新建 `evidence/20261108-final/**`，新建 `_night/b4-clone`（B4 校验用克隆）。**没有**改 dashboard/**、没有改 kernel 语义、没有加运行时依赖、没有改测试断言。

## 5. 未验项（照抄，一条不落）

1. **B2 done 计数继续增长** — 未验。只验到 worker 已连上、心跳 200、`job:null`。需要 A 侧派活。
2. **B3 心跳「在 A 中心可见」的 seenAt** — B 侧拿不到（`agent-autoloop status` 回「这台电脑上没有本人的密钥（只接活的电脑看不了）」，worker key 无 `/v1/state` 权限）。B 侧只能给两次 200 的时间点：**19:28:59Z（迁移前）、19:30:19Z（迁移后）**，请 A 侧按这两个点读 `seenAt`。
3. **B4 clone 走代理，不是直连** — 直连 github.com 主 IP 不通（详见 B4 报告）。
4. **B5 真实 Go 调用** — 未验。无 claude CLI、无 Go 网关地址与凭据、本机无 `ANTHROPIC_BASE_URL` 真实地址。上一轮的 `.cmd` 替身只验了 argv 拼装与 stream-json 解析，不算真实调用。
5. **A 侧 F1 修好的文件字节** — B 侧落地版是 235e804e…，A 侧是 8dd8c405…，两者不同。行为一致（判据两方向通过），但字节没对上，需要 A 给文件才能闭合。
6. **`%TEMP%\agent-autoloop-*` 24 个旧目录** — 属本轮之前遗留，跑前后数量与名单一致，按「无新增」判定通过，但机器上仍躺着 24 个，未擅自清理。

## 6. 证据索引

| 文件 | 内容 |
| --- | --- |
| B1-trace-reconciliation.md | 全树指纹、9 路径 sha256、B1.3 明确回答、修复前后逐行 diff |
| B2-f1-fix.md | 备份、改动、判据两方向、重启与心跳、回滚 |
| B3-acl-migration.md | ACL 根因、两方向验证、迁移执行、服务名变更、回滚 |
| B4-network-and-clone.md | 网络诊断表、代理方案、clone 与 57/57 校验 |
| B5-real-go-prerequisites.md | claude CLI / 凭据 / 网络白名单 / 返回体字段四项前置 |
| B6-test-windows.md | 484/484/0/0、跑前后任务/端口/临时目录对照 |
| b1/ | manifest-full.sha256、manifest-full-after-fix.sha256、nine-paths.sha256、recompute.sh |
| b2/ | pass/fail 三方向、判据日志、f1.patch、b8-cost-criterion.test.ts |
| b3/ | 迁移前后快照、ACL 全文、探针脚本 |
| b4/ | clone 失败原文、代理脚本、clone 与 57 行校验输出 |
| b5/ | environment-probe.txt（where claude / npm -g / node 版本 / 替身 settings） |
| b6/ | test-windows.log、before/after 快照、snapshot.sh |
| before/ | 改动前两份 agent.ts 原件 + sha256.txt |
## 7. 交付包与推送（B7）

| 项 | 值 |
| --- | --- |
| 私库分支 | `b-final-20261108`（`https://github.com/Jakiewbe/autolAgentloop.git`，未碰上游、未改 origin、未重写历史） |
| 包路径 | `evidence/20261108-final/` |
| INDEX | `evidence/20261108-final/INDEX.sha256`（路径相对 `evidence/`，`<64hex> *20261108-final/<相对路径>`） |
| INDEX 条数 | **57**（= 包内全部 57 个文件；INDEX.sha256 自身不入清单） |
| 校验 | `cd evidence && sha256sum -c 20261108-final/INDEX.sha256` → 新 clone 内 **57/57 OK，rc=0**（`--depth 1`，HEAD 见包外日志） |
| INDEX 自身 sha256 与 clone 复验全文 | 包外日志 `evidence/20261108-final-INDEX-verify.txt`（刻意放包外，避免自指） |
| 推送重试 | 终版 **1 次即成功（直连）**；中间几轮曾走本机 CONNECT 代理（见 B4/B7） |

细节与三个坑（CRLF 转换、`*.log` 被根 .gitignore 吞、`cp -a` 后 `git add -A` 会重新忽略日志）见 B7-delivery.md。