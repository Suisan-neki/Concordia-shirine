"""
Security statistics endpoints
"""
from fastapi import APIRouter, Depends, Query
from app.core.auth import get_current_user
from app.core.security import security_service
from app.models.schemas import SecurityStatsResponse, SecuritySummaryResponse

router = APIRouter(prefix="/security", tags=["security"])


@router.get("/stats", response_model=SecurityStatsResponse)
async def get_security_stats(
    user: dict = Depends(get_current_user)
):
    """Get user security statistics"""
    stats = await security_service.get_user_security_stats(user["id"])
    return SecurityStatsResponse(**stats)


@router.get("/summary/{session_id}", response_model=SecuritySummaryResponse)
async def get_security_summary(
    session_id: str,
    user: dict = Depends(get_current_user)
):
    """Get security summary for a session"""
    summary = await security_service.generate_security_summary(session_id)
    return SecuritySummaryResponse(**summary)
