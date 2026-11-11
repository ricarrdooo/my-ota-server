"""Pin the chosen update identity policy: full installed artifact SHA-256."""
import hashlib

import pytest

from conftest import raw_fixture


def report_installed(h, device, version, data):
    digest = hashlib.sha256(data).hexdigest()
    response = h.client.post("/api/v1/devices/heartbeat", headers=h.auth(device),
        json={"device_id": device["id"], "version": version, "sha256": digest})
    assert response.status_code == 200
    return digest


def test_same_version_different_bytes_offer_update(h):
    device, original = h.make_device(), raw_fixture()
    h.publish(data=original, version="1.0.0")
    installed = report_installed(h, device, "1.0.0", original)
    changed = original[:-1] + b"\x01"  # Same length and version; valid vectors unchanged.
    replacement = h.publish(data=changed, version="1.0.0")
    result = h.check(device, current_sha256=installed)
    assert result.status_code == 200
    offer = result.json()
    assert offer["update_available"] and offer["release_id"] == replacement["id"]
    assert offer["manifest"]["version"] == "1.0.0"
    assert offer["manifest"]["sha256"] == hashlib.sha256(changed).hexdigest() != installed
    assert not h.db.rows("SELECT * FROM attempts")  # Available is not automatic installation.


def test_same_bytes_different_display_version_do_not_update(h):
    # raw-cortexm allows a display-version change without changing bin bytes;
    # ESP / MCUboot versions embedded in the binary cannot be renamed this way.
    device, data = h.make_device(), raw_fixture()
    h.publish(data=data, version="1.0.0")
    installed = report_installed(h, device, "1.0.0", data)
    h.publish(data=data, version="2.0.0")
    response = h.check(device, current_sha256=installed)
    assert response.status_code == 200
    assert response.json() == {"schema_version": 1, "update_available": False, "reason": "up_to_date"}


def test_missing_digest_does_not_fall_back_to_cached_version_or_heartbeat(h):
    device, data = h.make_device(), raw_fixture()
    release = h.publish(data=data, version="1.0.0")
    installed = report_installed(h, device, "1.0.0", data)
    # A stale server record is not evidence of the currently running artifact.
    unknown = h.check(device)
    assert unknown.status_code == 200 and unknown.json()["update_available"]
    assert unknown.json()["release_id"] == release["id"]
    assert not h.check(device, current_sha256=installed).json()["update_available"]


def test_explicit_republish_of_old_bytes_is_not_a_version_sort(h):
    device, installed_data = h.make_device(), raw_fixture(512)
    h.publish(data=installed_data, version="2.0.0")
    installed = report_installed(h, device, "2.0.0", installed_data)
    previous = h.publish(data=raw_fixture(), version="1.0.0")
    offer = h.check(device, current_sha256=installed).json()
    assert offer["update_available"] and offer["release_id"] == previous["id"]
    assert offer["manifest"]["version"] == "1.0.0"


@pytest.mark.parametrize("digest", ["", "a" * 63, "a" * 65, "g" * 64, "A" * 64, "a" * 64 + "\n"])
def test_invalid_installed_digest_is_rejected_not_silently_treated_as_update(h, digest):
    device = h.make_device()
    h.publish()
    response = h.check(device, current_sha256=digest)
    assert response.status_code == 422
    assert "current_sha256" in response.json()["error"]
