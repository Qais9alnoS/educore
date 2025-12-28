from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.students import Student, StudentFinance, StudentPayment, StudentAcademic
from app.models.academic import Class
from app.schemas.students import (
    StudentCreate, StudentUpdate, StudentResponse,
    StudentFinanceCreate, StudentFinanceResponse,
    StudentPaymentCreate, StudentPaymentResponse,
    StudentAcademicCreate, StudentAcademicUpdate, StudentAcademicResponse
)
from app.core.dependencies import get_current_user, get_school_user
from app.models.users import User
from app.utils.history_helper import log_student_action, log_finance_action
from app.services.analytics_service import CacheManager

router = APIRouter()

# Student Management
@router.get("/", response_model=List[StudentResponse])
async def get_students(
    academic_year_id: Optional[int] = Query(None),
    session_type: Optional[str] = Query(None),
    grade_level: Optional[str] = Query(None),
    grade_number: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    section: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Get students with filters"""
    # تسجيل المعلمات المستلمة للتشخيص
    print(f"\n=== GET STUDENTS REQUEST ===")
    print(f"Filters received:")
    print(f"  academic_year_id: {academic_year_id}")
    print(f"  session_type: {session_type}")
    print(f"  grade_level: {grade_level}")
    print(f"  grade_number: {grade_number}")
    print(f"  class_id: {class_id}")
    print(f"  section: {section} (type: {type(section).__name__})")
    print(f"  is_active: {is_active}")
    
    # إصلاح الطلاب الذين ليس لديهم class_id
    students_without_class = db.query(Student).filter(Student.class_id == None).all()
    if students_without_class:
        print(f"\n🔧 Found {len(students_without_class)} students without class_id. Fixing...")
        for student in students_without_class:
            # ابحث عن الصف المناسب للطالب
            matching_class = db.query(Class).filter(
                Class.academic_year_id == student.academic_year_id,
                Class.session_type == student.session_type,
                Class.grade_level == student.grade_level,
                Class.grade_number == student.grade_number
            ).first()
            
            if matching_class:
                student.class_id = matching_class.id
                print(f"  ✅ Fixed student {student.full_name} - assigned to class_id {matching_class.id}")
            else:
                print(f"  ⚠️ No matching class found for student {student.full_name} (Grade: {student.grade_level} {student.grade_number}, Session: {student.session_type})")
        
        db.commit()
        print(f"✅ Fixed students committed to database\n")
    
    # تحقق من جميع الطلاب في قاعدة البيانات للتشخيص
    all_students = db.query(Student).all()
    all_students_count = len(all_students)
    print(f"Total students in database: {all_students_count}")
    
    if all_students_count > 0:
        print(f"ALL students in database:")
        for s in all_students:
            print(f"  - ID: {s.id}, Name: {s.full_name}, ClassID: {s.class_id}, Section: '{s.section}', GradeLevel: {s.grade_level}, GradeNumber: {s.grade_number}, Year: {s.academic_year_id}, Session: {s.session_type}, Active: {s.is_active}")
    
    # إذا كان class_id موجود، اعرض جميع الطلاب في هذا الصف
    if class_id:
        class_students = db.query(Student).filter(Student.class_id == class_id).all()
        print(f"\nAll students in class {class_id}: {len(class_students)} students")
        for s in class_students:
            print(f"  - ID: {s.id}, Name: {s.full_name}, Section: '{s.section}', Year: {s.academic_year_id}, Session: {s.session_type}, Active: {s.is_active}")
    
    query = db.query(Student)
    
    if academic_year_id:
        query = query.filter(Student.academic_year_id == academic_year_id)
    if session_type:
        query = query.filter(Student.session_type == session_type)
    if grade_level:
        query = query.filter(Student.grade_level == grade_level)
    if grade_number:
        query = query.filter(Student.grade_number == grade_number)
    if class_id:
        query = query.filter(Student.class_id == class_id)
    if section:
        query = query.filter(Student.section == section)
    if is_active is not None:
        query = query.filter(Student.is_active == is_active)
    
    students = query.offset(skip).limit(limit).all()
    
    print(f"Students found: {len(students)}")
    if students:
        print(f"Sample student data:")
        for s in students[:3]:  # عرض أول 3 طلاب
            print(f"  - ID: {s.id}, Name: {s.full_name}, Class: {s.class_id}, Section: {s.section}, Active: {s.is_active}")
    print(f"=========================\n")
    
    return students

@router.post("/", response_model=StudentResponse)
async def create_student(
    student_data: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Create new student"""
    new_student = Student(**student_data.dict())
    
    # إذا لم يتم تحديد class_id، ابحث عن الصف المناسب تلقائياً
    if not new_student.class_id:
        matching_class = db.query(Class).filter(
            Class.academic_year_id == new_student.academic_year_id,
            Class.session_type == new_student.session_type,
            Class.grade_level == new_student.grade_level,
            Class.grade_number == new_student.grade_number
        ).first()
        
        if matching_class:
            new_student.class_id = matching_class.id
            print(f"[SUCCESS] Auto-assigned class_id {matching_class.id} to new student {new_student.full_name}")
    
    db.add(new_student)
    db.commit()
    db.refresh(new_student)
    
    # Invalidate related caches
    CacheManager.invalidate_analytics('overview')
    CacheManager.invalidate_analytics('distribution')
    
    # Log history
    log_student_action(
        db=db,
        action_type="create",
        student=new_student,
        current_user=current_user,
        new_values=student_data.dict()
    )
    
    return new_student

@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Get student by ID"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    return student

@router.put("/{student_id}", response_model=StudentResponse)
async def update_student(
    student_id: int,
    student_data: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Update student information"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Store old values for history
    old_values = {field: getattr(student, field) for field in student_data.dict(exclude_unset=True).keys()}
    
    for field, value in student_data.dict(exclude_unset=True).items():
        setattr(student, field, value)
    
    db.commit()
    db.refresh(student)
    
    # Invalidate related caches
    CacheManager.invalidate_analytics('overview')
    CacheManager.invalidate_analytics('distribution')
    
    # Log history
    log_student_action(
        db=db,
        action_type="update",
        student=student,
        current_user=current_user,
        old_values=old_values,
        new_values=student_data.dict(exclude_unset=True)
    )
    
    return student

@router.delete("/{student_id}")
async def deactivate_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Deactivate student (soft delete)"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    student.is_active = False
    db.commit()
    
    # Invalidate related caches
    CacheManager.invalidate_analytics('overview')
    CacheManager.invalidate_analytics('distribution')
    
    # Log history
    log_student_action(
        db=db,
        action_type="deactivate",
        student=student,
        current_user=current_user
    )
    
    return {"message": "Student deactivated successfully"}

# Student Finance Management
@router.get("/{student_id}/finances", response_model=StudentFinanceResponse)
async def get_student_finances(
    student_id: int,
    academic_year_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get student financial information"""
    query = db.query(StudentFinance).filter(StudentFinance.student_id == student_id)
    
    if academic_year_id:
        query = query.filter(StudentFinance.academic_year_id == academic_year_id)
    else:
        # Get the most recent record
        query = query.order_by(StudentFinance.created_at.desc())
    
    finance = query.first()
    if not finance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student financial record not found"
        )
    
    return finance

@router.post("/{student_id}/finances", response_model=StudentFinanceResponse)
async def create_student_finance(
    student_id: int,
    finance_data: StudentFinanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create student financial record"""
    finance_data.student_id = student_id
    new_finance = StudentFinance(**finance_data.dict())
    db.add(new_finance)
    db.commit()
    db.refresh(new_finance)
    
    # Get student info for logging
    student = db.query(Student).filter(Student.id == student_id).first()
    
    # Log history
    log_finance_action(
        db=db,
        action_type="create",
        entity_type="student_finance",
        entity_id=new_finance.id,
        entity_name=f"سجل مالي - {student.full_name if student else student_id}",
        description=f"تم إنشاء سجل مالي للطالب: {new_finance.total_amount:,.0f} ل.س",
        current_user=current_user,
        academic_year_id=new_finance.academic_year_id,
        amount=float(new_finance.total_amount) if new_finance.total_amount else 0,
        new_values=finance_data.dict()
    )
    
    return new_finance

# Student Payment Management
@router.post("/{student_id}/payments", response_model=StudentPaymentResponse)
async def record_student_payment(
    student_id: int,
    payment_data: StudentPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Record new student payment"""
    payment_data.student_id = student_id
    new_payment = StudentPayment(**payment_data.dict())
    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)
    
    # Get student info for logging
    student = db.query(Student).filter(Student.id == student_id).first()
    
    # Log history
    log_finance_action(
        db=db,
        action_type="create",
        entity_type="student_payment",
        entity_id=new_payment.id,
        entity_name=f"دفعة - {student.full_name if student else student_id}",
        description=f"تم تسجيل دفعة للطالب {student.full_name if student else student_id}: {new_payment.payment_amount:,.0f} ل.س",
        current_user=current_user,
        academic_year_id=new_payment.academic_year_id,
        amount=float(new_payment.payment_amount),
        new_values=payment_data.dict()
    )
    
    return new_payment

# Student Academic Records
@router.get("/{student_id}/academics", response_model=List[StudentAcademicResponse])
async def get_student_academics(
    student_id: int,
    academic_year_id: Optional[int] = Query(None),
    subject_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get student academic records"""
    query = db.query(StudentAcademic).filter(StudentAcademic.student_id == student_id)
    
    if academic_year_id:
        query = query.filter(StudentAcademic.academic_year_id == academic_year_id)
    
    if subject_id:
        query = query.filter(StudentAcademic.subject_id == subject_id)
    
    academics = query.all()
    return academics

@router.post("/{student_id}/academics", response_model=StudentAcademicResponse)
async def create_student_academic(
    student_id: int,
    academic_data: StudentAcademicCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Create student academic record"""
    academic_data.student_id = student_id
    new_academic = StudentAcademic(**academic_data.dict())
    db.add(new_academic)
    db.commit()
    db.refresh(new_academic)
    
    # Invalidate academic-related caches
    CacheManager.invalidate_analytics('grades')
    CacheManager.invalidate_analytics('academic')
    
    # Get student info for logging
    student = db.query(Student).filter(Student.id == student_id).first()
    
    # Log history
    if student:
        log_student_action(
            db=db,
            action_type="create",
            student=student,
            current_user=current_user,
            new_values=academic_data.dict()
        )
    
    return new_academic

@router.put("/{student_id}/academics/{academic_id}", response_model=StudentAcademicResponse)
async def update_student_academic(
    student_id: int,
    academic_id: int,
    academic_data: StudentAcademicUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Update student academic record"""
    academic = db.query(StudentAcademic).filter(
        StudentAcademic.id == academic_id,
        StudentAcademic.student_id == student_id
    ).first()
    
    if not academic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic record not found"
        )
    
    # Store old values
    old_values = {field: getattr(academic, field) for field in academic_data.dict(exclude_unset=True).keys()}
    
    for field, value in academic_data.dict(exclude_unset=True).items():
        setattr(academic, field, value)
    
    db.commit()
    db.refresh(academic)
    
    # Invalidate academic-related caches
    CacheManager.invalidate_analytics('grades')
    CacheManager.invalidate_analytics('academic')
    
    # Get student info for logging
    student = db.query(Student).filter(Student.id == student_id).first()
    
    # Log history
    if student:
        log_student_action(
            db=db,
            action_type="update",
            student=student,
            current_user=current_user,
            old_values=old_values,
            new_values=academic_data.dict(exclude_unset=True)
        )
    
    return academic

# Search functionality
@router.get("/search/", response_model=List[StudentResponse])
async def search_students(
    q: str = Query(..., min_length=1, description="Search query (minimum 1 character)"),
    academic_year_id: Optional[int] = Query(None),
    session_type: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Search students by name"""
    from sqlalchemy import or_, func
    
    # Normalize search query for better Arabic text matching
    search_pattern = f"%{q.lower()}%"
    
    query = db.query(Student).filter(
        or_(
            func.lower(Student.full_name).like(search_pattern),
            func.lower(Student.father_name).like(search_pattern),
            func.lower(Student.mother_name).like(search_pattern)
        )
    )
    
    if academic_year_id:
        query = query.filter(Student.academic_year_id == academic_year_id)
    if session_type:
        query = query.filter(Student.session_type == session_type)
    
    students = query.limit(limit).all()
    return students