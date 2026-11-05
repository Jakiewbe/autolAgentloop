# 身份文件接收协议（B 侧）

本文件只描述 A 私密通道交付的 B 专属 worker 身份文件如何核对；不含任何凭据内容。

## 1. 交付契约（以 A 的交付为准，B 不改造）

| 项 | 值 |
| --- | --- |
| 形态 | **原始文本**（不是 JSON、不是 zip、不是 base64 包裹） |
| 字节数 | **43** |
| 行数 | **1**（末尾至多一个换行，不含 CRLF 转换） |
| 预期完整 SHA256 | `a221bdfd990c3fc9d89241a43f6be065a04d3be661988f8e91a78151b0ef695f` |
| B 预定落点 | `D:\AutoAgentloop\_incoming\secrets\b-magicbook14.worker.key` |
| 传递方式 | A 用私密通道；不进聊天、日志、报告、Git、邮件正文 |

B 按「文件哈希 + 字节数 + 原始文本」三项核对。**不把 key 包成 JSON**，也不因为文件不是 JSON 就要求 A 重新签发。

## 2. 元数据字段的口径

`report-key-file.ps1` 只输出元数据，逐项含义：

| 字段 | 含义 | 是否参与判定 |
| --- | --- | --- |
| `KEY_PATH` / `KEY_BYTES` / `KEY_SHA256` / `KEY_MTIME_UTC` / `KEY_ACL_OWNER` | 路径、字节数、完整哈希、修改时间、ACL 属主 | 字节数与哈希参与判定 |
| `KEY_JSON_LIKE` | 首字节是否为 `{`，**描述性元数据** | **不参与判定**（原始文本契约下它本就应为 False） |
| `KEY_LINE_COUNT` | 换行计数 | 仅记录 |
| `KEY_SHA_MATCH` / `KEY_BYTES_MATCH` | 与预期完整哈希、43 字节的比对结果 | 参与判定 |
| `KEY_CONTENT_PRINTED` | 恒为 `no` | — |

退出码：`0` = 文件已到且哈希与字节数都对得上；`2` = 文件未到；`3` = 已到但与契约不符（哈希不符或字节数不符）。

## 3. 核对命令（B 上执行，只出元数据）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\AutoAgentloop\evidence\deploy-b\report-key-file.ps1 `
  -Path D:\AutoAgentloop\_incoming\secrets\b-magicbook14.worker.key
```

自测（非凭据夹具，可复跑）：`D:\AutoAgentloop\_probe\key-fixture-test.ps1`，用例见第 4 节。

## 4. 夹具自测判据（2026-11-05 执行）

| 用例 | 输入 | 期望 |
| --- | --- | --- |
| raw-43-ok | 43 字节原始文本（非凭据） | `KEY_JSON_LIKE=False`、不因这一点停止、哈希不符才停 |
| json-like | 43 字节但以 `{` 开头、哈希不符 | `KEY_JSON_LIKE=True` 仅作描述，停止理由是哈希/字节数不符 |
| bytes-wrong | 42 字节原始文本、哈希不符 | 停止（字节数与哈希都不符） |
| missing | 路径不存在 | `KEY_FILE=missing`、exit 2 |

夹具自测只证明核对逻辑；**不能当作真实送达证明**。真实文件未到就继续标「未收到」。

## 5. 当前状态

- 2026-11-05T12:10+08:00 复查：`_incoming/secrets/` 下只有本协议与 `README.md`，`b-magicbook14.worker.key` **未收到**；`*magicbook*` / `*.worker.key` 在 `_incoming`、Downloads、Desktop、Documents、`D:\AutoAgentloop` 仍无命中。
- 收到后只回传路径、字节数、完整 SHA256、mtime、ACL 属主；内容不出现在任何报告/日志/提交里。

## 6. 安装门禁（顺序不可颠倒）

1. 身份文件到达且 SHA256 与 A 记录一致（本协议第 1 节）；
2. B 修复版通过针对**固定提交**的独立复核；
3. 真实安装执行完成并留下合规回执；
4. 取得 A 的联调许可后，才开始六项跨机联调；
5. 联调顺序：派发→执行→回传 → 临时目录改文件 → 同会话第二轮 → 取消任务 → 断线重连 + 执行端重启 → 登录启动入口（需用户确认）。取消测试与断线重启测试在同一执行端上依次进行，不并行。
