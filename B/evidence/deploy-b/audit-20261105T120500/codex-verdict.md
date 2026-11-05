## 总判定

- **V1 FAIL**
- **V2 PASS**
- **V3 证据不足**
- **V4 FAIL**
- **V5 PASS**
- **V6 PASS**
- **V7 PASS**
- **V8 PASS**

本轮只读审核，未修改仓库文件。当前工作区已有 `M AGENTS.md`，未纳入本次 B 分支判断。

---

## V1 复核是否真正重克隆：**FAIL**

实际命令与关键输出：

```text
git log -4 --format='%H %an <%ae> %ci %s' --
8e17be8ab163965ba7eae95b465e9deb3599e63e B Magicbook14-zz ... B: 第四轮审核 prompt（V1-V8）
a9c98a4ce94a07c4da97fdfda4d68007a7efc659 B Magicbook14-zz ... B: 第四轮 — 重新克隆独立复核（117/117）...
d536485cabd1945485409bc6cb549139e3488ec1 B Magicbook14-zz ... B: 材料清单同步 outbox...
```

```text
Get-Content B/evidence/deploy-b/recheck-20261105T102109.log
CLONE_HEAD=d536485cabd1945485409bc6cb549139e3488ec1
MAIN_HEAD=d07b41267632e446d2f082f08ddc79b89b363e2a
REPO_MANIFEST_OK=117 / 117
```

```text
git diff --name-status origin/main origin/b | Measure-Object -Line
Lines : 130

Get-ChildItem B -Recurse -File | Measure-Object
Count : 130

Get-Content B/MATERIALS.repo.sha256 | Measure-Object -Line
Lines : 129
```

```text
Test-Path _probe/recheck-b.sh
False
```

问题：

1. 复核日志针对的是 `d536485`，即证据提交 `a9c98a4` 的父提交，不是证据提交，也不是当前 HEAD `8e17be8`。复核发生在证据文件提交之前，不能证明最终入库的 117/117、模型日志、状态机等没有在复核后被改写。
2. 当前分支差异文件为 130 个，清单 129 行；复核日志仍是旧的 `117 / 117`，没有对当前 HEAD 重跑。
3. `B/evidence/deployment/B.md:275` 写 `B.md` 哈希为 `be59d...`，但当前 `B/MATERIALS.repo.sha256:83` 记录的是 `af2b6d...`。状态机第 594 行也写 `af2b6d...`，报告 §18.1 与当前清单不一致。
4. `_probe/recheck-b.sh` 未入库符合预期，但日志只有摘要，没有可复核的完整命令、逐项校验输出或当前 HEAD 证据。

最小修复：

- 对当前 `origin/b` HEAD 或至少证据提交 `a9c98a4` 重新克隆并重跑。
- 日志必须记录实际 `CLONE_HEAD`、当前证据 HEAD、完整 `sha256sum -c` 结果、文件数/清单行数和失败命令退出码。
- 更新 `B.md §18.1` 与状态机为同一当前哈希、同一 HEAD、同一文件数。

---

## V2 分支形态与作者：**PASS**

实际命令与关键输出：

```text
git diff --name-status --diff-filter=MDRCUTX origin/main origin/b
[无输出]
```

```text
git diff --name-only origin/main origin/b -- ':!B'
[无输出]
```

```text
git log origin/main --author='B Magicbook14-zz' --format='%H %an <%ae>'
[无输出]
```

```text
git diff --name-status origin/main origin/b | Measure-Object -Line
Lines : 130
```

验证结果：`origin/main → origin/b` 的 130 个差异项均为新增，非 A 类型为 0；`B/` 之外差异为 0；`origin/main` 中没有 B 作者提交。

---

## V3 清单自指与可复算：**证据不足**

实际命令与关键输出：

```text
Get-ChildItem B -Recurse -File | Measure-Object
Count : 130

Get-Content B/MATERIALS.repo.sha256 | Measure-Object -Line
Lines : 129
```

```text
Select-String -Path B/MATERIALS.repo.sha256 -Pattern 'MATERIALS.repo.sha256' -SimpleMatch | Measure-Object
Count : 0
```

```text
Select-String -Path B/evidence/deploy-b/B-install-state.json -Pattern 'self_sha256' -SimpleMatch
[无输出]
```

结构核对通过：当前 `B/` 有 130 个文件，清单 129 行，正好是“全部文件减清单自身”；清单不包含自身；状态机没有 `self_sha256`。

但本审计环境的只读命令策略拒绝了 `sha256sum`、`Get-FileHash`、`certutil` 等哈希命令，因此无法独立完成：

