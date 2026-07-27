import sys
sys.path.append('.')
from app.database import get_db
from core.auth import authenticate_user

db = next(get_db())
user = authenticate_user(db, 'testuser@example.com', 'testpass123')
if user:
    print('Authenticated:', user.email)
else:
    print('Failed')
