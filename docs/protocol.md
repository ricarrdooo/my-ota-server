# OTA Station Device Protocol v1

本文对应当前实现，不是尚未实现功能的承诺。接口前缀 `/api/v1`；所有 JSON 为 UTF-8，生产环境必须使用经过证书验证的 HTTPS。

## 1. 对象与信任

Product 是产品；Target 是不可变的精确硬件 / 镜像配置；Artifact 是签名制品；Release 是将制品发布到 stable 或 beta 的记录；Device 是实际升级目标；Agent 是持有凭据的直连设备或联网网关；Attempt 是一次绑定特定发布的升级尝试。

管理员可单独编辑发布说明，不改变已签名制品或设备协议。活动发布须先撤回，绑定过任何 Attempt
的发布不能删除；删除未使用发布不会删除固件文件，内部保留序号与审计以防序号重用。
已删除发布不能再按其 ID 创建升级尝试；重新发布生成新 ID 和更高序号。

网关的 Bearer 密钥只能代理被分配给它的 Device。子设备仍各有 device_id 和硬件配置，不共享一份“网关升级成功”。服务器能验证联网代理身份，不能据此证明物理子设备确实启动；网关必须转发真实启动确认，不能在 UART / CAN / RS485 传完时伪造成功。

Target 配置在后台导出成 profile，含 `schema_version`、`target`、`target_fingerprint`、`public_key_pem`。设备应通过可信烧录流程预置该 profile 或等效精简配置及根公钥，**不可从未验证的更新响应中接收新的根公钥**。服务器不向设备发送签名私钥。

授权头：

```http
Authorization: Bearer DEVICE_OR_GATEWAY_TOKEN
```

不使用 URL token，不使用管理员 Cookie。常见失败码：400 输入错误，401 凭据错误，404 对象不存在 / 未授权，409 兼容或状态冲突，410 下载授权过期，413 体积超限，422 参数错误，429 频率超限，503 存储不可用。错误正文为 `{"error":"说明"}`（部分框架错误可能为 `detail`）。

## 2. 检查更新

```http
GET /api/v1/ota/check?device_id=DEVICE_ID&target_id=desktop-s3-n8r8-st7735s-v1&layout_id=ota-3m-v1&bootloader_version=0.1.0&capabilities=staging,app_confirm&protocol_version=1&current_sha256=INSTALLED_ARTIFACT_SHA256
```

`current_sha256` 可省略；若提供，必须是 64 位小写十六进制字符，否则返回 422。它是此前验签、安装的整个制品文件 SHA-256，不是 ELF 摘要、ESP 镜像内置摘要或包含尾部空白的整个 flash 槽摘要。应随安装元数据持久保存。能力必须与实机一致；Bootloader 版本为数字 `x.y.z`，不是 ESP-IDF / STM32 软件库版本。

更新判据只比较此摘要与活动发布制品的摘要。相同返回 `up_to_date`，不同则提供更新；不比较版本字符串大小。未知摘要时**省略参数**，服务端会保守提供发布，不会回退到版本号或数据库旧心跳记录判断已安装。客户端必须将下载所得、已经验签校验的制品摘要绑定到具体槽位，待新应用启动自检通过后才上报为当前安装摘要；断电、刷写失败、回滚后需保留或恢复实际运行槽对应的旧摘要，不能在仅下载成功时覆盖它。首次串口烧录也需按实际应用 bin 初始化这份元数据，不能混用 `app_elf_sha256`。

有更新响应结构：

```json
{
  "schema_version": 1,
  "update_available": true,
  "release_id": "SERVER_RELEASE_ID",
  "release_seq": 1,
  "manifest": {"...": "下节的完整签名清单"},
  "signature": "BASE64_RSA_SIGNATURE",
  "download_path": "/api/v1/ota/releases/SERVER_RELEASE_ID/firmware"
}
```

无更新：`{"schema_version":1,"update_available":false,"reason":"no_release"}` 或 `up_to_date`。同一个版本字符串可对应不同构建；安装判断使用摘要，不能只比较版本字符串。`release_seq` 在每个 Target + channel 内递增，不是已签名的防降级计数器。

