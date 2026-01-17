"""
AWS Cognito authentication
"""
import json
from typing import Optional
from fastapi import Request, HTTPException, status
from jose import jwt, jwk
from jose.exceptions import JWTError, ExpiredSignatureError
import httpx
from app.core.config import settings
from app.core.database import get_user_by_open_id, upsert_user


def get_bearer_token(request: Request) -> Optional[str]:
    """Extract Bearer token from Authorization header"""
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth_header:
        return None
    
    parts = auth_header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    
    return parts[1]


async def get_jwks() -> dict:
    """Get JWKS from Cognito"""
    jwks_url = settings.cognito_jwks_url_final
    if not jwks_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cognito JWKS URL is not configured"
        )
    
    async with httpx.AsyncClient() as client:
        response = await client.get(jwks_url)
        response.raise_for_status()
        return response.json()


async def verify_cognito_token(token: str, access_token: Optional[str] = None) -> dict:
    """Verify Cognito JWT token"""
    if not settings.cognito_client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cognito client ID is not configured"
        )
    
    issuer = settings.cognito_issuer
    if not issuer:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cognito issuer is not configured"
        )
    
    # Get JWKS
    jwks_data = await get_jwks()
    
    # Decode token header to get key ID
    try:
        unverified_header = jwt.get_unverified_header(token)
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token header"
        )
    kid = unverified_header.get("kid")
    
    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing key ID"
        )
    
    # Find the key in JWKS
    key = None
    for jwk_key in jwks_data.get("keys", []):
        if jwk_key.get("kid") == kid:
            key = jwk_key
            break
    
    if not key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Key not found in JWKS"
        )
    
    # Construct the public key
    public_key = jwk.construct(key)
    
    # Verify and decode the token
    try:
        options = {"verify_at_hash": bool(access_token)}
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=settings.cognito_client_id,
            issuer=issuer,
            options=options,
            access_token=access_token,
        )
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}"
        )
    
    # Check token type (only ID tokens are allowed)
    if payload.get("token_use") and payload.get("token_use") != "id":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type"
        )
    
    return payload


async def authenticate_request(
    request,
    update_user: bool = False,
    access_token: Optional[str] = None
):
    """Authenticate request using Cognito Bearer token"""
    # Support both Request object and dict with headers
    if hasattr(request, 'headers'):
        token = get_bearer_token(request)
    elif isinstance(request, dict) and 'headers' in request:
        # Mock request object
        class MockRequest:
            def __init__(self, headers):
                self.headers = headers
        mock_req = MockRequest(request['headers'])
        token = get_bearer_token(mock_req)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request object"
        )
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing Authorization token"
        )
    
    # Verify token
    payload = await verify_cognito_token(token, access_token=access_token)
    
    # Extract user information
    open_id = payload.get("sub")
    if not open_id or not isinstance(open_id, str):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid token payload"
        )
    
    # Extract name (priority: name > given_name + family_name > cognito:username)
    name = None
    if payload.get("name") and isinstance(payload.get("name"), str):
        name = payload["name"]
    elif payload.get("given_name") or payload.get("family_name"):
        given_name = payload.get("given_name", "") or ""
        family_name = payload.get("family_name", "") or ""
        name = f"{given_name} {family_name}".strip() or None
    elif payload.get("cognito:username"):
        name = payload["cognito:username"]
    
    email = payload.get("email")
    if email and not isinstance(email, str):
        email = None
    
    # Get or create user
    user = await get_user_by_open_id(open_id)
    if not user:
        # Create new user
        await upsert_user({
            "openId": open_id,
            "name": name,
            "email": email,
            "loginMethod": "cognito",
        })
        user = await get_user_by_open_id(open_id)
    elif update_user and not user.get("deletedAt"):
        # Update existing user
        await upsert_user({
            "openId": open_id,
            "name": name or user.get("name"),
            "email": email or user.get("email"),
            "loginMethod": user.get("loginMethod") or "cognito",
        })
        user = await get_user_by_open_id(open_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User not found"
        )
    
    return user
