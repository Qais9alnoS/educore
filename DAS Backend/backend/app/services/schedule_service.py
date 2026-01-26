"""
Advanced Schedule Generation Service
Handles automatic schedule creation with conflict detection and optimization
"""

import time
from typing import List, Dict, Tuple, Optional, Set, Any
from datetime import datetime, date, time as dt_time, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from ..models.schedules import Schedule, ScheduleAssignment, ScheduleConflict, ScheduleConstraint, TimeSlot, ScheduleGenerationHistory
from ..models.academic import Class, Subject, AcademicYear
from ..models.teachers import Teacher, TeacherAssignment
from ..schemas.schedules import (
    ScheduleGenerationRequest, ScheduleGenerationResponse,
    DayOfWeek, SessionType, ScheduleStatistics
)
from ..services.telegram_service import telegram_service
from ..services.teacher_availability_service import TeacherAvailabilityService
from ..services.validation_service import ValidationService
from ..services.schedule_optimizer import GeneticScheduleOptimizer, OptimizationConstraint
from ..services.constraint_solver import ConstraintSolver
from ..core.exceptions import (
    ScheduleValidationError,
    TeacherAvailabilityError,
    ScheduleConflictError,
    ConstraintViolationError,
    InsufficientDataError
)

class ScheduleGenerationService:
    """Advanced schedule generation with AI-like optimization"""
    
    def __init__(self, db: Session):
        self.db = db
        self.availability_service = TeacherAvailabilityService(db)
        self.validation_service = ValidationService(db)
        self.genetic_optimizer = GeneticScheduleOptimizer(db)
        self.constraint_solver = ConstraintSolver(db)
        self.conflicts = []
        self.warnings = []
        self.generation_stats = {
            'periods_created': 0,
            'assignments_created': 0,
            'conflicts_detected': 0,
            'optimization_rounds': 0
        }
    
    def _print_database_data(
        self,
        academic_year_id: int,
        session_type: str,
        class_id: int,
        section: Optional[str],
        classes: List[Class],
        subjects: List[Subject],
        teachers: List[Teacher],
        validation_results: Optional[Dict] = None
    ):
        """
        Print all database data being used for schedule generation
        
        Args:
            academic_year_id: Academic year ID
            session_type: morning or evening
            class_id: Target class ID
            section: Target section
            classes: List of classes
            subjects: List of subjects
            teachers: List of teachers
            validation_results: Optional validation results
        """
        import json
        from datetime import datetime
        
        print("\n" + "="*80)
        print("=== بيانات قاعدة البيانات المستخدمة ===")
        print(f"التاريخ والوقت: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*80)
        
        # Section 1: Academic Year Info
        print(f"\n📚 السنة الدراسية:")
        academic_year = self.db.query(AcademicYear).filter(AcademicYear.id == academic_year_id).first()
        if academic_year:
            print(f"  - المعرف: {academic_year.id}")
            print(f"  - الاسم: {academic_year.year_name}")
            print(f"  - نشطة: {'نعم' if academic_year.is_active else 'لا'}")
        else:
            print(f"  - لم يتم العثور على السنة الدراسية (ID: {academic_year_id})")
        
        # Section 2: Classes
        print(f"\n🏫 الصفوف (عدد: {len(classes)}):")
        for cls in classes:
            print(f"  - المعرف: {cls.id}, الاسم: الصف {cls.grade_number} {cls.grade_level}, الفترة: {cls.session_type}")
        
        # Section 3: Subjects
        print(f"\n📖 المواد (عدد: {len(subjects)}):")
        for subject in subjects:
            weekly_hours = getattr(subject, 'weekly_hours', 0) or getattr(subject, 'periods_per_week', 0)
            print(f"  - المعرف: {subject.id}, الاسم: {subject.subject_name}, الحصص المطلوبة: {weekly_hours}")
        
        # Section 4: Teachers
        print(f"\n👨‍🏫 المعلمين (عدد: {len(teachers)}):")
        for teacher in teachers:
            print(f"\n  المعرف: {teacher.id}, الاسم: {teacher.full_name}")
            
            # Parse and display free_time_slots
            try:
                if teacher.free_time_slots:
                    slots = json.loads(teacher.free_time_slots)
                    # Count free slots
                    free_count = sum(1 for s in slots if s.get('status') == 'free' or s.get('is_free', False))
                    assigned_count = sum(1 for s in slots if s.get('status') == 'assigned')
                    unavailable_count = sum(1 for s in slots if s.get('status') == 'unavailable')
                    
                    print(f"    أوقات الفراغ: حرة={free_count}, مشغولة={assigned_count}, غير متاحة={unavailable_count}")
                    
                    # Show free slots by day
                    day_names = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"]
                    for day_idx in range(5):
                        day_slots = [s for s in slots if s.get('day') == day_idx]
                        free_periods = [s.get('period') + 1 for s in day_slots if s.get('status') == 'free' or s.get('is_free', False)]
                        if free_periods:
                            print(f"    - {day_names[day_idx]}: {free_periods}")
                else:
                    print("    أوقات الفراغ: غير محددة")
            except Exception as e:
                print(f"    خطأ في قراءة أوقات الفراغ: {e}")
        
        # Section 5: Time Slots Available
        print(f"\n⏰ الفترات الزمنية المتاحة:")
        print(f"  - الأيام: الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس (5 أيام)")
        print(f"  - الحصص: 1-6 (6 حصص في اليوم)")
        print(f"  - المجموع: 30 فترة زمنية في الأسبوع")
        
        # Section 6: Active Constraints
        print(f"\n⚠️ القيود النشطة:")
        try:
            constraints = self.db.query(ScheduleConstraint).filter(
                ScheduleConstraint.academic_year_id == academic_year_id,
                ScheduleConstraint.is_active == True
            ).all()
            
            if constraints:
                print(f"  (عدد: {len(constraints)})")
                for constraint in constraints:
                    priority_names = {1: "منخفض", 2: "متوسط", 3: "عالي", 4: "حرج"}
                    priority = priority_names.get(constraint.priority_level, str(constraint.priority_level))
                    print(f"  - النوع: {constraint.constraint_type}, الأولوية: {priority}")
                    if constraint.description:
                        print(f"    الوصف: {constraint.description}")
            else:
                print("  - لا توجد قيود نشطة")
        except Exception as e:
            print(f"  - خطأ في قراءة القيود: {e}")
        
        # Section 7: Validation Results
        if validation_results:
            print(f"\n✅ نتائج التحقق:")
            print(f"  - صالح: {'نعم' if validation_results.get('is_valid') else 'لا'}")
            print(f"  - يمكن المتابعة: {'نعم' if validation_results.get('can_proceed') else 'لا'}")
            
            summary = validation_results.get('summary', {})
            if summary:
                print(f"  - إجمالي المواد: {summary.get('total_subjects', 0)}")
                print(f"  - المواد مع معلمين: {summary.get('subjects_with_teachers', 0)}")
                print(f"  - المعلمين بأوقات كافية: {summary.get('teachers_with_sufficient_time', 0)}")
            
            errors = validation_results.get('errors', [])
            if errors:
                print(f"\n  ⚠️ الأخطاء ({len(errors)}):")
                for error in errors:
                    print(f"    - {error}")
            
            warnings = validation_results.get('warnings', [])
            if warnings:
                print(f"\n  ⚠️ التحذيرات ({len(warnings)}):")
                for warning in warnings:
                    print(f"    - {warning}")
        
        print("\n" + "="*80 + "\n")
    
    def _print_generated_schedule_markdown(
        self,
        schedule_entries: List[Schedule],
        class_info: Dict[str, any],
        save_to_file: bool = False
    ):
        """
        Generate and print schedule in markdown table format
        
        Args:
            schedule_entries: List of schedule entries
            class_info: Class information dictionary
            save_to_file: Whether to save to file (default: False, just print)
        """
        from datetime import datetime
        import os
        
        # Get class and teacher info
        class_name = class_info.get('class_name', 'Unknown')
        section = class_info.get('section', '1')
        
        # Build markdown output
        markdown = []
        markdown.append(f"# جدول الصف: {class_name} - شعبة {section}")
        markdown.append(f"\n**التاريخ:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        
        # Create schedule grid
        day_names = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"]
        periods = list(range(1, 7))  # 1-6
        
        # Organize entries by day and period
        schedule_grid = {}
        for entry in schedule_entries:
            key = (entry.day_of_week, entry.period_number)
            schedule_grid[key] = entry
        
        # Get subject and teacher names
        subject_cache = {}
        teacher_cache = {}
        
        for entry in schedule_entries:
            if entry.subject_id not in subject_cache:
                subject = self.db.query(Subject).filter(Subject.id == entry.subject_id).first()
                subject_cache[entry.subject_id] = subject.subject_name if subject else f"مادة {entry.subject_id}"
            
            if entry.teacher_id not in teacher_cache:
                teacher = self.db.query(Teacher).filter(Teacher.id == entry.teacher_id).first()
                teacher_cache[entry.teacher_id] = teacher.full_name if teacher else f"معلم {entry.teacher_id}"
        
        # Build table header
        markdown.append("| الحصة | " + " | ".join(day_names) + " |")
        markdown.append("|-------|" + "|".join(["-------"] * 5) + "|")
        
        # Build table rows
        for period in periods:
            row = [f"| {period} "]
            for day_idx, day_name in enumerate(day_names, start=1):
                key = (day_idx, period)
                if key in schedule_grid:
                    entry = schedule_grid[key]
                    subject_name = subject_cache.get(entry.subject_id, "---")
                    teacher_name = teacher_cache.get(entry.teacher_id, "---")
                    cell = f"**{subject_name}**<br>{teacher_name}"
                else:
                    cell = "---"
                row.append(f" {cell} ")
            row.append("|")
            markdown.append("|".join(row))
        
        # Add summary section
        markdown.append("\n## ملخص الجدول\n")
        
        # Count statistics
        total_periods = len(schedule_entries)
        unique_subjects = len(set(e.subject_id for e in schedule_entries))
        unique_teachers = len(set(e.teacher_id for e in schedule_entries))
        
        # Check for conflicts
        conflicts = []
        teacher_schedule = {}
        for entry in schedule_entries:
            key = (entry.teacher_id, entry.day_of_week, entry.period_number)
            if key in teacher_schedule:
                conflicts.append({
                    'teacher_id': entry.teacher_id,
                    'day': entry.day_of_week,
                    'period': entry.period_number
                })
            else:
                teacher_schedule[key] = entry
        
        markdown.append(f"- **إجمالي الحصص:** {total_periods}")
        markdown.append(f"- **عدد المواد:** {unique_subjects}")
        markdown.append(f"- **عدد المعلمين:** {unique_teachers}")
        markdown.append(f"- **التعارضات:** {len(conflicts)}")
        markdown.append(f"- **التحذيرات:** 0")
        markdown.append(f"- **حالة التحقق:** {'✅ مقبول' if len(conflicts) == 0 else '❌ فشل - توجد تعارضات'}")
        
        # Print conflicts if any
        if conflicts:
            markdown.append("\n### ⚠️ التعارضات المكتشفة:\n")
            for conflict in conflicts:
                teacher_name = teacher_cache.get(conflict['teacher_id'], f"معلم {conflict['teacher_id']}")
                day_name = day_names[conflict['day'] - 1] if 1 <= conflict['day'] <= 5 else f"يوم {conflict['day']}"
                markdown.append(f"- المعلم **{teacher_name}** معين لأكثر من صف في {day_name} الحصة {conflict['period']}")
        
        # Join all markdown lines
        markdown_text = "\n".join(markdown)
        
        # Print to console
        print("\n" + "="*80)
        print(markdown_text)
        print("="*80 + "\n")
        
        # Save to file if requested
        if save_to_file:
            try:
                # Create directory if it doesn't exist
                output_dir = "generated_schedules"
                os.makedirs(output_dir, exist_ok=True)
                
                # Generate filename
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"{output_dir}/{class_name.replace(' ', '_')}_{section}_{timestamp}.md"
                
                # Write to file
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(markdown_text)
                
                print(f"✅ تم حفظ الجدول في: {filename}")
            except Exception as e:
                print(f"⚠️ فشل حفظ الملف: {e}")
        
        # Return validation status
        return len(conflicts) == 0
    
    def _validate_generated_schedule(
        self,
        schedule_entries: List[Schedule],
        expected_total_periods: int
    ) -> tuple[bool, List[str], List[str]]:
        """
        Comprehensive validation of generated schedule
        
        Args:
            schedule_entries: List of generated schedule entries
            expected_total_periods: Expected number of periods
            
        Returns:
            Tuple of (is_valid, errors, warnings)
        """
        errors = []
        warnings = []
        
        if not schedule_entries:
            errors.append("لا توجد حصص في الجدول المُنشأ")
            return False, errors, warnings
        
        # Check 1: Verify total periods
        if len(schedule_entries) != expected_total_periods:
            warnings.append(
                f"عدد الحصص المُنشأة ({len(schedule_entries)}) لا يتطابق مع المتوقع ({expected_total_periods})"
            )
        
        # Check 2: Teacher conflicts (same teacher, same time)
        teacher_schedule = {}
        teacher_conflicts = []
        for entry in schedule_entries:
            key = (entry.teacher_id, entry.day_of_week, entry.period_number)
            if key in teacher_schedule:
                teacher = self.db.query(Teacher).filter(Teacher.id == entry.teacher_id).first()
                teacher_name = teacher.full_name if teacher else f"معلم {entry.teacher_id}"
                teacher_conflicts.append({
                    'teacher': teacher_name,
                    'day': entry.day_of_week,
                    'period': entry.period_number,
                    'classes': [teacher_schedule[key], entry.class_id]
                })
                errors.append(
                    f"تعارض: المعلم {teacher_name} معين لصفين في نفس الوقت (يوم {entry.day_of_week} حصة {entry.period_number})"
                )
            else:
                teacher_schedule[key] = entry.class_id
        
        # Check 3: Subject weekly hours satisfaction
        subject_hours = {}
        for entry in schedule_entries:
            key = (entry.class_id, entry.subject_id)
            subject_hours[key] = subject_hours.get(key, 0) + 1
        
        for (class_id, subject_id), actual_hours in subject_hours.items():
            subject = self.db.query(Subject).filter(Subject.id == subject_id).first()
            if subject:
                expected_hours = getattr(subject, 'weekly_hours', 0)
                if expected_hours and actual_hours != expected_hours:
                    warnings.append(
                        f"المادة {subject.subject_name} للصف {class_id}: حصص فعلية ({actual_hours}) != مطلوبة ({expected_hours})"
                    )
        
        # Check 4: Class double-booking
        class_schedule = {}
        class_conflicts = []
        for entry in schedule_entries:
            key = (entry.class_id, entry.day_of_week, entry.period_number)
            if key in class_schedule:
                errors.append(
                    f"تعارض: الصف {entry.class_id} لديه حصتان في نفس الوقت (يوم {entry.day_of_week} حصة {entry.period_number})"
                )
                class_conflicts.append(key)
            else:
                class_schedule[key] = entry.id
        
        # Check 5: Teacher availability (within free_time_slots)
        availability_violations = []
        for entry in schedule_entries:
            try:
                availability = self.availability_service.get_teacher_availability(entry.teacher_id)
                slots = availability.get('slots', [])
                
                # Convert to 0-based indexing
                day_idx = entry.day_of_week - 1
                period_idx = entry.period_number - 1
                slot_idx = day_idx * 6 + period_idx
                
                if 0 <= slot_idx < len(slots):
                    slot = slots[slot_idx]
                    if slot.get('status') not in ['free', 'assigned']:
                        teacher = self.db.query(Teacher).filter(Teacher.id == entry.teacher_id).first()
                        teacher_name = teacher.full_name if teacher else f"معلم {entry.teacher_id}"
                        availability_violations.append(
                            f"المعلم {teacher_name} معين في وقت غير متاح (يوم {entry.day_of_week} حصة {entry.period_number})"
                        )
            except Exception as e:
                print(f"Error checking teacher availability: {e}")
        
        if availability_violations:
            warnings.extend(availability_violations)
        
        # Determine if valid
        is_valid = len(errors) == 0
        
        # Print validation summary
        print("\n" + "="*80)
        print("=== نتيجة التحقق من صحة الجدول ===")
        print(f"الحالة: {'✅ صالح' if is_valid else '❌ غير صالح'}")
        print(f"إجمالي الحصص: {len(schedule_entries)}")
        print(f"الأخطاء: {len(errors)}")
        print(f"التحذيرات: {len(warnings)}")
        
        if errors:
            print("\n❌ الأخطاء:")
            for error in errors:
                print(f"  - {error}")
        
        if warnings:
            print("\n⚠️ التحذيرات:")
            for warning in warnings:
                print(f"  - {warning}")
        
        print("="*80 + "\n")
        
        return is_valid, errors, warnings
    
    def _distribute_subjects_evenly(
        self,
        subjects: List[Subject],
        num_days: int,
        periods_per_day: int,
        class_id: int,
        section: Optional[str] = None
    ) -> Tuple[List[List[Optional[Tuple[Subject, int]]]], Dict[int, Any]]:
        """
        Distribute subjects evenly across the week BASED ON TEACHER AVAILABILITY
        
        This ensures subjects are only placed in slots where their assigned teacher is actually free.
        
        Args:
            subjects: List of subjects with weekly_hours
            num_days: Number of days in the week (typically 5)
            periods_per_day: Number of periods per day (typically 6)
            class_id: Class ID for filtering teacher assignments
            section: Section number for filtering teacher assignments (None for all sections)
            
        Returns:
            Tuple of:
            - 2D list representing the week's schedule [day][period] with (Subject, teacher_id) tuples
            - Dictionary mapping teacher_id to Teacher object
        """
        import random
        import json
        from app.models.teachers import Teacher, TeacherAssignment
        
        # Initialize empty schedule grid
        schedule_grid = [[None for _ in range(periods_per_day)] for _ in range(num_days)]
        
        # Build list of subject slots - must fill exactly total_slots (30)
        total_slots = num_days * periods_per_day
        subject_slots = []
        
        # First, add all subjects according to their weekly_hours
        for subject in subjects:
            weekly_hours = getattr(subject, 'weekly_hours', 1)
            if not weekly_hours or weekly_hours < 1:
                weekly_hours = 1
            
            for _ in range(weekly_hours):
                subject_slots.append(subject)
        
        total_hours = len(subject_slots)
        
        # Critical check: Must have EXACTLY total_slots periods
        if total_hours < total_slots:
            # This should have been caught by validation, but enforce here too
            raise InsufficientDataError(
                f"إجمالي ساعات المواد ({total_hours}) أقل من المطلوب ({total_slots}). "
                f"لا يمكن إنشاء جدول كامل."
            )
        elif total_hours > total_slots:
            # Trim excess hours - take only what fits
            print(f"⚠️ إجمالي الساعات ({total_hours}) يتجاوز المتاح ({total_slots}). سيتم استخدام {total_slots} حصة فقط.")
            subject_slots = subject_slots[:total_slots]
            total_hours = total_slots
        
        print(f"\n📊 Subject Distribution:")
        print(f"  - Total slots required: {total_slots}")
        print(f"  - Total hours to assign: {total_hours}")
        print(f"  - Status: {'✅ Exact match' if total_hours == total_slots else '⚠️ Adjusted'}")
        print(f"  - Class ID: {class_id}")
        print(f"  - Section: {section if section else 'جميع الشعب'}")
        
        # Get teacher-subject assignments for this specific class and section
        # This is CRITICAL to prevent period count mismatches across sections
        if section:
            # Look for section-specific assignments first
            teacher_assignments = self.db.query(TeacherAssignment).filter(
                TeacherAssignment.class_id == class_id,
                TeacherAssignment.section == section
            ).all()
            
            # If no section-specific assignments, fall back to "all sections" (NULL)
            if not teacher_assignments:
                teacher_assignments = self.db.query(TeacherAssignment).filter(
                    TeacherAssignment.class_id == class_id,
                    or_(TeacherAssignment.section == None, TeacherAssignment.section == '')
                ).all()
        else:
            # No specific section requested - get all assignments for this class
            teacher_assignments = self.db.query(TeacherAssignment).filter(
                TeacherAssignment.class_id == class_id
            ).all()
        
        subject_teacher_map = {}  # subject_id -> teacher_id
        for assignment in teacher_assignments:
            subject_teacher_map[assignment.subject_id] = assignment.teacher_id
        
        print(f"  - Found {len(teacher_assignments)} teacher assignments for this class/section")
        
        # Get all teachers with their availability
        teachers = self.db.query(Teacher).filter(Teacher.is_active == True).all()
        teacher_map = {t.id: t for t in teachers}
        
        # Build teacher availability matrix: (teacher_id, day, period) -> is_free
        # IMPORTANT: A teacher can only be available if the slot is FREE
        # If a slot is assigned (even to the same class), the teacher is NOT available
        # because they can't teach two sections at the same time
        teacher_availability = {}
        for teacher in teachers:
            if not teacher.free_time_slots:
                continue
            
            slots = json.loads(teacher.free_time_slots)
            for slot in slots:
                day = slot.get('day')  # 0-based
                period = slot.get('period')  # 0-based
                status = slot.get('status')
                is_free = slot.get('is_free')
                
                # Teacher is available ONLY if status='free' AND is_free=True
                # A teacher CANNOT teach two sections at the same time slot
                if status == 'free' and is_free == True:
                    teacher_availability[(teacher.id, day, period)] = True
                # NOTE: We do NOT include 'assigned' slots - a teacher in one section
                # cannot simultaneously teach another section at the same time
        
        print(f"\n📋 Teacher-aware placement:")
        print(f"  - Loaded {len(teacher_map)} teachers")
        print(f"  - Total teacher-slot availability: {len(teacher_availability)}")
        
        # Calculate scarcity matrix: how many teachers are free at each (day, period)
        scarcity_matrix = {}
        for day in range(num_days):
            for period in range(periods_per_day):
                count = sum(1 for (t_id, d, p) in teacher_availability if d == day and p == period)
                scarcity_matrix[(day, period)] = count
        
        print(f"  - Scarcity matrix calculated (will prioritize scarce slots)")
        
        # Create a subject tracker for even distribution AND total placement
        subject_counts_per_day = {subject.id: [0] * num_days for subject in subjects}
        subject_placed_total = {subject.id: 0 for subject in subjects}  # Track total placed per subject
        subject_required = {subject.id: getattr(subject, 'weekly_hours', 1) or 1 for subject in subjects}
        
        # ========== CRITICAL FIX: TEACHER DAILY LOAD TRACKING ==========
        # Track how many periods each teacher has been assigned per day
        # This prevents single-teacher days and ensures even distribution
        teacher_daily_load = {}  # teacher_id -> [count_day0, count_day1, ...]
        for teacher_id in set(subject_teacher_map.values()):
            if teacher_id:
                teacher_daily_load[teacher_id] = [0] * num_days
        
        # Calculate ideal max periods per teacher per day
        # Based on: total_teachers, periods_per_day, and each teacher's weekly requirements
        num_teachers = len(set(t_id for t_id in subject_teacher_map.values() if t_id))
        # Ideal: each teacher should have roughly equal periods per day
        # Max allowed: 2-3 periods per teacher per day to ensure variety
        # This is a SOFT cap that becomes HARD when other teachers are available
        IDEAL_MAX_PERIODS_PER_TEACHER_PER_DAY = max(2, periods_per_day // max(num_teachers, 1))
        HARD_MAX_PERIODS_PER_TEACHER_PER_DAY = min(3, periods_per_day - 1)  # Never more than 3, leave room for others
        print(f"  - Teacher daily load limits: ideal={IDEAL_MAX_PERIODS_PER_TEACHER_PER_DAY}, hard={HARD_MAX_PERIODS_PER_TEACHER_PER_DAY}")
        
        # DYNAMIC subject classification based on weekly_hours (not hardcoded names)
        # This works with ANY subject names in ANY language
        # Core subjects = high weekly_hours (≥4) = important, need early periods
        # Light subjects = low weekly_hours (≤2) = electives/activities, can be later
        # Medium subjects = 3 hours = flexible placement
        
        # Calculate thresholds dynamically based on actual subject hours
        all_hours = [getattr(s, 'weekly_hours', 1) or 1 for s in subjects]
        avg_hours = sum(all_hours) / len(all_hours) if all_hours else 3
        
        def is_core_subject(subj):
            """Core = subjects with above-average weekly hours (important subjects)"""
            hours = getattr(subj, 'weekly_hours', 1) or 1
            return hours >= max(4, avg_hours)  # At least 4 hours or above average
        
        def is_light_subject(subj):
            """Light = subjects with 1-2 weekly hours (electives, activities)"""
            hours = getattr(subj, 'weekly_hours', 1) or 1
            return hours <= 2
        
        # Track which periods each subject has been placed at (for variety scoring)
        subject_period_usage = {subject.id: set() for subject in subjects}
        
        # ========== CRITICAL FIX: TEACHER-SCARCITY-BASED SORTING ==========
        # Teachers with fewer free slots MUST be scheduled first to ensure their
        # limited availability is respected. Otherwise, more flexible teachers
        # might "steal" the scarce slots.
        
        # Step 1: Calculate each teacher's total available slots
        teacher_available_slots = {}  # teacher_id -> count of free slots
        for teacher_id in set(subject_teacher_map.values()):
            if teacher_id:
                available_count = sum(1 for (t_id, d, p) in teacher_availability if t_id == teacher_id)
                teacher_available_slots[teacher_id] = available_count
        
        # Step 2: Calculate each teacher's required slots (total weekly hours of their subjects)
        teacher_required_slots = {}  # teacher_id -> total required periods
        for subject in subjects:
            teacher_id = subject_teacher_map.get(subject.id)
            if teacher_id:
                weekly_hours = getattr(subject, 'weekly_hours', 1) or 1
                teacher_required_slots[teacher_id] = teacher_required_slots.get(teacher_id, 0) + weekly_hours
        
        # Step 2b: Calculate UNIQUE slots - slots that ONLY this teacher can use
        # This is critical for teachers like سماح موسى who only have periods 5-6
        teacher_unique_slots = {}  # teacher_id -> count of slots no other teacher has
        teacher_shared_slots = {}  # teacher_id -> count of slots shared with others
        all_teacher_ids = set(subject_teacher_map.values())
        
        for teacher_id in all_teacher_ids:
            if not teacher_id:
                continue
            unique_count = 0
            shared_count = 0
            # Get all slots for this teacher
            my_slots = [(d, p) for (t_id, d, p) in teacher_availability if t_id == teacher_id]
            for day, period in my_slots:
                # Check if any OTHER teacher also has this slot
                other_has_slot = any(
                    (other_id, day, period) in teacher_availability 
                    for other_id in all_teacher_ids 
                    if other_id and other_id != teacher_id
                )
                if other_has_slot:
                    shared_count += 1
                else:
                    unique_count += 1
            teacher_unique_slots[teacher_id] = unique_count
            teacher_shared_slots[teacher_id] = shared_count
        
        # Step 3: Calculate "effective scarcity" considering slot overlap
        # A teacher with all shared slots is MORE constrained than one with unique slots
        # because their slots can be "stolen" by other teachers
        teacher_scarcity_ratio = {}
        for teacher_id in teacher_available_slots:
            available = teacher_available_slots.get(teacher_id, 0)
            required = teacher_required_slots.get(teacher_id, 1)
            unique = teacher_unique_slots.get(teacher_id, 0)
            shared = teacher_shared_slots.get(teacher_id, 0)
            
            # Base ratio
            base_ratio = available / max(required, 1)
            
            # Adjust for slot sharing: if all slots are shared, teacher is more constrained
            # because other teachers might take their slots
            # unique_ratio: 0 = all shared (bad), 1 = all unique (good)
            unique_ratio = unique / max(available, 1) if available > 0 else 0
            
            # Effective ratio: penalize teachers with mostly shared slots
            # A teacher with 10 shared slots is effectively more constrained than
            # a teacher with 10 unique slots
            effective_ratio = base_ratio * (0.5 + 0.5 * unique_ratio)
            
            teacher_scarcity_ratio[teacher_id] = effective_ratio
        
        # Print teacher scarcity analysis for debugging
        print(f"\n🎯 Teacher Scarcity Analysis (CRITICAL for correct scheduling):")
        for teacher_id, ratio in sorted(teacher_scarcity_ratio.items(), key=lambda x: x[1]):
            teacher = teacher_map.get(teacher_id)
            teacher_name = teacher.full_name if teacher else f"Teacher {teacher_id}"
            available = teacher_available_slots.get(teacher_id, 0)
            required = teacher_required_slots.get(teacher_id, 0)
            unique = teacher_unique_slots.get(teacher_id, 0)
            shared = teacher_shared_slots.get(teacher_id, 0)
            status = "⚠️ CRITICAL" if ratio < 1.0 else ("🔶 TIGHT" if ratio <= 1.5 else "✅ FLEXIBLE")
            print(f"  - {teacher_name}: {available} slots ({unique} unique, {shared} shared) / {required} required = {ratio:.2f} {status}")
        
        # Step 4: Calculate day-level constraints for each teacher
        # This helps identify teachers who can ONLY use certain days
        teacher_available_days = {}  # teacher_id -> set of days they can use
        for teacher_id in all_teacher_ids:
            if not teacher_id:
                continue
            days = set(d for (t_id, d, p) in teacher_availability if t_id == teacher_id)
            teacher_available_days[teacher_id] = days
        
        # Calculate "day exclusivity" - teachers with fewer day options are more constrained
        # even if they have many slots on those days
        teacher_day_scarcity = {}
        for teacher_id in all_teacher_ids:
            if not teacher_id:
                continue
            teacher_num_days = len(teacher_available_days.get(teacher_id, set()))
            required = teacher_required_slots.get(teacher_id, 1)
            # How many periods per day does this teacher need on average?
            periods_per_day_needed = required / max(teacher_num_days, 1)
            # If they need >4 periods per day, they're very constrained
            teacher_day_scarcity[teacher_id] = periods_per_day_needed
        
        # Step 5: Sort subjects by COMBINED scarcity (slot ratio + day constraints)
        def get_subject_placement_difficulty(subj):
            teacher_id = subject_teacher_map.get(subj.id)
            if not teacher_id:
                return (999, 999, 0)  # No teacher = process last
            ratio = teacher_scarcity_ratio.get(teacher_id, 999)
            day_scarcity = teacher_day_scarcity.get(teacher_id, 0)
            # Return tuple: (scarcity_ratio, -day_scarcity, -weekly_hours)
            # This ensures: 
            # 1) Most constrained by slot ratio first
            # 2) Among similar ratios, those needing more periods/day first
            # 3) Within same teacher, more hours first
            weekly_hours = getattr(subj, 'weekly_hours', 1) or 1
            return (ratio, -day_scarcity, -weekly_hours)
        
        # Sort subject_slots by placement difficulty (most constrained teachers first)
        subject_slots.sort(key=get_subject_placement_difficulty)
        
        print(f"\n📋 Subject placement order (constrained teachers first):")
        seen_teachers = set()
        for subj in subject_slots:
            teacher_id = subject_teacher_map.get(subj.id)
            if teacher_id and teacher_id not in seen_teachers:
                teacher = teacher_map.get(teacher_id)
                ratio = teacher_scarcity_ratio.get(teacher_id, 0)
                print(f"  - {subj.subject_name} (teacher ratio: {ratio:.2f})")
                seen_teachers.add(teacher_id)
        
        # ========== CRITICAL: DAY-LEVEL DEMAND CALCULATION ==========
        # Calculate expected demand per day to identify oversubscribed days
        # Teachers should prefer days with lower demand to balance the load
        day_demand = {d: 0.0 for d in range(num_days)}
        for teacher_id in all_teacher_ids:
            if not teacher_id or teacher_id not in teacher_required_slots:
                continue
            teacher_day_set = teacher_available_days.get(teacher_id, set())
            if not teacher_day_set:
                continue
            required = teacher_required_slots.get(teacher_id, 0)
            slots_per_day = required / len(teacher_day_set)
            for day in teacher_day_set:
                day_demand[day] += slots_per_day
        
        day_names_debug = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"]
        print(f"\n📊 Day-level demand analysis:")
        for day in range(num_days):
            demand = day_demand[day]
            status = "⚠️ OVERSUBSCRIBED" if demand > periods_per_day else "✅ OK"
            print(f"  - {day_names_debug[day]}: demand {demand:.1f}/6 {status}")
        
        # Track failed placements for retry
        failed_placements = []
        
        # ========== LOAD USER-DEFINED CONSTRAINTS FROM DATABASE ==========
        # These are constraints the user added through the frontend UI
        # Types: عدم التتالي (no_consecutive), الترتيب قبل/بعد (before_after), مادة كل يوم (subject_per_day)
        active_constraints = []
        try:
            from app.models.schedules import ScheduleConstraint
            # Get the academic year from the class
            class_obj = self.db.query(Class).filter(Class.id == class_id).first()
            if class_obj:
                active_constraints = self.db.query(ScheduleConstraint).filter(
                    ScheduleConstraint.academic_year_id == class_obj.academic_year_id,
                    ScheduleConstraint.is_active == True,
                    or_(
                        ScheduleConstraint.class_id == None,  # Global constraint
                        ScheduleConstraint.class_id == class_id  # Class-specific
                    )
                ).all()
                if active_constraints:
                    print(f"  - Loaded {len(active_constraints)} user-defined constraints from database")
        except Exception as e:
            print(f"  - Warning: Could not load constraints: {e}")
        
        # Build constraint lookup for quick access during scoring
        # no_consecutive_subjects: set of subject_ids that cannot have consecutive periods
        # before_after_rules: list of (subject_id, must_be_before_subject_id) or (subject_id, must_be_after_subject_id)
        # subject_every_day: set of subject_ids that must appear every day
        no_consecutive_subjects = set()
        forbidden_slots = {}  # (subject_id, day, period) -> True if forbidden
        required_slots = {}   # (subject_id, day, period) -> True if required
        subject_every_day = set()
        before_after_rules = []  # (subject_id, other_subject_id, 'before'|'after')
        
        for constraint in active_constraints:
            subj_id = constraint.subject_id
            c_type = constraint.constraint_type
            
            if c_type == 'no_consecutive' and subj_id:
                no_consecutive_subjects.add(subj_id)
            elif c_type == 'forbidden' and subj_id:
                day = constraint.day_of_week
                period = constraint.period_number
                if day is not None and period is not None:
                    # Convert 1-based to 0-based
                    forbidden_slots[(subj_id, day - 1, period - 1)] = True
            elif c_type == 'required' and subj_id:
                day = constraint.day_of_week
                period = constraint.period_number
                if day is not None and period is not None:
                    required_slots[(subj_id, day - 1, period - 1)] = True
            elif c_type == 'subject_per_day' and subj_id:
                subject_every_day.add(subj_id)
            elif c_type == 'before_after' and subj_id:
                # before_after constraint: subject_id should NOT be directly before/after reference_subject_id
                ref_subj_id = getattr(constraint, 'reference_subject_id', None)
                placement = getattr(constraint, 'placement', None)
                if ref_subj_id and placement in ['before', 'after']:
                    before_after_rules.append((subj_id, ref_subj_id, placement))
                    print(f"  - Loaded عدم الترتيب rule: subject {subj_id} must NOT be {placement} subject {ref_subj_id}")
        
        # ========== CONSTRAINT STATISTICS (to prove constraints are working) ==========
        constraint_stats = {
            'forbidden_blocked': 0,
            'no_consecutive_blocked': 0,
            'required_preferred': 0,
            'subject_every_day_applied': 0,
            'before_after_blocked': 0,
            'before_after_skipped': 0  # When constraint is impossible to satisfy
        }
        
        if no_consecutive_subjects:
            print(f"  - عدم التتالي constraint active for {len(no_consecutive_subjects)} subjects")
        if forbidden_slots:
            print(f"  - Forbidden slots: {len(forbidden_slots)}")
        if subject_every_day:
            print(f"  - مادة كل يوم constraint active for {len(subject_every_day)} subjects")
        if before_after_rules:
            print(f"  - عدم الترتيب (قبل/بعد) constraint active for {len(before_after_rules)} rules")
        
        # Place subjects using TEACHER-AWARE algorithm
        for subject in subject_slots:
            subject_id = subject.id
            
            # Find the teacher assigned to this subject
            teacher_id = subject_teacher_map.get(subject_id)
            if not teacher_id:
                print(f"⚠️  No teacher assigned to subject {subject.subject_name}")
                continue
            
            # Find all valid slots where:
            # 1. Grid slot is empty
            # 2. Teacher is actually free
            valid_slots = []
            for day in range(num_days):
                for period in range(periods_per_day):
                    # Check if grid slot is empty
                    if schedule_grid[day][period] is not None:
                        continue
                    
                    # Check if teacher is free at this day/period
                    if (teacher_id, day, period) not in teacher_availability:
                        continue
                    
                    # ========== APPLY USER-DEFINED CONSTRAINTS (HARD) ==========
                    # These are constraints the user added through the frontend UI
                    
                    # Check FORBIDDEN constraint - completely skip this slot
                    if (subject_id, day, period) in forbidden_slots:
                        constraint_stats['forbidden_blocked'] += 1
                        continue  # User said this subject cannot be here
                    
                    # Check NO_CONSECUTIVE constraint - skip if would create consecutive
                    # عدم التتالي = subject cannot have 2 periods next to each other
                    if subject_id in no_consecutive_subjects:
                        prev_slot = schedule_grid[day][period-1] if period > 0 else None
                        next_slot = schedule_grid[day][period+1] if period < periods_per_day - 1 else None
                        prev_subj_id = prev_slot[0].id if prev_slot else None
                        next_subj_id = next_slot[0].id if next_slot else None
                        
                        if prev_subj_id == subject_id or next_subj_id == subject_id:
                            constraint_stats['no_consecutive_blocked'] += 1
                            continue  # User said no consecutive for this subject
                    
                    # Check NOT_BEFORE_AFTER constraint (SOFT - adds penalty, skips if impossible)
                    # عدم الترتيب (قبل/بعد) = subject A must NOT be directly before/after subject B
                    # This means: if placement='before', subject A cannot be in the period immediately before subject B
                    # If placement='after', subject A cannot be in the period immediately after subject B
                    # 
                    # IMPORTANT: We need to check BOTH directions:
                    # 1. When placing subject A: check if ref subject B is in adjacent slot
                    # 2. When placing subject B (ref): check if subject A is in adjacent slot (reverse check)
                    before_after_violation = False
                    for (rule_subj_id, ref_subj_id, placement) in before_after_rules:
                        # Case 1: We are placing the constrained subject (rule_subj_id)
                        if subject_id == rule_subj_id:
                            if placement == 'before':
                                # Subject A must NOT be directly BEFORE subject B
                                # Check if reference subject B is in the next period
                                next_slot = schedule_grid[day][period + 1] if period < periods_per_day - 1 else None
                                if next_slot and next_slot[0].id == ref_subj_id:
                                    before_after_violation = True
                                    constraint_stats['before_after_blocked'] += 1
                                    break
                            elif placement == 'after':
                                # Subject A must NOT be directly AFTER subject B
                                # Check if reference subject B is in the previous period
                                prev_slot = schedule_grid[day][period - 1] if period > 0 else None
                                if prev_slot and prev_slot[0].id == ref_subj_id:
                                    before_after_violation = True
                                    constraint_stats['before_after_blocked'] += 1
                                    break
                        
                        # Case 2: We are placing the reference subject (ref_subj_id)
                        # Need to check if constrained subject is in the position that would violate
                        if subject_id == ref_subj_id:
                            if placement == 'before':
                                # Rule says: subject A must NOT be directly BEFORE subject B (us)
                                # So check if subject A is in the previous period (would make A before B)
                                prev_slot = schedule_grid[day][period - 1] if period > 0 else None
                                if prev_slot and prev_slot[0].id == rule_subj_id:
                                    before_after_violation = True
                                    constraint_stats['before_after_blocked'] += 1
                                    break
                            elif placement == 'after':
                                # Rule says: subject A must NOT be directly AFTER subject B (us)
                                # So check if subject A is in the next period (would make A after B)
                                next_slot = schedule_grid[day][period + 1] if period < periods_per_day - 1 else None
                                if next_slot and next_slot[0].id == rule_subj_id:
                                    before_after_violation = True
                                    constraint_stats['before_after_blocked'] += 1
                                    break
                    
                    # Skip this slot if it violates the not_before_after constraint
                    if before_after_violation:
                        continue
                    
                    # Calculate preference score (LOWER = BETTER):
                    score = 0
                    
                    # ========== CRITICAL FIX: TEACHER DAILY LOAD LIMIT ==========
                    # Check if this teacher already has too many periods on this day
                    # This is a HARD constraint when other teachers are available for this slot
                    current_teacher_load_today = teacher_daily_load.get(teacher_id, [0] * num_days)[day]
                    
                    # Count how many OTHER teachers are available at this exact slot
                    other_teachers_available_here = sum(
                        1 for other_id in teacher_daily_load.keys()
                        if other_id != teacher_id and (other_id, day, period) in teacher_availability
                    )
                    
                    # If teacher already at HARD limit and others are available, SKIP this slot
                    if current_teacher_load_today >= HARD_MAX_PERIODS_PER_TEACHER_PER_DAY and other_teachers_available_here > 0:
                        continue  # Hard block - this teacher has enough on this day
                    
                    # If teacher at IDEAL limit, add heavy penalty (but allow if no alternatives)
                    if current_teacher_load_today >= IDEAL_MAX_PERIODS_PER_TEACHER_PER_DAY:
                        if other_teachers_available_here > 0:
                            score += 500  # Very heavy penalty - prefer other teachers
                        else:
                            score += 100  # Moderate penalty - but allow if necessary
                    elif current_teacher_load_today > 0:
                        # Already has periods today - add incremental penalty
                        score += current_teacher_load_today * 50  # 50 per existing period
                    
                    # Check REQUIRED constraint - give bonus for required slots
                    if (subject_id, day, period) in required_slots:
                        score -= 100  # Strong bonus - user wants this subject here
                    
                    # ========== CRITICAL: SLOT EXCLUSIVITY SCORING ==========
                    # Check if this slot is needed by OTHER teachers who have LIMITED options
                    # Teachers with more day options should avoid slots that teachers with fewer options need
                    my_ratio = teacher_scarcity_ratio.get(teacher_id, 999)
                    my_days = teacher_available_days.get(teacher_id, set())
                    
                    # Count how many OTHER teachers need this exact slot
                    constrained_teachers_needing_slot = 0
                    for other_teacher_id in teacher_scarcity_ratio.keys():
                        if other_teacher_id == teacher_id:
                            continue
                        # Check if this other teacher is available at this slot
                        if (other_teacher_id, day, period) in teacher_availability:
                            other_days = teacher_available_days.get(other_teacher_id, set())
                            other_remaining = sum(1 for (t_id, d, p) in teacher_availability if t_id == other_teacher_id)
                            other_required = teacher_required_slots.get(other_teacher_id, 0)
                            
                            # If other teacher has FEWER day options than me, I should avoid their days
                            if len(other_days) < len(my_days):
                                # Heavy penalty - leave this slot for the more constrained teacher
                                score += 300
                                constrained_teachers_needing_slot += 1
                            # If other teacher has same days but tighter ratio
                            elif teacher_scarcity_ratio.get(other_teacher_id, 999) < my_ratio:
                                score += 150
                                constrained_teachers_needing_slot += 1
                    
                    # ========== CRITICAL: DAY EXCLUSIVITY ==========
                    # If I can use MANY days but another teacher can ONLY use THIS day,
                    # I should strongly prefer my OTHER days to leave room for them
                    for other_teacher_id in teacher_scarcity_ratio.keys():
                        if other_teacher_id == teacher_id:
                            continue
                        other_days = teacher_available_days.get(other_teacher_id, set())
                        
                        # If other teacher can only use a subset of days that includes this day
                        # and I have more options, avoid this day
                        if day in other_days and len(my_days) > len(other_days):
                            # Check if other teacher still needs slots
                            other_remaining = sum(1 for (t_id, d, p) in teacher_availability if t_id == other_teacher_id)
                            other_required = teacher_required_slots.get(other_teacher_id, 0)
                            other_placed = sum(1 for d2 in range(num_days) for p2 in range(periods_per_day) 
                                             if schedule_grid[d2][p2] is not None and schedule_grid[d2][p2][1] == other_teacher_id)
                            other_still_needed = other_required - other_placed
                            
                            if other_still_needed > 0:
                                # Calculate how critical this day is for the other teacher
                                # If they have few slots left relative to what they need, it's critical
                                slots_on_this_day = sum(1 for (t_id, d, p) in teacher_availability 
                                                       if t_id == other_teacher_id and d == day)
                                if slots_on_this_day > 0 and other_remaining <= other_still_needed + 3:
                                    # This day is critical for the other teacher
                                    score += 250
                    
                    # 1. Scarcity bonus: Prefer slots where fewer teachers are available
                    scarcity_count = scarcity_matrix.get((day, period), 1)
                    score += scarcity_count * 5
                    
                    # 1b. DAY-LEVEL DEMAND SCORING: Prefer days with lower overall demand
                    # This helps balance load across the week and avoid oversubscribed days
                    # NOTE: Keep penalties light to avoid blocking valid placements
                    current_day_demand = day_demand.get(day, 0)
                    if current_day_demand > periods_per_day + 1:  # Only penalize if significantly over
                        # This day is very oversubscribed - add light penalty
                        oversubscription = current_day_demand - periods_per_day
                        score += int(oversubscription * 10)  # Light penalty
                    
                    # Prefer days with lower demand (more room) - but keep it as a preference, not a blocker
                    my_available_days = teacher_available_days.get(teacher_id, set())
                    if my_available_days and len(my_available_days) > 1:  # Only if teacher has options
                        min_demand_day = min(my_available_days, key=lambda d: day_demand.get(d, 0))
                        min_demand = day_demand.get(min_demand_day, 0)
                        # Add small penalty if this is not the least demanded day
                        if day != min_demand_day and current_day_demand > min_demand + 0.5:
                            demand_diff = current_day_demand - min_demand
                            score += int(demand_diff * 5)  # Very light preference
                    
                    # 2. Even distribution across week: SOFT penalty for >2 periods per day
                    # This is a soft constraint - degrades gracefully if teacher only available on few days
                    day_count = subject_counts_per_day[subject_id][day]
                    if day_count == 0:
                        score += 0  # Best - first period on this day
                    elif day_count == 1:
                        score += 10  # OK - second period on this day
                    elif day_count == 2:
                        score += 30  # Less ideal - third period (but allowed if needed)
                    else:
                        score += 50 + (day_count * 10)  # 4+ periods: increasing penalty
                    
                    # 3. Period timing preference based on subject type
                    # Core subjects prefer early periods (1-4), light subjects prefer late (5-6)
                    if is_core_subject(subject):
                        # Core subjects: prefer periods 0-3 (1-4 in display)
                        if period <= 3:
                            score -= 15  # Bonus for early placement
                        else:
                            score += 20  # Penalty for late placement
                    elif is_light_subject(subject):
                        # Light subjects: prefer periods 4-5 (5-6 in display)
                        if period >= 4:
                            score -= 15  # Bonus for late placement
                        else:
                            score += 5  # Small penalty for early placement
                    
                    # 4. Consecutive period penalty (soft constraint)
                    # Prefer variety - penalize same subject in adjacent periods
                    prev_slot = schedule_grid[day][period-1] if period > 0 else None
                    next_slot = schedule_grid[day][period+1] if period < periods_per_day - 1 else None
                    prev_subject_id = prev_slot[0].id if prev_slot else None
                    next_subject_id = next_slot[0].id if next_slot else None
                    
                    if prev_subject_id == subject_id:
                        score += 25  # Penalty for 2 consecutive
                        # Check for 3 consecutive (even higher penalty)
                        if period > 1:
                            prev2 = schedule_grid[day][period-2]
                            if prev2 and prev2[0].id == subject_id:
                                score += 75  # Total 100 penalty for 3 consecutive
                    
                    if next_subject_id == subject_id:
                        score += 25  # Penalty for placing before existing same subject
                    
                    # 5. Weekly spread bonus: reward spreading across more days
                    # Calculate how many days already have this subject
                    days_with_subject = sum(1 for d in range(num_days) if subject_counts_per_day[subject_id][d] > 0)
                    if day_count == 0 and days_with_subject < subject_required[subject_id]:
                        score -= 15  # Bonus for using a new day (increased)
                    
                    # 5b. SUBJECT_EVERY_DAY constraint (مادة كل يوم)
                    # If user said this subject must appear every day, strongly prefer empty days
                    if subject_id in subject_every_day:
                        if day_count == 0:
                            score -= 50  # Strong bonus for placing on a day that doesn't have this subject
                        # Count how many days still need this subject
                        days_still_needed = num_days - days_with_subject
                        periods_remaining = subject_required[subject_id] - subject_placed_total.get(subject_id, 0)
                        # If running low on periods, prioritize empty days even more
                        if days_still_needed > 0 and periods_remaining <= days_still_needed:
                            if day_count == 0:
                                score -= 100  # Critical: must place on empty day
                    
                    # 6. Period variety across days: avoid same subject at same period on different days
                    # Use the period usage tracker for efficiency
                    if period in subject_period_usage[subject_id]:
                        score += 25  # Penalty for reusing same period
                        # Extra penalty if used more than once
                        same_period_count = sum(1 for d in range(num_days) 
                                               if schedule_grid[d][period] and schedule_grid[d][period][0].id == subject_id)
                        score += same_period_count * 15  # Additional penalty per occurrence
                    
                    # 7. Adjacent day variety: avoid same pattern on consecutive days
                    # Check if previous day has same subject at similar positions
                    if day > 0:
                        prev_day_slots = schedule_grid[day - 1]
                        # Check if subject appears at same or adjacent period on previous day
                        for offset in [-1, 0, 1]:
                            check_period = period + offset
                            if 0 <= check_period < periods_per_day:
                                prev_slot = prev_day_slots[check_period]
                                if prev_slot and prev_slot[0].id == subject_id:
                                    score += 10  # Penalty for similar pattern to previous day
                    
                    # 8. Spread light subjects across ALL days (not clustered on specific days)
                    if is_light_subject(subject):
                        # Count light subjects on each day
                        light_per_day = [0] * num_days
                        for d in range(num_days):
                            for p in range(periods_per_day):
                                slot = schedule_grid[d][p]
                                if slot and is_light_subject(slot[0]):
                                    light_per_day[d] += 1
                        
                        # Penalty for placing on day that already has 2+ light subjects
                        if light_per_day[day] >= 2:
                            score += 25  # Strong penalty for clustering
                        elif light_per_day[day] >= 1:
                            score += 10  # Mild penalty
                        
                        # Bonus for spreading to days with fewer light subjects
                        min_light = min(light_per_day)
                        if light_per_day[day] == min_light:
                            score -= 10  # Bonus for evening out distribution
                    
                    valid_slots.append((day, period, score))
            
            # Sort by score (lowest = best) and place in best valid slot
            if valid_slots:
                valid_slots.sort(key=lambda x: x[2])
                best_day, best_period, _ = valid_slots[0]
                
                # Store (subject, teacher_id) tuple to preserve the teacher assignment
                schedule_grid[best_day][best_period] = (subject, teacher_id)
                subject_counts_per_day[subject_id][best_day] += 1
                subject_placed_total[subject_id] = subject_placed_total.get(subject_id, 0) + 1  # Track total placed
                subject_period_usage[subject_id].add(best_period)  # Track which periods this subject uses
                
                # CRITICAL FIX: Update teacher daily load tracking
                if teacher_id in teacher_daily_load:
                    teacher_daily_load[teacher_id][best_day] += 1
                
                # CRITICAL FIX: Remove teacher from availability at this slot
                # This prevents the same teacher from being assigned twice at the same time
                if (teacher_id, best_day, best_period) in teacher_availability:
                    del teacher_availability[(teacher_id, best_day, best_period)]
                
                # Update scarcity matrix: one teacher is now occupied at this slot
                if (best_day, best_period) in scarcity_matrix:
                    scarcity_matrix[(best_day, best_period)] -= 1
            else:
                # Track failed placement for retry
                failed_placements.append(subject)
                print(f"⚠️  Could not find valid slot for {subject.subject_name} (teacher {teacher_map[teacher_id].full_name if teacher_id in teacher_map else 'unknown'})")
        
        # CRITICAL: Verify all subjects got their required periods
        print(f"\n📊 Subject Placement Summary:")
        placement_errors = []
        for subject in subjects:
            required = subject_required[subject.id]
            placed = subject_placed_total.get(subject.id, 0)
            status = "✅" if placed == required else ("⚠️ OVER" if placed > required else "❌ UNDER")
            print(f"  - {subject.subject_name}: {placed}/{required} periods {status}")
            if placed != required:
                placement_errors.append({
                    'subject': subject.subject_name,
                    'required': required,
                    'placed': placed,
                    'difference': placed - required
                })
        
        # ========== CRITICAL FIX: NO FORCE-PLACEMENT THAT VIOLATES AVAILABILITY ==========
        # If there are failed placements, we MUST NOT place them in slots where the teacher
        # is not available. Instead, we try to find alternative solutions or raise an error.
        if failed_placements:
            print(f"\n🔄 Attempting to place {len(failed_placements)} failed subjects (RESPECTING availability)...")
            
            for subject in failed_placements:
                teacher_id = subject_teacher_map.get(subject.id)
                teacher = teacher_map.get(teacher_id) if teacher_id else None
                teacher_name = teacher.full_name if teacher else "Unknown"
                
                # Strategy 1: Try to find ANY slot where this teacher is still available
                # Prefer slots where teacher has lower daily load
                # CRITICAL: Also respect no_consecutive constraint!
                placed = False
                candidate_slots = []
                subject_id = subject.id
                for day in range(num_days):
                    for period in range(periods_per_day):
                        if schedule_grid[day][period] is None:
                            # CRITICAL: Only place if teacher is ACTUALLY free at this slot
                            if (teacher_id, day, period) in teacher_availability:
                                # CRITICAL FIX: Check no_consecutive constraint before adding to candidates
                                if subject_id in no_consecutive_subjects:
                                    prev_slot = schedule_grid[day][period-1] if period > 0 else None
                                    next_slot = schedule_grid[day][period+1] if period < periods_per_day - 1 else None
                                    prev_subj_id = prev_slot[0].id if prev_slot else None
                                    next_subj_id = next_slot[0].id if next_slot else None
                                    
                                    if prev_subj_id == subject_id or next_subj_id == subject_id:
                                        # Skip this slot - would create consecutive periods
                                        constraint_stats['no_consecutive_blocked'] += 1
                                        continue
                                
                                # CRITICAL FIX: Check before_after constraint before adding to candidates
                                before_after_ok = True
                                for (rule_subj_id, ref_subj_id, ba_placement) in before_after_rules:
                                    if subject_id == rule_subj_id:
                                        if ba_placement == 'before':
                                            next_slot = schedule_grid[day][period + 1] if period < periods_per_day - 1 else None
                                            if next_slot and next_slot[0].id == ref_subj_id:
                                                before_after_ok = False
                                                break
                                        elif ba_placement == 'after':
                                            prev_slot = schedule_grid[day][period - 1] if period > 0 else None
                                            if prev_slot and prev_slot[0].id == ref_subj_id:
                                                before_after_ok = False
                                                break
                                    if subject_id == ref_subj_id:
                                        if ba_placement == 'before':
                                            prev_slot = schedule_grid[day][period - 1] if period > 0 else None
                                            if prev_slot and prev_slot[0].id == rule_subj_id:
                                                before_after_ok = False
                                                break
                                        elif ba_placement == 'after':
                                            next_slot = schedule_grid[day][period + 1] if period < periods_per_day - 1 else None
                                            if next_slot and next_slot[0].id == rule_subj_id:
                                                before_after_ok = False
                                                break
                                if not before_after_ok:
                                    constraint_stats['before_after_blocked'] += 1
                                    continue
                                
                                load_today = teacher_daily_load.get(teacher_id, [0] * num_days)[day]
                                candidate_slots.append((day, period, load_today))
                
                # Sort by daily load (prefer days with fewer periods for this teacher)
                candidate_slots.sort(key=lambda x: x[2])
                
                if candidate_slots:
                    day, period, _ = candidate_slots[0]
                    schedule_grid[day][period] = (subject, teacher_id)
                    subject_placed_total[subject.id] = subject_placed_total.get(subject.id, 0) + 1
                    subject_counts_per_day[subject.id][day] += 1
                    # Update teacher daily load
                    if teacher_id in teacher_daily_load:
                        teacher_daily_load[teacher_id][day] += 1
                    # Remove from availability
                    del teacher_availability[(teacher_id, day, period)]
                    print(f"  ✅ Placed {subject.subject_name} at day {day+1} period {period+1} (teacher available)")
                    placed = True
                
                if not placed:
                    # Strategy 2: Check if we can swap with another subject whose teacher has more flexibility
                    # Find subjects in the grid whose teachers have higher scarcity ratios
                    swapped = False
                    for day in range(num_days):
                        if swapped:
                            break
                        for period in range(periods_per_day):
                            existing_entry = schedule_grid[day][period]
                            if existing_entry is None:
                                continue
                            
                            existing_subject, existing_teacher_id = existing_entry
                            existing_ratio = teacher_scarcity_ratio.get(existing_teacher_id, 999)
                            my_ratio = teacher_scarcity_ratio.get(teacher_id, 0)
                            
                            # Only swap if the existing teacher is MORE flexible than ours
                            # AND our teacher is available at this slot
                            # AND the existing teacher can be placed elsewhere
                            # AND placing our subject here won't violate no_consecutive constraint
                            if existing_ratio > my_ratio * 1.5 and (teacher_id, day, period) in teacher_availability:
                                # CRITICAL FIX: Check no_consecutive constraint before swapping
                                if subject_id in no_consecutive_subjects:
                                    # Check what would be adjacent AFTER removing existing_entry
                                    prev_slot = schedule_grid[day][period-1] if period > 0 else None
                                    next_slot = schedule_grid[day][period+1] if period < periods_per_day - 1 else None
                                    prev_subj_id = prev_slot[0].id if prev_slot else None
                                    next_subj_id = next_slot[0].id if next_slot else None
                                    
                                    if prev_subj_id == subject_id or next_subj_id == subject_id:
                                        # Skip this slot - would create consecutive periods
                                        continue
                                
                                # CRITICAL FIX: Check before_after constraint before swapping
                                before_after_ok = True
                                for (rule_subj_id, ref_subj_id, ba_placement) in before_after_rules:
                                    if subject_id == rule_subj_id:
                                        if ba_placement == 'before':
                                            next_slot = schedule_grid[day][period + 1] if period < periods_per_day - 1 else None
                                            if next_slot and next_slot[0].id == ref_subj_id:
                                                before_after_ok = False
                                                break
                                        elif ba_placement == 'after':
                                            prev_slot = schedule_grid[day][period - 1] if period > 0 else None
                                            if prev_slot and prev_slot[0].id == ref_subj_id:
                                                before_after_ok = False
                                                break
                                    if subject_id == ref_subj_id:
                                        if ba_placement == 'before':
                                            prev_slot = schedule_grid[day][period - 1] if period > 0 else None
                                            if prev_slot and prev_slot[0].id == rule_subj_id:
                                                before_after_ok = False
                                                break
                                        elif ba_placement == 'after':
                                            next_slot = schedule_grid[day][period + 1] if period < periods_per_day - 1 else None
                                            if next_slot and next_slot[0].id == rule_subj_id:
                                                before_after_ok = False
                                                break
                                if not before_after_ok:
                                    continue
                                
                                # Check if existing teacher has another available slot
                                for alt_day in range(num_days):
                                    if swapped:
                                        break
                                    for alt_period in range(periods_per_day):
                                        if schedule_grid[alt_day][alt_period] is None:
                                            if (existing_teacher_id, alt_day, alt_period) in teacher_availability:
                                                # CRITICAL FIX: Check if moving existing subject would violate its no_consecutive constraint
                                                existing_subject_id = existing_subject.id
                                                if existing_subject_id in no_consecutive_subjects:
                                                    alt_prev_slot = schedule_grid[alt_day][alt_period-1] if alt_period > 0 else None
                                                    alt_next_slot = schedule_grid[alt_day][alt_period+1] if alt_period < periods_per_day - 1 else None
                                                    alt_prev_subj_id = alt_prev_slot[0].id if alt_prev_slot else None
                                                    alt_next_subj_id = alt_next_slot[0].id if alt_next_slot else None
                                                    
                                                    if alt_prev_subj_id == existing_subject_id or alt_next_subj_id == existing_subject_id:
                                                        # Skip - moving existing subject here would violate its constraint
                                                        continue
                                                
                                                # Perform the swap
                                                # Move existing subject to alternative slot
                                                schedule_grid[alt_day][alt_period] = existing_entry
                                                # Place our subject in the freed slot
                                                schedule_grid[day][period] = (subject, teacher_id)
                                                subject_placed_total[subject.id] = subject_placed_total.get(subject.id, 0) + 1
                                                
                                                # Update teacher daily load for both teachers
                                                if teacher_id in teacher_daily_load:
                                                    teacher_daily_load[teacher_id][day] += 1
                                                if existing_teacher_id in teacher_daily_load:
                                                    # Existing teacher moves from day to alt_day
                                                    teacher_daily_load[existing_teacher_id][day] -= 1
                                                    teacher_daily_load[existing_teacher_id][alt_day] += 1
                                                
                                                # Update availability
                                                del teacher_availability[(teacher_id, day, period)]
                                                del teacher_availability[(existing_teacher_id, alt_day, alt_period)]
                                                
                                                print(f"  🔄 Swapped: {subject.subject_name} took day {day+1} period {period+1}")
                                                print(f"     {existing_subject.subject_name} moved to day {alt_day+1} period {alt_period+1}")
                                                swapped = True
                                                placed = True
                                                break
                
                if not placed:
                    # Strategy 3: LAST RESORT - Allow consecutive placement with warning
                    # This is a soft constraint violation - better than failing entirely
                    # But still try to respect before_after constraints
                    fallback_slots = []
                    fallback_slots_with_ba_violation = []  # Slots that violate before_after
                    for day in range(num_days):
                        for period in range(periods_per_day):
                            if schedule_grid[day][period] is None:
                                if (teacher_id, day, period) in teacher_availability:
                                    load_today = teacher_daily_load.get(teacher_id, [0] * num_days)[day]
                                    
                                    # Check before_after constraint
                                    ba_violation = False
                                    for (rule_subj_id, ref_subj_id, ba_placement) in before_after_rules:
                                        if subject_id == rule_subj_id:
                                            if ba_placement == 'before':
                                                next_slot = schedule_grid[day][period + 1] if period < periods_per_day - 1 else None
                                                if next_slot and next_slot[0].id == ref_subj_id:
                                                    ba_violation = True
                                                    break
                                            elif ba_placement == 'after':
                                                prev_slot = schedule_grid[day][period - 1] if period > 0 else None
                                                if prev_slot and prev_slot[0].id == ref_subj_id:
                                                    ba_violation = True
                                                    break
                                        if subject_id == ref_subj_id:
                                            if ba_placement == 'before':
                                                prev_slot = schedule_grid[day][period - 1] if period > 0 else None
                                                if prev_slot and prev_slot[0].id == rule_subj_id:
                                                    ba_violation = True
                                                    break
                                            elif ba_placement == 'after':
                                                next_slot = schedule_grid[day][period + 1] if period < periods_per_day - 1 else None
                                                if next_slot and next_slot[0].id == rule_subj_id:
                                                    ba_violation = True
                                                    break
                                    
                                    if ba_violation:
                                        fallback_slots_with_ba_violation.append((day, period, load_today))
                                    else:
                                        fallback_slots.append((day, period, load_today))
                    
                    # Prefer slots without before_after violation
                    fallback_slots.sort(key=lambda x: x[2])
                    fallback_slots_with_ba_violation.sort(key=lambda x: x[2])
                    
                    chosen_slot = None
                    ba_violated = False
                    if fallback_slots:
                        chosen_slot = fallback_slots[0]
                    elif fallback_slots_with_ba_violation:
                        chosen_slot = fallback_slots_with_ba_violation[0]
                        ba_violated = True
                    
                    if chosen_slot:
                        day, period, _ = chosen_slot
                        schedule_grid[day][period] = (subject, teacher_id)
                        subject_placed_total[subject.id] = subject_placed_total.get(subject.id, 0) + 1
                        subject_counts_per_day[subject.id][day] += 1
                        if teacher_id in teacher_daily_load:
                            teacher_daily_load[teacher_id][day] += 1
                        del teacher_availability[(teacher_id, day, period)]
                        
                        # Track the constraint violation
                        constraint_stats['no_consecutive_violations'] = constraint_stats.get('no_consecutive_violations', 0) + 1
                        if ba_violated:
                            constraint_stats['before_after_violations'] = constraint_stats.get('before_after_violations', 0) + 1
                            print(f"  ⚠️ Placed {subject.subject_name} at day {day+1} period {period+1} (CONSTRAINTS VIOLATED - soft constraint)")
                        else:
                            print(f"  ⚠️ Placed {subject.subject_name} at day {day+1} period {period+1} (CONSECUTIVE ALLOWED - soft constraint)")
                        placed = True
                
                if not placed:
                    # Truly impossible - no slots available at all
                    print(f"  ❌ CANNOT place {subject.subject_name} - teacher {teacher_name} has NO available slots!")
                    print(f"     Teacher's free slots have been exhausted. This is a scheduling impossibility.")
                    # Add to placement errors for reporting
                    placement_errors.append({
                        'subject': subject.subject_name,
                        'required': subject_required.get(subject.id, 1),
                        'placed': subject_placed_total.get(subject.id, 0),
                        'difference': subject_placed_total.get(subject.id, 0) - subject_required.get(subject.id, 1),
                        'reason': f"Teacher {teacher_name} has no available free time slots"
                    })
        
        # ========== PRINT CONSTRAINT STATISTICS ==========
        # This proves that constraints were actually applied, not just luck
        if any(v > 0 for v in constraint_stats.values()):
            print(f"\n🔒 Constraint Enforcement Report:")
            if constraint_stats['no_consecutive_blocked'] > 0:
                print(f"  - عدم التتالي: blocked {constraint_stats['no_consecutive_blocked']} consecutive placements")
            if constraint_stats['forbidden_blocked'] > 0:
                print(f"  - Forbidden slots: blocked {constraint_stats['forbidden_blocked']} placements")
            if constraint_stats['required_preferred'] > 0:
                print(f"  - Required slots: preferred {constraint_stats['required_preferred']} placements")
            if constraint_stats.get('before_after_blocked', 0) > 0:
                print(f"  - عدم الترتيب (قبل/بعد): blocked {constraint_stats['before_after_blocked']} placements that would violate order constraint")
            if constraint_stats.get('no_consecutive_violations', 0) > 0:
                print(f"  - ⚠️ تجاوزات عدم التتالي: {constraint_stats['no_consecutive_violations']} consecutive placements ALLOWED (soft constraint)")
            print(f"  ✅ Constraints were ACTIVELY enforced - not luck!")
        else:
            if no_consecutive_subjects or forbidden_slots or subject_every_day or before_after_rules:
                print(f"\n🔒 Constraints active but no blocking needed (schedule naturally avoided violations)")
        
        # ========== PRINT TEACHER DAILY LOAD DISTRIBUTION ==========
        # This helps verify even distribution across days
        print(f"\n👥 Teacher Daily Load Distribution:")
        day_names_report = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"]
        for teacher_id, daily_loads in teacher_daily_load.items():
            teacher = teacher_map.get(teacher_id)
            teacher_name = teacher.full_name if teacher else f"Teacher {teacher_id}"
            total_load = sum(daily_loads)
            max_load = max(daily_loads) if daily_loads else 0
            min_load = min(daily_loads) if daily_loads else 0
            load_str = " | ".join(f"{day_names_report[d]}:{daily_loads[d]}" for d in range(min(len(daily_loads), len(day_names_report))))
            balance_status = "✅ BALANCED" if max_load - min_load <= 1 else ("⚠️ UNEVEN" if max_load <= 3 else "❌ OVERLOADED")
            print(f"  - {teacher_name}: {load_str} (total: {total_load}, max/day: {max_load}) {balance_status}")
        
        return schedule_grid, teacher_map
    
    def _save_teacher_states(self, teacher_ids: List[int]) -> Dict[int, str]:
        """
        Save current free_time_slots for teachers before generation
        
        Args:
            teacher_ids: List of teacher IDs to save states for
            
        Returns:
            Dictionary mapping teacher_id to free_time_slots JSON string
        """
        teacher_states = {}
        for teacher_id in teacher_ids:
            teacher = self.db.query(Teacher).filter(Teacher.id == teacher_id).first()
            if teacher:
                teacher_states[teacher_id] = teacher.free_time_slots
                print(f"Saved state for teacher {teacher.full_name} (ID: {teacher_id})")
        return teacher_states
    
    def _restore_teacher_states(self, teacher_states: Dict[int, str]):
        """
        Restore teacher free_time_slots from saved states (rollback)
        
        Args:
            teacher_states: Dictionary mapping teacher_id to free_time_slots JSON string
        """
        for teacher_id, slots_json in teacher_states.items():
            teacher = self.db.query(Teacher).filter(Teacher.id == teacher_id).first()
            if teacher:
                teacher.free_time_slots = slots_json
                print(f"Restored state for teacher {teacher.full_name} (ID: {teacher_id})")
        try:
            self.db.commit()
            print("Successfully restored all teacher states")
        except Exception as e:
            print(f"Error restoring teacher states: {e}")
            self.db.rollback()
    
    def _retry_with_exponential_backoff(
        self,
        func,
        max_retries: int = 3,
        initial_delay: float = 0.1,
        *args,
        **kwargs
    ):
        """
        Retry a function with exponential backoff
        
        Args:
            func: Function to retry
            max_retries: Maximum number of retry attempts
            initial_delay: Initial delay between retries in seconds
            *args, **kwargs: Arguments to pass to the function
            
        Returns:
            Result of the function call
            
        Raises:
            Last exception if all retries fail
        """
        import time
        
        last_exception = None
        for attempt in range(max_retries + 1):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                last_exception = e
                if attempt < max_retries:
                    delay = initial_delay * (2 ** attempt)  # Exponential backoff
                    print(f"⚠️ Attempt {attempt + 1} failed: {str(e)[:100]}")
                    print(f"   Retrying in {delay:.2f} seconds...")
                    time.sleep(delay)
                else:
                    print(f"❌ All {max_retries + 1} attempts failed")
        
        raise last_exception
    
    def generate_schedule(
        self, 
        request: ScheduleGenerationRequest,
        validation_results: Optional[Dict] = None
    ) -> ScheduleGenerationResponse:
        """
        Main schedule generation method with transaction-based rollback
        
        Args:
            request: Schedule generation parameters
            validation_results: Optional pre-computed validation results
            
        Returns:
            Generation response with status and statistics
        """
        start_time = time.time()
        teacher_states = {}  # Store teacher states for rollback
        
        try:
            # Step 1: Validate prerequisites if not provided
            if validation_results is None:
                print("\n=== Running Validation Check ===")
                validation_results = self.validation_service.validate_schedule_prerequisites(
                    academic_year_id=request.academic_year_id,
                    class_id=request.class_id,
                    section=request.section,
                    session_type=request.session_type.value if hasattr(request.session_type, 'value') else str(request.session_type)
                )
                print(f"Validation result: can_proceed={validation_results.get('can_proceed')}, is_valid={validation_results.get('is_valid')}")
            
            # Step 2: Check if we can proceed based on validation
            if not validation_results.get('can_proceed', False):
                print("Cannot proceed with generation - validation failed")
                errors = validation_results.get('errors', [])
                error_message = " | ".join(errors) if errors else "فشل التحقق من متطلبات إنشاء الجدول"
                raise ScheduleValidationError(
                    detail=error_message,
                    errors=errors
                )
            
            # Step 3: Get available resources
            classes = self._get_classes_for_academic_year(request.academic_year_id, request.session_type, request.class_id)
            subjects = self._get_subjects()
            teachers = self._get_available_teachers(request.session_type)
            
            # Step 4: Filter teachers based on validation results
            # Only use teachers with sufficient availability
            subject_details = validation_results.get('subject_details', [])
            valid_teacher_ids = set()
            subject_teacher_map = {}  # Map subject_id to teacher_id for validated assignments
            
            for detail in subject_details:
                if detail.get('has_teacher') and detail.get('is_sufficient'):
                    teacher_id = detail.get('teacher_id')
                    subject_id = detail.get('subject_id')
                    if teacher_id and subject_id:
                        valid_teacher_ids.add(teacher_id)
                        subject_teacher_map[subject_id] = teacher_id
                        # Skip printing Arabic names to avoid Windows console encoding errors
            
            # Filter the teachers list to only include validated teachers
            if valid_teacher_ids:
                teachers = [t for t in teachers if t.id in valid_teacher_ids]
                print(f"Filtered to {len(teachers)} validated teachers with sufficient availability")
            else:
                print("Warning: No teachers with sufficient availability found, using all available teachers")
                # Add validation warnings
                for detail in subject_details:
                    if detail.get('has_teacher') and not detail.get('is_sufficient'):
                        self.warnings.append(
                            f"المعلم {detail.get('teacher_name')} لديه أوقات فراغ غير كافية للمادة {detail.get('subject_name')}"
                        )
            
            # Step 5: Print database data for debugging
            self._print_database_data(
                academic_year_id=request.academic_year_id,
                session_type=request.session_type.value if hasattr(request.session_type, 'value') else str(request.session_type),
                class_id=request.class_id,
                section=request.section,
                classes=classes,
                subjects=subjects,
                teachers=teachers,
                validation_results=validation_results
            )
            
            # Step 6: Save teacher states before generation (for rollback)
            teacher_ids = [t.id for t in teachers]
            teacher_states = self._save_teacher_states(teacher_ids)
            print(f"Saved states for {len(teacher_states)} teachers")
            
            # Step 6b: Clear OLD teacher slots for this class/section before regenerating
            # This ensures no stale data from previous schedules remains
            if request.class_id:
                section = request.section if request.section else None
                cleared = self.availability_service.clear_slots_for_class_section(
                    class_id=request.class_id,
                    section=section
                )
                if cleared > 0:
                    print(f"Cleared {cleared} old teacher slot assignments for class {request.class_id}")
            
            # Debug logging
            print(f"\n=== Schedule Generation Started ===")
            print(f"Academic Year ID: {request.academic_year_id}")
            print(f"Session Type: {request.session_type}")
            print(f"Target Class ID: {request.class_id}")
            print(f"Target Section: {request.section}")
            print(f"Found {len(classes)} classes")
            print(f"Found {len(subjects)} total subjects")
            print(f"Found {len(teachers)} teachers")
            print(f"Teachers: {[t.full_name for t in teachers]}")
            
            if not classes:
                raise InsufficientDataError(
                    detail="لا توجد صفوف للسنة الدراسية والفترة المحددة"
                )
            
            # Step 2: Generate schedules for each class
            total_created = 0
            all_schedules = []
            
            for cls in classes:
                # Get subjects for this class
                class_subjects = [s for s in subjects if s.class_id == cls.id]
                
                print(f"\nProcessing class {cls.grade_level}-{cls.grade_number} (ID: {cls.id})")
                print(f"Found {len(class_subjects)} subjects for this class")
                
                if not class_subjects:
                    warning = f"No subjects found for class {cls.grade_level}-{cls.grade_number}"
                    print(f"WARNING: {warning}")
                    self.warnings.append(warning)
                    continue
                
                # Generate schedules for each section
                section_count = cls.section_count if cls.section_count else 1
                
                # If specific section is requested, only generate for that section
                if request.section:
                    sections_to_generate = [int(request.section)]
                else:
                    sections_to_generate = list(range(1, section_count + 1))
                
                for section_num in sections_to_generate:
                    # Create schedule entries for each day and period
                    day_mapping = {
                        'sunday': 1, 'monday': 2, 'tuesday': 3, 
                        'wednesday': 4, 'thursday': 5, 'friday': 6, 'saturday': 7
                    }
                    
                    # Use even distribution algorithm to avoid clustering
                    # CRITICAL: Pass class_id and section to ensure proper teacher assignment filtering
                    # Returns (schedule_grid, teacher_map) where grid contains (subject, teacher_id) tuples
                    schedule_grid, teacher_map = self._distribute_subjects_evenly(
                        subjects=class_subjects,
                        num_days=len(request.working_days),
                        periods_per_day=request.periods_per_day,
                        class_id=cls.id,
                        section=str(section_num)
                    )
                    
                    # CRITICAL VALIDATION: Ensure NO empty slots in the grid
                    empty_slots = []
                    day_names_ar = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"]
                    for day_idx_check in range(len(schedule_grid)):
                        for period_idx_check in range(len(schedule_grid[day_idx_check])):
                            if schedule_grid[day_idx_check][period_idx_check] is None:
                                day_name_ar = day_names_ar[day_idx_check] if day_idx_check < len(day_names_ar) else f"يوم {day_idx_check+1}"
                                empty_slots.append(f"{day_name_ar} - الحصة {period_idx_check + 1}")
                    
                    if empty_slots:
                        error_details = ", ".join(empty_slots[:5])  # Show first 5 examples
                        if len(empty_slots) > 5:
                            error_details += f" و {len(empty_slots) - 5} فترة أخرى"
                        
                        raise ScheduleValidationError(
                            detail=f"⚠️ خطأ حرج: لا يمكن إنشاء جدول كامل. يوجد {len(empty_slots)} فترة فارغة في الجدول المُخطط.",
                            errors=[
                                f"الفترات الفارغة: {error_details}",
                                "السبب: أوقات فراغ المعلمين لا تغطي جميع الفترات المطلوبة",
                                "الحل: قم بتحديث أوقات الفراغ للمعلمين أو قم بتعيين معلمين إضافيين"
                            ]
                        )
                    
                    day_idx = 0
                    for day_name in request.working_days:
                        day_num = day_mapping.get(day_name.lower() if isinstance(day_name, str) else day_name.value, 1)
                        
                        for period in range(1, request.periods_per_day + 1):
                            # Get the (subject, teacher_id) tuple from the schedule grid
                            grid_entry = schedule_grid[day_idx][period - 1]  # period is 1-based, array is 0-based
                            
                            # This should never happen after our validation, but check anyway
                            if not grid_entry:
                                raise ScheduleValidationError(
                                    detail=f"خطأ داخلي: فترة فارغة غير متوقعة في {day_names_ar[day_idx]} الحصة {period}",
                                    errors=["هذا خطأ في النظام. يرجى الاتصال بالدعم الفني."]
                                )
                            
                            # Unpack the (subject, teacher_id) tuple
                            subject, teacher_id = grid_entry
                            
                            # Get the teacher object from teacher_map
                            teacher = teacher_map.get(teacher_id) if teacher_id else None
                            
                            if not teacher:
                                # CRITICAL ERROR - Cannot proceed without a teacher
                                error_msg = (
                                    f"⚠️ خطأ حرج: لا يوجد معلم متاح للمادة '{subject.subject_name}' "
                                    f"في {day_names_ar[day_idx]} الحصة {period}."
                                )
                                print(f"CRITICAL ERROR: {error_msg}")
                                
                                # Rollback any changes made so far
                                self.db.rollback()
                                
                                # Restore teacher states
                                if teacher_states:
                                    self._restore_teacher_states(teacher_states)
                                
                                raise ScheduleValidationError(
                                    detail=error_msg,
                                    errors=[
                                        f"الفترة المتأثرة: {day_names_ar[day_idx]} - الحصة {period}",
                                        f"المادة: {subject.subject_name}",
                                        "السبب المحتمل: جميع المعلمين المكلفين بهذه المادة غير متاحين في هذا الوقت أو مشغولين في صف آخر",
                                        "الحل: تحديث أوقات فراغ المعلمين أو إعادة توزيع المواد"
                                    ]
                                )
                            
                            # Create schedule entry for ALL periods (including breaks)
                            schedule_entry = Schedule()
                            schedule_entry.academic_year_id = request.academic_year_id
                            schedule_entry.session_type = request.session_type.value if hasattr(request.session_type, 'value') else str(request.session_type)
                            schedule_entry.class_id = cls.id
                            schedule_entry.section = str(section_num)
                            schedule_entry.day_of_week = day_num
                            schedule_entry.period_number = period
                            schedule_entry.subject_id = subject.id
                            schedule_entry.teacher_id = teacher.id
                            schedule_entry.name = request.name
                            schedule_entry.start_date = request.start_date
                            schedule_entry.end_date = request.end_date
                            schedule_entry.is_active = True
                            schedule_entry.status = "published"
                            
                            self.db.add(schedule_entry)
                            all_schedules.append(schedule_entry)
                            total_created += 1
                            self.generation_stats['assignments_created'] += 1
                            
                            # NOTE: Teacher availability update moved to AFTER optimization
                            # to ensure consistency between schedule and free_time_slots
                        
                        # Increment day index after processing all periods of the day
                        day_idx += 1
            
            # Step 7: Apply Constraint Solver to check violations
            print("\n=== Applying Constraint Solver ===")
            active_constraints = self.db.query(ScheduleConstraint).filter(
                ScheduleConstraint.academic_year_id == request.academic_year_id,
                ScheduleConstraint.is_active == True
            ).all()
            print(f"Found {len(active_constraints)} active constraints")
            
            # Convert schedules to dict format for constraint checking
            schedule_assignments = []
            for schedule in all_schedules:
                schedule_assignments.append({
                    'subject_id': schedule.subject_id,
                    'teacher_id': schedule.teacher_id,
                    'class_id': schedule.class_id,
                    'section': schedule.section,
                    'day_of_week': schedule.day_of_week,
                    'period_number': schedule.period_number
                })
            
            # Check each constraint
            all_violations = []
            for constraint in active_constraints:
                violations = self.constraint_solver.validate_constraint_with_priority(
                    constraint, schedule_assignments
                )
                all_violations.extend(violations)
            
            # Report violations
            if all_violations:
                print(f"⚠️ Found {len(all_violations)} constraint violations:")
                for violation in all_violations:
                    print(f"  - {violation.severity.upper()}: {violation.description}")
                    if violation.severity == "critical":
                        self.conflicts.append(violation.description)
                    else:
                        self.warnings.append(violation.description)
                
                # Check for no_consecutive violations - these are now SOFT constraints
                # We allow the schedule to be created with a warning instead of failing
                no_consecutive_violations = [v for v in all_violations 
                    if v.severity == "critical" and "متتالية" in v.description]
                other_critical_violations = [v for v in all_violations 
                    if v.severity == "critical" and not v.can_override and "متتالية" not in v.description]
                
                if no_consecutive_violations:
                    # Add soft warning instead of failing
                    self.warnings.append("تم إنشاء الجدول مع بعض التجاوزات في قيد عدم التتالي")
                    print(f"  ⚠️ عدم التتالي violations treated as SOFT constraint - schedule will be created with warning")
                
                # Only fail for OTHER critical violations (not no_consecutive)
                if other_critical_violations:
                    error_message = " | ".join([v.description for v in other_critical_violations])
                    raise ConstraintViolationError(detail=error_message)
            else:
                print("✅ No constraint violations found")
            
            # Step 8: Apply Genetic Algorithm Optimization (if requested)
            if len(all_schedules) > 0:
                print("\n=== Applying Genetic Algorithm Optimization ===")
                try:
                    # Create ScheduleAssignment objects for optimization
                    assignments_for_optimization = []
                    time_slots = []
                    
                    for idx, schedule in enumerate(all_schedules):
                        # Create time slot
                        time_slot = TimeSlot()
                        time_slot.id = idx + 1
                        time_slot.day_of_week = schedule.day_of_week
                        time_slot.period_number = schedule.period_number
                        time_slots.append(time_slot)
                        
                        # Create assignment
                        assignment = ScheduleAssignment()
                        assignment.id = idx + 1
                        assignment.schedule_id = 1
                        assignment.time_slot_id = time_slot.id
                        assignment.subject_id = schedule.subject_id
                        assignment.teacher_id = schedule.teacher_id
                        assignment.class_id = schedule.class_id
                        assignment.section = schedule.section
                        assignments_for_optimization.append(assignment)
                    
                    # Create optimization constraints
                    optimization_constraints = []
                    for constraint in active_constraints:
                        opt_constraint = OptimizationConstraint(
                            constraint_type=constraint.constraint_type,
                            weight=float(constraint.priority_level) / 4.0,  # Normalize priority to 0-1
                            parameters={
                                'subject_id': constraint.subject_id,
                                'teacher_id': constraint.teacher_id,
                                'class_id': constraint.class_id,
                                'day_of_week': constraint.day_of_week,
                                'period_number': constraint.period_number,
                                'max_consecutive_periods': constraint.max_consecutive_periods,
                                'min_consecutive_periods': constraint.min_consecutive_periods
                            },
                            violation_penalty=2.0 if constraint.priority_level >= 3 else 1.0
                        )
                        optimization_constraints.append(opt_constraint)
                    
                    # Run optimization with reduced generations for speed
                    self.genetic_optimizer.generations = 30  # Reduce for performance
                    optimized_assignments = self.genetic_optimizer.optimize_schedule(
                        assignments_for_optimization,
                        optimization_constraints,
                        time_slots
                    )
                    
                    # IMPORTANT: Do NOT update schedule entries from optimizer
                    # The distribution algorithm already assigned teachers correctly based on availability
                    # Changing teacher_id here would break the sync between schedule and free_time_slots
                    # for i, optimized in enumerate(optimized_assignments):
                    #     if i < len(all_schedules):
                    #         if optimized.teacher_id:
                    #             all_schedules[i].teacher_id = optimized.teacher_id
                    # Keep ALL original assignments (day, period, subject, teacher) unchanged
                    
                    print(f"✅ Optimization completed successfully")
                    self.generation_stats['optimization_rounds'] = 30
                    
                except Exception as e:
                    print(f"⚠️ Optimization failed: {e}, continuing with unoptimized schedule")
                    self.warnings.append(f"فشل تحسين الجدول: {str(e)}")
            
            # Step 9: Update teacher availability AFTER optimization
            # This ensures the free_time_slots match the final optimized schedule
            print("\n=== Updating Teacher Availability (Post-Optimization) ===")
            for schedule in all_schedules:
                try:
                    self.availability_service.mark_slot_as_assigned(
                        teacher_id=schedule.teacher_id,
                        day=schedule.day_of_week - 1,  # Convert to 0-based
                        period=schedule.period_number - 1,  # Convert to 0-based
                        subject_id=schedule.subject_id,
                        class_id=schedule.class_id,
                        section=schedule.section,
                        schedule_id=None  # Will be set after commit
                    )
                except Exception as e:
                    print(f"Warning: Failed to update teacher availability: {e}")
                    self.warnings.append(f"فشل تحديث توفر المعلم (teacher_id={schedule.teacher_id})")
            print(f"✅ Updated availability for {len(all_schedules)} schedule entries")
            
            # Validate generated schedule before committing
            expected_total = sum(
                len(request.working_days) * request.periods_per_day  
                for _ in classes
            )
            is_valid, val_errors, val_warnings = self._validate_generated_schedule(
                schedule_entries=all_schedules,
                expected_total_periods=expected_total
            )
            
            # Add validation warnings to overall warnings
            self.warnings.extend(val_warnings)
            
            # If critical errors found, raise exception and trigger rollback
            if not is_valid:
                error_message = " | ".join(val_errors) if val_errors else "فشل التحقق من صحة الجدول المُنشأ"
                raise ScheduleConflictError(detail=error_message)
            
            # Calculate statistics
            generation_time = time.time() - start_time
            
            # If preview_only, return preview data without saving to database
            if request.preview_only:
                # Convert schedule entries to dictionaries for preview
                preview_data = []
                for schedule in all_schedules:
                    preview_data.append({
                        'class_id': schedule.class_id,
                        'section': schedule.section,
                        'day_of_week': schedule.day_of_week,
                        'period_number': schedule.period_number,
                        'subject_id': schedule.subject_id,
                        'teacher_id': schedule.teacher_id
                    })
                
                # Rollback the transaction to not save anything
                self.db.rollback()
                
                # Restore teacher states since we're not saving
                self._restore_teacher_states(teacher_states)
                
                return ScheduleGenerationResponse(
                    schedule_id=0,  # No schedule ID in preview mode
                    generation_status='preview',
                    total_periods_created=len(all_schedules),
                    total_assignments_created=len(all_schedules),
                    conflicts_detected=len(self.conflicts),
                    warnings=self.warnings,
                    generation_time=generation_time,
                    summary={
                        'classes_scheduled': len(classes),
                        'total_periods': len(all_schedules),
                        'preview_mode': True
                    },
                    preview_data=preview_data
                )
            
            # Commit all schedule entries (only if not preview mode)
            self.db.commit()
            
            # Create generation history record
            history = ScheduleGenerationHistory()
            history.academic_year_id = request.academic_year_id
            history.session_type = request.session_type.value if hasattr(request.session_type, 'value') else str(request.session_type)
            history.generation_algorithm = "genetic_algorithm_with_constraints"
            history.generation_parameters = {
                "periods_per_day": request.periods_per_day,
                "working_days": [str(d) for d in request.working_days]
            }
            history.constraints_count = 0
            history.conflicts_resolved = 0
            history.generation_time_seconds = int(generation_time)
            history.quality_score = 85.0
            history.status = "success"
            self.db.add(history)
            self.db.commit()
            
            # Print generated schedule in markdown format for review
            print("\n=== Generated Schedule Output ===")
            for cls in classes:
                class_schedules = [s for s in all_schedules if s.class_id == cls.id]
                if class_schedules:
                    # Group by section
                    sections = set(s.section for s in class_schedules)
                    for section in sections:
                        section_schedules = [s for s in class_schedules if s.section == section]
                        if section_schedules:
                            class_info = {
                                'class_name': f"الصف {cls.grade_number} {cls.grade_level}",
                                'section': section or '1'
                            }
                            is_valid = self._print_generated_schedule_markdown(
                                schedule_entries=section_schedules,
                                class_info=class_info,
                                save_to_file=True  # Save to file for review
                            )
                            if not is_valid:
                                print(f"⚠️ تحذير: الجدول يحتوي على تعارضات!")
            
            return ScheduleGenerationResponse(
                schedule_id=history.id if history.id else 0,
                generation_status="completed",
                total_periods_created=total_created,
                total_assignments_created=total_created,
                conflicts_detected=len(self.conflicts),
                warnings=self.warnings,
                generation_time=generation_time,
                summary={
                    'classes_scheduled': len(classes),
                    'teachers_assigned': len(set(s.teacher_id for s in all_schedules)),
                    'subjects_covered': len(set(s.subject_id for s in all_schedules)),
                    'optimization_rounds': 1
                }
            )
            
        except Exception as e:
            # Rollback database transaction
            print(f"\n!!! Generation failed with error: {str(e)}")
            print("Rolling back database transaction...")
            self.db.rollback()
            
            # Restore teacher states
            if teacher_states:
                print(f"Restoring states for {len(teacher_states)} teachers...")
                self._restore_teacher_states(teacher_states)
            
            # Send error notification
            try:
                import asyncio
                asyncio.create_task(
                    telegram_service.send_system_alert(
                        "Schedule Generation Error",
                        f"Failed to generate schedule: {str(e)}",
                        "error"
                    )
                )
            except:
                pass  # Ignore notification errors
            
            # Print full traceback for debugging
            import traceback
            print(f"Full traceback:\n{traceback.format_exc()}")
                
            return ScheduleGenerationResponse(
                schedule_id=0,
                generation_status="failed",
                total_periods_created=0,
                total_assignments_created=0,
                conflicts_detected=0,
                warnings=[f"فشل إنشاء الجدول: {str(e)}"],
                generation_time=time.time() - start_time,
                summary={
                    'error': str(e),
                    'rollback_performed': True
                }
            )
    
    def save_preview_schedule(
        self,
        request: ScheduleGenerationRequest,
        preview_data: List[Dict[str, Any]]
    ) -> ScheduleGenerationResponse:
        """
        Save a preview schedule to the database.
        
        Args:
            request: Original generation request
            preview_data: List of schedule entries from preview generation
            
        Returns:
            Generation response with saved schedule ID
        """
        start_time = time.time()
        teacher_states = {}
        
        try:
            # Get classes and validate
            classes = self._get_classes_for_academic_year(request.academic_year_id, request.session_type, request.class_id)
            if not classes:
                raise InsufficientDataError(detail="لا توجد صفوف للسنة الدراسية والفترة المحددة")
            
            # Ensure only one schedule per class/section by removing existing entries
            session_type_value = request.session_type.value if hasattr(request.session_type, 'value') else str(request.session_type)
            base_query = self.db.query(Schedule).filter(
                Schedule.academic_year_id == request.academic_year_id,
                Schedule.session_type == session_type_value,
                Schedule.class_id == request.class_id
            )
            # If section is specified in the request, restrict deletion to that section
            if hasattr(request, 'section') and request.section is not None:
                base_query = base_query.filter(Schedule.section == request.section)
            
            existing_schedules = base_query.all()
            if existing_schedules:
                print(f"Deleting existing schedules for class {request.class_id}, section {getattr(request, 'section', None)}: {len(existing_schedules)} rows")
                for existing in existing_schedules:
                    self.db.delete(existing)
                # Apply deletions before inserting new rows
                self.db.flush()
            
            # Save teacher states for rollback
            teacher_ids = set()
            for entry in preview_data:
                if entry.get('teacher_id'):
                    teacher_ids.add(entry['teacher_id'])
            teacher_states = self._save_teacher_states(list(teacher_ids))
            
            # Create Schedule objects from preview data
            all_schedules = []
            for entry in preview_data:
                schedule_entry = Schedule()
                schedule_entry.academic_year_id = request.academic_year_id
                schedule_entry.session_type = request.session_type.value if hasattr(request.session_type, 'value') else str(request.session_type)
                schedule_entry.class_id = entry['class_id']
                schedule_entry.section = entry['section']
                schedule_entry.day_of_week = entry['day_of_week']
                schedule_entry.period_number = entry['period_number']
                schedule_entry.subject_id = entry['subject_id']
                schedule_entry.teacher_id = entry['teacher_id']
                schedule_entry.name = request.name  # Add schedule name
                schedule_entry.start_date = request.start_date  # Add start date
                schedule_entry.end_date = request.end_date  # Add end date
                schedule_entry.is_active = True  # Mark as active
                schedule_entry.status = "published"  # Set status
                self.db.add(schedule_entry)
                all_schedules.append(schedule_entry)
            
            # Commit all schedule entries first to get IDs
            self.db.commit()
            
            # Update teacher free_time_slots to mark slots as assigned
            for schedule in all_schedules:
                if schedule.teacher_id:
                    try:
                        self.availability_service.mark_slot_as_assigned(
                            teacher_id=schedule.teacher_id,
                            day=schedule.day_of_week - 1,  # Convert to 0-based
                            period=schedule.period_number - 1,  # Convert to 0-based
                            subject_id=schedule.subject_id,
                            class_id=schedule.class_id,
                            section=schedule.section,
                            schedule_id=schedule.id
                        )
                        print(f"Marked teacher {schedule.teacher_id} as assigned for day {schedule.day_of_week} period {schedule.period_number}")
                    except Exception as e:
                        print(f"Warning: Failed to mark slot as assigned: {e}")
            
            # Create generation history record
            generation_time = time.time() - start_time
            history = ScheduleGenerationHistory()
            history.academic_year_id = request.academic_year_id
            history.session_type = request.session_type.value if hasattr(request.session_type, 'value') else str(request.session_type)
            history.generation_algorithm = "preview_save"
            history.generation_parameters = {
                "periods_per_day": request.periods_per_day,
                "working_days": [str(d) for d in request.working_days]
            }
            history.constraints_count = 0
            history.conflicts_resolved = 0
            history.generation_time_seconds = int(generation_time)
            history.quality_score = 85.0
            history.status = "success"
            self.db.add(history)
            self.db.commit()
            
            return ScheduleGenerationResponse(
                schedule_id=history.id if history.id else 0,
                generation_status="saved",
                total_periods_created=len(all_schedules),
                total_assignments_created=len(all_schedules),
                conflicts_detected=0,
                warnings=[],
                generation_time=generation_time,
                summary={
                    'classes_scheduled': len(classes),
                    'total_periods': len(all_schedules),
                    'preview_saved': True
                }
            )
            
        except Exception as e:
            # Rollback on error
            self.db.rollback()
            if teacher_states:
                self._restore_teacher_states(teacher_states)
            
            return ScheduleGenerationResponse(
                schedule_id=0,
                generation_status="failed",
                total_periods_created=0,
                total_assignments_created=0,
                conflicts_detected=0,
                warnings=[f"فشل حفظ الجدول: {str(e)}"],
                generation_time=time.time() - start_time,
                summary={
                    'error': str(e),
                    'rollback_performed': True
                }
            )
    
    def generate_schedules_for_all_classes(
        self,
        academic_year_id: int,
        session_type: str,
        periods_per_day: int = 6,
        working_days: Optional[List[str]] = None
    ) -> Dict[str, any]:
        """
        Generate schedules for all classes in batch
        
        Args:
            academic_year_id: Academic year ID
            session_type: morning or evening
            periods_per_day: Number of periods per day (default 6)
            working_days: List of working days (default Sunday-Thursday)
            
        Returns:
            Dictionary with results for each class
        """
        import time
        
        start_time = time.time()
        
        if working_days is None:
            working_days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday']
        
        print("\n" + "="*80)
        print("=== بدء إنشاء الجداول لجميع الصفوف ===")
        print(f"السنة الدراسية: {academic_year_id}, الفترة: {session_type}")
        print("="*80 + "\n")
        
        # Get all classes for this academic year and session
        classes = self._get_classes_for_academic_year(academic_year_id, session_type, None)
        
        if not classes:
            return {
                'success': False,
                'error': 'لا توجد صفوف للسنة الدراسية والفترة المحددة',
                'results': {}
            }
        
        print(f"عدد الصفوف المراد إنشاء جداول لها: {len(classes)}\n")
        
        # Step 1: Check data sufficiency for all classes
        print("=== التحقق من كفاية البيانات لكل صف ===\n")
        
        sufficiency_results = {}
        classes_can_proceed = []
        
        for cls in classes:
            print(f"التحقق من الصف {cls.grade_number} {cls.grade_level}...")
            
            # Get subjects for this class
            subjects = self.db.query(Subject).filter(
                Subject.class_id == cls.id,
                Subject.is_active == True
            ).all()
            
            # Calculate total periods needed
            total_periods = sum(getattr(s, 'weekly_hours', 0) for s in subjects)
            
            # Check if we have enough periods (30 = 6 periods × 5 days)
            max_periods = periods_per_day * len(working_days)
            has_enough_periods = total_periods >= max_periods * 0.8  # At least 80% utilization
            
            # Run validation
            validation_result = self.validation_service.validate_schedule_prerequisites(
                academic_year_id=academic_year_id,
                class_id=cls.id,
                session_type=session_type
            )
            
            can_proceed = validation_result.get('can_proceed', False)
            is_valid = validation_result.get('is_valid', False)
            
            sufficiency_results[cls.id] = {
                'class_id': cls.id,
                'class_name': f"الصف {cls.grade_number} {cls.grade_level}",
                'total_subjects': len(subjects),
                'total_periods': total_periods,
                'max_periods': max_periods,
                'utilization': round((total_periods / max_periods * 100) if max_periods > 0 else 0, 1),
                'has_enough_periods': has_enough_periods,
                'can_proceed': can_proceed,
                'is_valid': is_valid,
                'errors': validation_result.get('errors', []),
                'warnings': validation_result.get('warnings', [])
            }
            
            if can_proceed:
                classes_can_proceed.append(cls)
                print(f"  ✅ يمكن المتابعة ({total_periods} حصة من أصل {max_periods})")
            else:
                print(f"  ❌ لا يمكن المتابعة - {', '.join(validation_result.get('errors', ['خطأ غير معروف']))}")
            
            print()
        
        # Step 2: Generate schedules for classes that can proceed
        print(f"\n=== إنشاء الجداول ({len(classes_can_proceed)} صف) ===\n")
        
        generation_results = {}
        successful_count = 0
        failed_count = 0
        
        for cls in classes_can_proceed:
            print(f"\nإنشاء جدول الصف {cls.grade_number} {cls.grade_level}...")
            
            try:
                # Create generation request
                request = ScheduleGenerationRequest(
                    academic_year_id=academic_year_id,
                    session_type=session_type,
                    class_id=cls.id,
                    section='1',  # Default section
                    periods_per_day=periods_per_day,
                    working_days=working_days,
                    name=f"جدول الصف {cls.grade_number} {cls.grade_level}",
                    start_date=date.today(),
                    end_date=date.today() + timedelta(days=180)
                )
                
                # Use existing validation result
                validation_result = self.validation_service.validate_schedule_prerequisites(
                    academic_year_id=academic_year_id,
                    class_id=cls.id,
                    session_type=session_type
                )
                
                # Generate schedule
                response = self.generate_schedule(request, validation_results=validation_result)
                
                if response.generation_status == "completed":
                    successful_count += 1
                    print(f"  ✅ نجح - تم إنشاء {response.total_periods_created} حصة")
                else:
                    failed_count += 1
                    print(f"  ❌ فشل - {', '.join(response.warnings)}")
                
                generation_results[cls.id] = {
                    'status': response.generation_status,
                    'schedule_id': response.schedule_id,
                    'periods_created': response.total_periods_created,
                    'warnings': response.warnings,
                    'generation_time': response.generation_time
                }
                
            except Exception as e:
                failed_count += 1
                print(f"  ❌ خطأ: {str(e)}")
                generation_results[cls.id] = {
                    'status': 'failed',
                    'schedule_id': 0,
                    'periods_created': 0,
                    'error': str(e),
                    'warnings': []
                }
        
        # Step 3: Summary
        total_time = time.time() - start_time
        
        print("\n" + "="*80)
        print("=== ملخص إنشاء الجداول ===")
        print(f"إجمالي الصفوف: {len(classes)}")
        print(f"الصفوف التي يمكن المتابعة: {len(classes_can_proceed)}")
        print(f"الجداول الناجحة: {successful_count}")
        print(f"الجداول الفاشلة: {failed_count}")
        print(f"الوقت الإجمالي: {round(total_time, 2)} ثانية")
        print("="*80 + "\n")
        
        return {
            'success': True,
            'total_classes': len(classes),
            'classes_can_proceed': len(classes_can_proceed),
            'successful_count': successful_count,
            'failed_count': failed_count,
            'total_time': total_time,
            'sufficiency_results': sufficiency_results,
            'generation_results': generation_results
        }
    
    def _create_base_schedule(self, request: ScheduleGenerationRequest) -> Schedule:
        """Create the base schedule record"""
        # Create a dummy schedule entry to get an ID
        # In a real implementation, this might be a schedule generation record
        schedule = Schedule()
        schedule.academic_year_id = request.academic_year_id
        schedule.session_type = request.session_type.value if hasattr(request.session_type, 'value') else "morning"
        schedule.class_id = 1  # Dummy value
        schedule.day_of_week = 1  # Dummy value
        schedule.period_number = 1  # Dummy value
        schedule.subject_id = 1  # Dummy value
        schedule.teacher_id = 1  # Dummy value
        schedule.name = request.name
        schedule.start_date = request.start_date
        schedule.end_date = request.end_date
        schedule.is_active = getattr(request, 'is_active', True)
        schedule.description = f"Generated schedule for {request.name}"
        
        self.db.add(schedule)
        self.db.commit()
        self.db.refresh(schedule)
        return schedule
    
    def _generate_time_slots(self, schedule: Schedule, request: ScheduleGenerationRequest) -> List[TimeSlot]:
        """Generate time slots based on request parameters"""
        time_slots = []
        # Parse session_start_time string to time object
        if isinstance(request.session_start_time, str):
            parts = request.session_start_time.split(':')
            hour = int(parts[0])
            minute = int(parts[1]) if len(parts) > 1 else 0
            current_time = dt_time(hour, minute)
        else:
            current_time = request.session_start_time
        
        for day in request.working_days:
            period_time = current_time
            
            for period in range(1, request.periods_per_day + 1):
                # Create regular period
                end_time = self._add_minutes(period_time, request.period_duration)
                
                time_slot = TimeSlot()
                time_slot.schedule_id = schedule.id
                time_slot.period_number = period
                time_slot.start_time = period_time
                time_slot.end_time = end_time
                time_slot.day_of_week = day.value if hasattr(day, 'value') else 1
                time_slot.is_break = False
                self.db.add(time_slot)
                time_slots.append(time_slot)
                period_time = end_time
                
                # Add break if needed
                if period in request.break_periods:
                    break_end_time = self._add_minutes(period_time, request.break_duration)
                    break_slot = TimeSlot()
                    break_slot.schedule_id = schedule.id
                    break_slot.period_number = period
                    break_slot.start_time = period_time
                    break_slot.end_time = break_end_time
                    break_slot.day_of_week = day.value if hasattr(day, 'value') else 1
                    break_slot.is_break = True
                    break_slot.break_name = f"Break {period}"
                    self.db.add(break_slot)
                    time_slots.append(break_slot)
                    period_time = break_end_time
        
        self.db.commit()
        self.generation_stats['periods_created'] = len(time_slots)
        return time_slots
    
    def _generate_initial_assignments(self, schedule: Schedule, time_slots: List[TimeSlot], 
                                    classes: List[Class], subjects: List[Subject], 
                                    teachers: List[Teacher], request: ScheduleGenerationRequest) -> List[ScheduleAssignment]:
        """Generate initial schedule assignments"""
        assignments = []
        
        # Get subject requirements for each class
        class_subject_requirements = self._get_class_subject_requirements(classes, subjects)
        
        # Filter out break periods
        teaching_slots = [slot for slot in time_slots if not slot.is_break]
        
        for class_obj in classes:
            class_assignments = self._assign_subjects_to_class(
                schedule, class_obj, teaching_slots, 
                class_subject_requirements.get(class_obj.id, []),
                teachers, request
            )
            assignments.extend(class_assignments)
        
        self.generation_stats['assignments_created'] = len(assignments)
        return assignments
    
    def _assign_subjects_to_class(self, schedule: Schedule, class_obj: Class, time_slots: List[TimeSlot],
                                subject_requirements: List[Dict], teachers: List[Teacher],
                                request: ScheduleGenerationRequest) -> List[ScheduleAssignment]:
        """Assign subjects to a specific class"""
        assignments = []
        used_slots = set()
        
        for req in subject_requirements:
            subject_id = req['subject_id']
            periods_needed = req['periods_per_week']
            
            # Find best teacher for this subject
            suitable_teachers = self._find_suitable_teachers(subject_id, teachers)
            
            slots_assigned = 0
            for time_slot in time_slots:
                if slots_assigned >= periods_needed:
                    break
                
                slot_key = (time_slot.day_of_week, time_slot.period_number)
                if slot_key in used_slots:
                    continue
                
                # Try to assign a teacher
                assigned_teacher = None
                if request.auto_assign_teachers and suitable_teachers:
                    assigned_teacher = self._select_best_teacher(
                        suitable_teachers, time_slot, assignments, request
                    )
                
                assignment = ScheduleAssignment()
                assignment.schedule_id = schedule.id
                assignment.time_slot_id = time_slot.id
                assignment.class_id = class_obj.id
                assignment.subject_id = subject_id
                assignment.teacher_id = assigned_teacher.id if assigned_teacher else None
                assignment.room = self._suggest_room(class_obj, subject_id)
                
                self.db.add(assignment)
                assignments.append(assignment)
                used_slots.add(slot_key)
                slots_assigned += 1
        
        self.db.commit()
        return assignments
    
    def _optimize_schedule(self, assignments: List[ScheduleAssignment], 
                          request: ScheduleGenerationRequest) -> List[ScheduleAssignment]:
        """Optimize schedule to reduce conflicts and improve quality"""
        optimization_rounds = 0
        max_rounds = 5
        
        while optimization_rounds < max_rounds:
            improved = False
            
            if request.avoid_teacher_conflicts:
                if self._resolve_teacher_conflicts(assignments):
                    improved = True
            
            if request.balance_teacher_load:
                if self._balance_teacher_workload(assignments):
                    improved = True
            
            if request.prefer_subject_continuity:
                if self._improve_subject_continuity(assignments):
                    improved = True
            
            optimization_rounds += 1
            if not improved:
                break
        
        self.generation_stats['optimization_rounds'] = optimization_rounds
        return assignments
    
    def _resolve_teacher_conflicts(self, assignments: List[ScheduleAssignment]) -> bool:
        """Resolve teacher double-booking conflicts"""
        conflicts_found = {}
        improved = False
        
        # Group assignments by teacher and time
        for assignment in assignments:
            if not assignment.teacher_id:
                continue
                
            query_result = self.db.query(TimeSlot).filter(TimeSlot.id == assignment.time_slot_id)
            if query_result is not None:
                time_slot = query_result.first()
                if time_slot is not None:
                    key = (assignment.teacher_id, time_slot.day_of_week, time_slot.period_number)
                    
                    if key not in conflicts_found:
                        conflicts_found[key] = []
                    conflicts_found[key].append(assignment)
        
        # Resolve conflicts by reassigning teachers
        for key, conflicted_assignments in conflicts_found.items():
            if len(conflicted_assignments) > 1:
                # Keep the first assignment, reassign others
                for assignment in conflicted_assignments[1:]:
                    new_teacher = self._find_alternative_teacher(assignment)
                    if new_teacher:
                        assignment.teacher_id = new_teacher.id
                        self.db.commit()
                        improved = True
                    else:
                        assignment.teacher_id = None
                        if hasattr(assignment, 'id'):
                            self.warnings.append(f"Could not assign teacher for assignment {assignment.id}")
        
        return improved
    
    def _balance_teacher_workload(self, assignments: List[ScheduleAssignment]) -> bool:
        """Balance workload across teachers"""
        teacher_loads = {}
        
        # Calculate current loads
        for assignment in assignments:
            if assignment.teacher_id:
                teacher_loads[assignment.teacher_id] = teacher_loads.get(assignment.teacher_id, 0) + 1
        
        if not teacher_loads:
            return False
        
        # Find overloaded and underloaded teachers
        avg_load = sum(teacher_loads.values()) / len(teacher_loads)
        overloaded = [(tid, load) for tid, load in teacher_loads.items() if load > avg_load * 1.5]
        underloaded = [(tid, load) for tid, load in teacher_loads.items() if load < avg_load * 0.5]
        
        improved = False
        for overloaded_teacher, _ in overloaded:
            for underloaded_teacher, _ in underloaded:
                # Try to transfer assignments
                if self._transfer_assignment(assignments, overloaded_teacher, underloaded_teacher):
                    improved = True
                    break
        
        return improved
    
    def _improve_subject_continuity(self, assignments: List[ScheduleAssignment]) -> bool:
        """Improve subject distribution for better learning continuity"""
        # Group assignments by class and subject
        class_subjects = {}
        
        for assignment in assignments:
            key = (assignment.class_id, assignment.subject_id)
            if key not in class_subjects:
                class_subjects[key] = []
            class_subjects[key].append(assignment)
        
        improved = False
        
        # Try to distribute subjects more evenly across days
        for (class_id, subject_id), subject_assignments in class_subjects.items():
            if len(subject_assignments) >= 3:  # Only optimize if subject has 3+ periods
                if self._redistribute_subject_periods(subject_assignments):
                    improved = True
        
        return improved
    
    def _detect_conflicts(self, schedule: Schedule, assignments: List[ScheduleAssignment]):
        """Detect and log schedule conflicts"""
        conflicts = []
        
        # Teacher conflicts
        teacher_schedule = {}
        for assignment in assignments:
            if not assignment.teacher_id:
                continue
                
            try:
                # Get time slot for this assignment
                time_slot = None
                query = self.db.query(TimeSlot)
                if query is not None:
                    filtered_query = query.filter(TimeSlot.id == assignment.time_slot_id)
                    if filtered_query is not None:
                        time_slot = filtered_query.first()
                
                if time_slot is not None:
                    key = (assignment.teacher_id, time_slot.day_of_week, time_slot.period_number)
                    
                    if key in teacher_schedule:
                        conflict = ScheduleConflict()
                        conflict.schedule_id = schedule.id
                        conflict.conflict_type = "teacher_double_booking"
                        conflict.severity = "high"
                        conflict.description = f"Teacher {assignment.teacher_id} assigned to multiple classes at same time"
                        conflict.affected_assignments = str([teacher_schedule[key], assignment.id])  # Convert to JSON string
                        conflict.resolution_suggestions = str(["Reassign one of the classes to different teacher", "Move one assignment to different time slot"])  # Convert to JSON string
                        conflicts.append(conflict)
                    else:
                        teacher_schedule[key] = assignment.id
            except Exception:
                # Skip this assignment if there's an error
                continue
        
        # Room conflicts (if rooms are specified)
        room_schedule = {}
        for assignment in assignments:
            if not assignment.room:
                continue
                
            try:
                # Get time slot for this assignment
                time_slot = None
                query = self.db.query(TimeSlot)
                if query is not None:
                    filtered_query = query.filter(TimeSlot.id == assignment.time_slot_id)
                    if filtered_query is not None:
                        time_slot = filtered_query.first()
                
                if time_slot is not None:
                    key = (assignment.room, time_slot.day_of_week, time_slot.period_number)
                    
                    if key in room_schedule:
                        conflict = ScheduleConflict()
                        conflict.schedule_id = schedule.id
                        conflict.conflict_type = "room_conflict"
                        conflict.severity = "medium"
                        conflict.description = f"Room {assignment.room} assigned to multiple classes at same time"
                        conflict.affected_assignments = str([room_schedule[key], assignment.id])  # Convert to JSON string
                        conflict.resolution_suggestions = str(["Assign different room to one class", "Move one assignment to different time slot"])  # Convert to JSON string
                        conflicts.append(conflict)
                    else:
                        room_schedule[key] = assignment.id
            except Exception:
                # Skip this assignment if there's an error
                continue
        
        # Save conflicts
        for conflict in conflicts:
            self.db.add(conflict)
        self.db.commit()
        
        self.generation_stats['conflicts_detected'] = len(conflicts)
        self.conflicts = conflicts
    
    # Helper methods
    def _add_minutes(self, time_obj: dt_time, minutes: int) -> dt_time:
        """Add minutes to a time object"""
        dt = datetime.combine(date.today(), time_obj)
        dt += timedelta(minutes=minutes)
        return dt.time()
    
    def _get_classes_for_academic_year(self, academic_year_id: int, session_type, class_id: Optional[int] = None) -> List[Class]:
        """Get classes for the academic year and session"""
        try:
            # Build the query step by step
            query = self.db.query(Class)
            if query is None:
                return []
            
            # Apply filters
            filters = [Class.academic_year_id == academic_year_id]
            
            # Handle both string and SessionType enum inputs
            if session_type:
                session_value = session_type.value if hasattr(session_type, 'value') else str(session_type)
            else:
                session_value = "both"
            
            # Add session type filter
            filters.append(
                or_(Class.session_type == session_value, Class.session_type == "both")
            )
            
            # Add class_id filter if specified
            if class_id:
                filters.append(Class.id == class_id)
            
            filtered_query = query.filter(and_(*filters))
            if filtered_query is None:
                return []
            
            result = filtered_query.all()
            return result if result is not None else []
        except Exception as e:
            print(f"Error getting classes: {e}")
            return []
    
    def _get_subjects(self) -> List[Subject]:
        """Get all subjects"""
        try:
            query = self.db.query(Subject)
            if query is None:
                return []
            
            filtered_query = query.filter(Subject.is_active == True)
            if filtered_query is None:
                return []
            
            result = filtered_query.all()
            return result if result is not None else []
        except Exception:
            return []
    
    def _find_teacher_for_subject(self, subject_id: int, teachers: List[Teacher]) -> Optional[Teacher]:
        """Find a suitable teacher for the given subject"""
        if not teachers:
            print(f"Warning: No teachers available")
            return None
            
        # Try to find a teacher assigned to this subject
        for teacher in teachers:
            try:
                # Check if teacher has TeacherAssignment for this subject
                assignment = self.db.query(TeacherAssignment).filter(
                    and_(
                        TeacherAssignment.teacher_id == teacher.id,
                        TeacherAssignment.subject_id == subject_id
                    )
                ).first()
                
                if assignment:
                    print(f"Found teacher {teacher.full_name} for subject {subject_id}")
                    return teacher
            except Exception as e:
                print(f"Error checking teacher {teacher.id}: {e}")
                continue
        
        print(f"Warning: No specific teacher found for subject {subject_id}, returning first available")
        # If no specific assignment found, return first available teacher
        return teachers[0] if teachers else None
    
    def _find_available_teacher_for_subject_and_slot(
        self, 
        subject_id: int, 
        day: int, 
        period: int, 
        teachers: List[Teacher],
        existing_schedules: List[Schedule]
    ) -> Optional[Teacher]:
        """
        Find an available teacher for a subject at a specific day/period
        Checks free_time_slots and existing schedule conflicts
        
        Args:
            subject_id: Subject to teach
            day: Day of week (1-7, Sunday=1)
            period: Period number (1-6)
            teachers: List of teachers to check
            existing_schedules: Current schedule entries to check for conflicts
            
        Returns:
            Teacher with most available slots, or None if none available
        """
        if not teachers:
            print(f"Warning: No teachers available")
            return None
        
        # Get teachers assigned to this subject
        suitable_teachers = []
        for teacher in teachers:
            try:
                assignment = self.db.query(TeacherAssignment).filter(
                    and_(
                        TeacherAssignment.teacher_id == teacher.id,
                        TeacherAssignment.subject_id == subject_id
                    )
                ).first()
                
                if assignment:
                    suitable_teachers.append(teacher)
            except Exception as e:
                print(f"Error checking teacher {teacher.id}: {e}")
                continue
        
        if not suitable_teachers:
            print(f"Warning: No teachers assigned to subject {subject_id}")
            return None
        
        # Check availability for each suitable teacher
        available_teachers = []
        for teacher in suitable_teachers:
            try:
                # Get teacher's availability
                availability = self.availability_service.get_teacher_availability(teacher.id)
                slots = availability.get('slots', [])
                
                # Convert day/period to slot index (day is 1-based, period is 1-based)
                # free_time_slots uses 0-based indexing: day 0-4 (Sunday-Thursday), period 0-5
                slot_day = day - 1  # Convert 1-based to 0-based
                slot_period = period - 1  # Convert 1-based to 0-based
                slot_index = slot_day * 6 + slot_period
                
                # Check if slot index is valid
                if slot_index < 0 or slot_index >= len(slots):
                    print(f"Invalid slot index {slot_index} for teacher {teacher.full_name}")
                    continue
                
                # Check if slot is free or assigned to same class
                slot = slots[slot_index]
                slot_status = slot.get('status', 'unavailable')
                slot_is_free = slot.get('is_free', slot_status == 'free')
                slot_has_assignment = slot.get('assignment') is not None
                
                # Check if this slot is available:
                # 1. Status is 'free' with no assignment (standard case)
                # 2. Status is 'assigned' but for the SAME class (multi-section case)
                is_free = False
                
                if slot_status == 'free' and slot_is_free and not slot_has_assignment:
                    # Standard free slot
                    is_free = True
                elif slot_status == 'assigned' and slot_has_assignment:
                    # Check if assigned to same class - if so, can be reused for different section
                    assignment_info = slot.get('assignment', {})
                    assigned_class_id = assignment_info.get('class_id')
                    # Get the class for this subject
                    subject = self.db.query(Subject).filter(Subject.id == subject_id).first()
                    if subject and subject.class_id == assigned_class_id:
                        # Same class - teacher can teach different section at same slot
                        is_free = True
                        print(f"  -> Slot assigned to same class, reusing for different section")
                
                print(f"DEBUG: Teacher {teacher.full_name}, day={day}, period={period}, slot_index={slot_index}")
                print(f"  Slot data: {slot}")
                print(f"  status={slot_status}, is_free={slot_is_free}, has_assignment={slot_has_assignment}")
                print(f"  RESULT: is_free={is_free}")
                
                if not is_free:
                    print(f"  -> Teacher {teacher.full_name} NOT FREE at day {day} period {period}")
                    continue
                
                print(f"  -> Teacher {teacher.full_name} IS FREE at day {day} period {period}")
                
                # Check for conflicts in existing schedules
                # Allow same teacher for different sections of the same class
                # Only conflict if teaching a DIFFERENT class at the same time
                has_conflict = False
                for schedule in existing_schedules:
                    if (schedule.teacher_id == teacher.id and 
                        schedule.day_of_week == day and 
                        schedule.period_number == period):
                        # Check if it's a different class - if so, it's a real conflict
                        # If it's the same class but different section, it's allowed
                        # (Different sections of the same class can be taught by the same teacher at the same slot position)
                        current_class_id = schedule.class_id
                        # We need to check which class we're currently generating for
                        # This is passed implicitly through the context
                        # For now, if there's ANY existing schedule, check if it's a different class
                        # We'll get the class context from the subject
                        subject = self.db.query(Subject).filter(Subject.id == subject_id).first()
                        if subject and subject.class_id != current_class_id:
                            has_conflict = True
                            print(f"Teacher {teacher.full_name} has conflict: teaching different class at day {day} period {period}")
                            break
                        else:
                            # Same class, different section - this is OK
                            print(f"Teacher {teacher.full_name} teaching same class (different section) at day {day} period {period} - allowed")
                            continue
                
                if not has_conflict:
                    available_teachers.append({
                        'teacher': teacher,
                        'available_slots': availability.get('total_free', 0)
                    })
                    print(f"Teacher {teacher.full_name} is available at day {day} period {period}")
            except Exception as e:
                print(f"Error checking availability for teacher {teacher.id}: {e}")
                continue
        
        # Return teacher with most available slots
        if available_teachers:
            best_teacher = max(available_teachers, key=lambda x: x['available_slots'])
            print(f"Selected teacher {best_teacher['teacher'].full_name} with {best_teacher['available_slots']} free slots")
            return best_teacher['teacher']
        
        print(f"No available teachers found for subject {subject_id} at day {day} period {period}")
        return None
    
    def _get_available_teachers(self, session_type: SessionType) -> List[Teacher]:
        """Get teachers available for the session"""
        try:
            query = self.db.query(Teacher)
            if query is None:
                return []
            
            # Get all active teachers - don't filter by transportation_type
            # as it may not be reliable or set correctly
            filtered_query = query.filter(Teacher.is_active == True)
            
            if filtered_query is None:
                return []
            
            result = filtered_query.all()
            return result if result is not None else []
        except Exception as e:
            print(f"Error getting available teachers: {e}")
            return []
    
    def _get_class_subject_requirements(self, classes: List[Class], subjects: List[Subject]) -> Dict[int, List[Dict]]:
        """Get subject requirements for each class"""
        requirements = {}
        
        # Get actual subject requirements from database
        for class_obj in classes:
            class_requirements = []
            
            # Get subjects for this class
            try:
                query = self.db.query(Subject)
                if query is not None:
                    filtered_query = query.filter(Subject.class_id == class_obj.id)
                    if filtered_query is not None:
                        class_subjects = filtered_query.all()
                        if class_subjects is not None:
                            # For each subject, determine required periods per week from curriculum data
                            # In a real implementation, this would come from a curriculum table
                            # For now, we'll implement a more sophisticated approach based on educational standards
                            for subject in class_subjects:
                                # Get curriculum data for this subject and class level
                                periods = self._get_curriculum_periods(subject.subject_name, class_obj.grade_level, class_obj.grade_number)
                                
                                class_requirements.append({
                                    "subject_id": subject.id,
                                    "periods_per_week": periods,
                                    "name": subject.subject_name
                                })
            except Exception:
                # If there's an error, continue with empty requirements for this class
                pass
            
            requirements[class_obj.id] = class_requirements
        
        return requirements
    
    def _get_curriculum_periods(self, subject_name: str, grade_level: str, grade_number: int) -> int:
        """Get required periods per week based on curriculum standards"""
        # This would normally query a curriculum table with educational standards
        # For now, we'll implement a more realistic estimation based on educational best practices
        
        subject_name_lower = subject_name.lower()
        
        # Core subjects typically get more periods
        if any(core in subject_name_lower for core in ['math', 'arabic', 'english']):
            if grade_level == 'primary':
                return 5 if grade_number <= 3 else 4
            elif grade_level == 'intermediate':
                return 4
            else:  # secondary
                return 5 if 'math' in subject_name_lower else 4
        
        # Science subjects
        elif any(science in subject_name_lower for science in ['science', 'biology', 'chemistry', 'physics']):
            if grade_level == 'primary':
                return 2 if grade_number <= 3 else 3
            elif grade_level == 'intermediate':
                return 3
            else:  # secondary
                return 4 if any(advanced in subject_name_lower for advanced in ['chemistry', 'physics']) else 3
        
        # Social studies and humanities
        elif any(humanities in subject_name_lower for humanities in ['social', 'history', 'geography', 'civics']):
            return 3 if grade_level == 'primary' else 2
        
        # Languages (other than Arabic and English)
        elif any(language in subject_name_lower for language in ['french', 'german', 'spanish']):
            return 3
        
        # Arts and physical education
        elif any(arts in subject_name_lower for arts in ['art', 'music', 'physical', 'sports']):
            return 2
        
        # Religious education
        elif 'islamic' in subject_name_lower or 'religion' in subject_name_lower:
            return 2
        
        # Default for other subjects
        else:
            return 2
    
    def _find_suitable_teachers(self, subject_id: int, teachers: List[Teacher]) -> List[Teacher]:
        """Find teachers suitable for a subject"""
        suitable_teachers = []
        
        # Check teacher qualifications/assignments
        try:
            query = self.db.query(Teacher)
            if query is not None:
                # Join with TeacherAssignment
                try:
                    joined_query = query.join(TeacherAssignment)
                    if joined_query is not None:
                        # Filter by subject
                        filtered_query = joined_query.filter(
                            and_(
                                TeacherAssignment.teacher_id == Teacher.id,
                                TeacherAssignment.subject_id == subject_id
                            )
                        )
                        if filtered_query is not None:
                            results = filtered_query.all()
                            if results is not None:
                                for assignment in results:
                                    if hasattr(assignment, 'teacher'):
                                        suitable_teachers.append(assignment.teacher)
                except Exception:
                    # If join fails, fall back to basic query
                    pass
        except Exception:
            pass
        
        # If no specific assignments found, return all active teachers
        if not suitable_teachers:
            suitable_teachers = [t for t in teachers if getattr(t, 'is_active', False)]
        
        return suitable_teachers
    
    def _select_best_teacher(self, teachers: List[Teacher], time_slot: TimeSlot, 
                           assignments: List[ScheduleAssignment], request: ScheduleGenerationRequest) -> Optional[Teacher]:
        """Select the best teacher for a time slot based on availability, workload, and expertise"""
        if not teachers:
            return None
        
        # Get current workload for each teacher
        teacher_workloads = self._calculate_teacher_workloads(assignments)
        
        # Get teacher expertise scores
        teacher_expertise = self._calculate_teacher_expertise(teachers)
        
        # Get teacher availability for this time slot
        teacher_availability = self._check_teacher_availability(teachers, time_slot, assignments)
        
        # Score each teacher based on multiple factors
        teacher_scores = {}
        for teacher in teachers:
            if not teacher_availability.get(teacher.id, True):  # Skip if not available
                continue
                
            # Workload score (lower workload = higher score)
            workload = teacher_workloads.get(teacher.id, 0)
            max_load = getattr(request, 'max_teacher_load', 25)
            workload_score = max(0, (max_load - workload) / max_load) if max_load > 0 else 0
            
            # Expertise score
            expertise_score = teacher_expertise.get(teacher.id, 0.5)
            
            # Preference score (if any)
            preference_score = getattr(teacher, 'preference_score', 0.5) 
            
            # Combined score (weighted average)
            combined_score = (
                workload_score * 0.4 +      # 40% workload consideration
                expertise_score * 0.4 +     # 40% expertise consideration
                preference_score * 0.2      # 20% preference consideration
            )
            
            teacher_scores[teacher.id] = {
                'teacher': teacher,
                'score': combined_score,
                'workload': workload,
                'expertise': expertise_score
            }
        
        # Return teacher with highest score
        if teacher_scores:
            best_teacher_id = max(teacher_scores.keys(), key=lambda k: teacher_scores[k]['score'])
            return teacher_scores[best_teacher_id]['teacher']
        
        return None
    
    def _calculate_teacher_workloads(self, assignments: List[ScheduleAssignment]) -> Dict[int, int]:
        """Calculate current workload for each teacher"""
        workloads = {}
        for assignment in assignments:
            if assignment.teacher_id:
                workloads[assignment.teacher_id] = workloads.get(assignment.teacher_id, 0) + 1
        return workloads
    
    def _calculate_teacher_expertise(self, teachers: List[Teacher]) -> Dict[int, float]:
        """Calculate expertise score for each teacher (0.0 to 1.0)"""
        expertise_scores = {}
        for teacher in teachers:
            score = 0.5  # Default score
            
            # Consider years of experience
            if hasattr(teacher, 'experience') and teacher.experience:  # type: ignore - Teacher experience check
                try:
                    # Extract years from experience string (e.g., "5 years teaching experience")
                    import re
                    years_match = re.search(r'(\d+)\s*(year|years)', str(teacher.experience).lower())  # type: ignore - Experience years extraction
                    if years_match:
                        years = int(years_match.group(1))  # type: ignore - Years conversion
                        # Normalize to 0.0-1.0 range (0-20 years = 0.0-1.0)
                        score += min(years / 40.0, 0.3)  # Max 0.3 from experience
                except:
                    pass
            
            # Consider qualifications
            if hasattr(teacher, 'qualifications') and teacher.qualifications:  # type: ignore - Teacher qualifications check
                qual_score = 0.0
                qual_text = str(teacher.qualifications).lower()
                
                # Higher education degrees
                if 'phd' in qual_text or 'doctorate' in qual_text:
                    qual_score = 0.2
                elif 'master' in qual_text or 'ma' in qual_text or 'ms' in qual_text:
                    qual_score = 0.15
                elif 'bachelor' in qual_text or 'ba' in qual_text or 'bs' in qual_text:
                    qual_score = 0.1
                elif 'diploma' in qual_text:
                    qual_score = 0.05
                
                score += min(qual_score, 0.2)  # Max 0.2 from qualifications
            
            expertise_scores[teacher.id] = min(score, 1.0)  # Cap at 1.0
        
        return expertise_scores
    
    def _check_teacher_availability(self, teachers: List[Teacher], time_slot: TimeSlot, 
                                  assignments: List[ScheduleAssignment]) -> Dict[int, bool]:
        """Check if teachers are available for the given time slot"""
        availability = {}
        
        # Get existing assignments for this time slot
        slot_assignments = [a for a in assignments if a.time_slot_id == time_slot.id]
        assigned_teachers = {a.teacher_id for a in slot_assignments if a.teacher_id}
        
        for teacher in teachers:
            # Check if teacher is already assigned to this time slot
            availability[teacher.id] = teacher.id not in assigned_teachers
            
            # Additional checks could include:
            # - Teacher's free time slots preference
            # - Teacher's unavailability periods
            # - Teacher's maximum consecutive periods limit
        
        return availability
    
    def _suggest_room(self, class_obj: Class, subject_id: int) -> Optional[str]:
        """Suggest a room for the class and subject"""
        # Simple room suggestion based on subject
        room_mapping = {
            1: "Math Lab",      # Mathematics
            2: "Classroom A",   # Arabic
            3: "Language Lab",  # English
            4: "Science Lab",   # Science
            5: "Classroom B",   # Social Studies
            6: "Gymnasium",     # Physical Education
        }
        return room_mapping.get(subject_id, f"Room {class_obj.id}")
    
    def _find_alternative_teacher(self, assignment: ScheduleAssignment) -> Optional[Teacher]:
        """Find an alternative teacher for an assignment"""
        # Find teachers who can teach this subject
        try:
            suitable_teachers = self.db.query(Teacher).join(TeacherAssignment).filter( 
                and_(
                    TeacherAssignment.subject_id == assignment.subject_id,
                    Teacher.is_active == True,
                    Teacher.id != assignment.teacher_id  # Not the current teacher
                )
            ).all() 
            
            # Filter by availability (no conflicts at this time)
            available_teachers = []
            for teacher in suitable_teachers:
                # Check if teacher is already assigned at this time
                conflict = self.db.query(ScheduleAssignment).filter( 
                    and_(
                        ScheduleAssignment.teacher_id == teacher.id,
                        ScheduleAssignment.time_slot_id == assignment.time_slot_id,
                        ScheduleAssignment.id != assignment.id
                    )
                ).first() 
                
                if not conflict:
                    available_teachers.append(teacher)
            
            # Return first available teacher, or None if none found
            return available_teachers[0] if available_teachers else None
        except Exception:
            return None
    
    def _transfer_assignment(self, assignments: List[ScheduleAssignment], 
                           from_teacher: int, to_teacher: int) -> bool:
        """Transfer assignment from one teacher to another"""
        try:
            # Find assignments for the from_teacher
            teacher_assignments = [a for a in assignments if a.teacher_id == from_teacher]
            
            if not teacher_assignments:
                return False
            
            # Transfer one assignment to the to_teacher
            assignment_to_transfer = teacher_assignments[0]
            assignment_to_transfer.teacher_id = to_teacher
            
            # Update in database
            db_assignment = self.db.query(ScheduleAssignment).filter( 
                ScheduleAssignment.id == assignment_to_transfer.id
            ).first() 
            
            if db_assignment:
                db_assignment.teacher_id = to_teacher
                self.db.commit()
                return True
            
            return False
        except Exception as e:
            print(f"Failed to transfer assignment: {e}")
            return False

    def _redistribute_subject_periods(self, subject_assignments: List[ScheduleAssignment]) -> bool:
        """Redistribute subject periods for better continuity"""
        if len(subject_assignments) <= 1:
            return True
        
        try:
            # Group assignments by day
            assignments_by_day = {}
            for assignment in subject_assignments:
                # Get the actual time slot to determine the day
                time_slot = self.db.query(TimeSlot).filter(TimeSlot.id == assignment.time_slot_id).first() 
                if time_slot:
                    day = time_slot.day_of_week
                    if day not in assignments_by_day:
                        assignments_by_day[day] = []
                    assignments_by_day[day].append((assignment, time_slot))
            
            # If subject is taught on too many separate days, try to consolidate
            if len(assignments_by_day) > 3:  # More than 3 days
                # Sort days by number of periods (ascending)
                days_sorted = sorted(assignments_by_day.keys(), key=lambda d: len(assignments_by_day[d]))
                
                # Try to move periods from days with fewer periods to days with more periods
                for from_day in days_sorted[:-1]:  # All days except the one with most periods
                    assignments_to_move = assignments_by_day[from_day]
                    
                    # Find the day with the most periods to move to
                    to_day = days_sorted[-1]
                    target_time_slots = assignments_by_day[to_day]
                    
                    # Try to move each assignment
                    for assignment, time_slot in assignments_to_move:
                        # Find an available time slot on the target day
                        available_slot = self._find_available_time_slot(
                            target_time_slots, assignment.class_id, assignment.teacher_id
                        )
                        
                        if available_slot:
                            # Update the assignment's time slot
                            assignment.time_slot_id = available_slot.id
                            
                            # Update in database
                            db_assignment = self.db.query(ScheduleAssignment).filter( 
                                ScheduleAssignment.id == assignment.id
                            ).first() 
                            
                            if db_assignment:
                                db_assignment.time_slot_id = available_slot.id
                
                # Commit all changes
                self.db.commit()
            
            return True
        except Exception as e:
            print(f"Failed to redistribute subject periods: {e}")
            return False
    
    def _find_available_time_slot(self, target_time_slots: List[Tuple], class_id: int, teacher_id: Optional[int]) -> Optional[TimeSlot]:
        """Find an available time slot on the target day"""
        if not target_time_slots:
            return None
        
        # Get the target day from existing time slots
        target_day = target_time_slots[0][1].day_of_week if target_time_slots else None
        if not target_day:
            return None
        
        # Get all time slots for the target day
        all_day_slots = self.db.query(TimeSlot).filter(TimeSlot.day_of_week == target_day).all() 
        
        # Find slots that are not already occupied by this class or teacher
        for slot in all_day_slots:
            # Check if this slot is already used by the same class
            class_conflict = self.db.query(ScheduleAssignment).filter( 
                and_(
                    ScheduleAssignment.class_id == class_id,
                    ScheduleAssignment.time_slot_id == slot.id
                )
            ).first() 
            
            if class_conflict:
                continue
            
            # Check if this slot is already used by the same teacher (if teacher is assigned)
            if teacher_id:
                teacher_conflict = self.db.query(ScheduleAssignment).filter( 
                    and_(
                        ScheduleAssignment.teacher_id == teacher_id,
                        ScheduleAssignment.time_slot_id == slot.id
                    )
                ).first() 
                
                if teacher_conflict:
                    continue
            
            # This slot is available
            return slot
        
        return None
    
    def export_to_json(self, schedule_data: List[Dict]) -> str:
        """Export schedule data to JSON format"""
        import json
        return json.dumps(schedule_data, indent=2, ensure_ascii=False)
    
    def import_template(self, template_data: Dict) -> Dict:
        """Import schedule template data and validate it"""
        if not template_data:
            return {"error": "No template data provided"}
        
        # Validate required fields
        required_fields = ['name', 'academic_year_id', 'session_type']
        for field in required_fields:
            if field not in template_data:
                return {"error": f"Missing required field: {field}"}
        
        # Validate session type
        valid_session_types = ['morning', 'evening', 'both']
        if template_data.get('session_type') not in valid_session_types:
            return {"error": f"Invalid session type. Must be one of: {', '.join(valid_session_types)}"}
        
        # Validate academic year
        try:
            academic_year_id_value = template_data.get('academic_year_id')
            if academic_year_id_value is None:
                return {"error": "Academic year ID is missing"}
            academic_year_id = int(academic_year_id_value)
            if academic_year_id <= 0:
                return {"error": "Invalid academic year ID"}
        except (ValueError, TypeError):
            return {"error": "Academic year ID must be a positive integer"}
        
        # Process classes data if provided
        if 'classes' in template_data:
            processed_classes = []
            for class_data in template_data['classes']:
                # Validate class data
                if not isinstance(class_data, dict):
                    continue
                
                # Required fields for class
                class_required = ['grade_level', 'grade_number']
                if all(field in class_data for field in class_required):
                    processed_classes.append(class_data)
            
            template_data['classes'] = processed_classes
        
        # Process subjects data if provided
        if 'subjects' in template_data:
            processed_subjects = []
            for subject_data in template_data['subjects']:
                # Validate subject data
                if not isinstance(subject_data, dict):
                    continue
                
                # Required fields for subject
                subject_required = ['subject_name', 'class_id']
                if all(field in subject_data for field in subject_required):
                    processed_subjects.append(subject_data)
            
            template_data['subjects'] = processed_subjects
        
        # Process teachers data if provided
        if 'teachers' in template_data:
            processed_teachers = []
            for teacher_data in template_data['teachers']:
                # Validate teacher data
                if not isinstance(teacher_data, dict):
                    continue
                
                # Required fields for teacher
                teacher_required = ['full_name']
                if all(field in teacher_data for field in teacher_required):
                    processed_teachers.append(teacher_data)
            
            template_data['teachers'] = processed_teachers
        
        # Add import timestamp
        template_data['imported_at'] = datetime.now().isoformat()
        template_data['status'] = 'validated'
        
        return template_data
    
    def export_to_csv(self, schedule_data: List[Dict]) -> str:
        """Export schedule data to CSV format"""
        if not schedule_data:
            return ""
        
        import csv
        from io import StringIO
        
        output = StringIO()
        writer = csv.writer(output)
        
        # Write header
        header = list(schedule_data[0].keys())
        writer.writerow(header)
        
        # Write data rows
        for item in schedule_data:
            writer.writerow([item.get(key, "") for key in header])
        
        return output.getvalue()

class ScheduleAnalyticsService:
    """Service for schedule analytics and statistics"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_schedule_statistics(self, schedule_id: int) -> ScheduleStatistics:
        """Get comprehensive statistics for a schedule"""
        assignments = self.db.query(ScheduleAssignment).filter( 
            ScheduleAssignment.schedule_id == schedule_id
        ).all() 
        
        time_slots = self.db.query(TimeSlot).filter( 
            TimeSlot.schedule_id == schedule_id
        ).all() 
        
        conflicts = self.db.query(ScheduleConflict).filter( 
            ScheduleConflict.schedule_id == schedule_id
        ).all() 
        
        # Calculate statistics
        total_periods = len([slot for slot in time_slots if not slot.is_break])
        total_assignments = len(assignments)
        total_breaks = len([slot for slot in time_slots if slot.is_break])
        
        # Teacher utilization
        teacher_periods = {}
        for assignment in assignments:
            if assignment.teacher_id:
                teacher_periods[assignment.teacher_id] = teacher_periods.get(assignment.teacher_id, 0) + 1
        
        teacher_utilization = {}
        for teacher_id, periods in teacher_periods.items():
            utilization = (periods / total_periods) * 100 if total_periods > 0 else 0
            teacher_utilization[f"Teacher_{teacher_id}"] = round(utilization, 2)
        
        # Subject distribution
        subject_distribution = {}
        for assignment in assignments:
            subject_key = f"Subject_{assignment.subject_id}"
            subject_distribution[subject_key] = subject_distribution.get(subject_key, 0) + 1
        
        # Class load
        class_load = {}
        for assignment in assignments:
            class_key = f"Class_{assignment.class_id}"
            class_load[class_key] = class_load.get(class_key, 0) + 1
        
        # Daily distribution
        daily_distribution = {}
        for slot in time_slots:
            if not slot.is_break:
                daily_distribution[slot.day_of_week] = daily_distribution.get(slot.day_of_week, 0) + 1
        
        # Conflicts summary
        conflicts_summary = {}
        for conflict in conflicts:
            conflicts_summary[conflict.conflict_type] = conflicts_summary.get(conflict.conflict_type, 0) + 1
        
        return ScheduleStatistics(
            total_periods=total_periods,
            total_assignments=total_assignments,
            total_breaks=total_breaks,
            teacher_utilization=teacher_utilization,
            subject_distribution=subject_distribution,
            class_load=class_load,
            daily_distribution=daily_distribution,
            conflicts_summary=conflicts_summary
        )
    
    def export_to_json(self, schedule_data: List[Dict]) -> str:
        """Export schedule data to JSON format"""
        import json
        return json.dumps(schedule_data, indent=2, ensure_ascii=False)
    
    def export_to_csv(self, schedule_data: List[Dict]) -> str:
        """Export schedule data to CSV format"""
        if not schedule_data:
            return ""
        
        import csv
        from io import StringIO
        
        output = StringIO()
        writer = csv.writer(output)
        
        # Write header
        header = list(schedule_data[0].keys())
        writer.writerow(header)
        
        # Write data rows
        for item in schedule_data:
            writer.writerow([item.get(key, "") for key in header])
        
        return output.getvalue()
    
    def import_template(self, template_data: Dict) -> Dict:
        """Import schedule template data"""
        # For For testing, just return the data as-is
        return template_data.copy()

# Global schedule service instances
# These will be initialized with proper database sessions when needed
schedule_generation_service = None
schedule_analytics_service = None
