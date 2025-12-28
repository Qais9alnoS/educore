// API Service Layer for Python FastAPI Backend Integration
import {
  User, UserRole, AuthResponse, LoginCredentials,
  AcademicYear,
  Class, Subject,
  Student, StudentFinance, StudentPayment, StudentAcademic,
  StudentFinanceSummary, StudentFinanceDetailed,
  Teacher, TeacherAssignment, TeacherAttendance,
  FinanceCategory, FinanceTransaction, Budget,
  FinanceCard, FinanceCardTransaction, FinanceCardSummary, FinanceCardDetailed,
  HistoricalBalance, FinanceManagerDashboard,
  Activity, ActivityParticipant, StudentActivityParticipation,
  ActivityRegistration, ActivitySchedule, ActivityAttendance,
  Schedule, ScheduleConstraint, ConstraintTemplate,
  DirectorNote, Reward, AssistanceRecord,
  FileItem, StorageStats
} from '../types/school';
import { HistoryLog, HistoryStatistics, HistoryFilters, HistoryListResponse } from '../types/history';
import { getSecurityHeaders } from '@/lib/security';

// Base API configuration
const API_BASE_URL = typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';
const API_TIMEOUT = 30000; // 30 seconds

// Global token storage (in-memory only, not localStorage)
let currentToken: string | null = null;

// Function to set token (called from AuthContext)
export const setApiToken = (token: string | null) => {
  currentToken = token;
};

// Function to get token
export const getApiToken = (): string | null => {
  return currentToken;
};

// Types for API responses
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  detail?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// Enhanced error handling
class ApiError extends Error {
  public status: number;
  public code: string;
  public details?: any;

  constructor(message: string, status: number, code: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Request interceptor for authentication
class ApiClient {
  private baseURL: string;
  private timeout: number;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;

  constructor(baseURL: string = API_BASE_URL, timeout: number = API_TIMEOUT) {
    this.baseURL = baseURL;
    this.timeout = timeout;
  }

  private getAuthHeaders(): HeadersInit {
    // Use in-memory token instead of localStorage
    const token = getApiToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': 'ar,en',
      ...getSecurityHeaders(),
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    attempt: number = 1
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // Check if this is an authentication endpoint (login, register, etc.)
    const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/register');

    // Temporarily suppress console errors for auth endpoints to avoid logging expected 401 errors
    let originalConsoleError: typeof console.error | null = null;
    if (isAuthEndpoint) {
      originalConsoleError = console.error;
      console.error = () => {}; // Suppress console errors
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getAuthHeaders(),
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Restore console.error if it was suppressed
      if (isAuthEndpoint && originalConsoleError) {
        console.error = originalConsoleError;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        // Handle authentication errors
        if (response.status === 401) {
          // For auth endpoints (like login), 401 is expected for wrong credentials
          // Don't log to console as this is normal behavior
          if (isAuthEndpoint) {
            // Return error response without throwing to avoid console error
            return {
              success: false,
              message: errorData?.detail || 'اسم المستخدم أو كلمة المرور غير صحيحة',
              errors: errorData?.errors,
              detail: errorData?.detail
            };
          }

          // For other endpoints, throw error normally
          // Don't automatically logout - let AuthContext handle it
          throw new ApiError(
            errorData?.detail || 'Authentication required',
            401,
            'UNAUTHORIZED',
            errorData
          );
        }

        // Handle validation errors (422)
        if (response.status === 422 && errorData?.errors && Array.isArray(errorData.errors)) {
          // Extract validation error messages
          const validationMessages = errorData.errors
            .map((err: any) => err.msg || err.message)
            .filter(Boolean)
            .join(', ');

          throw new ApiError(
            validationMessages || errorData?.detail || 'خطأ في التحقق من البيانات',
            response.status,
            'VALIDATION_ERROR',
            errorData
          );
        }

        throw new ApiError(
          errorData?.message || errorData?.detail || `HTTP ${response.status}`,
          response.status,
          errorData?.code || 'HTTP_ERROR',
          errorData
        );
      }

      const data = await response.json();

      // Handle both response formats:
      // 1. Direct data (standard API response)
      // 2. Wrapped response with success/data properties
      if (data && typeof data === 'object' && 'success' in data) {
        // Wrapped response format
        return {
          success: data.success,
          data: data.data,
          message: data.message,
          errors: data.errors,
          detail: data.detail
        };
      } else {
        // Direct data format (standard API response)
        return {
          success: true,
          data: data
        };
      }
    } catch (error) {
      clearTimeout(timeoutId);

      // Restore console.error if it was suppressed
      if (isAuthEndpoint && originalConsoleError) {
        console.error = originalConsoleError;
      }

      // Retry logic for network errors
      if (attempt < this.retryAttempts && error instanceof TypeError) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        return this.makeRequest<T>(endpoint, options, attempt + 1);
      }

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        error instanceof Error ? error.message : 'Network error',
        0,
        'NETWORK_ERROR'
      );
    } finally {
      // Final safety check to restore console.error
      if (isAuthEndpoint && originalConsoleError && console.error !== originalConsoleError) {
        console.error = originalConsoleError;
      }
    }
  }

  // HTTP methods
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    // Sanitize input data before sending
    const sanitizedData = this.sanitizeInput(data);
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(sanitizedData),
    });
  }

  async put<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    // Sanitize input data before sending
    const sanitizedData = this.sanitizeInput(data);
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(sanitizedData),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' });
  }

  async patch<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    // Sanitize input data before sending
    const sanitizedData = this.sanitizeInput(data);
    return this.makeRequest<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(sanitizedData),
    });
  }

  // Input sanitization to prevent injection attacks
  private sanitizeInput(data: any): any {
    if (typeof data === 'string') {
      // Check if it's a JSON string (starts with [ or {) - don't sanitize JSON
      if ((data.startsWith('[') && data.endsWith(']')) || (data.startsWith('{') && data.endsWith('}'))) {
        try {
          // Validate it's actually valid JSON
          JSON.parse(data);
          // If valid JSON, return as-is without sanitization
          return data;
        } catch {
          // If not valid JSON, proceed with sanitization
        }
      }

      // Sanitize strings
      return data
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    } else if (Array.isArray(data)) {
      // Recursively sanitize array elements
      return data.map(item => this.sanitizeInput(item));
    } else if (typeof data === 'object' && data !== null) {
      // Recursively sanitize object properties
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Don't sanitize standard property keys, only user input
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    return data;
  }
}

// Create API client instance
const apiClient = new ApiClient();

// Classes API
export const classesApi = {
  getAll: async (params?: { academic_year_id?: number; session_type?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.academic_year_id) {
      queryParams.append('academic_year_id', params.academic_year_id.toString());
    }
    if (params?.session_type) {
      queryParams.append('session_type', params.session_type);
    }
    const queryString = queryParams.toString();
    return apiClient.get<Class[]>(`/academic/classes${queryString ? `?${queryString}` : ''}`);
  },

  getById: async (id: number) => {
    return apiClient.get<Class>(`/academic/classes/${id}`);
  },

  create: async (cls: Omit<Class, 'id' | 'created_at' | 'updated_at'>) => {
    return apiClient.post<Class>('/academic/classes', cls);
  },

  update: async (id: number, cls: Partial<Class>) => {
    return apiClient.put<Class>(`/academic/classes/${id}`, cls);
  },

  delete: async (id: number) => {
    return apiClient.delete<{ message: string }>(`/academic/classes/${id}`);
  },
};

