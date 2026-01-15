"""
Intervention settings endpoints
"""
from fastapi import APIRouter, Depends
from app.core.auth import get_current_user
from app.services.session_service import session_service
from app.models.schemas import (
    InterventionSettingsResponse,
    UpdateInterventionSettingsRequest,
)

router = APIRouter(prefix="/intervention", tags=["intervention"])


@router.get("/settings", response_model=InterventionSettingsResponse)
async def get_intervention_settings(
    user: dict = Depends(get_current_user)
):
    """Get intervention settings"""
    settings = await session_service.get_intervention_settings(user["id"])
    return InterventionSettingsResponse(**settings)


@router.put("/settings")
async def update_intervention_settings(
    data: UpdateInterventionSettingsRequest,
    user: dict = Depends(get_current_user)
):
    """Update intervention settings"""
    result = await session_service.update_intervention_settings(
        user["id"],
        data.dict(exclude_unset=True)
    )
    return result
