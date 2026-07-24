import psycopg2

try:
    conn = psycopg2.connect(
        host='100.101.210.91',
        port='5432',
        dbname='ccras_db',
        user='readonly',
        password='Read1234'
    )
    print("Connected via Python!")
    conn.close()
except Exception as e:
    print(f"Failed to connect via Python: {e}")
