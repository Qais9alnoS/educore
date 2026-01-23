import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.database import SessionLocal
from app.models.students import Student, StudentAcademic
from app.models.academic import Subject

db = SessionLocal()

try:
    # Get all morning students with their final exam grades
    records = db.query(
        Student.id,
        Student.full_name,
        Student.session_type,
        Subject.subject_name,
        StudentAcademic.final_exam_grades
    ).join(
        StudentAcademic, Student.id == StudentAcademic.student_id
    ).join(
        Subject, StudentAcademic.subject_id == Subject.id
    ).filter(
        StudentAcademic.academic_year_id == 1,
        Student.is_active == True,
        Student.session_type == 'morning'
    ).all()
    
    print(f"\n{'='*80}")
    print(f"عدد السجلات للطلاب الصباحيين: {len(records)}")
    print(f"{'='*80}\n")
    
    if records:
        # Group by student
        students = {}
        for student_id, full_name, session_type, subject_name, final_grade in records:
            if student_id not in students:
                students[student_id] = {
                    'name': full_name,
                    'subjects': []
                }
            students[student_id]['subjects'].append({
                'subject': subject_name,
                'final_grade': float(final_grade) if final_grade else None
            })
        
        # Print details
        total_sum = 0
        total_count = 0
        
        for student_id, data in students.items():
            print(f"الطالب: {data['name']} (ID: {student_id})")
            print("-" * 60)
            for subj in data['subjects']:
                grade = subj['final_grade']
                print(f"  المادة: {subj['subject']:<30} | الفحص النهائي: {grade if grade else 'لا يوجد'}")
                if grade is not None:
                    total_sum += grade
                    total_count += 1
            print()
        
        print(f"{'='*80}")
        print(f"إجمالي مجموع العلامات: {total_sum}")
        print(f"إجمالي عدد السجلات: {total_count}")
        if total_count > 0:
            average = total_sum / total_count
            print(f"المتوسط الكلي: {average:.2f} من 100")
        print(f"{'='*80}\n")
    else:
        print("لا توجد بيانات للطلاب الصباحيين\n")
    
finally:
    db.close()
