"""
DynamoDB operations for sessions, logs, and intervention settings
"""
import os
from typing import Optional, Dict, Any, List
from datetime import datetime
import boto3
from botocore.exceptions import ClientError
from app.core.config import settings
from app.core.database import (
    get_table_name,
    get_dynamo_client,
    generate_id_from_uuid,
    unmarshall_item,
    marshall_item
)


# ===== Sessions =====

async def create_session(session_data: Dict[str, Any]) -> int:
    """Create a new session"""
    if not session_data.get("sessionId"):
        raise ValueError("Session sessionId is required")
    
    client = get_dynamo_client()
    table_name = get_table_name("sessions")
    session_id = session_data["sessionId"]
    db_id = generate_id_from_uuid(session_id)
    now = datetime.now().isoformat()
    
    item: Dict[str, Any] = {
        "id": db_id,
        "sessionId": session_id,
        "userId": session_data.get("userId"),
        "startTime": session_data.get("startTime", int(datetime.now().timestamp() * 1000)),
        "endTime": session_data.get("endTime"),
        "duration": session_data.get("duration"),
        "securityScore": session_data.get("securityScore"),
        "sceneDistribution": session_data.get("sceneDistribution"),
        "eventCounts": session_data.get("eventCounts"),
        "insights": session_data.get("insights"),
        "createdAt": now,
        "updatedAt": now,
    }
    
    try:
        marshalled_item = marshall_item(item)
        client.put_item(
            TableName=table_name,
            Item=marshalled_item
        )
        return db_id
    except ClientError as e:
        print(f"[DynamoDB] Failed to create session: {e}")
        raise


async def update_session(session_id: str, data: Dict[str, Any]) -> None:
    """Update session"""
    client = get_dynamo_client()
    table_name = get_table_name("sessions")
    now = datetime.now().isoformat()
    
    updates: List[str] = []
    expression_names: Dict[str, str] = {}
    expression_values: Dict[str, Any] = {}
    
    def set_value(key: str, value: Any):
        name_key = f"#{key}"
        value_key = f":{key}"
        expression_names[name_key] = key
        expression_values[value_key] = value
        updates.append(f"{name_key} = {value_key}")
    
    if "userId" in data:
        set_value("userId", data["userId"])
    if "startTime" in data:
        set_value("startTime", data["startTime"])
    if "endTime" in data:
        set_value("endTime", data["endTime"])
    if "duration" in data:
        set_value("duration", data["duration"])
    if "securityScore" in data:
        set_value("securityScore", data["securityScore"])
    if "sceneDistribution" in data:
        set_value("sceneDistribution", data["sceneDistribution"])
    if "eventCounts" in data:
        set_value("eventCounts", data["eventCounts"])
    if "insights" in data:
        set_value("insights", data["insights"])
    
    set_value("updatedAt", now)
    
    try:
        # Convert expression values to DynamoDB format
        dynamo_values = {}
        for key, value in expression_values.items():
            if value is None:
                dynamo_values[key] = {"NULL": True}
            elif isinstance(value, str):
                dynamo_values[key] = {"S": value}
            elif isinstance(value, (int, float)):
                dynamo_values[key] = {"N": str(value)}
            elif isinstance(value, bool):
                dynamo_values[key] = {"BOOL": value}
            elif isinstance(value, dict):
                dynamo_values[key] = {"M": marshall_item(value)}
            elif isinstance(value, list):
                dynamo_values[key] = {"L": [marshall_item(v) if isinstance(v, dict) else {"S": str(v)} for v in value]}
        
        client.update_item(
            TableName=table_name,
            Key={"sessionId": {"S": session_id}},
            UpdateExpression=f"SET {', '.join(updates)}",
            ExpressionAttributeNames=expression_names,
            ExpressionAttributeValues=dynamo_values
        )
    except ClientError as e:
        print(f"[DynamoDB] Failed to update session: {e}")
        raise


async def get_session_by_session_id(session_id: str) -> Optional[Dict[str, Any]]:
    """Get session by sessionId"""
    client = get_dynamo_client()
    table_name = get_table_name("sessions")
    
    try:
        response = client.get_item(
            TableName=table_name,
            Key={"sessionId": {"S": session_id}}
        )
        
        if "Item" not in response:
            return None
        
        item = unmarshall_item(response["Item"])
        return {
            "id": item.get("id"),
            "sessionId": item["sessionId"],
            "userId": item.get("userId"),
            "startTime": item.get("startTime"),
            "endTime": item.get("endTime"),
            "duration": item.get("duration"),
            "securityScore": item.get("securityScore"),
            "sceneDistribution": item.get("sceneDistribution"),
            "eventCounts": item.get("eventCounts"),
            "insights": item.get("insights"),
            "createdAt": datetime.fromisoformat(item["createdAt"]) if item.get("createdAt") else datetime.now(),
            "updatedAt": datetime.fromisoformat(item["updatedAt"]) if item.get("updatedAt") else datetime.now(),
        }
    except ClientError as e:
        print(f"[DynamoDB] Failed to get session: {e}")
        return None


