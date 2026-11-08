# B 报告 · B-20261108-02（基座升 3d0e835 + 重放 9 路径 + 收回 #178 + 回归 + 出包）

- 机器：MAGICBOOK14-ZZ（用户 chs / 19082），worker 名 b-magicbook14
- 仓库：D:\AutoAgentloop\work\agent-autoloop（分支 base-3d0e835）
- 生成时间：2026-11-08T03:5xZ（见各证据文件内时间戳）
- 生产运行基座：**仍是 release\b-c067fdb-20261107**（未切换，原因见 B6）
- 新基座：release\b-3d0e835-20261108（253 文件，git archive f28c7fa）

## 结论速览

| 项 | 结果 | 判据 | 证据 | 未验 |
| --- | --- | --- | --- | --- |
| B1 新基座 | 通过 | origin/main = 3d0e835…，18 提交；分支 base-3d0e835 porcelain 为空 | b1（见下） | — |
| B2 重放 9 路径 | 通过 | 7 条原样带 + 2 条合并（worker.ts / agents.ts），commit f28c7fa | b5\nine-paths-table.txt | 与 A 侧字节一致性（见 §B2.4） |
| B3 收回 #178 | 通过 | 旧基座 THROW / 新基座 OK（同一目录、同一 token）；home DACL 只剩 owner+SYSTEM | b3\01、02 | — |
| B4 回归 | **部分通过** | typecheck 0、format:check 0、三条实战判据全绿；**test:windows 501 例 500 过 1 红** | b4\* | npm test 在 Windows 不收敛（非门槛） |
| B5 出包 | 通过 | manifest 253/253、INDEX 自校、新 clone 复验 | b5\* | — |
| B6 B 机切换 | **未做（阻塞）** | B4 门槛 1 红 → 按「阻塞即停」不切换 | — | 切换本身 |
| B7 报告 | 本文 | — | — | 见文末「未验」 |

## B1 新基座

命令与输出：

```
git fetch origin                      # origin = https://github.com/KKKKhazix/agent-autoloop（只 fetch，未推）
git rev-parse origin/main             # 3d0e8353fd9e5e4d3e45b574806ef6fcd41dba45
git log --oneline c067fdb..origin/main | wc -l   # 18
git diff --stat c067fdb..origin/main            # 63 files changed, 1809 insertions(+), 620 deletions(-)
git checkout -B base-3d0e835 3d0e8353fd9e5e4d3e45b574806ef6fcd41dba45
git status --porcelain                # 0 行
```

- 工单口径 56 文件 +1785/−207：**全量 63 文件**里含我们独有的 7 条路径（plugins/claude-go/agent.ts、tests/claude-go.test.ts、tests/command-adapter.test.ts 等），把它们排除后是 **56 files, 1788 insertions(+), 216 deletions(-)**；与工单的 +1785/−207 有 3/9 行差异，属统计口径（重命名/模式行计数），不影响结论。
- merge-base(c067fdb, origin/main) = 16130cc2b981abf0319da4d838bb100f1bca6c5d；我们 9 路径相对该点的 delta = 9 files changed, 413 insertions(+), 24 deletions(-)。
- 旧 base-main 上未提交的 F1 修复已收进 stash：`git stash push -m "F1 fix on c067fdb (B-20261108-02)" -- plugins/claude-go/agent.ts` → stash@{0}（未 drop，回滚可用）。
- **未做**：没有 rebase 旧分支、没有改写任何历史、没有推上游。

## B2 重放 9 路径（逐条对照）

commit：**f28c7faf86cdada31e70f812716b4a9afe79f6c8**（父 3d0e835），工作区干净。

