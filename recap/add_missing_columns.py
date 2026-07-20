from sqlalchemy import text
from app.database import engine

with engine.connect() as conn:
    # Add name column if it doesn't exist
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL DEFAULT 'User'"))
        conn.commit()
        print("✅ Added 'name' column")
    except Exception as e:
        print(f"⚠️ Could not add 'name' column: {e}")
    
    # Add role column if it doesn't exist
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'PG-CCRAS'"))
        conn.commit()
        print("✅ Added 'role' column")
    except Exception as e:
        print(f"⚠️ Could not add 'role' column: {e}")
    
    # Add other columns if needed
    for col, col_type in [
        ('status', "VARCHAR(20) DEFAULT 'Active'"),
        ('avatar', 'TEXT'),
        ('phone', 'VARCHAR(20)'),
        ('department', 'VARCHAR(100)'),
        ('designation', 'VARCHAR(100)'),
        ('last_login', 'TIMESTAMP WITH TIME ZONE'),
        ('password_reset_token', 'VARCHAR(255)'),
        ('password_reset_expires', 'TIMESTAMP WITH TIME ZONE'),
        ('email_verified', 'BOOLEAN DEFAULT FALSE'),
        ('updated_at', "TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP")
    ]:
        try:
            conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col} {col_type}"))
            conn.commit()
            print(f"✅ Added '{col}' column")
        except Exception as e:
            print(f"⚠️ Could not add '{col}' column: {e}")
