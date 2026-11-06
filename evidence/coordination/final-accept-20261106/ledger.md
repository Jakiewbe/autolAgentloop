# FINAL-ACCEPT-20261106 A 侧执行总账

口径：每条都是中心真实 run；attempts 为自动重试次数；usage 为 hub 记录的实际用量；取消的 run 记 cancelled 且 usage 可为 null，不折算成执行。

| run | 项 | state | attempts | session | usage(input/output/cached) | summary |
|---|---|---|---|---|---|---|
| 31 | 2 合成目录 | done | 0 | 01a1af4e-3805-7513-84ab-684d0652f8b7 | 1705975/3951/1696128 | FA-2 通过：ITEM2-20261106-1320 |
| 32 | 4 运行中取消 | cancelled | 0 | 01a1af4f-e564-73d2-909b-7396f4f4e35c | null | 已停止 |
| 33 | 5 停机中断 | done | 0 | 01a1af56-2084-73f2-9364-1aa788b59aa2 | 1124643/2355/1117440 | FA-5 中断任务完成：ITEM5-20261106-1320 |
| 34 | 5 离线排队 | done | 0 | 01a1af5d-1083-7262-a312-94aff0fc20f8 | 139404/805/137216 | FA-5 离线任务完成：ITEM5OFF-20261106-1320 |

## 计数

- A 侧真实模型执行 4 次（run 31/32/33/34），上限 10；重试 0，内部修复 0。
- 中心新增 run 4 条，上限 12。
- B 维护重启 1/2，第 5 项恢复启动 2 次，注销 0/1。

## 身份基线（A 本地工作树，字节即构建）

| 文件 | 字节 | sha256 |
|---|---|---|
| app/plugins/command/agent.ts | 6141 | c077041d0f2ac21b774ba546d203c16a81e2954b44770b27dedc7d5b831c4f74 |
| app/worker/worker.ts | 17436 | 8416191f470f6320c7ad058af61ea13232b1662b2768a234d4fc9a295baeef82 |
| app/worker/agents.ts | 2328 | 6c150fc07d6ec255df6aadc6cc73192d829333dda7b18d276ce8574d0e23b471 |
| app/host/server.ts | 4816 | 7ef50b1eae27c8a293b0fac95ad36429471fde909485b1fe09d82d8562b6ae5d |
| app/host/runtime.ts | 13440 | c15d0bd3c5d90251c640f282e3b66321779b26fcee20ed40c068e9d929286798 |
| deploy/coordination/night-20261106/night-parse-strict-fulljson-v2.zip | 14201 | 5ff21499d4e0d98dddb2a9679e72fc8d907907454e139940d957101ee3bc4e23 |
| deploy/coordination/night-20261106/night-center-rules-reload-v2.zip | 12928 | 1106c14ddf523457fa9711cd38b1b21459d48a0782356727433cdb7536631e5c |

- 入口（B 机）：C:\Users\19082\AppData\Local\agent-autoloop\tools\codex\0.166.0-alpha.5.1\package\vendor\x86_64-pc-windows-msvc\bin\codex.exe 368970544 字节 6ca87057d80648f18f8cba0db224ae3e885b25326c07dcc798d38caef22c302c（B seq6 复核，本轮未变）。
- 模型 deepseek-v4.1-flash-1017，cwd D:\AutoAgentloop，worker b-magicbook14，access edit，timeout 30。
