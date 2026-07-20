import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import get_db
from core.auth import get_password_hash
from app.models import User
import uuid

def create_test_user():
    print("Creating new user...")
    db = next(get_db())
    
    try:
        # Check if user already exists
        email = "testuser@example.com"
        user = db.query(User).filter(User.email == email).first()
        if user:
            print(f"✅ User already exists: {user.email}")
            print(f"   ID: {user.id}")
            return user
        
        # Create new user
        hashed_password = get_password_hash("testpass123")
        new_user = User(
            id=uuid.uuid4(),
            email=email,
            hashed_password=hashed_password,  # ← Using hashed_password
            name="Test User",
            role="PG-CCRAS",
            status="Active"
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        print(f"✅ User created successfully!")
        print(f"   Email: {new_user.email}")
        print(f"   Password: testpass123")
        print(f"   ID: {new_user.id}")
        print(f"   Name: {new_user.name}")
        print(f"   Role: {new_user.role}")
        return new_user
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating user: {e}")
        return None

if __name__ == "__main__":
    create_test_user()