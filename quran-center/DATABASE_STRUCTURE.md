# هيكل قاعدة البيانات Firebase

## المجموعات (Collections) المطلوبة

### 1. مجموعة `students` (الطلاب)

```
{
  id: "student_id",
  name: string,           // اسم الطالب
  personalId: string,     // الرقم الشخصي
  phone: string,          // رقم الهاتف
  email: string,          // البريد الإلكتروني
  birthDate: string,      // تاريخ الميلاد (YYYY-MM-DD)
  levelId: number         // معرّف المستوى (1..6)
  levelName: string       // اسم المستوى (مثال: "المستوى الأول - جزء عمّ")
}
```

### 2. مجموعة `teachers` (المعلمون)

```
{
  id: "teacher_id",
  name: string,           // اسم المعلم
  personalId: string,     // الرقم الشخصي
  phone: string,          // رقم الهاتف
  email: string,          // البريد الإلكتروني
  position: string,       // الوظيفة: "supervisor" | "teacher" | "admin"
  birthDate: string       // تاريخ الميلاد (YYYY-MM-DD)
}
```

### 3. مجموعة `groups` (المجموعات)

```
{
  id: "group_id",
  name: string,           // اسم المجموعة
  teacherId: string,      // معرّف المعلم (رابط إلى teachers)
  description: string,    // وصف المجموعة
  schedule: string        // الجدول الزمني (مثال: الأحد والثلاثاء)
}
```

### 4. مجموعة `student_achievements` (تحصيل الطالب)

```
{
  id: "achievement_id",
  studentId: string,           // معرّف الطالب (رابط إلى students)
  portion: string,             // الورد (السورة/الجزء)
  fromAya: string,             // من آية
  toAya: string,               // إلى آية
  rating: number,              // التقييم (1-10)
  assignmentFromAya: string,   // الواجب من آية
  assignmentToAya: string,     // الواجب إلى آية
  date: string                 // التاريخ (ISO format)
}
```

## التعليمات لتنظيف وإعداد قاعدة البيانات

### الخطوة 1: الوصول إلى Firebase Console

1. اذهب إلى https://console.firebase.google.com
2. اختر مشروعك "halqatmoza"
3. انتقل إلى Firestore Database

### الخطوة 2: إنشاء المجموعات

1. انقر على "Create collection"
2. أنشئ كل من:
   - `students`
   - `teachers`
   - `groups`
   - `student_achievements`

### الخطوة 3: إضافة بيانات تجريبية (اختياري)

يمكنك إضافة بيانات تجريبية مباشرة من Firebase Console أو استخدام الموقع للإضافة.

## ملاحظات مهمة

- جميع الحقول المعلمة بـ \* في الصفحات هي حقول مطلوبة
- يجب أن يكون `teacherId` في مجموعة `groups` موجوداً في مجموعة `teachers`
- يجب أن يكون `studentId` في مجموعة `student_achievements` موجوداً في مجموعة `students`
- يتم حفظ التواريخ بصيغة ISO (YYYY-MM-DD)

## اختبار الاتصال

عند فتح كل صفحة، ستظهر:

- رسالة تحميل أثناء جلب البيانات من Firebase
- رسالة خطأ إذا كان هناك مشكلة في الاتصال
- البيانات الفعلية من قاعدة البيانات عند نجاح الجلب
