from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal

class StudentBase(BaseModel):
    full_name: str
    has_special_needs: bool = False
    special_needs_details: Optional[str] = None
    father_name: str
    grandfather_name: str
    mother_name: str
    birth_date: date
    birth_place: Optional[str] = None
    nationality: Optional[str] = None
    father_occupation: Optional[str] = None
    mother_occupation: Optional[str] = None
    religion: Optional[str] = None
    gender: str  # male, female
    transportation_type: str
    bus_number: Optional[str] = None
    landline_phone: Optional[str] = None
    father_phone: Optional[str] = None
    mother_phone: Optional[str] = None
    additional_phone: Optional[str] = None
    detailed_address: Optional[str] = None
    previous_school: Optional[str] = None
    grade_level: str  # primary, intermediate, secondary
    grade_number: int
    section: Optional[str] = None
    session_type: str  # morning, evening
    ninth_grade_total: Optional[Decimal] = None
    notes: Optional[str] = None
    class_id: Optional[int] = None

class StudentCreate(StudentBase):
    academic_year_id: int

class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    has_special_needs: Optional[bool] = None
    special_needs_details: Optional[str] = None
    father_name: Optional[str] = None
    grandfather_name: Optional[str] = None
    mother_name: Optional[str] = None
    birth_date: Optional[date] = None
    birth_place: Optional[str] = None
    nationality: Optional[str] = None
    father_occupation: Optional[str] = None
    mother_occupation: Optional[str] = None
    religion: Optional[str] = None
    gender: Optional[str] = None
    transportation_type: Optional[str] = None
    bus_number: Optional[str] = None
    landline_phone: Optional[str] = None
    father_phone: Optional[str] = None
    mother_phone: Optional[str] = None
    additional_phone: Optional[str] = None
    detailed_address: Optional[str] = None
    previous_school: Optional[str] = None
    grade_level: Optional[str] = None
    grade_number: Optional[int] = None
    section: Optional[str] = None
    session_type: Optional[str] = None
    ninth_grade_total: Optional[Decimal] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class StudentResponse(StudentBase):
    id: int
    academic_year_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class StudentFinanceBase(BaseModel):
    school_fee: Decimal = Decimal('0')
    school_fee_discount: Decimal = Decimal('0')
    bus_fee: Decimal = Decimal('0')
    bus_fee_discount: Decimal = Decimal('0')
    other_revenues: Decimal = Decimal('0')
    
    # Enhanced Discount Fields
    school_discount_type: str = "fixed"  # percentage, fixed
    school_discount_value: Decimal = Decimal('0')
    school_discount_reason: Optional[str] = None
    bus_discount_type: str = "fixed"  # percentage, fixed
    bus_discount_value: Decimal = Decimal('0')
    bus_discount_reason: Optional[str] = None
    
    # Detailed Other Revenues
    uniform_type: Optional[str] = None
    uniform_amount: Decimal = Decimal('0')
    course_type: Optional[str] = None
    course_amount: Decimal = Decimal('0')
    other_revenue_items: Optional[List[dict]] = None
    
    # Historical Balance
    previous_years_balance: Decimal = Decimal('0')
    
    payment_notes: Optional[str] = None

class StudentFinanceCreate(StudentFinanceBase):
    student_id: int
    academic_year_id: int

class StudentFinanceUpdate(BaseModel):
    school_fee: Optional[Decimal] = None
    school_fee_discount: Optional[Decimal] = None
    bus_fee: Optional[Decimal] = None
    bus_fee_discount: Optional[Decimal] = None
    other_revenues: Optional[Decimal] = None
    school_discount_type: Optional[str] = None
    school_discount_value: Optional[Decimal] = None
    school_discount_reason: Optional[str] = None
    bus_discount_type: Optional[str] = None
    bus_discount_value: Optional[Decimal] = None
    bus_discount_reason: Optional[str] = None
    uniform_type: Optional[str] = None
    uniform_amount: Optional[Decimal] = None
    course_type: Optional[str] = None
    course_amount: Optional[Decimal] = None
    other_revenue_items: Optional[List[dict]] = None
    previous_years_balance: Optional[Decimal] = None
    payment_notes: Optional[str] = None