```text
sha256sum -c B/MATERIALS.repo.sha256
```

现有 `REPO_MANIFEST_OK=117 / 117` 是旧提交 `d536485` 的结果，不能替代当前 129 项的独立全量校验。因此不能给 PASS。

最小补充证据：当前 HEAD 的 `sha256sum -c B/MATERIALS.repo.sha256` 完整输出，且所有 129 行均 OK。

---

## V4 模型实测与失败留档：**FAIL**

Codex 成功日志成立：

```text
B/evidence/deploy-b/verify-b-pkg/recheck-codex-20261105T102219.log
{"agent":"codex","native_exit":0,...}
{"agent":"codex","dropped_lines":3,...}
{"agent":"codex","expected":"AGENT_VERIFY_...","passed":true,
 "session":"01a1a983-a9a1-7d63-9565-48202882db70"}
```

Claude 第二次成功日志成立：

```text
B/evidence/deploy-b/verify-b-pkg/recheck-claude-20261105T102444.log
{"agent":"claude","native_exit":0,...}
{"agent":"claude","dropped_lines":0,...}
{"agent":"claude","expected":"AGENT_VERIFY_...","passed":true,
 "session":"e1bd4c0c-d25b-4d0e-abeb-9e2f9dadb5eb"}
```

但失败日志不存在：

```text
Test-Path B/evidence/deploy-b/verify-b-pkg/recheck-claude-20261105T102219.log
False

Test-Path B/evidence/deploy-b/verify-b-pkg/recheck-claude-20261105T102219
False
```

状态机第 632 行却引用了该不存在文件：

```text
B/evidence/deploy-b/B-install-state.json:632
"log": "evidence/deploy-b/verify-b-pkg/recheck-claude-20261105T102219.log"
```

`B.md:289` 也写了第一次失败原因：

```text
claude 复测（第 1 次） | 原生退出码 1，原因是我方等价脚本没传 --settings，
stderr 原文 Settings file not found: …\undefined
```

但仓库中没有对应日志、目录和 `model.stderr.log`，因此无法核对“失败原因与 stderr 原文一致”，也无法证明失败确实发生且未被事后改写。

最小修复：

- 补入 `recheck-claude-20261105T102219.log`、对应输出目录和真实 `model.stderr.log`。
- 如果当时未保留，必须重跑一次缺失 `--settings` 的失败用例并原样留档。
- 更新 `MATERIALS.repo.sha256` 与行数，并把状态机引用指向实际存在的文件。

判分程序同源性部分：`agent_result.mjs` 为 2441 字节，清单记录哈希 `0bead26b...`，与 `B.md:47` 及状态机第 36 行一致；但本次 V4 仍因失败日志缺失整体 FAIL。

---

## V5 密钥只回传元数据：**PASS**

脚本实际检查结果：

```text
B/evidence/deploy-b/report-key-file.ps1:10
exit 2                     # 文件缺失

B/evidence/deploy-b/report-key-file.ps1:13
$bytes = [System.IO.File]::ReadAllBytes($full)

B/evidence/deploy-b/report-key-file.ps1:26
Write-Output "KEY_CONTENT_PRINTED=no"
```

```text
Select-String -Path report-key-file.ps1 -Pattern 'Get-Content' | Measure-Object
Count : 0
```

状态机自测字段：

```text
B-install-state.json:661  "dummy_bytes": 50
B-install-state.json:662  "dummy_sha256": "5278822221b1c706db7ce9f1699e030dad59694f15dcd3d86387352961fa5731"
B-install-state.json:664  "exit_missing": 2
```

验证部分：脚本没有发现 `Get-Content`、`cat` 或直接输出字节内容的路径；只输出路径、长度、SHA256、时间、ACL、JSON 形态和行数；缺失文件走 `exit 2`；自测数字与状态机一致。

---

## V6 门禁序列与取消/断线不并行：**PASS**

三处描述一致。

`B.md:304-309`：

```text
key 到位 → 独立复核 → 真实安装 + 合规回执 → A 联调许可 → 六项联调
...取消任务后进程退出 → 断线重连 + 执行端重启...
取消验证终止语义，断线重启验证状态恢复与幂等；
两项同时做就分不清原因是终止逻辑还是恢复逻辑。
```

`B-install-state.json`：

```text
:675 "5a cancel test and disconnect/restart test run sequentially, never in parallel"
:677 "cancel verifies termination semantics; disconnect/restart verifies recovery and idempotence;
      running both at once makes the failure cause indistinguishable"
```