// Subjects API
export const subjectsApi = {
  getAll: async (params?: { class_id?: number; academic_year_id?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.class_id) {
      queryParams.append('class_id', params.class_id.toString());
    }
    if (params?.academic_year_id) {
      queryParams.append('academic_year_id', params.academic_year_id.toString());
    }
    const queryString = queryParams.toString();
    return apiClient.get<Subject[]>(`/academic/subjects${queryString ? `?${queryString}` : ''}`);
  },

  getById: async (id: number) => {
    return apiClient.get<Subject>(`/academic/subjects/${id}`);
  },

  create: async (subject: Omit<Subject, 'id' | 'created_at'>) => {
    return apiClient.post<Subject>('/academic/subjects', subject);
  },

  update: async (id: number, subject: Partial<Subject>) => {
    return apiClient.put<Subject>(`/academic/subjects/${id}`, subject);
  },

  delete: async (id: number) => {
    return apiClient.delete<{ message: string }>(`/academic/subjects/${id}`);
  },
};

// Authentication API
export const authApi = {
  login: async (credentials: LoginCredentials) => {
    return apiClient.post<AuthResponse>('/auth/login', credentials);
  },

  logout: async () => {
    return apiClient.post<void>('/auth/logout', {});
  },

  changePassword: async (data: { current_password: string; new_password: string }) => {
    return apiClient.post<void>('/auth/change-password', data);
  },

  getMe: async () => {
    return apiClient.get<Omit<User, 'password_hash'>>('/auth/me');
  },

  refresh: async () => {
    return apiClient.post<AuthResponse>('/auth/refresh', {});
  },

  resetPassword: async (data: { username: string; role: string }) => {
    return apiClient.post<void>('/auth/reset-password', data);
  },

  createUser: async (data: { username: string; password: string; role: string; session_type?: string }) => {
    return apiClient.post<{ id: number; username: string; role: string; is_active: boolean }>('/auth/create-user', data);
  },

  getAllUsers: async () => {
    return apiClient.get<Array<{
      id: number;
      username: string;
      role: string;
      session_type?: string;
      is_active: boolean;
      last_login?: string;
      created_at?: string;
    }>>('/auth/users');
  },

  updateUsername: async (new_username: string) => {
    return apiClient.put<void>('/auth/update-username', { new_username });
  },

  deleteUser: async (userId: number) => {
    return apiClient.delete<void>(`/auth/users/${userId}`);
  },

  updateUser: async (userId: number, data: { username: string; password?: string; role: string; session_type?: string; is_active?: boolean }) => {
    return apiClient.put<{ id: number; username: string; role: string; session_type?: string; is_active: boolean }>(`/auth/users/${userId}`, data);
  },
};

// Students API
export const studentsApi = {
  getAll: async (params?: {
    academic_year_id?: number;
    session_type?: string;
    grade_level?: string;
    grade_number?: number;
    is_active?: boolean;
    skip?: number;
    limit?: number;
  }) => {
    const queryString = params ? '?' + new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return apiClient.get<Student[]>(`/students/${queryString}`);
  },

  getById: async (id: number) => {
    return apiClient.get<Student>(`/students/${id}`);
  },

  create: async (student: Omit<Student, 'id' | 'created_at' | 'updated_at'>) => {
    return apiClient.post<Student>('/students/', student);
  },

  update: async (id: number, student: Partial<Student>) => {
    return apiClient.put<Student>(`/students/${id}`, student);
  },

  deactivate: async (id: number) => {
    return apiClient.delete<{ message: string }>(`/students/${id}`);
  },

  getFinances: async (student_id: number, academic_year_id?: number) => {
    const params = academic_year_id ? `?academic_year_id=${academic_year_id}` : '';
    return apiClient.get<StudentFinance>(`/students/${student_id}/finances${params}`);
  },

  createFinance: async (student_id: number, finance: Omit<StudentFinance, 'id' | 'student_id' | 'created_at' | 'updated_at'>) => {
    return apiClient.post<StudentFinance>(`/students/${student_id}/finances`, finance);
  },

  getPayments: async (student_id: number, academic_year_id?: number) => {
    const params = academic_year_id ? `?academic_year_id=${academic_year_id}` : '';
    return apiClient.get<StudentPayment[]>(`/students/${student_id}/payments${params}`);
  },

  recordPayment: async (student_id: number, payment: Omit<StudentPayment, 'id' | 'student_id' | 'created_at'>) => {
    return apiClient.post<StudentPayment>(`/students/${student_id}/payments`, payment);
  },

  getAcademics: async (student_id: number, academic_year_id?: number, subject_id?: number) => {
    const paramsObj: any = {};
    if (academic_year_id) paramsObj.academic_year_id = academic_year_id;
    if (subject_id) paramsObj.subject_id = subject_id;
    const params = Object.keys(paramsObj).length > 0 ? '?' + new URLSearchParams(paramsObj).toString() : '';
    return apiClient.get<StudentAcademic[]>(`/students/${student_id}/academics${params}`);
  },

  createAcademic: async (student_id: number, academic: Omit<StudentAcademic, 'id' | 'student_id' | 'created_at' | 'updated_at'>) => {
    return apiClient.post<StudentAcademic>(`/students/${student_id}/academics`, academic);
  },

  updateAcademic: async (student_id: number, academic_id: number, academic: Partial<StudentAcademic>) => {
    return apiClient.put<StudentAcademic>(`/students/${student_id}/academics/${academic_id}`, academic);
  },

  search: async (query: string, academic_year_id?: number, session_type?: string, limit: number = 20) => {
    const paramsObj: any = { q: query, limit };
    if (academic_year_id) paramsObj.academic_year_id = academic_year_id;
    if (session_type) paramsObj.session_type = session_type;
    const params = '?' + new URLSearchParams(paramsObj).toString();
    return apiClient.get<Student[]>(`/students/search/${params}`);
  },
};

