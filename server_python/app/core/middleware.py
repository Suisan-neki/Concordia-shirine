"""
Custom middleware for CSRF protection and request logging
"""
from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from app.core.config import settings


LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


class CSRFMiddleware(BaseHTTPMiddleware):
    """CSRF protection middleware"""
    
    async def dispatch(self, request: Request, call_next):
        """Check CSRF protection for state-changing requests"""
        method = request.method.upper()
        
        # Skip CSRF check for read-only methods
        if method in ("GET", "HEAD", "OPTIONS"):
            return await call_next(request)
        
        origin = request.headers.get("origin")
        if not origin:
            # Same-origin request, allow
            return await call_next(request)
        
        try:
            from urllib.parse import urlparse
            origin_url = urlparse(origin)
            allowed_origins = set(settings.allowed_origins_list)

            # Development fallback: allow all when no explicit origins configured
            if not settings.is_production and not allowed_origins:
                return await call_next(request)
            
            # Check if origin is allowed
            if origin in allowed_origins:
                return await call_next(request)
            
            # Check if same hostname
            if origin_url.hostname == request.url.hostname:
                return await call_next(request)
            
            # Allow localhost to localhost communication
            if origin_url.hostname in LOCAL_HOSTS and request.url.hostname in LOCAL_HOSTS:
                return await call_next(request)
        except Exception:
            # URL parse failed, deny
            pass
        
        # CSRF check failed
        return Response(
            content='{"error": "CSRF check failed"}',
            status_code=status.HTTP_403_FORBIDDEN,
            media_type="application/json"
        )


def setup_middleware(app: ASGIApp) -> None:
    """Setup custom middleware"""
    app.add_middleware(CSRFMiddleware)