`key-receipt-protocol.md:27`：

```text
取消测试与断线重启测试在同一执行端上依次进行，不并行，避免互相干扰。
```

验证部分：顺序、六项联调数量、同执行端、依次执行和理由均一致，理由不是空话。

---

## V7 没有把未验证写成通过：**PASS**

实际命令与关键输出：

```text
Select-String -Path B/evidence/deploy-b/B-install-state.json -Pattern '"verified": true' | Measure-Object
Count : 0

Select-String -Path B/evidence/deploy-b/B-install-state.json -Pattern '"verified": false' | Measure-Object
Count : 6
```

```text
Select-String -Path B/evidence/deployment/B.md -Pattern '联调通过'
[无输出]

Select-String -Path B/evidence/deployment/B.md -Pattern '安装成功'
[无输出]
```

```text
B-install-state.json:14  "phase": "blocked_before_install"
B-install-state.json:16  "installer_success_state": false
B-install-state.json:511 "unverified_inputs": 3
B-install-state.json:512 "unverified_cross_machine": 6
B-install-state.json:513 "unverified_total": 9
```

验证部分：六项联调全部 `verified=false`，报告没有“联调通过”或“安装成功”声明，状态机仍为阻断态。

---

## V8 Codex / 版本口径：**PASS**

状态机与报告一致：

```text
B-install-state.json:605  "version": "codex-cli 0.130.0-alpha.5"
B-install-state.json:609  "version": "codex-cli 0.164.0-alpha.11.1"
B-install-state.json:614  "version": "2.1.310 (Claude Code)"

B.md:285  Codex 主用 ... codex-cli 0.130.0-alpha.5
B.md:286  Codex 第二处 ... codex-cli 0.164.0-alpha.11.1
B.md:287  Claude Code ... 2.1.310
```

实测输出/二进制版本字符串：

```text
B/evidence/deploy-b/model-codex-20261104T232117.log:2
codex-cli 0.130.0-alpha.5

B/evidence/deploy-b/model-claude-20261104T232010.log:2
2.1.310 (Claude Code)
```

```text
Select-String C:\Users\19082\.codex\.sandbox-bin\codex.exe -Pattern '0.164.0-alpha.11.1'
命中：0.164.0-alpha.11.1codex [OPTIONS] [PROMPT]
```

三个可执行文件路径均存在，版本号与状态机、B.md 及历史实测输出一致。本次没有直接启动三个 CLI 执行 `--version`，因为只读命令环境拦截外部可执行程序；但已有原始版本输出和二进制内嵌版本字符串相互印证。

---

## 最后回答

### 1. 这份“重新克隆”自证是否足以替代 A 侧手动抽查？

**不足以替代。** 当前重克隆发生在证据提交之前：日志是 `CLONE_HEAD=d536485`，实际证据提交是 `a9c98a4`，当前 HEAD 是 `8e17be8`。当前文件数也已从 117 变为 130/129 口径。还缺少：

- 对当前 HEAD 或证据提交的重新克隆；
- 当前清单的完整 `sha256sum -c` 输出；
- 证据提交后不再改动的证明；
- 缺失的 Claude 失败日志；
- A 侧对关键文件、失败日志和 B 物理机实际命令执行的抽查。

因此，即使重新克隆成功，也只能证明仓库内容可复现；不能替代 A 对 B 物理机执行现场的抽查。

### 2. 门禁序列是否足以保证取消测试和断线重启测试互不干扰？

**设计上足够，执行上尚未验证。** 序列明确要求同一执行端、依次执行，且理由区分了“终止语义”和“恢复/幂等”。但还没有实际联调日志证明：

- 取消测试已经终止并清理；
- 断线重启测试确实在取消测试完全结束后才开始；
- 两次测试之间没有共享同一未结束任务或相同状态污染。

### 3. A 送 key 后 B 能否立刻进入真实安装？

**技术上安装输入只缺 key，但按当前证据不能直接放行真实安装。**

原因：

- key 确实是当前唯一缺失的安装凭据输入；
- 但 B 自己定义的门禁第 2 步是“独立复核通过”，本轮 V1/V4 未通过，门禁未闭合；
- 安装前还必须重新确认 ngrok 地址、`/healthz`、无键 `/v1/work` 401、包哈希和现场目录状态。

所以：**修复 V1/V4 并现场复验中心地址后，key 到达且 SHA256 等于 `a221bdfd…695f` 即可进入真实安装；当前状态不能自动视为“只差 key，立即安装”。**