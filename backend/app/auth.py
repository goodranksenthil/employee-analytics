"""Authentication (PBKDF2 password hashes + signed JWT) and role-based permissions."""
import hashlib
import hmac
import logging
import os
import secrets
import time
from typing import Any, Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import User

log = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY") or ""
if not SECRET_KEY:
    SECRET_KEY = "dev-only-insecure-secret-change-me"
    log.warning("SECRET_KEY is not set; using an insecure development key")
TOKEN_TTL_SECONDS = 8 * 3600
PBKDF2_ITERATIONS = 200_000

# ---------- roles & permissions ----------
# money:view  — bill rates, billing and revenue figures anywhere in the API
ROLES: dict = {
    "employee": {
        "label": "Employee",
        "description": "Own profile: skills, project assignments and best-fit projects",
        "home": "/me",
        "permissions": {"self:view"},
    },
    "delivery_manager": {
        "label": "Delivery Manager",
        "description": "Projects, pipeline, resources, bench, allocation, skill matching and hiring needs",
        "home": "/",
        "permissions": {
            "dashboard:view", "projects:view", "projects:manage", "pipeline:view",
            "resources:view", "bench:view", "matching:use", "hiring:view", "money:view",
        },
    },
    "finance": {
        "label": "Finance",
        "description": "Billing, rate card, project revenue and pipeline value",
        "home": "/billing",
        "permissions": {
            "dashboard:view", "projects:view", "pipeline:view",
            "billing:view", "billing:edit", "money:view",
        },
    },
    "hr": {
        "label": "HR",
        "description": "Employees, skills, bench, skill matching and hiring needs (no billing figures)",
        "home": "/resources",
        "permissions": {
            "dashboard:view", "resources:view", "bench:view", "matching:use", "hiring:view",
        },
    },
}


def permissions_of(user: User) -> set:
    return ROLES.get(user.role, {}).get("permissions", set())


def user_payload(user: User) -> dict:
    role = ROLES.get(user.role, {})
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "role_label": role.get("label", user.role),
        "employee_id": user.employee_id,
        "home": role.get("home", "/"),
        "permissions": sorted(permissions_of(user)),
    }


# ---------- passwords ----------

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt_hex, digest_hex = stored.split("$")
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations))
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


# ---------- tokens ----------

def create_token(user: User) -> str:
    now = int(time.time())
    return jwt.encode(
        {"sub": str(user.id), "role": user.role, "iat": now, "exp": now + TOKEN_TTL_SECONDS},
        SECRET_KEY,
        algorithm="HS256",
    )


_bearer = HTTPBearer(auto_error=False)


def current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED, "Not signed in or session expired", headers={"WWW-Authenticate": "Bearer"}
    )
    if creds is None:
        raise unauthorized
    try:
        claims = jwt.decode(creds.credentials, SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise unauthorized
    user = db.get(User, int(claims.get("sub", 0)))
    if not user or not user.is_active:
        raise unauthorized
    return user


def require(*perms: str):
    """Dependency: the signed-in user must hold at least one of `perms`."""

    def dep(user: User = Depends(current_user)) -> User:
        if not permissions_of(user) & set(perms):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role does not have access to this")
        return user

    return dep


# ---------- field-level: hide money from roles without money:view ----------

MONEY_KEYS = {
    "hourly_rate", "monthly_billing", "bill_rate", "rate", "billing", "monthly_revenue",
    "monthly_full_time", "est_rate", "contract_value", "weighted_value", "blended_rate",
    "avg_hourly_rate", "revenue",
}


def scrub(data: Any, user: User) -> Any:
    if "money:view" in permissions_of(user):
        return data
    if isinstance(data, dict):
        return {k: scrub(v, user) for k, v in data.items() if k not in MONEY_KEYS}
    if isinstance(data, list):
        return [scrub(v, user) for v in data]
    return data
