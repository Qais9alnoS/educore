from sqlalchemy import Column, Integer, String, Text, Boolean, Date, Numeric, ForeignKey, JSON, Time, DateTime
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class TimeSlot(BaseModel):
    __tablename__ = "time_slots"
    
    # Time slot attributes
    schedule_id = Column(Integer, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False)
    period_number = Column(Integer, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 1-7 (Monday-Sunday)
    is_break = Column(Boolean, default=False)
    break_name = Column(String(50))
    
    # Relationships
    schedule = relationship("Schedule", back_populates="time_slots")
    
class ScheduleAssignment(BaseModel):
    __tablename__ = "schedule_assignments"
    
    # Schedule assignment attributes
    schedule_id = Column(Integer, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False)
    time_slot_id = Column(Integer, ForeignKey("time_slots.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    room = Column(String(50))
    notes = Column(Text)
    
    # Relationships
    schedule = relationship("Schedule")
    time_slot = relationship("TimeSlot")
    teacher = relationship("Teacher")
    subject = relationship("Subject")
    class_rel = relationship("Class")

class ScheduleConflict(BaseModel):
    __tablename__ = "schedule_conflicts"
    
    # Schedule conflict attributes
    schedule_id = Column(Integer, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False)
    conflict_type = Column(String(50), nullable=False)  # teacher_overlap, room_overlap, etc.
    description = Column(Text)
    severity = Column(String(20), default="medium")  # low, medium, high, critical
    affected_assignments = Column(Text)  # JSON format for assignment IDs
    resolution_suggestions = Column(Text)  # JSON format for suggestions
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True))
    
    # Relationships
    schedule = relationship("Schedule")

class Schedule(BaseModel):
    __tablename__ = "schedules"
    
    # Schedule attributes
    academic_year_id = Column(Integer, ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False)
    session_type = Column(String(10), nullable=False)  # morning, evening
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    section = Column(String(10))
    day_of_week = Column(Integer)  # 1-7 (Monday-Sunday)
    period_number = Column(Integer)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    name = Column(String(100))
    start_date = Column(Date)
    end_date = Column(Date)
    is_active = Column(Boolean, default=True)
    status = Column(String(20), default="draft")  # draft, published
    description = Column(Text)
    
    # Relationships
    academic_year = relationship("AcademicYear")
    class_rel = relationship("Class", back_populates="schedules")
    subject = relationship("Subject")
    teacher = relationship("Teacher")
    time_slots = relationship("TimeSlot", back_populates="schedule")

class ScheduleConstraint(BaseModel):
    __tablename__ = "schedule_constraints"
    
    # Schedule constraint attributes
    academic_year_id = Column(Integer, ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False)
    constraint_type = Column(String(20), nullable=False)  # forbidden, required, no_consecutive, max_consecutive, min_consecutive, subject_per_day, before_after
    
    # Target Specification
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="CASCADE"))
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"))
    teacher_id = Column(Integer, ForeignKey("teachers.id"))
    
    # Time Specification
    day_of_week = Column(Integer)  # 1-7 (Monday-Sunday), NULL for any day
    period_number = Column(Integer)  # 1-8, NULL for any period
    time_range_start = Column(Integer)  # For range constraints (e.g., periods 1-4)
    time_range_end = Column(Integer)
    
    # Consecutive Constraints
    max_consecutive_periods = Column(Integer)  # For consecutive constraints
    min_consecutive_periods = Column(Integer)
    
    # Before/After Constraint
    reference_subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"))  # For before_after constraint
    placement = Column(String(10))  # 'before' or 'after' for before_after constraint
    
    # Advanced Options
    applies_to_all_sections = Column(Boolean, default=False)
    session_type = Column(String(10), default="both")  # morning, evening, both
    priority_level = Column(Integer, default=1)  # 1=Low, 2=Medium, 3=High, 4=Critical
    
    # Metadata
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    academic_year = relationship("AcademicYear")
    class_rel = relationship("Class")
    subject = relationship("Subject", foreign_keys=[subject_id])
    teacher = relationship("Teacher")
    reference_subject = relationship("Subject", foreign_keys=[reference_subject_id])

class ConstraintTemplate(BaseModel):
    __tablename__ = "constraint_templates"
    
    # Constraint template attributes
    template_name = Column(String(100), nullable=False)
    template_description = Column(Text)
    constraint_config = Column(JSON)  # Stores constraint configuration
    is_system_template = Column(Boolean, default=False)

class ScheduleGenerationHistory(BaseModel):
    __tablename__ = "schedule_generation_history"
    
    # Schedule generation history attributes
    academic_year_id = Column(Integer, ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False)
    session_type = Column(String(10), nullable=False)  # morning, evening
    generation_algorithm = Column(String(50))  # 'genetic', 'backtrack', 'greedy'
    generation_parameters = Column(JSON)
    constraints_count = Column(Integer)
    conflicts_resolved = Column(Integer)
    generation_time_seconds = Column(Integer)
    quality_score = Column(Numeric(5,2))  # 0-100 rating of schedule quality
    status = Column(String(10), nullable=False)  # success, partial, failed
    error_message = Column(Text)
    
    # Relationships
    academic_year = relationship("AcademicYear")