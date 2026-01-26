# Simplified Schedule API using existing models
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from collections import defaultdict

from ..database import get_db
from ..models.schedules import Schedule, ScheduleConstraint, ScheduleGenerationHistory, ConstraintTemplate, ScheduleAssignment, TimeSlot
from ..models.academic import Class, Subject
from ..models.teachers import Teacher
from ..models.users import User
from ..core.dependencies import (
    get_current_user, 
    get_school_user, 
    get_director_user,
    get_morning_supervisor,
    get_evening_supervisor,
    get_any_supervisor,
    check_session_access,
    get_user_allowed_sessions
)
from ..schemas.schedules import ScheduleGenerationRequest, ScheduleGenerationResponse
from ..services.schedule_service import ScheduleGenerationService
from ..utils.history_helper import log_schedule_action, log_system_action

router = APIRouter(tags=["schedules"])

# Simplified schemas for existing models
class ScheduleResponse(BaseModel):
    id: int
    academic_year_id: int
    session_type: str
    class_id: int
    section: Optional[str]
    day_of_week: int
    period_number: int
    subject_id: int
    teacher_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ScheduleCreate(BaseModel):
    academic_year_id: int
    session_type: str
    class_id: int
    section: Optional[str] = None
    day_of_week: int
    period_number: int
    subject_id: int
    teacher_id: int

class ScheduleUpdate(BaseModel):
    session_type: Optional[str] = None
    class_id: Optional[int] = None
    section: Optional[str] = None
    day_of_week: Optional[int] = None
    period_number: Optional[int] = None
    subject_id: Optional[int] = None
    teacher_id: Optional[int] = None

# Schedule Constraint Schemas
class ScheduleConstraintBase(BaseModel):
    academic_year_id: int
    constraint_type: str  # forbidden, required, no_consecutive, max_consecutive, min_consecutive, before_after, subject_per_day
    class_id: Optional[int] = None
    subject_id: Optional[int] = None
    teacher_id: Optional[int] = None
    day_of_week: Optional[int] = None  # 1-7 (Monday-Sunday), None for any day
    period_number: Optional[int] = None  # 1-8, None for any period
    time_range_start: Optional[int] = None  # For range constraints
    time_range_end: Optional[int] = None
    max_consecutive_periods: Optional[int] = None
    min_consecutive_periods: Optional[int] = None
    reference_subject_id: Optional[int] = None  # For before_after constraint
    placement: Optional[str] = None  # 'before' or 'after' for before_after constraint
    applies_to_all_sections: bool = False
    session_type: str = "both"  # morning, evening, both
    priority_level: int = 1  # 1=Low, 2=Medium, 3=High, 4=Critical
    description: Optional[str] = None
    is_active: bool = True

class ScheduleConstraintCreate(ScheduleConstraintBase):
    pass

class ScheduleConstraintUpdate(BaseModel):
    constraint_type: Optional[str] = None
    class_id: Optional[int] = None
    subject_id: Optional[int] = None
    teacher_id: Optional[int] = None
    day_of_week: Optional[int] = None
    period_number: Optional[int] = None
    time_range_start: Optional[int] = None
    time_range_end: Optional[int] = None
    max_consecutive_periods: Optional[int] = None
    min_consecutive_periods: Optional[int] = None
    reference_subject_id: Optional[int] = None
    placement: Optional[str] = None
    applies_to_all_sections: Optional[bool] = None
    session_type: Optional[str] = None
    priority_level: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class ScheduleConstraintResponse(BaseModel):
    id: int
    academic_year_id: Optional[int] = None
    constraint_type: Optional[str] = None
    class_id: Optional[int] = None
    subject_id: Optional[int] = None
    teacher_id: Optional[int] = None
    day_of_week: Optional[int] = None
    period_number: Optional[int] = None
    time_range_start: Optional[int] = None
    time_range_end: Optional[int] = None
    max_consecutive_periods: Optional[int] = None
    min_consecutive_periods: Optional[int] = None
    reference_subject_id: Optional[int] = None
    placement: Optional[str] = None
    applies_to_all_sections: Optional[bool] = False
    session_type: Optional[str] = "both"
    priority_level: Optional[int] = 1
    description: Optional[str] = None
    is_active: Optional[bool] = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Constraint Template Schemas
class ConstraintTemplateBase(BaseModel):
    template_name: str
    template_description: Optional[str] = None
    constraint_config: dict  # Stores constraint configuration
    is_system_template: bool = False

class ConstraintTemplateCreate(ConstraintTemplateBase):
    pass

class ConstraintTemplateUpdate(BaseModel):
    template_name: Optional[str] = None
    template_description: Optional[str] = None
    constraint_config: Optional[dict] = None
    is_system_template: Optional[bool] = None

