# B4 · D:\AutoAgentloop ACL 处置方案（只交方案，未动 DACL）

> **2026-11-07 13:22 更正**：本文件第 1.2/1.3 节的"失败点=丢弃全部继承 ACE"与第 4 节的推荐路径 `D:\AutoAgentloop\work\agent-autoloop\.home` **均已被后续实测推翻**。真实根因是 chs 在 D 树子对象上缺 **WRITE_OWNER**（不是 WRITE_DAC），且 D 树内**任何**新目录都会失败。以 [B4-root-cause.md](B4-root-cause.md) 为准；本文件保留为时间线存档。

采集时间 2026-11-07 11:56 +08:00。原始 icacls 输出：`logs/b4-icacls-before.txt`。
本轮**没有修改** D:\AutoAgentloop 的 DACL；下面所有写操作都是方案，等明确指令。

## 1 事实底座

### 1.1 现状 ACL（icacls 原文，SID 未解析处按原样保留）
```
D:\AutoAgentloop Everyone:(CI)(DENY)(DC)
                 S-1-5-21-2996253060-2469643146-3984577970-3727747411:(OI)(CI)(M)
                 S-1-5-21-803409395-3282669851-3203730243-4031528268:(OI)(CI)(M)
                 S-1-5-21-2917529869-3470359602-3510455969-2451035572:(OI)(CI)(RX,W)
                 S-1-5-21-3060152114-79461432-2005981026-4082952930:(OI)(CI)(RX,W)
                 S-1-4-468065576-1037340474:(OI)(CI)(W,D,DC)
                 MAGICBOOK14-ZZ\chs:(WO,S)
                 BUILTIN\Administrators:(I)(F)
                 BUILTIN\Administrators:(I)(OI)(CI)(IO)(F)
                 NT AUTHORITY\SYSTEM:(I)(F)
                 NT AUTHORITY\SYSTEM:(I)(OI)(CI)(IO)(F)
                 NT AUTHORITY\Authenticated Users:(I)(M)
                 NT AUTHORITY\Authenticated Users:(I)(OI)(CI)(IO)(M)
                 BUILTIN\Users:(I)(RX)
                 BUILTIN\Users:(I)(OI)(CI)(IO)(GR,GE)
                 Mandatory Label\Low Mandatory Level:(OI)(CI)(NW)
```
- Owner = MAGICBOOK14-ZZ\chs。
- chs 的显式 ACE 只有 `(WO,S)`（TakeOwnership + Synchronize），**没有显式 WriteDAC**。

### 1.2 本轮实测：chs 到底能不能写 DACL（在 D 树内的子目录上做，可回收）
脚本：`scripts/b4-acl-dac-probe.ps1`（每个用例新建目录、执行、记录、删除；跑完 `ls -d /d/AutoAgentloop/_priv_probe*` = 0 个残留）

| 用例 | 操作 | 结果 |
|---|---|---|
| A | 与 host/files.ts:8-17 **完全相同**的写法（`SetAccessRuleProtection(true,false)` + 设 owner + 加 chs/SYSTEM FullControl） | **FAIL** `UnauthorizedAccessException`「尝试执行未经授权的操作」，DACL 未变（protected=False，14 条 ACE） |
| B | 只 `SetAccessRuleProtection(true,true)`（保留继承项、只断开继承） | OK（protected=True） |
| C | 保留继承，只 AddAccessRule 一条 chs FullControl | OK（15 条 ACE） |
| D | 同 A，但目录在 %TEMP% 下 | OK（protected=True，2 条 ACE） |

**结论（关键）**：chs 其实是**能写 DACL 的**（B、C 成功 = WRITE_DAC 有效，owner 隐含 WRITE_DAC 即可）。真正被打回的是 privateDirectory 的**"丢弃全部继承 ACE"这一写法**在 D:\AutoAgentloop 子树内失败，同一写法在 %TEMP% 成功。
本轮的定位边界：根因未能收敛到某一条继承 ACE（Everyone DENY (DC) / Mandatory Label NW / 其余 SID ACE 均未逐条剥离验证），只确认了"保留继承=成功、丢弃继承=失败、目录位置有关"。

### 1.3 由此推翻的既有前提
"给 chs 补 WriteDAC 就能让 privateDirectory 通过" —— **不成立**。chs 并不缺 WriteDAC（1.2 B/C 实证），方案甲解决的是一个不存在的缺口；执行甲之后，A 用例仍会以同一个异常失败。

## 2 方案甲：给 chs 补 WriteDAC（**不推荐**）

