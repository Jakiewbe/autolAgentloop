# B隔离验收固定包：v2

文件dashboard-item-key-cancel-v2.zip，58408字节。
SHA256：c66a3c64db5f1a5c2270d0cf1130a5ac764d2dcee7eaffefd0d1808d0309a525。

本文件和SHA256SUMS为外部收件材料，不改ZIP，不影响已复核字节。
包内无生产身份、配置、密钥或运行日志；PATCH清单13个文件，另外含PATCH.json和根README.md，共15成员。

## 收件

使用本次发布的完整提交号构造下载URL，禁止把main分支的后续变化当作同一个固定包。
下载到新临时文件，核对长度和完整SHA256后，才移到：
D:\AutoAgentloop\coordination\dashboard-workflow-review\incoming\dashboard-item-key-cancel-v2.zip
若目标已有相同字节可复用；已有不同字节则停止，不覆盖。

解包到此前不存在的extract-v2-c66a3c64，检查CRC与PATCH的13项bytes+SHA256，不覆盖runtime或测试台。
受审服务器应为包中dashboard/server.mjs导出的createDashboard，显式传测试owner和隔离hubUrl，另听回环随机端口，health应workflow-2。
不要直接执行dashboard/server.mjs主入口或probe-live*.mjs，以免读取真实用户配置。

按已交付B-v2-go-prompt进行：14正向、12判据负例、2取消刷新时序、1440/390实际尺寸。测试与生产分开；不派发模型、不部署、不改B身份/权限/路由/MCP或登录项。
此交付只允许隔离验收，不构成产品总验收或正式部署许可。