async def get_user_sessions(user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
    """Get user sessions"""
    client = get_dynamo_client()
    table_name = get_table_name("sessions")
    
    try:
        response = client.query(
            TableName=table_name,
            IndexName="userId-startTime-index",
            KeyConditionExpression="userId = :userId",
            ExpressionAttributeValues={":userId": {"N": str(user_id)}},
            ScanIndexForward=False,
            Limit=limit
        )
        
        sessions = []
        for item in response.get("Items", []):
            unmarshalled = unmarshall_item(item)
            sessions.append({
                "id": unmarshalled.get("id"),
                "sessionId": unmarshalled["sessionId"],
                "userId": unmarshalled.get("userId"),
                "startTime": unmarshalled.get("startTime"),
                "endTime": unmarshalled.get("endTime"),
                "duration": unmarshalled.get("duration"),
                "securityScore": unmarshalled.get("securityScore"),
                "sceneDistribution": unmarshalled.get("sceneDistribution"),
                "eventCounts": unmarshalled.get("eventCounts"),
                "insights": unmarshalled.get("insights"),
                "createdAt": datetime.fromisoformat(unmarshalled["createdAt"]) if unmarshalled.get("createdAt") else datetime.now(),
                "updatedAt": datetime.fromisoformat(unmarshalled["updatedAt"]) if unmarshalled.get("updatedAt") else datetime.now(),
            })
        
        return sessions
    except ClientError as e:
        print(f"[DynamoDB] Failed to get user sessions: {e}")
        return []


async def delete_session(session_id: str) -> None:
    """Delete session and its logs"""
    client = get_dynamo_client()
    table_name = get_table_name("sessions")
    
    # Get session first to get the db_id
    session = await get_session_by_session_id(session_id)
    if not session:
        return
    
    db_id = session.get("id")
    
    # Delete session logs if db_id exists
    if db_id:
        await delete_session_logs(db_id)
    
    # Delete session
    try:
        client.delete_item(
            TableName=table_name,
            Key={"sessionId": {"S": session_id}}
        )
    except ClientError as e:
        print(f"[DynamoDB] Failed to delete session: {e}")
        raise


async def delete_session_logs(session_db_id: int) -> None:
    """Delete all logs for a session"""
    client = get_dynamo_client()
    table_name = get_table_name("sessionLogs")
    
    try:
        # Query all logs for this session
        last_evaluated_key = None
        while True:
            query_params: Dict[str, Any] = {
                "TableName": table_name,
                "KeyConditionExpression": "sessionId = :sessionId",
                "ExpressionAttributeValues": {":sessionId": {"N": str(session_db_id)}},
                "ProjectionExpression": "sessionId, logKey"
            }
            
            if last_evaluated_key:
                query_params["ExclusiveStartKey"] = last_evaluated_key
            
            response = client.query(**query_params)
            
            # Delete items in batches
            if response.get("Items"):
                delete_requests = [
                    {"DeleteRequest": {"Key": {"sessionId": {"N": str(session_db_id)}, "logKey": item["logKey"]}}}
                    for item in response["Items"]
                ]
                
                # Batch write (max 25 items per batch)
                for i in range(0, len(delete_requests), 25):
                    batch = delete_requests[i:i+25]
                    client.batch_write_item(
                        RequestItems={table_name: batch}
                    )
            
            last_evaluated_key = response.get("LastEvaluatedKey")
            if not last_evaluated_key:
                break
    except ClientError as e:
        print(f"[DynamoDB] Failed to delete session logs: {e}")


# ===== Session Logs =====

async def add_log_entry(session_db_id: int, log_data: Dict[str, Any]) -> None:
    """Add log entry to session"""
    client = get_dynamo_client()
    table_name = get_table_name("sessionLogs")
    
    log_key = log_data.get("logKey") or f"{log_data.get('type', 'log')}_{int(datetime.now().timestamp() * 1000)}"
    
    item: Dict[str, Any] = {
        "sessionId": session_db_id,
        "logKey": log_key,
        "type": log_data.get("type", "log"),
        "timestamp": log_data.get("timestamp", int(datetime.now().timestamp() * 1000)),
        "content": log_data.get("content"),
        "metadata": log_data.get("metadata"),
    }
    
    try:
        marshalled_item = marshall_item(item)
        client.put_item(
            TableName=table_name,
            Item=marshalled_item
        )
    except ClientError as e:
        print(f"[DynamoDB] Failed to add log entry: {e}")
        raise


async def get_session_log_entries(session_db_id: int) -> List[Dict[str, Any]]:
    """Get all log entries for a session"""
    client = get_dynamo_client()
    table_name = get_table_name("sessionLogs")
    
    try:
        response = client.query(
            TableName=table_name,
            KeyConditionExpression="sessionId = :sessionId",
            ExpressionAttributeValues={":sessionId": {"N": str(session_db_id)}},
            ScanIndexForward=True
        )
        
        logs = []
        for item in response.get("Items", []):
            unmarshalled = unmarshall_item(item)
            logs.append({
                "sessionId": unmarshalled["sessionId"],
                "logKey": unmarshalled["logKey"],
                "type": unmarshalled.get("type"),
                "timestamp": unmarshalled.get("timestamp"),
                "content": unmarshalled.get("content"),
                "metadata": unmarshalled.get("metadata"),
            })
        
        return logs
    except ClientError as e:
        print(f"[DynamoDB] Failed to get log entries: {e}")
        return []


# ===== Intervention Settings =====

async def get_or_create_intervention_settings(user_id: int) -> Dict[str, Any]:
    """Get or create intervention settings for user"""
    client = get_dynamo_client()
    table_name = get_table_name("interventionSettings")
    
    try:
        response = client.get_item(
            TableName=table_name,
            Key={"userId": {"N": str(user_id)}}
        )
        
        if "Item" in response:
            item = unmarshall_item(response["Item"])
            return {
                "userId": item["userId"],
                "enabled": item.get("enabled", True),
                "monologueThreshold": item.get("monologueThreshold", 30),
                "silenceThreshold": item.get("silenceThreshold", 15),
                "soundEnabled": item.get("soundEnabled", True),
                "visualHintEnabled": item.get("visualHintEnabled", True),
            }
    except ClientError:
        pass
    
    # Create default settings
    now = datetime.now().isoformat()
    default_settings: Dict[str, Any] = {
        "userId": user_id,
        "enabled": True,
        "monologueThreshold": 30,
        "silenceThreshold": 15,
        "soundEnabled": True,
        "visualHintEnabled": True,
        "createdAt": now,
        "updatedAt": now,
    }
    
    try:
        marshalled_item = marshall_item(default_settings)
        client.put_item(
            TableName=table_name,
            Item=marshalled_item
        )
        return default_settings
    except ClientError as e:
        print(f"[DynamoDB] Failed to create intervention settings: {e}")
        raise


async def update_intervention_settings(user_id: int, data: Dict[str, Any]) -> None:
    """Update intervention settings"""
    client = get_dynamo_client()
    table_name = get_table_name("interventionSettings")
    now = datetime.now().isoformat()
    
    updates: List[str] = []
    expression_names: Dict[str, str] = {}
    expression_values: Dict[str, Any] = {}
    
    def set_value(key: str, value: Any):
        name_key = f"#{key}"
        value_key = f":{key}"
        expression_names[name_key] = key
        expression_values[value_key] = value
        updates.append(f"{name_key} = {value_key}")
    
    if "enabled" in data:
        set_value("enabled", data["enabled"])
    if "monologueThreshold" in data:
        set_value("monologueThreshold", data["monologueThreshold"])
    if "silenceThreshold" in data:
        set_value("silenceThreshold", data["silenceThreshold"])
    if "soundEnabled" in data:
        set_value("soundEnabled", data["soundEnabled"])
    if "visualHintEnabled" in data:
        set_value("visualHintEnabled", data["visualHintEnabled"])
    
    set_value("updatedAt", now)
    
    try:
        # Convert expression values to DynamoDB format
        dynamo_values = {}
        for key, value in expression_values.items():
            if value is None:
                dynamo_values[key] = {"NULL": True}
            elif isinstance(value, str):
                dynamo_values[key] = {"S": value}
            elif isinstance(value, (int, float)):
                dynamo_values[key] = {"N": str(value)}
            elif isinstance(value, bool):
                dynamo_values[key] = {"BOOL": value}
        
        client.update_item(
            TableName=table_name,
            Key={"userId": {"N": str(user_id)}},
            UpdateExpression=f"SET {', '.join(updates)}",
            ExpressionAttributeNames=expression_names,
            ExpressionAttributeValues=dynamo_values
        )
    except ClientError as e:
        print(f"[DynamoDB] Failed to update intervention settings: {e}")
        raise


# ===== Security Audit Logs =====

async def put_security_audit_logs(events: List[Dict[str, Any]]) -> None:
    """Put security audit logs in batch"""
    if not events:
        return
    
    client = get_dynamo_client()
    table_name = get_table_name("securityAuditLogs")
    now = datetime.now().isoformat()
    
    import secrets
    import string
    
    def generate_log_id() -> str:
        """Generate random log ID"""
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(21))
    
    requests = []
    for event in events:
        log_id = generate_log_id()
        item: Dict[str, Any] = {
            "logId": log_id,
            "userId": event.get("userId"),
            "sessionId": event.get("sessionId"),
            "eventType": event.get("eventType", "unknown"),
            "severity": event.get("severity", "info"),
            "description": event.get("description", ""),
            "metadata": event.get("metadata"),
            "ipHash": event.get("ipHash"),
            "userAgent": event.get("userAgent"),
            "timestamp": event.get("timestamp", int(datetime.now().timestamp() * 1000)),
            "createdAt": now,
        }
        
        # Use timestamp as sort key if available
        key = {
            "logId": {"S": log_id}
        }
        if "timestamp" in item:
            key["timestamp"] = {"N": str(item["timestamp"])}
        
        requests.append({
            "PutRequest": {
                "Item": marshall_item(item)
            }
        })
    
    # Batch write (max 25 items per batch)
    try:
        for i in range(0, len(requests), 25):
            batch = requests[i:i+25]
            client.batch_write_item(
                RequestItems={table_name: batch}
            )
    except ClientError as e:
        print(f"[DynamoDB] Failed to put security audit logs: {e}")
        raise


