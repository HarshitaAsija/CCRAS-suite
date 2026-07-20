from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import uuid

from app.database import get_db
from core.auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    get_password_hash,
    get_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from app.models import User

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
    responses={404: {"description": "Not found"}},
)

@router.post("/signup")
def register_user(
    email: str = Query(...),
    password: str = Query(...),
    name: str = Query("User"),
    role: str = Query("PG-CCRAS"),
    db: Session = Depends(get_db)
):
    # Check if user exists
    db_user = get_user(db, email=email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        # Create new user - FIX: use hashed_password instead of password_hash
        password_hash = get_password_hash(password)
        new_user = User(
            id=uuid.uuid4(),
            email=email, 
            hashed_password=password_hash,  # ← FIXED: changed from password_hash
            name=name,
            role=role,
            status="Active"
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return {
            "message": "User created successfully",
            "user": {
                "id": str(new_user.id),
                "email": new_user.email,
                "name": new_user.name,
                "role": new_user.role
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error creating user: {str(e)}")

@router.post("/login")
def login_user(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role
        }
    }

@router.get("/me")
def read_current_user(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "created_at": current_user.created_at,
    }