| 路径 | 上游 3d0e835 是否动过 | 我们的处理 | 上游 sha256 | 本次 sha256 |
| --- | --- | --- | --- | --- |
| plugins/command/agent.ts | 没动 | 原样带 | 5911eca7…793721 | 71ba0989…8f77a1 |
| plugins/claude-go/agent.ts | 上游没有此文件 | 原样带（含 F1：`delete result.sessionUsage;`，第 30 行） | (absent) | 235e804e…fa8488a7 |
| worker/worker.ts | 动了（#179 async alive/groupAlive、#170 program） | **合并**：只改 read() 的 stdout 读取与第 4 参 | 74d7908a…580c97 | bd546a1d…8f77f686 |
| worker/agents.ts | 动了（#170 Turn.program、check?(program?)） | **合并**：只扩 Adapter.read 签名 | 062c8e12…16058e | 5f835c07…1893335 |
| tests/command-adapter.test.ts | 上游没有 | 原样带 | (absent) | 935775d5…df78c5 |
| tests/claude-go.test.ts | 上游没有 | 原样带 | (absent) | a9361efa…6e8df4 |
| tests/acp.test.ts | 没动 | 原样带 | ccde04b4…e387e | 343dae96…9c3bc5 |
| tests/windows.test.ts | 没动 | 原样带 | 25b096f7…a13030 | 2a0229c8…621821 |
| tests/delivery-scope.test.ts | 没动 | 原样带 | d64d95ea…b0e989 | 0e4c4a76…1cc27f5 |

两条合并的确切内容（对 3d0e835 的全部差异只有这两处）：

```ts
// worker/worker.ts（3d0e835 的 342-345 行处）
- const reading = adapter.read(snapshot(out), code, code === null ? "" : snapshot(err));
+ const stdout = code !== null && existsSync(out) ? readFileSync(out, "utf8") : snapshot(out);
+ const reading = adapter.read(stdout, code, code === null ? "" : snapshot(err), entry.job.agent);

// worker/agents.ts（3d0e835 的 45-46 行处；同时保留上游 program?: string 与 check?(program?: string)）
- read(stdout: Snapshot, code: number | null, stderr: string): Reading;
+ read(stdout: string, code: number | null, stderr: string, source?: Pick<Turn, "command">): Reading;
```

- 文本 diff（vs 3d0e835）：command/agent.ts +135/−18、worker/worker.ts +4/−1、worker/agents.ts +5/−2、tests/acp.test.ts +22/−3、tests/windows.test.ts +7、tests/delivery-scope.test.ts +12；其余 3 条为新增文件。
- 上游新增的 tests/event-outcome.test.ts、tests/status-view.test.ts、tests/windows-admin.test.ts 一并带过来了，test:windows 里都在跑（见 B4）。

### B2.4 未验：与 A 侧字节一致性

工单称 A 侧 plugins/claude-go/agent.ts 修好后 sha256 = 8dd8c405…；我这边同一文件是 **235e804e…**。该文件在 3d0e835 上游不存在，双方都是各自树里的本地文件，字节差异无法在 B 侧消解（缺 A 侧原件）。**这是未验项，不是已对齐项。**

## B3 收回 #178（取代 11-07 的手工 ACE）

### 三件证据

1) **home 的 DACL 现在只有 owner + SYSTEM，保护开启，无继承、无其余 ACE**（b3\02-after-rework.txt）：

```
icacls D:\AutoAgentloop\home
D:\AutoAgentloop\home NT AUTHORITY\SYSTEM:(OI)(CI)(F)
                      MAGICBOOK14-ZZ\chs:(OI)(CI)(F)
                      Mandatory Label\Low Mandatory Level:(I)(OI)(CI)(NW)

SDDL: O:S-1-5-21-4020587617-1314364305-3965834536-1001G:…-513D:PAI(A;OICI;FA;;;SY)(A;OICI;FA;;;S-1-5-21-4020587617-1314364305-3965834536-1001)
Owner=MAGICBOOK14-ZZ\chs   AreAccessRulesProtected=True   RuleCount=2
```

2) **被删掉的那条 ACE 的受托人**：`S-1-5-21-4020587617-1314364305-3965834536-1001` = MAGICBOOK14-ZZ\chs 本人（与 `WindowsIdentity.GetCurrent().User` 完全一致），权限 `TakeOwnership (0x80000)`，ContainerInherit+ObjectInherit。
   它当时为什么能修好：旧基座 host/files.ts 在 `$acl.SetOwner($owner)` 处需要 **WRITE_OWNER（0x80000）**。D:\AutoAgentloop 根上给 chs 的显式 ACE 是 `(A;;0x180000;;;S-1-5-21-…-1001)` = WRITE_OWNER|SYNCHRONIZE，但**没有 OI/CI，不向子目录继承**；新建子目录只继承到 `AU (A;ID;0x1301bf;;;AU)`（Modify，不含 WRITE_OWNER），所以子目录上 SetOwner 被拒。
   11-07 那条手工 ACE 给的是 `TakeOwnership (0x80000)` 且带 ContainerInherit+ObjectInherit，等于把 WRITE_OWNER 补到子目录，SetOwner 于是成功；紧接着 `SetAccessControl` 把整块 DACL 换成产品形态（owner + SYSTEM 两条），手工 ACE 随之消失——**当前状态里已无残余**（见 02-after-rework.txt 的 RuleCount=2）。
