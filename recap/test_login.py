import sys
sys.path.append('.')
import importlib.util
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Load auth module directly from file
spec = importlib.util.spec_from_file_location("auth_module", "api/auth.py")
auth_module = importlib.util.module_from_spec(spec)
sys.modules["auth_module"] = auth_module
spec.loader.exec_module(auth_module)

app = FastAPI()
app.include_router(auth_module.router)  # no additional prefix

client = TestClient(app)

def test_login():
    response = client.post(
        "/api/auth/login",
        data={"username": "testuser@example.com", "password": "testpass123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    print("Status code:", response.status_code)
    print("Response JSON:", response.json())
    assert response.status_code == 200
    assert "access_token" in response.json()

if __name__ == "__main__":
    try:
        test_login()
        print("Test passed!")
    except Exception as e:
        print("Test failed:", e)
        raise
