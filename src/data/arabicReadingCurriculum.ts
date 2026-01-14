// بيانات منهج التأسيس على القراءة العربية
// المستويات = 6 مستويات
// المراحل = الدروس داخل كل مستوى
// عند إنتهاء الطالب من المستوى ينتظر موافقة المشرف للانتقال للمستوى التالي

export interface ArabicLesson {
  id: string;
  name: string;
  order: number;
  description?: string;
}

export interface ArabicLevel {
  id: string;
  name: string;
  levelNumber: number;
  order: number;
  lessons: ArabicLesson[];
  requiresSupervisorApproval: boolean; // يحتاج موافقة المشرف للانتقال للمستوى التالي
}

// دروس المستوى الأول
const level1Lessons: ArabicLesson[] = [
  { id: 'l1_1', name: 'قراءة الحروف الهجائية ص37', order: 1 },
  { id: 'l1_2', name: 'مراجعة الحروف الهجائية + الحروف المفخمة', order: 2 },
  { id: 'l1_3', name: 'قراءة أحوال الحروف ص38 + ص39', order: 3 },
  { id: 'l1_4', name: 'قراءة أحوال الحروف ص40', order: 4 },
  { id: 'l1_5', name: 'قراءة الحروف الحركية', order: 5 },
  { id: 'l1_6', name: 'قراءة الحرف مع الفتحة', order: 6 },
  { id: 'l1_7', name: 'تمرين على الفتحة ( تجريد )', order: 7 },
  { id: 'l1_8', name: 'تمرين على الفتحة ( بدون تجريد )', order: 8 },
  { id: 'l1_9', name: 'قراءة الحرف مع الكسرة', order: 9 },
  { id: 'l1_10', name: 'تمرين على الكسرة ( تجريد )', order: 10 },
  { id: 'l1_11', name: 'تمرين على الكسرة ( بدون تجريد )', order: 11 },
  { id: 'l1_12', name: 'قراءة الحرف مع الضمة', order: 12 },
  { id: 'l1_13', name: 'تمرين على الضمة ( تجريد )', order: 13 },
  { id: 'l1_14', name: 'تمرين على الضمة ( بدون تجريد )', order: 14 },
  { id: 'l1_15', name: 'قراءة الحركات الثلاث', order: 15 },
  { id: 'l1_16', name: 'تمرين على قراءة الحركات الثلاث', order: 16 },
  { id: 'l1_17', name: 'قراءة الكلمة بدون تجريد ص52', order: 17 },
  { id: 'l1_18', name: 'قراءة الكلمة بدون تجريد ص53', order: 18 },
];

// دروس المستوى الثاني
const level2Lessons: ArabicLesson[] = [
  { id: 'l2_1', name: 'قراءة الحرف الساكن و القلقلة القسم الأول ص66', order: 1 },
  { id: 'l2_2', name: 'قراءة الحرف الساكن و القلقلة القسم الثاني ص66', order: 2 },
  { id: 'l2_3', name: 'تمرين على الحرف الساكن و القلقلة بالتجريد ص67', order: 3 },
  { id: 'l2_4', name: 'قراءة الحرف الخالي من الحركة ص68', order: 4 },
  { id: 'l2_5', name: 'قراءة الكلمة بالتجريد ص69', order: 5 },
  { id: 'l2_6', name: 'قراءة الكلمة بدون تجريد ص69', order: 6 },
  { id: 'l2_7', name: 'قراءة التنوين بالفتح ص70', order: 7 },
  { id: 'l2_8', name: 'تمرين على ما سبق ص71', order: 8 },
  { id: 'l2_9', name: 'قراءة التنوين بالضم ص72', order: 9 },
  { id: 'l2_10', name: 'تمرين على ما سبق ص73', order: 10 },
  { id: 'l2_11', name: 'قراءة التنوين بالكسرة ص74', order: 11 },
  { id: 'l2_12', name: 'التمرين على ما سبق ص75', order: 12 },
  { id: 'l2_13', name: 'قراءة الحرف المشدد ص76', order: 13 },
  { id: 'l2_14', name: 'التمرين على ما سبق ص77', order: 14 },
  { id: 'l2_15', name: 'قراءة الحرف المشدد الذي بعده حرف ساكن أو مشدد ص78', order: 15 },
  { id: 'l2_16', name: 'قراءة الحرف المشدد الذي بعده حرف ساكن أو مشدد ص78', order: 16 },
  { id: 'l2_17', name: 'تمرين على ما سبق القسم الأول ص79', order: 17 },
  { id: 'l2_18', name: 'تمرين على ما سبق القسم الثاني ص79', order: 18 },
];

