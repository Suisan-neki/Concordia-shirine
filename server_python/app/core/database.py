"""
Database access layer for DynamoDB
"""
import os
from typing import Optional, Dict, Any
from datetime import datetime
from app.core.config import settings

try:
    import boto3
    from botocore.exceptions import ClientError
except Exception as exc:  # pragma: no cover - fallback for local permission issues
    boto3 = None
    
    # Create a proper exception class that inherits from Exception
    # This will be compatible with exception handling even when boto3 is available
    class ClientError(Exception):
        """Fallback ClientError when boto3 is not available"""
        def __init__(self, error_response=None, operation_name=None):
            self.response = error_response or {}
            self.operation_name = operation_name
            message = f"ClientError in {operation_name}: {str(error_response)}" if operation_name else f"ClientError: {str(error_response)}"
            super().__init__(message)

    _BOTOCORE_IMPORT_ERROR = exc


# Cache for database operations
_cache: Dict[str, Dict[str, Any]] = {}
CACHE_TTL = 300000  # 5 minutes in milliseconds


def get_table_name(table_name: str) -> str:
    """Get DynamoDB table name with environment suffix"""
    # Check for explicit table name in environment
    env_key = f"DYNAMODB_TABLE_{table_name.upper()}"
    if os.getenv(env_key):
        return os.getenv(env_key)
    
    # Check for prefix
    prefix = os.getenv("DYNAMODB_TABLE_PREFIX", "")
    if prefix:
        return f"{prefix}{table_name}"
    
    # Default: environment-based table name
    env = "prod" if settings.is_production() else "dev"
    return f"concordia-{table_name}-{env}"


def get_dynamo_client():
    """Get DynamoDB client (low-level API)"""
    region = settings.cognito_region or os.getenv("AWS_REGION", "ap-northeast-1")
    if boto3 is None:
        raise RuntimeError(
            "boto3 could not be imported. Ensure dependencies are installed and readable."
        ) from _BOTOCORE_IMPORT_ERROR
    return boto3.client("dynamodb", region_name=region)


def get_dynamo_resource():
    """Get DynamoDB resource (high-level API)"""
    region = settings.cognito_region or os.getenv("AWS_REGION", "ap-northeast-1")
    if boto3 is None:
        raise RuntimeError(
            "boto3 could not be imported. Ensure dependencies are installed and readable."
        ) from _BOTOCORE_IMPORT_ERROR
    return boto3.resource("dynamodb", region_name=region)


def generate_id_from_uuid(uuid: str) -> int:
    """Generate numeric ID from UUID using SHA-256 hash"""
    import hashlib
    hash_obj = hashlib.sha256(uuid.encode())
    hash_hex = hash_obj.hexdigest()
    id_val = int(hash_hex[:12], 16)
    return id_val or 1


def _ensure_isoformat(value: Any) -> str:
    """Return ISO-8601 string for datetime values."""
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def get_from_cache(key: str) -> Optional[Any]:
    """Get value from cache"""
    entry = _cache.get(key)
    if not entry:
        return None
    
    if datetime.now().timestamp() * 1000 > entry["expiry"]:
        del _cache[key]
        return None
    
    return entry["data"]


def set_cache(key: str, value: Any, ttl_ms: int = CACHE_TTL) -> None:
    """Set value in cache"""
    _cache[key] = {
        "data": value,
        "expiry": datetime.now().timestamp() * 1000 + ttl_ms
    }


def _unmarshall_value(value: Dict[str, Any]) -> Any:
    """Unmarshall a DynamoDB-typed value to a Python value."""
    if "S" in value:
        return value["S"]
    if "N" in value:
        return int(value["N"]) if "." not in value["N"] else float(value["N"])
    if "BOOL" in value:
        return value["BOOL"]
    if "NULL" in value:
        return None
    if "M" in value:
        return unmarshall_item(value["M"])
    if "L" in value:
        return [_unmarshall_value(v) for v in value["L"]]
    return value


def unmarshall_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """Unmarshall DynamoDB item to Python dict"""
    result = {}
    for key, value in item.items():
        result[key] = _unmarshall_value(value)
    return result


def _marshall_value(value: Any) -> Dict[str, Any]:
    """Marshall a Python value to a DynamoDB-typed value."""
    if value is None:
        return {"NULL": True}
    if isinstance(value, bool):
        return {"BOOL": value}
    if isinstance(value, str):
        return {"S": value}
    if isinstance(value, (int, float)):
        return {"N": str(value)}
    if isinstance(value, dict):
        return {"M": marshall_item(value)}
    if isinstance(value, list):
        return {"L": [_marshall_value(v) for v in value]}
    return {"S": str(value)}


