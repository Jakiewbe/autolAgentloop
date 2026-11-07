# B 通宵任务单 B-OVERNIGHT-20261108

你是 B。机器 MAGICBOOK14-ZZ（用户 chs），仓库 D:\AutoAgentloop，worker-only，无远程入口。
独占：app/** 与本机；不得碰 A 机、不得推 KKKKhazix 上游。

## 基线（你 02:30 回执，A 未复核，标为自报）
- 工作副本 HEAD c067fdbce6e75dead344a5f386bfd3e3164bd7f9；运行底座 release\b-c067fdb-20261107。
- 进程：wscript 8220 → background.ts 24908 → up 16424（01:56:40 起），up.pid=16424。
- 计划任务 \agent-autoloop Running，LastRun 01:56:37，LastTaskResult 267009（运行中）；Startup 仅 desktop.ini。
- 心跳：A 中心记录 b-magicbook14 在 17:56:48Z 之后恢复并持续；A 侧见过的唯一异常是 17:52:57Z→17:56:48Z 的 231 s。
- 推送：b-final-20261107 = b12ec1c，INDEX 57 行，clone 复验未完成。

## B1 溯源对账（先做，A 在等这份）
1. 对 release\b-c067fdb-20261107 出全树 sha256 清单，规则与 A 侧一致：仓库根相对路径、不排除任何目录、`sort -z`、`LC_ALL=C`、`<hex><两空格><路径>`、对整段清单再取 sha256。报全树指纹与文件数。
2. 单列 9 路径各自 sha256：plugins/claude-go/agent.ts、plugins/command/agent.ts、worker/agents.ts、worker/worker.ts、tests/command-adapter.test.ts、tests/claude-go.test.ts、tests/acp.test.ts、tests/windows.test.ts、tests/delivery-scope.test.ts。
3. 明确回答：plugins/claude-go/agent.ts 里有没有 `delete result.sessionUsage;`。A 侧是修好的（sha256 8dd8c405…），你这边如果没有，B2 必须先修。

## B2 应用 F1 修复
1. 改前备份原件到 evidence\20261108-final\before\ 并存 sha256。
2. 把 `delete result.sessionUsage;` 落到你实际运行的那份代码，重跑 b8-cost-criterion 测试（已修 pass、还原 fail 两个方向都要有）。
3. 重启 worker，确认 A 中心心跳恢复、done 计数继续增长。
4. 回滚：一条命令恢复原件并重启，写进报告。

## B3 ACL 方案乙落地
把 AGENT_AUTOLOOP_HOME 迁到 D:\AutoAgentloop\home（你自己可写、不需要改 DACL 的目录），然后：
- 证明 host/files.ts 不再抛 UnauthorizedAccessException；
- 迁移前后心跳都在 A 中心可见（附 seenAt）；
- 旧目录 D:\AutoAgentloop 只读保留，不删；
- 给回滚步骤（改回旧 HOME + 重启）。
不许用「给自己加 WriteDAC 权限」这条（会在根目录自我剥夺并向下传播，你上一轮已实测）。

## B4 推送闭环
新 clone b-final-20261107（b12ec1c）→ `sha256sum -c` 57/57 → 记录网络重试次数与耗时。只推你自己的私库分支，不推上游、不改 origin、不重写历史。

## B5 真实 Go 调用
只出「需要什么前置才能验」清单：claude CLI 的安装与版本要求、需要的凭据类型、网络白名单、A 侧真实返回体字段（total_cost_usd 在顶层、usage 无 cost）。**不许用 .cmd 替身冒充真实调用**，这条写成环境缺口。

## B6 test:windows 复跑 + 残留自查
跑前后各存任务表、监听端口（3350–3400、4347）、%TEMP% 下 agent-autoloop-* 目录数。跑完必须无残留任务、无残留监听、无新增临时家目录。

## B7 交付
evidence\20261108-final\：报告 + 各任务证据 + 包（INDEX 重算、sha256sum -c 全过）。未验项照抄，不许美化。推送 b-final-20261108。

## 禁止
- 不碰 A 机与 A 的看板，不改 dashboard/**，不改 kernel 语义，不加运行时依赖。
- 不改测试断言去凑绿；门槛只认 npm run test:windows。
- 阻塞即停：保留现场、给回滚命令、说清卡在哪一条。
