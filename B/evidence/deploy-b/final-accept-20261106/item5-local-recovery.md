# FINAL-ACCEPT 第5项 本机恢复说明（不含凭据）

1. 恢复入口：在任意用户 shell 执行
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File D:\AutoAgentloop\_probe\final-item5-recover.ps1
2. 该脚本不依赖 worker 与任何模型进程：只用 node + 既有 runtime 入口 `agent-autoloop.ts up`，日志写入
   C:\Users\19082\.agent-autoloop\logs\worker.stdout.final-item5-recover.log（独立于旧日志）。
3. 恢复后核对：up.pid 内容 = 新 PID；Get-CimInstance 只应有 1 个 agent-autoloop.ts up 进程；到 hub 443 的连接为 Established。
4. 用户侧手工兜底（无需登录凭据输入）：同一命令行可在资源管理器/终端手工执行。
5. 不创建服务、计划任务、不修改启动项、不提权。
