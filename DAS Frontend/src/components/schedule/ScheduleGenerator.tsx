import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  Play,
  CheckCircle,
  AlertTriangle,
  Clock,
  Calendar,
  Users,
  BookOpen,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { schedulesApi } from "@/services/api";
import { ScheduleGenerationResult } from "@/types/backend";

interface IncompleteClassInfo {
  className: string;
  reason: string;
  missingItems: string[];
  suggestion: string;
}

interface ConflictInfo {
  type: "teacher_conflict" | "constraint_violation" | "resource_conflict";
  description: string;
  affectedItems: string[];
  severity: "high" | "medium" | "low";
  suggestion: string;
}

interface ScheduleGeneratorProps {
  projectId: string;
  academicYearId: number;
  sessionType: "morning" | "evening";
  classId?: number;
  section?: string;
  onScheduleGenerated?: (payload: {
    apiResponse: any;
    previewData?: any[] | null;
    generationRequest: any;
  }) => void;
}

export const ScheduleGenerator: React.FC<ScheduleGeneratorProps> = ({
  projectId,
  academicYearId,
  sessionType,
  classId,
  section,
  onScheduleGenerated,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [lastResult, setLastResult] = useState<ScheduleGenerationResult | null>(
    null
  );

  // Generation steps based on backend process
  const generationSteps = [
    "تحليل البيانات المدخلة",
    "التحقق من صحة القيود",
    "تحديد المتطلبات لكل صف",
    "توزيع المعلمين على المواد",
    "إنشاء الجداول الأساسية",
    "تطبيق القيود والشروط",
    "حل التعارضات",
    "تحسين التوزيع",
    "التحقق النهائي",
    "حفظ النتائج",
  ];

  const handleGenerateSchedules = async () => {
    setIsGenerating(true);
    setGenerationProgress(0);
    setCurrentStep("");

    try {
      // Prepare the request with required fields for schedule generation
      const currentDate = new Date();
      const startDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
      );
      const endDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 6,
        0
      );

      const generationRequest = {
        academic_year_id: academicYearId,
        session_type: sessionType,
        class_id: classId, // Add class_id
        section: section, // Add section
        name: `${
          sessionType === "morning"
            ? "جدول الفترة الصباحية"
            : "جدول الفترة المسائية"
        } - ${new Date().getFullYear()}`,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        periods_per_day: 6,
        break_periods: [3],
        break_duration: 15,
        working_days: ["sunday", "monday", "tuesday", "wednesday", "thursday"],
        session_start_time: sessionType === "morning" ? "08:00:00" : "14:00:00",
        period_duration: 45,
        auto_assign_teachers: true,
        balance_teacher_load: true,
        avoid_teacher_conflicts: true,
        prefer_subject_continuity: true,
        preview_only: true, // Generate preview only, don't save to database
      };

      // Call the backend API to generate schedules
      const response = await schedulesApi.generate(generationRequest);

      if (response.success && response.data) {
        // Check if generation actually created schedules
        const totalCreated = response.data.total_assignments_created || 0;

        if (
          totalCreated === 0 &&
          response.data.warnings &&
          response.data.warnings.length > 0
        ) {
          // Generation failed - show detailed error
          const firstWarnings = response.data.warnings.slice(0, 5);
          const warningsText = firstWarnings.join("\n• ");

          toast({
            title: "فشل في إنشاء الجدول",
            description: `تم اكتشاف ${response.data.warnings.length} مشكلة. أول 5 مشاكل:\n• ${warningsText}`,
            variant: "destructive",
          });

          // Show diagnostic info
          try {

            const diagnostics = await schedulesApi.getDiagnostics(
              academicYearId,
              sessionType
            );
            if (diagnostics.success && diagnostics.data) {
              const issues = diagnostics.data.issues;
              const recommendations = diagnostics.data.recommendations.filter(
                (r: string | null) => r !== null
              );

              if (recommendations.length > 0) {
                toast({
                  title: "تشخيص المشكلة",
                  description: `${recommendations.join(
                    "\n"
                  )}\n\nالمواد الناقصة: ${
                    issues.missing_subjects.length
                  }\nالمعلمين غير المكلفين: ${
                    issues.missing_teacher_assignments.length
                  }`,
                  variant: "destructive",
                  duration: 10000, // Show for 10 seconds
                });
              }
            }
          } catch (diagError: any) {

            // Continue even if diagnostics fail - don't show error to user
          }

          setIsGenerating(false);
          return;
        }

        // Simulate step-by-step generation process for UI feedback
        for (let i = 0; i < generationSteps.length; i++) {
          setCurrentStep(generationSteps[i]);
          setGenerationProgress(((i + 1) / generationSteps.length) * 100);

          // Simulate processing time
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        // Process the response data to match our UI structure
        const processedResult: ScheduleGenerationResult = {
          success: response.data.generation_status === "completed",
          generated_schedules: [],
          missing_data: [],
          conflicts: [],
          total_grades: response.data.summary?.classes_scheduled || 0,
          completed_grades: response.data.summary?.classes_scheduled || 0,
          message: `تم إنشاء ${response.data.total_assignments_created} حصة بنجاح`,
        };

        setLastResult(processedResult);

        if (onScheduleGenerated) {
          onScheduleGenerated({
            apiResponse: response.data,
            previewData: response.data.preview_data || null,
            generationRequest
          });
        }

        // Check if there are warnings (soft constraint violations)
        const hasWarnings = response.data.warnings && response.data.warnings.length > 0;
        const hasConsecutiveViolation = hasWarnings && response.data.warnings.some(
          (w: string) => w.includes("تجاوزات") || w.includes("متتالية")
        );
        
        toast({
          title: hasConsecutiveViolation 
            ? "تم إنشاء الجدول مع بعض التجاوزات" 
            : "تم إنشاء الجدول بنجاح",
          description: hasConsecutiveViolation
            ? "تم إنشاء الجدول مع بعض التجاوزات في قيد عدم التتالي. تابع للخطوة التالية لمراجعته."
            : "تم إنشاء معاينة للجدول. تابع للخطوة التالية لمراجعته ونشره.",
          variant: hasConsecutiveViolation ? "default" : "default",
        });
      } else {
        throw new Error(response.message || "فشل في إنشاء الجدول");
      }
    } catch (error: any) {

      // More detailed error message
      let errorMessage = "حدث خطأ أثناء إنشاء الجدول";
      let errorTitle = "خطأ في إنشاء الجدول";

      // Check if error is about duplicate schedule name
      const errorDetail = error.response?.data?.detail || error.message || '';
      const isDuplicateName = errorDetail.includes('يوجد بالفعل جدول باسم') ||
                             errorDetail.includes('already exists') ||
                             errorDetail.includes('جدول باسم');

      if (isDuplicateName) {
        errorTitle = "⚠️ جدول مكرر";
        errorMessage = errorDetail || "يوجد بالفعل جدول بنفس الاسم للصف المحدد. يرجى اختيار اسم آخر.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      if (error.details && !isDuplicateName) {

        errorMessage += `\n\nالتفاصيل: ${JSON.stringify(error.details)}`;
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
        duration: 6000,
      });

      // Try to get diagnostics even on error
      try {

        const diagnostics = await schedulesApi.getDiagnostics(
          academicYearId,
          sessionType
        );
        if (diagnostics.success && diagnostics.data) {

          if (!diagnostics.data.is_ready_for_generation) {
            const recommendations = diagnostics.data.recommendations.filter(
              (r: string | null) => r !== null
            );
            if (recommendations.length > 0) {
              toast({
                title: "النظام غير جاهز لإنشاء الجدول",
                description: recommendations.join("\n"),
                variant: "destructive",
                duration: 10000,
              });
            }
          }
        }
      } catch (diagError: any) {

        // Don't show error to user - diagnostics is optional
      }
    } finally {
      setIsGenerating(false);
      setCurrentStep("");
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getConflictIcon = (type: string) => {
    switch (type) {
      case "teacher_conflict":
        return Users;
      case "constraint_violation":
        return AlertTriangle;
      case "resource_conflict":
        return Calendar;
      default:
        return AlertTriangle;
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Generation Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            إنشاء الجدول الدراسي
          </CardTitle>
          <CardDescription>
            إنشاء جدول تلقائي للصف والشعبة المحددين مع مراعاة القيود والشروط
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isGenerating && !lastResult && (
            <div className="text-center py-8">
              <Play className="h-16 w-16 mx-auto mb-4 text-primary opacity-50" />
              <h3 className="text-lg font-medium mb-2">جاهز لإنشاء الجدول</h3>
              <p className="text-muted-foreground mb-4">
                انقر على الزر أدناه لبدء عملية إنشاء الجدول الدراسي
              </p>
              <Button
                onClick={handleGenerateSchedules}
                size="lg"
                className="gap-2"
              >
                <Play className="h-5 w-5" />
                بدء إنشاء الجدول
              </Button>
            </div>
          )}

          {isGenerating && (
            <div className="space-y-4">
              <div className="text-center">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                <h3 className="text-lg font-medium mb-2">
                  جاري إنشاء الجدول...
                </h3>
                <p className="text-muted-foreground">{currentStep}</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>التقدم</span>
                  <span>{Math.round(generationProgress)}%</span>
                </div>
                <Progress value={generationProgress} className="w-full" />
              </div>

              <div className="text-center text-sm text-muted-foreground">
                يرجى الانتظار، قد تستغرق العملية عدة دقائق...
              </div>
            </div>
          )}

          {!isGenerating && lastResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <div>
                    <h3 className="text-lg font-medium">
                      تم إنشاء معاينة الجدول
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {lastResult.message || 'يمكنك الآن الانتقال للخطوة التالية لمراجعة الجدول.'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateSchedules}
                  >
                    <RefreshCw className="h-4 w-4 ml-1" />
                    إعادة إنشاء
                  </Button>
                </div>
              </div>
              <div className="p-4 border border-dashed rounded-lg bg-blue-50 text-sm text-blue-900">
                تم إنشاء الجدول في وضع المعاينة فقط. لن يتم حفظ أي بيانات قبل الوصول إلى مرحلة "التصدير" والنشر.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Summary */}
      {lastResult && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold">{lastResult.completed_grades}</p>
                <p className="text-sm text-muted-foreground">جداول مُنشأة</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold">{lastResult.total_grades}</p>
                <p className="text-sm text-muted-foreground">إجمالي الصفوف</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                <p className="text-2xl font-bold">
                  {lastResult.missing_data.length}
                </p>
                <p className="text-sm text-muted-foreground">صفوف ناقصة</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold">
                  {lastResult.conflicts.length}
                </p>
                <p className="text-sm text-muted-foreground">تعارضات</p>
              </CardContent>
            </Card>
          </div>

          {/* Missing Data (Incomplete Classes) */}
          {lastResult.missing_data.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  الصفوف غير المكتملة ({lastResult.missing_data.length})
                </CardTitle>
                <CardDescription>
                  الصفوف التي لم يتم إنشاء جداولها بسبب نقص المعلومات
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lastResult.missing_data.map((missingInfo, index) => (
                    <div
                      key={index}
                      className="p-4 border rounded-lg bg-orange-50"
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-medium text-orange-800">
                            {missingInfo.grade} - {missingInfo.division}
                          </h4>
                          <p className="text-sm text-orange-700 mt-1">
                            {missingInfo.reason}
                          </p>

                          <div className="mt-2">
                            <p className="text-xs font-medium text-orange-800 mb-1">
                              المطلوب:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {missingInfo.required_actions.map(
                                (action, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className="text-xs text-orange-700 border-orange-300"
                                  >
                                    {action}
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>

                          <div className="mt-2 p-2 bg-orange-100 rounded text-xs text-orange-800">
                            <strong>الحل المقترح:</strong>{" "}
                            {missingInfo.suggestion}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-orange-700 border-orange-300"
                        >
                          إصلاح
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conflicts */}
          {lastResult.conflicts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  التعارضات المكتشفة ({lastResult.conflicts.length})
                </CardTitle>
                <CardDescription>
                  التعارضات التي تم اكتشافها أثناء عملية الجدولة
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lastResult.conflicts.map((conflict, index) => {
                    const ConflictIcon = getConflictIcon(
                      conflict.constraint_type
                    );
                    return (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-start gap-3">
                          <ConflictIcon className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">
                                {conflict.description}
                              </h4>
                              <Badge
                                variant={
                                  getSeverityColor(conflict.priority) as any
                                }
                                className="text-xs"
                              >
                                {conflict.priority}
                              </Badge>
                            </div>

                            <div className="text-sm text-muted-foreground mb-2">
                              <strong>المتأثر:</strong>{" "}
                              {conflict.affected_items.join(", ")}
                            </div>

                            <div className="p-2 bg-blue-50 rounded text-sm text-blue-800">
                              <strong>الحل المقترح:</strong>{" "}
                              {conflict.suggestion}
                            </div>

                            {conflict.detailed_steps &&
                              conflict.detailed_steps.length > 0 && (
                                <div className="mt-2">
                                  <strong className="text-xs">
                                    خطوات الحل:
                                  </strong>
                                  <ul className="list-disc list-inside text-xs text-gray-600 mt-1">
                                    {conflict.detailed_steps.map(
                                      (step, idx) => (
                                        <li key={idx}>{step}</li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              )}
                          </div>
                          <Button variant="outline" size="sm">
                            حل
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Message */}
          {lastResult.message && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-500" />
                  معلومات إضافية
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">{lastResult.message}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
