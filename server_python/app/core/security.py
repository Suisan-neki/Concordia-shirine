"""
Security service for encryption, rate limiting, input sanitization, and AI-era threat detection
"""
import hashlib
import re
import math
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import secrets
import asyncio
from app.core.config import settings
from app.core.dynamodb import put_security_audit_logs, get_security_audit_logs


# Rate limit store (in-memory)
_rate_limit_store: Dict[str, Dict[str, Any]] = {}

# AI attack pattern store
_ai_attack_pattern_store: Dict[str, Dict[str, Any]] = {}

# Behavior pattern store
_behavior_pattern_store: Dict[str, Dict[str, Any]] = {}

# Output baseline store
_output_baseline_store: Dict[str, Dict[str, Any]] = {}

# Log buffer
_log_buffer: List[Dict[str, Any]] = []
_log_buffer_last_flush = datetime.now().timestamp() * 1000

LOG_BUFFER_SIZE = 50
LOG_FLUSH_INTERVAL = 30000  # 30 seconds
LOG_SAMPLING_RATE = 0.1  # 10% for info level events


def _get_encryption_key() -> bytes:
    """Get encryption key from JWT_SECRET"""
    if not settings.jwt_secret:
        raise ValueError("JWT_SECRET environment variable is required")
    
    # SHA-256 hash to get 32-byte key
    return hashlib.sha256(settings.jwt_secret.encode()).digest()


def _hash_identifier(identifier: str) -> str:
    """Hash identifier for privacy protection"""
    return hashlib.sha256(identifier.encode()).hexdigest()[:16]


