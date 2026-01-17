def test_auth_me_returns_user(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["role"] == "user"


def test_logout_clears_session(client):
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
