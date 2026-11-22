from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import ROLES, create_token, current_user, user_payload, verify_password
from ..database import get_db
from ..models import User

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalars(select(User).where(func.lower(User.username) == body.username.strip().lower())).first()
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
    return {"token": create_token(user), "user": user_payload(user)}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return user_payload(user)


@router.get("/roles")
def roles():
    """Public: role names and what each can see (shown on the login screen)."""
    return [{"role": k, "label": v["label"], "description": v["description"]} for k, v in ROLES.items()]
