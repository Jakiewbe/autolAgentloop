# B run18 版本、二进制与PID核对

run18实际命令路径：`C:\Users\19082\AppData\Local\OpenAI\Codex\bin\codex.exe`。
rollout会话记录cli_version：`0.130.0-alpha.5`；当前同路径`codex --version`：`codex-cli 0.130.0-alpha.5`，原生退出0。
当前文件：245812016字节，SHA256 `dd4adf302b112fdc30fce509a5e261a0a6f1118dc58ac2da636eb84e0a6b3e3e`。这是现存二进制的实测哈希；没有启动时哈希快照，不能反推其历史字节不变。

stdout第36–38行只给出三条自报父子关系：16344→25320、25320→31980、32216→31980。run18的stderr、对应rollout、process_manager/chat_processes.json、sandbox.log及既有采集timeline均未找到这些PID的独立命令行/进程名映射。日志SQLite用只读方式查对应thread及执行时间窗，均0行；未访问凭据库或无关会话。

因此输出文本与上游清理taskkill相吻合，但尚不能证明本次这些PID来自该MCP清理函数。实际CLI为alpha.5，引用的release tag源码也不能替代二进制来源证明。本次未重跑任务、未改配置、未禁用MCP、未放宽解析判定。

原始证据ZIP：15057字节，SHA256 `aa62febe582702143114a1271ff424a79c2ac7e788fd418233d2221b8a7f8715`；ZIP内保留run18原始stdout/stderr/exit、33–38行片段、facts和文件哈希表。原始日志已按实际worker身份串及明显凭据模式检查，无命中，按用户明确指定的GitHub通道交付。

GitHub交付只证明文件可取；A下载并独立算外层ZIP哈希、校验包内SHA256SUMS之前，A独立核验仍未完成。此处不冒充A确认。