async def list_security_audit_logs(options: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """List security audit logs with filtering"""
    if options is None:
        options = {}
    
    client = get_dynamo_client()
    table_name = get_table_name("securityAuditLogs")
    
    scan_params: Dict[str, Any] = {
        "TableName": table_name
    }
    
    filter_expressions: List[str] = []
    expression_values: Dict[str, Any] = {}
    expression_names: Dict[str, str] = {}
    
    if options.get("eventType"):
        filter_expressions.append("eventType = :eventType")
        expression_values[":eventType"] = {"S": options["eventType"]}
    
    if options.get("severity"):
        filter_expressions.append("severity = :severity")
        expression_values[":severity"] = {"S": options["severity"]}
    
    if options.get("userId") is not None:
        filter_expressions.append("userId = :userId")
        expression_values[":userId"] = {"N": str(options["userId"])}
    
    if options.get("sessionId") is not None:
        filter_expressions.append("sessionId = :sessionId")
        expression_values[":sessionId"] = {"N": str(options["sessionId"])}
    
    if options.get("startDate") is not None:
        filter_expressions.append("#ts >= :startDate")
        expression_values[":startDate"] = {"N": str(options["startDate"])}
        expression_names["#ts"] = "timestamp"
    
    if options.get("endDate") is not None:
        filter_expressions.append("#ts <= :endDate")
        expression_values[":endDate"] = {"N": str(options["endDate"])}
        expression_names["#ts"] = "timestamp"
    
    if filter_expressions:
        scan_params["FilterExpression"] = " AND ".join(filter_expressions)
        scan_params["ExpressionAttributeValues"] = expression_values
        if expression_names:
            scan_params["ExpressionAttributeNames"] = expression_names
    
    all_items: List[Dict[str, Any]] = []
    last_evaluated_key = None
    
    try:
        while True:
            if last_evaluated_key:
                scan_params["ExclusiveStartKey"] = last_evaluated_key
            
            response = client.scan(**scan_params)
            
            if response.get("Items"):
                for item in response["Items"]:
                    unmarshalled = unmarshall_item(item)
                    all_items.append({
                        "id": generate_id_from_uuid(unmarshalled.get("logId", "")),
                        "userId": unmarshalled.get("userId"),
                        "sessionId": unmarshalled.get("sessionId"),
                        "eventType": unmarshalled.get("eventType"),
                        "severity": unmarshalled.get("severity", "info"),
                        "description": unmarshalled.get("description"),
                        "metadata": unmarshalled.get("metadata"),
                        "ipHash": unmarshalled.get("ipHash"),
                        "userAgent": unmarshalled.get("userAgent"),
                        "timestamp": unmarshalled.get("timestamp"),
                        "createdAt": datetime.fromisoformat(unmarshalled["createdAt"]) if unmarshalled.get("createdAt") else datetime.now(),
                    })
            
            last_evaluated_key = response.get("LastEvaluatedKey")
            if not last_evaluated_key:
                break
        
        # Sort by timestamp descending
        all_items.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
        return all_items
    except ClientError as e:
        print(f"[DynamoDB] Failed to list security audit logs: {e}")
        return []


async def get_security_audit_logs(options: Dict[str, Any] = None) -> Dict[str, Any]:
    """Get security audit logs with pagination"""
    if options is None:
        options = {}
    
    page = options.get("page", 1)
    limit = min(options.get("limit", 50), 100)
    
    all_logs = await list_security_audit_logs(options)
    
    # Pagination
    start_index = (page - 1) * limit
    end_index = start_index + limit
    paginated_logs = all_logs[start_index:end_index]
    
    return {
        "logs": paginated_logs,
        "total": len(all_logs),
        "page": page,
        "limit": limit,
        "totalPages": (len(all_logs) + limit - 1) // limit,
    }


# ===== Admin Functions =====

async def get_all_users(include_deleted: bool = False) -> List[Dict[str, Any]]:
    """Get all users (admin only)"""
    client = get_dynamo_client()
    table_name = get_table_name("users")
    
    try:
        scan_params: Dict[str, Any] = {
            "TableName": table_name
        }
        
        if not include_deleted:
            scan_params["FilterExpression"] = "attribute_not_exists(deletedAt) OR deletedAt = :null"
            scan_params["ExpressionAttributeValues"] = {":null": {"NULL": True}}
        
        all_items: List[Dict[str, Any]] = []
        last_evaluated_key = None
        
        while True:
            if last_evaluated_key:
                scan_params["ExclusiveStartKey"] = last_evaluated_key
            
            response = client.scan(**scan_params)
            
            if response.get("Items"):
                for item in response["Items"]:
                    unmarshalled = unmarshall_item(item)
                    user_id = generate_id_from_uuid(unmarshalled["openId"])
                    all_items.append({
                        "id": user_id,
                        "openId": unmarshalled["openId"],
                        "name": unmarshalled.get("name"),
                        "email": unmarshalled.get("email"),
                        "loginMethod": unmarshalled.get("loginMethod"),
                        "role": unmarshalled.get("role", "user"),
                        "deletedAt": datetime.fromisoformat(unmarshalled["deletedAt"]) if unmarshalled.get("deletedAt") else None,
                        "createdAt": datetime.fromisoformat(unmarshalled["createdAt"]) if unmarshalled.get("createdAt") else datetime.now(),
                        "updatedAt": datetime.fromisoformat(unmarshalled["updatedAt"]) if unmarshalled.get("updatedAt") else datetime.now(),
                        "lastSignedIn": datetime.fromisoformat(unmarshalled["lastSignedIn"]) if unmarshalled.get("lastSignedIn") else datetime.now(),
                    })
            
            last_evaluated_key = response.get("LastEvaluatedKey")
            if not last_evaluated_key:
                break
        
        return all_items
    except ClientError as e:
        print(f"[DynamoDB] Failed to get all users: {e}")
        return []


async def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Get user by ID (admin only)"""
    # DynamoDB doesn't have id as primary key, so we need to scan
    all_users = await get_all_users(include_deleted=True)
    return next((user for user in all_users if user.get("id") == user_id), None)


async def soft_delete_user(user_id: int) -> bool:
    """Soft delete user (admin only)"""
    user = await get_user_by_id(user_id)
    if not user:
        raise ValueError("User not found")
    
    if user.get("deletedAt"):
        return True  # Already deleted
    
    client = get_dynamo_client()
    table_name = get_table_name("users")
    now = datetime.now().isoformat()
    
    # Update user with deletedAt
    try:
        client.update_item(
            TableName=table_name,
            Key={"openId": {"S": user["openId"]}},
            UpdateExpression="SET deletedAt = :deletedAt, updatedAt = :updatedAt",
            ExpressionAttributeValues={
                ":deletedAt": {"S": now},
                ":updatedAt": {"S": now}
            }
        )
        
        # Invalidate cache
        cache_key = f"user:{user['openId']}"
        from app.core.database import _cache
        if cache_key in _cache:
            del _cache[cache_key]
        
        return True
    except ClientError as e:
        print(f"[DynamoDB] Failed to soft delete user: {e}")
        raise
