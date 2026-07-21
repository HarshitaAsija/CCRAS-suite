import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, types
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db
from app.models import User, Paper

# Set up a test database using SQLite
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Temporarily replace the embedding column type in Paper model to be a String for SQLite
# We use a TypeDecorator that acts as a String.
class MutableString(types.TypeDecorator):
    """A mutable string type."""
    impl = types.VARCHAR
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return value

    def process_result_value(self, value, dialect):
        return value

# Replace the type of the embedding column
Paper.__table__.c.embedding.type = MutableString()

# Now create all tables
Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def test_register_user():
    response = client.post(
        "/api/auth/register",
        json={"email": "test@example.com", "password": "testpassword"},
    )
    assert response.status_code == 200
    assert response.json() == {"message": "User created successfully"}

def test_register_duplicate_email():
    # First registration
    client.post(
        "/api/auth/register",
        json={"email": "test2@example.com", "password": "testpassword"},
    )
    # Second registration with same email
    response = client.post(
        "/api/auth/register",
        json={"email": "test2@example.com", "password": "testpassword"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered"

def test_login_user():
    # Register a user
    client.post(
        "/api/auth/register",
        json={"email": "test3@example.com", "password": "testpassword"},
    )
    # Login
    response = client.post(
        "/api/auth/login",
        data={"username": "test3@example.com", "password": "testpassword"},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"

def test_login_wrong_password():
    # Register a user
    client.post(
        "/api/auth/register",
        json={"email": "test4@example.com", "password": "testpassword"},
    )
    # Login with wrong password
    response = client.post(
        "/api/auth/login",
        data={"username": "test4@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401

def test_get_current_user():
    # Register a user
    client.post(
        "/api/auth/register",
        json={"email": "test5@example.com", "password": "testpassword"},
    )
    # Login to get token
    login_response = client.post(
        "/api/auth/login",
        data={"username": "test5@example.com", "password": "testpassword"},
    )
    token = login_response.json()["access_token"]
    # Get current user
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == "test5@example.com"
    assert "id" in response.json()
    assert "created_at" in response.json()

def test_get_current_user_invalid_token():
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalidtoken"},
    )
    assert response.status_code == 401