3) **D:\AutoAgentloop 根 DACL 未动**（b3\00-before-reinstall.txt 与 b3\02-after-rework.txt 的根 SDDL 完全一致，逐字符比对）：

```
O:S-1-5-21-4020587617-1314364305-3965834536-1001G:…-513D:AI(D;CI;DT;;;WD)(A;OICI;0x110156;;;S-1-4-…)…(A;;0x180000;;;S-1-5-21-4020587617-1314364305-3965834536-1001)(A;ID;FA;;;BA)…(A;ID;0x1301bf;;;AU)…(A;ID;0x1200a9;;;BU)
```

### 产品路径验证（A/B 对照，同一目录族、同一 token）

脚本 b3\acl-ab.ts，在 D:\AutoAgentloop\_b3probe-new 下新建两个目录（只继承「修改」，无 WRITE_OWNER）：

| 目标 | 用哪份代码 | 结果 |
| --- | --- | --- |
| _b3probe-new\old-fresh | 旧基座 b-c067fdb 的 privateDirectory | **THROW** `使用"2"个参数调用"SetAccessControl"时发生异常:"尝试执行未经授权的操作。"`（UnauthorizedAccessException） |
| _b3probe-new\new-fresh | 新基座 b-3d0e835 的 privateDirectory | **OK**（产物 DACL：SYSTEM + chs，RuleCount=2，protected=True） |
| D:\AutoAgentloop\home | 新基座 privateDirectory | **OK** |

原文：b3\01-ab-old-vs-new.txt。新代码关键改动（3d0e835 的 host/files.ts:5-22）：只有 `GetOwner() -ne $owner` 时才 `$acl.SetOwner($owner)`——所有者已是本人时不再需要 WRITE_OWNER。

### 回答「新机器把 HOME 放非系统盘、不改 DACL，能不能装」

**能，前提是那个目录由这个账户自己创建（owner 已是本人）。** 实测依据：D:\AutoAgentloop 下新建目录继承到的只有「修改」权限、没有 WRITE_OWNER，旧代码必抛、新代码直接过。若目录的 owner 不是当前账户（例如从别的机器/别的账户拷来的空目录），仍会因缺 WRITE_OWNER 失败——这一点没有掩盖。

## B4 回归

### 命令与结果

| 命令 | 结果 | 证据 |
| --- | --- | --- |
| `npm run typecheck` | EXIT 0 | — |
| `npm run format:check` | All matched files use Prettier code style! EXIT 0 | — |
| `npm test` | **不通过且不收敛**：我们这棵 536 ✔ / 68 ✖；**pristine 3d0e835 对照 513 ✔ / 71 ✖**；两棵都在 simulation/up-lock 处挂住，420 s 超时（EXIT=124） | b4\npm-test.log、b4\npm-test-pristine.log |
| `npm run test:windows` | **501 tests / 500 pass / 1 fail / 0 skipped**，EXIT=1，127 s | b4\test-windows.log |

`npm test` 的失败全部落在 macOS/Linux 专属路径（osascript 通知、systemd/launchd 服务、feishu、DSH、codex browser access 等）；同一脚本在 Windows 上不是可用门槛。

pristine 对照已做（`git archive 3d0e835 | tar -x` 到 _night\pristine-3d0e835 后 `timeout 420 npm test`）：**513 ✔ / 71 ✖，同样不收敛，EXIT=124**。结论：`npm test` 在 Windows 上的不收敛是上游既有性质，不是本次重放引入的回归。

### test:windows 的唯一红：上游 #187 新增的管理员专属用例

```
✖ a process with more rights than the desktop is told apart from one with the desktop's own (6927.1817ms)
ℹ tests 501 / pass 500 / fail 1 / skipped 0
```

