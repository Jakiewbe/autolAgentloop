# 备份还原演练（A 侧，2026-11-04 23:23）

## 1. 这次验的是什么
把「22:28 的私有备份」当成唯一可用材料，在一台隔离的 HOME 上把中台**起起来**，确认配置、数据库、主密钥、规则四件套自洽、历史读得回来、密钥不对时进不来。验的是**备份可用性**，不是"在活动中心上覆盖式还原"。

- 备份来源：`C:\Users\chs\.agent-autoloop\backups\codex-review-20261104-222813`（config.json / hub.db / master.key / rules.json / startup.cmd，完整性检查 890 条事实）
- 演练目录：`%TEMP%\aa-restore-20261104-232327`（不在仓库内，含 master.key，**不进证据**）
- 日志：`evidence/raw/recovery/20261104-2325-restore-drill.log`

## 2. 步骤与结果

| 步骤 | 命令要点 | 结果 |
|---|---|---|
| 1 复制 | `cp <backup>/{config.json,hub.db,master.key,rules.json} <drill>` | 4 个文件到位 |
| 2 复制保真 | 两侧 `sha256sum` 对比 | config `97816fa6…`、hub.db `3fd02019…`、master.key `50e84372…`、rules `7027c69e…`，**逐个相同** |
| 3 改监听 | `hub.listen/publicUrl/url` → `127.0.0.1:3399` | 避免与活动中心 3350 冲突 |
| 4 只起中台 | `AGENT_AUTOLOOP_HOME=<drill> node tools/checks/drill_serve.ts 3399` | `listening on 127.0.0.1:3399`；`/healthz` 200，commit `96b6c9c71671` |
| 5 读历史 | 用**恢复出来的 config 里的 owner 键**请求 `GET /v1/state` | 200；`runs 9`、`done 7`、`recentCards 4`、agents=Agent/慢测、channels=桌面通知 |
| 6 鉴权仍生效 | 同一接口用 `Bearer wrong` | **401** |
| 7 数据完整 | 只读打开两个库数数 | 恢复库 `facts 890 / projections 52`；活动库 `facts 1081 / projections 75` |
| 8 收尾 | `kill` + `taskkill /T /F` | 3399 无 LISTEN（仅 TIME_WAIT），活动中心 3350 未受影响（`/healthz` 200，10 轮 done 不变） |

第 7 步的 890 与备份记录里的「890 条事实」一致；活动库多出的 191 条是备份时刻之后产生的（第 10–13 轮），符合时间线，不是丢失。

## 3. 顺带核对的现场事实（为复盘留档）
- 活动中心 `GET /v1/state`：`runs 13`、`done 10`；第 12、13 轮状态 `done`、同一 `session f05310c6-5a2c-47b7-acdb-b03f1b242f88`、规则名 `generated-live-d6986eec…`；第 11 轮 `cancelled`、无 session —— 与 `evidence/current-review/deployment-A.md` 的描述一致。
- `rules.json` 现存 3 条：`试一下`、`演练断电`、`A-Claude只读验收`；**临时生成的 `generated-live-*` 规则已不在文件里**（历史运行记录仍保留其名字）。这印证「测试规则撤回、历史保留」，但注意 `A-Claude只读验收` 仍在生效范围里。
- `/healthz` 返回 commit `96b6c9c71671c8096f2da1c7a6ffbd19a1a6866a`，与部署包一致。

## 4. 边界（没验的，不许当通过）
- **没有在活动中心上做覆盖式还原**：那会把备份时刻（22:28）之后的第 10–13 轮记录回退掉。真要做，先停中心、把当前 `hub.db` 移走留档、再拷入备份、验完再把新库放回；本轮没做这一步。
- 没有验 **B 侧**的备份与还原（B 未接入）。
- 没有验**登录自启时**的还原（只验了手动起进程）。
- 没有验**生产任务强制停止**（第 11 轮的取消是排队前的取消；运行中强杀走的是 `taskkill /T /F`，Windows 无优雅停止）。
- 备份里的 `startup.cmd` 只做了存在性记录，没有用它启动。
