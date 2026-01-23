// School Management System Types
// Based on the backend architecture and database schema

// ===== Authentication & Users =====
export interface User {
    id?: number;
    username: string;
    password_hash?: string; // Never exposed to frontend
    role: UserRole;
    session_type?: 'morning' | 'evening'; // للمشرفين فقط - المدير يرى الاثنين
    is_active: boolean;
    last_login?: string;
    created_at?: string;
}

export type UserRole =
    | 'director'
    | 'finance'
    | 'morning_school'
    | 'evening_school'
    | 'morning_supervisor'
    | 'evening_supervisor'
    | 'admin';

export interface LoginCredentials {
    username: string;
    password: string;
    role: UserRole;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
    user: Omit<User, 'password_hash'>;
}

// ===== Academic Years =====
export interface AcademicYear {
    id?: number;
    year_name: string; // e.g., "2025-2026"
    description?: string;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

// ===== School Structure =====
export interface Class {
    id?: number;
    academic_year_id: number;
    session_type: SessionType;
    grade_level: GradeLevel;
    grade_number: number; // 1-6 for primary, 1-3 for others
    section_count: number;
    max_students_per_section?: number;
    quizzes_count?: 2 | 4; // عدد المذاكرات في الفصل (2 أو 4)
    created_at?: string;
}

export type SessionType = 'morning' | 'evening';
export type GradeLevel = 'primary' | 'intermediate' | 'secondary';

export interface Subject {
    id?: number;
    class_id: number;
    subject_name: string;
    weekly_hours: number;
    is_active?: boolean;
    created_at?: string;
}

// ===== Students ===== (Enhanced based on Arabic specifications)
export interface Student {
    id?: number;
    academic_year_id: number;

    // المعلومات الشخصية - Personal Information
    full_name: string;
    has_special_needs: boolean;
    special_needs_details?: string;
    father_name: string;
    grandfather_name: string; // اسم الجد (اب الاب)
    mother_name: string;
    birth_date: string;
    birth_place?: string;
    nationality?: string;
    father_occupation?: string;
    mother_occupation?: string; // (اختياري)
    religion?: string;
    gender: 'male' | 'female';

    // النقل - Transportation
    transportation_type: TransportationType;
    bus_number?: string;

    // معلومات التواصل - Contact Information
    landline_phone?: string; // رقم ارضي
    father_phone?: string; // رقم الاب
    mother_phone?: string; // رقم الام
    additional_phone?: string; // رقم هاتف اضافي
    detailed_address?: string; // العنوان التفصيلي

    // المعلومات الدراسية - Academic Information
    previous_school?: string; // المدرسة السابقة
    grade_level: GradeLevel; // المرحلة (ابتدائي، اعدادية، ثانوية)
    grade_number: number; // الصف
    section?: string; // الشعبة (اختياري)
    session_type: SessionType;
    ninth_grade_total?: number; // مجموع التاسع (للثانوي)

    notes?: string; // ملاحظات
    is_active: boolean;
    created_at?: string;
    updated_at?: string;

    // Additional fields for comprehensive student data
    photos?: string[]; // Student photos
    additional_info?: string; // Any additional information
}

// النقل - Transportation Types (Arabic specifications)
export type TransportationType =
    | 'walking' // مشي
    | 'full_bus' // باص كامل
    | 'half_bus_to_school' // نص باص بحيث بيروح عالمدرسة عالباص ويرجع مشي
    | 'half_bus_from_school'; // نص باص بحيث يروح عالمدرسة مشي ويرجع بالباص

// Student Create Type - for creating new students
export type StudentCreate = Omit<Student, 'id' | 'created_at' | 'updated_at'>;

// المعلومات المالية - Enhanced Financial Information
export interface StudentFinance {
    id?: number;
    student_id: number;
    academic_year_id: number;

    // Fee Structure - هيكل الرسوم
    school_fee: number; // القسط المدرسي
    school_fee_discount: number; // حسم القسط المدرسي (backward compatibility)
    bus_fee: number; // قسط الباص
    bus_fee_discount: number; // حسم الباص (backward compatibility)
    other_revenues: number; // ايرادات اخرى (backward compatibility)

