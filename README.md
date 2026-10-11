# جدولي

صفحة لمواعيد الاختبارات والتسليمات. تقدر تضيف مواعيد جديدة من صورة أو نص.

## التشغيل على Cloudflare Pages

1. Workers & Pages ← Create ← Pages ← Connect to Git ← اختر `midterm-exams`
   - Framework preset: `None`
   - Build command: فاضي
   - Build output directory: `/`
2. Storage & Databases ← KV ← Create namespace باسم `jadwali`
3. في مشروع الصفحة ← Settings ← Bindings:
   - **KV namespace**: الاسم `DB` ← اختر `jadwali`
   - **Workers AI**: الاسم `AI`
4. Settings ← Variables and Secrets ← أضف Secret باسم `EDIT_KEY` (رمز التعديل حقك)
5. Deployments ← Retry deployment

## الملفات

- `index.html`: الصفحة
- `data.json`: البيانات الأولى (تُستخدم قبل أول حفظ)
- `functions/api/data.js`: قراءة وحفظ الجدول في KV
- `functions/api/read.js`: قراءة الصور والنص بـ Workers AI
