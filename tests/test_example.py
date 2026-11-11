import json

import pytest

from examples.check_update import NoRedirect, validate_offer


def test_read_only_example_verifies_offer_and_target(h):
    device = h.make_device()
    h.publish()
    exported = h.client.get("/api/admin/targets/" + h.target["id"] + "/profile").json()
    offer = h.check(device).json()
    assert validate_offer(offer, exported, "0.1.0")["version"] == "1.0.0"
    changed = json.loads(json.dumps(offer))
    changed["manifest"]["version"] = "evil"
    with pytest.raises(ValueError):
        validate_offer(changed, exported, "0.1.0")
    changed = json.loads(json.dumps(exported))
    changed["target"]["mcu"] = "another-chip"
    with pytest.raises(ValueError):
        validate_offer(offer, changed, "0.1.0")
    with pytest.raises(ValueError):
        validate_offer(offer, exported, "0.0.1")
    assert validate_offer({"schema_version": 1, "update_available": False}, exported, "0.1.0") is None
    assert not h.db.rows("SELECT * FROM attempts")  # Inspection never creates an installation.


def test_example_never_follows_redirects_with_device_credentials():
    assert NoRedirect().redirect_request(None, None, 302, "redirect", {}, "https://another.example") is None