响应中的签名清单字段（全部必需，不允许额外字段）：

| 字段 | 语义 |
| --- | --- |
| `schema_version` | 数字 1 |
| `product_id`, `target_id` | 精确匹配预置产品 / 型号 |
| `target_fingerprint` | profile 的配置指纹 |
| `component` | `app`，首版不更新 bootloader 或分区表 |
| `mcu`, `hw_revision`, `layout_id`, `image_format` | 精确匹配硬件与安装布局 |
| `version` | 镜像版本，ESP / MCUboot 必须匹配内置版本 |
| `size`, `sha256` | 整个制品长度和小写 64 位十六进制 SHA-256 |
| `key_id` | 公钥 DER SubjectPublicKeyInfo 的 SHA-256 指纹 |
| `signature_algorithm` | `rsa-pss-sha256` |
| `min_bootloader_version` | 最低 Bootloader `x.y.z` |
| `required_capabilities` | 排序后的能力字符串数组 |

### 规范化与验签

规范化定义为 Python：

```python
json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False).encode("utf-8")
```

profile 配置指纹对 `target` 的这些字段规范化后计算 SHA-256：`id, product_id, adapter, mcu, hw_revision, layout_id, max_size, key_id, min_bootloader, capabilities, config`。不包含显示名称或创建时间。字符串键按字典序排列，数组保持顺序；当前签名字段不包含浮点数。拒绝重复 JSON 键、NaN 和未知字段。

使用 RSA-3072 或 RSA-4096、PSS、MGF1-SHA256、SHA-256、**固定盐长 32 字节**，对规范化 manifest 字节签名。`signature` 是标准 Base64，`signature.txt` 可带末尾换行。不是 PSS MAX_LENGTH，也不是 PKCS#1 v1.5。预置公钥的 key_id 必须匹配，先验签及兼容性，再考虑下载；下载后再次检查实际长度与 SHA-256。

此处签的是绑定固件摘要和安装约束的清单。ESP 镜像自带 SHA-256 / MCUboot 哈希 TLV 只证明完整性，不替代真实性验签。生产 Bootloader 必须独立维持可信安装链；外置签名不能自动替代 ESP Secure Boot、MCUboot 原生签名或硬件防回滚。

管理员也可以用后台“打包并上传”在浏览器本地生成同一格式的清单和签名，设备协议没有变化。浏览器 Worker 使用 Web Crypto 的 RSA-PSS（SHA-256、MGF1-SHA256、saltLength=32），密码保护 PKCS#8 在本地解锁，实际加密运算由浏览器实现；服务器仍独立验证，不接收私钥与密码。参见 [Web Cryptography API](https://www.w3.org/TR/webcrypto-1/) 和 [PKCS#5 / PBES2](https://www.rfc-editor.org/rfc/rfc8018)。本地签名页面仍必须可信，不能替代完全离线签名的隔离保证。

## 3. 创建绑定升级尝试

```http
POST /api/v1/ota/attempts
Content-Type: application/json
```

```json
{
  "device_id": "DEVICE_ID",
  "protocol_version": 1,
  "target_id": "desktop-s3-n8r8-st7735s-v1",
  "layout_id": "ota-3m-v1",
  "bootloader_version": "0.1.0",
  "capabilities": ["staging", "app_confirm"],
  "release_id": "SERVER_RELEASE_ID",
  "request_id": "CLIENT_GENERATED_UUID"
}
```

`request_id` 为 8～64 个 ASCII 字母、数字、`_` 或 `-`，在设备上持久化。网络重试复用同一值，不能把同一值用于不同 release。成功返回数据库 attempt 对象，`id` 为后续的 attempt_id，初始 `state=created`。

创建必须对应当前活动发布和设备通道。已有请求的幂等重试返回原尝试。24 小时过期后重新检查并使用新的 request_id，不能无限重用过期尝试。

## 4. 下载

```http
GET /api/v1/ota/releases/RELEASE_ID/firmware?attempt_id=ATTEMPT_ID
Authorization: Bearer TOKEN
Range: bytes=0-65535
```