    // Enhanced Discount Fields - حقول الحسم المحسنة
    school_discount_type: 'percentage' | 'fixed'; // نوع الحسم (نسبة مئوية/مبلغ ثابت)
    school_discount_value: number; // قيمة الحسم
    school_discount_reason?: string; // سبب الحسم (اختياري)
    bus_discount_type: 'percentage' | 'fixed'; // نوع الحسم للباص
    bus_discount_value: number; // قيمة الحسم للباص
    bus_discount_reason?: string; // سبب الحسم للباص

    // Detailed Other Revenues - إيرادات أخرى تفصيلية
    uniform_type?: string; // نوع اللباس
    uniform_amount: number; // مبلغ اللباس
    course_type?: string; // نوع الدورة
    course_amount: number; // مبلغ الدورة
    other_revenue_items?: Array<{ name: string; amount: number; description?: string }>; // إضافات أخرى

    // Calculated Fields - الحقول المحسوبة
    calculated_school_discount?: number; // الحسم المحسوب للقسط المدرسي
    calculated_bus_discount?: number; // الحسم المحسوب للباص
    total_other_revenues?: number; // مجموع الإيرادات الأخرى
    total_amount: number; // الإجمالي: جمع الكل - المخصوم (المبلغ المطلوب من الطالب)
    total_paid?: number; // الاجمالي المسدد: مجموعة الدفعات المسددة
    partial_balance?: number; // الرصيد الجزئي: ما تبقى على الطالب من القسط
    total_balance?: number; // الرصيد الكلي: مجموع رصيد السنة الحالية مع السنوات السابقة
    previous_years_balance: number; // رصيد السنوات السابقة

    payment_notes?: string; // ملاحظات الدفع
    created_at?: string;
    updated_at?: string;
}

// Student Finance Detailed - معلومات مالية تفصيلية للطالب
export interface StudentFinanceDetailed {
    id: number;
    student_id: number;
    student_name: string;
    academic_year_id: number;

    // Fee Structure with discounts
    school_fee: number;
    school_discount_type: 'percentage' | 'fixed';
    school_discount_value: number;
    calculated_school_discount: number;
    school_fee_after_discount: number;

    bus_fee: number;
    bus_discount_type: 'percentage' | 'fixed';
    bus_discount_value: number;
    calculated_bus_discount: number;
    bus_fee_after_discount: number;

    // Other Revenues
    uniform_type?: string;
    uniform_amount: number;
    course_type?: string;
    course_amount: number;
    other_revenue_items?: Array<{ name: string; amount: number; description?: string }>;
    total_other_revenues: number;

    // Totals
    total_amount: number;
    total_paid: number;
    partial_balance: number;
    previous_years_balance: number;
    total_balance: number;

    payment_notes?: string;
    payments: StudentPayment[];
}

// Student Finance Summary - ملخص مالي للطالب (للمسؤول المالي)
export interface StudentFinanceSummary {
    student_id: number;
    full_name: string;
    father_name: string;
    father_phone?: string;
    mother_phone?: string;
    grade_level: GradeLevel;
    grade_level_display?: string;
    grade_number: number;
    section?: string;
    session_type: SessionType;
    total_owed: number;
    total_paid: number;
    balance: number;
    has_outstanding_balance: boolean;
}

export interface StudentPayment {
    id?: number;
    student_id: number;
    academic_year_id: number;
    payment_amount: number; // قيمة الدفعة
    payment_date: string; // تاريخ التسديد
    receipt_number?: string; // رقم امر القبض
    payment_method?: string;
    notes?: string;
    created_at?: string;
}

// المعلومات الدراسية - Enhanced Academic Information
export interface StudentAcademic {
    id?: number;
    student_id: number;
    academic_year_id: number;
    subject_id: number;

    // العلامات - Grades (based on Arabic specifications)
    board_grades?: number; // علامات السبور
    recitation_grades?: number; // علامات التسميع

    // المذاكرات (1-4)
    first_quiz_grade?: number;   // المذاكرة الأولى
    second_quiz_grade?: number;  // المذاكرة الثانية
    third_quiz_grade?: number;   // المذاكرة الثالثة
    fourth_quiz_grade?: number;  // المذاكرة الرابعة