// Teachers API
export const teachersApi = {
  getAll: async (params?: {
    academic_year_id?: number;
    session_type?: string;
    is_active?: boolean;
    skip?: number;
    limit?: number;
  }) => {
    const queryString = params ? '?' + new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return apiClient.get<Teacher[]>(`/teachers/${queryString}`);
  },

  getById: async (id: number) => {
    return apiClient.get<Teacher>(`/teachers/${id}`);
  },

  create: async (teacher: Omit<Teacher, 'id' | 'created_at' | 'updated_at'>) => {
    // Convert arrays to JSON strings for backend
    const teacherData = {
      ...teacher,
      qualifications: teacher.qualifications ? JSON.stringify(teacher.qualifications) : undefined,
      experience: teacher.experience ? JSON.stringify(teacher.experience) : undefined,
      free_time_slots: teacher.free_time_slots ? JSON.stringify(teacher.free_time_slots) : undefined,
    };
    return apiClient.post<Teacher>('/teachers/', teacherData);
  },

  update: async (id: number, teacher: Partial<Teacher>) => {
    // Convert arrays to JSON strings for backend
    const teacherData = {
      ...teacher,
      qualifications: teacher.qualifications ? JSON.stringify(teacher.qualifications) : undefined,
      experience: teacher.experience ? JSON.stringify(teacher.experience) : undefined,
      free_time_slots: teacher.free_time_slots ? JSON.stringify(teacher.free_time_slots) : undefined,
    };
    return apiClient.put<Teacher>(`/teachers/${id}`, teacherData);
  },

  delete: async (id: number) => {
    return apiClient.delete<{ message: string }>(`/teachers/${id}`);
  },

  search: async (query: string, skip: number = 0, limit: number = 50) => {
    const params = '?' + new URLSearchParams({ q: query, skip: skip.toString(), limit: limit.toString() }).toString();
    return apiClient.get<Teacher[]>(`/teachers/search/${params}`);
  },

  // Assignments
  getAssignments: async (teacher_id: number, params?: {
    academic_year_id?: number;
  }) => {
    const queryString = params ? '?' + new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return apiClient.get<any[]>(`/teachers/${teacher_id}/assignments${queryString}`);
  },

  assignSubject: async (teacher_id: number, assignment: {
    class_id: number;
    subject_id: number;
    section?: string;
  }) => {
    return apiClient.post<any>(`/teachers/${teacher_id}/assignments`, assignment);
  },

  removeAssignment: async (assignment_id: number) => {
    return apiClient.delete<{ message: string }>(`/teachers/assignments/${assignment_id}`);
  },

  // Attendance
  getAttendance: async (teacher_id: number, month: number, year: number) => {
    const params = '?' + new URLSearchParams({ month: month.toString(), year: year.toString() }).toString();
    return apiClient.get<TeacherAttendance[]>(`/teachers/${teacher_id}/attendance${params}`);
  },

  recordAttendance: async (teacher_id: number, attendance: Omit<TeacherAttendance, 'id' | 'teacher_id' | 'created_at'>) => {
    return apiClient.post<TeacherAttendance>(`/teachers/${teacher_id}/attendance`, attendance);
  },

  // Finance
  getFinanceRecords: async (teacher_id: number, params?: {
    academic_year_id?: number;
    month?: number;
    year?: number;
  }) => {
    const queryString = params ? '?' + new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return apiClient.get<any[]>(`/teachers/${teacher_id}/finance${queryString}`);
  },

  // Schedule
  getSchedule: async (teacher_id: number, params?: {
    academic_year_id?: number;
  }) => {
    const queryString = params ? '?' + new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return apiClient.get<any>(`/teachers/${teacher_id}/schedule${queryString}`);
  },
};

// Academic Years API
export const academicYearsApi = {
  getAll: async () => {
    return apiClient.get<AcademicYear[]>('/academic/years');
  },

  getById: async (id: number) => {
    return apiClient.get<AcademicYear>(`/academic/years/${id}`);
  },

  create: async (academicYear: Omit<AcademicYear, 'id' | 'created_at' | 'updated_at'>) => {
    return apiClient.post<AcademicYear>('/academic/years', academicYear);
  },

  update: async (id: number, academicYear: Partial<AcademicYear>) => {
    return apiClient.put<AcademicYear>(`/academic/years/${id}`, academicYear);
  },

  delete: async (id: number) => {
    return apiClient.delete<void>(`/academic/years/${id}`);
  },

  // First-run setup methods
  checkFirstRun: async () => {
    return apiClient.get<{ is_first_run: boolean; message: string }>('/academic/first-run-check');
  },

  initializeFirstYear: async (academicYear: Omit<AcademicYear, 'id' | 'created_at' | 'updated_at'>) => {
    return apiClient.post<AcademicYear>('/academic/initialize-first-year', academicYear);
  },

  updateConfiguration: async (key: string, value: string, config_type: string = "string", description?: string, category?: string) => {
    return apiClient.put<any>(`/advanced/config/${key}`, { value, config_type, description, category });
  },

  migratePreview: async (data: { from_year_id: number; to_year_id: number }) => {
    return apiClient.post<any>('/academic/years/migrate/preview', data);
  },

  migrateExecute: async (data: { from_year_id: number; to_year_id: number }) => {
    return apiClient.post<any>('/academic/years/migrate/execute', data);
  },
};

// Academic Settings API
export const academicSettingsApi = {
  save: async (settings: any) => {
    return apiClient.post<any>('/academic/settings', settings);
  },

  get: async (academic_year_id: number, class_id: number, subject_id?: number) => {
    const params = new URLSearchParams({
      academic_year_id: academic_year_id.toString(),
      class_id: class_id.toString(),
      ...(subject_id && { subject_id: subject_id.toString() })
    });
    return apiClient.get<any>(`/academic/settings?${params.toString()}`);
  },
};

// Activities API
export const activitiesApi = {
  getAll: async (params?: {
    academic_year_id?: number;
    activity_type?: string;
    session_type?: string;
    is_active?: boolean;
    skip?: number;
    limit?: number;
  }) => {
    const queryString = params ? '?' + new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return apiClient.get<Activity[]>(`/activities/${queryString}`);
  },

  getById: async (id: number) => {
    return apiClient.get<Activity>(`/activities/${id}`);
  },

  create: async (activity: Omit<Activity, 'id' | 'created_at'>) => {
    return apiClient.post<Activity>('/activities/', activity);
  },

  update: async (id: number, activity: Partial<Activity>) => {
    return apiClient.put<Activity>(`/activities/${id}`, activity);
  },

  delete: async (id: number) => {
    return apiClient.delete<{ message: string }>(`/activities/${id}`);
  },

  search: async (query: string, activity_type?: string, session_type?: string, skip: number = 0, limit: number = 50) => {
    const paramsObj: any = { q: query, skip: skip.toString(), limit: limit.toString() };
    if (activity_type) paramsObj.activity_type = activity_type;
    if (session_type) paramsObj.session_type = session_type;
    const params = '?' + new URLSearchParams(paramsObj).toString();
    return apiClient.get<Activity[]>(`/activities/search/${params}`);
  },

  getParticipants: async (activity_id: number) => {
    return apiClient.get<ActivityParticipant[]>(`/activities/${activity_id}/participants`);
  },

  addParticipants: async (activity_id: number, participants: Omit<ActivityParticipant, 'id' | 'activity_id' | 'created_at'>[]) => {
    return apiClient.post<void>(`/activities/${activity_id}/participants`, { participants });
  },

  getStudentParticipation: async (activity_id: number) => {
    return apiClient.get<StudentActivityParticipation[]>(`/activities/${activity_id}/student-participation`);
  },

  addStudentParticipation: async (activity_id: number, participation: Omit<StudentActivityParticipation, 'id' | 'activity_id' | 'created_at'>[]) => {
    return apiClient.post<void>(`/activities/${activity_id}/student-participation`, { participation });
  },

  // Activity Registration Functions
  getRegistrations: async (activity_id: number, payment_status?: string) => {
    const params = payment_status ? `?payment_status=${payment_status}` : '';
    return apiClient.get<ActivityRegistration[]>(`/activities/${activity_id}/registrations${params}`);
  },

  createRegistration: async (activity_id: number, registration: Omit<ActivityRegistration, 'id' | 'created_at' | 'updated_at' | 'student_name' | 'activity_name'>) => {
    return apiClient.post<ActivityRegistration>(`/activities/${activity_id}/registrations`, registration);
  },

  updateRegistration: async (registration_id: number, registration: Partial<ActivityRegistration>) => {
    return apiClient.put<ActivityRegistration>(`/activities/registrations/${registration_id}`, registration);
  },

  deleteRegistration: async (activity_id: number, registration_id: number) => {
    return apiClient.delete<void>(`/activities/${activity_id}/registrations/${registration_id}`);
  },

  logBulkParticipantChange: async (activity_id: number, changes: {
    added_classes?: Array<{grade_number: string, session: string, student_count: number}>,
    removed_classes?: Array<{grade_number: string, session: string, student_count: number}>,
    added_students?: Array<{student_id: number, name: string}>,
    removed_students?: Array<{student_id: number, name: string}>,
    payment_updates?: {paid_count: number, pending_count: number}
  }) => {
    return apiClient.post<void>(`/activities/${activity_id}/participants/bulk-change`, changes);
  },

  // Activity Attendance Functions
  getAttendance: async (activity_id: number) => {
    return apiClient.get<ActivityAttendance[]>(`/activities/${activity_id}/attendance`);
  },

// ... (rest of the code remains the same)
  recordAttendance: async (activity_id: number, attendance: Omit<ActivityAttendance, 'id' | 'created_at' | 'updated_at' | 'student_name' | 'activity_name'>) => {
    return apiClient.post<ActivityAttendance>(`/activities/${activity_id}/attendance`, attendance);
  },

  updateAttendance: async (activity_id: number, attendance_id: number, attendance: Partial<ActivityAttendance>) => {
    return apiClient.put<ActivityAttendance>(`/activities/${activity_id}/attendance/${attendance_id}`, attendance);
  },

  deleteAttendance: async (activity_id: number, attendance_id: number) => {
    return apiClient.delete<void>(`/activities/${activity_id}/attendance/${attendance_id}`);
  },

  // Activity Schedule Functions
  getSchedule: async (activity_id: number) => {
    return apiClient.get<ActivitySchedule[]>(`/activities/${activity_id}/schedule`);
  },

  createSchedule: async (activity_id: number, schedule: Omit<ActivitySchedule, 'id' | 'created_at' | 'updated_at' | 'activity_name' | 'day_name'>) => {
    return apiClient.post<ActivitySchedule>(`/activities/${activity_id}/schedule`, schedule);
  },

  updateSchedule: async (activity_id: number, schedule_id: number, schedule: Partial<ActivitySchedule>) => {
    return apiClient.put<ActivitySchedule>(`/activities/${activity_id}/schedule/${schedule_id}`, schedule);
  },

  deleteSchedule: async (activity_id: number, schedule_id: number) => {
    return apiClient.delete<void>(`/activities/${activity_id}/schedule/${schedule_id}`);
  },
};

