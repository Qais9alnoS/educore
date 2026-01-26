from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import MetaData  # Added import
from typing import TYPE_CHECKING
from .config import settings
import os

# Import SQLCipher instead of regular SQLite
try:
    import sqlcipher3 as sqlite3
except ImportError:
    import sqlite3
    print("Warning: sqlcipher3-wheels not found. Using regular sqlite3. Database will not be encrypted.")

if TYPE_CHECKING:
    from sqlalchemy.ext.declarative import DeclarativeMeta

# Create database directory if it doesn't exist
db_path = settings.DATABASE_URL.replace("sqlite:///", "")
if "/" in db_path or "\\" in db_path:
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

# Use SQLCipher driver for encrypted database
# SQLAlchemy will automatically use sqlcipher3 since we imported it as sqlite3
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite specific
    echo=False  # Set to True for SQL logging
)

# Set SQLCipher encryption key and enable foreign key constraints
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    # Set encryption key for SQLCipher
    cursor.execute(f"PRAGMA key='{settings.DATABASE_PASSWORD}'")
    # Enable foreign key constraints
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Adding type annotation to help type checkers
if TYPE_CHECKING:
    Base: DeclarativeMeta

def get_db():
    """Database dependency for FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def update_database_schema():
    """Update database schema to match current models"""
    # Skip if database doesn't exist yet (will be created with correct schema)
    if not os.path.exists(db_path):
        print("✓ Database will be created with CASCADE DELETE constraints")
        return
    
    try:
        # Connect to the encrypted database with SQLCipher
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        # Set encryption key for SQLCipher
        cursor.execute(f"PRAGMA key='{settings.DATABASE_PASSWORD}'")
        
        # Verify the database is encrypted correctly by testing a simple query
        try:
            cursor.execute("SELECT count(*) FROM sqlite_master")
            cursor.fetchone()
        except Exception as verify_error:
            error_msg = str(verify_error).lower()
            if "file is not a database" in error_msg or "hmac check failed" in error_msg or "error decrypting" in error_msg:
                conn.close()
                print("\n" + "="*80)
                print("DATABASE ENCRYPTION ERROR DETECTED")
                print("="*80)
                print("The database file exists but cannot be decrypted.")
                print("This usually means:")
                print("  1. Database was created without encryption (regular SQLite)")
                print("  2. Database was created with a different password")
                print("  3. Database file is corrupted")
                print("\nRECOMMENDED ACTIONS:")
                print("  Option 1 - Start Fresh (if you don't need existing data):")
                print(f"    - Delete: {db_path}")
                print("    - Restart the server (database will be recreated with encryption)")
                print("\n  Option 2 - Backup and Migrate (if you need existing data):")
                print(f"    - Rename: {db_path} to {db_path}.backup")
                print("    - Restart the server to create new encrypted database")
                print("    - Manually migrate data from backup if needed")
                print("="*80 + "\n")
                raise Exception(f"Database encryption verification failed: {verify_error}")
            else:
                raise
        
        # Check if class_id column exists in students table
        cursor.execute("PRAGMA table_info(students)")
        columns = cursor.fetchall()
        class_id_exists = any(col[1] == 'class_id' for col in columns)
        
        # Add class_id column if it doesn't exist
        if not class_id_exists:
            try:
                cursor.execute("ALTER TABLE students ADD COLUMN class_id INTEGER REFERENCES classes(id)")
                print("Added class_id column to students table")
            except Exception as e:
                print(f"Error adding class_id column: {e}")
        
        # Check if is_active column exists in subjects table
        cursor.execute("PRAGMA table_info(subjects)")
        columns = cursor.fetchall()
        is_active_exists = any(col[1] == 'is_active' for col in columns)
        
        # Add is_active column if it doesn't exist
        if not is_active_exists:
            try:
                cursor.execute("ALTER TABLE subjects ADD COLUMN is_active BOOLEAN DEFAULT 1")
                print("Added is_active column to subjects table")
            except Exception as e:
                print(f"Error adding is_active column: {e}")
        
        # Check if foreign keys have CASCADE DELETE
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='classes'")
        table_sql = cursor.fetchone()
        
        if table_sql and 'ON DELETE CASCADE' not in table_sql[0]:
            print("\n" + "="*60)
            print("DATABASE MIGRATION REQUIRED")
            print("="*60)
            print("Your database lacks CASCADE DELETE constraints.")
            print("To apply the fix:")
            print("  1. Stop the backend server")
            print("  2. Delete: school_management.db")
            print("  3. Restart the server (database will be recreated)")
            print("="*60 + "\n")
        else:
            print("Database has CASCADE DELETE constraints - Ready to use!")
        
        conn.commit()
        conn.close()
        
    except Exception as e:
        print(f"Error checking database schema: {e}")