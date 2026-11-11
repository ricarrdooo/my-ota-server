# 设备远程命令 v1

支持网页触发 OTA 安装与设备重启。命令由设备主动领取；发布固件本身仍不会立即命令设备下载。
ESP32 实现见相邻 `00_BASIC` 工程的 V1.0.7 及 `docs/REMOTE_COMMANDS.md`。
其他 MCU/网关可按同一协议实现，只有声明 `remote_commands_version=1` 的设备才开放网页控制。

## 查看升级进度和失败原因

在「设备 → 控制记录」内选一条升级指令，或在「升级记录」点「查看升级时间线」。两个入口通过升级尝试 ID 关联同一次操作。时间为后台接收时间，设备离线时积压的几个事件可能在同一秒出现。

V1.0.9 的 ESP32 会在下载期间尝试上报进度。若故障发生在创建升级记录之前，可先在设备本地设置页查看最近一次失败。相同设备标识恢复访问权限后，会向支持此功能的后台补报，显示在设备控制窗口。每台设备保留一条最近失败摘要。

## 管理员接口

- `GET /api/admin/devices/{device_id}/commands`：返回 `commands` 和当前 `available_release`。
- `POST /api/admin/devices/{device_id}/commands`：需要管理员会话、来源/CSRF 验证。
  请求包含 `kind`（`ota.install` 或 `device.restart`）、`request_id`（32 位小写十六进制）和 `ttl_seconds`（60–86400，默认 900）。
  升级可成对提交 `expected_release_id` 和 `expected_sha256`，网页用它们防止确认期间发布变化。

同一设备、同一 request_id、同一参数重试返回原记录；参数变化返回 409。
同一设备最多一条排队/领取/执行中的指令，有未结束升级尝试时也不能并发下发。
指令绑定创建时的发布 ID 和制品摘要，排队/执行期间保护相应固件文件不被删除。

## 设备领取

`POST /api/v1/devices/commands/claim`，使用设备原 Bearer 访问密钥：

```json
{"device_id":"设备标识","boot_id":"32位小写hex启动标识","remote_commands_version":1}
```

没有待处理指令时返回 `{"command":null}`；否则返回：

```json
{"command":{"id":"32位小写hex指令标识","kind":"ota.install","status":"claimed","expires_at":1893456000,"release_id":"发布标识","sha256":"完整文件64位hex摘要"}}
```

`created_at`、`expires_at` 等时间为 Unix 秒。租约 120 秒，租约丢失后可重领同一 ID。
领取前检查发布是否仍匹配且文件可用，变化时失败，不替换为另一个固件。
只有尚未执行的指令受有效期约束，执行中的升级不会因到期自动中止。

## 执行与回报

设备先持久保存指令，再请求：

`POST /api/v1/devices/commands/{command_id}/events`

```json
{"device_id":"设备标识","boot_id":"32位小写hex启动标识","status":"executing","error":""}
```

只有 `{"ok":true,"status":"executing"}` 才允许执行。过期等终态也返回 HTTP 200，设备须检查 status。
执行边界必须落盘后再动作，重复领取不得重放不可逆动作。执行中重领与原 boot_id 冲突时不能重新执行。

终态使用 `succeeded` 或 `failed`。失败可附 `error`，升级可附 `attempt_id` 和 `sha256`。
重启成功须用与执行时不同的 boot_id 回报，不能在重启前确认成功。
升级尝试请求增加可选 `command_id`，必须属于此设备、此升级指令并匹配 release_id 和摘要。
已关联尝试的升级成功由 `confirmed` 事件确认；失败/回滚事件同步命令失败。
已经安装目标文件、未创建新尝试时，可以用匹配摘要幂等回报成功。
终态重报只返回原结果，不改变成功/失败，也不会重新打开执行。

## 部署与验证

更新代码并重启后台后，现有数据目录增量增加命令相关表，不需要重建产品、设备、目标或签名公钥。
旧固件仍可走原 OTA 接口；心跳省略能力版本时视为不支持，网页禁用对应设备的远程控制入口。
现有 LAN 调试设备接口同样提供命令路由，管理员接口仍遵守原监听及鉴权限制。

测试：`tests/test_remote_commands.py`、`scripts/remote_commands_qa.mjs`，以及扩展的 `scripts/browser_qa.mjs`。
测试使用隔离数据库、临时设备和测试凭据，不操作实际设备或运行中的服务。
运行日志、内存/任务/变量遥测、公网参数下发、崩溃上传分析不属于本阶段。
