"""
Validation Service for Schedule Prerequisites
Checks teacher availability sufficiency and other prerequisites before schedule generation
"""

from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..models.academic import Class, Subject, AcademicYear
from ..models.teachers import Teacher, TeacherAssignment
from ..services.teacher_availability_service import TeacherAvailabilityService


class ValidationService:
    """Service for validating schedule prerequisites"""
    
    def __init__(self, db: Session):
        self.db = db
        self.availability_service = TeacherAvailabilityService(db)
    
    def validate_schedule_prerequisites(
        self,
        academic_year_id: int,
        class_id: int,
        section: Optional[str] = None,
        session_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Comprehensive validation of all prerequisites for schedule generation
        
        Args:
            academic_year_id: Academic year ID
            class_id: Class ID
            section: Section/division
            session_type: morning or evening
            
        Returns:
            Validation results with detailed report
        """
        errors = []
        warnings = []
        missing_items = []
        suggestions = []
        
        # Check if academic year exists and is active
        academic_year = self.db.query(AcademicYear).filter(
            AcademicYear.id == academic_year_id
        ).first()
        
        if not academic_year:
            errors.append("السنة الدراسية غير موجودة")
            return {
                "is_valid": False,
                "can_proceed": False,
                "errors": errors,
                "warnings": warnings,
                "missing_items": missing_items,
                "suggestions": suggestions
            }
        
        if not academic_year.is_active:
            warnings.append("السنة الدراسية غير نشطة")
        
        # Check if class exists
        class_obj = self.db.query(Class).filter(Class.id == class_id).first()
        if not class_obj:
            errors.append("الصف غير موجود")
            return {
                "is_valid": False,
                "can_proceed": False,
                "errors": errors,
                "warnings": warnings,
                "missing_items": missing_items,
                "suggestions": suggestions
            }
        
        # Get class subjects
        subjects = self.db.query(Subject).filter(
            Subject.class_id == class_id,
            Subject.is_active == True
        ).all()
        
        if not subjects:
            errors.append("لا توجد مواد معرفة لهذا الصف")
            missing_items.append("مواد دراسية")
            suggestions.append("قم بإضافة المواد الدراسية للصف")
            return {
                "is_valid": False,
                "can_proceed": False,
                "errors": errors,
                "warnings": warnings,
                "missing_items": missing_items,
                "suggestions": suggestions
            }
        
        # Check teacher assignments for each subject
        unassigned_subjects = []
        insufficient_availability = []
        subject_details = []
        
        # First pass: collect all subjects and their teacher assignments
        # Group subjects by teacher to calculate total required periods per teacher
        teacher_subjects_map = {}  # teacher_id -> list of (subject, required_periods)
        teacher_info_map = {}  # teacher_id -> teacher object
        subject_assignment_map = {}  # subject_id -> (teacher, assignment)
        
        for subject in subjects:
            # Get teacher assignment for this subject
            assignment = None
            
            if section:
                # Look for section-specific assignment first
                assignment = self.db.query(TeacherAssignment).filter(
                    TeacherAssignment.class_id == class_id,
                    TeacherAssignment.subject_id == subject.id,
                    TeacherAssignment.section == section
                ).first()
            
            # If no section-specific assignment found (or no section provided), 
            # look for a general assignment (section is NULL or empty)
            if not assignment:
                assignment = self.db.query(TeacherAssignment).filter(
                    TeacherAssignment.class_id == class_id,
                    TeacherAssignment.subject_id == subject.id,
                    (TeacherAssignment.section == None) | (TeacherAssignment.section == '')
                ).first()
            
            if not assignment:
                unassigned_subjects.append(subject.subject_name)
                subject_details.append({
                    "subject_id": subject.id,
                    "subject_name": subject.subject_name,
                    "required_periods": subject.weekly_hours,
                    "has_teacher": False,
                    "teacher_availability": "not_assigned",
                    "status": "error"
                })
                continue
            
            # Check teacher exists
            teacher = self.db.query(Teacher).filter(
                Teacher.id == assignment.teacher_id
            ).first()
            
            if not teacher:
                unassigned_subjects.append(subject.subject_name)
                subject_details.append({
                    "subject_id": subject.id,
                    "subject_name": subject.subject_name,
                    "required_periods": subject.weekly_hours,
                    "has_teacher": False,
                    "teacher_availability": "teacher_not_found",
                    "status": "error"
                })
                continue
            
            # Store mapping for second pass
            subject_assignment_map[subject.id] = (teacher, assignment)
            teacher_info_map[teacher.id] = teacher
            
            # Group by teacher
            if teacher.id not in teacher_subjects_map:
                teacher_subjects_map[teacher.id] = []
            teacher_subjects_map[teacher.id].append({
                "subject": subject,
                "required_periods": subject.weekly_hours
            })
        
        # Second pass: Check availability considering ALL subjects per teacher
        teacher_availability_cache = {}  # teacher_id -> {total_required, available_slots, is_sufficient}
        
        for teacher_id, subjects_list in teacher_subjects_map.items():
            # Calculate TOTAL required periods for this teacher across ALL their subjects
            total_required = sum(item["required_periods"] for item in subjects_list)
            
            # Get teacher's available slots
            availability_check = self.availability_service.check_teacher_sufficient_availability(
                teacher_id=teacher_id,
                required_periods=total_required
            )
            
            teacher_availability_cache[teacher_id] = {
                "total_required": total_required,
                "available_slots": availability_check["available_slots"],
                "is_sufficient": availability_check["is_sufficient"],
                "subjects_count": len(subjects_list)
            }
            
            # If insufficient, add to warnings
            if not availability_check["is_sufficient"]:
                teacher = teacher_info_map[teacher_id]
                subject_names = [item["subject"].subject_name for item in subjects_list]
                insufficient_availability.append({
                    "teacher": teacher.full_name,
                    "subjects": subject_names,
                    "total_required": total_required,
                    "available": availability_check["available_slots"]
                })
        
        # Third pass: Build subject details with corrected availability info
        for subject in subjects:
            if subject.id not in subject_assignment_map:
                continue  # Already handled as unassigned
            
            teacher, assignment = subject_assignment_map[subject.id]
            teacher_avail = teacher_availability_cache.get(teacher.id, {})
            
            # Check if teacher has free slots for specific time periods
            teacher_free_slots = self.availability_service.get_teacher_availability(teacher.id)
            missing_timeslots = []
            
            # Check each day and period to find if teacher is available
            # This is a simplified check - in reality we'd need to know the exact schedule requirements
            # For now, just check if teacher has ANY free slots (using corrected AND logic)
            if teacher_free_slots["total_free"] == 0:
                missing_timeslots.append("جميع الأوقات محجوزة")
            
            subject_detail = {
                "subject_id": subject.id,
                "subject_name": subject.subject_name,
                "required_periods": subject.weekly_hours,
                "has_teacher": True,
                "teacher_id": teacher.id,
                "teacher_name": teacher.full_name,
                "available_slots": teacher_avail.get("available_slots", 0),
                "teacher_total_required": teacher_avail.get("total_required", subject.weekly_hours),
                "teacher_subjects_count": teacher_avail.get("subjects_count", 1),
                "is_sufficient": teacher_avail.get("is_sufficient", False),
                "teacher_availability": "sufficient" if teacher_avail.get("is_sufficient", False) else "insufficient",
                "teacher_has_free_slots_per_timeslot": teacher_free_slots["total_free"] > 0,
                "missing_timeslots": missing_timeslots if missing_timeslots else None
            }
            
            if not teacher_avail.get("is_sufficient", False):
                subject_detail["status"] = "warning"
            else:
                subject_detail["status"] = "ok"
            
            subject_details.append(subject_detail)
        
        # Build error and warning messages
        if unassigned_subjects:
            errors.append(f"المواد التالية ليس لها معلم معين: {', '.join(unassigned_subjects)}")
            missing_items.extend(unassigned_subjects)
            suggestions.append("قم بتعيين معلمين لجميع المواد في صفحة إدارة المعلمين")
        
        # Check for teachers without any free time slots configured
        teachers_without_freetime = []
        for teacher_id in teacher_info_map.keys():
            teacher = teacher_info_map[teacher_id]
            teacher_free_slots = self.availability_service.get_teacher_availability(teacher_id)
            if teacher_free_slots["total_free"] == 0:
                teachers_without_freetime.append(teacher.full_name)
        
        if teachers_without_freetime:
            errors.append(
                f"⚠️ المعلمون التالية لم يتم تحديد أوقات الفراغ لهم: {', '.join(teachers_without_freetime)}. "
                f"يجب تحديد أوقات الفراغ لجميع المعلمين قبل إنشاء الجدول."
            )
            suggestions.append("قم بتحديد أوقات الفراغ للمعلمين في صفحة إدارة المعلمين → تبويب 'أوقات الفراغ'")
        
        if insufficient_availability:
            for item in insufficient_availability:
                subjects_str = "، ".join(item['subjects'])
                if len(item['subjects']) > 1:
                    warnings.append(
                        f"المعلم {item['teacher']} لديه {item['available']} فترة متاحة فقط "
                        f"لكنه يدرس {len(item['subjects'])} مواد ({subjects_str}) تحتاج إجمالي {item['total_required']} حصة"
                    )
                else:
                    warnings.append(
                        f"المعلم {item['teacher']} لديه {item['available']} فترة متاحة فقط "
                        f"لكن مادة {subjects_str} تحتاج {item['total_required']} حصة"
                    )
            suggestions.append("قم بتحديث أوقات الفراغ للمعلمين في صفحة إدارة المعلمين")
        
        # Calculate totals
        total_subjects = len(subjects)
        total_assigned = len([s for s in subject_details if s.get("has_teacher")])
        total_sufficient = len([s for s in subject_details if s.get("is_sufficient", False)])
        total_periods_needed = sum(s.weekly_hours for s in subjects)
        
        # Calculate required periods (6 periods × 5 days = 30)
        required_periods = 30  # Standard full week schedule
        
        # Check if total subject hours match required periods
        if total_periods_needed < required_periods:
            errors.append(
                f"إجمالي ساعات المواد ({total_periods_needed}) أقل من المطلوب ({required_periods}). "
                f"يجب إضافة مواد أو زيادة ساعات المواد الحالية."
            )
            suggestions.append(f"أضف مواد جديدة أو زد ساعات المواد الحالية لتصل إلى {required_periods} حصة أسبوعياً")
        elif total_periods_needed > required_periods:
            warnings.append(
                f"إجمالي ساعات المواد ({total_periods_needed}) أكبر من المتاح ({required_periods}). "
                f"سيتم تجاهل الساعات الزائدة."
            )
        
        # NEW: Check if at least one teacher is free for each required time slot
        periods_without_teachers = []
        working_days = 5  # Sunday to Thursday
        periods_per_day = 6
        
        for day in range(working_days):
            for period in range(periods_per_day):
                # Check if ANY teacher assigned to ANY subject for this class is free at this time
                has_free_teacher = False
                
                for teacher_id in teacher_info_map.keys():
                    teacher_avail = self.availability_service.get_teacher_availability(teacher_id)
                    slot_index = day * periods_per_day + period
                    
                    if slot_index < len(teacher_avail["slots"]):
                        slot = teacher_avail["slots"][slot_index]
                        # A slot is free only if: status='free' AND is_free=True AND no assignment
                        is_slot_free = (
                            slot.get("status") == "free" 
                            and slot.get("is_free", slot.get("status") == "free")
                            and not slot.get("assignment")
                        )
                        if is_slot_free:
                            has_free_teacher = True
                            break
                
                if not has_free_teacher and len(teacher_info_map) > 0:
                    day_names = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"]
                    periods_without_teachers.append(f"{day_names[day]} - الحصة {period + 1}")
        
        if periods_without_teachers:
            # This is a critical error
            if len(periods_without_teachers) <= 5:
                errors.append(
                    f"⚠️ الفترات التالية لا يوجد بها معلم متاح: {', '.join(periods_without_teachers[:5])}"
                )
            else:
                errors.append(
                    f"⚠️ يوجد {len(periods_without_teachers)} فترة زمنية لا يوجد بها أي معلم متاح. "
                    f"أمثلة: {', '.join(periods_without_teachers[:3])}"
                )
            suggestions.append("قم بتحديث أوقات الفراغ للمعلمين لتغطية جميع الفترات المطلوبة")
        
        # NEW: Advanced validation checks for slot timing and coverage optimization
        slot_timing_warnings = []
        coverage_warnings = []
        
        # Check for timing conflicts: slots where multiple teachers are free vs. single-teacher slots
        import json
        slot_distribution = {}  # (day, period) -> list of teacher_ids
        
        for teacher_id in teacher_info_map.keys():
            teacher = teacher_info_map[teacher_id]
            if not teacher.free_time_slots:
                continue
            
            try:
                slots = json.loads(teacher.free_time_slots)
                for slot in slots:
                    if slot.get('status') == 'free' and slot.get('is_free') == True:
                        day = slot.get('day')
                        period = slot.get('period')
                        key = (day, period)
                        if key not in slot_distribution:
                            slot_distribution[key] = []
                        slot_distribution[key].append(teacher_id)
            except:
                pass
        
        # Analyze distribution
        single_teacher_slots = sum(1 for teachers in slot_distribution.values() if len(teachers) == 1)
        multiple_teacher_slots = sum(1 for teachers in slot_distribution.values() if len(teachers) > 1)
        
        # CRITICAL CHECK: Detect guaranteed empty slots
        # When a teacher is the ONLY one available in certain periods but has more free slots than subjects need,
        # those excess "exclusive" slots will definitely be empty
        guaranteed_empty_slots = []
        has_guaranteed_empties = False
        day_names_ar = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"]
        
        for teacher_id, teacher_cache in teacher_availability_cache.items():
            teacher = teacher_info_map[teacher_id]
            total_required = teacher_cache["total_required"]
            available_slots = teacher_cache["available_slots"]
            
            # If teacher has excess free slots
            if available_slots > total_required:
                # Count how many of their free slots are "exclusive" (only this teacher is free)
                exclusive_slots = []
                for (day, period), teacher_list in slot_distribution.items():
                    if len(teacher_list) == 1 and teacher_list[0] == teacher_id:
                        exclusive_slots.append((day, period))
                
                # If exclusive slots > required periods, we'll have guaranteed empties
                excess_exclusive = len(exclusive_slots) - total_required
                if excess_exclusive > 0:
                    has_guaranteed_empties = True
                    # List the specific periods that will be empty
                    for i, (day, period) in enumerate(exclusive_slots[total_required:]):
                        if i < 3:  # Show first 3 examples
                            guaranteed_empty_slots.append(f"{day_names_ar[day]} - الحصة {period + 1}")
                    
                    errors.append(
                        f"⚠️ خطر: المعلم {teacher.full_name} لديه {excess_exclusive} فترة حصرية زائدة "
                        f"(فترات لا يتوفر فيها معلم آخر). هذا سيؤدي حتماً إلى {excess_exclusive} فترة فارغة في الجدول!"
                    )
                    if guaranteed_empty_slots:
                        errors.append(f"   الفترات الفارغة المتوقعة: {', '.join(guaranteed_empty_slots[:3])}")
                    suggestions.append(
                        f"الحل: إما تقليل أوقات فراغ {teacher.full_name} أو جعل معلمين آخرين متاحين في نفس الفترات"
                    )
        
        # Day-level contention analysis - ONLY flag if there's a REAL capacity issue
        # This check is now more conservative to avoid false positives
        teacher_day_availability = {}  # teacher_id -> set of available days
        for teacher_id in teacher_info_map.keys():
            teacher_day_availability[teacher_id] = set()
            for (day, period), teacher_list in slot_distribution.items():
                if teacher_id in teacher_list:
                    teacher_day_availability[teacher_id].add(day)
        
        # Calculate GLOBAL capacity check - sum of all teachers' requirements vs total available slots
        total_all_teachers_required = sum(tc["total_required"] for tc in teacher_availability_cache.values())
        total_available_slots = len(slot_distribution)  # Total unique (day, period) combinations with at least one teacher
        
        # Only flag day-level conflicts if total demand exceeds total capacity
        # This is a GLOBAL check, not pairwise
        if total_all_teachers_required > total_available_slots:
            has_guaranteed_empties = True
            errors.append(
                f"⚠️ تضارب حرج: إجمالي الحصص المطلوبة ({total_all_teachers_required}) "
                f"يتجاوز إجمالي الفترات المتاحة ({total_available_slots}). "
                f"يجب إضافة المزيد من أوقات الفراغ للمعلمين."
            )
        
        # Remove excessive warnings - only show critical issues
        # Don't warn about shared slots or excess free time - these are normal and expected
        
        # Add coverage warnings to main warnings list
        warnings.extend(coverage_warnings)
        
        # CRITICAL: Simulate placement to detect blocking scenarios
        # Check if teachers share slots in a way that makes scheduling impossible
        placement_blocking_detected = False
        reported_pairs = set()  # Track reported pairs to avoid duplicates
        day_names_ar = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"]
        
        for teacher_id, teacher_cache in teacher_availability_cache.items():
            teacher = teacher_info_map[teacher_id]
            total_required = teacher_cache["total_required"]
            available_slots = teacher_cache["available_slots"]
            
            # Get this teacher's unique slots (slots only they can use)
            my_unique_slots = []
            my_shared_slots = []
            for (day, period), teacher_list in slot_distribution.items():
                if teacher_id in teacher_list:
                    if len(teacher_list) == 1:
                        my_unique_slots.append((day, period))
                    else:
                        my_shared_slots.append((day, period))
            
            # Calculate how many shared slots this teacher MUST use
            # (required - unique slots available)
            must_use_shared = max(0, total_required - len(my_unique_slots))
            
            if must_use_shared == 0:
                continue  # This teacher can fulfill requirements with unique slots only
            
            # Check conflicts with other teachers who also MUST use shared slots
            for other_id, other_cache in teacher_availability_cache.items():
                if other_id == teacher_id:
                    continue
                
                # Skip if already reported this pair
                pair_key = tuple(sorted([teacher_id, other_id]))
                if pair_key in reported_pairs:
                    continue
                
                other_teacher = teacher_info_map[other_id]
                other_required = other_cache["total_required"]
                
                # Get other teacher's unique and shared slots
                other_unique_slots = []
                other_shared_slots = []
                for (day, period), teacher_list in slot_distribution.items():
                    if other_id in teacher_list:
                        if len(teacher_list) == 1:
                            other_unique_slots.append((day, period))
                        else:
                            other_shared_slots.append((day, period))
                
                other_must_use_shared = max(0, other_required - len(other_unique_slots))
                
                if other_must_use_shared == 0:
                    continue  # Other teacher can fulfill with unique slots only
                
                # Find slots shared between these two teachers
                shared_between_them = []
                for (day, period), teacher_list in slot_distribution.items():
                    if teacher_id in teacher_list and other_id in teacher_list:
                        shared_between_them.append((day, period))
                
                if len(shared_between_them) == 0:
                    continue  # No shared slots between them
                
                # CRITICAL CHECK: If both teachers MUST use shared slots,
                # and they share slots, check if there's enough room
                # Each shared slot can only be used by ONE teacher
                
                # Calculate total shared slots each teacher has (with anyone)
                total_shared_capacity = len(shared_between_them)
                
                # If both need to use more shared slots than available between them,
                # AND they don't have enough non-overlapping shared slots, it will fail
                
                # Check if both MUST use shared slots and if there's actually a conflict
                if must_use_shared > 0 and other_must_use_shared > 0:
                    # CRITICAL FIX: The correct check is whether the shared slots between them
                    # can accommodate BOTH teachers' requirements from those shared slots.
                    # 
                    # If shared_between_them >= must_use_shared + other_must_use_shared,
                    # there's NO conflict - both can use different slots from the shared pool.
                    #
                    # A conflict only exists when:
                    # 1. Both teachers MUST use shared slots (no unique slots available)
                    # 2. The shared slots between them CANNOT accommodate both requirements
                    # 3. Neither has enough alternative shared slots with OTHER teachers
                    
                    # First check: Can the shared slots accommodate both requirements?
                    combined_requirement = must_use_shared + other_must_use_shared
                    shared_capacity = len(shared_between_them)
                    
                    # If shared capacity >= combined requirement, NO conflict exists
                    if shared_capacity >= combined_requirement:
                        # No conflict - there's enough room for both teachers
                        continue
                    
                    # If we get here, shared capacity is insufficient for both
                    # Check if either teacher has alternative shared slots with OTHER teachers
                    my_other_shared = [s for s in my_shared_slots if s not in shared_between_them]
                    other_other_shared = [s for s in other_shared_slots if s not in shared_between_them]
                    
                    # Calculate how much each teacher can offload to other shared slots
                    my_can_offload = len(my_other_shared)
                    other_can_offload = len(other_other_shared)
                    
                    # Calculate the shortage: how many slots are we short?
                    shortage = combined_requirement - shared_capacity
                    
                    # If the combined offload capacity covers the shortage, no conflict
                    if my_can_offload + other_can_offload >= shortage:
                        continue
                    
                    # Real conflict detected - not enough capacity
                    placement_blocking_detected = True
                    has_guaranteed_empties = True
                    reported_pairs.add(pair_key)
                    
                    shared_examples = [f"{day_names_ar[d]} الحصة {p+1}" for d, p in shared_between_them[:5]]
                    
                    errors.append(
                        f"⚠️ تعارض في أوقات الفراغ: المعلمان {teacher.full_name} و {other_teacher.full_name} "
                        f"يتشاركان {len(shared_between_them)} فترة ({', '.join(shared_examples)}). "
                        f"كلاهما يحتاج لاستخدام هذه الفترات المشتركة ولا يملك بديلاً كافياً."
                    )
                    
                    # Calculate how many extra slots needed
                    min_extra_needed = shortage - (my_can_offload + other_can_offload)
                    
                    suggestions.append(
                        f"الحل: يجب أن يضيف {teacher.full_name} أو {other_teacher.full_name} "
                        f"على الأقل {min_extra_needed} فترة فراغ إضافية في أوقات مختلفة "
                        f"(أيام أو حصص لا يتواجد فيها المعلم الآخر)"
                    )
        
        # Determine if we can proceed
        can_proceed = (
            len(unassigned_subjects) == 0 and 
            total_periods_needed >= required_periods and
            len(periods_without_teachers) == 0 and  # Must have teachers for all periods
            len(teachers_without_freetime) == 0 and  # All teachers must have free time configured
            not has_guaranteed_empties and  # CRITICAL: Block if guaranteed empty slots detected
            not placement_blocking_detected  # CRITICAL: Block if teachers will block each other
        )
        is_valid = can_proceed and len(insufficient_availability) == 0
        
        return {
            "is_valid": is_valid,
            "can_proceed": can_proceed,
            "has_warnings": len(warnings) > 0,
            "errors": errors,
            "warnings": warnings,
            "missing_items": missing_items,
            "suggestions": suggestions,
            "summary": {
                "total_subjects": total_subjects,
                "subjects_with_teachers": total_assigned,
                "teachers_with_sufficient_time": total_sufficient,
                "total_periods_needed": total_periods_needed,
                "unassigned_count": len(unassigned_subjects),
                "insufficient_availability_count": len(insufficient_availability)
            },
            "subject_details": subject_details,
            "academic_year": {
                "id": academic_year.id,
                "name": academic_year.year_name,
                "is_active": academic_year.is_active
            },
            "class_info": {
                "id": class_obj.id,
                "grade_number": class_obj.grade_number,
                "grade_level": class_obj.grade_level,
                "session_type": class_obj.session_type
            }
        }
    
    def check_subject_teacher_assignment(
        self,
        class_id: int,
        subject_id: int,
        section: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Check if a subject has a teacher assigned
        
        Args:
            class_id: Class ID
            subject_id: Subject ID
            section: Section/division
            
        Returns:
            Assignment check result
        """
        # First, try to find a section-specific assignment if section is provided
        assignment = None
        
        if section:
            # Look for section-specific assignment first
            assignment = self.db.query(TeacherAssignment).filter(
                TeacherAssignment.class_id == class_id,
                TeacherAssignment.subject_id == subject_id,
                TeacherAssignment.section == section
            ).first()
        
        # If no section-specific assignment found (or no section provided), 
        # look for a general assignment (section is NULL or empty)
        if not assignment:
            assignment = self.db.query(TeacherAssignment).filter(
                TeacherAssignment.class_id == class_id,
                TeacherAssignment.subject_id == subject_id,
                (TeacherAssignment.section == None) | (TeacherAssignment.section == '')
            ).first()
        
        if not assignment:
            return {
                "has_teacher": False,
                "message": "لا يوجد معلم معين لهذه المادة"
            }
        
        teacher = self.db.query(Teacher).filter(
            Teacher.id == assignment.teacher_id
        ).first()
        
        if not teacher:
            return {
                "has_teacher": False,
                "message": "المعلم المعين غير موجود في النظام"
            }
        
        return {
            "has_teacher": True,
            "teacher_id": teacher.id,
            "teacher_name": teacher.full_name,
            "assignment_id": assignment.id
        }
    
    def get_class_schedule_requirements(
        self,
        class_id: int
    ) -> Dict[str, Any]:
        """
        Get schedule requirements for a class
        
        Args:
            class_id: Class ID
            
        Returns:
            Requirements summary
        """
        class_obj = self.db.query(Class).filter(Class.id == class_id).first()
        if not class_obj:
            return {
                "success": False,
                "error": "الصف غير موجود"
            }
        
        subjects = self.db.query(Subject).filter(
            Subject.class_id == class_id,
            Subject.is_active == True
        ).all()
        
        total_periods = sum(s.weekly_hours for s in subjects)
        
        # Assuming 5 days x 6 periods = 30 slots per week
        max_periods = 30
        utilization_percentage = (total_periods / max_periods) * 100 if max_periods > 0 else 0
        
        return {
            "success": True,
            "class_id": class_id,
            "grade_number": class_obj.grade_number,
            "grade_level": class_obj.grade_level,
            "total_subjects": len(subjects),
            "total_periods_per_week": total_periods,
            "max_available_periods": max_periods,
            "utilization_percentage": round(utilization_percentage, 1),
            "subjects": [
                {
                    "id": s.id,
                    "name": s.subject_name,
                    "weekly_hours": s.weekly_hours
                }
                for s in subjects
            ]
        }
    
    def validate_multiple_classes(
        self,
        academic_year_id: int,
        class_ids: List[int],
        session_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Validate prerequisites for multiple classes at once
        
        Args:
            academic_year_id: Academic year ID
            class_ids: List of class IDs
            session_type: morning or evening
            
        Returns:
            Validation results for all classes
        """
        results = []
        overall_valid = True
        overall_can_proceed = True
        total_errors = 0
        total_warnings = 0
        
        for class_id in class_ids:
            validation = self.validate_schedule_prerequisites(
                academic_year_id=academic_year_id,
                class_id=class_id,
                session_type=session_type
            )
            
            results.append({
                "class_id": class_id,
                "class_info": validation.get("class_info"),
                "is_valid": validation["is_valid"],
                "can_proceed": validation["can_proceed"],
                "errors_count": len(validation["errors"]),
                "warnings_count": len(validation["warnings"]),
                "summary": validation["summary"]
            })
            
            if not validation["is_valid"]:
                overall_valid = False
            
            if not validation["can_proceed"]:
                overall_can_proceed = False
            
            total_errors += len(validation["errors"])
            total_warnings += len(validation["warnings"])
        
        return {
            "overall_valid": overall_valid,
            "overall_can_proceed": overall_can_proceed,
            "total_classes": len(class_ids),
            "valid_classes": sum(1 for r in results if r["is_valid"]),
            "classes_can_proceed": sum(1 for r in results if r["can_proceed"]),
            "total_errors": total_errors,
            "total_warnings": total_warnings,
            "class_results": results
        }
    
    def check_schedule_conflicts(
        self,
        academic_year_id: int,
        session_type: str,
        proposed_assignments: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Check for potential conflicts in proposed schedule assignments
        
        Args:
            academic_year_id: Academic year ID
            session_type: morning or evening
            proposed_assignments: List of proposed assignments
            
        Returns:
            Conflict check results
        """
        conflicts = []
        
        # Check for teacher double-booking
        teacher_slots = {}
        for assignment in proposed_assignments:
            teacher_id = assignment.get("teacher_id")
            day = assignment.get("day_of_week")
            period = assignment.get("period_number")
            
            if teacher_id and day and period:
                key = (teacher_id, day, period)
                if key in teacher_slots:
                    conflicts.append({
                        "type": "teacher_conflict",
                        "severity": "critical",
                        "description": f"المعلم معين لصفين في نفس الوقت",
                        "teacher_id": teacher_id,
                        "day": day,
                        "period": period,
                        "conflicting_classes": [
                            teacher_slots[key].get("class_id"),
                            assignment.get("class_id")
                        ]
                    })
                else:
                    teacher_slots[key] = assignment
        
        return {
            "has_conflicts": len(conflicts) > 0,
            "conflict_count": len(conflicts),
            "conflicts": conflicts
        }

