"""
Authentication and authorization middleware
"""
from typing import Optional
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import settings
from app.core.cognito import authenticate_request as cognito_authenticate_request
from app.core.database import get_user_by_open_id
from app.core.session import get_session_from_cookie, verify_session_token


# Cookie name for session
COOKIE_NAME = "app_session_id"

# HTTP Bearer security scheme
security = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[dict]:
    """
    Get current user (optional authentication)
    Returns None if not authenticated
    """
    # Try Cognito Bearer token first
    if credentials:
        try:
            # Create a mock request with Authorization header for cognito auth
            class MockRequest:
                def __init__(self, token: str):
                    self.headers = {"authorization": f"Bearer {token}"}
            
            mock_req = MockRequest(credentials.credentials)
            return await cognito_authenticate_request(mock_req)
        except HTTPException:
            pass
    
    # Try session cookie
    session_token = get_session_from_cookie(request)
    if session_token:
        try:
            user = await verify_session_token(session_token)
            if user:
                return user
        except Exception:
            pass
    
    return None


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> dict:
    """
    Get current user (required authentication)
    Raises HTTPException if not authenticated
    """
    user = await get_current_user_optional(request, credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please login (10001)"
        )
    return user


async def get_current_admin_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> dict:
    """
    Get current admin user (required admin role)
    Raises HTTPException if not authenticated or not admin
    """
    user = await get_current_user(request, credentials)
    
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have required permission (10002)"
        )
    
    return user