### 2.1 命令（未执行）
```powershell
# 备份（icacls /save 必须在 PowerShell 里调，git-bash 会把 /save 当路径改写掉）
icacls 'D:\AutoAgentloop' /save 'D:\AutoAgentloop\evidence\20261107-final\logs\b4-acl-backup.txt'
# 授予（只作用于本目录，不带 OI/CI，不动继承）
icacls 'D:\AutoAgentloop' /grant 'MAGICBOOK14-ZZ\chs:(WD)'
# 立刻回读
icacls 'D:\AutoAgentloop'
```

### 2.2 回滚（未执行）
```powershell
icacls 'D:\' /restore 'D:\AutoAgentloop\evidence\20261107-final\logs\b4-acl-backup.txt'
```

### 2.3 影响面与风险
- 影响命令：**没有一条**——因为缺口不在权限位（见 1.2）。等于白改一次生产目录 DACL，把"是否被改过"这条可审计线索引入污染。
- 真实风险：一旦 privateDirectory 在 D 树内跑通（例如同时清掉 Everyone DENY (DC) 之类的继承 ACE），它会把该目录 DACL 重写成「owner + SYSTEM(F)」，并**向下传播**：Authenticated Users:(I)(M)、Administrators:(I)(F) 等继承项消失，work/、release/、evidence/ 全部子树的实际访问随之变化，工作副本的 git 操作、A 侧核对都会受影响。回滚只能靠事前 `/save` 快照，粒度粗。
- 附带风险：改 DACL 属"会写权限"的动作，需走批准；本机 `Everyone:(CI)(DENY)(DC)` 还会让清理动作（删子树）随时被拒。

## 3 方案乙：维持现状，登记为已知限制（**推荐**）

### 3.1 若把 HOME（或备份目录）指向 D:\AutoAgentloop，逐条命令的实测/静态判定
`HOME` 取自 host/home.ts；下面按 cli/main.ts:100-155 的 TAKES 表逐条过。

| 命令 | 触发点 | 在 D 树内作为 HOME 时 |
|---|---|---|
| `init` | cli/main.ts:274 `privateDirectory(HOME)` | **失败**（A 用例同源） |
| `join` | cli/main.ts:325 `writeConfig` → host/config.ts:37 | **失败** |
| `key new/list/remove` | cli/main.ts:293/605 动态 import → host/runtime.ts:18 | **失败** |
| `up`（中台模式） | host/http.ts:4 → host/server.ts:7 → host/runtime.ts:18 | **失败**（worker 模式不导入，不失败） |
| `backup <目录>` | cli/backup.ts:32 `privateDirectory(target)` | 目标在 D 树内则**失败**；目标在别处则正常 |
| `restore <目录>` | cli/backup.ts:84 `privateDirectory(home)` | HOME 在 D 树内则**失败** |
| `add/ask/answer/tell/resolve/emit/pause/resume/run/stop/rules/status/why/check/doctor/try/mcp/conformance/update/uninstall/service` | 不调用 privateDirectory | 不因该异常失败（前提是 HOME 下 db/config 可读） |

说明：除 A 用例是实测外，其余行是**调用图判定**，没有为了验证去改生产目录（会写/会失败并留状态）。

### 3.2 代价
- 生产家目录继续留在 C:\Users\19082\.agent-autoloop（现状，工作正常，ACL 由本机用户自有）。
- 代价是"家目录必须在 D:\AutoAgentloop 内"这类需求无法满足；需要时用第 4 节的办法。

## 4 推荐做法（替代甲/乙的二选一）

~~需要"隔离运行/家目录在 D 盘"时，不要把 HOME 指到 D:\AutoAgentloop 本身，指到 chs 自己新建的子目录，例如 `D:\AutoAgentloop\work\agent-autoloop\.home`~~ **（本节结论作废，见 B4-root-cause.md 4.1）**：实测该路径下 `files.ts` 的写法同样抛 UnauthorizedAccessException，隔离目录必须落在 D:\AutoAgentloop **之外**，如 `%LOCALAPPDATA%\agent-autoloop-home`（实测 OK）。原文保留：
- 该目录由 chs 创建，owner=chs，测得的 A 用例失败条件是"丢继承 + 该位置"，而 %TEMP% 下同脚本成功（1.2 D），说明 chs 自有新目录是可用路径；本轮 `test:windows` 里 "Windows init keeps its keys private even inside a shared directory" 用例通过（7.3 s）即为同机制在共享父目录下的实测旁证。
- 不改任何既有 ACL，零回滚成本，出问题只需删该子目录。

## 5 未验
- privateDirectory 在 D:\AutoAgentloop **根目录**上的行为：未执行（等于改根 DACL，未获批准）。1.2 A 用的是子目录。
- 1.2 A 失败的确切 ACE 根因：未收敛（只知"丢弃继承"触雷、与位置相关）。
- 方案甲的净效果：未执行，故未测；按 1.2 推断仍失败。