    // الامتحانات
    first_exam_grades?: number;  // علامات المذاكرة الأولى (قديم - للتوافق)
    midterm_grades?: number; // علامات الفحص النصفي
    second_exam_grades?: number; // علامات المذاكرة الثانية (قديم - للتوافق)
    final_exam_grades?: number; // علامات الفحص النهائي

    behavior_grade?: number; // علامة السلوك
    activity_grade?: number; // علامات النشاط

    // الحضور والغياب - Attendance
    absence_days: number; // ايام الغياب (عدد)
    absence_dates?: string; // تاريخ الغياب (JSON array of dates)

    created_at?: string;
    updated_at?: string;

    // Additional calculated fields
    total_grade?: number; // Total calculated grade
    grade_percentage?: number; // Grade as percentage
    attendance_percentage?: number; // Attendance percentage
}

// ===== Teachers ===== (Enhanced based on Arabic specifications)
export interface Teacher {
    id?: number;
    academic_year_id: number;
    session_type: SessionType; // صباحي أو مسائي - for data separation

    // المعلومات العامة - General Information
    full_name: string; // الاسم الكامل
    father_name?: string; // اسم الأب
    gender: 'male' | 'female'; // الجنس
    birth_date?: string; // تاريخ الميلاد
    phone?: string; // رقم تواصل
    nationality?: string; // الجنسية
    detailed_address?: string; // عنوان تفصيلي

    // المواصلات - Transportation (like students)
    transportation_type?: TransportationType;
    bus_number?: string; // رقم الباص

    // الشهادات - Qualifications (stored as JSON array)
    qualifications?: Qualification[]; // Array of qualifications

    // الخبرات - Experience (stored as JSON array)
    experience?: Experience[]; // Array of experiences

    // اوقات فراغه - Free time slots (5 days x 6 periods flat array)
    free_time_slots?: FreeTimeSlot[]; // Flat array of free time slots

