"""
Authentication endpoints
"""
from fastapi import APIRouter, Depends, Response, Request
from app.core.auth import get_current_user_optional, get_current_user
from app.core.session import COOKIE_NAME
from typing import Optional
from app.models.schemas import UserResponse
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=Optional[UserResponse])
async def get_current_user_info(
    user: dict = Depends(get_current_user_optional)
):
    """Get current user information"""
    if not user:
        return None
    return UserResponse(**user)


@router.post("/logout")
async def logout(response: Response):
    """Logout (clear session cookie)"""
    response.delete_cookie(
        COOKIE_NAME,
        path="/",
        httponly=True,
        secure=settings.is_production,
        samesite=settings.cookie_same_site
    )
    return {"success": True}
