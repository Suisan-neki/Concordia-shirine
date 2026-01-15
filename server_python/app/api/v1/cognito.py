"""
Cognito OAuth callback endpoint
"""
import base64
import json
import secrets
import hmac
from typing import Optional
from fastapi import APIRouter, Request, Response, Query, HTTPException, status
from fastapi.responses import RedirectResponse
import httpx
from app.core.config import settings
from app.core.cognito import authenticate_request
from app.core.database import get_user_by_open_id
from app.core.session import verify_session_token, COOKIE_NAME
from jose import jwt
from datetime import datetime, timedelta

router = APIRouter(prefix="/auth/cognito", tags=["auth"])

NONCE_COOKIE_NAME = "cognito_auth_nonce"
SESSION_EXPIRY_MS = 1000 * 60 * 60 * 24 * 7  # 7 days


def safe_compare(a: str, b: str) -> bool:
    """Timing-safe string comparison"""
    if len(a) != len(b):
        return False
    return hmac.compare_digest(a.encode(), b.encode())


def get_token_endpoint() -> str:
    """Get Cognito token endpoint URL"""
    if not settings.cognito_domain:
        raise ValueError("Cognito domain is missing")
    
    domain = settings.cognito_domain
    if not domain.startswith("http"):
        domain = f"https://{domain}"
    
    return f"{domain}/oauth2/token"


async def exchange_code_for_token(code: str, redirect_uri: str) -> dict:
    """Exchange authorization code for token"""
    token_endpoint = get_token_endpoint()
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            token_endpoint,
            data={
                "grant_type": "authorization_code",
                "client_id": settings.cognito_client_id,
                "code": code,
                "redirect_uri": redirect_uri,
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
            }
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Token exchange failed: {response.text}"
            )
        
        data = response.json()
        return {
            "idToken": data.get("id_token"),
            "accessToken": data.get("access_token"),
        }


def create_session_token(open_id: str, name: str) -> str:
    """Create session JWT token"""
    now = datetime.now()
    expiry = now + timedelta(milliseconds=SESSION_EXPIRY_MS)
    
    payload = {
        "openId": open_id,
        "appId": settings.vite_app_id,
        "name": name,
        "exp": int(expiry.timestamp()),
        "iat": int(now.timestamp()),
    }
    
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def is_secure_request(request: Request) -> bool:
    """Check if request is secure (HTTPS)"""
    if request.url.scheme == "https":
        return True
    
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    return "https" in forwarded_proto.lower().split(",")


@router.get("/callback")
async def cognito_callback(
    request: Request,
    response: Response,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
):
    """Handle Cognito OAuth callback"""
    # Check for error
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cognito authentication failed: {error}"
        )
    
    # Check required parameters
    if not code or not state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="code and state are required"
        )
    
    try:
        # Decode state
        try:
            decoded = base64.urlsafe_b64decode(state + "==").decode("utf-8")
            parsed = json.loads(decoded)
            redirect_path = parsed.get("redirectPath", "/")
            state_nonce = parsed.get("nonce")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid state parameter"
            )
        
        # Verify nonce
        if not state_nonce:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nonce validation failed: nonce not found in state"
            )
        
        # Get stored nonce from cookie
        stored_nonce = request.cookies.get(NONCE_COOKIE_NAME)
        if not stored_nonce:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nonce validation failed: nonce cookie not found"
            )
        
        # Compare nonces (timing-safe)
        if not safe_compare(stored_nonce, state_nonce):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nonce validation failed: nonce mismatch"
            )
        
        # Clear nonce cookie
        response.delete_cookie(NONCE_COOKIE_NAME)
        
        # Get redirect URI
        redirect_uri = f"{request.url.scheme}://{request.url.netloc}/api/v1/auth/cognito/callback"
        
        # Exchange code for token
        tokens = await exchange_code_for_token(code, redirect_uri)
        id_token = tokens["idToken"]
        
        # Authenticate user
        class MockRequest:
            def __init__(self, token: str):
                self.headers = {"authorization": f"Bearer {token}"}
        
        mock_req = MockRequest(id_token)
        user = await authenticate_request(mock_req, update_user=True)
        
        # Create session token
        session_name = user.get("name") or user.get("email") or user.get("openId")
        session_token = create_session_token(user["openId"], session_name)
        
        # Set session cookie
        is_secure = is_secure_request(request)
        same_site = settings.cookie_same_site
        if same_site == "none" and not is_secure:
            same_site = "lax"
        
        response.set_cookie(
            COOKIE_NAME,
            session_token,
            max_age=SESSION_EXPIRY_MS // 1000,
            path="/",
            httponly=True,
            secure=is_secure,
            samesite=same_site
        )
        
        # Redirect to frontend
        return RedirectResponse(url=redirect_path)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication failed: {str(e)}"
        )
