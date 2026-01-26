import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Info, Settings } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Subject } from "@/types/school";
import { subjectsApi, schedulesApi } from "@/services/api";

interface ConstraintManagerProps {
  data: {
    academicYearId: number;
    classId: number;
  };
  onContinue: () => void;
}

interface Constraint {
  id: string;
  subject_id: number;
  subject_name: string;
  constraint_type: "no_consecutive" | "before_after" | "subject_per_day";
  priority_level: number;
  reference_subject_id?: number;
  reference_subject_name?: string;
  placement?: "before" | "after";
  description: string;
}

// All constraints are critical (حرج) priority - must be applied
const CRITICAL_PRIORITY = { value: 4, label: "حرج", color: "bg-red-100 text-red-800" };

export const ConstraintManager: React.FC<ConstraintManagerProps> = ({
  data,
  onContinue,
}) => {
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [hasSignaledReady, setHasSignaledReady] = useState(false);

  // New constraint form
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [constraintType, setConstraintType] = useState<
    "no_consecutive" | "before_after" | "subject_per_day"
  >("no_consecutive");
  const [priorityLevel] = useState(4);  // Always حرج - must be applied
  const [referenceSubject, setReferenceSubject] = useState<number | null>(null);
  const [placement, setPlacement] = useState<"before" | "after">("before");

  useEffect(() => {
    loadSubjects();
  }, [data.classId, data.academicYearId]);

  // Load constraints AFTER subjects are loaded (so we can resolve subject names)
  useEffect(() => {
    if (subjects.length > 0) {
      loadConstraints();
    }
  }, [subjects, data.academicYearId]);

  // Mark this step as ready as soon as it loads (optional step)
  useEffect(() => {
    if (hasSignaledReady) return;
    onContinue();
    setHasSignaledReady(true);
  }, [hasSignaledReady, onContinue]);

  // Load existing constraints from backend
  const loadConstraints = async () => {
    try {
      const response = await schedulesApi.getConstraints(data.academicYearId);
      if (response.success && response.data) {
        // Convert backend constraints to frontend format
        const loadedConstraints: Constraint[] = response.data
          .filter((c: any) => c.class_id === data.classId || c.class_id === null)
          .map((c: any) => {
            const subject = subjects.find(s => s.id === c.subject_id);
            const refSubject = c.reference_subject_id ? subjects.find(s => s.id === c.reference_subject_id) : null;
            let description = '';
            if (c.constraint_type === 'no_consecutive') {
              description = `${subject?.subject_name || 'مادة'}: لا يجب أن تكون الحصص متتالية`;
            } else if (c.constraint_type === 'subject_per_day') {
              description = `${subject?.subject_name || 'مادة'}: توزيع على جميع الأيام`;
            } else if (c.constraint_type === 'before_after') {
              const placementText = c.placement === 'before' ? 'قبل' : 'بعد';
              description = `${subject?.subject_name || 'مادة'}: لا يجب أن تكون ${placementText} ${refSubject?.subject_name || 'مادة'}`;
            } else {
              description = c.description || '';
            }
            return {
              id: String(c.id),
              subject_id: c.subject_id,
              subject_name: subject?.subject_name || 'مادة غير معروفة',
              constraint_type: c.constraint_type,
              priority_level: c.priority_level,
              reference_subject_id: c.reference_subject_id,
              reference_subject_name: refSubject?.subject_name,
              placement: c.placement,
              description,
            };
          });
        setConstraints(loadedConstraints);
      }
    } catch (error: any) {

    }
  };

  const loadSubjects = async () => {
    try {
      const response = await subjectsApi.getAll({ class_id: data.classId });
      if (response.success && response.data) {
        setSubjects(response.data);
      }
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل تحميل المواد",
        variant: "destructive",
      });
    }
  };

  const handleAddConstraint = async () => {
    if (!selectedSubject) {
      toast({
        title: "تنبيه",
        description: "يرجى اختيار المادة",
        variant: "destructive",
      });
      return;
    }

    if (constraintType === "before_after" && !referenceSubject) {
      toast({
        title: "تنبيه",
        description: "يرجى اختيار المادة المرجعية",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate constraint
    const existingConstraint = constraints.find(
      (c) => c.subject_id === selectedSubject && c.constraint_type === constraintType
    );
    if (existingConstraint) {
      toast({
        title: "تنبيه",
        description: "هذا القيد موجود بالفعل لهذه المادة",
        variant: "destructive",
      });
      return;
    }

    const subject = subjects.find((s) => s.id === selectedSubject);
    const refSubject = referenceSubject
      ? subjects.find((s) => s.id === referenceSubject)
      : null;

    if (!subject) return;

    let description = "";
    if (constraintType === "no_consecutive") {
      description = `${subject.subject_name}: لا يجب أن تكون الحصص متتالية`;
    } else if (constraintType === "before_after") {
      const placementText = placement === "before" ? "قبل" : "بعد";
      description = `${subject.subject_name}: لا يجب أن تكون ${placementText} ${refSubject?.subject_name}`;
    } else {
      description = `${subject.subject_name}: توزيع على جميع الأيام`;
    }

    const newConstraint: Constraint = {
      id: Date.now().toString(),
      subject_id: selectedSubject,
      subject_name: subject.subject_name,
      constraint_type: constraintType,
      priority_level: priorityLevel,
      reference_subject_id: referenceSubject || undefined,
      reference_subject_name: refSubject?.subject_name,
      placement: constraintType === "before_after" ? placement : undefined,
      description,
    };

    // Save to backend
    try {
      const backendConstraint: any = {
        academic_year_id: data.academicYearId,
        constraint_type: constraintType,
        class_id: data.classId,
        subject_id: selectedSubject,
        priority_level: priorityLevel,
        applies_to_all_sections: false,
        session_type: 'both' as const,
        description: description,
        is_active: true,
      };

      // Add before_after specific fields
      if (constraintType === "before_after" && referenceSubject) {
        backendConstraint.reference_subject_id = referenceSubject;
        backendConstraint.placement = placement;
      }

      const response = await schedulesApi.createConstraint(backendConstraint);

      if (response.success && response.data) {
        // Use the ID from the backend
        newConstraint.id = String(response.data.id);
        setConstraints([...constraints, newConstraint]);

        toast({
          title: "تم الإضافة",
          description: "تم حفظ القيد في قاعدة البيانات",
        });
      } else {
        throw new Error(response.message || 'فشل حفظ القيد');
      }
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل حفظ القيد في قاعدة البيانات",
        variant: "destructive",
      });
      return;
    }

    // Reset form
    setSelectedSubject(null);
    setConstraintType("no_consecutive");
    setReferenceSubject(null);
    setPlacement("before");
    setShowAddDialog(false);
  };

  const handleDeleteConstraint = async (id: string) => {
    try {
      // Delete from backend
      const response = await schedulesApi.deleteConstraint(parseInt(id));

      if (response.success) {
        setConstraints(constraints.filter((c) => c.id !== id));
        toast({
          title: "تم الحذف",
          description: "تم حذف القيد من قاعدة البيانات",
        });
      } else {
        throw new Error('فشل الحذف');
      }
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل حذف القيد",
        variant: "destructive",
      });
    }
  };

  const getPriorityBadge = () => {
    // All constraints are critical (حرج)
    return <Badge className={CRITICAL_PRIORITY.color}>{CRITICAL_PRIORITY.label}</Badge>;
  };

  const getConstraintTypeLabel = (type: string) => {
    switch (type) {
      case "no_consecutive":
        return "عدم التتالي";
      case "before_after":
        return "عدم الترتيب";
      case "subject_per_day":
        return "مادة كل يوم";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Constraints List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>القيود المحددة ({constraints.length})</CardTitle>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة قيد
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إضافة قيد جديد</DialogTitle>
                  <DialogDescription>
                    حدد المادة ونوع القيد الذي تريد تطبيقه
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {/* Subject Selection */}
                  <div className="space-y-2">
                    <Label>المادة</Label>
                    <Select
                      value={selectedSubject?.toString() || ""}
                      onValueChange={(value) =>
                        setSelectedSubject(parseInt(value))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المادة" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem
                            key={subject.id}
                            value={subject.id.toString()}
                          >
                            {subject.subject_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Constraint Type */}
                  <div className="space-y-2">
                    <Label>نوع القيد</Label>
                    <Select
                      value={constraintType}
                      onValueChange={(value) =>
                        setConstraintType(
                          value as
                            | "no_consecutive"
                            | "before_after"
                            | "subject_per_day"
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no_consecutive">
                          <div className="flex flex-col items-start">
                            <span>عدم التتالي</span>
                            <span className="text-xs text-muted-foreground">
                              لا تكون حصتين متتاليتين
                            </span>
                          </div>
                        </SelectItem>
                        <SelectItem value="before_after">
                          <div className="flex flex-col items-start">
                            <span>عدم الترتيب (قبل/بعد)</span>
                            <span className="text-xs text-muted-foreground">
                              لا تكون قبل أو بعد مادة معينة
                            </span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Before/After Options (conditional) */}
                  {constraintType === "before_after" && (
                    <>
                      <div className="space-y-2">
                        <Label>الموضع</Label>
                        <Select
                          value={placement}
                          onValueChange={(value) =>
                            setPlacement(value as "before" | "after")
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="before">قبل</SelectItem>
                            <SelectItem value="after">بعد</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>المادة المرجعية</Label>
                        <Select
                          value={referenceSubject?.toString() || ""}
                          onValueChange={(value) =>
                            setReferenceSubject(parseInt(value))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر المادة" />
                          </SelectTrigger>
                          <SelectContent>
                            {subjects
                              .filter((s) => s.id !== selectedSubject)
                              .map((subject) => (
                                <SelectItem
                                  key={subject.id}
                                  value={subject.id.toString()}
                                >
                                  {subject.subject_name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddDialog(false)}
                  >
                    إلغاء
                  </Button>
                  <Button onClick={handleAddConstraint}>
                    <Plus className="h-4 w-4 ml-2" />
                    إضافة
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {constraints.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Settings className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد قيود محددة</p>
              <p className="text-sm">
                يمكنك إضافة قيود لتحسين الجدول أو المتابعة بدون قيود
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {constraints.map((constraint) => (
                <div
                  key={constraint.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">
                          {getConstraintTypeLabel(constraint.constraint_type)}
                        </Badge>
                        <span className="text-sm font-medium">
                          {constraint.subject_name}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {constraint.description}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteConstraint(constraint.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* لا توجد أزرار تنقّل هنا؛ الانتقال يتم عبر زر "التالي" في الـ Wizard */}
    </div>
  );
};
