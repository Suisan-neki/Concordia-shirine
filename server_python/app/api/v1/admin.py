"""
Admin endpoints
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.core.auth import get_current_admin_user
from app.core.dynamodb import get_all_users, get_user_by_id, soft_delete_user, get_security_audit_logs
from app.models.schemas import UserListResponse, UserResponse, AuditLogsResponse

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    include_deleted: bool = Query(False),
    admin_user: dict = Depends(get_current_admin_user)
):
    """List all users (admin only)"""
    all_users = await get_all_users(include_deleted)
    
    # Search filter
    if search:
        search_lower = search.lower()
        all_users = [
            u for u in all_users
            if u.get("name") and search_lower in u["name"].lower()
        ]
    
    # Sort by createdAt descending
    all_users.sort(
        key=lambda u: u.get("createdAt", ""),
        reverse=True
    )
    
    # Pagination
    total = len(all_users)
    offset = (page - 1) * limit
    paginated_users = all_users[offset:offset + limit]
    
    return UserListResponse(
        users=[UserResponse(**u) for u in paginated_users],
        total=total,
        page=page,
        limit=limit,
        totalPages=(total + limit - 1) // limit,
    )


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    admin_user: dict = Depends(get_current_admin_user)
):
    """Get user by ID (admin only)"""
    user = await get_user_by_id(user_id)
    if not user:
        raise ValueError("User not found")
    return UserResponse(**user)


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin_user: dict = Depends(get_current_admin_user)
):
    """Soft delete user (admin only)"""
    if user_id == admin_user["id"]:
        raise ValueError("Cannot delete yourself")
    
    result = await soft_delete_user(user_id)
    return {"success": result}


@router.get("/audit-logs", response_model=AuditLogsResponse)
async def get_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    event_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    session_id: Optional[int] = Query(None),
    admin_user: dict = Depends(get_current_admin_user)
):
    """Get security audit logs (admin only)"""
    options = {
        "page": page,
        "limit": limit,
    }
    
    if event_type:
        options["eventType"] = event_type
    if severity:
        options["severity"] = severity
    if user_id:
        options["userId"] = user_id
    if session_id:
        options["sessionId"] = session_id
    
    result = await get_security_audit_logs(options)
    return AuditLogsResponse(**result)