- 文件：tests/windows-admin.test.ts:67-83，我们**没有改过它**（`git diff 3d0e835 -- tests/windows-admin.test.ts` 为空）。
- 它自己的前提写在注释里：`Making a task that runs at the highest level takes an elevated administrator and a signed-in desktop`，skip 条件只有 `!windows || !!process.env.CI`。
- 本机失败原因：`Register-ScheduledTask ... -RunLevel Highest` → `Access is denied.`（HRESULT 0x80070005，CimException）。
- 账户事实：chs **在** 本机 Administrators 组内，但当前会话是 UAC 过滤后的标准令牌（`IsInRole(Administrator)` = **False**）——即「管理员账户、非提权进程」。该用例在提权会话里才成立。
- 结论：这是**环境缺口**（需要提权 + 已登录桌面），不是我们重放引入的回归；但它确实让工单的「0 失败」门槛不成立，所以按工单「阻塞即停」不往下切基座（见 B6）。**没有把断言改绿，也没有设 CI=1 让它 skip。**

### 三条实战判据（对 release\b-3d0e835-20261108 跑，脚本 b4\battle-criteria.sh）

① **取消清树** —— b4\gate1-cancel.log：

```
cwd = C:\Users\19082\AppData\Local\Temp\b6-gate1-中文 验收-f9Xo8f\工作 目录 & 空格   argument_multiline = true
parent_before 25812 / child_before 16568 均 alive=true → cancel → outcome=cancelled
parent_alive_after=false   child_alive_after=false   pass=true
```

② **断线恢复** —— b4\gate2-resume.log：

```
cwd = …\b6-gate2-中文 恢复-0l1Ppj\工作 目录 & 空格
outcome=done  summary=survived  stdout=survived  spawns_total=1  workCalls=3  pass=true
logged: "first: run 4 (W) turn 1 started, pid 1800" / "second: run 4: done"
```

③ **严格判定** —— b4\strict-positive.log / b4\strict-negative-n1.log：

```
正例（我们的适配器）：tests 14 / pass 14 / fail 0 / skipped 0   duration 155.3 ms
负例 N1（临时副本里换回上游适配器 5911eca7…）：tests 14 / pass 1 / fail 13   EXIT=1
```

口径差异：工单写「28 条正例全绿」，实测该判据文件是 **14 个 test() / 22 条 assert**。按「不许改断言凑绿」，**没有为了凑 28 而加用例**，照实报 14/14。release 树在负例实验后未被改动（适配器 sha 仍 71ba0989…）。

## B5 出包

- 包目录：evidence\20261108-3d0e835\
- release 树：release\b-3d0e835-20261108\（`git archive f28c7fa | tar -x`，253 文件，无 node_modules）
- 全树清单：b5\manifest-full.sha256 —— **253 行**，格式 `<64hex><两空格><仓库根相对路径>`，`find -type f` + `LC_ALL=C sort -z` + `sha256sum`，**不排除任何目录**；格式不合规 0 行，重复路径 0 条。
- **全树指纹**：`a66886dc449ad31ad486fb5806062b83e5726262210e093a58b08b6109e3a82a`
- 9 路径表：b5\nine-paths-table.txt（含上游 sha256 / 本次 sha256 / 是否我们改过）。
- 封条：b5\SEAL.txt（manifest 指纹、行数、INDEX 行数、生成时间、自校说明）。
- INDEX：b5\INDEX.sha256 —— **269 条**（格式 `<hex> *20261108-3d0e835/<相对路径>`，覆盖包内除自身外的全部文件），格式不合规 0 条。
- 分支：私库 Jakiewbe/autolAgentloop，新分支 **b-3d0e835-20261108**（不覆盖 b-final-20261108，不改 origin，不重写历史）。
- 推送：私库分支 **b-3d0e835-20261108**（首个 tip 4abcb89，其后因重算 INDEX 追加一次提交；**最终 tip 以包外 clone 日志里的 HEAD 为准**，避免报告自指）。未改写历史、未推上游、未改 origin。
- 网络：直连 push 连续 3 次失败（`Failed to connect to github.com:443 after 21096/21102/21114 ms`，DNS 给 20.205.243.166 的 443 被掐）；逐 IP 探测 140.82.112.3 与 140.82.121.4 可用（https 200 / ~2 s），改走本机 CONNECT 隧道（b5\push-and-clone-verify.sh，钉 IP，只对本次命令生效）→ **push 5 s 成功**。
- 复验：`--depth 1 --branch b-3d0e835-20261108` 新 clone（4 s）→ `sha256sum -c manifest-full.sha256` **253/253 OK**、`sha256sum -c INDEX.sha256` **269/269 OK**；clone 内 INDEX 自身 sha256 = `e13ae489fe9d3d5105387f22d43dc70f0845b789d836bc190a2556ad10056b9b`。日志：`D:\AutoAgentloop\evidence\20261108-3d0e835-clone-verify.txt`（包外）。
- 包内文件数：**270**（含 INDEX 自身）；INDEX 覆盖 269 条 = 270 − 1（INDEX 自身不在自己里，防自指）。

