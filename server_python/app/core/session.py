"""
Session management for cookie-based authentication
"""
from typing import Optional
from fastapi import Request
from jose import jwt, JWTError
from app.core.config import settings
from app.core.database import get_user_by_open_id


COOKIE_NAME = "app_session_id"


def get_session_from_cookie(request: Request) -> Optional[str]:
    """Extract session token from cookie"""
    cookies = request.cookies
    return cookies.get(COOKIE_NAME)


async def verify_session_token(token: str) -> Optional[dict]:
    """Verify session JWT token and return user"""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"]
        )
        
        open_id = payload.get("openId")
        if not open_id:
            return None
        
        from app.core.database import get_user_by_open_id
        user = await get_user_by_open_id(open_id)
        return user
    except JWTError:
        return None
    except Exception:
        return None