class SecurityService:
    """Security service singleton"""
    _instance: Optional['SecurityService'] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._initialized = True
        self._tasks_started = False
        # Start periodic tasks if event loop is running
        self.start_background_tasks()

    def start_background_tasks(self) -> None:
        """Start periodic tasks when an event loop is available"""
        if self._tasks_started:
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        loop.create_task(self._start_periodic_tasks())
        self._tasks_started = True
    
    async def _start_periodic_tasks(self):
        """Start periodic cleanup tasks"""
        # Flush log buffer every 30 seconds
        while True:
            await asyncio.sleep(LOG_FLUSH_INTERVAL / 1000)
            await self._flush_log_buffer()
        
        # Cleanup old rate limit records (every 5 minutes)
        # Cleanup old AI attack patterns (every hour)
        # Cleanup old behavior patterns (every hour)
        # Cleanup old output baselines (every hour)
    
    async def _flush_log_buffer(self):
        """Flush log buffer to database"""
        global _log_buffer, _log_buffer_last_flush
        
        if not _log_buffer:
            return
        
        events_to_flush = _log_buffer.copy()
        _log_buffer = []
        _log_buffer_last_flush = datetime.now().timestamp() * 1000
        
        try:
            await put_security_audit_logs(events_to_flush)
        except Exception as e:
            print(f"[Security] Failed to flush log buffer: {e}")
            # Put back events (up to buffer size)
            remaining = LOG_BUFFER_SIZE - len(_log_buffer)
            if remaining > 0:
                _log_buffer.extend(events_to_flush[:remaining])
    
    async def log_security_event(
        self,
        event: Dict[str, Any],
        force: bool = False
    ) -> None:
        """Log security event (with buffering and sampling)"""
        global _log_buffer
        
        severity = event.get("severity", "info")
        
        # Sampling: info level events are sampled (10%)
        if not force and severity == "info":
            if secrets.randbelow(100) >= int(LOG_SAMPLING_RATE * 100):
                return
        
        # Add to buffer
        _log_buffer.append(event)
        
        # Flush if buffer is full
        if len(_log_buffer) >= LOG_BUFFER_SIZE:
            await self._flush_log_buffer()
    
    async def encrypt(self, data: str, user_id: Optional[int] = None, session_id: Optional[int] = None) -> str:
        """Encrypt data using AES-256-GCM"""
        key = _get_encryption_key()
        
        # Generate random nonce (12 bytes for GCM)
        nonce = secrets.token_bytes(12)
        
        # Encrypt
        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(nonce, data.encode('utf-8'), None)
        
        # Log encryption (sampled)
        await self.log_security_event({
            "userId": user_id,
            "sessionId": session_id,
            "eventType": "encryption_applied",
            "severity": "info",
            "description": "データが安全に暗号化されました",
            "metadata": {"dataLength": len(data)},
            "timestamp": int(datetime.now().timestamp() * 1000),
        })
        
        # Return nonce:tag:ciphertext (all hex)
        return f"{nonce.hex()}:{ciphertext.hex()}"
    
    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt data using AES-256-GCM"""
        parts = encrypted_data.split(":")
        if len(parts) != 2:
            raise ValueError("Invalid encrypted data format")
        
        nonce_hex, ciphertext_hex = parts
        nonce = bytes.fromhex(nonce_hex)
        ciphertext = bytes.fromhex(ciphertext_hex)
        
        key = _get_encryption_key()
        aesgcm = AESGCM(key)
        
        # Decrypt (GCM automatically verifies authentication tag)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext.decode('utf-8')
    
    async def check_rate_limit(
        self,
        identifier: str,
        limit: int = 100,
        window_ms: int = 60000,
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Check rate limit"""
        now = int(datetime.now().timestamp() * 1000)
        record = _rate_limit_store.get(identifier)
        
        if not record or now > record["resetTime"]:
            _rate_limit_store[identifier] = {
                "count": 1,
                "resetTime": now + window_ms
            }
            return {
                "allowed": True,
                "remaining": limit - 1,
                "resetTime": now + window_ms
            }
        
        if record["count"] >= limit:
            await self.log_security_event({
                "userId": user_id,
                "eventType": "rate_limit_triggered",
                "severity": "warning",
                "description": "レート制限が発動しました。異常なアクセスパターンを検知。",
                "metadata": {
                    "identifier": _hash_identifier(identifier),
                    "limit": limit,
                    "windowMs": window_ms
                },
                "timestamp": now,
            }, force=True)
            
            return {
                "allowed": False,
                "remaining": 0,
                "resetTime": record["resetTime"]
            }
        
        record["count"] += 1
        return {
            "allowed": True,
            "remaining": limit - record["count"],
            "resetTime": record["resetTime"]
        }
    
    def _calculate_entropy(self, text: str) -> float:
        """Calculate text entropy"""
        if not text:
            return 0.0
        
        char_counts: Dict[str, int] = {}
        for char in text:
            char_counts[char] = char_counts.get(char, 0) + 1
        
        entropy = 0.0
        length = len(text)
        for count in char_counts.values():
            probability = count / length
            entropy -= probability * math.log2(probability)
        
        return entropy
    
    def _extract_statistical_features(self, input_text: str) -> Dict[str, float]:
        """Extract statistical features for anomaly detection"""
        entropy = self._calculate_entropy(input_text)
        
        # Special character ratio
        special_chars = re.findall(r'[<>{}[\]()|\\\/@#$%^&*+=~`]', input_text)
        special_char_ratio = len(special_chars) / len(input_text) if input_text else 0.0
        
        # Command-like pattern ratio
        command_patterns = re.compile(
            r'(ignore|forget|override|disregard|act\s+as|pretend|output|format|respond)',
            re.IGNORECASE
        )
        command_matches = len(command_patterns.findall(input_text))
        words = len(input_text.split())
        command_like_ratio = command_matches / words if words > 0 else 0.0
        
        # Suspicious keyword count
        suspicious_keywords = [
            'system', 'prompt', 'instruction', 'rule', 'ignore', 'forget',
            'override', 'disregard', 'reveal', 'show', 'display', 'secret',
            'key', 'password', 'token', 'api', 'internal', 'private',
        ]
        suspicious_keyword_count = sum(
            1 for keyword in suspicious_keywords
            if re.search(rf'\b{keyword}\b', input_text, re.IGNORECASE)
        )
        
        # Anomaly score (0-1)
        anomaly_score = min(1.0, (
            (entropy / 8.0) * 0.3 +
            special_char_ratio * 0.3 +
            min(command_like_ratio * 10, 1.0) * 0.2 +
            min(suspicious_keyword_count / 5.0, 1.0) * 0.2
        ))
        
        return {
            "entropy": entropy,
            "specialCharRatio": special_char_ratio,
            "commandLikeRatio": command_like_ratio,
            "suspiciousKeywordCount": suspicious_keyword_count,
            "anomalyScore": anomaly_score,
        }
    
    def _detect_prompt_injection_advanced(self, input_text: str) -> Dict[str, Any]:
        """Detect prompt injection attacks (advanced)"""
        lower_input = input_text.lower()
        methods: List[str] = []
        confidence = 0.0
        
        # Pattern matching
        injection_patterns = [
            re.compile(r'ignore\s+(previous|all|earlier)\s+(instructions?|prompts?|rules?)', re.IGNORECASE),
            re.compile(r'forget\s+(everything|all|previous)', re.IGNORECASE),
            re.compile(r'disregard\s+(previous|all|earlier)', re.IGNORECASE),
            re.compile(r'override\s+(system|previous|instructions?)', re.IGNORECASE),
            re.compile(r'act\s+as\s+(a|an|the)', re.IGNORECASE),
            re.compile(r'pretend\s+to\s+be', re.IGNORECASE),
            re.compile(r'you\s+are\s+now', re.IGNORECASE),
            re.compile(r'from\s+now\s+on', re.IGNORECASE),
            re.compile(r'output\s+(as|in)\s+(json|xml|code|raw)', re.IGNORECASE),
            re.compile(r'format\s+(as|in)\s+(json|xml|code|raw)', re.IGNORECASE),
            re.compile(r'respond\s+(as|in)\s+(json|xml|code|raw)', re.IGNORECASE),
            re.compile(r'(show|reveal|display|tell|give)\s+me\s+(the|your|all)', re.IGNORECASE),
            re.compile(r'(what|where)\s+is\s+(your|the)\s+(api|key|secret|password|token)', re.IGNORECASE),
            re.compile(r'(print|output|return)\s+(your|the)\s+(system|internal|private)', re.IGNORECASE),
            re.compile(r'<\|(system|user|assistant)\|>', re.IGNORECASE),
            re.compile(r'\[INST\]', re.IGNORECASE),
            re.compile(r'\x1b\[', re.IGNORECASE),
            re.compile(r'(BEGIN|START)\s+(NEW|REAL)\s+(INSTRUCTION|PROMPT|TASK)', re.IGNORECASE),
            re.compile(r'(END|STOP)\s+(CURRENT|PREVIOUS)\s+(INSTRUCTION|PROMPT|TASK)', re.IGNORECASE),
        ]
        
        pattern_match = any(pattern.search(lower_input) for pattern in injection_patterns)
        if pattern_match:
            methods.append("pattern_matching")
            confidence += 0.4
        
        # Statistical analysis
        features = self._extract_statistical_features(input_text)
        if features["anomalyScore"] > 0.5:
            methods.append("statistical_analysis")
            confidence += features["anomalyScore"] * 0.4
        
        # Entropy analysis
        if features["entropy"] > 5.5:
            methods.append("entropy_analysis")
            confidence += 0.2
        
        return {
            "detected": confidence > 0.5,
            "confidence": min(1.0, confidence),
            "methods": methods,
        }
    
    async def validate_llm_input(
        self,
        input_text: str,
        user_id: Optional[int] = None,
        session_id: Optional[int] = None,
        identifier: Optional[str] = None
    ) -> Dict[str, Any]:
        """Validate and sanitize LLM input"""
        threats: List[str] = []
        sanitized = input_text
        blocked = False
        
        # Advanced prompt injection detection
        injection_detection = self._detect_prompt_injection_advanced(input_text)
        if injection_detection["detected"]:
            threats.append("prompt_injection")
            
            # Track attack patterns and auto-block
            if identifier:
                pattern = _ai_attack_pattern_store.get(identifier, {
                    "promptInjectionAttempts": 0,
                    "suspiciousRequests": 0,
                    "lastAttempt": 0,
                    "blocked": False,
                })
                
                if pattern["blocked"]:
                    blocked = True
                    threats.append("auto_blocked")
                    await self.log_security_event({
                        "userId": user_id,
                        "sessionId": session_id,
                        "eventType": "llm_input_blocked",
                        "severity": "critical",
                        "description": "ブロックされた識別子からのLLMリクエストが拒否されました",
                        "metadata": {
                            "identifier": _hash_identifier(identifier),
                            "reason": "repeated_prompt_injection_attempts",
                        },
                        "timestamp": int(datetime.now().timestamp() * 1000),
                    }, force=True)
                    
                    return {
                        "safe": False,
                        "sanitized": "",
                        "threats": threats,
                        "blocked": True,
                    }
                
                pattern["promptInjectionAttempts"] += 1
                pattern["lastAttempt"] = int(datetime.now().timestamp() * 1000)
                
                # Auto-block after 3 attempts
                if pattern["promptInjectionAttempts"] >= 3:
                    pattern["blocked"] = True
                    blocked = True
                    threats.append("auto_blocked")
                    
                    await self.log_security_event({
                        "userId": user_id,
                        "sessionId": session_id,
                        "eventType": "llm_input_auto_blocked",
                        "severity": "critical",
                        "description": "プロンプトインジェクション試行が3回検出され、自動ブロックされました",
                        "metadata": {
                            "identifier": _hash_identifier(identifier),
                            "attempts": pattern["promptInjectionAttempts"],
                            "confidence": injection_detection["confidence"],
                            "methods": injection_detection["methods"],
                        },
                        "timestamp": int(datetime.now().timestamp() * 1000),
                    }, force=True)
                
                _ai_attack_pattern_store[identifier] = pattern
            
            # Sanitize dangerous patterns
            sanitized = re.sub(
                r'ignore\s+(previous|all|earlier)\s+(instructions?|prompts?|rules?)',
                '[FILTERED]',
                sanitized,
                flags=re.IGNORECASE
            )
            sanitized = re.sub(
                r'forget\s+(everything|all|previous)',
                '[FILTERED]',
                sanitized,
                flags=re.IGNORECASE
            )
            sanitized = re.sub(
                r'act\s+as\s+(a|an|the)\s+',
                '[FILTERED]',
                sanitized,
                flags=re.IGNORECASE
            )
        
        # Log security event
        if threats:
            await self.log_security_event({
                "userId": user_id,
                "sessionId": session_id,
                "eventType": "llm_input_validated",
                "severity": "warning" if blocked else "info",
                "description": f"LLM入力が検証されました。検出された脅威: {', '.join(threats)}",
                "metadata": {
                    "threats": threats,
                    "blocked": blocked,
                    "confidence": injection_detection.get("confidence", 0.0) if injection_detection.get("detected") else 0.0,
                },
                "timestamp": int(datetime.now().timestamp() * 1000),
            }, force=blocked)
        
        return {
            "safe": not blocked and len(threats) == 0,
            "sanitized": sanitized,
            "threats": threats,
            "blocked": blocked,
        }
    
    async def sanitize_input(
        self,
        input_text: str,
        user_id: Optional[int] = None,
        session_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Sanitize user input (XSS, SQL injection, etc.)"""
        original = input_text
        sanitized = input_text
        
        # 1. Remove control characters (allow newline and tab)
        sanitized = re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]', '', sanitized)
        
        # 2. Remove HTML tags
        sanitized = re.sub(r'<[^>]*>', '', sanitized)
        
        # 3. HTML escape (XSS protection)
        sanitized = (
            sanitized
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&#x27;')
            .replace('/', '&#x2F;')
        )
        
        # 4. NoSQL injection protection
        sanitized = sanitized.replace('$', '&#36;').replace('.', '&#46;')
        
        # 5. JSON injection protection
        sanitized = sanitized.replace('\\', '&#92;').replace('\n', '&#10;').replace('\r', '&#13;')
        
        # 6. Script injection protection
        sanitized = re.sub(r'javascript:', '', sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r'data:', '', sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r'vbscript:', '', sanitized, flags=re.IGNORECASE)
        
        was_modified = original != sanitized
        
        # Log if modified
        if was_modified:
            await self.log_security_event({
                "userId": user_id,
                "sessionId": session_id,
                "eventType": "input_sanitized",
                "severity": "info",
                "description": "入力データが安全にサニタイズされました",
                "metadata": {
                    "originalLength": len(original),
                    "sanitizedLength": len(sanitized),
                },
                "timestamp": int(datetime.now().timestamp() * 1000),
            })
        
        return {
            "sanitized": sanitized,
            "wasModified": was_modified,
        }
    
    async def validate_cors_configuration(
        self,
        allowed_origins: List[str],
        request_origin: str
    ) -> Dict[str, Any]:
        """Validate CORS configuration"""
        threats: List[str] = []
        safe = True
        
        # Check for wildcard
        if "*" in allowed_origins:
            threats.append("cors_wildcard_allowed")
            safe = False
        
        return {
            "safe": safe,
            "threats": threats,
        }
    
    async def get_user_security_stats(self, user_id: int) -> Dict[str, Any]:
        """Get user security statistics"""
        # Get logs for this user
        logs_result = await get_security_audit_logs({
            "userId": user_id,
            "limit": 1000,
        })
        
        logs = logs_result.get("logs", [])
        
        # Count by event type
        event_counts: Dict[str, int] = {}
        for log in logs:
            event_type = log.get("eventType", "unknown")
            event_counts[event_type] = event_counts.get(event_type, 0) + 1
        
        return {
            "totalEvents": len(logs),
            "eventCounts": event_counts,
            "recentEvents": logs[:10],  # Last 10 events
        }
    
    async def generate_security_summary(self, session_id: str) -> Dict[str, Any]:
        """Generate security summary for a session"""
        # This would query session-related security events
        # For now, return a basic summary
        return {
            "sessionId": session_id,
            "totalEvents": 0,
            "eventCounts": {},
            "recentEvents": [],
        }


# Global security service instance
security_service = SecurityService()
