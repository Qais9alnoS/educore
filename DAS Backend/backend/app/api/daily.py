from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Optional
from datetime import date, datetime, timedelta
from app.database import get_db
from app.models.students import Student
from app.models.academic import Class
from app.models import (
    Holiday, StudentDailyAttendance, TeacherPeriodAttendance, 
    StudentAction, WhatsAppGroupConfig, Teacher, 
    Schedule, AcademicYear, Subject, User, StudentAcademic,
    AcademicSettings
)
from app.models.students import StudentBehaviorRecord
from app.schemas.daily import (
    HolidayCreate, HolidayUpdate, HolidayResponse,
    StudentDailyAttendanceCreate, StudentDailyAttendanceUpdate, 
    StudentDailyAttendanceResponse, StudentDailyAttendanceBulk,
    TeacherPeriodAttendanceCreate, TeacherPeriodAttendanceUpdate,
    TeacherPeriodAttendanceResponse, TeacherPeriodAttendanceBulk,
    StudentActionCreate, StudentActionUpdate, StudentActionResponse,
    WhatsAppGroupConfigCreate, WhatsAppGroupConfigUpdate, WhatsAppGroupConfigResponse,
    DailyPageSummary, WhatsAppMessage, TeacherScheduleInfo
)
from app.core.dependencies import get_current_user
from app.utils.history_helper import log_daily_action
from app.services.analytics_service import CacheManager

router = APIRouter()

# ==================== Helper Functions ====================

