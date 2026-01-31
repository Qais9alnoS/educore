import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

const UpdateTestPage: React.FC = () => {
  return (
    <div className="container mx-auto p-6" dir="rtl">
      <Card className="max-w-md mx-auto mt-20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-6 w-6" />
            تم التحديث بنجاح!
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            هذه الصفحة تثبت أن التحديث يعمل بشكل صحيح.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            إصدار التحديث: 1.0.4
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default UpdateTestPage;
