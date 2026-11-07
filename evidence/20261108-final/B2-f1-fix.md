# B2 应用 F1 修复（`delete result.sessionUsage;`）

证据目录：evidence/20261108-final/b2/、before/

## 1. 改前备份

| 文件 | 备份路径 | sha256 |
| --- | --- | --- |
| release\b-c067fdb-20261107\plugins\claude-go\agent.ts | before/agent.ts.release | ed0697add54b839c2c49b63ea2f24ac2b27bbc70bcce3bab49e28e47f7ab2837 |
| work\agent-autoloop\plugins\claude-go\agent.ts | before/agent.ts.workrepo | ed0697add54b839c2c49b63ea2f24ac2b27bbc70bcce3bab49e28e47f7ab2837 |

备份清单：before/sha256.txt。

## 2. 改动（落到实际运行的那份代码）

实际运行的底座是 release\b-c067fdb-20261107（计划任务的 background.ts 参数指向它）。两棵树同改：

第 29–30 行

```ts
-    // Claude's local price estimate is not the amount charged by OpenCode Go.
-    if (result.usage) delete result.usage.cost;
+    // Claude's local price estimate is not the amount charged by OpenCode Go.
+    delete result.sessionUsage;
```

| 文件 | 改后 sha256 |
| --- | --- |
| release\b-c067fdb-20261107\plugins\claude-go\agent.ts | 235e804ef23a2172e3b2a8a4156a7fffaa6fe6208e240faf3189cafafa8488a7 |
| work\agent-autoloop\plugins\claude-go\agent.ts | 235e804ef23a2172e3b2a8a4156a7fffaa6fe6208e240faf3189cafafa8488a7 |

`git -C work/agent-autoloop diff --stat` → `plugins/claude-go/agent.ts | 2 +-`（1 insertion, 1 deletion）。

## 3. b8-cost-criterion 两方向（在 release 树、即实际运行的那份代码上跑）

判据文件：上一轮 work/f1-verify/tests/b8-cost-criterion.test.ts（B 侧独立判据，不改仓库断言）。本次临时放进 release 树跑完即删，跑完 `temp criterion removed: OK`，release 树只剩 agent.ts 一处改动。

喂入：

```json
{"type":"result","subtype":"success","result":"done","session_id":"s1","total_cost_usd":12,
 "usage":{"input_tokens":3,"output_tokens":2,"cache_read_input_tokens":1}}
```

断言：`r.usage.input === 3`、`r.usage.output === 2`、`JSON.stringify(r)` 不含 `cost`、`r.sessionUsage === undefined`。

| 方向 | agent.ts sha256 | 结果 | 证据 |
| --- | --- | --- | --- |
| 已修 | 235e804e… | **pass 1 / fail 0** | b2/pass-direction.txt |
| 还原旧行 | ed0697ad… | **fail 1**（`AssertionError [ERR_ASSERTION]: sessionUsage/usage 里不得出现 cost`） | b2/fail-direction.txt |
| 再改回已修 | 235e804e… | **pass 1 / fail 0** | b2/pass-direction-after-restore.txt |

全过程日志：b2/run-b8-criterion.log。

## 4. 重启 worker 与心跳

重启方式：迁移后由计划任务 `agent-autoloop-09bbb91a` 启动（见 B3，B2 的修复与 B3 的迁移用同一次重启加载，旧进程 16424 已停）。

| 项 | 值 |
| --- | --- |
| 新 up.pid | 22156 |
| up.log | `2026-11-07T19:29:40.816Z [worker] worker b-magicbook14 started` |
| 心跳探测（worker 自己的 key，`/v1/work?wait=0&capacity=0&claim=beat`） | **HTTP 200**，`{"job":null,"cancel":[]}`，19:30:19Z，耗时 0.63 s |
| 探测前（迁移前） | **HTTP 200**，`{"job":null,"cancel":[]}`，19:28:59Z |

## 5. done 计数

**未验（照抄）：** 重启后到本报告生成，中台没有派新活（`job:null`），worker/runs 仍是 22 个目录（最新 35-1，2026-11-06 14:47）。所以「done 计数继续增长」这条**没有观测到增长**，只观测到「worker 已连上、心跳 200、没有新活」。需要 A 侧派一轮活才能闭合。

## 6. 回滚（一条命令）

```bash
cp /d/AutoAgentloop/evidence/20261108-final/before/agent.ts.release \
   /d/AutoAgentloop/release/b-c067fdb-20261107/plugins/claude-go/agent.ts \
&& AGENT_AUTOLOOP_HOME=D:/AutoAgentloop/home \
   node /d/AutoAgentloop/release/b-c067fdb-20261107/bin/agent-autoloop.ts service install
```

`service install` 内部先 `removeService()` + `stopUp()` 再注册并启动，等价于「恢复原件 + 重启」，进程会重新加载旧代码。回滚后 agent.ts sha256 应回到 `ed0697ad…`。
