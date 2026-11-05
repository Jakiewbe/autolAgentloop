# 身份文件接收协议（B 侧）

本目录只收 A 私密通道交付的 B 专属 worker 身份文件。规则：

1. 落点固定：`D:\AutoAgentloop\_incoming\secrets\b-magicbook14.worker.key`（文件名固定，便于守卫第 4 步直接引用）。
2. 传递方式：A 用私密通道（不在聊天、日志、报告、Git、邮件正文里）。B 收到后只回传**路径、字节数、SHA256、mtime、ACL 属主**。
3. 内容处置：B 的任何报告、日志、Git 提交都不得包含密钥内容；守卫只记录 `worker_key_file_sha256`。
4. 回传命令（B 上执行，只输出元数据）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\AutoAgentloop\evidence\deploy-b\report-key-file.ps1 -Path D:\AutoAgentloop\_incoming\secrets\b-magicbook14.worker.key
```

5. 核对口径：B 回传的 `KEY_SHA256` 应等于 A 侧记录 `a221bdfd990c3fc9d89241a43f6be065a04d3be661988f8e91a78151b0ef695f`。不等则视为传输损坏，停在此处，不尝试安装。
6. 若文件形态异常（`KEY_JSON_LIKE=False` 或 `KEY_BYTES` 明显不符），同样停下并回传元数据，由 A 重新签发。

## 当前状态

- 2026-11-05T10:21+08:00 复查：本目录原不存在；`*magicbook*` / `*.worker.key` 在 `_incoming`、Downloads、Desktop、Documents、`D:\AutoAgentloop` 均无命中。等 A 交付。

## 安装门禁（顺序不可颠倒）

1. 身份文件到达且 SHA256 与 A 记录一致；
2. B 修复版通过独立复核（结论落在 `B/reviews/` 下的审核记录）；
3. 真实安装执行完成并留下合规回执；
4. 取得 A 的联调许可后，才开始六项跨机联调；
5. 联调顺序：派发→执行→回传 → 临时目录改文件 → 同会话第二轮 → 取消任务 → 断线重连 + 执行端重启 → 登录启动入口（需用户确认）。取消测试与断线重启测试在同一执行端上依次进行，不并行，避免互相干扰。
