import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.services.analytics_service import AnalyticsService

service = AnalyticsService()

print("\n" + "="*80)
print("اختبار حساب متوسط العلامات الجديد")
print("="*80 + "\n")

# Get school-wide grades
results = service.get_school_wide_grades(academic_year_id=1)

# Find final exam (امتحان 2)
for item in results:
    if item['assignment_type'] == 'امتحان' and item['assignment_number'] == 2:
        print(f"نوع التقييم: {item['assignment_type']} {item['assignment_number']}")
        print(f"المادة: {item['subject_name']}")
        print(f"\nالدوام الصباحي:")
        print(f"  مجموع معدلات الطلاب: {item['morning_sum']:.2f}")
        print(f"  عدد الطلاب: {item['morning_count']}")
        if item['morning_count'] > 0:
            avg = item['morning_sum'] / item['morning_count']
            print(f"  المتوسط النهائي: {avg:.2f} من 100")
        
        print(f"\nالدوام المسائي:")
        print(f"  مجموع معدلات الطلاب: {item['evening_sum']:.2f}")
        print(f"  عدد الطلاب: {item['evening_count']}")
        if item['evening_count'] > 0:
            avg = item['evening_sum'] / item['evening_count']
            print(f"  المتوسط النهائي: {avg:.2f} من 100")
        
        print("\n" + "="*80)
        print("التوقع: المتوسط الصباحي يجب أن يكون حوالي 58 (متوسط 96 و 20)")
        print("="*80 + "\n")
        break