    notes?: string; // الملاحظات
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

// Qualification Interface
export interface Qualification {
    id?: string; // Unique ID for each qualification
    degree: string; // الشهادة (e.g., "بكالوريوس", "ماجستير", "دكتوراه")
    specialization: string; // التخصص (e.g., "رياضيات", "فيزياء")
    institution: string; // المؤسسة/الجامعة
    graduation_year?: string; // سنة التخرج
    grade?: string; // التقدير (e.g., "امتياز", "جيد جداً")
    notes?: string; // ملاحظات
}

// Experience Interface
export interface Experience {
    id?: string; // Unique ID for each experience
    job_title: string; // المسمى الوظيفي
    institution: string; // المؤسسة/المدرسة
    start_date: string; // تاريخ البداية
    end_date?: string; // تاريخ النهاية (اختياري if still working)
    description?: string; // وصف العمل
    responsibilities?: string; // المسؤوليات
}

// Free Time Slot Interface
export interface FreeTimeSlot {
    day: number; // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday
    period: number; // 1-6 for periods
    is_free: boolean; // true = free/available (green), false = unavailable (gray)
    status?: 'free' | 'assigned' | 'unavailable'; // Backend uses this field
    assignment?: {
        subject_id?: number;
        subject_name?: string;
        class_id?: number;
        class_name?: string;
        section?: string;
        schedule_id?: number;
    };
}

export interface TeacherAssignment {
    id?: number;
    teacher_id: number;
    class_id: number;
    subject_id: number;
    section?: string;
    created_at?: string;
}

// حصصه والاضافي - Teacher attendance and extra work tracking
export interface TeacherAttendance {
    id?: number;
    teacher_id: number;
    attendance_date: string;
    classes_attended: number; // هل داوم الحصص
    extra_classes: number; // هل عطى اضافي
    session_type: SessionType; // صباحي أو مسائي
    total_hours_worked: number; // مجموع الساعات المعمولة
    hourly_rate?: number; // سعر الحصة (للحساب التلقائي للراتب)
    calculated_salary?: number; // الراتب المحسوب تلقائياً
    notes?: string;
    status?: 'present' | 'absent' | 'late' | 'excused'; // Add status field
    created_at?: string;
}

// ===== Financial Management =====
export interface FinanceCategory {
    id?: number;
    category_name: string;
    category_type: 'income' | 'expense';
    is_default: boolean;
    is_active: boolean;
    created_at?: string;
}

export interface FinanceTransaction {
    id?: number;
    academic_year_id: number;
    category_id: number;
    transaction_type: 'income' | 'expense';
    amount: number;
    transaction_date: string;
    description?: string;
    reference_id?: number; // Links to students, teachers, activities etc.
    reference_type?: string; // 'student', 'teacher', 'activity', etc.
    receipt_number?: string;
    created_by?: number;
    created_at?: string;
}

export interface Budget {
    id?: number;
    academic_year_id: number;
    category: string;
    budgeted_amount: number;
    period_type: 'annual' | 'monthly' | 'quarterly';
    period_value?: number; // month number, quarter number, etc.
    description?: string;
    spent_amount?: number;
    remaining_amount?: number;
    created_at?: string;
    updated_at?: string;
}

// ===== Finance Cards - الكاردات المالية =====
export interface FinanceCard {
    id?: number;
    academic_year_id: number;
    card_name: string; // اسم الكارد
    card_type: 'income' | 'expense' | 'both'; // دخل / خرج / دخل وخرج
    category: 'activity' | 'student' | 'custom'; // نشاط / طلاب / مخصص
    reference_id?: number; // ID of activity or other reference
    reference_type?: string; // 'activity', 'custom', etc.
    is_default: boolean; // افتراضي (نشاطات/طلاب) أم مخصص
    created_date: string; // تاريخ الإنشاء
    description?: string; // تفاصيل
    status: 'open' | 'closed' | 'partial'; // مفتوح / مغلق / جزئي
    created_at?: string;
    updated_at?: string;
}

// Finance Card Transaction - معاملات الكارد المالي
export interface FinanceCardTransaction {
    id?: number;
    card_id: number;
    transaction_type: 'income' | 'expense'; // مدخول / مصروف
    amount: number; // المبلغ
    payer_name?: string; // اسم الدافع/المستلم
    responsible_person?: string; // المسؤول عن العملية
    transaction_date: string; // تاريخ العملية
    is_completed: boolean; // هل اكتملت الدفعة 100%
    completion_percentage: number; // نسبة الإنجاز (0-100)
    notes?: string; // معلومات إضافية
    created_at?: string;
    updated_at?: string;
}

// Finance Card Summary - ملخص الكارد المالي
export interface FinanceCardSummary {
    card_id: number;
    card_name: string;
    card_type: 'income' | 'expense' | 'both';
    category: string; // activity, student, custom
    is_default?: boolean; // افتراضي (نشاطات/طلاب) أم مخصص
    total_income: number; // إجمالي المدخولات
    total_expenses: number; // إجمالي المصروفات
    net_amount: number; // الصافي (المدخولات - المصروفات)
    incomplete_transactions_count: number; // عدد المعاملات غير المكتملة
    status: 'open' | 'closed' | 'partial';
}

// Finance Card Detailed - تفاصيل الكارد المالي
export interface FinanceCardDetailed {
    card: FinanceCard;
    transactions: FinanceCardTransaction[];
    summary: {
        total_income: number;
        total_expenses: number;
        net_amount: number;
        completed_transactions_count: number;
        incomplete_transactions_count: number;
    };
}

// Historical Balance - الرصيد التاريخي
export interface HistoricalBalance {
    id?: number;
    student_id: number;
    academic_year_id: number;
    balance_amount: number; // المبلغ المتبقي
    balance_type: 'receivable' | 'payable'; // receivable: دين للمدرسة, payable: دين على المدرسة
    is_transferred: boolean; // هل تم نقله للسنة الجديدة
    transfer_date?: string; // تاريخ النقل
    notes?: string;
    created_at?: string;
    updated_at?: string;
}

// Finance Manager Dashboard Data - بيانات لوحة المسؤول المالي
export interface FinanceManagerDashboard {
    net_profit: number; // صافي الربح
    total_receivables: number; // إجمالي المستحقات (الديون للمدرسة)
    total_payables: number; // إجمالي المستحقات على المدرسة (الديون)
    finance_cards: FinanceCardSummary[]; // الكاردات المالية
    summary: {
        total_income: number;
        total_expenses: number;
    };
    rewards_and_assistance?: {
        total_rewards: number;
        total_assistance: number;
        total: number;
    };
}

// ===== Activities Management =====
export interface Activity {
    id?: number;
    academic_year_id: number;
    name: string;
    description?: string;
    activity_type: 'academic' | 'sports' | 'cultural' | 'social' | 'trip';
    session_type: 'morning' | 'evening' | 'both';
    target_grades: string[]; // ["grade_1", "grade_2", etc.]
    max_participants?: number;
    cost_per_student: number;
    start_date: string;
    end_date: string;
    registration_deadline?: string;
    location?: string;
    instructor_name?: string;
    requirements?: string;
    is_active: boolean;
    current_participants?: number;
    images?: string[]; // Activity images

