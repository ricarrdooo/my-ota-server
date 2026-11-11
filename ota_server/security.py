import base64
from collections import OrderedDict
import hashlib
import json
import secrets
import threading
import time

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

PASSWORDS = PasswordHasher()
SIGNATURE_ALGORITHM = "rsa-pss-sha256"


def opaque_token():
    return secrets.token_urlsafe(32)


def token_digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False).encode("ascii")


def load_json(raw):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("JSON 有重复字段")
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=unique,
                      parse_constant=lambda _value: (_ for _ in ()).throw(ValueError("JSON 不能含 NaN/Infinity")))


def password_valid(encoded, password):
    try:
        return PASSWORDS.verify(encoded, password)
    except (VerificationError, InvalidHashError):
        return False


def public_key(pem):
    if len(pem) > 8192:
        raise ValueError("公钥过长")
    key = serialization.load_pem_public_key(pem.encode("ascii"))
    if not isinstance(key, rsa.RSAPublicKey) or key.key_size not in (3072, 4096):
        raise ValueError("首版签名公钥需为 RSA-3072 或 RSA-4096")
    return key


def key_fingerprint(key):
    return hashlib.sha256(key.public_bytes(serialization.Encoding.DER,
                                         serialization.PublicFormat.SubjectPublicKeyInfo)).hexdigest()


def verify_manifest(manifest, signature, pem):
    try:
        binary = base64.b64decode(signature, validate=True)
        public_key(pem).verify(binary, canonical(manifest),
                               padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=32), hashes.SHA256())
    except (InvalidSignature, ValueError, TypeError, UnicodeError) as exc:
        raise ValueError("固件清单签名验证失败") from exc


class RateLimiter:
    """Bounded process-local limits. Production runs one application worker."""
    def __init__(self):
        self.lock = threading.Lock()
        self.entries = OrderedDict()

    def allow(self, key, limit, seconds):
        now = time.monotonic()
        with self.lock:
            count, until = self.entries.pop(key, (0, now + seconds))
            if now >= until:
                count, until = 0, now + seconds
            self.entries[key] = (count + 1, until)
            while len(self.entries) > 4096:
                self.entries.popitem(last=False)
            return count < limit