def update_academic_averages(db: Session, student_id: int, academic_year_id: int, subject_id: int, action_type: str):
    """تحديث المتوسطات الأكاديمية للطالب في مادة معينة"""
    print(f"\n{'='*60}")
    print(f"🔄 update_academic_averages called:")
    print(f"   student_id={student_id}, academic_year_id={academic_year_id}")
    print(f"   subject_id={subject_id}, action_type={action_type}")
    print(f"{'='*60}")
    
    # احصل أو أنشئ سجل StudentAcademic
    student_academic = db.query(StudentAcademic).filter(
        and_(
            StudentAcademic.student_id == student_id,
            StudentAcademic.academic_year_id == academic_year_id,
            StudentAcademic.subject_id == subject_id
        )
    ).first()
    
    if not student_academic:
        print(f"📝 Creating new StudentAcademic record for student {student_id}")
        student_academic = StudentAcademic(
            student_id=student_id,
            academic_year_id=academic_year_id,
            subject_id=subject_id
        )
        db.add(student_academic)
    else:
        print(f"✅ Found existing StudentAcademic record (id={student_academic.id})")
    
    # احصل على معلومات الطالب لجلب class_id
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        print(f"❌ Student not found!")
        return
    
    print(f"👤 Student: {student.full_name}, class_id={student.class_id}")
    
    # احصل على AcademicSettings للمادة
    academic_settings = db.query(AcademicSettings).filter(
        and_(
            AcademicSettings.academic_year_id == academic_year_id,
            AcademicSettings.class_id == student.class_id,
            AcademicSettings.subject_id == subject_id
        )
    ).first()
    
    if academic_settings:
        print(f"⚙️  Found AcademicSettings (id={academic_settings.id})")
    else:
        print(f"⚠️  No AcademicSettings found for year={academic_year_id}, class={student.class_id}, subject={subject_id}")
        print(f"    This means calculation won't happen (need settings first)")
        return
    
    # احسب المتوسط حسب نوع الإجراء
    if action_type == 'recitation':
        # تحقق من أن calculation_type = automatic_average
        # إذا لم توجد إعدادات أو كان calculation_type != 'automatic_average'، لا نحدث
        if not academic_settings or not academic_settings.recitation_grades:
            return
        
        calc_type = academic_settings.recitation_grades.get('calculation_type', 'direct')
        if calc_type != 'automatic_average':
            # لا تقم بالتحديث إذا كان الإدخال مباشر
            return
        
        # احسب متوسط التسميع
        recitations = db.query(StudentAction).filter(
            and_(
                StudentAction.student_id == student_id,
                StudentAction.academic_year_id == academic_year_id,
                StudentAction.subject_id == subject_id,
                StudentAction.action_type == 'recitation',
                StudentAction.grade.isnot(None)
            )
        ).all()
        
        if recitations:
            # حساب مجموع الدرجات ومجموع الدرجات القصوى
            total_grades = sum(float(r.grade) for r in recitations)
            total_max_grades = sum(float(r.max_grade) if r.max_grade else 0 for r in recitations)
            
            # حساب النسبة المئوية
            percentage = (total_grades / total_max_grades * 100) if total_max_grades else 0
            
            # تطبيق النسبة على القيمة القصوى من AcademicSettings
            if academic_settings and academic_settings.recitation_grades:
                max_grade = academic_settings.recitation_grades.get('max_grade', 100)
                student_academic.recitation_grades = (percentage / 100) * max_grade
            else:
                # إذا لم يتم تعيين AcademicSettings، استخدم النسبة المئوية فقط
                student_academic.recitation_grades = percentage
    
    elif action_type == 'activity':
        # تحقق من أن calculation_type = automatic_average
        # إذا لم توجد إعدادات أو كان calculation_type != 'automatic_average'، لا نحدث
        if not academic_settings or not academic_settings.activity_grade:
            return
        
        calc_type = academic_settings.activity_grade.get('calculation_type', 'direct')
        if calc_type != 'automatic_average':
            # لا تقم بالتحديث إذا كان الإدخال مباشر
            return
        
        # احسب متوسط النشاط
        activities = db.query(StudentAction).filter(
            and_(
                StudentAction.student_id == student_id,
                StudentAction.academic_year_id == academic_year_id,
                StudentAction.subject_id == subject_id,
                StudentAction.action_type == 'activity',
                StudentAction.grade.isnot(None)
            )
        ).all()
        
        if activities:
            # حساب مجموع الدرجات ومجموع الدرجات القصوى
            total_grades = sum(float(a.grade) for a in activities)
            total_max_grades = sum(float(a.max_grade) if a.max_grade else 0 for a in activities)
            
            # حساب النسبة المئوية
            percentage = (total_grades / total_max_grades * 100) if total_max_grades else 0
            
            # تطبيق النسبة على القيمة القصوى من AcademicSettings
            if academic_settings and academic_settings.activity_grade:
                max_grade = academic_settings.activity_grade.get('max_grade', 100)
                student_academic.activity_grade = (percentage / 100) * max_grade
            else:
                # إذا لم يتم تعيين AcademicSettings، استخدم النسبة المئوية فقط
                student_academic.activity_grade = percentage
    
    elif action_type == 'quiz':
        print(f"🔍 Processing quiz action...")
        
        # تحقق من أن calculation_type = automatic_average
        # إذا لم توجد إعدادات أو كان calculation_type != 'automatic_average'، لا نحدث
        if not academic_settings or not academic_settings.board_grades:
            print(f"⚠️  No board_grades settings found in AcademicSettings")
            print(f"    academic_settings exists: {academic_settings is not None}")
            if academic_settings:
                print(f"    board_grades exists: {academic_settings.board_grades is not None}")
                print(f"    board_grades value: {academic_settings.board_grades}")
            return
        
        calc_type = academic_settings.board_grades.get('calculation_type', 'direct')
        print(f"📊 board_grades calculation_type: '{calc_type}'")
        
        if calc_type != 'automatic_average':
            print(f"⏭️  Skipping update because calculation_type is '{calc_type}' (not automatic_average)")
            return
        
        print(f"✅ calculation_type is 'automatic_average' - proceeding with calculation")
        
        # احسب متوسط السبر (يُحفظ في board_grades)
        quizzes = db.query(StudentAction).filter(
            and_(
                StudentAction.student_id == student_id,
                StudentAction.academic_year_id == academic_year_id,
                StudentAction.subject_id == subject_id,
                StudentAction.action_type == 'quiz',
                StudentAction.grade.isnot(None)
            )
        ).all()
        
        print(f"📚 Found {len(quizzes)} quiz records")
        
        if quizzes:
            # حساب مجموع الدرجات ومجموع الدرجات القصوى
            total_grades = sum(float(q.grade) for q in quizzes)
            total_max_grades = sum(float(q.max_grade) if q.max_grade else 0 for q in quizzes)
            
            print(f"   Total grades: {total_grades}, Total max grades: {total_max_grades}")
            
            # حساب النسبة المئوية
            percentage = (total_grades / total_max_grades * 100) if total_max_grades else 0
            print(f"   Percentage: {percentage:.2f}%")
            
            # تطبيق النسبة على القيمة القصوى من AcademicSettings
            if academic_settings and academic_settings.board_grades:
                max_grade = academic_settings.board_grades.get('max_grade', 100)
                calculated_grade = (percentage / 100) * max_grade
                print(f"   Max grade from settings: {max_grade}")
                print(f"   Calculated board_grades: {calculated_grade:.2f}")
                student_academic.board_grades = calculated_grade
            else:
                # إذا لم يتم تعيين AcademicSettings، استخدم النسبة المئوية فقط
                print(f"   Using percentage only: {percentage:.2f}")
                student_academic.board_grades = percentage
        else:
            print(f"⚠️  No quiz records found - cannot calculate average")
    
    print(f"\n💾 Committing changes to database...")
    print(f"   Final board_grades: {student_academic.board_grades}")
    print(f"   Final recitation_grades: {student_academic.recitation_grades}")
    print(f"   Final activity_grade: {student_academic.activity_grade}")
    print(f"{'='*60}\n")
    
    db.commit()

# ==================== Holiday Management ====================