## B6 B 机切换 —— 未做（阻塞）

工单要求「包核验通过后」再切。当前 **B4 门槛未过**（test:windows 1 红，管理员专属用例），按工单「阻塞即停」与「不许改断言凑绿」，**没有切换**：

- 生产仍是 release\b-c067fdb-20261107；任务 agent-autoloop-09bbb91a；up.pid 未变。
- 因此 B6 的四条判据（任务 Running / up.pid 一致 / /v1/state 200 / 心跳 200 job:null / 无控制台窗口）**本轮不适用**，不冒充已验。
- 注销重登：本轮不做（未做）。

### 回滚（随时可用）

```bash
# 源码树回到旧分支 + F1 修复
cd /d/AutoAgentloop/work/agent-autoloop && git checkout base-main && git stash pop

# 若将来切到新基座后要退回旧基座
AGENT_AUTOLOOP_HOME=D:/AutoAgentloop/home node /d/AutoAgentloop/release/b-3d0e835-20261108/bin/agent-autoloop.ts service remove
AGENT_AUTOLOOP_HOME=D:/AutoAgentloop/home node /d/AutoAgentloop/release/b-c067fdb-20261107/bin/agent-autoloop.ts service install
```

## 未验（照抄，不美化）

1. **B4 门槛未过**：test:windows 501/500/1（tests/windows-admin.test.ts 需提权管理员 + 已登录桌面），未达「0 失败」。
2. ~~npm test 未在 pristine 3d0e835 上做对照~~ → **已补**：pristine 513 ✔ / 71 ✖ / EXIT=124，与我们这棵同样不收敛；`npm test` 在 Windows 不是可用门槛，工单要求的「npm test 通过」在本机不可达（环境性质，非本次改动）。
3. **与 A 侧 plugins/claude-go/agent.ts 字节未对齐**：B 侧 235e804e…，A 侧报 8dd8c405…，缺 A 侧原件。
4. **B6 切换未做**：被 B4 红门槛挡住，生产基座未换。
5. **真实模型调用未验**：本轮未做真实 Go/Claude 调用（上一轮已定性为环境缺口：本机无 claude CLI，不得用 .cmd 替身冒充）。
6. **注销重登未做**（工单允许本轮不做，此处明示）。
7. **%TEMP% 残留与任务/端口自查**：本轮未重跑快照（test:windows 跑动会自己清任务；如需 A 侧口径的快照，需要单独一轮）。
8. 工单「28 条正例」与实测「14 例 / 22 断言」口径不一致，未凑数。

## 证据清单

```
evidence/20261108-3d0e835/
  B-report.md                 本文件
  b3/00-before-reinstall.txt  收回前 home SDDL / icacls / 根 SDDL
  b3/01-ab-old-vs-new.txt     旧基座 THROW vs 新基座 OK（原始 JSON）
  b3/02-after-rework.txt      收回后 home icacls / SDDL / 受托人 SID / 根 SDDL
  b3/acl-ab.ts                A/B 对照脚本
  b4/battle-criteria.sh       三条实战判据脚本
  b4/gate1-cancel.log        ① 取消清树
  b4/gate2-resume.log        ② 断线恢复
  b4/strict-positive.log     ③ 正例 14/14
  b4/strict-negative-n1.log  ③ 负例（上游适配器）1 过 13 红
  b4/test-windows.log        门槛：501/500/1
  b4/npm-test.log            npm test（Windows 不收敛，非门槛）
  b4/npm-test-pristine.log   npm test on pristine 3d0e835
  b5/manifest-full.sha256    253 行全树清单
  b5/nine-paths-table.txt    9 路径对照
  b5/SEAL.txt                封条 + 自校
  b5/INDEX.sha256            包内文件清单
  backup/home/config.json    HOME 配置备份（sha256 68085fbe…）
  backup/old-base/           旧基座 244 文件全量备份
  backup/SHA256SUMS.txt      旧基座清单
```
