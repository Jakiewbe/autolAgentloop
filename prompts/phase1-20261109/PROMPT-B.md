# PROMPT-B1 · 第 1 期 B 侧：DSH 直连冒烟 + 配合跨机冒烟

机器：B（MAGICBOOK14）。执行者：本机 DSH。
依据：《项目目标》v2、《拍板策略》v1、本期执行包 README（分支 `deliver/prompt-phase1-20261109` 的 `prompts/phase1-20261109/`）。
第 0 期结论已定：本机 DSH 为档位 ①，绝对路径 `D:\DPH\resources\runtime\cli\bin\dsh.cmd`，版本 0.2.1-rc.3（与 A 的 0.2.2-rc.1 有版本差，本期不升级）；headless profile 仅 base + headless bundles、无插件。

## 任务一：本机直连冒烟（对照证据，先行）

1. 用绝对路径直连跑一次真实模型调用：
   `D:\DPH\resources\runtime\cli\bin\dsh.cmd headless --json --permission-mode workspace-write --approval-policy never "<合成任务>"`
   合成任务：在一个临时目录中新建 `dsh-b-smoke.txt`，写入当前日期、机器名与一句自我介绍，然后读回确认。
2. 记录：session id、实际模型名（只写模型名，不写凭据值）、耗时、exit 状态、stdout 事件流的关键行、产物核验结果。
3. 若 headless profile 因依赖/插件缺失跑不起来：如实记录报错原文与卡点，**不自行安装任何东西**，停在本任务并在报告中标注（这将成为第 1 期的阻塞项）。

## 任务二：配合 A 的跨机冒烟

- A 侧完成注册后会经 hub 给 `dsh-b` 派单（分支 `task/p1-smoke-b`、文件 `evidence/phase1-smoke/dsh-b.txt` 的合成任务）。你侧要做的：
  1. 确认 worker 进程存活、能收到派单（不要重启 worker；若 worker 不在，按现有生产口径只报告、不擅自拉起方式变更）；
  2. 任务执行完后，记录本机侧证据：run id、session id、耗时、产物文件与分支状态；
  3. 若回执上交再次出现 `fetch failed` 类网络错误，记录原文与发生时间（与第 0 期 run #56 的现象对照），不自行改网络配置。

## 红线

- 不改 rules（rules 在 A 侧）、不动生产基座、不切基座、不重启 worker（除非它已掉线且按既有口径恢复）、不改 PATH、不装软件、不升级 DSH。
- 不碰 A 机文件；不落 A 的治理文件；任何 key/token 不进报告与仓库。
- 本轮不做注销重登、不跑 test:windows 全量。

## 报告

写 `reports/20261109-phase1-b.md` 提交到 handoff 仓新分支 `b/phase1-20261109`，含：直连冒烟全证据（或阻塞原文）、跨机冒烟本机侧证据、与第 0 期欠账清单的对照更新（哪些仍在、哪些被本期证据覆盖）。完成后停工待命。
