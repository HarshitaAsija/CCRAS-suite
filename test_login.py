import os
os.environ['POSTGRES_USER'] = 'postgres'
os.environ['POSTGRES_PASSWORD'] = 'Pg1234'
os.environ['POSTGRES_HOST'] = '100.101.210.91'
os.environ['POSTGRES_PORT'] = '5432'
os.environ['POSTGRES_DB'] = 'ccras_db'
os.environ['DATABASE_URL'] = 'postgresql://postgres:Pg1234@100.101.210.91:5432/ccras_db'

from fastapi.testclient import TestClient
from recap.main import app

client = TestClient(app)

response = client.post(
    "/api/auth/login",
    data={"username": "testuser@example.com", "password": "testpass123"}
)
print("Status code:", response.status_code)
print("Response body:", response.json())