@router.post("/holidays", response_model=HolidayResponse)
def create_holiday(
    holiday: HolidayCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """إنشاء يوم عطلة جديد"""
    # تحقق من أن اليوم غير موجود مسبقاً لنفس الفترة
    existing = db.query(Holiday).filter(
        and_(
            Holiday.holiday_date == holiday.holiday_date,
            Holiday.session_type == holiday.session_type,
            Holiday.academic_year_id == holiday.academic_year_id
        )
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Holiday already exists for this date and session"
        )
    
    db_holiday = Holiday(**holiday.dict())
    db.add(db_holiday)
    db.commit()
    db.refresh(db_holiday)
    
    # Log history
    log_daily_action(
        db=db,
        action_type="create",
        entity_type="holiday",
        entity_id=db_holiday.id,
        entity_name=db_holiday.holiday_name,
        description=f"تم إضافة يوم عطلة: {db_holiday.holiday_name}",
        current_user=current_user,
        session_type=holiday.session_type,
        meta_data={
            "academic_year_id": db_holiday.academic_year_id,
            "new_values": holiday.dict()
        }
    )
    
    return db_holiday

@router.get("/holidays")
def get_holidays(
    academic_year_id: int,
    session_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """الحصول على قائمة أيام العطل"""
    try:
        query = db.query(Holiday).filter(
            Holiday.academic_year_id == academic_year_id
        )
        
        if session_type:
            query = query.filter(Holiday.session_type == session_type)
        
        if start_date:
            query = query.filter(Holiday.holiday_date >= start_date)
        if end_date:
            query = query.filter(Holiday.holiday_date <= end_date)
        
        holidays = query.order_by(Holiday.holiday_date).all()
        
        # تحويل إلى dict لتجنب مشاكل serialization
        result = []
        for holiday in holidays:
            result.append({
                'id': holiday.id,
                'academic_year_id': holiday.academic_year_id,
                'session_type': holiday.session_type,
                'holiday_date': holiday.holiday_date.isoformat(),
                'holiday_name': holiday.holiday_name,
                'notes': holiday.notes
            })
        
        return result
    except Exception as e:
        # إذا حدث خطأ، أرجع قائمة فارغة بدلاً من 500
        print(f"Error fetching holidays: {str(e)}")
        import traceback
        traceback.print_exc()
        return []

@router.get("/holidays/{holiday_id}", response_model=HolidayResponse)
def get_holiday(
    holiday_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """الحصول على تفاصيل يوم عطلة معين"""
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    return holiday

@router.put("/holidays/{holiday_id}", response_model=HolidayResponse)
def update_holiday(
    holiday_id: int,
    holiday_update: HolidayUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """تحديث يوم عطلة"""
    db_holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not db_holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    # Store old values
    old_values = {field: getattr(db_holiday, field) for field in holiday_update.dict(exclude_unset=True).keys()}
    
    for key, value in holiday_update.dict(exclude_unset=True).items():
        setattr(db_holiday, key, value)
    
    db.commit()
    db.refresh(db_holiday)
    
    # Log history
    log_daily_action(
        db=db,
        action_type="update",
        entity_type="holiday",
        entity_id=db_holiday.id,
        entity_name=db_holiday.holiday_name,
        description=f"تم تعديل يوم عطلة: {db_holiday.holiday_name}",
        current_user=current_user,
        old_values=old_values,
        new_values=holiday_update.dict(exclude_unset=True)
    )
    
    return db_holiday

@router.delete("/holidays/{holiday_id}")
def delete_holiday(
    holiday_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """حذف يوم عطلة"""
    db_holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not db_holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    # Log history before deletion
    log_daily_action(
        db=db,
        action_type="delete",
        entity_type="holiday",
        entity_id=db_holiday.id,
        entity_name=db_holiday.holiday_name,
        description=f"تم حذف يوم عطلة: {db_holiday.holiday_name}",
        current_user=current_user
    )
    
    db.delete(db_holiday)
    db.commit()
    return {"message": "Holiday deleted successfully"}

@router.get("/holidays/check/{check_date}")
def check_holiday(
    check_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """التحقق من أن يوم معين هو عطلة"""
    # تحقق من أيام الجمعة والسبت
    weekday = check_date.weekday()
    if weekday in [4, 5]:  # Friday = 4, Saturday = 5
        return {
            "is_holiday": True,
            "is_weekend": True,
            "is_for_students": True,
            "is_for_teachers": True,
            "holiday_name": "عطلة نهاية الأسبوع"
        }
    
    # تحقق من العطل المسجلة
    holiday = db.query(Holiday).filter(Holiday.holiday_date == check_date).first()
    if holiday:
        return {
            "is_holiday": True,
            "is_weekend": False,
            "is_for_students": holiday.is_for_students,
            "is_for_teachers": holiday.is_for_teachers,
            "holiday_name": holiday.holiday_name
        }
    
    return {
        "is_holiday": False,
        "is_weekend": False
    }

# ==================== Student Daily Attendance ====================

@router.post("/attendance/students/bulk", response_model=List[StudentDailyAttendanceResponse])
def create_student_attendance_bulk(
    attendance_bulk: StudentDailyAttendanceBulk,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """إدخال جماعي لحضور الطلاب - يتم تحديد الغائبين فقط"""
    print(f"\n=== SAVE ATTENDANCE REQUEST ===")
    print(f"Params: class_id={attendance_bulk.class_id}, section={attendance_bulk.section}, date={attendance_bulk.attendance_date}, session_type={attendance_bulk.session_type}")
    print(f"Absent student IDs: {attendance_bulk.absent_student_ids}")
    
    # احصل على معلومات الصف لتحديد المرحلة والصف ونوع الدوام
    cls = db.query(Class).filter(Class.id == attendance_bulk.class_id).first()
    
    # إذا لم يتم العثور على الصف، استخدم class_id مباشرة (سلوك قديم)
    if cls is None:
        students = db.query(Student).filter(
            and_(
                Student.class_id == attendance_bulk.class_id,
                Student.section == attendance_bulk.section,
                Student.session_type == attendance_bulk.session_type,
                Student.is_active == True
            )
        ).all()
    else:
        # احصل على جميع طلاب هذه السنة والمرحلة والصف والشعبة ونوع الدوام (مثل صفحات الواجهة)
        students = db.query(Student).filter(
            and_(
                Student.academic_year_id == attendance_bulk.academic_year_id,
                Student.grade_level == cls.grade_level,
                Student.grade_number == cls.grade_number,
                Student.section == attendance_bulk.section,
                Student.session_type == attendance_bulk.session_type,
                Student.is_active == True
            )
        ).all()
    
    print(f"Students found: {len(students)}")
    for s in students:
        is_absent = s.id in attendance_bulk.absent_student_ids
        print(f"  - ID: {s.id}, Name: {s.full_name}, Session: {s.session_type}, Will be marked as: {'ABSENT' if is_absent else 'PRESENT'}")
    
    if not students:
        raise HTTPException(status_code=404, detail="No students found")
    
    # احذف السجلات السابقة لنفس اليوم
    db.query(StudentDailyAttendance).filter(
        and_(
            StudentDailyAttendance.attendance_date == attendance_bulk.attendance_date,
            StudentDailyAttendance.student_id.in_([s.id for s in students])
        )
    ).delete(synchronize_session=False)
    
    # أنشئ سجلات جديدة
    attendance_records = []
    for student in students:
        is_present = student.id not in attendance_bulk.absent_student_ids
        
        attendance = StudentDailyAttendance(
            student_id=student.id,
            academic_year_id=attendance_bulk.academic_year_id,
            attendance_date=attendance_bulk.attendance_date,
            is_present=is_present,
            notes=attendance_bulk.notes,
            recorded_by=current_user.id
        )
        db.add(attendance)
        attendance_records.append(attendance)
    
    db.commit()
    for record in attendance_records:
        db.refresh(record)
    
    # Invalidate attendance-related caches
    CacheManager.invalidate_analytics('attendance')
    
    print(f"Saved {len(attendance_records)} attendance records:")
    for r in attendance_records:
        print(f"  - Student ID: {r.student_id}, Present: {r.is_present}, Date: {r.attendance_date}")
    print(f"===========================\n")
    
    return attendance_records

@router.get("/attendance/students", response_model=List[StudentDailyAttendanceResponse])
def get_student_attendance(
    class_id: int,
    section: str,
    attendance_date: date,
    academic_year_id: Optional[int] = None,
    session_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """الحصول على حضور طلاب صف معين في يوم محدد"""
    print(f"\n=== GET ATTENDANCE REQUEST ===")
    print(f"Params: class_id={class_id}, section={section}, date={attendance_date}, academic_year_id={academic_year_id}, session_type={session_type}")
    
    # استخدم نفس المنطق المستخدم في الحفظ - احصل على معلومات الصف
    cls = db.query(Class).filter(Class.id == class_id).first()
    
    if cls is None:
        # إذا لم يتم العثور على الصف، استخدم class_id مباشرة (سلوك قديم)
        query_filters = [
            Student.class_id == class_id,
            Student.section == section,
            Student.is_active == True
        ]
        
        if session_type:
            query_filters.append(Student.session_type == session_type)
        
        students = db.query(Student).filter(and_(*query_filters)).all()
    else:
        # استخدم grade_level و grade_number (مثل الحفظ)
        query_filters = [
            Student.grade_level == cls.grade_level,
            Student.grade_number == cls.grade_number,
            Student.section == section,
            Student.is_active == True
        ]
        
        if academic_year_id:
            query_filters.append(Student.academic_year_id == academic_year_id)
        
        if session_type:
            query_filters.append(Student.session_type == session_type)
        
        students = db.query(Student).filter(and_(*query_filters)).all()
    
    print(f"Students found: {len(students)}")
    for s in students:
        print(f"  - ID: {s.id}, Name: {s.full_name}, Session: {s.session_type}")
    
    student_ids = [s.id for s in students]
    
    if not student_ids:
        print(f"No students found - returning empty attendance")
        print(f"===========================\n")
        return []
    
    attendance_records = db.query(StudentDailyAttendance).filter(
        and_(
            StudentDailyAttendance.student_id.in_(student_ids),
            StudentDailyAttendance.attendance_date == attendance_date
        )
    ).all()
    
    print(f"Attendance records found: {len(attendance_records)}")
    for a in attendance_records:
        print(f"  - Student ID: {a.student_id}, Present: {a.is_present}")
    print(f"===========================\n")
    
    return attendance_records

# ==================== Teacher Period Attendance ====================

@router.get("/attendance/teachers/schedule/{teacher_id}/{attendance_date}")
def get_teacher_schedule_for_day(
    teacher_id: int,
    attendance_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """الحصول على جدول الأستاذ ليوم محدد"""
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    
    # احسب يوم الأسبوع
    day_of_week = attendance_date.weekday()
    
    # احصل على الحصص المجدولة
    schedules = db.query(Schedule).filter(
        and_(
            Schedule.teacher_id == teacher_id,
            Schedule.day_of_week == day_of_week
        )
    ).all()
    
    periods = []
    for schedule in schedules:
        # تحقق من الحضور
        attendance = db.query(TeacherPeriodAttendance).filter(
            and_(
                TeacherPeriodAttendance.schedule_id == schedule.id,
                TeacherPeriodAttendance.attendance_date == attendance_date
            )
        ).first()
        
        periods.append({
            "schedule_id": schedule.id,
            "period_number": schedule.period_number,
            "class_id": schedule.class_id,
            "subject_id": schedule.subject_id,
            "section": schedule.section,
            "is_present": attendance.is_present if attendance else True,
            "attendance_id": attendance.id if attendance else None
        })
    
    return {
        "teacher_id": teacher.id,
        "teacher_name": teacher.full_name,
        "attendance_date": attendance_date,
        "day_of_week": day_of_week,
        "periods": periods
    }

@router.get("/attendance/teachers")
def get_teacher_attendance(
    attendance_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """الحصول على حضور جميع الأساتذة في يوم محدد"""
    attendance_records = db.query(TeacherPeriodAttendance).filter(
        TeacherPeriodAttendance.attendance_date == attendance_date
    ).all()
    
    result = []
    for record in attendance_records:
        result.append({
            'teacher_id': record.teacher_id,
            'schedule_id': record.schedule_id,
            'is_present': record.is_present,
            'attendance_date': record.attendance_date.isoformat()
        })
    
    return result

@router.post("/attendance/teachers/bulk")
def create_teacher_attendance_bulk_new(
    attendance_bulk: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """إدخال جماعي لحضور الأساتذة - نسخة محدثة"""
    try:
        academic_year_id = attendance_bulk.get('academic_year_id')
        attendance_date_str = attendance_bulk.get('attendance_date')
        records = attendance_bulk.get('records', [])
        
        # Validate required fields
        if not academic_year_id:
            raise HTTPException(status_code=400, detail="academic_year_id is required")
        if not attendance_date_str:
            raise HTTPException(status_code=400, detail="attendance_date is required")
        if not records:
            raise HTTPException(status_code=400, detail="records array is required")
        
        # Convert string date to Python date object
        if isinstance(attendance_date_str, str):
            attendance_date = datetime.strptime(attendance_date_str, '%Y-%m-%d').date()
        else:
            attendance_date = attendance_date_str
        
        # احذف السجلات السابقة لنفس اليوم
        db.query(TeacherPeriodAttendance).filter(
            TeacherPeriodAttendance.attendance_date == attendance_date
        ).delete(synchronize_session=False)
        
        # أنشئ سجلات جديدة
        attendance_records = []
        for i, record in enumerate(records):
            # Validate each record has required fields
            if 'teacher_id' not in record:
                raise HTTPException(status_code=400, detail=f"Record {i}: teacher_id is required")
            # schedule_id is optional (nullable in database)
            if 'is_present' not in record:
                raise HTTPException(status_code=400, detail=f"Record {i}: is_present is required")
            
            attendance = TeacherPeriodAttendance(
                teacher_id=record.get('teacher_id'),
                academic_year_id=academic_year_id,
                attendance_date=attendance_date,
                schedule_id=record.get('schedule_id'),  # Can be None
                is_present=record.get('is_present', True),
                recorded_by=current_user.id
            )
            db.add(attendance)
            attendance_records.append(attendance)
        
        db.commit()
        
        # Invalidate attendance-related caches
        CacheManager.invalidate_analytics('attendance')
        
        return {"message": "تم حفظ الحضور بنجاح", "count": len(attendance_records)}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error saving attendance: {str(e)}")

@router.post("/attendance/teachers/bulk/old", response_model=List[TeacherPeriodAttendanceResponse])
def create_teacher_attendance_bulk(
    attendance_bulk: TeacherPeriodAttendanceBulk,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """إدخال جماعي لحضور الأستاذ - يتم تحديد الحصص الغائبة فقط"""
    teacher = db.query(Teacher).filter(Teacher.id == attendance_bulk.teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    
    day_of_week = attendance_bulk.attendance_date.weekday()
    
    # احصل على جميع حصص الأستاذ لهذا اليوم
    schedules = db.query(Schedule).filter(
        and_(
            Schedule.teacher_id == attendance_bulk.teacher_id,
            Schedule.day_of_week == day_of_week
        )
    ).all()
    
    # احذف السجلات السابقة
    db.query(TeacherPeriodAttendance).filter(
        and_(
            TeacherPeriodAttendance.teacher_id == attendance_bulk.teacher_id,
            TeacherPeriodAttendance.attendance_date == attendance_bulk.attendance_date
        )
    ).delete(synchronize_session=False)
    
    # أنشئ سجلات جديدة
    attendance_records = []
    for schedule in schedules:
        is_present = schedule.id not in attendance_bulk.absent_period_ids
        
        attendance = TeacherPeriodAttendance(
            teacher_id=teacher.id,
            academic_year_id=attendance_bulk.academic_year_id,
            attendance_date=attendance_bulk.attendance_date,
            schedule_id=schedule.id,
            class_id=schedule.class_id,
            subject_id=schedule.subject_id,
            section=schedule.section,
            period_number=schedule.period_number,
            day_of_week=day_of_week,
            is_present=is_present,
            notes=attendance_bulk.notes,
            recorded_by=current_user.id
        )
        db.add(attendance)
        attendance_records.append(attendance)
    
    db.commit()
    for record in attendance_records:
        db.refresh(record)
    
    return attendance_records

# ==================== Student Actions ====================

@router.post("/actions/students", response_model=StudentActionResponse)
def create_student_action(
    action: StudentActionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """إضافة إجراء لطالب"""
    # تحقق من أن الطالب موجود
    student = db.query(Student).filter(Student.id == action.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # تحقق من أن المادة موجودة إذا كانت مطلوبة
    if action.subject_id:
        subject = db.query(Subject).filter(Subject.id == action.subject_id).first()
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
    
    # تحديد السجلات السلوكية التي يجب أن تذهب للجدول الجديد
    behavioral_types = ['warning', 'parent_call', 'suspension', 'misbehavior', 
                       'distinguished_participation', 'thank_you_card', 'note']
    
    if action.action_type in behavioral_types:
        # إضافة إلى الجدول الجديد student_behavior_records
        type_mapping = {
            'misbehavior': 'مشاغبة',
            'distinguished_participation': 'مشاركة_مميزة',
            'thank_you_card': 'بطاقة_شكر',
            'note': 'ملاحظة',
            'warning': 'إنذار',
            'parent_call': 'استدعاء_ولي_أمر',
            'suspension': 'فصل'
        }
        
        severity = None
        if action.action_type in ['warning', 'parent_call']:
            severity = 'medium'
        elif action.action_type == 'suspension':
            severity = 'high'
        elif action.action_type == 'misbehavior':
            severity = 'low'
        
        behavior_record = StudentBehaviorRecord(
            student_id=action.student_id,
            academic_year_id=action.academic_year_id,
            record_date=action.action_date,
            record_type=type_mapping.get(action.action_type, action.action_type),
            description=action.description,
            recorded_by=current_user.id,
            severity=severity
        )
        db.add(behavior_record)
        db.commit()
        db.refresh(behavior_record)
        
        # إرجاع بنفس التنسيق لـ compatibility
        db_action = StudentAction(
            id=behavior_record.id,
            student_id=behavior_record.student_id,
            academic_year_id=behavior_record.academic_year_id,
            action_date=behavior_record.record_date,
            action_type=action.action_type,
            description=behavior_record.description,
            recorded_by=behavior_record.recorded_by
        )
    else:
        # إجراءات أكاديمية تبقى في student_actions
        db_action = StudentAction(
            **action.dict(),
            recorded_by=current_user.id
        )
        db.add(db_action)
        db.commit()
        db.refresh(db_action)
        
        # تحديث المتوسطات للإجراءات الأكاديمية
        if action.action_type in ['recitation', 'activity', 'quiz'] and action.subject_id and action.grade is not None:
            update_academic_averages(
                db=db,
                student_id=action.student_id,
                academic_year_id=action.academic_year_id,
                subject_id=action.subject_id,
                action_type=action.action_type
            )
    
    return db_action

@router.get("/actions/students")
def get_student_actions(
    student_id: Optional[int] = None,
    class_id: Optional[int] = None,
    section: Optional[str] = None,
    action_date: Optional[date] = None,
    action_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """الحصول على قائمة إجراءات الطلاب مع التفاصيل (من الجدولين)"""
    
    # إضافة البيانات الإضافية
    action_names = {
        'warning': 'إنذار',
        'parent_call': 'استدعاء ولي أمر',
        'suspension': 'فصل',
        'misbehavior': 'مشاغبة',
        'distinguished_participation': 'مشاركة مميزة',
        'thank_you_card': 'بطاقة شكر',
        'recitation': 'تسميع',
        'activity': 'نشاط',
        'quiz': 'سبر',
        'note': 'ملاحظة'
    }
    
    behavioral_types = ['warning', 'parent_call', 'suspension', 'misbehavior', 
                       'distinguished_participation', 'thank_you_card', 'note']
    
    result = []
    
    # 1. قراءة السجلات السلوكية من الجدول الجديد
    behavior_query = db.query(StudentBehaviorRecord)
    
    if student_id:
        behavior_query = behavior_query.filter(StudentBehaviorRecord.student_id == student_id)
    
    if class_id and section:
        students = db.query(Student).filter(
            and_(
                Student.class_id == class_id,
                Student.section == section
            )
        ).all()
        student_ids = [s.id for s in students]
        behavior_query = behavior_query.filter(StudentBehaviorRecord.student_id.in_(student_ids))
    
    if action_date:
        behavior_query = behavior_query.filter(StudentBehaviorRecord.record_date == action_date)
    
    behaviors = behavior_query.order_by(StudentBehaviorRecord.record_date.desc()).all()
    
    # تحويل السجلات السلوكية
    type_reverse_mapping = {
        'مشاغبة': 'misbehavior',
        'مشاركة_مميزة': 'distinguished_participation',
        'بطاقة_شكر': 'thank_you_card',
        'ملاحظة': 'note',
        'إنذار': 'warning',
        'استدعاء_ولي_أمر': 'parent_call',
        'فصل': 'suspension'
    }
    
    for behavior in behaviors:
        student = db.query(Student).filter(Student.id == behavior.student_id).first()
        english_type = type_reverse_mapping.get(behavior.record_type, behavior.record_type)
        
        # تصفية حسب action_type إذا كان محدداً
        if action_type and english_type != action_type:
            continue
            
        result.append({
            'id': behavior.id,
            'student_id': behavior.student_id,
            'student_name': student.full_name if student else '',
            'action_type': english_type,
            'action_type_label': action_names.get(english_type, behavior.record_type),
            'subject_id': None,
            'subject_name': None,
            'description': behavior.description,
            'grade': None,
            'max_grade': None,
            'notes': '',
            'action_date': behavior.record_date.isoformat()
        })
    
    # 2. قراءة السجلات الأكاديمية من الجدول القديم (إذا لم يكن action_type سلوكي)
    if not action_type or action_type not in behavioral_types:
        academic_query = db.query(StudentAction)
        
        if student_id:
            academic_query = academic_query.filter(StudentAction.student_id == student_id)
        
        if class_id and section:
            academic_query = academic_query.filter(StudentAction.student_id.in_(student_ids))
        
        if action_date:
            academic_query = academic_query.filter(StudentAction.action_date == action_date)
        
        if action_type:
            academic_query = academic_query.filter(StudentAction.action_type == action_type)
        
        # استبعاد السجلات السلوكية القديمة
        academic_query = academic_query.filter(~StudentAction.action_type.in_(behavioral_types))
        
        actions = academic_query.order_by(StudentAction.action_date.desc()).all()
        
        for action in actions:
            student = db.query(Student).filter(Student.id == action.student_id).first()
            subject = None
            if action.subject_id:
                subject = db.query(Subject).filter(Subject.id == action.subject_id).first()
            
            result.append({
                'id': action.id,
                'student_id': action.student_id,
                'student_name': student.full_name if student else '',
                'action_type': action.action_type,
                'action_type_label': action_names.get(action.action_type, action.action_type),
                'subject_id': action.subject_id,
                'subject_name': subject.subject_name if subject else None,
                'description': action.description,
                'grade': action.grade,
                'max_grade': action.max_grade,
                'notes': action.notes,
                'action_date': action.action_date.isoformat()
            })
    
    # ترتيب النتائج حسب التاريخ
    result.sort(key=lambda x: x['action_date'], reverse=True)
    
    return result

@router.put("/actions/students/{action_id}", response_model=StudentActionResponse)
def update_student_action(
    action_id: int,
    action_update: StudentActionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """تحديث إجراء لطالب"""
    db_action = db.query(StudentAction).filter(StudentAction.id == action_id).first()
    if not db_action:
        raise HTTPException(status_code=404, detail="Action not found")
    
    # حفظ البيانات القديمة لتحديث المتوسطات
    old_action_type = db_action.action_type
    old_subject_id = db_action.subject_id
    
    for key, value in action_update.dict(exclude_unset=True).items():
        setattr(db_action, key, value)
    
    db.commit()
    db.refresh(db_action)
    
    # تحديث المتوسطات إذا كان إجراء أكاديمي
    if db_action.action_type in ['recitation', 'activity', 'quiz'] and db_action.subject_id:
        update_academic_averages(
            db=db,
            student_id=db_action.student_id,
            academic_year_id=db_action.academic_year_id,
            subject_id=db_action.subject_id,
            action_type=db_action.action_type
        )
    # إذا تغيرت المادة أو النوع، حدّث المتوسطات القديمة أيضاً
    if old_subject_id and old_subject_id != db_action.subject_id and old_action_type in ['recitation', 'activity', 'quiz']:
        update_academic_averages(
            db=db,
            student_id=db_action.student_id,
            academic_year_id=db_action.academic_year_id,
            subject_id=old_subject_id,
            action_type=old_action_type
        )
    
    return db_action

@router.delete("/actions/students/{action_id}")
def delete_student_action(
    action_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """حذف إجراء لطالب"""
    db_action = db.query(StudentAction).filter(StudentAction.id == action_id).first()
    if not db_action:
        raise HTTPException(status_code=404, detail="Action not found")
    
    # حفظ البيانات قبل الحذف لتحديث المتوسطات
    student_id = db_action.student_id
    academic_year_id = db_action.academic_year_id
    subject_id = db_action.subject_id
    action_type = db_action.action_type
    
    db.delete(db_action)
    db.commit()
    
    # تحديث المتوسطات بعد الحذف
    if action_type in ['recitation', 'activity', 'quiz'] and subject_id:
        update_academic_averages(
            db=db,
            student_id=student_id,
            academic_year_id=academic_year_id,
            subject_id=subject_id,
            action_type=action_type
        )
    
    return {"message": "Action deleted successfully"}

# ==================== WhatsApp Group Configuration ====================

@router.post("/whatsapp/config", response_model=WhatsAppGroupConfigResponse)
def create_whatsapp_config(
    config: WhatsAppGroupConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """إنشاء أو تحديث إعدادات مجموعة الواتساب"""
    # تحقق من وجود إعداد سابق
    existing = db.query(WhatsAppGroupConfig).filter(
        and_(
            WhatsAppGroupConfig.class_id == config.class_id,
            WhatsAppGroupConfig.section == config.section,
            WhatsAppGroupConfig.academic_year_id == config.academic_year_id
        )
    ).first()
    
    if existing:
        # تحديث
        for key, value in config.dict(exclude_unset=True).items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # إنشاء جديد
        db_config = WhatsAppGroupConfig(**config.dict())
        db.add(db_config)
        db.commit()
        db.refresh(db_config)
        return db_config

@router.get("/whatsapp/config/{class_id}/{section}", response_model=WhatsAppGroupConfigResponse)
def get_whatsapp_config(
    class_id: int,
    section: str,
    academic_year_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """الحصول على إعدادات مجموعة الواتساب"""
    config = db.query(WhatsAppGroupConfig).filter(
        and_(
            WhatsAppGroupConfig.class_id == class_id,
            WhatsAppGroupConfig.section == section,
            WhatsAppGroupConfig.academic_year_id == academic_year_id
        )
    ).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="WhatsApp config not found")
    
    return config

# ==================== Daily Page Summary ====================

@router.get("/summary/{attendance_date}", response_model=DailyPageSummary)
def get_daily_summary(
    attendance_date: date,
    academic_year_id: int,
    session_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """الحصول على ملخص الصفحة اليومية"""
    # إحصائيات الطلاب
    student_query = db.query(Student).filter(
        and_(
            Student.academic_year_id == academic_year_id,
            Student.is_active == True
        )
    )
    if session_type:
        student_query = student_query.filter(Student.session_type == session_type)
    
    students = student_query.all()
    
    total_students = len(students)
    student_ids = [s.id for s in students]
    
    attendances = db.query(StudentDailyAttendance).filter(
        and_(
            StudentDailyAttendance.student_id.in_(student_ids),
            StudentDailyAttendance.attendance_date == attendance_date
        )
    ).all()
    
    present_students = sum(1 for a in attendances if a.is_present)
    absent_students = sum(1 for a in attendances if not a.is_present)
    
    # إحصائيات المعلمين
    teacher_query = db.query(Teacher).filter(
        and_(
            Teacher.academic_year_id == academic_year_id,
            Teacher.is_active == True
        )
    )
    if session_type:
        teacher_query = teacher_query.filter(Teacher.session_type == session_type)
    
    teachers = teacher_query.all()
    
    total_teachers = len(teachers)
    
    day_of_week = attendance_date.weekday()
    teacher_ids = [t.id for t in teachers]
    
    period_attendances = db.query(TeacherPeriodAttendance).filter(
        and_(
            TeacherPeriodAttendance.teacher_id.in_(teacher_ids),
            TeacherPeriodAttendance.attendance_date == attendance_date
        )
    ).all()
    
    total_periods = len(period_attendances)
    attended_periods = sum(1 for p in period_attendances if p.is_present)
    absent_periods = sum(1 for p in period_attendances if not p.is_present)
    
    # إحصائيات الإجراءات
    actions = db.query(StudentAction).filter(
        and_(
            StudentAction.student_id.in_(student_ids),
            StudentAction.action_date == attendance_date
        )
    ).all()
    
    total_actions = len(actions)
    warnings = sum(1 for a in actions if a.action_type == 'warning')
    parent_calls = sum(1 for a in actions if a.action_type == 'parent_call')
    academic_actions = sum(1 for a in actions if a.action_type in ['recitation', 'activity', 'quiz'])
    
    return DailyPageSummary(
        date=attendance_date,
        session_type=session_type,
        total_students=total_students,
        present_students=present_students,
        absent_students=absent_students,
        total_teachers=total_teachers,
        total_periods=total_periods,
        attended_periods=attended_periods,
        absent_periods=absent_periods,
        total_actions=total_actions,
        warnings=warnings,
        parent_calls=parent_calls,
        academic_actions=academic_actions
    )

@router.get("/whatsapp/message/{class_id}/{section}/{attendance_date}")
def generate_whatsapp_message(
    class_id: int,
    section: str,
    attendance_date: date,
    academic_year_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """توليد رسالة الواتساب للأهل"""
    # احصل على الطلاب
    students = db.query(Student).filter(
        and_(
            Student.class_id == class_id,
            Student.section == section,
            Student.is_active == True
        )
    ).all()
    
    student_ids = [s.id for s in students]
    
    # احصل على الغيابات
    absences = db.query(StudentDailyAttendance).filter(
        and_(
            StudentDailyAttendance.student_id.in_(student_ids),
            StudentDailyAttendance.attendance_date == attendance_date,
            StudentDailyAttendance.is_present == False
        )
    ).all()
    
    # احصل على الإجراءات
    actions = db.query(StudentAction).filter(
        and_(
            StudentAction.student_id.in_(student_ids),
            StudentAction.action_date == attendance_date
        )
    ).all()
    
    # احصل على رابط المجموعة
    config = db.query(WhatsAppGroupConfig).filter(
        and_(
            WhatsAppGroupConfig.class_id == class_id,
            WhatsAppGroupConfig.section == section,
            WhatsAppGroupConfig.academic_year_id == academic_year_id
        )
    ).first()
    
    # إنشاء الرسالة
    message = f"📅 تقرير يومي - {attendance_date.strftime('%Y-%m-%d')}\n"
    message += f"الصف: {class_id} - الشعبة: {section}\n\n"
    
    if absences:
        message += "*الغيابات:*\n"
        for absence in absences:
            student = db.query(Student).filter(Student.id == absence.student_id).first()
            message += f"- {student.full_name}\n"
        message += "\n"
    
    if actions:
        message += "*الاجراءات والملاحظات:*\n"
        for action in actions:
            student = db.query(Student).filter(Student.id == action.student_id).first()
            action_names = {
                'warning': 'انذار',
                'parent_call': 'استدعاء ولي امر',
                'suspension': 'فصل',
                'misbehavior': 'مشاغبة',
                'distinguished_participation': 'مشاركة مميزة',
                'thank_you_card': 'بطاقة شكر',
                'recitation': 'تسميع',
                'activity': 'نشاط',
                'quiz': 'سبر',
                'note': 'ملاحظة'
            }
            action_name = action_names.get(action.action_type, action.action_type)
            message += f"- {student.full_name}: {action_name}"
            
            # إضافة اسم المادة إذا كانت موجودة
            if action.subject_id:
                subject = db.query(Subject).filter(Subject.id == action.subject_id).first()
                if subject:
                    message += f" - مادة {subject.subject_name}"
            
            if action.grade is not None and action.max_grade is not None:
                # تحويل العلامات إلى أعداد صحيحة إذا كانت كاملة
                grade_str = str(int(action.grade)) if action.grade == int(action.grade) else str(action.grade)
                max_grade_str = str(int(action.max_grade)) if action.max_grade == int(action.max_grade) else str(action.max_grade)
                message += f" - العلامة {grade_str} من {max_grade_str}"
            message += f"\n  {action.description}\n"
        message += "\n"
    
    message += "شكراً لمتابعتكم 🌟"
    
    return WhatsAppMessage(
        class_id=class_id,
        section=section,
        date=attendance_date,
        message_content=message,
        group_link=config.group_link if config else None
    )