// Financial API
export const financeApi = {
  getTransactions: async (params?: {
    academic_year_id?: number;
    transaction_type?: string;
    category?: string;
    start_date?: string;
    end_date?: string;
    payment_method?: string;
    skip?: number;
    limit?: number;
  }) => {
    const queryString = params ? '?' + new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return apiClient.get<FinanceTransaction[]>(`/finance/transactions${queryString}`);
  },

  createTransaction: async (transaction: Omit<FinanceTransaction, 'id' | 'created_at'>) => {
    return apiClient.post<FinanceTransaction>('/finance/transactions', transaction);
  },

  updateTransaction: async (id: number, transaction: Partial<FinanceTransaction>) => {
    return apiClient.put<FinanceTransaction>(`/finance/transactions/${id}`, transaction);
  },

  deleteTransaction: async (id: number) => {
    return apiClient.delete<void>(`/finance/transactions/${id}`);
  },

  getCategories: async (is_active?: boolean) => {
    const params = is_active !== undefined ? `?is_active=${is_active}` : '';
    return apiClient.get<FinanceCategory[]>(`/finance/categories${params}`);
  },

  createCategory: async (category: Omit<FinanceCategory, 'id' | 'created_at'>) => {
    return apiClient.post<FinanceCategory>('/finance/categories', category);
  },

  updateCategory: async (id: number, category: Partial<FinanceCategory>) => {
    return apiClient.put<FinanceCategory>(`/finance/categories/${id}`, category);
  },

  getBudgets: async (params?: {
    academic_year_id?: number;
    category?: string;
    period_type?: string;
  }) => {
    const queryString = params ? '?' + new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return apiClient.get<Budget[]>(`/finance/budgets${queryString}`);
  },

  createBudget: async (budget: Omit<Budget, 'id' | 'created_at' | 'updated_at' | 'spent_amount' | 'remaining_amount'>) => {
    return apiClient.post<Budget>('/finance/budgets', budget);
  },

  updateBudget: async (id: number, budget: Partial<Budget>) => {
    return apiClient.put<Budget>(`/finance/budgets/${id}`, budget);
  },

  deleteBudget: async (id: number) => {
    return apiClient.delete<void>(`/finance/budgets/${id}`);
  },

  getDashboard: async (academic_year_id: number, start_date?: string, end_date?: string) => {
    const paramsObj: any = { academic_year_id };
    if (start_date) paramsObj.start_date = start_date;
    if (end_date) paramsObj.end_date = end_date;
    const params = '?' + new URLSearchParams(paramsObj).toString();
    return apiClient.get<any>(`/finance/dashboard${params}`);
  },

  getReports: async (type: string, params: any) => {
    return apiClient.post<any>(`/finance/reports/${type}`, params);
  },
};

