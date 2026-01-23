"""
Analytics Service - Comprehensive data analytics with smart caching
Provides analytics for students, teachers, finance, and activities
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta, date
from sqlalchemy import func, and_, or_, extract, case
from sqlalchemy.orm import Session
import json
import hashlib
from functools import wraps

from app.database import SessionLocal
from app.models.students import Student, StudentAcademic, StudentFinance, StudentPayment, StudentBehaviorRecord
from app.models.teachers import Teacher, TeacherAssignment, TeacherAttendance, TeacherFinance
from app.models.academic import AcademicYear, Class, Subject
from app.models.finance import FinanceTransaction, FinanceCategory, Budget
from app.models.activities import Activity, ActivityRegistration, ActivityAttendance
from app.models.daily import StudentDailyAttendance, TeacherPeriodAttendance


class CacheManager:
    """Simple in-memory cache manager with pattern-based invalidation"""
    _cache = {}
    _ttl = {}
    
    @classmethod
    def get(cls, key: str) -> Optional[Any]:
        if key in cls._cache:
            if datetime.now() < cls._ttl.get(key, datetime.min):
                return cls._cache[key]
            else:
                del cls._cache[key]
                del cls._ttl[key]
        return None
    
    @classmethod
    def set(cls, key: str, value: Any, ttl_seconds: int = 300):
        cls._cache[key] = value
        cls._ttl[key] = datetime.now() + timedelta(seconds=ttl_seconds)
    
    @classmethod
    def clear(cls):
        """Clear all cache entries"""
        cls._cache.clear()
        cls._ttl.clear()
    
    @classmethod
    def invalidate_pattern(cls, pattern: str):
        """Invalidate all cache keys matching a pattern"""
        keys_to_delete = [key for key in cls._cache.keys() if pattern in key]
        for key in keys_to_delete:
            del cls._cache[key]
            if key in cls._ttl:
                del cls._ttl[key]
    
    @classmethod
    def invalidate_analytics(cls, category: str = None):
        """
        Invalidate analytics cache by category
        Categories: 'overview', 'academic', 'attendance', 'distribution', 'grades', 'all'
        """
        if category == 'all' or category is None:
            cls.clear()
        else:
            # Invalidate specific function caches
            if category == 'overview':
                cls.invalidate_pattern('get_overview_stats')
            elif category == 'academic':
                cls.invalidate_pattern('get_academic_performance')
                cls.invalidate_pattern('get_school_wide_grades')
            elif category == 'attendance':
                cls.invalidate_pattern('get_attendance_analytics')
                cls.invalidate_pattern('get_overview_stats')  # Also invalidate overview as it includes attendance
            elif category == 'distribution':
                cls.invalidate_pattern('get_student_distribution')
            elif category == 'grades':
                cls.invalidate_pattern('get_school_wide_grades')
                cls.invalidate_pattern('get_academic_performance')


def cache_result(ttl_seconds: int = 300):
    """Decorator to cache function results"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Create cache key from function name and arguments
            cache_key = f"{func.__name__}:{hashlib.md5(str(args).encode() + str(kwargs).encode()).hexdigest()}"
            
            # Try to get from cache
            cached = CacheManager.get(cache_key)
            if cached is not None:
                return cached
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            CacheManager.set(cache_key, result, ttl_seconds)
            return result
        return wrapper
    return decorator


class TimePeriodHelper:
    """Helper class for time period calculations"""
    
    @staticmethod
    def get_date_range(period_type: str, custom_start: Optional[date] = None, 
                       custom_end: Optional[date] = None) -> Tuple[date, date]:
        """Get start and end dates for a given period type"""
        today = date.today()
        
        if period_type == "daily":
            # Last 30 days
            return today - timedelta(days=30), today
        
        elif period_type == "weekly":
            # Last 12 weeks, starting from Sunday
            days_since_sunday = (today.weekday() + 1) % 7
            last_sunday = today - timedelta(days=days_since_sunday)
            start_date = last_sunday - timedelta(weeks=12)
            return start_date, today
        
        elif period_type == "monthly":
            # Last 12 months
            start_date = today - timedelta(days=365)
            return start_date, today
        
        elif period_type == "yearly":
            # Last 5 academic years
            current_year = today.year
            if today.month < 9:  # Before September, still in previous academic year
                current_year -= 1
            start_year = current_year - 5
            return date(start_year, 9, 1), today
        
        elif period_type == "custom" and custom_start and custom_end:
            return custom_start, custom_end
        
        else:
            return today - timedelta(days=30), today
    
    @staticmethod
    def group_by_period(period_type: str) -> str:
        """Get SQL grouping expression for period type"""
        if period_type == "daily":
            return "day"
        elif period_type == "weekly":
            return "week"
        elif period_type == "monthly":
            return "month"
        elif period_type == "yearly":
            return "year"
        return "day"


