"""
API v1 routers
"""
from fastapi import APIRouter
from app.api.v1 import auth, sessions, intervention, security, admin, cognito

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(cognito.router)
api_router.include_router(sessions.router)
api_router.include_router(intervention.router)
api_router.include_router(security.router)
api_router.include_router(admin.router)