    // Financial Fields - الحقول المالية
    total_cost: number; // التكلفة الإجمالية للنشاط
    total_revenue: number; // المدخولات الإجمالية
    additional_expenses?: Array<{ name: string; amount: number; description?: string }>; // مصاريف إضافية
    additional_revenues?: Array<{ name: string; amount: number; description?: string }>; // مدخولات إضافية
    financial_status: 'profitable' | 'loss' | 'pending'; // مربح / خسارة / معلق
    net_profit?: number; // الربح الصافي (محسوب)

    created_at?: string;
    updated_at?: string;
}

export interface ActivityParticipant {
    id?: number;
    activity_id: number;
    class_id: number;
    section?: string;
    is_participating: boolean;
    created_at?: string;
}

export interface StudentActivityParticipation {
    id?: number;
    student_id: number;
    activity_id: number;
    is_participating: boolean;
    created_at?: string;
}

// Activity Registration Interface
export interface ActivityRegistration {
    id?: number;
    student_id: number;
    activity_id: number;
    registration_date: string;
    payment_status: 'pending' | 'paid' | 'cancelled';
    payment_amount: number;
    notes?: string;
    student_name?: string;
    activity_name?: string;
    created_at?: string;
    updated_at?: string;
}

// Activity Schedule Interface
export interface ActivitySchedule {
    id?: number;
    activity_id: number;
    day_of_week: number; // 0=Monday, 1=Tuesday, ..., 6=Sunday
    start_time: string; // ISO time format
    end_time: string; // ISO time format
    location?: string;
    instructor_name?: string;
    notes?: string;
    activity_name?: string;
    day_name?: string;
    created_at?: string;
    updated_at?: string;
}

// Activity Attendance Interface
export interface ActivityAttendance {
    id?: number;
    registration_id: number;
    attendance_date: string;
    status: 'present' | 'absent' | 'excused';
    notes?: string;
    student_name?: string;
    activity_name?: string;
    created_at?: string;
    updated_at?: string;
}

// ===== Schedule Management =====
export interface Schedule {
    id?: number;
    academic_year_id: number;
    session_type: SessionType;
    class_id: number;
    section?: string;
    day_of_week: number; // 1-7 (Monday-Sunday)
    period_number: number;
    subject_id: number;
    teacher_id: number;
    created_at?: string;
}

export interface ScheduleConstraint {
    id?: number;
    academic_year_id: number;
    constraint_type: ConstraintType;

    // Target Specification
    class_id?: number;
    subject_id?: number;
    teacher_id?: number;

    // Time Specification
    day_of_week?: number; // 1-7 (Monday-Sunday), NULL for any day
    period_number?: number; // 1-8, NULL for any period
    time_range_start?: number;
    time_range_end?: number;

    // Consecutive Constraints
    max_consecutive_periods?: number;
    min_consecutive_periods?: number;

    // Advanced Options
    applies_to_all_sections: boolean;
    session_type: SessionType | 'both';
    priority_level: number; // 1=Low, 2=Medium, 3=High, 4=Critical

