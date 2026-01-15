"""
Session management service
"""
import secrets
import string
from typing import Dict, Any, Optional, List
from datetime import datetime
from app.core.dynamodb import (
    create_session,
    update_session,
    get_user_sessions,
    delete_session,
    get_session_by_session_id,
    add_log_entry,
    get_session_log_entries,
    get_or_create_intervention_settings,
    update_intervention_settings,
)
from app.core.security import security_service
from app.core.database import get_user_by_id


def generate_session_id() -> str:
    """Generate a random session ID"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(21))


class SessionService:
    """Session management service (singleton)"""
    _instance: Optional['SessionService'] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    async def start_session(self, user_id: int) -> Dict[str, Any]:
        """Start a new session"""
        session_id = generate_session_id()
        start_time = int(datetime.now().timestamp() * 1000)
        
        # Create session in database
        db_id = await create_session({
            "sessionId": session_id,
            "userId": user_id,
            "startTime": start_time,
        })
        
        # Apply security protection
        if db_id:
            await security_service.log_security_event({
                "userId": user_id,
                "sessionId": db_id,
                "eventType": "session_protected",
                "severity": "info",
                "description": "新しいセッションが保護されました。結界が展開されています。",
                "metadata": {"protectionLevel": "standard"},
                "timestamp": start_time,
            }, force=True)
        
        return {
            "sessionId": session_id,
            "startTime": start_time,
        }
    
    async def end_session(
        self,
        user_id: int,
        session_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """End a session"""
        # Verify ownership
        session = await self._get_session_if_authorized(user_id, session_id)
        if not session:
            raise ValueError("Session not found or access denied")
        
        # Calculate security score
        scene_distribution = data.get("sceneDistribution", {})
        security_score = self._calculate_security_score(scene_distribution)
        
        # Update session
        await update_session(session_id, {
            "endTime": data.get("endTime"),
            "duration": data.get("duration"),
            "securityScore": security_score,
            "sceneDistribution": scene_distribution,
            "eventCounts": data.get("eventCounts"),
            "insights": data.get("insights"),
        })
        
        # Generate security summary
        security_summary = await security_service.generate_security_summary(session_id)
        
        return {
            "success": True,
            "securitySummary": security_summary,
            "securityScore": security_score,
        }
    
    def _calculate_security_score(self, scene_distribution: Dict[str, int]) -> int:
        """Calculate security score from scene distribution"""
        total_scenes = sum(scene_distribution.values())
        if total_scenes == 0:
            return 50  # Default score
        
        harmony_ratio = (scene_distribution.get("調和", 0) or scene_distribution.get("harmony", 0)) / total_scenes
        silence_ratio = (scene_distribution.get("静寂", 0) or scene_distribution.get("silence", 0)) / total_scenes
        one_sided_ratio = (scene_distribution.get("一方的", 0) or scene_distribution.get("one_sided", 0)) / total_scenes
        
        score = int(
            (harmony_ratio * 0.4 + silence_ratio * 0.3 + (1 - one_sided_ratio) * 0.3) * 100
        )
        return min(100, max(0, score))
    
    async def list_user_sessions(self, user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """List user sessions"""
        return await get_user_sessions(user_id, limit)
    
    async def get_session_with_details(self, user_id: int, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session with details"""
        session = await get_session_by_session_id(session_id)
        
        if not session or session.get("userId") != user_id:
            # Log access denied
            await security_service.log_security_event({
                "userId": user_id,
                "eventType": "access_denied",
                "severity": "warning",
                "description": "Session access denied",
                "metadata": {"sessionId": session_id},
                "timestamp": int(datetime.now().timestamp() * 1000),
            }, force=True)
            return None
        
        # Log access granted
        await security_service.log_security_event({
            "userId": user_id,
            "eventType": "access_granted",
            "severity": "info",
            "description": "Session access granted",
            "metadata": {"sessionId": session_id},
            "timestamp": int(datetime.now().timestamp() * 1000),
        })
        
        # Get logs
        logs = await get_session_log_entries(session.get("id"))
        
        return {
            **session,
            "logs": logs,
        }
    
    async def _get_session_if_authorized(self, user_id: int, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session if authorized (internal use)"""
        session = await get_session_by_session_id(session_id)
        if not session or session.get("userId") != user_id:
            return None
        return session
    
    async def delete_session(self, user_id: int, session_id: str) -> Dict[str, Any]:
        """Delete a session"""
        session = await self._get_session_if_authorized(user_id, session_id)
        if not session:
            raise ValueError("Session not found or access denied")
        
        await delete_session(session_id)
        return {"success": True}
    
    async def add_log_entry(
        self,
        user_id: int,
        session_id: str,
        log_type: str,
        timestamp: int,
        content: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Add log entry to session"""
        # Verify ownership
        session = await self._get_session_if_authorized(user_id, session_id)
        if not session:
            raise ValueError("Session not found or access denied")
        
        # Sanitize content
        sanitized_content = content
        if content:
            sanitize_result = await security_service.sanitize_input(
                content,
                user_id,
                session.get("id")
            )
            sanitized_content = sanitize_result["sanitized"]
        
        # Privacy protection for speech data
        if log_type == "speech":
            await security_service.log_security_event({
                "userId": user_id,
                "sessionId": session.get("id"),
                "eventType": "privacy_preserved",
                "severity": "info",
                "description": "音声データがプライバシー保護されました",
                "metadata": {"dataType": "speech_data"},
                "timestamp": timestamp,
            })
        
        # Consent protection for intervention data
        if log_type == "intervention" and metadata:
            scene = metadata.get("scene")
            duration = metadata.get("duration")
            if scene and duration:
                await security_service.log_security_event({
                    "userId": user_id,
                    "sessionId": session.get("id"),
                    "eventType": "consent_protected",
                    "severity": "info",
                    "description": "判断の自由を守るための介入が行われました",
                    "metadata": {"scene": scene, "duration": duration},
                    "timestamp": timestamp,
                })
        
        # Add log entry
        await add_log_entry(
            session.get("id"),
            {
                "type": log_type,
                "timestamp": timestamp,
                "content": sanitized_content,
                "metadata": metadata,
            }
        )
        
        return {"success": True}
    
    # ===== Intervention Settings =====
    
    async def get_intervention_settings(self, user_id: int) -> Dict[str, Any]:
        """Get intervention settings"""
        settings = await get_or_create_intervention_settings(user_id)
        return {
            "enabled": settings.get("enabled", True),
            "monologueThreshold": settings.get("monologueThreshold", 30),
            "silenceThreshold": settings.get("silenceThreshold", 15),
            "soundEnabled": settings.get("soundEnabled", True),
            "visualHintEnabled": settings.get("visualHintEnabled", True),
        }
    
    async def update_intervention_settings(
        self,
        user_id: int,
        input_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update intervention settings"""
        update_data: Dict[str, Any] = {}
        
        if "enabled" in input_data:
            update_data["enabled"] = input_data["enabled"]
        if "monologueThreshold" in input_data:
            update_data["monologueThreshold"] = input_data["monologueThreshold"]
        if "silenceThreshold" in input_data:
            update_data["silenceThreshold"] = input_data["silenceThreshold"]
        if "soundEnabled" in input_data:
            update_data["soundEnabled"] = input_data["soundEnabled"]
        if "visualHintEnabled" in input_data:
            update_data["visualHintEnabled"] = input_data["visualHintEnabled"]
        
        await update_intervention_settings(user_id, update_data)
        return {"success": True}


# Global session service instance
session_service = SessionService()
