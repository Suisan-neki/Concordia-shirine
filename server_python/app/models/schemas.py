"""
Pydantic models for request/response validation
"""
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


# ===== Auth Models =====

class UserResponse(BaseModel):
    """User response model"""
    id: int
    openId: str
    name: Optional[str] = None
    email: Optional[str] = None
    loginMethod: Optional[str] = None
    role: str
    deletedAt: Optional[str] = None
    createdAt: str
    updatedAt: str
    lastSignedIn: str


# ===== Session Models =====

class StartSessionResponse(BaseModel):
    """Start session response"""
    sessionId: str
    startTime: int


class EndSessionRequest(BaseModel):
    """End session request"""
    sessionId: str
    endTime: int
    duration: int
    sceneDistribution: Dict[str, int]
    eventCounts: Dict[str, int]
    insights: List[str]


class EndSessionResponse(BaseModel):
    """End session response"""
    success: bool
    securitySummary: Dict[str, Any]
    securityScore: int


class SessionResponse(BaseModel):
    """Session response"""
    id: int
    sessionId: str
    userId: Optional[int] = None
    startTime: int
    endTime: Optional[int] = None
    duration: Optional[int] = None
    securityScore: Optional[int] = None
    sceneDistribution: Optional[Dict[str, int]] = None
    eventCounts: Optional[Dict[str, int]] = None
    insights: Optional[List[str]] = None
    createdAt: str
    updatedAt: str
    logs: Optional[List[Dict[str, Any]]] = None


class AddLogEntryRequest(BaseModel):
    """Add log entry request"""
    sessionId: str
    type: str = Field(..., pattern="^(scene_change|speech|event|intervention)$")
    timestamp: int
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


# ===== Intervention Models =====

class InterventionSettingsResponse(BaseModel):
    """Intervention settings response"""
    enabled: bool
    monologueThreshold: int
    silenceThreshold: int
    soundEnabled: bool
    visualHintEnabled: bool


class UpdateInterventionSettingsRequest(BaseModel):
    """Update intervention settings request"""
    enabled: Optional[bool] = None
    monologueThreshold: Optional[int] = Field(None, ge=5, le=120)
    silenceThreshold: Optional[int] = Field(None, ge=8, le=60)
    soundEnabled: Optional[bool] = None
    visualHintEnabled: Optional[bool] = None


# ===== Security Models =====

class SecurityStatsResponse(BaseModel):
    """Security stats response"""
    totalEvents: int
    eventCounts: Dict[str, int]
    recentEvents: List[Dict[str, Any]]


class SecuritySummaryResponse(BaseModel):
    """Security summary response"""
    sessionId: str
    totalEvents: int
    eventCounts: Dict[str, int]
    recentEvents: List[Dict[str, Any]]


# ===== Admin Models =====

class UserListResponse(BaseModel):
    """User list response"""
    users: List[UserResponse]
    total: int
    page: int
    limit: int
    totalPages: int


class AuditLogsResponse(BaseModel):
    """Audit logs response"""
    logs: List[Dict[str, Any]]
    total: int
    page: int
    limit: int
    totalPages: int
