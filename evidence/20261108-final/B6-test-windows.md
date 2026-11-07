# B6 test:windows 复跑 + 残留自查

证据目录：evidence/20261108-final/b6/

## 1. 结果

```
cd work/agent-autoloop && node scripts/test-windows.ts
ℹ tests 484
ℹ pass 484
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 94319.3327
real 1m34.509s
EXIT=0
```

全文：b6/test-windows.log。门槛只认这条，跑的是工作副本（含 B2 修复）。

## 2. 跑前 / 跑后对照

| 项 | 跑前（19:30:55Z） | 跑后（19:34:07Z） | 判定 |
| --- | --- | --- | --- |
| 计划任务 `agent-autoloop*` | 只有 `agent-autoloop-09bbb91a \| Running` | 同上 | **无残留任务** |
| 监听端口 3350–3400、4347 | 无 | 无 | **无残留监听** |
| `%TEMP%\agent-autoloop-*` 目录数 | 24 | 24 | **无新增临时家目录**（逐名 diff 为空） |
| 带 agent-autoloop 的 node 进程 | 只有 worker 22156 | 只有 worker 22156 | 未被打扰 |

快照脚本：b6/snapshot.sh；原始快照：b6/before.txt、b6/after.txt。

## 3. 需要说明的一条（照抄）

那 24 个 `%TEMP%\agent-autoloop-*` 目录是**本轮之前就存在的**（`adapters-*`、`state-timers-*`、`windows-*`、`worker-*` 等，来自更早的测试轮次），不是这次跑出来的。本次运行前后目录名集合完全一致。按任务单「无新增临时家目录」判定通过；但机器上确实躺着 24 个旧测试家目录，需要清理的话：
```powershell
Get-ChildItem $env:TEMP -Directory -Filter 'agent-autoloop-*' | Remove-Item -Recurse -Force
```
（B 侧没有擅自删，因为里面可能还有上一轮排障要看的现场。）

## 4. 与上一轮对比

上一轮同一命令是 484/484/0/0，139362 ms；本轮 484/484/0/0，94319 ms（快 45 s，无断言变化、无跳过增加）。
