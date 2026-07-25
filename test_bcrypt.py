import sys
sys.path.insert(0, '/mnt/c/Users/Khush/Projects/CCRAS-suite/recap')
from passlib.hash import bcrypt
try:
    hash = bcrypt.hash("testpass123")
    print("Success:", hash)
except Exception as e:
    print("Error:", e)