无 Range 返回 200 全文件，有合法 Range 返回 206（非法范围 416）。响应有 `X-Firmware-SHA256`，但客户端必须与**已验签清单**对照，不能仅信响应头。断点续传需要严格验证 Content-Range、偏移和最终完整摘要；本项目不声明“部分下载即可安装”。

下载 URL 不含密钥，不能交给不支持 Authorization 的旧客户端裸用。仅请求此下载 API 不改变安装状态。制品被替代或撤回不会改写原尝试的文件；凭据 / 签名公钥被吊销后拒绝继续访问。

## 5. 升级事件与成功定义

```http
POST /api/v1/ota/attempts/ATTEMPT_ID/events
Content-Type: application/json
```

```json
{"seq":1,"state":"downloading","progress":0,"error":""}
```

允许的状态转换：

```text
created → downloading → downloaded → validating → installing → pending_boot → confirmed
                          └→ transferring ─┘                           └→ rolled_back
```

`downloading` / `transferring` 可重复报告；任一未终结状态可转 `failed`；`rolled_back` 只能从 `pending_boot` 转入，且 Target 必须声明已实现 rollback。`confirmed`、`failed`、`rolled_back` 为终态，新的升级创建新 attempt。

`seq` 从 1 递增，上限 2147483647，同一 attempt 不重复使用不同内容。完全相同的序号 / 正文重试为幂等；迟到的较小序号记录但不倒退当前状态。为避免跳过必要状态，客户端应按顺序发送并确认后继续，离线时将事件队列持久化。进度 0～100 仅为 UI 提示，不代表真实安装证明；error 最多 300 字符，不含密码或 token。

目标应用重启、自检并确认可用后发送：

```json
{"seq":7,"state":"confirmed","progress":100,"error":"","version":"1.0.0","sha256":"EXACT_SIGNED_ARTIFACT_SHA256"}
```

示例中的 seq 必须按实际事件次数调整。`version` 与 `sha256` 必须同时匹配本次发布；文件传输完、网关回复“已发送”、TCP 断开、设备心跳都不能替代成功确认。服务器依赖持有设备 / 网关凭据的客户端诚实上报，不提供硬件远程证明。

## 6. 心跳

```http
POST /api/v1/devices/heartbeat
Content-Type: application/json
```

```json
{"device_id":"DEVICE_ID","version":"1.0.0","sha256":"INSTALLED_ARTIFACT_SHA256"}
```

建议 30～60 秒一次；最近 180 秒有心跳或成功启动确认、且凭据未停用的设备在后台计为在线。检查更新不自动等于心跳；联网网关要为每个真实子设备单独上报。每个 Agent 300 请求/分钟，多个子设备共用网关限额。

## 7. 接入你的板子

ESP32：保留 BOOT 短按切页、长按 OTA 的用户交互；将旧固定 URL 逻辑替换为此鉴权协议；在 OTA 槽完整写入前校验签名 / 元数据，完成流式摘要验证后才设置启动槽；新应用自检与本地有效标记完成后上报 confirmed。若启用自动回滚，需要匹配 bootloader 配置、分区和故障注入测试，不能只改服务器配置。

STM32：先确定精确型号、flash / RAM、应用链接地址、Bootloader、暂存区与断电恢复方案；再决定直连网络或经网关 UART/CAN/RS485。串口 / 485 模块只是传输通道，不会自动产生 Bootloader。确认原生签名 / 清单验证和新应用回执后才声明 staging / app_confirm / rollback。

首版没有时钟签名过期策略、签名发布元数据、设备单调安全计数器或自动密钥信任迁移。HTTPS 与外置制品签名已实现，但不要将其描述为完整 TUF / Uptane 系统。

## 格式参考

- [ESP-IDF OTA 文档](https://docs.espressif.com/projects/esp-idf/en/v5.4.4/esp32s3/api-reference/system/ota.html)
- [Espressif esptool 镜像工具](https://docs.espressif.com/projects/esptool/en/latest/esp32s3/esptool/basic-commands.html)
- [MCUboot imgtool](https://docs.mcuboot.com/imgtool.html)
- [SQLite 在线备份](https://www.sqlite.org/backup.html)
- [Caddy 自动 HTTPS](https://caddyserver.com/docs/automatic-https)
