import os
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session", autouse=True)
def set_test_env():
    os.environ.setdefault("JWT_SECRET", "test-secret")
    os.environ.setdefault("VITE_APP_ID", "test-app-id")
    os.environ.setdefault("NODE_ENV", "development")
    os.environ.setdefault("COGNITO_REGION", "ap-northeast-1")
    os.environ.setdefault("COGNITO_USER_POOL_ID", "test-pool")
    os.environ.setdefault("COGNITO_CLIENT_ID", "test-client")
    yield


@pytest.fixture()
def client():
    from main import app
    from app.core.auth import get_current_user, get_current_admin_user, get_current_user_optional

    def override_user():
        return {"id": 1, "role": "user"}

    def override_admin():
        return {"id": 1, "role": "admin"}

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_current_user_optional] = override_user
    app.dependency_overrides[get_current_admin_user] = override_admin

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