class AnalyticsService:
    """Main analytics service"""
    
    def __init__(self):
        self.time_helper = TimePeriodHelper()
    
    # =========================
    # OVERVIEW ANALYTICS
    # =========================
    
    @cache_result(ttl_seconds=60)
    def get_overview_stats(self, academic_year_id: int, session_type: Optional[str] = None,
                           user_role: Optional[str] = None) -> Dict[str, Any]:
        """Get high-level overview statistics"""
        db = SessionLocal()
        try:
            stats = {}
            
            # Student counts - get morning, evening, and total
            morning_students = db.query(func.count(Student.id)).filter(
                Student.academic_year_id == academic_year_id,
                Student.is_active == True,
                Student.session_type == "morning"
            ).scalar() or 0
            
            evening_students = db.query(func.count(Student.id)).filter(
                Student.academic_year_id == academic_year_id,
                Student.is_active == True,
                Student.session_type == "evening"
            ).scalar() or 0
            
            stats["morning_students"] = morning_students
            stats["evening_students"] = evening_students
            stats["total_students"] = morning_students + evening_students
            
            # Teacher counts - get morning, evening, and total
            morning_teachers = db.query(func.count(Teacher.id)).filter(
                Teacher.academic_year_id == academic_year_id,
                Teacher.is_active == True,
                Teacher.session_type == "morning"
            ).scalar() or 0
            
            evening_teachers = db.query(func.count(Teacher.id)).filter(
                Teacher.academic_year_id == academic_year_id,
                Teacher.is_active == True,
                Teacher.session_type == "evening"
            ).scalar() or 0
            
            stats["morning_teachers"] = morning_teachers
            stats["evening_teachers"] = evening_teachers
            stats["total_teachers"] = morning_teachers + evening_teachers
            
            # Class counts - get morning, evening, and total
            morning_classes = db.query(func.count(Class.id)).filter(
                Class.academic_year_id == academic_year_id,
                Class.session_type == "morning"
            ).scalar() or 0
            
            evening_classes = db.query(func.count(Class.id)).filter(
                Class.academic_year_id == academic_year_id,
                Class.session_type == "evening"
            ).scalar() or 0
            
            stats["morning_classes"] = morning_classes
            stats["evening_classes"] = evening_classes
            stats["total_classes"] = morning_classes + evening_classes
            
            # Activity count (not session-specific for total)
            activity_query = db.query(func.count(Activity.id)).filter(
                Activity.academic_year_id == academic_year_id,
                Activity.is_active == True
            )
            if session_type and session_type in ["morning", "evening"]:
                activity_query = activity_query.filter(
                    or_(Activity.session_type == session_type, Activity.session_type == "mixed")
                )
            stats["total_activities"] = activity_query.scalar() or 0
            
            return stats
            
        finally:
            db.close()
    
    # =========================
    # STUDENT ANALYTICS
    # =========================
    
    @cache_result(ttl_seconds=60)
    def get_student_distribution(self, academic_year_id: int, 
                                session_type: Optional[str] = None) -> Dict[str, Any]:
        """Get student distribution by various categories"""
        db = SessionLocal()
        try:
            base_query = db.query(Student).filter(
                Student.academic_year_id == academic_year_id,
                Student.is_active == True
            )
            if session_type:
                base_query = base_query.filter(Student.session_type == session_type)
            
            # By grade level
            grade_distribution = db.query(
                Student.grade_level,
                Student.grade_number,
                func.count(Student.id).label("count")
            ).filter(
                Student.academic_year_id == academic_year_id,
                Student.is_active == True
            )
            if session_type:
                grade_distribution = grade_distribution.filter(Student.session_type == session_type)
            grade_distribution = grade_distribution.group_by(
                Student.grade_level, Student.grade_number
            ).all()
            
            # By gender (with session_type for filtering)
            gender_distribution = db.query(
                Student.gender,
                Student.session_type,
                func.count(Student.id).label("count")
            ).filter(
                Student.academic_year_id == academic_year_id,
                Student.is_active == True
            )
            if session_type:
                gender_distribution = gender_distribution.filter(Student.session_type == session_type)
            gender_distribution = gender_distribution.group_by(Student.gender, Student.session_type).all()
            
            # By transportation (with session_type for filtering)
            transport_distribution = db.query(
                Student.transportation_type,
                Student.session_type,
                func.count(Student.id).label("count")
            ).filter(
                Student.academic_year_id == academic_year_id,
                Student.is_active == True
            )
            if session_type:
                transport_distribution = transport_distribution.filter(Student.session_type == session_type)
            transport_distribution = transport_distribution.group_by(Student.transportation_type, Student.session_type).all()
            
            # By section (class distribution)
            section_distribution = db.query(
                Student.grade_level,
                Student.grade_number,
                Student.section,
                Student.session_type,
                func.count(Student.id).label("count")
            ).filter(
                Student.academic_year_id == academic_year_id,
                Student.is_active == True
            )
            if session_type:
                section_distribution = section_distribution.filter(Student.session_type == session_type)
            section_distribution = section_distribution.group_by(
                Student.grade_level, Student.grade_number, Student.section, Student.session_type
            ).all()
            
            return {
                "by_grade": [
                    {
                        "grade_level": level,
                        "grade_number": number,
                        "count": count,
                        "label": f"{level} - {number}"
                    }
                    for level, number, count in grade_distribution
                ],
                "by_gender": [
                    {"gender": gender, "session_type": session, "count": count}
                    for gender, session, count in gender_distribution
                ],
                "by_transportation": [
                    {"type": transport, "session_type": session, "count": count}
                    for transport, session, count in transport_distribution
                ],
                "by_section": [
                    {
                        "grade_level": level,
                        "grade_number": number,
                        "section": section,
                        "session_type": session,
                        "count": count,
                        "label": f"{level} {number} - {section}"
                    }
                    for level, number, section, session, count in section_distribution
                ]
            }
            
        finally:
            db.close()
    
    @cache_result(ttl_seconds=60)
    def get_academic_performance(self, academic_year_id: int, session_type: Optional[str] = None,
                                 class_id: Optional[int] = None) -> Dict[str, Any]:
        """Get academic performance statistics"""
        db = SessionLocal()
        try:
            # Base query for student academics
            academic_query = db.query(StudentAcademic).filter(
                StudentAcademic.academic_year_id == academic_year_id
            )
            
            if class_id:
                academic_query = academic_query.join(Student).filter(Student.class_id == class_id)
            elif session_type:
                academic_query = academic_query.join(Student).filter(Student.session_type == session_type)
            
            records = academic_query.all()
            
            if not records:
                return {"error": "No academic records found"}
            
            # Calculate statistics for each exam type
            def calc_stats(values):
                if not values:
                    return {"average": 0, "highest": 0, "lowest": 0, "count": 0}
                return {
                    "average": round(sum(values) / len(values), 2),
                    "highest": round(max(values), 2),
                    "lowest": round(min(values), 2),
                    "count": len(values)
                }
            
            # Collect grades by type
            board_grades = [r.board_grades for r in records if r.board_grades is not None]
            recitation_grades = [r.recitation_grades for r in records if r.recitation_grades is not None]
            
            # Quiz grades (المذاكرات)
            first_quiz = [r.first_quiz_grade for r in records if r.first_quiz_grade is not None]
            second_quiz = [r.second_quiz_grade for r in records if r.second_quiz_grade is not None]
            third_quiz = [r.third_quiz_grade for r in records if r.third_quiz_grade is not None]
            fourth_quiz = [r.fourth_quiz_grade for r in records if r.fourth_quiz_grade is not None]
            
            # Exam grades (الامتحانات)
            midterm = [r.midterm_grades for r in records if r.midterm_grades is not None]
            final_exam = [r.final_exam_grades for r in records if r.final_exam_grades is not None]
            
            behavior = [r.behavior_grade for r in records if r.behavior_grade is not None]
            activity = [r.activity_grade for r in records if r.activity_grade is not None]
            
            # Performance by subject
            subject_performance = db.query(
                Subject.subject_name,
                func.avg(StudentAcademic.final_exam_grades).label("avg_grade"),
                func.count(StudentAcademic.id).label("student_count")
            ).join(StudentAcademic, Subject.id == StudentAcademic.subject_id).filter(
                StudentAcademic.academic_year_id == academic_year_id
            )
            
            if class_id:
                subject_performance = subject_performance.join(Student).filter(Student.class_id == class_id)
            elif session_type:
                subject_performance = subject_performance.join(Student).filter(Student.session_type == session_type)
            
            subject_performance = subject_performance.group_by(Subject.subject_name).all()
            
            return {
                "exam_statistics": {
                    "board_grades": calc_stats(board_grades),
                    "recitation": calc_stats(recitation_grades),
                    "first_quiz": calc_stats(first_quiz),
                    "second_quiz": calc_stats(second_quiz),
                    "third_quiz": calc_stats(third_quiz),
                    "fourth_quiz": calc_stats(fourth_quiz),
                    "midterm": calc_stats(midterm),
                    "final_exam": calc_stats(final_exam),
                    "behavior": calc_stats(behavior),
                    "activity": calc_stats(activity)
                },
                "subject_performance": [
                    {
                        "subject": subj,
                        "average": round(float(avg), 2) if avg else 0,
                        "student_count": count
                    }
                    for subj, avg, count in subject_performance
                ],
                "total_records": len(records)
            }
            
        finally:
            db.close()
    
    @cache_result(ttl_seconds=60)
    def get_attendance_analytics(self, academic_year_id: int, period_type: str = "monthly",
                                session_type: Optional[str] = None) -> Dict[str, Any]:
        """Get attendance analytics for students and teachers"""
        db = SessionLocal()
        try:
            start_date, end_date = self.time_helper.get_date_range(period_type)
            
            # Student attendance
            student_attendance = db.query(
                StudentDailyAttendance.attendance_date,
                func.count(StudentDailyAttendance.id).label("total_records"),
                func.sum(case((StudentDailyAttendance.is_present == True, 1), else_=0)).label("present_count"),
                func.sum(case((StudentDailyAttendance.is_present == False, 1), else_=0)).label("absent_count")
            ).filter(
                StudentDailyAttendance.academic_year_id == academic_year_id,
                StudentDailyAttendance.attendance_date.between(start_date, end_date)
            )
            
            if session_type:
                student_attendance = student_attendance.join(Student).filter(
                    Student.session_type == session_type
                )
            
            student_attendance = student_attendance.group_by(
                StudentDailyAttendance.attendance_date
            ).order_by(StudentDailyAttendance.attendance_date).all()
            
            # Teacher attendance
            teacher_attendance = db.query(
                TeacherPeriodAttendance.attendance_date,
                func.count(TeacherPeriodAttendance.id).label("total_records"),
                func.sum(case((TeacherPeriodAttendance.is_present == True, 1), else_=0)).label("present_count"),
                func.sum(case((TeacherPeriodAttendance.is_present == False, 1), else_=0)).label("absent_count")
            ).filter(
                TeacherPeriodAttendance.academic_year_id == academic_year_id,
                TeacherPeriodAttendance.attendance_date.between(start_date, end_date)
            )
            
            if session_type:
                teacher_attendance = teacher_attendance.join(Teacher).filter(
                    Teacher.session_type == session_type
                )
            
            teacher_attendance = teacher_attendance.group_by(
                TeacherPeriodAttendance.attendance_date
            ).order_by(TeacherPeriodAttendance.attendance_date).all()
            
            # Top absent students
            top_absent_students = db.query(
                Student.id,
                Student.full_name,
                func.count(StudentDailyAttendance.id).label("absence_count")
            ).join(StudentDailyAttendance).filter(
                Student.academic_year_id == academic_year_id,
                StudentDailyAttendance.is_present == False,
                StudentDailyAttendance.attendance_date.between(start_date, end_date)
            )
            
            if session_type:
                top_absent_students = top_absent_students.filter(Student.session_type == session_type)
            
            top_absent_students = top_absent_students.group_by(
                Student.id, Student.full_name
            ).order_by(func.count(StudentDailyAttendance.id).desc()).limit(10).all()
            
            return {
                "student_attendance": [
                    {
                        "date": att_date.isoformat(),
                        "total": total,
                        "present": present,
                        "absent": absent,
                        "attendance_rate": round((present / total * 100) if total > 0 else 0, 2)
                    }
                    for att_date, total, present, absent in student_attendance
                ],
                "teacher_attendance": [
                    {
                        "date": att_date.isoformat(),
                        "total": total,
                        "present": present,
                        "absent": absent,
                        "attendance_rate": round((present / total * 100) if total > 0 else 0, 2)
                    }
                    for att_date, total, present, absent in teacher_attendance
                ],
                "top_absent_students": [
                    {
                        "student_id": sid,
                        "student_name": name,
                        "absence_count": count
                    }
                    for sid, name, count in top_absent_students
                ]
            }
            
        finally:
            db.close()
    
    @cache_result(ttl_seconds=60)
    def get_school_wide_grades(self, academic_year_id: int, 
                               subject_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get school-wide grade averages for all quizzes and exams by session
        Returns average grades separated by morning and evening sessions
        Calculates average of student averages (not average of all records)
        """
        db = SessionLocal()
        try:
            results = []
            
            # Base query joining StudentAcademic with Student and Subject
            base_query = db.query(
                StudentAcademic,
                Student.id.label('student_id'),
                Student.session_type,
                Subject.subject_name
            ).join(
                Student, StudentAcademic.student_id == Student.id
            ).join(
                Subject, StudentAcademic.subject_id == Subject.id
            ).filter(
                StudentAcademic.academic_year_id == academic_year_id,
                Student.is_active == True
            )
            
            # Apply subject filter if provided
            if subject_filter and subject_filter != 'all':
                base_query = base_query.filter(Subject.subject_name == subject_filter)
            
            records = base_query.all()
            
            if not records:
                return []
            
            # Group by student and assignment type to calculate student averages first
            # Structure: {assignment_type: {assignment_number: {session: {student_id: [grades]}}}}
            student_grades = {}
            
            for academic, student_id, session_type, subject_name in records:
                # Process quizzes
                for quiz_num, grade_field in [(1, 'first_quiz_grade'), (2, 'second_quiz_grade'), 
                                               (3, 'third_quiz_grade'), (4, 'fourth_quiz_grade')]:
                    grade = getattr(academic, grade_field, None)
                    if grade is not None:
                        key = ('مذاكرة', quiz_num)
                        if key not in student_grades:
                            student_grades[key] = {'morning': {}, 'evening': {}}
                        if student_id not in student_grades[key][session_type]:
                            student_grades[key][session_type][student_id] = []
                        student_grades[key][session_type][student_id].append(float(grade))
                
                # Process midterm exam
                if academic.midterm_grades is not None:
                    key = ('امتحان', 1)
                    if key not in student_grades:
                        student_grades[key] = {'morning': {}, 'evening': {}}
                    if student_id not in student_grades[key][session_type]:
                        student_grades[key][session_type][student_id] = []
                    student_grades[key][session_type][student_id].append(float(academic.midterm_grades))
                
                # Process final exam
                if academic.final_exam_grades is not None:
                    key = ('امتحان', 2)
                    if key not in student_grades:
                        student_grades[key] = {'morning': {}, 'evening': {}}
                    if student_id not in student_grades[key][session_type]:
                        student_grades[key][session_type][student_id] = []
                    student_grades[key][session_type][student_id].append(float(academic.final_exam_grades))
            
            # Calculate average of student averages
            for (assignment_type, assignment_number), sessions in student_grades.items():
                morning_student_avgs = []
                evening_student_avgs = []
                
                # Calculate each student's average for this assignment
                for student_id, grades in sessions['morning'].items():
                    if grades:
                        student_avg = sum(grades) / len(grades)
                        morning_student_avgs.append(student_avg)
                
                for student_id, grades in sessions['evening'].items():
                    if grades:
                        student_avg = sum(grades) / len(grades)
                        evening_student_avgs.append(student_avg)
                
                # Calculate overall average (average of student averages)
                morning_sum = sum(morning_student_avgs) if morning_student_avgs else 0
                morning_count = len(morning_student_avgs) if morning_student_avgs else 0
                evening_sum = sum(evening_student_avgs) if evening_student_avgs else 0
                evening_count = len(evening_student_avgs) if evening_student_avgs else 0
                
                if morning_count > 0 or evening_count > 0:
                    results.append({
                        'assignment_type': assignment_type,
                        'assignment_number': assignment_number,
                        'morning_sum': morning_sum,
                        'morning_count': morning_count,
                        'evening_sum': evening_sum,
                        'evening_count': evening_count,
                        'subject_name': 'all'
                    })
            
            return results
            
        finally:
            db.close()
    
    def get_student_attendance_trend(
        self,
        student_id: int,
        academic_year_id: int,
        period_type: str = "weekly"  # "weekly" or "monthly"
    ) -> List[Dict[str, Any]]:
        """
        Get student attendance trend by week or month
        Returns attendance rate (percentage) for each period
        """
        db = SessionLocal()
        try:
            # Get all attendance records for the student in this academic year
            attendance_records = db.query(StudentDailyAttendance).filter(
                and_(
                    StudentDailyAttendance.student_id == student_id,
                    StudentDailyAttendance.academic_year_id == academic_year_id
                )
            ).order_by(StudentDailyAttendance.attendance_date).all()
            
            if not attendance_records:
                return []
            
            # Get date range from actual attendance records
            start_date = min(record.attendance_date for record in attendance_records)
            end_date = max(record.attendance_date for record in attendance_records)
            
            # Group attendance by period
            if period_type == "weekly":
                return self._group_attendance_by_week(attendance_records, start_date, end_date)
            else:  # monthly
                return self._group_attendance_by_month(attendance_records, start_date, end_date)
                
        finally:
            db.close()
    
    def _group_attendance_by_week(
        self,
        attendance_records: List[StudentDailyAttendance],
        start_date: date,
        end_date: date
    ) -> List[Dict[str, Any]]:
        """Group attendance records by week and calculate attendance rate"""
        # Create a dictionary to store attendance by week
        weeks_data = {}
        
        # Process each attendance record
        for record in attendance_records:
            # Calculate week number from start_date
            days_diff = (record.attendance_date - start_date).days
            week_num = days_diff // 7 + 1
            
            if week_num not in weeks_data:
                weeks_data[week_num] = {
                    'total_days': 0,
                    'present_days': 0,
                    'week_start': start_date + timedelta(days=(week_num - 1) * 7)
                }
            
            weeks_data[week_num]['total_days'] += 1
            if record.is_present:
                weeks_data[week_num]['present_days'] += 1
        
        # Calculate attendance rate for each week
        results = []
        for week_num in sorted(weeks_data.keys()):
            week_data = weeks_data[week_num]
            attendance_rate = 0
            if week_data['total_days'] > 0:
                attendance_rate = round((week_data['present_days'] / week_data['total_days']) * 100, 2)
            
            results.append({
                'period': f'الأسبوع {week_num}',
                'week_number': week_num,
                'attendance_rate': attendance_rate,
                'total_days': week_data['total_days'],
                'present_days': week_data['present_days'],
                'start_date': week_data['week_start'].isoformat()
            })
        
        return results
    
    def _group_attendance_by_month(
        self,
        attendance_records: List[StudentDailyAttendance],
        start_date: date,
        end_date: date
    ) -> List[Dict[str, Any]]:
        """Group attendance records by month and calculate attendance rate"""
        # Create a dictionary to store attendance by month
        months_data = {}
        
        # Process each attendance record
        for record in attendance_records:
            month_key = f"{record.attendance_date.year}-{record.attendance_date.month:02d}"
            
            if month_key not in months_data:
                months_data[month_key] = {
                    'total_days': 0,
                    'present_days': 0,
                    'year': record.attendance_date.year,
                    'month': record.attendance_date.month
                }
            
            months_data[month_key]['total_days'] += 1
            if record.is_present:
                months_data[month_key]['present_days'] += 1
        
        # Arabic month names
        month_names = [
            'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
            'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'
        ]
        
        # Calculate attendance rate for each month
        results = []
        for month_key in sorted(months_data.keys()):
            month_data = months_data[month_key]
            attendance_rate = 0
            if month_data['total_days'] > 0:
                attendance_rate = round((month_data['present_days'] / month_data['total_days']) * 100, 2)
            
            results.append({
                'period': month_names[month_data['month'] - 1],
                'month': month_data['month'],
                'year': month_data['year'],
                'attendance_rate': attendance_rate,
                'total_days': month_data['total_days'],
                'present_days': month_data['present_days'],
                'month_key': month_key
            })
        
        return results
    
    def get_student_grades_timeline(
        self,
        student_id: int,
        academic_year_id: int
    ) -> List[Dict[str, Any]]:
        """
        Get student's average grades timeline across all subjects
        Timeline order depends on class quizzes_count (2 or 4)
        """
        db = SessionLocal()
        try:
            # Get student to find their class
            student = db.query(Student).filter(Student.id == student_id).first()
            if not student:
                return []
            
            # Get the class to know quizzes_count
            student_class = db.query(Class).filter(
                and_(
                    Class.id == student.class_id,
                    Class.academic_year_id == academic_year_id
                )
            ).first()
            
            if not student_class:
                return []
            
            quizzes_count = student_class.quizzes_count
            
            # Get all academic records for this student in this academic year
            academic_records = db.query(StudentAcademic).filter(
                and_(
                    StudentAcademic.student_id == student_id,
                    StudentAcademic.academic_year_id == academic_year_id
                )
            ).all()
            
            if not academic_records:
                return []
            
            # Calculate averages for each assessment
            timeline = []
            
            if quizzes_count == 2:
                # Order: مذاكرة أولى، امتحان نصفي، مذاكرة ثانية، امتحان نهائي
                assessments = [
                    ('first_quiz_grade', 'مذاكرة أولى'),
                    ('midterm_grades', 'امتحان نصفي'),
                    ('second_quiz_grade', 'مذاكرة ثانية'),
                    ('final_exam_grades', 'امتحان نهائي')
                ]
            else:  # quizzes_count == 4
                # Order: مذاكرة أولى، مذاكرة ثانية، امتحان نصفي، مذاكرة ثالثة، مذاكرة رابعة، امتحان نهائي
                assessments = [
                    ('first_quiz_grade', 'مذاكرة أولى'),
                    ('second_quiz_grade', 'مذاكرة ثانية'),
                    ('midterm_grades', 'امتحان نصفي'),
                    ('third_quiz_grade', 'مذاكرة ثالثة'),
                    ('fourth_quiz_grade', 'مذاكرة رابعة'),
                    ('final_exam_grades', 'امتحان نهائي')
                ]
            
            # Calculate average for each assessment across all subjects
            for field_name, label in assessments:
                grades = []
                for record in academic_records:
                    grade = getattr(record, field_name, None)
                    if grade is not None:
                        grades.append(float(grade))
                
                # Calculate average
                if grades:
                    average = round(sum(grades) / len(grades), 2)
                else:
                    average = 0
                
                timeline.append({
                    'assessment': label,
                    'average_grade': average,
                    'subjects_count': len(grades)
                })
            
            return timeline
            
        finally:
            db.close()
    
    def get_student_grades_by_subject(
        self,
        student_id: int,
        academic_year_id: int
    ) -> List[Dict[str, Any]]:
        """
        Get student's average grades by subject
        Calculates average of all assessments (quizzes + exams) for each subject
        """
        db = SessionLocal()
        try:
            # Get all academic records for this student in this academic year
            academic_records = db.query(StudentAcademic).filter(
                and_(
                    StudentAcademic.student_id == student_id,
                    StudentAcademic.academic_year_id == academic_year_id
                )
            ).all()
            
            if not academic_records:
                return []
            
            # Calculate average for each subject
            subject_averages = []
            
            for record in academic_records:
                # Get subject name
                subject = db.query(Subject).filter(Subject.id == record.subject_id).first()
                if not subject:
                    continue
                
                # Collect all grades for this subject
                grades = []
                
                # Add quiz grades
                if record.first_quiz_grade is not None:
                    grades.append(float(record.first_quiz_grade))
                if record.second_quiz_grade is not None:
                    grades.append(float(record.second_quiz_grade))
                if record.third_quiz_grade is not None:
                    grades.append(float(record.third_quiz_grade))
                if record.fourth_quiz_grade is not None:
                    grades.append(float(record.fourth_quiz_grade))
                
                # Add exam grades
                if record.midterm_grades is not None:
                    grades.append(float(record.midterm_grades))
                if record.final_exam_grades is not None:
                    grades.append(float(record.final_exam_grades))
                
                # Calculate average
                if grades:
                    average = round(sum(grades) / len(grades), 2)
                else:
                    average = 0
                
                subject_averages.append({
                    'subject_name': subject.subject_name,
                    'average_grade': average,
                    'assessments_count': len(grades)
                })
            
            return subject_averages
            
        finally:
            db.close()
    
    def get_student_financial_summary(
        self,
        student_id: int,
        academic_year_id: int
    ) -> Dict[str, Any]:
        """
        Get student's financial summary (paid vs remaining balance)
        Returns data for pie chart display
        """
        db = SessionLocal()
        try:
            from app.models.students import StudentFinance, StudentPayment
            
            # Get student's finance record
            finance = db.query(StudentFinance).filter(
                and_(
                    StudentFinance.student_id == student_id,
                    StudentFinance.academic_year_id == academic_year_id
                )
            ).first()
            
            if not finance:
                return {
                    'total_amount': 0,
                    'total_paid': 0,
                    'remaining_balance': 0,
                    'paid_percentage': 0,
                    'remaining_percentage': 0
                }
            
            # Calculate total amount owed
            total_amount = float(finance.total_amount)
            
            # Get all payments for this student in this academic year
            payments = db.query(StudentPayment).filter(
                and_(
                    StudentPayment.student_id == student_id,
                    StudentPayment.academic_year_id == academic_year_id
                )
            ).all()
            
            # Calculate total paid
            total_paid = sum(float(payment.payment_amount) for payment in payments)
            
            # Calculate remaining balance
            remaining_balance = max(0, total_amount - total_paid)
            
            # Calculate percentages
            if total_amount > 0:
                paid_percentage = round((total_paid / total_amount) * 100, 2)
                remaining_percentage = round((remaining_balance / total_amount) * 100, 2)
            else:
                paid_percentage = 0
                remaining_percentage = 0
            
            return {
                'total_amount': round(total_amount, 2),
                'total_paid': round(total_paid, 2),
                'remaining_balance': round(remaining_balance, 2),
                'paid_percentage': paid_percentage,
                'remaining_percentage': remaining_percentage
            }
            
        finally:
            db.close()
    
    def get_student_behavior_records(
        self,
        student_id: int,
        academic_year_id: int
    ) -> List[Dict[str, Any]]:
        """
        Get student's behavior records (مشاغبة، مشاركة مميزة، بطاقة شكر، ملاحظة، إنذار، استدعاء ولي أمر، فصل)
        Returns all records sorted by date (most recent first)
        """
        db = SessionLocal()
        try:
            # Get all behavior records for this student in this academic year
            records = db.query(StudentBehaviorRecord).filter(
                and_(
                    StudentBehaviorRecord.student_id == student_id,
                    StudentBehaviorRecord.academic_year_id == academic_year_id
                )
            ).order_by(StudentBehaviorRecord.record_date.desc()).all()
            
            # Format records
            formatted_records = []
            for record in records:
                # Get recorded by user name if available
                recorded_by_name = None
                if record.recorded_by_user:
                    recorded_by_name = record.recorded_by_user.username
                
                formatted_records.append({
                    'id': record.id,
                    'record_type': record.record_type,
                    'record_date': record.record_date.isoformat() if record.record_date else None,
                    'description': record.description,
                    'severity': record.severity,
                    'recorded_by': recorded_by_name,
                    'created_at': record.created_at.isoformat() if record.created_at else None
                })
            
            return formatted_records
            
        finally:
            db.close()
