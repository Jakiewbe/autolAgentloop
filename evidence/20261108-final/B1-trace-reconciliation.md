# B1 溯源对账（release\b-c067fdb-20261107）

生成时间：2026-11-07T19:2xZ（UTC）/ 2026-11-08 03:2x（本机 Asia/Shanghai）
证据目录：evidence/20261108-final/b1/

## 1. 全树 sha256 清单

规则（与 A 侧一致）：仓库根相对路径、不排除任何目录（无 node_modules，全树 244 个文件）、`sort -z`、`LC_ALL=C`、每行 `<64hex><两空格><路径>`、对整段清单文本再取 sha256。

| 项 | 值 |
| --- | --- |
| 文件数 | 244 |
| 目录数 | 45 |
| 格式不合规行 | 0 |
| 清单文件 | b1/manifest-full.sha256 |
| **全树指纹（修复前 = 02:30 基线）** | **6a2dae9aca17cc8007bf36d060e0018a0a79fb2b7b4f936566fa0f9c6648be7b** |

注：Git Bash 的 `sha256sum` 原输出带 `*` 与 `./` 前缀，已用 `sed -E 's/^([0-9a-f]{64}) [ *](\.\/)?/\1  /'` 归一，归一后格式校验 0 行不合规。

## 2. 9 路径各自 sha256（修复前）

见 b1/nine-paths.sha256：

| 路径 | sha256 |
| --- | --- |
| plugins/claude-go/agent.ts | ed0697add54b839c2c49b63ea2f24ac2b27bbc70bcce3bab49e28e47f7ab2837 |
| plugins/command/agent.ts | 71ba0989628b8629199032fbc2577bca4618dd95a99554f69b1a9ef44e8f77a1 |
| worker/agents.ts | 9f4d961ba5b3147765f6a77a798e4aeb89639a1094833eef8a44efebbc10b607 |
| worker/worker.ts | 9cfb666a359b387ec1e4d52fe7e06027028d472a39c2bacb0c45dfa001407305 |
| tests/command-adapter.test.ts | 935775d5b91140ce57d220fdf0a2259044b210b90f1144be7d7c4e46f6df78c5 |
| tests/claude-go.test.ts | a9361efab1a7ed0bdb5068f2c0a88f8114957dedff35069bb57c0a527a6e8df4 |
| tests/acp.test.ts | 343dae96c7ded2829816eab288afa90affdf2bc97bf06876ce1b7d98839c3bc5 |
| tests/windows.test.ts | 2a0229c82782cc8614f7bd1c816acd27bce6bbb1ddb7a81517ac31646e621821 |
| tests/delivery-scope.test.ts | 0e4c4a76556132af091e829ddcbb76dbd5679b8d69d9d6f36895e35421cc27f5 |

## 3. plugins/claude-go/agent.ts 里有没有 `delete result.sessionUsage;`

**没有。** 修复前 release 与 work 两棵树 `grep -n sessionUsage plugins/claude-go/agent.ts` 均 NO_MATCH，仍是上游旧行（第 29–30 行）：

```ts
    // Claude's local price estimate is not the amount charged by OpenCode Go.
    if (result.usage) delete result.usage.cost;
```

- 本机 sha256 = `ed0697ad…`，A 侧已修版 = `8dd8c405…` → 两份文件不同，**B2 必须先修**（已在 B2 执行）。
- 语义核对：`plugins/claude/agent.ts:82` 构造 `const sessionUsage = result.total_cost_usd === undefined ? undefined : { cost: result.total_cost_usd }`，`:88` 返回 `{ text: said, ...known, usage, sessionUsage, finished: true }`；`worker/worker.ts:92` 的 `sessionRise` 才是记账通道，`:376` `entry.usage = addUsage(addUsage(entry.usage, seen.usage), sessionRise(entry, seen))`。per-turn `usage` 只有 input/output/cached，从来没有 `cost` → 旧行删 `result.usage.cost` 是空操作，真正漏价的是 `sessionUsage`。`tests/claude-go.test.ts:56-71` 只断言 `result.usage?.cost === undefined`，属空判据。

## 4. 修复后全树（B2 落地后重算，供 A 对表）

| 项 | 值 |
| --- | --- |
| 文件数 | 244 |
| 格式不合规行 | 0 |
| 清单文件 | b1/manifest-full-after-fix.sha256 |
| **全树指纹（修复后）** | **461234952ab36e245716161fd42447e0b073ea953a8467d18318e85c309993c0** |

与修复前清单逐行 diff 只有一行变化：

```
102c102
< ed0697add54b839c2c49b63ea2f24ac2b27bbc70bcce3bab49e28e47f7ab2837  plugins/claude-go/agent.ts
---
> 235e804ef23a2172e3b2a8a4156a7fffaa6fe6208e240faf3189cafafa8488a7  plugins/claude-go/agent.ts
```

即：全树只有 `plugins/claude-go/agent.ts` 一个文件变了，其余 243 个文件字节不变。

## 5. 与 A 侧字节对不上的一条（照抄，不美化）

A 侧修好的 `plugins/claude-go/agent.ts` 是 `8dd8c405…`，B 侧按 A 的修法（换掉第 29–30 行）落地后是 `235e804e…`。两者**不同**。B 侧拿不到 A 侧那份字节，无法逐字节比对差异；B 侧能确定的是行为一致（B2 判据两方向实测通过）。差异可能来自注释文字、换行或额外改动，需要 A 侧给文件或 diff 才能闭合。
