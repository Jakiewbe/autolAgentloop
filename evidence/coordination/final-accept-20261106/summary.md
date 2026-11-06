# FINAL-ACCEPT-20261106 阶段总结（A 侧）

阶段：FINAL-ACCEPT-20261106-A｜唯一构建：final-20261106-baseline-0.166-strict-v2
A 侧真实模型执行 5 次（run 31/32/33/34/35），重试 0，内部修复 0；A 中心新增 run 5（上限 12）；B 维护重启 1/2；第 5 项恢复启动 2 次；注销 1/1。A 不宣布六项总验收，交统筹明早审核。

## 1 六项结果

| 项 | 判分 | 一手依据 |
|---|---|---|
| 1 通信闭环 | 沿用（前一阶段实测） | run 29 done；B 侧 29 行、turn.completed 第 29 行、0 非 JSON、native exit 0 |
| 2 临时目录 | PASS | run 31 done attempts 0；B 侧 7 条命令 exit 0、marker 逐字回读、独立 ls 无残留、37 行 0 非 JSON、exit-1 内容 0 |
| 3 同会话续接 | 沿用（前一阶段实测） | run 30 同 session；B 侧 14 行、0 非 JSON、native exit 0 |
| 4 运行中取消 | PASS | run 32 cancelled（取消后 4 秒，运行 385s/预定 480s，usage null、无 exit 文件）；B 侧 66 次采样：runner/cli/等待子/3 个 MCP helper 全灭、无终态事件 |
| 5 断线恢复 | PASS（附缺陷） | run 34 离线排队恰执行一次（attempts 1、exit 0、once=yes）；worker 33640 停于 13:33:41.924；缺陷：taskkill 不级联 |
| 6 真实登录触发 | PASS（自动启动），登录方式未证 | run 35 done，首行逐字 FA-6 登录后执行完成：ITEM6-20261106-1320、第二行 login=ok；B 侧 worker 28452 由 Startup cmd 31892（父 explorer 22368）在新登录会话创建，up.log 同秒 |

## 2 唯一构建与完整哈希

| 文件 | 字节 | sha256 |
|---|---|---|
| app/plugins/command/agent.ts | 6141 | c077041d0f2ac21b774ba546d203c16a81e2954b44770b27dedc7d5b831c4f74 |
| app/worker/worker.ts | 17436 | 8416191f470f6320c7ad058af61ea13232b1662b2768a234d4fc9a295baeef82 |
| app/worker/agents.ts | 2328 | 6c150fc07d6ec255df6aadc6cc73192d829333dda7b18d276ce8574d0e23b471 |
| app/host/server.ts | 4816 | 7ef50b1eae27c8a293b0fac95ad36429471fde909485b1fe09d82d8562b6ae5d |
| app/host/runtime.ts | 13440 | c15d0bd3c5d90251c640f282e3b66321779b26fcee20ed40c068e9d929286798 |
| night-parse-strict-fulljson-v2.zip | 14201 | 5ff21499d4e0d98dddb2a9679e72fc8d907907454e139940d957101ee3bc4e23 |
| night-center-rules-reload-v2.zip | 12928 | 1106c14ddf523457fa9711cd38b1b21459d48a0782356727433cdb7536631e5c |

入口（B 机）：C:\Users\19082\AppData\Local\agent-autoloop\tools\codex\0.166.0-alpha.5.1\package\vendor\x86_64-pc-windows-msvc\bin\codex.exe 368970544 字节 6ca87057d80648f18f8cba0db224ae3e885b25326c07dcc798d38caef22c302c（B seq6 复核，本轮未变）。模型 deepseek-v4.1-flash-1017、cwd D:\AutoAgentloop、worker b-magicbook14、access edit、timeout 30。

## 3 数字

- 真实验证通过 4 项（2、4、5、6，其中 6 附登录方式未证），失败 0 项，未测 0 项。
- 沿用前阶段实测 2 项（1、3），本轮未重测，不重复计入通过数。
- B 自报 5/6 有 A 派发 test_id 实测，不自报 6/6；A 定性与之一致。

## 4 如实保留的缺陷与偏差

1. 注销后 14.3 秒出现 7001 登录事件，早于用户回话 48 分钟；AutoAdminLogon 为空、DefaultUserName 未设置，4624 因无权限读不到。自动启动链条成立，但「用户亲手输入凭据」不成立为已证事实，靠提权补证被排除。
2. taskkill /F 只结束 worker，不级联结束 runner/codex/子进程；恢复后依磁盘回执收尾。
3. run 33 终态是 done 不是 cancelled（孤儿回合自然完成），一次回合一次收尾，无重复执行。
4. B 的观察脚本首次过滤串写错（worker_count=0，3 个样本），后用 14:38:41-14:43:30 的多次采样补正。
5. run 35 stdout 首事件提示 Model metadata for deepseek-v4.1-flash-1017 not found, defaulting to fallback metadata，非致命、未改判分。
6. stderr 两条 rmcp 致命行只指向不可达的远程 ps/mcp，stdio 的 cua_repl/node_repl 不受影响。
7. worker.test.ts 写死 /bin/sh，在 Windows 必失败；本轮未改该文件，不计入。

## 5 收尾状态

- 5 条 FA-* 阶段规则已移除，保留 7 条（试一下、演练断电、A-Claude只读验收、B-接线验证、B-临时目录、B-接续验证、B-断线恢复）；rules.json 10460B 75f3d622… -> 6650B 639bf9b3…，备份 rules.json.bak-final-cleanup；hub facts seq 8675 已加载 7 条，command[0] 仍是 0.166 标准名。
- 中心无 queued/claimed/running，无开放测试卡片；B 单实例 worker 28452 健康、队列空闲。
- 未改身份、权限、标签、ACL、MCP、路由；未重装；未重启 A 中心或系统。

## 6 剩余最小人工动作

1. 请确认一次：13:48:44 那次登录（注销后 14.3 秒）是否为你本人用 PIN/人脸/密码完成。若是，第 6 项完整；若不是，按「系统层面重新登录事件」记录，判分表不改。
2. 其余无。正式切换与总体验收留统筹决策，A 未自宣。
