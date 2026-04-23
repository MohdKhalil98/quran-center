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
  { id: 'l3_1', name: 'المد بالألف ص92', order: 1 },
  { id: 'l3_2', name: 'تمرين على المد بالألف بالتجريد ص93', order: 2 },
  { id: 'l3_3', name: 'تمرين على المد بالألف بدون التجريد ص93', order: 3 },
  { id: 'l3_4', name: 'المد بالواو ص94', order: 4 },
  { id: 'l3_5', name: 'تمرين على المد بالواو بالتجريد ص95', order: 5 },
  { id: 'l3_6', name: 'تمرين على المد بالواو بدون التجريد ص95', order: 6 },
  { id: 'l3_7', name: 'المد بالياء ص96', order: 7 },
  { id: 'l3_8', name: 'تمرين على المد بالياء بالتجريد ص97', order: 8 },
  { id: 'l3_9', name: 'تمرين على المد بالياء بدون التجريد ص97', order: 9 },
  { id: 'l3_10', name: 'الألف المدية الصغيرة ص100', order: 10 },
  { id: 'l3_11', name: 'تمرين على الألف المدية الصغيرة القسم الثالث ص101', order: 11 },
  { id: 'l3_12', name: 'تمرين على الألف المدية الصغيرة القسم الرابع ص101', order: 12 },
  { id: 'l3_13', name: 'الألف المقصورة القسم الأول ص102', order: 13 },
  { id: 'l3_14', name: 'الألف المقصورة القسم الثاني ص102', order: 14 },
  { id: 'l3_15', name: 'الواو المدية الصغيرة ص103', order: 15 },
  { id: 'l3_16', name: 'الياء المدية الصغيرة ص104', order: 16 },
  { id: 'l3_17', name: 'قراءة الكلمات التي تبدأ بهمزة الوصل ص106', order: 17 },
  { id: 'l3_18', name: 'التمرين على ما سبق ص107', order: 18 },
  { id: 'l3_19', name: 'قراءة اللام القمرية ص108', order: 19 },
  { id: 'l3_20', name: 'تمرين على ما سبق ص109', order: 20 },
  { id: 'l3_21', name: 'قراءة اللام الشمسية ص110 + ص111', order: 21 },
  { id: 'l3_22', name: 'قراءة النون و الميم المشددتين ص112', order: 22 },
  { id: 'l3_23', name: 'قراءة الواو في لفظ الجلالة ص113', order: 23 },
];

// دروس المستوى الرابع
const level4Lessons: ArabicLesson[] = [
  { id: 'l4_1', name: 'قراءة الكلمة التي فيها علامة المد ص121', order: 1 },
  { id: 'l4_2', name: 'قراءة الحروف المقطعة ص127', order: 2 },
  { id: 'l4_3', name: 'قراءة الحرف الساكن ص128', order: 3 },
  { id: 'l4_4', name: 'قراءة النون الساكنة إذا جاء بعدها حرف الباء مع ميم صغيرة ص129', order: 4 },
  { id: 'l4_5', name: 'قراءة النون الساكنة إذا جاء بعدها حرف من حروف يومن ص130', order: 5 },
  { id: 'l4_6', name: 'كيف نقف النون على الكلمة المتحركة و الساكنة ص132', order: 6 },
  { id: 'l4_7', name: 'كيف نقف الميم على الكلمة المتحركة و الساكنة ص133', order: 7 },
  { id: 'l4_8', name: 'الوقف على آخر الكلمة المنونة بالفتح ص134', order: 8 },
  { id: 'l4_9', name: 'الوقف على الكلمة المنتهية بتاء مفتوحة ص135', order: 9 },
  { id: 'l4_10', name: 'الوقف على الكلمة المنتهية بتاء مربوطة ص136', order: 10 },
  { id: 'l4_11', name: 'الوقف على الكلمة المنتهية بحرف مشدد ص137', order: 11 },
  { id: 'l4_12', name: 'الوقف على الكلمة المنتهية بنون أو ميم مشددتين ص138', order: 12 },
  { id: 'l4_13', name: 'الوقف على الكلمة المنتهية بحرف من حروف المد ص139', order: 13 },
  { id: 'l4_14', name: 'معرفة علامات الوقف ص140', order: 14 },
  { id: 'l4_15', name: 'الوقف اللازم حسب مصحف المدينة المنورة ص141', order: 15 },
  { id: 'l4_16', name: 'قراءة السكتات المطلوبة ص144', order: 16 },
  { id: 'l4_17', name: 'معرفة بعض مصطلحات الرسم العثماني ص145', order: 17 },
  { id: 'l4_18', name: 'قراءة التقاء الساكنين ص146', order: 18 },
  { id: 'l4_19', name: 'قراءة التقاء الساكنين ص147', order: 19 },
  { id: 'l4_20', name: 'قراءة التقاء الساكنين ص148', order: 20 },
  { id: 'l4_21', name: 'قراءة بعض الكلمات التي لها قراءة خاصة ص149', order: 21 },
  { id: 'l4_22', name: 'قراءة بعض الكلمات التي لها قراءة خاصة ص151', order: 22 },
];

// دروس المستوى الخامس
const level5Lessons: ArabicLesson[] = [
  { id: 'l5_1', name: 'ص162 قراءة القصيدة (من متن المقدمة الجزرية)', order: 1 },
  { id: 'l5_2', name: 'ص163 الآيات الخمس الأولى من سورة العلق', order: 2 },
  { id: 'l5_3', name: 'ص164 سورة الفاتحة', order: 3 },
  { id: 'l5_4', name: 'ص166 سورة التين', order: 4 },
  { id: 'l5_5', name: 'ص166 سورة التين', order: 5 },
  { id: 'l5_6', name: 'ص166 سورة العلق الجزء الأول من آية 1 إلى 10', order: 6 },
  { id: 'l5_7', name: 'ص166 الجزء الثاني سورة العلق', order: 7 },
  { id: 'l5_8', name: 'ص167 سورة القدر', order: 8 },
  { id: 'l5_9', name: 'ص167', order: 9 },
  { id: 'l5_10', name: 'ص167 الجزء الأول سورة البينة حتى الآية 5', order: 10 },
  { id: 'l5_11', name: 'ص167 الجزء الثاني سورة البينة', order: 11 },
  { id: 'l5_12', name: 'الحصة 12 – ص168 سورة الزلزلة', order: 12 },
  { id: 'l5_13', name: 'الحصة 13 – ص168 سورة العاديات', order: 13 },
  { id: 'l5_14', name: 'الحصة 14 – ص169 سورة القارعة', order: 14 },
  { id: 'l5_15', name: 'الحصة 15 – ص169 سورة التكاثر', order: 15 },
  { id: 'l5_16', name: 'الحصة 16 – ص170 سورة العصر والهمزة', order: 16 },
  { id: 'l5_17', name: 'الحصة 17 – سورة الفيل', order: 17 },
  { id: 'l5_18', name: 'الحصة 18 – سورة قريش والماعون والكوثر', order: 18 },
  { id: 'l5_19', name: 'الحصة 19 – الكافرون والنصر والمسد', order: 19 },
  { id: 'l5_20', name: 'الحصة 20 – الإخلاص والفلق والناس', order: 20 },
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
