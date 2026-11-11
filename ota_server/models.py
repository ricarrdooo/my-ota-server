import re
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from .adapters import ADAPTERS

Identifier = Annotated[str, Field(pattern=r"^[a-z0-9][a-z0-9_-]{1,63}$")]
Version = Annotated[str, Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9_.+-]{0,63}$")]
Digest = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
CAPABILITIES = {"staging", "app_confirm", "rollback", "gateway_transport"}


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


def version_tuple(value):
    if not re.fullmatch(r"\d{1,5}\.\d{1,5}\.\d{1,5}", value):
        raise ValueError("Bootloader 版本需为数字 x.y.z")
    return tuple(map(int, value.split(".")))


class ProductInput(Model):
    id: Identifier
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=500)


class NameUpdate(Model):
    name: str = Field(min_length=1, max_length=80)


class ProductUpdate(NameUpdate):
    description: str = Field(default="", max_length=500)


class TargetUpdate(Model):
    name: str = Field(min_length=1, max_length=100)


class KeyInput(Model):
    product_id: Identifier
    name: str = Field(min_length=1, max_length=80)
    pem: str = Field(min_length=80, max_length=8192)


class TargetInput(Model):
    id: Identifier
    product_id: Identifier
    name: str = Field(min_length=1, max_length=100)
    adapter: str
    mcu: str = Field(min_length=1, max_length=64)
    hw_revision: Version
    layout_id: Identifier
    max_size: int = Field(ge=256, le=128 * 1024 * 1024)
    key_id: Digest
    min_bootloader: str = "0.1.0"
    capabilities: list[str] = Field(default_factory=lambda: ["staging", "app_confirm"], max_length=4)
    config: dict = Field(default_factory=dict)

    @field_validator("min_bootloader")
    @classmethod
    def bootloader(cls, value):
        version_tuple(value)
        return value

    @model_validator(mode="after")
    def supported(self):
        if self.adapter not in ADAPTERS:
            raise ValueError("尚未实现该镜像适配器")
        if (len(set(self.capabilities)) != len(self.capabilities)
                or not set(self.capabilities) <= CAPABILITIES
                or not {"staging", "app_confirm"} <= set(self.capabilities)):
            raise ValueError("首版目标需要 staging 和 app_confirm；能力不能重复或未知")
        required = {"esp-idf-app": {"chip_id", "project_name"},
                    "mcuboot-image": {"header_size"},
                    "raw-cortexm": {"app_address", "ram_start", "ram_size"}}[self.adapter]
        optional = {"mcuboot-image": {"load_address"}}.get(self.adapter, set())
        if not required <= self.config.keys() or self.config.keys() - required - optional:
            raise ValueError("镜像适配器配置字段不完整或有未知字段")
        for name, value in self.config.items():
            if name == "project_name":
                if not isinstance(value, str) or not re.fullmatch(r"[\w.-]{1,31}", value, re.ASCII):
                    raise ValueError("ESP 项目名称不正确")
            elif type(value) is not int or not 0 <= value <= 0xFFFFFFFF:
                raise ValueError("地址和长度必须是有效的非负整数")
        if self.adapter == "esp-idf-app" and self.config["chip_id"] > 65535:
            raise ValueError("ESP chip_id 越界")
        if self.adapter == "mcuboot-image" and not 32 <= self.config["header_size"] <= 4096:
            raise ValueError("MCUboot header_size 需为 32～4096")
        if self.adapter == "raw-cortexm":
            if (self.config["ram_size"] == 0 or self.config["app_address"] % 4
                    or self.config["app_address"] + self.max_size > 2**32
                    or self.config["ram_start"] + self.config["ram_size"] > 2**32):
                raise ValueError("Cortex-M 地址或长度不正确")
        return self


class DeviceInput(Model):
    name: str = Field(min_length=1, max_length=80)
    target_id: Identifier
    channel: Literal["stable", "beta"] = "stable"
    gateway_id: str | None = None


class GatewayInput(Model):
    name: str = Field(min_length=1, max_length=80)


