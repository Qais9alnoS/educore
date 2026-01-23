"""
Migration script to update existing student payments to 'completed' status.
This fixes the issue where payments weren't being counted in balance calculations.
"""

import os
from sqlalchemy import create_engine, text

def run_migration():
    """Run the payment status migration"""
    
    # Get database URL - use the actual database file
    database_url = os.getenv('DATABASE_URL', 'sqlite:///./backend/school_management.db')
    
    # Create database engine
    engine = create_engine(database_url)
    
    print("🔄 Starting payment status migration...")
    print(f"📁 Database: {database_url}")
    
    with engine.connect() as connection:
        # Start transaction
        trans = connection.begin()
        
        try:
            # Get count before update
            result = connection.execute(text("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN payment_status = 'pending' OR payment_status IS NULL THEN 1 ELSE 0 END) as pending
                FROM student_payments
            """))
            row = result.fetchone()
            total_before = row[0] if row else 0
            pending_before = row[1] if row else 0
            
            print(f"📊 Found {total_before} total payments, {pending_before} with pending/null status")
            
            # Update payments
            result = connection.execute(text("""
                UPDATE student_payments 
                SET payment_status = 'completed' 
                WHERE payment_status = 'pending' OR payment_status IS NULL
            """))
            
            updated_count = result.rowcount
            print(f"✅ Updated {updated_count} payments to 'completed' status")
            
            # Verify the update
            result = connection.execute(text("""
                SELECT 
                    COUNT(*) as total_payments,
                    SUM(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END) as completed_payments,
                    SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) as pending_payments
                FROM student_payments
            """))
            row = result.fetchone()
            
            if row:
                print(f"\n📈 Final status:")
                print(f"   Total payments: {row[0]}")
                print(f"   Completed: {row[1]}")
                print(f"   Pending: {row[2]}")
            
            # Commit transaction
            trans.commit()
            print("\n✅ Migration completed successfully!")
            
        except Exception as e:
            trans.rollback()
            print(f"\n❌ Migration failed: {str(e)}")
            raise

if __name__ == "__main__":
    run_migration()
