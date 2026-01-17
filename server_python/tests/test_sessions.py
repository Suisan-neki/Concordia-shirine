def test_start_session(client, monkeypatch):
    from app.services.session_service import session_service

    async def mock_start_session(user_id: int):
        return {"sessionId": "test-session", "startTime": 1234567890}

    monkeypatch.setattr(session_service, "start_session", mock_start_session)

    response = client.post("/api/v1/sessions/start")
    assert response.status_code == 200
    data = response.json()
    assert data["sessionId"] == "test-session"
    assert data["startTime"] == 1234567890


def test_end_session(client, monkeypatch):
    from app.services.session_service import session_service

    async def mock_end_session(user_id: int, session_id: str, data: dict):
        return {
            "success": True,
            "securitySummary": {},
            "securityScore": 88,
        }

    monkeypatch.setattr(session_service, "end_session", mock_end_session)

    payload = {
        "sessionId": "test-session",
        "endTime": 111,
        "duration": 111,
        "sceneDistribution": {"調和": 1},
        "eventCounts": {"event": 1},
        "insights": ["ok"],
    }
    response = client.post("/api/v1/sessions/test-session/end", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["securityScore"] == 88


def test_list_sessions(client, monkeypatch):
    from app.services.session_service import session_service

    async def mock_list_sessions(user_id: int, limit: int = 50):
        return [
            {
                "id": 1,
                "sessionId": "s1",
                "userId": user_id,
                "startTime": 1,
                "createdAt": "2024-01-01T00:00:00",
                "updatedAt": "2024-01-01T00:00:00",
            }
        ]

    monkeypatch.setattr(session_service, "list_user_sessions", mock_list_sessions)

    response = client.get("/api/v1/sessions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["sessionId"] == "s1"


def test_get_session_details(client, monkeypatch):
    from app.services.session_service import session_service

    async def mock_get_session_with_details(user_id: int, session_id: str):
        return {
            "id": 1,
            "sessionId": session_id,
            "userId": user_id,
            "startTime": 1,
            "createdAt": "2024-01-01T00:00:00",
            "updatedAt": "2024-01-01T00:00:00",
            "logs": [],
        }

    monkeypatch.setattr(session_service, "get_session_with_details", mock_get_session_with_details)

    response = client.get("/api/v1/sessions/s1")
    assert response.status_code == 200
    data = response.json()
    assert data["sessionId"] == "s1"


def test_add_log_entry(client, monkeypatch):
    from app.services.session_service import session_service

    async def mock_add_log_entry(user_id: int, session_id: str, log_type: str, timestamp: int, content=None, metadata=None):
        return {"success": True}

    monkeypatch.setattr(session_service, "add_log_entry", mock_add_log_entry)

    payload = {
        "sessionId": "s1",
        "type": "speech",
        "timestamp": 123,
        "content": "hello",
    }
    response = client.post("/api/v1/sessions/s1/logs", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


def test_delete_session(client, monkeypatch):
    from app.services.session_service import session_service

    async def mock_delete_session(user_id: int, session_id: str):
        return {"success": True}

    monkeypatch.setattr(session_service, "delete_session", mock_delete_session)

    response = client.delete("/api/v1/sessions/s1")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