class ConstraintTemplateResponse(ConstraintTemplateBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Basic Schedule Management
@router.get("/")
async def get_schedules(
    academic_year_id: Optional[int] = Query(None),
    session_type: Optional[str] = Query(None),
    class_id: Optional[int] = Query(None),
    teacher_id: Optional[int] = Query(None),
    day_of_week: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Get schedules with optional filtering"""
    from app.models import Teacher, Class, Subject
    
    query = db.query(Schedule)
    
    if academic_year_id:
        query = query.filter(Schedule.academic_year_id == academic_year_id)
    
    if session_type:
        query = query.filter(Schedule.session_type == session_type)
    
    if class_id:
        query = query.filter(Schedule.class_id == class_id)
    
    if teacher_id:
        query = query.filter(Schedule.teacher_id == teacher_id)
    
    if day_of_week is not None:
        query = query.filter(Schedule.day_of_week == day_of_week)
    
    schedules = query.offset(skip).limit(limit).all()
    
    # إضافة المعلومات الإضافية
    result = []
    for schedule in schedules:
        teacher = db.query(Teacher).filter(Teacher.id == schedule.teacher_id).first()
        class_obj = db.query(Class).filter(Class.id == schedule.class_id).first()
        subject = db.query(Subject).filter(Subject.id == schedule.subject_id).first()
        
        result.append({
            'id': schedule.id,
            'academic_year_id': schedule.academic_year_id,
            'session_type': schedule.session_type,
            'class_id': schedule.class_id,
            'section': schedule.section,
            'subject_id': schedule.subject_id,
            'teacher_id': schedule.teacher_id,
            'day_of_week': schedule.day_of_week,
            'period_number': schedule.period_number,
            'teacher_name': teacher.full_name if teacher else None,
            'subject_name': subject.subject_name if subject else None,
            'grade_number': class_obj.grade_number if class_obj else None,
            'grade_level': class_obj.grade_level if class_obj else None,
            'created_at': schedule.created_at.isoformat() if schedule.created_at else None,
            'updated_at': schedule.updated_at.isoformat() if schedule.updated_at else None
        })
    
    return result

@router.post("/", response_model=ScheduleResponse)
async def create_schedule_entry(
    schedule: ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """Create a new schedule entry"""
    # Check for conflicts
    existing_schedule = db.query(Schedule).filter(
        and_(
            Schedule.academic_year_id == schedule.academic_year_id,
            Schedule.session_type == schedule.session_type,
            Schedule.class_id == schedule.class_id,
            Schedule.day_of_week == schedule.day_of_week,
            Schedule.period_number == schedule.period_number
        )
    ).first()
    
    if existing_schedule:
        raise HTTPException(
            status_code=400, 
            detail="Schedule entry already exists for this class, day, and period"
        )
    
    # Check teacher availability
    teacher_conflict = db.query(Schedule).filter(
        and_(
            Schedule.academic_year_id == schedule.academic_year_id,
            Schedule.session_type == schedule.session_type,
            Schedule.teacher_id == schedule.teacher_id,
            Schedule.day_of_week == schedule.day_of_week,
            Schedule.period_number == schedule.period_number
        )
    ).first()
    
    if teacher_conflict:
        raise HTTPException(
            status_code=400,
            detail="Teacher is already assigned to another class at this time"
        )
    
    db_schedule = Schedule(**schedule.dict())
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    
    # Log history
    log_schedule_action(
        db=db,
        action_type="create",
        schedule=db_schedule,
        current_user=current_user,
        new_values=schedule.dict()
    )
    
    return db_schedule

@router.post("/generate", response_model=ScheduleGenerationResponse)
async def generate_schedule(
    request: ScheduleGenerationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """
    Generate a complete schedule automatically based on the provided configuration.
    This endpoint creates a full schedule with optimized teacher assignments and time slots.
    """
    try:
        # Check if a schedule with the same name already exists for this class
        # Skip this check for preview mode since we won't actually save
        if not request.preview_only and request.class_id and request.name:
            existing_schedule = db.query(Schedule).filter(
                and_(
                    Schedule.academic_year_id == request.academic_year_id,
                    Schedule.session_type == request.session_type.value if hasattr(request.session_type, 'value') else str(request.session_type),
                    Schedule.class_id == request.class_id,
                    Schedule.name == request.name,
                    Schedule.is_active == True
                )
            ).first()
            
            if existing_schedule:
                raise HTTPException(
                    status_code=400,
                    detail=f"يوجد بالفعل جدول باسم '{request.name}' للصف المحدد. يرجى اختيار اسم آخر."
                )
        
        # Initialize the schedule generation service
        schedule_service = ScheduleGenerationService(db)
        
        # Generate the schedule
        result = schedule_service.generate_schedule(request)
        
        return result
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Schedule generation failed: {str(e)}")

class SavePreviewRequest(BaseModel):
    request: ScheduleGenerationRequest
    preview_data: List[dict]

@router.post("/save-preview")
async def save_preview_schedule(
    save_request: SavePreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """
    Save a preview schedule to the database.
    This endpoint takes preview data from generate endpoint and saves it.
    """
    try:
        request = save_request.request
        
        # Check if a schedule with the same name already exists for this class
        # If it exists, delete it first (we're replacing it with the new preview)
        if request.class_id and request.name:
            existing_schedules = db.query(Schedule).filter(
                and_(
                    Schedule.academic_year_id == request.academic_year_id,
                    Schedule.session_type == request.session_type.value if hasattr(request.session_type, 'value') else str(request.session_type),
                    Schedule.class_id == request.class_id,
                    Schedule.section == request.section,
                    Schedule.is_active == True
                )
            ).all()
            
            if existing_schedules:
                # Delete existing schedules for this class/section
                for schedule in existing_schedules:
                    db.delete(schedule)
                db.commit()
        
        # Initialize the schedule generation service
        schedule_service = ScheduleGenerationService(db)
        
        # Save the preview schedule
        result = schedule_service.save_preview_schedule(save_request.request, save_request.preview_data)
        
        return result
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save schedule: {str(e)}")

@router.post("/generate-all")
async def generate_schedules_for_all_classes(
    academic_year_id: int,
    session_type: str,
    periods_per_day: int = 6,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """
    Generate schedules for all classes in batch
    
    Args:
        academic_year_id: Academic year ID
        session_type: morning or evening
        periods_per_day: Number of periods per day (default 6)
        
    Returns:
        Batch generation results for all classes
    """
    try:
        # Initialize the schedule generation service
        schedule_service = ScheduleGenerationService(db)
        
        # Generate schedules for all classes
        result = schedule_service.generate_schedules_for_all_classes(
            academic_year_id=academic_year_id,
            session_type=session_type,
            periods_per_day=periods_per_day
        )
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch generation failed: {str(e)}")

# IMPORTANT: /class-schedule must come BEFORE /{schedule_id} routes
# FastAPI matches routes in order - specific routes before parameterized routes
@router.delete("/class-schedule")
async def delete_class_schedule(
    academic_year_id: int = Query(..., description="Academic Year ID"),
    session_type: str = Query(..., description="Session Type: morning, evening"),
    class_id: int = Query(..., description="Class ID"),
    section: str = Query(..., description="Section number"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """
    Delete all schedules for a specific class and section.
    Also restores teacher availability for the deleted periods.
    """
    import json
    
    # Validate session_type
    if session_type not in ['morning', 'evening']:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid session_type. Must be 'morning' or 'evening', got '{session_type}'"
        )
    
    # Build query filters
    filters = [
        Schedule.academic_year_id == academic_year_id,
        Schedule.session_type == session_type,
        Schedule.class_id == class_id,
        Schedule.section == str(section)
    ]
    
    # Get all schedules that match the filters
    schedules_to_delete = db.query(Schedule).filter(and_(*filters)).all()
    
    if not schedules_to_delete:
        raise HTTPException(
            status_code=404,
            detail="لا توجد جداول مطابقة للمعايير المحددة"
        )
    
    deleted_count = len(schedules_to_delete)
    
    # Get class info for logging
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    class_name = ""
    if class_obj:
        class_name = f"الصف {class_obj.grade_number} {class_obj.grade_level}"
    
    # Collect all unique teachers and their slots to restore
    teacher_slots_to_restore = {}  # teacher_id -> [(day, period), ...]
    
    for schedule in schedules_to_delete:
        if schedule.teacher_id:
            if schedule.teacher_id not in teacher_slots_to_restore:
                teacher_slots_to_restore[schedule.teacher_id] = []
            teacher_slots_to_restore[schedule.teacher_id].append(
                (schedule.day_of_week, schedule.period_number)
            )
    
    # Delete all matching schedules
    for schedule in schedules_to_delete:
        db.delete(schedule)
    
    db.commit()
    
    # Restore teacher availability for affected teachers
    restored_teachers = []
    
    for teacher_id, slots in teacher_slots_to_restore.items():
        teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
        if teacher and teacher.free_time_slots:
            try:
                slots_data = json.loads(teacher.free_time_slots)
                
                # Restore each slot
                for day_of_week, period_number in slots:
                    day_idx = day_of_week - 1
                    period_idx = period_number - 1
                    slot_idx = day_idx * 6 + period_idx
                    
                    if 0 <= slot_idx < len(slots_data):
                        slot = slots_data[slot_idx]
                        # Only restore if this slot was assigned to this specific schedule
                        if slot.get('status') == 'assigned':
                            assignment = slot.get('assignment', {})
                            if (assignment.get('class_id') == class_id and 
                                assignment.get('section') == str(section)):
                                slots_data[slot_idx] = {
                                    'day': day_idx,
                                    'period': period_idx,
                                    'status': 'free',
                                    'is_free': True,
                                    'assignment': None
                                }
                
                # Update teacher's free_time_slots
                teacher.free_time_slots = json.dumps(slots_data)
                restored_teachers.append(teacher.full_name)
                
            except json.JSONDecodeError as e:
                print(f"Error parsing free_time_slots for teacher {teacher_id}: {e}")
            except Exception as e:
                print(f"Error restoring availability for teacher {teacher_id}: {e}")
    
    db.commit()
    
    # Log the deletion
    session_ar = "الفترة الصباحية" if session_type == "morning" else "الفترة المسائية"
    description = f"تم حذف جدول {class_name} شعبة {section} - {session_ar} ({deleted_count} حصة)"
    
    log_system_action(
        db=db,
        action_type="delete",
        entity_type="schedule",
        entity_id=class_id,
        entity_name=f"جدول {class_name} شعبة {section}",
        description=description,
        current_user=current_user,
        meta_data={
            "deleted_count": deleted_count,
            "session_type": session_type,
            "class_id": class_id,
            "section": section,
            "restored_teachers": restored_teachers
        }
    )
    
    return {
        "message": f"تم حذف جدول {class_name} شعبة {section} بنجاح",
        "deleted_count": deleted_count,
        "academic_year_id": academic_year_id,
        "session_type": session_type,
        "class_id": class_id,
        "section": section,
        "restored_teachers": restored_teachers
    }

@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Get a specific schedule entry by ID"""
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule entry not found")
    return schedule

@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: int,
    schedule_update: ScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """Update a schedule entry"""
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule entry not found")
    
    # Store old values
    old_values = {field: getattr(schedule, field) for field in schedule_update.dict(exclude_unset=True).keys()}
    
    update_data = schedule_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(schedule, field, value)
    
    db.commit()
    db.refresh(schedule)
    
    # Log history
    log_schedule_action(
        db=db,
        action_type="update",
        schedule=schedule,
        current_user=current_user,
        old_values=old_values,
        new_values=update_data
    )
    
    return schedule

@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: int,
    log_history: bool = Query(True, description="Whether to log this deletion to history"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """Delete a schedule entry"""
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule entry not found")
    
    # Only log if requested (to avoid spam when deleting multiple entries)
    if log_history:
        log_schedule_action(
            db=db,
            action_type="delete",
            schedule=schedule,
            current_user=current_user,
            description=f"تم حذف حصة من الجدول"
        )
    
    db.delete(schedule)
    db.commit()
    return {"message": "Schedule entry deleted successfully"}

# Schedule Swap Endpoint
class ScheduleSwapRequest(BaseModel):
    schedule1_id: int
    schedule2_id: int
    
class ScheduleSwapResponse(BaseModel):
    success: bool
    message: str
    schedule1: Optional[ScheduleResponse] = None
    schedule2: Optional[ScheduleResponse] = None
    conflicts: List[str] = []
    
class ScheduleSwapValidityResponse(BaseModel):
    can_swap: bool
    reason: Optional[str] = None
    conflicts: List[str] = []
    
@router.post("/swap", response_model=ScheduleSwapResponse)
async def swap_schedule_periods(
    swap_request: ScheduleSwapRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """
    Swap two schedule periods with validation and transaction support.
    This ensures data integrity and checks for conflicts before committing.
    """
    try:
        # Fetch both schedules
        schedule1 = db.query(Schedule).filter(Schedule.id == swap_request.schedule1_id).first()
        schedule2 = db.query(Schedule).filter(Schedule.id == swap_request.schedule2_id).first()
        
        if not schedule1:
            raise HTTPException(status_code=404, detail=f"Schedule 1 (ID: {swap_request.schedule1_id}) not found")
        if not schedule2:
            raise HTTPException(status_code=404, detail=f"Schedule 2 (ID: {swap_request.schedule2_id}) not found")
        
        # Validate: Must be same academic year and session
        if schedule1.academic_year_id != schedule2.academic_year_id:
            return ScheduleSwapResponse(
                success=False,
                message="لا يمكن تبديل حصص من سنوات دراسية مختلفة",
                conflicts=["Academic years don't match"]
            )
        
        if schedule1.session_type != schedule2.session_type:
            return ScheduleSwapResponse(
                success=False,
                message="لا يمكن تبديل حصص من فترات مختلفة (صباحي/مسائي)",
                conflicts=["Session types don't match"]
            )
        
        import json
        
        # Store original values - only swap subject and teacher, NOT day/period
        # The time slots (day_of_week, period_number) stay fixed for each schedule record
        original_1_subject = schedule1.subject_id
        original_1_teacher = schedule1.teacher_id
        original_2_subject = schedule2.subject_id
        original_2_teacher = schedule2.teacher_id
        
        # Helper function to check if teacher is available at a specific time slot
        def is_teacher_available(teacher_id: int, day_of_week: int, period_number: int) -> tuple[bool, str]:
            """Check if teacher is available at the given time slot based on free_time_slots"""
            teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
            if not teacher:
                return False, "المعلم غير موجود"
            
            if not teacher.free_time_slots:
                # No free_time_slots defined means teacher is available everywhere
                return True, ""
            
            try:
                slots_data = json.loads(teacher.free_time_slots)
                # Convert 1-based day/period to 0-based index
                day_idx = day_of_week - 1
                period_idx = period_number - 1
                slot_idx = day_idx * 6 + period_idx  # 6 periods per day
                
                if 0 <= slot_idx < len(slots_data):
                    slot = slots_data[slot_idx]
                    status = slot.get('status', 'free')
                    is_free = slot.get('is_free', True)
                    
                    # Check if slot is marked as unavailable (not free and not assigned)
                    if status == 'unavailable' or (not is_free and status != 'assigned'):
                        return False, f"المعلم {teacher.full_name} غير متاح في هذا الوقت"
                    
                    # If it's assigned to a different class, that's handled by schedule conflict check
                    return True, ""
                    
            except (json.JSONDecodeError, TypeError, IndexError) as e:
                print(f"Error parsing free_time_slots for teacher {teacher_id}: {e}")
            
            return True, ""  # Default to available if can't parse
        
        # Check teacher availability BEFORE performing the swap
        conflicts = []
        
        # Check if teacher2 (who will move to schedule1's position) is available at that time
        available1, msg1 = is_teacher_available(original_2_teacher, schedule1.day_of_week, schedule1.period_number)
        if not available1:
            conflicts.append(msg1)
        
        # Check if teacher1 (who will move to schedule2's position) is available at that time
        available2, msg2 = is_teacher_available(original_1_teacher, schedule2.day_of_week, schedule2.period_number)
        if not available2:
            conflicts.append(msg2)
        
        # If availability conflicts found, return error immediately
        if conflicts:
            return ScheduleSwapResponse(
                success=False,
                message="فشل التبديل بسبب عدم توفر المعلم",
                conflicts=conflicts
            )
        
        # Perform swap - only swap subject and teacher
        # Each schedule record keeps its original time slot (day/period)
        schedule1.subject_id = original_2_subject
        schedule1.teacher_id = original_2_teacher
        
        schedule2.subject_id = original_1_subject
        schedule2.teacher_id = original_1_teacher
        
        # Debug logging
        print(f"DEBUG SWAP: schedule1 (id={schedule1.id}) at day={schedule1.day_of_week}, period={schedule1.period_number} now has subject={schedule1.subject_id}, teacher={schedule1.teacher_id}")
        print(f"DEBUG SWAP: schedule2 (id={schedule2.id}) at day={schedule2.day_of_week}, period={schedule2.period_number} now has subject={schedule2.subject_id}, teacher={schedule2.teacher_id}")
        
        # Check for schedule conflicts after swap (teacher teaching two classes at same time)
        # Check if the new teacher at schedule1's position has another class at this time
        teacher1_conflict = db.query(Schedule).filter(
            Schedule.id != schedule1.id,
            Schedule.id != schedule2.id,
            Schedule.teacher_id == schedule1.teacher_id,
            Schedule.day_of_week == schedule1.day_of_week,
            Schedule.period_number == schedule1.period_number,
            Schedule.academic_year_id == schedule1.academic_year_id,
            Schedule.session_type == schedule1.session_type
        ).first()
        
        if teacher1_conflict:
            print(f"DEBUG: teacher1_conflict found: id={teacher1_conflict.id}")
            conflicts.append(f"المعلم لديه حصة أخرى في هذا الوقت")
        
        # Check if the new teacher at schedule2's position has another class at this time
        teacher2_conflict = db.query(Schedule).filter(
            Schedule.id != schedule1.id,
            Schedule.id != schedule2.id,
            Schedule.teacher_id == schedule2.teacher_id,
            Schedule.day_of_week == schedule2.day_of_week,
            Schedule.period_number == schedule2.period_number,
            Schedule.academic_year_id == schedule2.academic_year_id,
            Schedule.session_type == schedule2.session_type
        ).first()
        
        if teacher2_conflict:
            print(f"DEBUG: teacher2_conflict found: id={teacher2_conflict.id}")
            conflicts.append(f"المعلم لديه حصة أخرى في هذا الوقت")
        
        # No class conflict checks needed - we're not changing time slots
        
        # If conflicts found, rollback and return error
        if conflicts:
            db.rollback()
            return ScheduleSwapResponse(
                success=False,
                message="فشل التبديل بسبب تعارضات",
                conflicts=conflicts
            )
        
        # No conflicts, commit the swap
        db.commit()
        db.refresh(schedule1)
        db.refresh(schedule2)
        
        return ScheduleSwapResponse(
            success=True,
            message="تم تبديل الحصص بنجاح",
            schedule1=ScheduleResponse.model_validate(schedule1),
            schedule2=ScheduleResponse.model_validate(schedule2),
            conflicts=[]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error swapping schedules: {str(e)}")

@router.post("/check-swap-validity", response_model=ScheduleSwapValidityResponse)
async def check_swap_validity(
    swap_request: ScheduleSwapRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """Check if two schedule periods can be swapped without actually performing the swap.

    This mirrors the validation logic in swap_schedule_periods but does not modify the database.
    """
    # Fetch both schedules
    schedule1 = db.query(Schedule).filter(Schedule.id == swap_request.schedule1_id).first()
    schedule2 = db.query(Schedule).filter(Schedule.id == swap_request.schedule2_id).first()

    if not schedule1 or not schedule2:
        return ScheduleSwapValidityResponse(
            can_swap=False,
            reason="أحد الحصتين غير موجودة",
            conflicts=[
                msg
                for msg in [
                    None if schedule1 else f"Schedule 1 (ID: {swap_request.schedule1_id}) not found",
                    None if schedule2 else f"Schedule 2 (ID: {swap_request.schedule2_id}) not found",
                ]
                if msg is not None
            ],
        )

    # Validate: Must be same academic year and session
    if schedule1.academic_year_id != schedule2.academic_year_id:
        return ScheduleSwapValidityResponse(
            can_swap=False,
            reason="لا يمكن تبديل حصص من سنوات دراسية مختلفة",
            conflicts=["Academic years don't match"],
        )

    if schedule1.session_type != schedule2.session_type:
        return ScheduleSwapValidityResponse(
            can_swap=False,
            reason="لا يمكن تبديل حصص من فترات مختلفة (صباحي/مسائي)",
            conflicts=["Session types don't match"],
        )

    import json
    
    conflicts: List[str] = []

    # Helper function to check if teacher is available at a specific time slot
    def is_teacher_available(teacher_id: int, day_of_week: int, period_number: int) -> tuple[bool, str]:
        """Check if teacher is available at the given time slot based on free_time_slots"""
        teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
        if not teacher:
            return False, "المعلم غير موجود"
        
        if not teacher.free_time_slots:
            return True, ""
        
        try:
            slots_data = json.loads(teacher.free_time_slots)
            day_idx = day_of_week - 1
            period_idx = period_number - 1
            slot_idx = day_idx * 6 + period_idx
            
            if 0 <= slot_idx < len(slots_data):
                slot = slots_data[slot_idx]
                status = slot.get('status', 'free')
                is_free = slot.get('is_free', True)
                
                if status == 'unavailable' or (not is_free and status != 'assigned'):
                    return False, f"المعلم {teacher.full_name} غير متاح في هذا الوقت"
                
                return True, ""
                
        except (json.JSONDecodeError, TypeError, IndexError):
            pass
        
        return True, ""

    # Check teacher availability first
    # Check if teacher2 (who will move to schedule1's position) is available
    available1, msg1 = is_teacher_available(schedule2.teacher_id, schedule1.day_of_week, schedule1.period_number)
    if not available1:
        conflicts.append(msg1)
    
    # Check if teacher1 (who will move to schedule2's position) is available
    available2, msg2 = is_teacher_available(schedule1.teacher_id, schedule2.day_of_week, schedule2.period_number)
    if not available2:
        conflicts.append(msg2)

    # Check schedule conflicts (teacher teaching two classes at same time)
    # Check if teacher2 (who will move to schedule1's position) has a conflict
    teacher2_at_slot1_conflict = db.query(Schedule).filter(
        Schedule.id != schedule1.id,
        Schedule.id != schedule2.id,
        Schedule.teacher_id == schedule2.teacher_id,
        Schedule.day_of_week == schedule1.day_of_week,
        Schedule.period_number == schedule1.period_number,
        Schedule.academic_year_id == schedule1.academic_year_id,
        Schedule.session_type == schedule1.session_type,
    ).first()
    if teacher2_at_slot1_conflict:
        conflicts.append(f"المعلم لديه حصة أخرى في هذا الوقت")

    # Check if teacher1 (who will move to schedule2's position) has a conflict
    teacher1_at_slot2_conflict = db.query(Schedule).filter(
        Schedule.id != schedule1.id,
        Schedule.id != schedule2.id,
        Schedule.teacher_id == schedule1.teacher_id,
        Schedule.day_of_week == schedule2.day_of_week,
        Schedule.period_number == schedule2.period_number,
        Schedule.academic_year_id == schedule2.academic_year_id,
        Schedule.session_type == schedule2.session_type,
    ).first()
    if teacher1_at_slot2_conflict:
        conflicts.append(f"المعلم لديه حصة أخرى في هذا الوقت")

    if conflicts:
        return ScheduleSwapValidityResponse(
            can_swap=False,
            reason="فشل التبديل بسبب تعارضات",
            conflicts=conflicts,
        )

    return ScheduleSwapValidityResponse(
        can_swap=True,
        reason="يمكن التبديل بدون تعارض",
        conflicts=[],
    )

# Schedule Constraint Management
@router.get("/constraints/", response_model=List[ScheduleConstraintResponse])
async def get_schedule_constraints(
    academic_year_id: Optional[int] = Query(None),
    constraint_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Get schedule constraints with optional filtering"""
    query = db.query(ScheduleConstraint)
    
    if academic_year_id:
        query = query.filter(ScheduleConstraint.academic_year_id == academic_year_id)
    
    if constraint_type:
        query = query.filter(ScheduleConstraint.constraint_type == constraint_type)
    
    if is_active is not None:
        query = query.filter(ScheduleConstraint.is_active == is_active)
    
    constraints = query.offset(skip).limit(limit).all()
    return constraints

@router.post("/constraints/", response_model=ScheduleConstraintResponse)
async def create_schedule_constraint(
    constraint: ScheduleConstraintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """Create a new schedule constraint"""
    # Validate constraint type
    valid_constraint_types = ["forbidden", "required", "no_consecutive", "max_consecutive", "min_consecutive", "before_after", "subject_per_day"]
    if constraint.constraint_type not in valid_constraint_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid constraint type. Must be one of: {', '.join(valid_constraint_types)}"
        )
    
    # Validate before_after constraint requires reference_subject_id and placement
    if constraint.constraint_type == "before_after":
        if not constraint.reference_subject_id:
            raise HTTPException(
                status_code=400,
                detail="before_after constraint requires reference_subject_id"
            )
        if constraint.placement not in ["before", "after"]:
            raise HTTPException(
                status_code=400,
                detail="before_after constraint requires placement to be 'before' or 'after'"
            )
    
    # Validate session type
    valid_session_types = ["morning", "evening", "both"]
    if constraint.session_type not in valid_session_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid session type. Must be one of: {', '.join(valid_session_types)}"
        )
    
    # Validate priority level
    if constraint.priority_level < 1 or constraint.priority_level > 4:
        raise HTTPException(
            status_code=400,
            detail="Priority level must be between 1 and 4"
        )
    
    # Validate time range if provided
    if constraint.time_range_start is not None and constraint.time_range_end is not None:
        if constraint.time_range_start >= constraint.time_range_end:
            raise HTTPException(
                status_code=400,
                detail="time_range_start must be less than time_range_end"
            )
    
    # Validate consecutive periods if provided
    if constraint.max_consecutive_periods is not None and constraint.max_consecutive_periods < 1:
        raise HTTPException(
            status_code=400,
            detail="max_consecutive_periods must be at least 1"
        )
    
    if constraint.min_consecutive_periods is not None and constraint.min_consecutive_periods < 1:
        raise HTTPException(
            status_code=400,
            detail="min_consecutive_periods must be at least 1"
        )
    
    # Check for duplicate constraint (same subject, type, class, academic year)
    existing_constraint = db.query(ScheduleConstraint).filter(
        ScheduleConstraint.academic_year_id == constraint.academic_year_id,
        ScheduleConstraint.subject_id == constraint.subject_id,
        ScheduleConstraint.constraint_type == constraint.constraint_type,
        ScheduleConstraint.class_id == constraint.class_id
    ).first()
    
    if existing_constraint:
        raise HTTPException(
            status_code=400,
            detail="هذا القيد موجود بالفعل لهذه المادة"
        )
    
    db_constraint = ScheduleConstraint(**constraint.dict())
    db.add(db_constraint)
    db.commit()
    db.refresh(db_constraint)
    return db_constraint

@router.get("/constraints/{constraint_id}", response_model=ScheduleConstraintResponse)
async def get_schedule_constraint(
    constraint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Get a specific schedule constraint by ID"""
    constraint = db.query(ScheduleConstraint).filter(ScheduleConstraint.id == constraint_id).first()
    if not constraint:
        raise HTTPException(status_code=404, detail="Schedule constraint not found")
    return constraint

@router.put("/constraints/{constraint_id}", response_model=ScheduleConstraintResponse)
async def update_schedule_constraint(
    constraint_id: int,
    constraint_update: ScheduleConstraintUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """Update a schedule constraint"""
    constraint = db.query(ScheduleConstraint).filter(ScheduleConstraint.id == constraint_id).first()
    if not constraint:
        raise HTTPException(status_code=404, detail="Schedule constraint not found")
    
    update_data = constraint_update.dict(exclude_unset=True)
    
    # Validate constraint type if being updated
    if "constraint_type" in update_data:
        valid_constraint_types = ["forbidden", "required", "no_consecutive", "max_consecutive", "min_consecutive", "before_after", "subject_per_day"]
        if update_data["constraint_type"] not in valid_constraint_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid constraint type. Must be one of: {', '.join(valid_constraint_types)}"
            )
    
    # Validate session type if being updated
    if "session_type" in update_data:
        valid_session_types = ["morning", "evening", "both"]
        if update_data["session_type"] not in valid_session_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid session type. Must be one of: {', '.join(valid_session_types)}"
            )
    
    # Validate priority level if being updated
    if "priority_level" in update_data:
        if update_data["priority_level"] < 1 or update_data["priority_level"] > 4:
            raise HTTPException(
                status_code=400,
                detail="Priority level must be between 1 and 4"
            )
    
    # Validate time range if being updated
    if "time_range_start" in update_data and "time_range_end" in update_data:
        if update_data["time_range_start"] is not None and update_data["time_range_end"] is not None:
            if update_data["time_range_start"] >= update_data["time_range_end"]:
                raise HTTPException(
                    status_code=400,
                    detail="time_range_start must be less than time_range_end"
                )
    
    # Validate consecutive periods if being updated
    if "max_consecutive_periods" in update_data:
        if update_data["max_consecutive_periods"] is not None and update_data["max_consecutive_periods"] < 1:
            raise HTTPException(
                status_code=400,
                detail="max_consecutive_periods must be at least 1"
            )
    
    if "min_consecutive_periods" in update_data:
        if update_data["min_consecutive_periods"] is not None and update_data["min_consecutive_periods"] < 1:
            raise HTTPException(
                status_code=400,
                detail="min_consecutive_periods must be at least 1"
            )
    
    for field, value in update_data.items():
        setattr(constraint, field, value)
    
    db.commit()
    db.refresh(constraint)
    return constraint

@router.delete("/constraints/{constraint_id}")
async def delete_schedule_constraint(
    constraint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """Delete a schedule constraint"""
    constraint = db.query(ScheduleConstraint).filter(ScheduleConstraint.id == constraint_id).first()
    if not constraint:
        raise HTTPException(status_code=404, detail="Schedule constraint not found")
    
    db.delete(constraint)
    db.commit()
    return {"message": "Schedule constraint deleted successfully"}

# Constraint Template Management
@router.get("/constraint-templates/", response_model=List[ConstraintTemplateResponse])
async def get_constraint_templates(
    is_system_template: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Get constraint templates with optional filtering"""
    query = db.query(ConstraintTemplate)
    
    if is_system_template is not None:
        query = query.filter(ConstraintTemplate.is_system_template == is_system_template)
    
    templates = query.offset(skip).limit(limit).all()
    return templates

@router.post("/constraint-templates/", response_model=ConstraintTemplateResponse)
async def create_constraint_template(
    template: ConstraintTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """Create a new constraint template"""
    db_template = ConstraintTemplate(**template.dict())
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template

@router.get("/constraint-templates/{template_id}", response_model=ConstraintTemplateResponse)
async def get_constraint_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Get a specific constraint template by ID"""
    template = db.query(ConstraintTemplate).filter(ConstraintTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Constraint template not found")
    return template

@router.put("/constraint-templates/{template_id}", response_model=ConstraintTemplateResponse)
async def update_constraint_template(
    template_id: int,
    template_update: ConstraintTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """Update a constraint template"""
    template = db.query(ConstraintTemplate).filter(ConstraintTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Constraint template not found")
    
    update_data = template_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    
    db.commit()
    db.refresh(template)
    return template

@router.delete("/constraint-templates/{template_id}")
async def delete_constraint_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """Delete a constraint template"""
    template = db.query(ConstraintTemplate).filter(ConstraintTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Constraint template not found")
    
    db.delete(template)
    db.commit()
    return {"message": "Constraint template deleted successfully"}

@router.get("/weekly-view")
async def get_weekly_schedule_view(
    academic_year_id: int,
    session_type: str,
    class_id: Optional[int] = Query(None),
    teacher_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Get weekly schedule view"""
    query = db.query(Schedule).filter(
        and_(
            Schedule.academic_year_id == academic_year_id,
            Schedule.session_type == session_type
        )
    )
    
    if class_id:
        query = query.filter(Schedule.class_id == class_id)
    
    if teacher_id:
        query = query.filter(Schedule.teacher_id == teacher_id)
    
    schedules = query.all()
    
    # Organize by day and period
    weekly_view = {}
    
    for schedule in schedules:
        day = schedule.day_of_week
        period = schedule.period_number
        
        if day not in weekly_view:
            weekly_view[day] = {}
        
        weekly_view[day][period] = {
            "schedule_id": schedule.id,
            "class_id": schedule.class_id,
            "subject_id": schedule.subject_id,
            "teacher_id": schedule.teacher_id,
            "section": schedule.section
        }
    
    return {
        "academic_year_id": academic_year_id,
        "session_type": session_type,
        "view_type": "weekly",
        "data": weekly_view
    }

@router.get("/analysis/conflicts")
async def analyze_schedule_conflicts(
    academic_year_id: int,
    session_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Analyze schedule for conflicts"""
    schedules = db.query(Schedule).filter(
        and_(
            Schedule.academic_year_id == academic_year_id,
            Schedule.session_type == session_type
        )
    ).all()
    
    conflicts = []
    
    # Check for teacher conflicts
    teacher_schedule = {}
    for schedule in schedules:
        key = (schedule.teacher_id, schedule.day_of_week, schedule.period_number)
        if key in teacher_schedule:
            conflicts.append({
                "type": "teacher_conflict",
                "teacher_id": schedule.teacher_id,
                "day_of_week": schedule.day_of_week,
                "period_number": schedule.period_number,
                "conflicting_schedules": [teacher_schedule[key], schedule.id]
            })
        else:
            teacher_schedule[key] = schedule.id
    
    return {
        "academic_year_id": academic_year_id,
        "session_type": session_type,
        "total_conflicts": len(conflicts),
        "conflicts": conflicts
    }

# Draft Management Endpoints
@router.get("/drafts", response_model=List[ScheduleResponse])
async def get_draft_schedules(
    academic_year_id: Optional[int] = Query(None),
    session_type: Optional[str] = Query(None),
    class_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Get all draft schedules"""
    query = db.query(Schedule).filter(Schedule.status == "draft")
    
    if academic_year_id:
        query = query.filter(Schedule.academic_year_id == academic_year_id)
    
    if session_type:
        query = query.filter(Schedule.session_type == session_type)
    
    if class_id:
        query = query.filter(Schedule.class_id == class_id)
    
    drafts = query.offset(skip).limit(limit).all()
    return drafts

@router.post("/{schedule_id}/publish", response_model=ScheduleResponse)
async def publish_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """
    Publish a draft schedule after validating for conflicts
    """
    from ..services.teacher_availability_service import TeacherAvailabilityService
    
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    if schedule.status == "published":
        raise HTTPException(status_code=400, detail="Schedule is already published")
    
    # Check for conflicts before publishing
    conflicts = []
    
    # Get all assignments for this schedule
    assignments = db.query(ScheduleAssignment).filter(
        ScheduleAssignment.schedule_id == schedule_id
    ).all()
    
    # Check for teacher conflicts
    for assignment in assignments:
        if not assignment.teacher_id or not assignment.time_slot_id:
            continue
            
        from ..models.schedules import TimeSlot
        time_slot = db.query(TimeSlot).filter(TimeSlot.id == assignment.time_slot_id).first()
        
        if time_slot:
            # Check if teacher has another assignment at the same time
            conflicting_assignment = db.query(ScheduleAssignment).join(
                TimeSlot, ScheduleAssignment.time_slot_id == TimeSlot.id
            ).filter(
                and_(
                    ScheduleAssignment.teacher_id == assignment.teacher_id,
                    ScheduleAssignment.schedule_id != schedule_id,
                    TimeSlot.day_of_week == time_slot.day_of_week,
                    TimeSlot.period_number == time_slot.period_number,
                    ScheduleAssignment.id != assignment.id
                )
            ).join(
                Schedule, ScheduleAssignment.schedule_id == Schedule.id
            ).filter(
                Schedule.status == "published"
            ).first()
            
            if conflicting_assignment:
                teacher = db.query(Teacher).filter(Teacher.id == assignment.teacher_id).first()
                conflicts.append({
                    "type": "teacher_conflict",
                    "severity": "critical",
                    "description": f"المعلم {teacher.full_name if teacher else 'Unknown'} لديه حصة أخرى في نفس الوقت",
                    "teacher_id": assignment.teacher_id,
                    "day": time_slot.day_of_week,
                    "period": time_slot.period_number
                })
    
    # Check for constraint violations
    constraints = db.query(ScheduleConstraint).filter(
        and_(
            ScheduleConstraint.academic_year_id == schedule.academic_year_id,
            ScheduleConstraint.is_active == True
        )
    ).all()
    
    # For now, just check if there are active constraints (detailed validation can be added)
    if len(constraints) > 0:
        # TODO: Implement detailed constraint validation
        pass
    
    # If there are critical conflicts, block publishing
    critical_conflicts = [c for c in conflicts if c.get("severity") == "critical"]
    if critical_conflicts:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Cannot publish schedule with critical conflicts",
                "conflicts": critical_conflicts
            }
        )
    
    # Update schedule status to published
    schedule.status = "published"
    db.commit()
    
    # Log history
    log_schedule_action(
        db=db,
        action_type="publish",
        schedule=schedule,
        current_user=current_user,
        new_values={"status": "published"}
    )
    
    # Update teacher availability
    availability_service = TeacherAvailabilityService(db)
    availability_service.update_teacher_availability_on_schedule_save(schedule_id)
    
    db.refresh(schedule)
    return schedule

@router.delete("/{schedule_id}")
async def delete_schedule_with_availability_restore(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """Delete a schedule and restore teacher availability"""
    from ..services.teacher_availability_service import TeacherAvailabilityService
    
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Restore teacher availability if schedule was published
    if schedule.status == "published":
        availability_service = TeacherAvailabilityService(db)
        result = availability_service.update_teacher_availability_on_schedule_delete(schedule_id)
    
    # Delete the schedule (cascade will delete assignments and time slots)
    db.delete(schedule)
    db.commit()
    
    return {
        "message": "Schedule deleted successfully",
        "teachers_restored": result.get("restored_teachers", []) if schedule.status == "published" else []
    }

@router.post("/{schedule_id}/save-as-draft", response_model=ScheduleResponse)
async def save_schedule_as_draft(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Save/update a schedule as draft without publishing"""
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Ensure status is draft
    schedule.status = "draft"
    db.commit()
    db.refresh(schedule)
    
    return schedule

@router.delete("/bulk-delete")
async def bulk_delete_schedules(
    academic_year_id: int = Query(..., description="Academic Year ID"),
    session_type: str = Query(..., description="Session Type: morning, evening"),
    class_id: Optional[int] = Query(None, description="Optional: Delete schedules only for specific class"),
    section: Optional[str] = Query(None, description="Optional: Delete schedules only for specific section"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """
    Bulk delete schedules for a specific academic year and session type
    Optionally filter by class_id and section
    """
    # Validate session_type
    if session_type not in ['morning', 'evening']:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid session_type. Must be 'morning' or 'evening', got '{session_type}'"
        )
    
    # Build query filters
    filters = [
        Schedule.academic_year_id == academic_year_id,
        Schedule.session_type == session_type
    ]
    
    if class_id:
        filters.append(Schedule.class_id == class_id)
    
    if section and section.strip():
        filters.append(Schedule.section == str(section).strip())
    
    # Get all schedules that match the filters
    schedules_to_delete = db.query(Schedule).filter(and_(*filters)).all()
    
    deleted_count = len(schedules_to_delete)
    
    if deleted_count == 0:
        return {
            "message": "No schedules found matching the criteria",
            "deleted_count": 0,
            "academic_year_id": academic_year_id,
            "session_type": session_type,
            "class_id": class_id,
            "section": section
        }
    
    # Get class and section info for logging
    class_name = ""
    section_name = ""
    if class_id and schedules_to_delete:
        first_schedule = schedules_to_delete[0]
        if first_schedule.class_relation:
            class_name = f"{first_schedule.class_relation.name}"
        if section:
            section_name = f" شعبة {section}"
    
    # Delete all matching schedules
    for schedule in schedules_to_delete:
        db.delete(schedule)
    
    db.commit()
    
    # Log single history entry for bulk deletion
    session_ar = "الفترة الصباحية" if session_type == "morning" else "الفترة المسائية"
    description = f"تم حذف جدول {class_name}{section_name} - {session_ar} ({deleted_count} حصة)"
    
    log_system_action(
        db=db,
        action_type="delete",
        entity_type="schedule",
        entity_id=academic_year_id,
        entity_name=f"جدول {class_name}{section_name}",
        description=description,
        current_user=current_user,
        meta_data={
            "deleted_count": deleted_count,
            "session_type": session_type,
            "class_id": class_id,
            "section": section
        }
    )
    
    return {
        "message": f"Successfully deleted {deleted_count} schedules",
        "deleted_count": deleted_count,
        "academic_year_id": academic_year_id,
        "session_type": session_type,
        "class_id": class_id,
        "section": section
    }

@router.get("/{schedule_id}/conflicts")
async def get_schedule_conflicts(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Get detailed conflict analysis for a specific schedule"""
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    conflicts = []
    warnings = []
    
    # Get all assignments for this schedule
    assignments = db.query(ScheduleAssignment).filter(
        ScheduleAssignment.schedule_id == schedule_id
    ).all()
    
    # Check for teacher conflicts
    for assignment in assignments:
        if not assignment.teacher_id or not assignment.time_slot_id:
            warnings.append({
                "type": "incomplete_assignment",
                "severity": "medium",
                "description": "توجد حصة بدون معلم محدد",
                "assignment_id": assignment.id
            })
            continue
            
        from ..models.schedules import TimeSlot
        time_slot = db.query(TimeSlot).filter(TimeSlot.id == assignment.time_slot_id).first()
        
        if time_slot:
            # Check for teacher double-booking
            conflicting = db.query(ScheduleAssignment).join(
                TimeSlot, ScheduleAssignment.time_slot_id == TimeSlot.id
            ).filter(
                and_(
                    ScheduleAssignment.teacher_id == assignment.teacher_id,
                    ScheduleAssignment.id != assignment.id,
                    TimeSlot.day_of_week == time_slot.day_of_week,
                    TimeSlot.period_number == time_slot.period_number
                )
            ).first()
            
            if conflicting:
                teacher = db.query(Teacher).filter(Teacher.id == assignment.teacher_id).first()
                subject = db.query(Subject).filter(Subject.id == assignment.subject_id).first()
                conflicts.append({
                    "type": "teacher_conflict",
                    "severity": "critical",
                    "description": f"المعلم {teacher.full_name if teacher else ''} لديه تعارض في الحصة",
                    "teacher_id": assignment.teacher_id,
                    "teacher_name": teacher.full_name if teacher else "Unknown",
                    "subject_name": subject.subject_name if subject else "Unknown",
                    "day": time_slot.day_of_week,
                    "period": time_slot.period_number,
                    "suggestion": "اختر فترة زمنية مختلفة أو معلم آخر"
                })
    
    # Check constraint violations
    constraints = db.query(ScheduleConstraint).filter(
        and_(
            ScheduleConstraint.academic_year_id == schedule.academic_year_id,
            ScheduleConstraint.is_active == True
        )
    ).all()
    
    for constraint in constraints:
        # Check if constraint applies to this class
        if constraint.class_id and constraint.class_id != schedule.class_id:
            continue
            
        # Check constraint type and validate
        if constraint.constraint_type == "no_consecutive" and constraint.subject_id:
            # Check for consecutive periods of the same subject
            subject_assignments = [a for a in assignments if a.subject_id == constraint.subject_id]
            
            # Group by day
            from collections import defaultdict
            by_day = defaultdict(list)
            for sa in subject_assignments:
                ts = db.query(TimeSlot).filter(TimeSlot.id == sa.time_slot_id).first()
                if ts:
                    by_day[ts.day_of_week].append(ts.period_number)
            
            # Check for consecutive periods
            for day, periods in by_day.items():
                sorted_periods = sorted(periods)
                for i in range(len(sorted_periods) - 1):
                    if sorted_periods[i + 1] == sorted_periods[i] + 1:
                        subject = db.query(Subject).filter(Subject.id == constraint.subject_id).first()
                        severity = "critical" if constraint.priority_level >= 4 else "warning"
                        conflicts.append({
                            "type": "constraint_violation",
                            "constraint_type": "no_consecutive",
                            "severity": severity,
                            "description": f"القيد: لا يجب أن تكون حصص {subject.subject_name if subject else 'المادة'} متتالية",
                            "subject_id": constraint.subject_id,
                            "day": day,
                            "periods": [sorted_periods[i], sorted_periods[i + 1]],
                            "suggestion": "قم بتوزيع حصص المادة على فترات غير متتالية"
                        })
    
    return {
        "schedule_id": schedule_id,
        "status": schedule.status,
        "total_conflicts": len(conflicts),
        "total_warnings": len(warnings),
        "conflicts": conflicts,
        "warnings": warnings,
        "can_publish": len([c for c in conflicts if c.get("severity") == "critical"]) == 0
    }

# Export Endpoints
@router.get("/{schedule_id}/export/excel")
async def export_schedule_to_excel(
    schedule_id: int,
    include_logo: bool = Query(True),
    include_notes: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export schedule to Excel format"""
    from ..services.export_service import ExportService
    from fastapi.responses import StreamingResponse
    
    export_service = ExportService(db)
    
    try:
        excel_file = export_service.export_schedule_excel(
            schedule_id=schedule_id,
            include_logo=include_logo,
            include_notes=include_notes
        )
        
        # Get schedule for filename
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        class_obj = db.query(Class).filter(Class.id == schedule.class_id).first()
        filename = f"schedule_{class_obj.grade_number if class_obj else schedule_id}_{schedule.section or '1'}.xlsx"
        
        return StreamingResponse(
            excel_file,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

@router.post("/bulk-export")
async def bulk_export_schedules(
    schedule_ids: List[int],
    format: str = Query("excel", regex="^(excel)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """
    Bulk export multiple schedules
    Note: Returns a ZIP file containing all exported schedules
    """
    from ..services.export_service import ExportService
    from fastapi.responses import StreamingResponse
    import zipfile
    from io import BytesIO
    
    export_service = ExportService(db)
    
    try:
        # Create ZIP file
        zip_buffer = BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for schedule_id in schedule_ids:
                schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
                if not schedule:
                    continue
                
                class_obj = db.query(Class).filter(Class.id == schedule.class_id).first()
                base_filename = f"schedule_{class_obj.grade_number if class_obj else schedule_id}_{schedule.section or '1'}"
                
                file_content = export_service.export_schedule_excel(schedule_id)
                filename = f"{base_filename}.xlsx"
                
                zip_file.writestr(filename, file_content.read())
        
        zip_buffer.seek(0)
        
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=schedules_export.zip"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bulk export failed: {str(e)}")

# Validation endpoint
@router.post("/validate")
async def validate_schedule_prerequisites(
    academic_year_id: int,
    class_id: int,
    section: Optional[str] = None,
    session_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Validate schedule prerequisites before generation"""
    from ..services.validation_service import ValidationService
    
    validation_service = ValidationService(db)
    
    result = validation_service.validate_schedule_prerequisites(
        academic_year_id=academic_year_id,
        class_id=class_id,
        section=section,
        session_type=session_type
    )
    
    return result

@router.get("/check-teacher-availability")
async def check_teacher_availability_endpoint(
    teacher_id: int,
    required_periods: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_school_user)
):
    """Check if teacher has sufficient availability"""
    from ..services.teacher_availability_service import TeacherAvailabilityService
    
    availability_service = TeacherAvailabilityService(db)
    
    result = availability_service.check_teacher_sufficient_availability(
        teacher_id=teacher_id,
        required_periods=required_periods
    )
    
    return result

@router.get("/diagnostics")
async def get_schedule_generation_diagnostics(
    academic_year_id: int,
    session_type: str,
    db: Session = Depends(get_db)
):
    """
    Diagnostic endpoint to check if system is ready for schedule generation
    Returns detailed information about classes, subjects, teachers, and assignments
    Note: This endpoint doesn't require authentication for easier debugging
    """
    from ..models.teachers import TeacherAssignment
    
    # Log the incoming parameters for debugging
    print(f"\n=== Diagnostics Request ===")
    print(f"Academic Year ID: {academic_year_id}")
    print(f"Session Type: '{session_type}'")
    
    # Validate session_type
    if session_type not in ['morning', 'evening']:
        print(f"ERROR: Invalid session_type: '{session_type}'")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid session_type. Must be 'morning' or 'evening', got '{session_type}'"
        )
    
    # Get classes for this academic year and session
    classes = db.query(Class).filter(
        and_(
            Class.academic_year_id == academic_year_id,
            or_(Class.session_type == session_type, Class.session_type == "both")
        )
    ).all()
    
    # Get all subjects
    subjects = db.query(Subject).filter(Subject.is_active == True).all()
    
    # Get available teachers
    teachers = db.query(Teacher).filter(
        and_(
            Teacher.is_active == True,
            or_(
                Teacher.transportation_type.like(f"%{session_type}%"),
                Teacher.transportation_type == "both"
            )
        )
    ).all()
    
    # Get teacher assignments
    teacher_assignments = db.query(TeacherAssignment).filter(
        TeacherAssignment.is_active == True
    ).all()
    
    # Analyze each class
    classes_analysis = []
    total_subjects_needed = 0
    total_teachers_needed = 0
    missing_subjects = []
    missing_teachers = []
    
    for cls in classes:
        # Get subjects for this class
        class_subjects = [s for s in subjects if s.class_id == cls.id]
        total_subjects_needed += len(class_subjects)
        
        if not class_subjects:
            missing_subjects.append({
                "class_id": cls.id,
                "class_name": f"{cls.grade_level} - الصف {cls.grade_number}",
                "issue": "لا توجد مواد مرتبطة بهذا الصف"
            })
        
        # Check if subjects have teachers
        subjects_without_teachers = []
        for subject in class_subjects:
            # Find teachers assigned to this subject
            assigned_teachers = [
                ta for ta in teacher_assignments 
                if ta.subject_id == subject.id and ta.is_active
            ]
            
            if not assigned_teachers:
                subjects_without_teachers.append({
                    "subject_id": subject.id,
                    "subject_name": subject.subject_name,
                    "issue": "لا يوجد معلم مكلف بتدريس هذه المادة"
                })
                missing_teachers.append({
                    "class_id": cls.id,
                    "class_name": f"{cls.grade_level} - الصف {cls.grade_number}",
                    "subject_id": subject.id,
                    "subject_name": subject.subject_name
                })
        
        classes_analysis.append({
            "class_id": cls.id,
            "class_name": f"{cls.grade_level} - الصف {cls.grade_number}",
            "session_type": cls.session_type,
            "section_count": cls.section_count,
            "subjects_count": len(class_subjects),
            "subjects_without_teachers": subjects_without_teachers,
            "has_issues": len(class_subjects) == 0 or len(subjects_without_teachers) > 0
        })
    
    # Calculate readiness
    is_ready = len(missing_subjects) == 0 and len(missing_teachers) == 0
    
    return {
        "is_ready_for_generation": is_ready,
        "summary": {
            "total_classes": len(classes),
            "total_subjects": total_subjects_needed,
            "total_teachers": len(teachers),
            "total_teacher_assignments": len(teacher_assignments),
            "classes_with_no_subjects": len(missing_subjects),
            "subjects_without_teachers": len(missing_teachers)
        },
        "classes_analysis": classes_analysis,
        "issues": {
            "missing_subjects": missing_subjects,
            "missing_teacher_assignments": missing_teachers
        },
        "recommendations": [
            "تأكد من إضافة المواد لكل صف في نظام إدارة المواد" if missing_subjects else None,
            "تأكد من تكليف المعلمين بتدريس المواد في نظام إدارة المعلمين" if missing_teachers else None,
            "يمكنك الآن إنشاء الجداول!" if is_ready else None
        ]
    }