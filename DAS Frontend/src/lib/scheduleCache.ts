/**
 * Schedule Creation Cache Management
 * 
 * This utility handles localStorage cache for schedule creation with automatic
 * invalidation and cleanup based on various triggers (academic year change, 
 * successful save, page visibility, etc.)
 */

interface ScheduleCache {
  scheduleData: any;
  currentStep: string;
  stepStatus: Record<string, boolean>;
  previewData: any[] | null;
  scheduleAssignments: any[];
  generationRequest: any;
  isPreviewMode: boolean;
  timestamp: number;
  academicYearId: number; // Track which academic year this cache is for
  sessionType: string;
}

export const SCHEDULE_AUTOSAVE_KEY = 'schedule_creation_autosave';
export const SCHEDULE_CACHE_VERSION = 'schedule_cache_v1';

/**
 * Save schedule creation state to localStorage
 */
export const saveScheduleCache = (data: {
  scheduleData: any;
  currentStep: string;
  stepStatus: Record<string, boolean>;
  previewData: any[] | null;
  scheduleAssignments: any[];
  generationRequest: any;
  isPreviewMode: boolean;
}): void => {
  try {
    const cacheData: ScheduleCache = {
      ...data,
      timestamp: Date.now(),
      academicYearId: data.scheduleData?.academicYearId || 0,
      sessionType: data.scheduleData?.sessionType || ''
    };
    localStorage.setItem(SCHEDULE_AUTOSAVE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to save schedule cache:', error);
  }
};

/**
 * Load schedule creation state from localStorage
 * Returns null if cache is invalid or outdated
 */
export const loadScheduleCache = (): ScheduleCache | null => {
  try {
    const cached = localStorage.getItem(SCHEDULE_AUTOSAVE_KEY);
    if (!cached) return null;

    const data: ScheduleCache = JSON.parse(cached);

    // Validate cache
    if (!isValidCache(data)) {
      clearScheduleCache();
      return null;
    }

    return data;
  } catch (error) {
    console.warn('Failed to load schedule cache:', error);
    clearScheduleCache();
    return null;
  }
};

/**
 * Clear schedule creation cache completely
 */
export const clearScheduleCache = (): void => {
  try {
    localStorage.removeItem(SCHEDULE_AUTOSAVE_KEY);
  } catch (error) {
    console.warn('Failed to clear schedule cache:', error);
  }
};

/**
 * Clear cache if academic year has changed
 * Returns true if cache was cleared
 */
export const clearCacheIfAcademicYearChanged = (
  currentAcademicYearId: number | null
): boolean => {
  try {
    if (!currentAcademicYearId) return false;

    const cached = localStorage.getItem(SCHEDULE_AUTOSAVE_KEY);
    if (!cached) return false;

    const data: ScheduleCache = JSON.parse(cached);

    // If academic year changed, clear the cache
    if (data.academicYearId !== currentAcademicYearId) {
      console.log(
        `Schedule cache cleared: academic year changed from ${data.academicYearId} to ${currentAcademicYearId}`
      );
      clearScheduleCache();
      return true;
    }

    return false;
  } catch (error) {
    console.warn('Failed to check academic year change:', error);
    return false;
  }
};

/**
 * Clear cache if session type has changed
 * Returns true if cache was cleared
 */
export const clearCacheIfSessionTypeChanged = (
  currentSessionType: string | ''
): boolean => {
  try {
    if (!currentSessionType) return false;

    const cached = localStorage.getItem(SCHEDULE_AUTOSAVE_KEY);
    if (!cached) return false;

    const data: ScheduleCache = JSON.parse(cached);

    // If session type changed, clear the cache
    if (data.sessionType !== currentSessionType) {
      console.log(
        `Schedule cache cleared: session type changed from ${data.sessionType} to ${currentSessionType}`
      );
      clearScheduleCache();
      return true;
    }

    return false;
  } catch (error) {
    console.warn('Failed to check session type change:', error);
    return false;
  }
};

/**
 * Clear cache after successful schedule generation
 */
export const clearCacheAfterGeneration = (): void => {
  console.log('Schedule cache cleared: schedule successfully generated/published');
  clearScheduleCache();
};

/**
 * Validate cache based on:
 * - Timestamp freshness (24 hours max)
 * - Required data fields
 * - Schedule data consistency
 */
const isValidCache = (data: ScheduleCache): boolean => {
  if (!data || !data.timestamp) {
    return false;
  }

  // Check if cache is older than 24 hours
  const cacheAgeMinutes = (Date.now() - data.timestamp) / (1000 * 60);
  const maxCacheAgeMinutes = 24 * 60; // 24 hours

  if (cacheAgeMinutes > maxCacheAgeMinutes) {
    console.log('Schedule cache expired (older than 24 hours)');
    return false;
  }

  // Check for required data
  if (!data.scheduleData || !data.stepStatus) {
    return false;
  }

  // If there's preview data or assignment data, don't auto-load
  // Force user to regenerate
  if (data.previewData && data.previewData.length > 0) {
    // This is fine, preview data can be loaded
  }

  return true;
};

/**
 * Get cache age in minutes
 */
export const getCacheAgeMinutes = (): number | null => {
  try {
    const cached = localStorage.getItem(SCHEDULE_AUTOSAVE_KEY);
    if (!cached) return null;

    const data: ScheduleCache = JSON.parse(cached);
    return (Date.now() - data.timestamp) / (1000 * 60);
  } catch {
    return null;
  }
};

/**
 * Validate cache against current academic year and session type
 * Returns validation result with reasons if invalid
 */
export const validateCacheConsistency = (
  currentAcademicYearId: number | null,
  currentSessionType: string
): {
  isValid: boolean;
  reason?: string;
  cached?: ScheduleCache;
} => {
  try {
    const cached = loadScheduleCache();

    if (!cached) {
      return { isValid: false, reason: 'No cache found' };
    }

    // Check academic year match
    if (
      currentAcademicYearId &&
      cached.academicYearId !== currentAcademicYearId
    ) {
      return {
        isValid: false,
        reason: `Academic year mismatch: cached=${cached.academicYearId}, current=${currentAcademicYearId}`
      };
    }

    // Check session type match
    if (currentSessionType && cached.sessionType !== currentSessionType) {
      return {
        isValid: false,
        reason: `Session type mismatch: cached=${cached.sessionType}, current=${currentSessionType}`
      };
    }

    return { isValid: true, cached };
  } catch (error) {
    return { isValid: false, reason: `Validation error: ${error}` };
  }
};

/**
 * Reset specific cache fields while keeping others
 * Useful when changing filters but keeping other progress
 */
export const resetCacheFields = (
  fieldsToKeep: (keyof ScheduleCache)[]
): void => {
  try {
    const cached = loadScheduleCache();
    if (!cached) return;

    const kept: Record<string, any> = {};
    fieldsToKeep.forEach((field) => {
      if (field in cached) {
        kept[field] = (cached as any)[field];
      }
    });

    if (Object.keys(kept).length === 0) {
      clearScheduleCache();
    } else {
      const resetData: ScheduleCache = {
        scheduleData: null,
        currentStep: 'filter',
        stepStatus: {
          filter: false,
          validate: false,
          constraints: false,
          generate: false,
          view: false,
          conflicts: false,
          export: false
        },
        previewData: null,
        scheduleAssignments: [],
        generationRequest: null,
        isPreviewMode: false,
        timestamp: Date.now(),
        academicYearId: cached.academicYearId,
        sessionType: cached.sessionType,
        ...kept
      };

      localStorage.setItem(SCHEDULE_AUTOSAVE_KEY, JSON.stringify(resetData));
    }
  } catch (error) {
    console.warn('Failed to reset cache fields:', error);
  }
};
