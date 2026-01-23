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
    print("حساب المتوسط بطريقتين:")
    print(f"{'='*80}\n")
    
    # Group by student
    students = {}
    for student_id, full_name, subject_name, final_grade in records:
        if student_id not in students:
            students[student_id] = {
                'name': full_name,
                'grades': []
            }
        if final_grade is not None:
            students[student_id]['grades'].append(float(final_grade))
    
    # Method 1: Average of all records (current implementation)
    all_grades = []
    for student_data in students.values():
        all_grades.extend(student_data['grades'])
    
    method1_avg = sum(all_grades) / len(all_grades) if all_grades else 0
    
    print("الطريقة 1: متوسط جميع السجلات (الطريقة الحالية)")
    print(f"  مجموع العلامات: {sum(all_grades)}")
    print(f"  عدد السجلات: {len(all_grades)}")
    print(f"  المتوسط: {method1_avg:.2f}\n")
    
    # Method 2: Average of student averages
    student_averages = []
    print("الطريقة 2: متوسط معدلات الطلاب")
    for student_id, data in students.items():
        if data['grades']:
            student_avg = sum(data['grades']) / len(data['grades'])
            student_averages.append(student_avg)
            print(f"  {data['name']}: {student_avg:.2f} (من {len(data['grades'])} مادة)")
    
    method2_avg = sum(student_averages) / len(student_averages) if student_averages else 0
    print(f"\n  متوسط معدلات الطلاب: {method2_avg:.2f}\n")
    
    print(f"{'='*80}")
    print(f"الفرق بين الطريقتين: {abs(method1_avg - method2_avg):.2f}")
    print(f"{'='*80}\n")
    
    # Show what the user expects
    print("ملاحظة: إذا كان المستخدم يتوقع متوسط أقل من 50،")
    print("فهذا يعني أنه يريد متوسط معدلات الطلاب (الطريقة 2)")
    print("لأن الطالب الثاني معدله منخفض جداً ويجب أن يؤثر بشكل متساوي مع الطالب الأول\n")
    
finally:
    db.close()