// دروس المستوى الثالث
const level3Lessons: ArabicLesson[] = [
  { id: 'l3_1', name: 'قريباً', order: 1, description: 'سيتم إضافة المحتوى قريباً' },
];

// دروس المستوى الرابع
const level4Lessons: ArabicLesson[] = [
  { id: 'l4_1', name: 'قريباً', order: 1, description: 'سيتم إضافة المحتوى قريباً' },
];

// دروس المستوى الخامس
const level5Lessons: ArabicLesson[] = [
  { id: 'l5_1', name: 'قريباً', order: 1, description: 'سيتم إضافة المحتوى قريباً' },
];

// دروس المستوى السادس
const level6Lessons: ArabicLesson[] = [
  { id: 'l6_1', name: 'قريباً', order: 1, description: 'سيتم إضافة المحتوى قريباً' },
];

// المنهج الكامل - 6 مستويات
export const arabicReadingCurriculum: ArabicLevel[] = [
  { 
    id: 'level1', 
    name: 'المستوى الأول', 
    levelNumber: 1, 
    order: 1, 
    lessons: level1Lessons,
    requiresSupervisorApproval: true
  },
  { 
    id: 'level2', 
    name: 'المستوى الثاني', 
    levelNumber: 2, 
    order: 2, 
    lessons: level2Lessons,
    requiresSupervisorApproval: true
  },
  { 
    id: 'level3', 
    name: 'المستوى الثالث', 
    levelNumber: 3, 
    order: 3, 
    lessons: level3Lessons,
    requiresSupervisorApproval: true
  },
  { 
    id: 'level4', 
    name: 'المستوى الرابع', 
    levelNumber: 4, 
    order: 4, 
    lessons: level4Lessons,
    requiresSupervisorApproval: true
  },
  { 
    id: 'level5', 
    name: 'المستوى الخامس', 
    levelNumber: 5, 
    order: 5, 
    lessons: level5Lessons,
    requiresSupervisorApproval: true
  },
  { 
    id: 'level6', 
    name: 'المستوى السادس', 
    levelNumber: 6, 
    order: 6, 
    lessons: level6Lessons,
    requiresSupervisorApproval: true
  },
];

// نظام النقاط لمنهج التأسيس
export const ARABIC_READING_POINTS = {
  LESSON_COMPLETION: 10,      // إتمام الدرس
  PERFECT_RATING: 5,          // درجة ممتازة
  LEVEL_COMPLETION: 100,      // إتمام المستوى
};

// الحصول على المستوى الافتراضي للطالب الجديد
export const getDefaultArabicLevel = () => {
  return arabicReadingCurriculum[0]; // المستوى الأول
};

// الحصول على الدرس الافتراضي
export const getDefaultArabicLesson = () => {
  return arabicReadingCurriculum[0].lessons[0]; // الدرس الأول من المستوى الأول
};

// الحصول على المستوى التالي
export const getNextLevel = (currentLevelId: string): ArabicLevel | null => {
  const currentIndex = arabicReadingCurriculum.findIndex(l => l.id === currentLevelId);
  if (currentIndex === -1 || currentIndex === arabicReadingCurriculum.length - 1) {
    return null;
  }
  return arabicReadingCurriculum[currentIndex + 1];
};

// الحصول على الدرس التالي
export const getNextLesson = (levelId: string, currentLessonId: string): { lesson: ArabicLesson | null; levelCompleted: boolean } => {
  const level = arabicReadingCurriculum.find(l => l.id === levelId);
  if (!level) return { lesson: null, levelCompleted: false };

  const currentIndex = level.lessons.findIndex(l => l.id === currentLessonId);
  if (currentIndex === -1) return { lesson: null, levelCompleted: false };

  // إذا كان هذا آخر درس في المستوى
  if (currentIndex === level.lessons.length - 1) {
    return { lesson: null, levelCompleted: true };
  }

  return { lesson: level.lessons[currentIndex + 1], levelCompleted: false };
};

// حساب نقاط المستوى الكلية
export const getLevelTotalPoints = (level: ArabicLevel): number => {
  const lessonsPoints = level.lessons.length * (ARABIC_READING_POINTS.LESSON_COMPLETION + ARABIC_READING_POINTS.PERFECT_RATING);
  return lessonsPoints + ARABIC_READING_POINTS.LEVEL_COMPLETION;
};

// حساب التقدم في المستوى
export const calculateLevelProgress = (completedLessons: number, totalLessons: number): number => {
  if (totalLessons === 0) return 0;
  return Math.round((completedLessons / totalLessons) * 100);
};

export default arabicReadingCurriculum;