// Finance Manager API - نظام المسؤول المالي
export const financeManagerApi = {
  // Dashboard
  getDashboard: async (academic_year_id: number) => {
    return apiClient.get<FinanceManagerDashboard>(`/finance/manager/dashboard?academic_year_id=${academic_year_id}`);
  },

  // Students Finance
  getStudentsFinance: async (params: {
    academic_year_id: number;
    grade_level?: string;
    grade_number?: number;
    section?: string;
    session_type?: string;
  }) => {

    const filteredParams = Object.entries(params)
      .filter(([key, v]) => {
        // Filter out undefined, null, "all", empty string, and NaN values
        if (v === undefined || v === null || v === "all" || v === "") return false;
        if (key === "grade_number" && (isNaN(Number(v)) || Number(v) <= 0)) return false;
        return true;
      })
      .map(([k, v]) => [k, String(v)]);

    const queryString = '?' + new URLSearchParams(filteredParams).toString();

    return apiClient.get<StudentFinanceSummary[]>(`/finance/manager/students${queryString}`);
  },

  getStudentFinanceDetailed: async (student_id: number, academic_year_id: number) => {
    return apiClient.get<StudentFinanceDetailed>(`/finance/manager/students/${student_id}/detailed?academic_year_id=${academic_year_id}`);
  },

  updateStudentFinances: async (student_id: number, academic_year_id: number, data: Partial<StudentFinance>) => {
    return apiClient.put<any>(`/finance/manager/students/${student_id}/finances?academic_year_id=${academic_year_id}`, data);
  },

  addStudentPayment: async (student_id: number, payment: Omit<StudentPayment, 'id' | 'created_at'>) => {
    return apiClient.post<StudentPayment>(`/finance/manager/students/${student_id}/payment`, payment);
  },

  // Finance Cards
  getFinanceCards: async (params: {
    academic_year_id: number;
    card_type?: string;
    category?: string;
    status?: string;
  }) => {
    const queryString = '?' + new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return apiClient.get<FinanceCard[]>(`/finance/cards${queryString}`);
  },

  createFinanceCard: async (card: Omit<FinanceCard, 'id' | 'created_at' | 'updated_at'>) => {
    return apiClient.post<FinanceCard>('/finance/cards', card);
  },

  getFinanceCard: async (card_id: number) => {
    return apiClient.get<FinanceCard>(`/finance/cards/${card_id}`);
  },

  updateFinanceCard: async (card_id: number, data: Partial<FinanceCard>) => {
    return apiClient.put<FinanceCard>(`/finance/cards/${card_id}`, data);
  },

  deleteFinanceCard: async (card_id: number) => {
    return apiClient.delete<void>(`/finance/cards/${card_id}`);
  },

  getFinanceCardSummary: async (card_id: number) => {
    return apiClient.get<FinanceCardSummary>(`/finance/cards/${card_id}/summary`);
  },

  getFinanceCardDetailed: async (card_id: number, academic_year_id: number) => {
    return apiClient.get<FinanceCardDetailed>(`/finance/cards/${card_id}/detailed?academic_year_id=${academic_year_id}`);
  },

  // Card Transactions
  getCardTransactions: async (card_id: number) => {
    return apiClient.get<FinanceCardTransaction[]>(`/finance/cards/${card_id}/transactions`);
  },

  addCardTransaction: async (card_id: number, transaction: Omit<FinanceCardTransaction, 'id' | 'card_id' | 'created_at' | 'updated_at'>) => {
    return apiClient.post<FinanceCardTransaction>(`/finance/cards/${card_id}/transactions`, transaction);
  },

  updateCardTransaction: async (transaction_id: number, data: Partial<FinanceCardTransaction>) => {
    return apiClient.put<FinanceCardTransaction>(`/finance/cards/transactions/${transaction_id}`, data);
  },

  deleteCardTransaction: async (transaction_id: number) => {
    return apiClient.delete<void>(`/finance/cards/transactions/${transaction_id}`);
  },

  // Analytics - Transactions by Period
  // If academic_year_id is provided, data is scoped to that year.
  // If omitted/null, backend is expected to return data across all academic years
  // (used for the yearly "سنوات" view in the finance dashboard).
  getTransactionsByPeriod: async (academic_year_id: number | null | undefined, period_type: 'weekly' | 'monthly' | 'yearly') => {
    const params = new URLSearchParams({ period_type });
    if (academic_year_id) {
      params.append('academic_year_id', academic_year_id.toString());
    }
    return apiClient.get<{periods: string[], income_data: number[], expense_data: number[]}>(`/finance/analytics/transactions-by-period?${params.toString()}`);
  },

  // Analytics - Income Completion Stats
  getIncomeCompletionStats: async (academic_year_id: number) => {
    return apiClient.get<{completed_income: number, incomplete_income: number}>(`/finance/analytics/income-completion?academic_year_id=${academic_year_id}`);
  },

  // Activities Finance
  getActivitiesWithFinances: async (academic_year_id: number) => {
    return apiClient.get<Activity[]>(`/finance/manager/activities?academic_year_id=${academic_year_id}`);
  },

  updateActivityFinances: async (activity_id: number, data: {
    total_cost?: number;
    total_revenue?: number;
    additional_expenses?: Array<{ name: string; amount: number; description?: string }>;
    additional_revenues?: Array<{ name: string; amount: number; description?: string }>;
    financial_status?: string;
  }) => {
    return apiClient.put<any>(`/finance/manager/activities/${activity_id}/finances`, data);
  },

  // Historical Balance & Transfer
  transferBalances: async (source_year_id: number, target_year_id: number) => {
    return apiClient.post<any>('/finance/manager/transfer-balances', {
      source_year_id,
      target_year_id
    });
  },

  getHistoricalBalances: async (academic_year_id: number) => {
    return apiClient.get<HistoricalBalance[]>(`/finance/manager/historical-balances/${academic_year_id}`);
  },

  getStudentBalanceHistory: async (student_id: number) => {
    return apiClient.get<{
      student_id: number;
      balance_history: HistoricalBalance[];
      total_historical_balance: number;
    }>(`/finance/manager/students/${student_id}/balance-history`);
  },

  getOutstandingBalances: async (academic_year_id: number) => {
    return apiClient.get<{
      academic_year_id: number;
      students_count: number;
      total_outstanding: number;
      students: StudentFinanceSummary[];
    }>(`/finance/manager/outstanding-balances/${academic_year_id}`);
  },

  getFilterOptions: async (academic_year_id: number, grade_level?: string) => {
    const params = new URLSearchParams({ academic_year_id: academic_year_id.toString() });
    if (grade_level && grade_level !== "all") {
      params.append('grade_level', grade_level);
    }
    return apiClient.get<{
      grade_numbers: number[];
      sections: string[];
    }>(`/finance/manager/filter-options?${params.toString()}`);
  },
};

