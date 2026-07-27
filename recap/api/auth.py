from datetime import timedelta, datetime, timezone
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import uuid
import secrets

from app.database import get_db
from core.auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    get_password_hash,
    get_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    normalize_email,
)
from app.models import User
from pydantic import BaseModel


class SignupRequest(BaseModel):
    email: str
    password: str
    name: str = "User"
    role: str = "PG-CCRAS"


router = APIRouter(
    prefix="/api/auth",
    tags=["auth"],
    responses={404: {"description": "Not found"}},
)


@router.post("/signup")
def register_user(
    signup_data: SignupRequest,
    db: Session = Depends(get_db)
):
    # Normalize email
    email_norm = normalize_email(signup_data.email)
    # Check if user exists
    db_user = get_user(db, email_norm)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        password_hash = get_password_hash(signup_data.password)
        new_user = User(
            id=uuid.uuid4(),
            email=email_norm,
            hashed_password=password_hash,
            name=signup_data.name,
            role=signup_data.role,
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


@router.post("/forgot-password")
def forgot_password(email: str = Body(..., embed=True), db: Session = Depends(get_db)):
    # Find user by email
    user = get_user(db, email)
    if not user:
        # For security, we don't reveal that the email doesn't exist
        return {"message": "If the email exists, a reset link has been sent."}
    # Generate a random token
    token = secrets.token_urlsafe(32)
    # Set expiry to 1 hour from now (timezone-aware)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    user.password_reset_token = token
    user.password_reset_expires = expires
    db.commit()

    # Generate reset URL
    reset_url = f"http://localhost:3000/reset-password/{token}"

    # Send email with reset link
    try:
        send_reset_email(email, reset_url)
        print(f"Password reset email sent to {email}")
    except Exception as e:
        print(f"Failed to send email: {e}")
        # Fallback to logging (for development)
        print(f"Password reset link for {email}: {reset_url}")

    return {"message": "If the email exists, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(token: str = Body(...), password: str = Body(...), db: Session = Depends(get_db)):
    from datetime import datetime, timezone
    user = db.query(User).filter(User.password_reset_token == token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    if user.password_reset_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token has expired")
    # Update password
    hashed_password = get_password_hash(password)
    user.hashed_password = hashed_password
    # Clear the token
    user.password_reset_token = None
    user.password_reset_expires = None
    db.commit()
    return {"message": "Password has been reset successfully."}