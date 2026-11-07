# B4 追加诊断 · privateDirectory 在 D:\AutoAgentloop 子树内失败的根因

采集时间 2026-11-07 13:06–13:22 +08:00。本轮**没有修改** D:\AutoAgentloop 的 DACL，所有写操作都在自建临时子目录里做，用完即删（残留检查 0）。

## 1 结论（一句话）

失败与「能力」无关，与「**对象**」有关，具体是**对象上的哪一段安全信息**被写：

> `privateDirectory()` 写出的安全描述符同时含 **owner 段 + DACL 段**。在 D:\AutoAgentloop 子树内的对象上，chs 缺 **WRITE_OWNER**（缺的不是 WRITE_DAC），owner 段被拒 → 整次 `SetSecurityInfo` 失败 → `UnauthorizedAccessException`。同一段代码在 %TEMP%、%LOCALAPPDATA% 下成功，因为那里的子对象继承了 `chs:(I)(OI)(CI)(F)`，含 WRITE_OWNER。

## 2 取证链（全部可复跑）

| # | 探针 | 位置 | 结果 | 日志 |
|---|---|---|---|---|
| 0 | 根 ACL 原文 | D:\AutoAgentloop | chs = `Allow TakeOwnership, Synchronize`，**inh=None（显式、不继承）**；无针对 chs 的显式 DENY；另有 `Everyone:(CI)(DENY)(DC)`、`Mandatory Label\Low Mandatory Level:(OI)(CI)(NW)`；RulesProtected=False、14 条 ACE | logs/b4-root-diagnosis.txt |
| 0b | TEMP ACL 原文 | %TEMP% | `MAGICBOOK14-ZZ\chs:(I)(OI)(CI)(F)`，无完整性标签 | 同上 |
| A | `host/files.ts:8-17` 原样复刻（新 DirectorySecurity + Protection + SetOwner + 2×FullControl + `[IO.Directory]::SetAccessControl`） | D 树内新子目录（work 副本下） | **FAIL** MethodInvocationException「尝试执行未经授权的操作」；DACL 未变（protected=False、14 ACE） | logs/b4-exact-probe.txt |
| A2 | 同上 | D:\AutoAgentloop 根下新子目录 | **FAIL**（同上） | 同上 |
| A3 | 同上 | A 建议的 `D:\AutoAgentloop\work\agent-autoloop\.home` 下新子目录 | **FAIL**（同上） | 同上 |
| A4 | 同上 | %TEMP% 新子目录 | **OK**（protected=True、2 ACE） | 同上 |
| A5 | 同上 | %LOCALAPPDATA% 新子目录 | **OK**（protected=True、2 ACE） | 同上 |
| B | 先把 D 树子目录的完整性标签改 Medium，再跑 A | D 树内 | **FAIL** → 完整性标签不是变量 | logs/b4-label-probe.txt |
| B2 | 先把 %TEMP% 子目录标成 Low，再跑 A | %TEMP% 内 | **OK** → 再次排除标签 | 同上 |
| C | 只写 DACL 段（不含 owner） | D 树内 | **OK** → chs 的 WRITE_DAC 不缺 | logs/b4-label-probe.txt、logs/b4-owner-clause-probe.txt（T2） |
| D | 只写 owner 段（DACL 不动） | D 树内 | **FAIL** → 失败段就是 owner | logs/b4-owner-clause-probe.txt（T1） |
| E | 先给它一条 `chs:FullControl` 的 DACL（含 WRITE_OWNER），再只写 owner | 同一个 D 树子目录 | **OK** → 因果关系闭合 | 同上（T3） |
| F | 权限到位后再跑 A 原样代码 | 同上 | **OK** | 同上（T4） |
| G | 在 F 之后新建的下级子目录跑 A | 同上子树 | **OK**（该目录继承了 chs F） | 同上（T5） |

关键对照：**D 失败 / C 成功 / E 成功**。如果缺口是 WRITE_DAC，C 不可能成功；如果缺口是完整性标签或"丢弃继承"这个写法本身，B/B2 不可能呈现"位置决定结果"。

## 3 与 A 侧判断的对齐与纠正

- 对齐：**补 WRITE_DAC（方案甲）解决不了**，B 的判断成立，且现在有了机制级证据（C 成功）。
- 纠偏 1（A 的表述）：A 说「同一段 PS 在 chs 新建子目录里成功，在 D:\AutoAgentloop 根上失败」。实测**在 D:\AutoAgentloop 根下新建的子目录同样失败**（探针 A2），失败边界是**整棵 D:\AutoAgentloop 子树**，不是根目录本身。
- 纠偏 2（B 上一轮的表述）：B 上一轮说「chs 本来就能写 DACL」，冷读会被理解成"根上也能写"。准确说法：chs 通过对**自有对象**的 owner 身份隐含拿到 WRITE_DAC（探针 C 实证），但**没有** WRITE_OWNER 继承，所以 `files.ts` 里同时写 owner 段的调用在 D 树内必然被拒。

## 4 处置选项（都不含"给 chs 补 WriteDAC"）

### 4.1 丙·隔离（推荐，零改动、零回滚成本）
把 HOME 指到 **D:\AutoAgentloop 之外**的 chs 自有目录，实测两个位置 A 用例均 OK：
- `%LOCALAPPDATA%\agent-autoloop-home`（探针 A5 OK）
- `%TEMP%\...`（探针 A4 OK；test:windows 走的就是这里，484/484 因此通过）

**不能**用 `D:\AutoAgentloop\work\agent-autoloop\.home`（探针 A3 FAIL）——这条是 B 上一轮的错误建议，本轮实测推翻，A 侧若照此设置会立刻踩同一个异常。

设置方式（不写注册表、不改生产家目录）：
```powershell
$env:AGENT_AUTOLOOP_HOME = Join-Path $env:LOCALAPPDATA 'agent-autoloop-home'
```

### 4.2 丁·改代码（需 A 侧/上游决定，最小改动）
`host/files.ts` 的 owner 段只在"当前不是 owner"时才写：
```ts
// 只写 DACL 段即可满足"新文件仅 owner 与 SYSTEM 可访问"
$acl.SetAccessRuleProtection($true, $false)
if ($acl.GetOwner(typeof(Security.Principal.SecurityIdentifier)) -ne $owner) { $acl.SetOwner($owner) }
```
依据：探针 C（D 树内只写 DACL）成功；探针 T4（权限到位后含 owner 段）成功，说明 DACL-only 语义不损失私有性——protected DACL 里仍只有 owner + S-1-5-18 两条。
风险点：如果目标目录 owner 不是自己，跳过 owner 段后仍会失败（此时本该失败）。

### 4.3 戊·放权（不推荐）
把根上 `chs:(WO,S)` 改成 `chs:(OI)(CI)(WO,S)`，让整树继承 WRITE_OWNER。
代价：该树内任何以 chs 身份运行的进程都能改任意子对象的 owner（含把 owner 让给他人），等于放宽了一条可用于劫持 ACL 的权限；收益只是让一段上游代码不必改。

### 4.4 方案甲（WriteDAC）· 作废
探针 C 已证明 WRITE_DAC 不缺；执行甲后 A 用例仍会以同一异常失败。

## 5 未验
- 未在 D:\AutoAgentloop **根目录本身**执行过 `files.ts` 的写法（等于改根 ACL，未获批准）；按探针 A2/A3 推断同样失败。
- 4.2 的代码补丁未实现、未跑门槛（属上游改动，等 A 侧决定）。
- 4.3 的放权未执行，代价为静态评估。
