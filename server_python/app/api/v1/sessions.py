"""
Session management endpoints
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.core.auth import get_current_user
from app.services.session_service import session_service
from app.models.schemas import (
    StartSessionResponse,
    EndSessionRequest,
    EndSessionResponse,
    SessionResponse,
    AddLogEntryRequest,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/start", response_model=StartSessionResponse)
async def start_session(
    user: dict = Depends(get_current_user)
):
    """Start a new session"""
    result = await session_service.start_session(user["id"])
    return StartSessionResponse(**result)


@router.post("/{session_id}/end", response_model=EndSessionResponse)
async def end_session(
    session_id: str,
    data: EndSessionRequest,
    user: dict = Depends(get_current_user)
):
    """End a session"""
    if data.sessionId != session_id:
        raise ValueError("Session ID mismatch")
    
    result = await session_service.end_session(
        user["id"],
        session_id,
        data.dict()
    )
    return EndSessionResponse(**result)


@router.get("", response_model=list[SessionResponse])
async def list_sessions(
    limit: int = Query(50, ge=1, le=100),
    user: dict = Depends(get_current_user)
):
    """List user sessions"""
    sessions = await session_service.list_user_sessions(user["id"], limit)
    return [SessionResponse(**s) for s in sessions]


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    user: dict = Depends(get_current_user)
):
    """Get session details"""
    session = await session_service.get_session_with_details(
        user["id"],
        session_id
    )
    if not session:
        raise ValueError("Session not found or access denied")
    return SessionResponse(**session)


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    user: dict = Depends(get_current_user)
):
    """Delete a session"""
    result = await session_service.delete_session(user["id"], session_id)
    return result


@router.post("/{session_id}/logs")
async def add_log_entry(
    session_id: str,
    data: AddLogEntryRequest,
    user: dict = Depends(get_current_user)
):
    """Add log entry to session"""
    if data.sessionId != session_id:
        raise ValueError("Session ID mismatch")
    
    result = await session_service.add_log_entry(
        user["id"],
        session_id,
        data.type,
        data.timestamp,
        data.content,
        data.metadata
    )
    return result
