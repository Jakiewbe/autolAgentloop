# FINAL-ACCEPT-20261106 六项矩阵

stage: FINAL-ACCEPT-20261106 / build: final-20261106-baseline-0.166-strict-v2 / A 侧真实模型执行 4 次（run 31-34）/ 重试 0 / 内部修复 0

| 项 | 判分 | A 侧证据 | B 侧证据 |
|---|---|---|---|
| 1 通信闭环 | 沿用不重测 | run 29 done attempts 0，session 01a1af1f-ba77-7451-9963-e14049e17b99，usage 1009471/2730/998144 | v2-accept B seq4：stdout 29 行、turn.completed 第 29 行、0 非 JSON、native exit 0 |
| 2 合成目录 | PASS | run 31 done attempts 0，final 首行逐字 FA-2 通过：ITEM2-20261106-1320，usage 1705975/3951/1696128 | final B seq2：7 条命令 exit 全 0、marker 逐字回读 FA-ITEM2-OK-ITEM2-20261106-1320、独立 ls 得 NO_ITEM2_DIR、stdout 37 行 turn.completed 第 37 行 0 非 JSON、exit-1 内容 0 |
| 3 同会话续接 | 沿用不重测 | run 30 done 同 session，usage 1462654/3365/1431936 | v2-accept B seq4：14 行、turn.completed 第 14 行、0 非 JSON、native exit 0 |
| 4 运行中取消 | PASS | run 32 cancelled 05:29:56.461Z（下发 13:29:52 后 4 秒），运行 385s 而预定等待 480s，usage null，无 exit 文件（未伪造 native 0） | final B seq3：2 秒采样 66 次，13:29:54.116 最后存活 → 13:29:56.811 全灭；runner 34056、cli 10872、等待 16828、3 个 MCP helper 全消失；无 turn.completed、sleep item 未 completed、b-ping.txt 未变、worker 33640 健康 |
| 5 断线恢复 | PASS（附记录缺陷） | run 33 停机中被停（终态 done，见下）；run 34 离线排队后恰执行一次 attempts 1、exit 0、139404/805/137216、首行 FA-5 离线任务完成：ITEM5OFF-20261106-1320 二行 once=yes | final B seq4/5：worker 33640 停于 13:33:41.924；停机时 cli 27320/runner 34788/4 个等待 shell 仍存活（taskkill 不级联，记未解决）；恢复启动 2 次（10784 被启动器工具超时回收，30208 驻留）、单实例、up.pid 30208、hub Established、command[0]/版本/模型/账户/CODEX_HOME/MCP 未变 |
| 6 真实登录触发 | PASS（自动启动）／登录方式未证 | A 侧 run 35 done attempts 0，首行逐字 FA-6 登录后执行完成：ITEM6-20261106-1320，06:46:01.757Z 被领取、06:47:05.815Z 完成，usage 136493/196/2048 | final B seq8：注销 7002 于 13:48:30.179、winlogon 新实例 13:48:30.996；登录 7001 于 13:48:44.509（间隔 14.3 秒，认证方式未证，AutoAdminLogon 为空、4624 无权读取）；worker 28452 创建 13:49:08.058、父进程 cmd.exe 31892（Startup agent-autoloop.cmd）、祖父 explorer.exe 22368、up.log 创建同秒首行 worker started、up.pid 28452、单实例、hub 443 Established、启动项 430B aa2cfb42...28a6 未变 |

## 第 6 项的边界（不能再往前一步的部分）

自动启动链条成立：Startup 批处理在新登录会话里拉起单实例 worker，进程创建时间/父链/up.log 全部指向登录触发，A 用 run 35 证明该实例能真实接单执行。但「用户亲手输入凭据」这一点不成立为已证事实：注销后 14.3 秒就有 7001 登录事件，早于用户本人回话 48 分钟，HKLM Winlogon 的 AutoAdminLogon 为空、DefaultUserName 未设置，4624 安全日志因无权限读不到；不靠提权补证，因此这一层如实记为未验证。

## 需要如实保留的事实

1. run 33 的终态是 done 不是 cancelled：A 的取消在没有 worker 确认时作废；孤儿回合自然完成后写出 exit-1=0 与 turn.completed，恢复后的 worker 依磁盘回执收尾。一次模型回合一次收尾、无重复执行，也不能当作断线期间的成功回执。
2. taskkill /F 只结束 worker，不级联结束 runner/codex/子进程（第 5 项实测），恢复后必须靠磁盘回执收尾。
3. 第 6 项未实测：没有注销、没有登录触发，因此不能用任何手工启动或旧构建结果替代。

## 剩余最小人工动作

1. 在 MAGICBOOK14 上注销当前会话，并由用户本人用凭据重新登录（B 不代填、不自动登录、不改账户）。
2. 登录后 B 观察 >=120 秒且不手工起 worker，回报 seq8 LOGIN_OBSERVED（真实登录时间/账户/会话、worker 创建时间晚于登录、父链到启动项 cmd 或 up.log 首行晚于登录、单实例、up.pid、心跳）。
3. A 随后只派一条无害任务，核对首行 FA-6 登录后执行完成：ITEM6-20261106-1320 与第二行 login=ok。
4. 若观察窗口内没有自动拉起 worker：第 6 项记失败，只修既有启动链并留原件，不做第二次注销。
