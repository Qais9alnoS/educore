"""
Database Cleanup Script: Fix Orphaned Teacher Freetime Slots

This script identifies and fixes teacher freetime slots that are marked as "assigned"
but no longer have a corresponding schedule entry in the database.

This issue occurs when schedules are deleted without properly restoring teacher availability.
"""

import sys
import os
import json
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, and_, event
from sqlalchemy.orm import sessionmaker
from app.models.teachers import Teacher
from app.models.schedules import Schedule
from app.config import settings

def cleanup_orphaned_teacher_slots():
    """
    Clean up teacher freetime slots that are marked as assigned
    but don't have corresponding schedule entries.
    """
    # Import SQLCipher
    try:
        import sqlcipher3 as sqlite3
    except ImportError:
        import sqlite3
    
    # Create engine with encryption
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False
    )
    
    # Set SQLCipher encryption key
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute(f"PRAGMA key='{settings.DATABASE_PASSWORD}'")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        print("=" * 80)
        print("Starting Teacher Freetime Slots Cleanup")
        print("=" * 80)
        print()
        
        # Get all active teachers
        teachers = db.query(Teacher).filter(Teacher.is_active == True).all()
        print(f"Found {len(teachers)} active teachers to check")
        print()
        
        total_cleaned = 0
        teachers_affected = []
        
        for teacher in teachers:
            if not teacher.free_time_slots:
                continue
            
            try:
                slots_data = json.loads(teacher.free_time_slots)
            except (json.JSONDecodeError, TypeError):
                print(f"⚠️  Warning: Could not parse free_time_slots for teacher {teacher.full_name} (ID: {teacher.id})")
                continue
            
            if not slots_data:
                continue
            
            modified = False
            slots_cleaned_for_teacher = 0
            
            for slot in slots_data:
                if slot.get('status') != 'assigned':
                    continue
                
                assignment = slot.get('assignment')
                if not assignment:
                    # Assigned status but no assignment data - clean it
                    slot['status'] = 'free'
                    slot['is_free'] = True
                    slot['assignment'] = None
                    modified = True
                    slots_cleaned_for_teacher += 1
                    continue
                
                # Check if the schedule still exists
                class_id = assignment.get('class_id')
                section = assignment.get('section')
                day = slot.get('day')
                period = slot.get('period')
                
                if class_id is None or section is None or day is None or period is None:
                    # Invalid assignment data - clean it
                    slot['status'] = 'free'
                    slot['is_free'] = True
                    slot['assignment'] = None
                    modified = True
                    slots_cleaned_for_teacher += 1
                    continue
                
                # Convert 0-based day/period to 1-based for database query
                day_of_week = day + 1
                period_number = period + 1
                
                # Check if a schedule exists for this slot
                schedule_exists = db.query(Schedule).filter(
                    and_(
                        Schedule.teacher_id == teacher.id,
                        Schedule.class_id == class_id,
                        Schedule.section == str(section),
                        Schedule.day_of_week == day_of_week,
                        Schedule.period_number == period_number
                    )
                ).first()
                
                if not schedule_exists:
                    # Orphaned slot - the schedule was deleted but slot wasn't restored
                    print(f"  🔧 Cleaning orphaned slot for {teacher.full_name}:")
                    print(f"     Day {day_of_week}, Period {period_number}")
                    print(f"     Was assigned to: Class {class_id}, Section {section}")
                    
                    slot['status'] = 'free'
                    slot['is_free'] = True
                    slot['assignment'] = None
                    modified = True
                    slots_cleaned_for_teacher += 1
            
            if modified:
                teacher.free_time_slots = json.dumps(slots_data)
                teachers_affected.append({
                    'id': teacher.id,
                    'name': teacher.full_name,
                    'slots_cleaned': slots_cleaned_for_teacher
                })
                total_cleaned += slots_cleaned_for_teacher
                print(f"✅ Cleaned {slots_cleaned_for_teacher} orphaned slots for {teacher.full_name}")
                print()
        
        # Commit all changes
        if total_cleaned > 0:
            db.commit()
            print()
            print("=" * 80)
            print("Cleanup Summary")
            print("=" * 80)
            print(f"Total orphaned slots cleaned: {total_cleaned}")
            print(f"Teachers affected: {len(teachers_affected)}")
            print()
            print("Affected teachers:")
            for teacher_info in teachers_affected:
                print(f"  - {teacher_info['name']} (ID: {teacher_info['id']}): {teacher_info['slots_cleaned']} slots")
            print()
            print("✅ Database cleanup completed successfully!")
        else:
            print()
            print("=" * 80)
            print("✅ No orphaned slots found - database is clean!")
            print("=" * 80)
        
        return {
            'success': True,
            'total_cleaned': total_cleaned,
            'teachers_affected': len(teachers_affected),
            'details': teachers_affected
        }
        
    except Exception as e:
        db.rollback()
        print()
        print("=" * 80)
        print(f"❌ Error during cleanup: {str(e)}")
        print("=" * 80)
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'error': str(e)
        }
    finally:
        db.close()

if __name__ == "__main__":
    print()
    print("🔧 Teacher Freetime Slots Database Cleanup Tool")
    print()
    print("This script will:")
    print("  1. Scan all teacher freetime slots")
    print("  2. Find slots marked as 'assigned' without corresponding schedules")
    print("  3. Restore these orphaned slots to 'free' status")
    print()
    
    input("Press Enter to continue or Ctrl+C to cancel...")
    print()
    
    result = cleanup_orphaned_teacher_slots()
    
    print()
    if result['success']:
        print("🎉 Cleanup completed successfully!")
    else:
        print("❌ Cleanup failed. Please check the error messages above.")
        sys.exit(1)