// Schedule API
export const schedulesApi = {
  getAll: async (params?: {
    academic_year_id?: number;
    session_type?: string;
    class_id?: number;
    teacher_id?: number;
    skip?: number;
    limit?: number;
  }) => {
    const queryString = params ? '?' + new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return apiClient.get<Schedule[]>(`/schedules/${queryString}`);
  },

  getById: async (id: number) => {
    return apiClient.get<Schedule>(`/schedules/${id}`);
  },

  create: async (schedule: Omit<Schedule, 'id' | 'created_at' | 'updated_at'>) => {
    return apiClient.post<Schedule>('/schedules/', schedule);
  },

  update: async (id: number, schedule: Partial<Schedule>) => {
    return apiClient.put<Schedule>(`/schedules/${id}`, schedule);
  },

  delete: async (id: number) => {
    return apiClient.delete<{ message: string }>(`/schedules/${id}`);
  },

  getWeeklyView: async (academic_year_id: number, session_type: string, class_id?: number, teacher_id?: number) => {
    const paramsObj: any = { academic_year_id, session_type };
    if (class_id) paramsObj.class_id = class_id;
    if (teacher_id) paramsObj.teacher_id = teacher_id;
    const params = '?' + new URLSearchParams(paramsObj).toString();
    return apiClient.get<any>(`/schedules/weekly-view${params}`);
  },

  analyzeConflicts: async (academic_year_id: number, session_type: string) => {
    const params = '?' + new URLSearchParams({ academic_year_id: academic_year_id.toString(), session_type }).toString();
    return apiClient.get<any>(`/schedules/analysis/conflicts/${params}`);
  },

  getConstraints: async (academic_year_id?: number) => {
    const params = academic_year_id ? `?academic_year_id=${academic_year_id}` : '';
    return apiClient.get<ScheduleConstraint[]>(`/schedules/constraints/${params}`);
  },

  createConstraint: async (constraint: Omit<ScheduleConstraint, 'id' | 'created_at' | 'updated_at'>) => {
    return apiClient.post<ScheduleConstraint>('/schedules/constraints/', constraint);
  },

  updateConstraint: async (id: number, constraint: Partial<ScheduleConstraint>) => {
    return apiClient.put<ScheduleConstraint>(`/schedules/constraints/${id}`, constraint);
  },

  deleteConstraint: async (id: number) => {
    return apiClient.delete<void>(`/schedules/constraints/${id}`);
  },

  // Constraint Template Management
  getConstraintTemplates: async (params?: {
    is_system_template?: boolean;
    skip?: number;
    limit?: number;
  }) => {
    const queryString = params ? '?' + new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return apiClient.get<ConstraintTemplate[]>(`/schedules/constraint-templates/${queryString}`);
  },

  getConstraintTemplate: async (id: number) => {
    return apiClient.get<ConstraintTemplate>(`/schedules/constraint-templates/${id}`);
  },

  createConstraintTemplate: async (template: Omit<ConstraintTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    return apiClient.post<ConstraintTemplate>('/schedules/constraint-templates/', template);
  },

  updateConstraintTemplate: async (id: number, template: Partial<ConstraintTemplate>) => {
    return apiClient.put<ConstraintTemplate>(`/schedules/constraint-templates/${id}`, template);
  },

  deleteConstraintTemplate: async (id: number) => {
    return apiClient.delete<void>(`/schedules/constraint-templates/${id}`);
  },

  // Schedule Generation
  generate: async (request: {
    academic_year_id: number;
    session_type: string;
    name: string;
    start_date: string;
    end_date: string;
    periods_per_day?: number;
    break_periods?: number[];
    break_duration?: number;
    working_days?: string[];
    session_start_time?: string;
    period_duration?: number;
    auto_assign_teachers?: boolean;
    balance_teacher_load?: boolean;
    avoid_teacher_conflicts?: boolean;
    prefer_subject_continuity?: boolean;
    preview_only?: boolean;
  }) => {
    return apiClient.post<any>('/schedules/generate', request);
  },

  // Save Preview Schedule
  savePreview: async (request: {
    request: any;
    preview_data: any[];
  }) => {
    return apiClient.post<any>('/schedules/save-preview', request);
  },

  // Schedule Validation
  validate: async (params: {
    academic_year_id: number;
    class_id: number;
    section?: string;
    session_type?: string;
  }) => {
    const queryString = new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return apiClient.post<any>(`/schedules/validate?${queryString}`, {});
  },

  // Get Schedule Conflicts
  getConflicts: async (scheduleId: number) => {
    return apiClient.get<any>(`/schedules/${scheduleId}/conflicts`);
  },

  // Publish Schedule
  publish: async (scheduleId: number) => {
    return apiClient.post<any>(`/schedules/${scheduleId}/publish`, {});
  },

  // Save as Draft
  saveAsDraft: async (scheduleId: number) => {
    return apiClient.post<any>(`/schedules/${scheduleId}/save-as-draft`, {});
  },

  // Swap Schedule Periods
  swap: async (schedule1_id: number, schedule2_id: number) => {
    return apiClient.post<{
      success: boolean;
      message: string;
      schedule1?: Schedule;
      schedule2?: Schedule;
      conflicts: string[];
    }>('/schedules/swap', { schedule1_id, schedule2_id });
  },

  // Check Swap Validity (for drag-and-drop highlighting)
  checkSwapValidity: async (schedule1_id: number, schedule2_id: number) => {
    return apiClient.post<{
      can_swap: boolean;
      reason?: string;
      conflicts: string[];
    }>('/schedules/check-swap-validity', { schedule1_id, schedule2_id });
  },

  // Get Diagnostics
  getDiagnostics: async (academicYearId: number, sessionType: string) => {
    const params = new URLSearchParams({
      academic_year_id: academicYearId.toString(),
      session_type: sessionType
    });
    return apiClient.get<any>(`/schedules/diagnostics?${params.toString()}`);
  },

  // Bulk Delete Schedules
  bulkDelete: async (params: {
    academic_year_id: number;
    session_type: string;
    class_id?: number;
    section?: string | number;
  }) => {
    const queryParams = new URLSearchParams({
      academic_year_id: params.academic_year_id.toString(),
      session_type: params.session_type
    });

    if (params.class_id !== undefined && params.class_id !== null) {
      queryParams.append('class_id', params.class_id.toString());
    }

    if (params.section !== undefined && params.section !== null && params.section !== '') {
      queryParams.append('section', String(params.section));
    }

    return apiClient.delete<{
      message: string;
      deleted_count: number;
      academic_year_id: number;
      session_type: string;
      class_id?: number;
      section?: string | number;
    }>(`/schedules/bulk-delete?${queryParams.toString()}`);
  },

  // Delete Class Schedule (Recommended)
  deleteClassSchedule: async (params: {
    academic_year_id: number;
    session_type: string;
    class_id: number;
    section: string | number;
  }) => {
    const queryParams = new URLSearchParams({
      academic_year_id: params.academic_year_id.toString(),
      session_type: params.session_type,
      class_id: params.class_id.toString(),
      section: String(params.section)
    });

    return apiClient.delete<{
      message: string;
      deleted_count: number;
      academic_year_id: number;
      session_type: string;
      class_id: number;
      section: string | number;
      restored_teachers?: number[];
    }>(`/schedules/class-schedule?${queryParams.toString()}`);
  }
};