class StudentFinanceResponse(StudentFinanceBase):
    id: int
    student_id: int
    academic_year_id: int
    calculated_school_discount: Decimal
    calculated_bus_discount: Decimal
    total_other_revenues: Decimal
    total_amount: Decimal
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class StudentFinanceDetailedResponse(BaseModel):
    """Detailed financial response with calculated fields"""
    id: int
    student_id: int
    student_name: str
    academic_year_id: int
    
    # Fee Structure
    school_fee: Decimal
    school_discount_type: str
    school_discount_value: Decimal
    calculated_school_discount: Decimal
    school_fee_after_discount: Decimal
    
    bus_fee: Decimal
    bus_discount_type: str
    bus_discount_value: Decimal
    calculated_bus_discount: Decimal
    bus_fee_after_discount: Decimal
    
    # Other Revenues
    uniform_type: Optional[str]
    uniform_amount: Decimal
    course_type: Optional[str]
    course_amount: Decimal
    other_revenue_items: Optional[List[dict]]
    total_other_revenues: Decimal
    
    # Totals
    total_amount: Decimal  # Total owed
    total_paid: Decimal  # Total payments made
    partial_balance: Decimal  # Current year balance
    previous_years_balance: Decimal
    total_balance: Decimal  # Total balance including previous years
    
    payment_notes: Optional[str]
    payments: List['StudentPaymentResponse']
    
    class Config:
        from_attributes = True

class StudentPaymentBase(BaseModel):
    payment_amount: Decimal
    payment_date: date
    receipt_number: Optional[str] = None
    payment_method: Optional[str] = None
    payment_status: Optional[str] = "pending"  # pending, completed, overdue
    notes: Optional[str] = None

class StudentPaymentCreate(StudentPaymentBase):
    student_id: int
    academic_year_id: int

class StudentPaymentResponse(StudentPaymentBase):
    id: int
    student_id: int
    academic_year_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class StudentAcademicBase(BaseModel):
    board_grades: Optional[Decimal] = None
    recitation_grades: Optional[Decimal] = None
    
    # Quiz grades (المذاكرات)
    first_quiz_grade: Optional[Decimal] = None
    second_quiz_grade: Optional[Decimal] = None
    third_quiz_grade: Optional[Decimal] = None
    fourth_quiz_grade: Optional[Decimal] = None
    
    # Exam grades (الامتحانات)
    midterm_grades: Optional[Decimal] = None
    final_exam_grades: Optional[Decimal] = None
    
    behavior_grade: Optional[Decimal] = None
    activity_grade: Optional[Decimal] = None
    absence_days: int = 0
    absence_dates: Optional[str] = None

class StudentAcademicCreate(StudentAcademicBase):
    student_id: int
    academic_year_id: int
    subject_id: int

class StudentAcademicUpdate(StudentAcademicBase):
    pass

class StudentAcademicResponse(StudentAcademicBase):
    id: int
    student_id: int
    academic_year_id: int
    subject_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Historical Balance Schemas
class HistoricalBalanceBase(BaseModel):
    balance_amount: Decimal
    balance_type: str  # receivable, payable
    notes: Optional[str] = None

class HistoricalBalanceCreate(HistoricalBalanceBase):
    student_id: int
    academic_year_id: int

class HistoricalBalanceResponse(HistoricalBalanceBase):
    id: int
    student_id: int
    academic_year_id: int
    is_transferred: bool
    transfer_date: Optional[date]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Student Finance Summary for Manager
class StudentFinanceSummary(BaseModel):
    """Summary view for finance manager"""
    student_id: int
    full_name: str
    father_name: str
    father_phone: Optional[str]
    mother_phone: Optional[str]
    grade_level: str
    grade_number: int
    section: Optional[str]
    session_type: str
    total_owed: Decimal
    total_paid: Decimal
    balance: Decimal
    has_outstanding_balance: bool
    
    class Config:
        from_attributes = True
