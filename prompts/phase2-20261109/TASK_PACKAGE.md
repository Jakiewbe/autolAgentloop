# 任务包格式 v1（TASK_PACKAGE）

一个任务 = 项目仓库里的一个文件：`tasks/<任务号>-<短名>.md`，随仓库版本
管理、走正常 commit。派单 prompt 只发固定短句（见文末），长内容全走 git。

## 模板

```markdown
---
id: P2-001
project: <项目名>
repo: <仓库标识：本地路径或 GitHub owner/repo>
base: main
branch: task/P2-001-<短名>
executor: dsh-b          # dsh-a / dsh-b / codex-a / codex-b 之一
reviewer: codex-a        # 必须与 executor 异机、且异 Agent
max_rounds: 6            # 继承拍板策略 v1，下同
review_rounds: 3
round_minutes: 30
---

## 背景
<为什么做这件事，链接到相关文件/报告>

## 目标
<一句话，能判真伪的验收口径>

## 范围
- 可改：<路径清单>
- 不可改：<路径清单；清单外一律不动>

## 验收
- <可执行命令 1> → <预期结果要点>
- <可执行命令 2> → <预期结果要点>

## 执行约定
- 只在 branch 上工作；只 commit，不 push（宿主侧会补推）
- 完成后在分支根目录写 HANDOFF.md：做了什么、验收命令与输出原文、
  未尽事项；写完 commit
- 拿不准是否越界：停下，在 HANDOFF.md 写明并结束本轮，不许猜着做

## 评审约定（评审者读）
- 结论三选一：PASS / FIX（逐条列）/ BLOCKED（写明卡点）
- 评审写入 REVIEW.md（任务分支根目录）或报告仓，事件 summary 只带结论词
- 不改被审代码
```

## 派单短句模板（hub 事件 prompt，固定）

```
读取 tasks/<任务号>-<短名>.md 并按其内容执行；只 commit 不 push；完成后写 HANDOFF.md 并 commit。
```

评审派单短句模板：

```
评审分支 <branch> 的任务 <任务号>：读任务包与 HANDOFF.md，按评审约定写 REVIEW 并给出结论词。
```

## 在飞与串行

同一 project 同时只允许一个在飞任务（已 emit 且未收到 PASS/BLOCKED
终局）。桥负责挡，执行者/评审者不自行判断并行。