// Search API
export const searchApi = {
  // ... (rest of the code remains the same)
  universal: async (query: string, params?: {
    scope?: string;
    mode?: string;
    academic_year_id?: number;
    session_type?: string;
    skip?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: string;
  }) => {
    const searchParams: any = { query, ...params };
    const queryString = '?' + new URLSearchParams(
      Object.entries(searchParams)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return apiClient.get<any>(`/search/universal${queryString}`);
  },

  universalSearch: async (query: string, options?: {
    scope?: string;
    mode?: string;
    filters?: {
      academic_year_id?: number;
      session_type?: string;
      date_from?: string;
      date_to?: string;
      scopes?: string[];
      include_inactive?: boolean;
      min_relevance_score?: number;
    };
    skip?: number;
    limit?: number;
  }) => {
    const { filters, ...otherParams } = options || {};
    const searchParams: any = {
      query,
      ...otherParams,
      ...(filters?.academic_year_id && { academic_year_id: filters.academic_year_id }),
      ...(filters?.session_type && { session_type: filters.session_type }),
      ...(filters?.include_inactive !== undefined && { include_inactive: filters.include_inactive })
    };

    const queryString = '?' + new URLSearchParams(
      Object.entries(searchParams)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return apiClient.get<any>(`/search/universal${queryString}`);
  },

  quick: async (query: string, limit: number = 10) => {
    const params = '?' + new URLSearchParams({ query, limit: limit.toString() }).toString();
    return apiClient.get<any>(`/search/quick${params}`);
  },

  students: async (query: string, academic_year_id?: number, class_id?: number, skip: number = 0, limit: number = 50) => {
    const paramsObj: any = { query, skip: skip.toString(), limit: limit.toString() };
    if (academic_year_id) paramsObj.academic_year_id = academic_year_id;
    if (class_id) paramsObj.class_id = class_id;
    const params = '?' + new URLSearchParams(paramsObj).toString();
    return apiClient.get<any>(`/search/students${params}`);
  },

  teachers: async (query: string, subject_id?: number, skip: number = 0, limit: number = 50) => {
    const paramsObj: any = { query, skip: skip.toString(), limit: limit.toString() };
    if (subject_id) paramsObj.subject_id = subject_id;
    const params = '?' + new URLSearchParams(paramsObj).toString();
    return apiClient.get<any>(`/search/teachers${params}`);
  },
};

// System API
export const systemApi = {
  getStatus: async () => {
    return apiClient.get<any>('/system/status');
  },

  getBackupStats: async () => {
    return apiClient.get<any>('/system/backup/stats');
  },

  createDatabaseBackup: async (backup_name: string) => {
    return apiClient.post<any>('/system/backup/database', { backup_name });
  },

  listBackups: async (backup_type?: string) => {
    const params = backup_type ? `?backup_type=${backup_type}` : '';
    return apiClient.get<any>(`/system/backup/list${params}`);
  },

  restoreBackup: async (backup_name: string) => {
    return apiClient.post<any>(`/system/backup/restore/${backup_name}`, {});
  },

  sendNotification: async (title: string, message: string, severity: string) => {
    return apiClient.post<any>('/system/notification/send', { title, message, severity });
  },

  testTelegramConnection: async () => {
    return apiClient.get<any>('/system/notification/test');
  },

  // Configuration Management
  getConfigurations: async () => {
    return apiClient.get<any>('/advanced/config');
  },

  updateConfiguration: async (key: string, value: string, config_type: string = "string", description?: string, category?: string) => {
    return apiClient.put<any>(`/advanced/config/${key}`, { value, config_type, description, category });
  },
};

// Monitoring API
export const monitoringApi = {
  getLogs: async (params?: {
    level?: string;
    module?: string;
    start_date?: string;
    end_date?: string;
    search_term?: string;
    skip?: number;
    limit?: number;
  }) => {
    const queryString = params ? '?' + new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return apiClient.get<any>(`/monitoring/logs${queryString}`);
  },

  getSystemHealth: async () => {
    return apiClient.get<any>('/monitoring/health');
  },

  getPerformanceMetrics: async () => {
    return apiClient.get<any>('/monitoring/metrics');
  },

  getAnalyticsDashboard: async () => {
    return apiClient.get<any>('/monitoring/analytics/dashboard');
  },

  getUsageStatistics: async (days?: number) => {
    const params = days ? `?days=${days}` : '';
    return apiClient.get<any>(`/monitoring/analytics/usage${params}`);
  },

  logEvent: async (level: string, message: string, module?: string, additional_data?: any) => {
    return apiClient.post<any>('/monitoring/events/log', { level, message, module, additional_data });
  },
};

// Director Tools API
export const directorApi = {
  // Dashboard
  getDashboardStats: async (academic_year_id?: number | null) => {
    const params = academic_year_id !== null && academic_year_id !== undefined ? `?academic_year_id=${academic_year_id}` : '';
    return apiClient.get<any>(`/director/dashboard${params}`);
  },

  // Notes Categories
  getNotesCategories: async (academic_year_id: number) => {
    return apiClient.get<any>(`/director/notes/categories?academic_year_id=${academic_year_id}`);
  },

  // Folders Management
  listFolderContents: async (academic_year_id: number, category: string, parent_folder_id?: number | null) => {
    const paramsObj: any = { academic_year_id: academic_year_id.toString(), category };
    if (parent_folder_id !== null && parent_folder_id !== undefined) {
      paramsObj.parent_folder_id = parent_folder_id.toString();
    }
    const params = '?' + new URLSearchParams(paramsObj).toString();
    return apiClient.get<any>(`/director/notes/folders${params}`);
  },

  createFolder: async (academic_year_id: number, category: string, folder_name: string, parent_folder_id?: number | null) => {
    const paramsObj: any = { academic_year_id: academic_year_id.toString(), category, folder_name };
    if (parent_folder_id !== null && parent_folder_id !== undefined) {
      paramsObj.parent_folder_id = parent_folder_id.toString();
    }
    const params = '?' + new URLSearchParams(paramsObj).toString();
    return apiClient.post<any>(`/director/notes/folders${params}`, {});
  },

  renameFolder: async (folder_id: number, new_name: string) => {
    return apiClient.put<any>(`/director/notes/folders/${folder_id}?new_name=${encodeURIComponent(new_name)}`, {});
  },

  deleteFolder: async (folder_id: number) => {
    return apiClient.delete<any>(`/director/notes/folders/${folder_id}`);
  },

  // Files Management
  getFile: async (file_id: number) => {
    return apiClient.get<any>(`/director/notes/files/${file_id}`);
  },

  createFile: async (academic_year_id: number, category: string, file_name: string, content: string, note_date: string, parent_folder_id?: number | null) => {
    const paramsObj: any = {
      academic_year_id: academic_year_id.toString(),
      category,
      file_name,
      content,
      note_date
    };
    if (parent_folder_id !== null && parent_folder_id !== undefined) {
      paramsObj.parent_folder_id = parent_folder_id.toString();
    }
    const params = '?' + new URLSearchParams(paramsObj).toString();
    return apiClient.post<any>(`/director/notes/files${params}`, {});
  },

  updateFile: async (file_id: number, title?: string, content?: string, note_date?: string) => {
    const paramsObj: any = {};
    if (title !== undefined) paramsObj.title = title;
    if (content !== undefined) paramsObj.content = content;
    if (note_date !== undefined) paramsObj.note_date = note_date;
    const params = Object.keys(paramsObj).length > 0 ? '?' + new URLSearchParams(paramsObj).toString() : '';
    return apiClient.put<any>(`/director/notes/files/${file_id}${params}`, {});
  },

  deleteFile: async (file_id: number) => {
    return apiClient.delete<any>(`/director/notes/files/${file_id}`);
  },

  // Search
  searchNotes: async (query: string, academic_year_id?: number, category?: string) => {
    const paramsObj: any = { query };
    if (academic_year_id) paramsObj.academic_year_id = academic_year_id.toString();
    if (category) paramsObj.category = category;
    const params = '?' + new URLSearchParams(paramsObj).toString();
    return apiClient.get<any>(`/director/notes/search${params}`);
  },

  // Rewards Management
  getRewards: async (academic_year_id?: number, skip: number = 0, limit: number = 100) => {
    const params: string[] = [];
    if (academic_year_id !== undefined) params.push(`academic_year_id=${academic_year_id}`);
    params.push(`skip=${skip}`);
    params.push(`limit=${limit}`);
    return apiClient.get<Reward[]>(`/director/rewards?${params.join('&')}`);
  },

  getReward: async (reward_id: number) => {
    return apiClient.get<Reward>(`/director/rewards/${reward_id}`);
  },

  createReward: async (reward: Omit<Reward, 'id' | 'created_at' | 'updated_at'>) => {
    return apiClient.post<Reward>('/director/rewards', reward);
  },

  updateReward: async (id: number, reward: Partial<Reward>) => {
    return apiClient.put<Reward>(`/director/rewards/${id}`, reward);
  },

  deleteReward: async (id: number) => {
    return apiClient.delete<any>(`/director/rewards/${id}`);
  },

  // Assistance Records Management
  getAssistanceRecords: async (academic_year_id?: number, skip: number = 0, limit: number = 100) => {
    const params: string[] = [];
    if (academic_year_id !== undefined) params.push(`academic_year_id=${academic_year_id}`);
    params.push(`skip=${skip}`);
    params.push(`limit=${limit}`);
    return apiClient.get<AssistanceRecord[]>(`/director/assistance?${params.join('&')}`);
  },

  getAssistanceRecord: async (record_id: number) => {
    return apiClient.get<AssistanceRecord>(`/director/assistance/${record_id}`);
  },

  createAssistanceRecord: async (record: Omit<AssistanceRecord, 'id' | 'created_at' | 'updated_at'>) => {
    return apiClient.post<AssistanceRecord>('/director/assistance', record);
  },

  updateAssistanceRecord: async (id: number, record: Partial<AssistanceRecord>) => {
    return apiClient.put<AssistanceRecord>(`/director/assistance/${id}`, record);
  },

  deleteAssistanceRecord: async (id: number) => {
    return apiClient.delete<any>(`/director/assistance/${id}`);
  },
};

// Analytics API
export const analyticsApi = {
  // Overview
  getOverview: async (academic_year_id: number, period_type: string = 'monthly', session_type?: string) => {
    const params = new URLSearchParams({ academic_year_id: academic_year_id.toString(), period_type });
    if (session_type && session_type !== 'both') {
      params.append('session_type', session_type);
    }
    return apiClient.get<any>(`/analytics/overview?${params.toString()}`);
  },

  // Student Distribution
  getStudentDistribution: async (academic_year_id: number, period_type: string = 'monthly', session_type?: string) => {
    const params = new URLSearchParams({ academic_year_id: academic_year_id.toString(), period_type });
    if (session_type && session_type !== 'both') {
      params.append('session_type', session_type);
    }
    return apiClient.get<any>(`/analytics/students/distribution?${params.toString()}`);
  },

  // Finance Overview
  getFinanceOverview: async (academic_year_id: number, period_type: string = 'monthly', session_type?: string) => {
    const params = new URLSearchParams({ academic_year_id: academic_year_id.toString(), period_type });
    if (session_type && session_type !== 'both') {
      params.append('session_type', session_type);
    }
    return apiClient.get<any>(`/analytics/finance/overview?${params.toString()}`);
  },

  // Income Trends
  getIncomeTrends: async (academic_year_id: number, period_type: string = 'monthly', session_type?: string) => {
    const params = new URLSearchParams({ academic_year_id: academic_year_id.toString(), period_type });
    if (session_type && session_type !== 'both') {
      params.append('session_type', session_type);
    }
    return apiClient.get<any>(`/analytics/finance/income-trends?${params.toString()}`);
  },

  // Expense Trends
  getExpenseTrends: async (academic_year_id: number, period_type: string = 'monthly', session_type?: string) => {
    const params = new URLSearchParams({ academic_year_id: academic_year_id.toString(), period_type });
    if (session_type && session_type !== 'both') {
      params.append('session_type', session_type);
    }
    return apiClient.get<any>(`/analytics/finance/expense-trends?${params.toString()}`);
  },

  // Attendance Data
  getAttendance: async (academic_year_id: number, period_type: string = 'monthly', session_type?: string) => {
    const params = new URLSearchParams({ academic_year_id: academic_year_id.toString(), period_type });
    if (session_type && session_type !== 'both') {
      params.append('session_type', session_type);
    }
    return apiClient.get<any>(`/analytics/attendance?${params.toString()}`);
  },

  // Academic Performance
  getAcademicPerformance: async (academic_year_id: number, period_type: string = 'monthly', session_type?: string) => {
    const params = new URLSearchParams({ academic_year_id: academic_year_id.toString(), period_type });
    if (session_type && session_type !== 'both') {
      params.append('session_type', session_type);
    }
    return apiClient.get<any>(`/analytics/academic/performance?${params.toString()}`);
  },

  // School Grades (New endpoint for the grades table)
  getSchoolGrades: async (academic_year_id: number, subject?: string) => {
    const params = new URLSearchParams({ academic_year_id: academic_year_id.toString() });
    if (subject && subject !== 'all') {
      params.append('subject', subject);
    }
    return apiClient.get<any>(`/analytics/grades/school-wide?${params.toString()}`);
  },

  // Student Attendance Trend (weekly or monthly)
  getStudentAttendanceTrend: async (student_id: number, academic_year_id: number, period_type: 'weekly' | 'monthly' = 'weekly') => {
    const params = new URLSearchParams({
      academic_year_id: academic_year_id.toString(),
      period_type
    });
    return apiClient.get<any>(`/analytics/students/${student_id}/attendance-trend?${params.toString()}`);
  },

  // Student Grades Timeline
  getStudentGradesTimeline: async (student_id: number, academic_year_id: number) => {
    const params = new URLSearchParams({
      academic_year_id: academic_year_id.toString()
    });
    return apiClient.get<any>(`/analytics/students/${student_id}/grades-timeline?${params.toString()}`);
  },

  // Student Grades by Subject
  getStudentGradesBySubject: async (student_id: number, academic_year_id: number) => {
    const params = new URLSearchParams({
      academic_year_id: academic_year_id.toString()
    });
    return apiClient.get<any>(`/analytics/students/${student_id}/grades-by-subject?${params.toString()}`);
  },

  // Student Financial Summary
  getStudentFinancialSummary: async (student_id: number, academic_year_id: number) => {
    const params = new URLSearchParams({
      academic_year_id: academic_year_id.toString()
    });
    return apiClient.get<any>(`/analytics/students/${student_id}/financial-summary?${params.toString()}`);
  },

  // Student Behavior Records
  getStudentBehaviorRecords: async (student_id: number, academic_year_id: number) => {
    const params = new URLSearchParams({
      academic_year_id: academic_year_id.toString()
    });
    return apiClient.get<any>(`/analytics/students/${student_id}/behavior-records?${params.toString()}`);
  },
};

// History API
export const historyApi = {
  getHistory: async (filters?: HistoryFilters) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const queryString = params.toString();
    return apiClient.get<HistoryListResponse>(`/history${queryString ? `?${queryString}` : ''}`);
  },

  getStatistics: async (academic_year_id?: number) => {
    const params = academic_year_id ? `?academic_year_id=${academic_year_id}` : '';
    return apiClient.get<HistoryStatistics>(`/history/statistics${params}`);
  },

  getById: async (id: number) => {
    return apiClient.get<HistoryLog>(`/history/${id}`);
  },

  delete: async (id: number) => {
    return apiClient.delete<{success: boolean, message: string}>(`/history/${id}`);
  },
};

// File Management API
export const filesApi = {
  getAll: async () => {
    return apiClient.get<FileItem[]>('/files');
  },

  upload: async (formData: FormData) => {
    return apiClient.post<FileItem>('/files/upload', formData);
  },

  download: async (id: number) => {
    return apiClient.get<FileItem>(`/files/${id}/download`);
  },

  delete: async (id: number) => {
    return apiClient.delete<void>(`/files/${id}`);
  },

  getStorageStats: async () => {
    return apiClient.get<StorageStats>('/files/stats');
  },
};

// Unified API object for easier imports
export const api = {
  auth: authApi,
  academic: {
    getAllAcademicYears: academicYearsApi.getAll,
    getAcademicYear: academicYearsApi.getById,
    createAcademicYear: academicYearsApi.create,
    updateAcademicYear: academicYearsApi.update,
    deleteAcademicYear: academicYearsApi.delete,
    checkFirstRun: academicYearsApi.checkFirstRun,
    initializeFirstYear: academicYearsApi.initializeFirstYear,
    getClasses: classesApi.getAll,
    getSubjects: subjectsApi.getAll,
    saveSettings: academicSettingsApi.save,
    getSettings: academicSettingsApi.get,
  },
  students: {
    getAll: studentsApi.getAll,
    getById: studentsApi.getById,
    create: studentsApi.create,
    update: studentsApi.update,
    deactivate: studentsApi.deactivate,
    getFinances: studentsApi.getFinances,
    createFinance: studentsApi.createFinance,
    getPayments: studentsApi.getPayments,
    recordPayment: studentsApi.recordPayment,
    getAcademics: studentsApi.getAcademics,
    createAcademics: studentsApi.createAcademic,
    updateAcademics: studentsApi.updateAcademic,
    search: studentsApi.search,
  },
  teachers: teachersApi,
  classes: {
    getAll: classesApi.getAll,
    getById: classesApi.getById,
    create: classesApi.create,
    update: classesApi.update,
    delete: classesApi.delete,
  },
  subjects: {
    getAll: subjectsApi.getAll,
    getById: subjectsApi.getById,
    create: subjectsApi.create,
    update: subjectsApi.update,
    delete: subjectsApi.delete,
  },
  activities: activitiesApi,
  schedules: schedulesApi,
  finance: financeApi,
  financeManager: financeManagerApi,
  monitoring: monitoringApi,
  director: directorApi,
  analytics: analyticsApi,
  files: filesApi,
  history: historyApi,
};

// Export API client and error class
export { ApiClient, ApiError };
export default apiClient;