def marshall_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """Marshall Python dict to DynamoDB item"""
    result = {}
    for key, value in item.items():
        result[key] = _marshall_value(value)
    return result


async def get_user_by_open_id(open_id: str) -> Optional[Dict[str, Any]]:
    """Get user by OpenID"""
    cache_key = f"user:{open_id}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached
    
    client = get_dynamo_client()
    table_name = get_table_name("users")
    
    try:
        response = client.get_item(
            TableName=table_name,
            Key={"openId": {"S": open_id}}
        )
        
        if "Item" not in response:
            return None
        
        item = unmarshall_item(response["Item"])
        user_role = item.get("role", "user")
        
        # Generate ID from openId
        user_id = generate_id_from_uuid(open_id)
        
        deleted_at = item.get("deletedAt")
        created_at = item.get("createdAt")
        updated_at = item.get("updatedAt")
        last_signed_in = item.get("lastSignedIn")
        user = {
            "id": user_id,
            "openId": item["openId"],
            "name": item.get("name"),
            "email": item.get("email"),
            "loginMethod": item.get("loginMethod"),
            "role": user_role,
            "deletedAt": _ensure_isoformat(deleted_at) if deleted_at else None,
            "createdAt": _ensure_isoformat(created_at) if created_at else datetime.now().isoformat(),
            "updatedAt": _ensure_isoformat(updated_at) if updated_at else datetime.now().isoformat(),
            "lastSignedIn": _ensure_isoformat(last_signed_in) if last_signed_in else datetime.now().isoformat(),
        }
        
        set_cache(cache_key, user)
        return user
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        if error_code == "ResourceNotFoundException":
            print(f"[DynamoDB] Table '{table_name}' does not exist. Please create it.")
        else:
            print(f"[DynamoDB] Failed to get user: {e}")
        return None


async def upsert_user(user_data: Dict[str, Any]) -> None:
    """Upsert user"""
    if not user_data.get("openId"):
        raise ValueError("User openId is required for upsert")
    
    client = get_dynamo_client()
    table_name = get_table_name("users")
    
    # Get existing user
    existing_user = await get_user_by_open_id(user_data["openId"])
    
    now = datetime.now().isoformat()
    
    # Determine role
    role = user_data.get("role") or (existing_user.get("role") if existing_user else "user")
    if user_data["openId"] == settings.owner_open_id:
        role = "admin"
    
    # Prepare item
    item: Dict[str, Any] = {
        "openId": user_data["openId"],
        "role": role,
        "updatedAt": now,
    }
    
    if user_data.get("name"):
        item["name"] = user_data["name"]
    
    if user_data.get("email"):
        item["email"] = user_data["email"]
    
    if user_data.get("loginMethod"):
        item["loginMethod"] = user_data["loginMethod"]
    
    if not existing_user:
        item["createdAt"] = now
        item["lastSignedIn"] = now
    else:
        if user_data.get("lastSignedIn"):
            item["lastSignedIn"] = user_data["lastSignedIn"].isoformat() if isinstance(user_data["lastSignedIn"], datetime) else user_data["lastSignedIn"]
        elif existing_user.get("lastSignedIn"):
            item["lastSignedIn"] = existing_user["lastSignedIn"].isoformat() if isinstance(existing_user["lastSignedIn"], datetime) else existing_user["lastSignedIn"]
        else:
            item["lastSignedIn"] = now
        
        if existing_user.get("createdAt"):
            item["createdAt"] = existing_user["createdAt"].isoformat() if isinstance(existing_user["createdAt"], datetime) else existing_user["createdAt"]
    
    if existing_user and existing_user.get("deletedAt"):
        item["deletedAt"] = existing_user["deletedAt"].isoformat() if isinstance(existing_user["deletedAt"], datetime) else existing_user["deletedAt"]
    
    try:
        marshalled_item = marshall_item(item)
        client.put_item(
            TableName=table_name,
            Item=marshalled_item
        )
        
        # Invalidate cache
        cache_key = f"user:{user_data['openId']}"
        if cache_key in _cache:
            del _cache[cache_key]
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        if error_code == "ResourceNotFoundException":
            print(f"[DynamoDB] Table '{table_name}' does not exist. Please create it.")
            return
        print(f"[DynamoDB] Failed to upsert user: {e}")
        raise