class ChannelInput(Model):
    channel: Literal["stable", "beta"]


class ReleaseInput(ChannelInput):
    artifact_id: str = Field(min_length=10, max_length=40)
    notes: str | None = Field(default=None, max_length=2000)


class ReleaseUpdate(Model):
    notes: str = Field(max_length=2000)


class ArtifactDeleteInput(Model):
    preview_token: Digest


class Manifest(Model):
    schema_version: Literal[1]
    product_id: Identifier
    target_id: Identifier
    target_fingerprint: Digest
    component: Literal["app"]
    mcu: str = Field(min_length=1, max_length=64)
    hw_revision: Version
    layout_id: Identifier
    image_format: str
    version: Version
    size: int = Field(ge=8, le=128 * 1024 * 1024)
    sha256: Digest
    key_id: Digest
    signature_algorithm: Literal["rsa-pss-sha256"]
    min_bootloader_version: str
    required_capabilities: list[str] = Field(max_length=4)


class Compatibility(Model):
    device_id: str = Field(min_length=10, max_length=40)
    protocol_version: Literal[1] = 1
    target_id: Identifier
    layout_id: Identifier
    bootloader_version: str
    capabilities: list[str] = Field(max_length=4)

    @field_validator("bootloader_version")
    @classmethod
    def bootloader(cls, value):
        version_tuple(value)
        return value


class AttemptInput(Compatibility):
    release_id: str = Field(min_length=10, max_length=40)
    request_id: str = Field(pattern=r"^[A-Za-z0-9_-]{8,64}$")
    command_id: str | None = Field(default=None, pattern=r"^[0-9a-f]{32}$")


class Heartbeat(Model):
    device_id: str = Field(min_length=10, max_length=40)
    version: Version
    sha256: Digest
    remote_commands_version: Literal[0, 1] = 0


class UpgradeFailure(Model):
    device_id: str = Field(min_length=10, max_length=40)
    report_id: str = Field(pattern=r"^[0-9a-f]{32}$")
    stage: str = Field(pattern=r"^[a-z][a-z ]{0,39}$")
    error_code: str = Field(pattern=r"^[A-Za-z0-9_:()-]{1,48}$")
    http_status: int = Field(ge=0, le=599)
    progress: int = Field(ge=0, le=100)
    occurred: int = Field(ge=0, le=4102444800)


class CommandInput(Model):
    kind: Literal["ota.install", "device.restart"]
    request_id: str = Field(pattern=r"^[0-9a-f]{32}$")
    ttl_seconds: int = Field(default=900, ge=60, le=86400)
    expected_release_id: str | None = Field(default=None, pattern=r"^[0-9a-f]{32}$")
    expected_sha256: Digest | None = None

    @model_validator(mode="after")
    def expected_target(self):
        if (self.expected_release_id is None) != (self.expected_sha256 is None):
            raise ValueError("确认的发布与摘要必须一起提供")
        if self.kind != "ota.install" and self.expected_release_id is not None:
            raise ValueError("重启指令不能指定升级目标")
        return self


class CommandClaim(Model):
    device_id: str = Field(min_length=10, max_length=40)
    boot_id: str = Field(pattern=r"^[0-9a-f]{32}$")
    remote_commands_version: Literal[1]


class CommandEvent(Model):
    device_id: str = Field(min_length=10, max_length=40)
    boot_id: str = Field(pattern=r"^[0-9a-f]{32}$")
    status: Literal["executing", "succeeded", "failed"]
    error: str = Field(default="", max_length=300)
    attempt_id: str | None = Field(default=None, pattern=r"^[0-9a-f]{32}$")
    sha256: Digest | None = None


class EventInput(Model):
    seq: int = Field(ge=1, le=2147483647)
    state: Literal["downloading", "downloaded", "transferring", "validating", "installing", "pending_boot", "confirmed", "failed", "rolled_back"]
    progress: int = Field(default=0, ge=0, le=100)
    error: str = Field(default="", max_length=300)
    version: Version | None = None
    sha256: Digest | None = None