    description?: string;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

export type ConstraintType =
    | 'forbidden'
    | 'required'
    | 'no_consecutive'
    | 'max_consecutive'
    | 'min_consecutive';

// Constraint Template Interface
export interface ConstraintTemplate {
    id: number;
    template_name: string;
    template_description: string;
    constraint_config: Partial<ScheduleConstraint>;
    is_system_template: boolean;
    created_at?: string;
    updated_at?: string;
}

// ===== Director Dashboard =====

// ===== API Response Types =====
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: string[];
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
}

// ===== Search and Filter Types =====
export interface SearchParams {
    query?: string;
    academic_year_id?: number;
    session_type?: SessionType;
    grade_level?: GradeLevel;
    is_active?: boolean;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export interface StudentSearchResult {
    id: number;
    name: string;
    father_name: string;
    grade: string;
    section?: string;
    session: SessionType;
    status: 'current' | 'former';
    type: 'student';
    academic_year: number;
    has_financial_dues?: boolean;
}

export interface TeacherSearchResult {
    id: number;
    name: string;
    subjects: string[];
    classes?: string[];
    phone?: string;
    status: 'current' | 'former';
    type: 'teacher';
    academic_year: number;
}

export interface UniversalSearchResult {
    students: {
        current: StudentSearchResult[];
        former: StudentSearchResult[];
    };
    teachers: {
        current: TeacherSearchResult[];
        former: TeacherSearchResult[];
    };
    total_results: number;
}

// ===== Dashboard Analytics =====
export interface DashboardStats {
    total_students: number;
    total_teachers: number;
    monthly_revenue: number;
    active_activities: number;
    recent_activities: DashboardActivity[];
}

export interface DashboardActivity {
    id: number;
    type: 'student_registration' | 'payment' | 'schedule_creation' | 'teacher_added';
    title: string;
    description: string;
    timestamp: string;
    icon?: string;
    color?: string;
}

// ===== Form Types =====
export interface StudentRegistrationForm {
    // Personal Information
    full_name: string;
    father_name: string;
    grandfather_name: string;
    mother_name: string;
    birth_date: string;
    birth_place?: string;
    nationality?: string;
    gender: 'male' | 'female';
    religion?: string;

    // Parents Information
    father_occupation?: string;
    mother_occupation?: string;
    landline_phone?: string;
    father_phone?: string;
    mother_phone?: string;
    additional_phone?: string;
    detailed_address?: string;

    // Academic Information
    grade_level: GradeLevel;
    grade_number: number;
    section?: string;
    session_type: SessionType;
    previous_school?: string;
    ninth_grade_total?: number;

    // Special Needs
    has_special_needs: boolean;
    special_needs_details?: string;

    // Transportation
    transportation_type: TransportationType;
    bus_number?: string;

    // Additional
    notes?: string;
}

export interface TeacherRegistrationForm {
    full_name: string;
    gender: 'male' | 'female';
    birth_date?: string;
    phone?: string;
    nationality?: string;
    detailed_address?: string;
    transportation_type?: TransportationType;
    qualifications?: string;
    experience?: string;
    notes?: string;
}

// ===== File Management =====
export interface FileItem {
    id: number;
    filename: string;
    original_filename: string;
    file_path: string;
    file_size: number;
    file_type: string;
    uploaded_by: number;
    related_entity_type?: string;
    related_entity_id?: number;
    is_active: boolean;
    created_at: string;
}

export interface StorageStats {
    total_size: number;
    used_size: number;
    free_size: number;
    file_count: number;
}

// ===== System Configuration =====
export interface SystemSettings {
    id?: number;
    setting_key: string;
    setting_value?: string;
    description?: string;
    updated_at?: string;
}

export interface BackupHistory {
    id?: number;
    backup_path: string;
    backup_date: string;
    backup_size?: number;
    status: 'success' | 'failed';
    error_message?: string;
}

// ===== Director Tools =====
export interface DirectorNote {
    id?: number;
    academic_year_id: number;
    folder_type: 'goals' | 'projects' | 'blogs' | 'notes' | 'educational_admin';
    title: string;
    content: string;
    note_date: string;
    created_at?: string;
    updated_at?: string;
}

export interface Reward {
    id?: number;
    academic_year_id: number;
    title: string;
    reward_date: string;
    recipient_name: string;
    recipient_type: 'student' | 'teacher' | 'other';
    amount: number;
    description?: string;
    created_at?: string;
    updated_at?: string;
}

export interface AssistanceRecord {
    id?: number;
    academic_year_id: number;
    title: string;
    assistance_date: string;
    organization: string;
    amount: number;
    description?: string;
    created_at?: string;
    updated_at?: string;
}
