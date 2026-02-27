// بيانات المنهج الجديد - حفظ القرآن الكريم
// 6 مستويات، كل مستوى يحتوي على 3-5 مراحل
// كل مرحلة تحتوي على مجموعة من السور

export interface QuranSurah {
  id: string;
  name: string;
  ayahCount: number;
  order: number;
}

export interface QuranStage {
  id: string;
  name: string;
  order: number;
  surahs: QuranSurah[];
}

export interface QuranLevel {
  id: string;
  name: string;
  levelNumber: number;
  order: number;
  stages: QuranStage[];
}

// ============================================================
// المستوى الأول - 5 مراحل
// ============================================================

const level1_stage1: QuranSurah[] = [
  { id: 'fatiha', name: 'الفاتحة', ayahCount: 7, order: 1 },
  { id: 'nas', name: 'الناس', ayahCount: 6, order: 2 },
  { id: 'falaq', name: 'الفلق', ayahCount: 5, order: 3 },
  { id: 'ikhlas', name: 'الإخلاص', ayahCount: 4, order: 4 },
  { id: 'masad', name: 'المسد', ayahCount: 5, order: 5 },
  { id: 'nasr', name: 'النصر', ayahCount: 3, order: 6 },
  { id: 'kafirun', name: 'الكافرون', ayahCount: 6, order: 7 },
  { id: 'kawthar', name: 'الكوثر', ayahCount: 3, order: 8 },
  { id: 'maun', name: 'الماعون', ayahCount: 7, order: 9 },
  { id: 'quraysh', name: 'قريش', ayahCount: 4, order: 10 },
  { id: 'fil', name: 'الفيل', ayahCount: 5, order: 11 },
  { id: 'humazah', name: 'الهمزة', ayahCount: 9, order: 12 },
  { id: 'asr', name: 'العصر', ayahCount: 3, order: 13 },
  { id: 'takathur', name: 'التكاثر', ayahCount: 8, order: 14 },
  { id: 'qariah', name: 'القارعة', ayahCount: 11, order: 15 },
  { id: 'adiyat', name: 'العاديات', ayahCount: 11, order: 16 },
  { id: 'zalzalah', name: 'الزلزلة', ayahCount: 8, order: 17 },
  { id: 'bayyinah', name: 'البينة', ayahCount: 8, order: 18 },
  { id: 'qadr', name: 'القدر', ayahCount: 5, order: 19 },
  { id: 'alaq', name: 'العلق', ayahCount: 19, order: 20 },
  { id: 'tin', name: 'التين', ayahCount: 8, order: 21 },
  { id: 'sharh', name: 'الشرح', ayahCount: 8, order: 22 },
  { id: 'duha', name: 'الضحى', ayahCount: 11, order: 23 },
  { id: 'layl', name: 'الليل', ayahCount: 21, order: 24 },
  { id: 'shams', name: 'الشمس', ayahCount: 15, order: 25 },
  { id: 'balad', name: 'البلد', ayahCount: 20, order: 26 },
  { id: 'fajr', name: 'الفجر', ayahCount: 30, order: 27 },
  { id: 'ghashiyah', name: 'الغاشية', ayahCount: 26, order: 28 },
  { id: 'ala', name: 'الأعلى', ayahCount: 19, order: 29 },
  { id: 'tariq', name: 'الطارق', ayahCount: 17, order: 30 },
  { id: 'buruj', name: 'البروج', ayahCount: 22, order: 31 },
  { id: 'inshiqaq', name: 'الانشقاق', ayahCount: 25, order: 32 },
  { id: 'mutaffifin', name: 'المطففين', ayahCount: 36, order: 33 },
  { id: 'infitar', name: 'الانفطار', ayahCount: 19, order: 34 },
  { id: 'takwir', name: 'التكوير', ayahCount: 29, order: 35 },
  { id: 'abasa', name: 'عبس', ayahCount: 42, order: 36 },
  { id: 'naziat', name: 'النازعات', ayahCount: 46, order: 37 },
  { id: 'naba', name: 'النبأ', ayahCount: 40, order: 38 },
];

const level1_stage2: QuranSurah[] = [
  { id: 'mursalat', name: 'المرسلات', ayahCount: 50, order: 1 },
  { id: 'insan', name: 'الإنسان', ayahCount: 31, order: 2 },
  { id: 'qiyamah', name: 'القيامة', ayahCount: 40, order: 3 },
  { id: 'muddathir', name: 'المدثر', ayahCount: 56, order: 4 },
  { id: 'muzzammil', name: 'المزمل', ayahCount: 20, order: 5 },
  { id: 'jinn', name: 'الجن', ayahCount: 28, order: 6 },
  { id: 'nuh', name: 'نوح', ayahCount: 28, order: 7 },
  { id: 'maarij', name: 'المعارج', ayahCount: 44, order: 8 },
  { id: 'haqqah', name: 'الحاقة', ayahCount: 52, order: 9 },
  { id: 'qalam', name: 'القلم', ayahCount: 52, order: 10 },
  { id: 'mulk', name: 'الملك', ayahCount: 30, order: 11 },
];

const level1_stage3: QuranSurah[] = [
  { id: 'tahrim', name: 'التحريم', ayahCount: 12, order: 1 },
  { id: 'talaq', name: 'الطلاق', ayahCount: 12, order: 2 },
  { id: 'taghabun', name: 'التغابن', ayahCount: 18, order: 3 },
  { id: 'munafiqun', name: 'المنافقون', ayahCount: 11, order: 4 },
  { id: 'jumuah', name: 'الجمعة', ayahCount: 11, order: 5 },
  { id: 'saff', name: 'الصف', ayahCount: 14, order: 6 },
  { id: 'mumtahanah', name: 'الممتحنة', ayahCount: 13, order: 7 },
  { id: 'hashr', name: 'الحشر', ayahCount: 24, order: 8 },
  { id: 'mujadilah', name: 'المجادلة', ayahCount: 22, order: 9 },
];

const level1_stage4: QuranSurah[] = [
  { id: 'dhariyat', name: 'الذاريات', ayahCount: 60, order: 1 },
  { id: 'tur', name: 'الطور', ayahCount: 49, order: 2 },
  { id: 'najm', name: 'النجم', ayahCount: 62, order: 3 },
  { id: 'qamar', name: 'القمر', ayahCount: 55, order: 4 },
  { id: 'rahman', name: 'الرحمن', ayahCount: 78, order: 5 },
  { id: 'waqiah', name: 'الواقعة', ayahCount: 96, order: 6 },
  { id: 'hadid', name: 'الحديد', ayahCount: 29, order: 7 },
];

const level1_stage5: QuranSurah[] = [
  { id: 'ahqaf', name: 'الأحقاف', ayahCount: 35, order: 1 },
  { id: 'muhammad', name: 'محمد', ayahCount: 38, order: 2 },
  { id: 'fath', name: 'الفتح', ayahCount: 29, order: 3 },
  { id: 'hujurat', name: 'الحجرات', ayahCount: 18, order: 4 },
  { id: 'qaf', name: 'ق', ayahCount: 45, order: 5 },
];

// ============================================================
// المستوى الثاني - 5 مراحل
// ============================================================

const level2_stage1: QuranSurah[] = [
  { id: 'shura', name: 'الشورى', ayahCount: 53, order: 1 },
  { id: 'zukhruf', name: 'الزخرف', ayahCount: 89, order: 2 },
  { id: 'dukhan', name: 'الدخان', ayahCount: 59, order: 3 },
  { id: 'jathiyah', name: 'الجاثية', ayahCount: 37, order: 4 },
];

const level2_stage2: QuranSurah[] = [
  { id: 'zumar', name: 'الزمر', ayahCount: 75, order: 1 },
  { id: 'ghafir', name: 'غافر', ayahCount: 85, order: 2 },
  { id: 'fussilat', name: 'فصلت', ayahCount: 54, order: 3 },
];

const level2_stage3: QuranSurah[] = [
  { id: 'yasin', name: 'يس', ayahCount: 83, order: 1 },
  { id: 'saffat', name: 'الصافات', ayahCount: 182, order: 2 },
  { id: 'sad', name: 'ص', ayahCount: 88, order: 3 },
];

const level2_stage4: QuranSurah[] = [
  { id: 'ahzab', name: 'الأحزاب', ayahCount: 73, order: 1 },
  { id: 'saba', name: 'سبأ', ayahCount: 54, order: 2 },
  { id: 'fatir', name: 'فاطر', ayahCount: 45, order: 3 },
];

const level2_stage5: QuranSurah[] = [
  { id: 'ankabut', name: 'العنكبوت', ayahCount: 69, order: 1 },
  { id: 'rum', name: 'الروم', ayahCount: 60, order: 2 },
  { id: 'luqman', name: 'لقمان', ayahCount: 34, order: 3 },
  { id: 'sajdah', name: 'السجدة', ayahCount: 30, order: 4 },
];

// ============================================================
// المستوى الثالث - 5 مراحل
// ============================================================

const level3_stage1: QuranSurah[] = [
  { id: 'naml', name: 'النمل', ayahCount: 93, order: 1 },
  { id: 'qasas', name: 'القصص', ayahCount: 88, order: 2 },
];

const level3_stage2: QuranSurah[] = [
  { id: 'furqan', name: 'الفرقان', ayahCount: 77, order: 1 },
  { id: 'shuara', name: 'الشعراء', ayahCount: 227, order: 2 },
];

const level3_stage3: QuranSurah[] = [
  { id: 'muminun', name: 'المؤمنون', ayahCount: 118, order: 1 },
  { id: 'nur', name: 'النور', ayahCount: 64, order: 2 },
];

const level3_stage4: QuranSurah[] = [
  { id: 'anbiya', name: 'الأنبياء', ayahCount: 112, order: 1 },
  { id: 'hajj', name: 'الحج', ayahCount: 78, order: 2 },
];

const level3_stage5: QuranSurah[] = [
  { id: 'maryam', name: 'مريم', ayahCount: 98, order: 1 },
  { id: 'taha', name: 'طه', ayahCount: 135, order: 2 },
];

// ============================================================
// المستوى الرابع - 5 مراحل
// ============================================================

const level4_stage1: QuranSurah[] = [
  { id: 'isra', name: 'الإسراء', ayahCount: 111, order: 1 },
  { id: 'kahf', name: 'الكهف', ayahCount: 110, order: 2 },
];

const level4_stage2: QuranSurah[] = [
  { id: 'hijr', name: 'الحجر', ayahCount: 99, order: 1 },
  { id: 'nahl', name: 'النحل', ayahCount: 128, order: 2 },
];

const level4_stage3: QuranSurah[] = [
  { id: 'yusuf', name: 'يوسف', ayahCount: 111, order: 1 },
  { id: 'raad', name: 'الرعد', ayahCount: 43, order: 2 },
  { id: 'ibrahim', name: 'إبراهيم', ayahCount: 52, order: 3 },
];

const level4_stage4: QuranSurah[] = [
  { id: 'hud', name: 'هود', ayahCount: 123, order: 1 },
];

const level4_stage5: QuranSurah[] = [
  { id: 'yunus', name: 'يونس', ayahCount: 109, order: 1 },
];

// ============================================================
// المستوى الخامس - 4 مراحل
// ============================================================

const level5_stage1: QuranSurah[] = [
  { id: 'anfal', name: 'الأنفال', ayahCount: 75, order: 1 },
  { id: 'tawbah', name: 'التوبة', ayahCount: 129, order: 2 },
];

const level5_stage2: QuranSurah[] = [
  { id: 'araf', name: 'الأعراف', ayahCount: 206, order: 1 },
];

const level5_stage3: QuranSurah[] = [
  { id: 'anam', name: 'الأنعام', ayahCount: 165, order: 1 },
];

const level5_stage4: QuranSurah[] = [
  { id: 'maidah', name: 'المائدة', ayahCount: 120, order: 1 },
];

// ============================================================
// المستوى السادس - 3 مراحل
// ============================================================

const level6_stage1: QuranSurah[] = [
  { id: 'nisa', name: 'النساء', ayahCount: 176, order: 1 },
];

const level6_stage2: QuranSurah[] = [
  { id: 'imran', name: 'آل عمران', ayahCount: 200, order: 1 },
];

const level6_stage3: QuranSurah[] = [
  { id: 'baqarah', name: 'البقرة', ayahCount: 286, order: 1 },
];

// ============================================================
// تجميع المنهج الكامل
// ============================================================

export const quranCurriculum: QuranLevel[] = [
  {
    id: 'level1',
    name: 'المستوى الأول',
    levelNumber: 1,
    order: 1,
    stages: [
      { id: 'level1_stage1', name: 'المرحلة الأولى (الفاتحة وجزء عمّ)', order: 1, surahs: level1_stage1 },
      { id: 'level1_stage2', name: 'المرحلة الثانية (جزء تبارك)', order: 2, surahs: level1_stage2 },
      { id: 'level1_stage3', name: 'المرحلة الثالثة (جزء قد سمع)', order: 3, surahs: level1_stage3 },
      { id: 'level1_stage4', name: 'المرحلة الرابعة (الذاريات - الحديد)', order: 4, surahs: level1_stage4 },
      { id: 'level1_stage5', name: 'المرحلة الخامسة (الأحقاف - ق)', order: 5, surahs: level1_stage5 },
    ],
  },
  {
    id: 'level2',
    name: 'المستوى الثاني',
    levelNumber: 2,
    order: 2,
    stages: [
      { id: 'level2_stage1', name: 'المرحلة الأولى (الشورى - الجاثية)', order: 1, surahs: level2_stage1 },
      { id: 'level2_stage2', name: 'المرحلة الثانية (الزمر - فصلت)', order: 2, surahs: level2_stage2 },
      { id: 'level2_stage3', name: 'المرحلة الثالثة (يس - ص)', order: 3, surahs: level2_stage3 },
      { id: 'level2_stage4', name: 'المرحلة الرابعة (الأحزاب - فاطر)', order: 4, surahs: level2_stage4 },
      { id: 'level2_stage5', name: 'المرحلة الخامسة (العنكبوت - السجدة)', order: 5, surahs: level2_stage5 },
    ],
  },
  {
    id: 'level3',
    name: 'المستوى الثالث',
    levelNumber: 3,
    order: 3,
    stages: [
      { id: 'level3_stage1', name: 'المرحلة الأولى (النمل - القصص)', order: 1, surahs: level3_stage1 },
      { id: 'level3_stage2', name: 'المرحلة الثانية (الفرقان - الشعراء)', order: 2, surahs: level3_stage2 },
      { id: 'level3_stage3', name: 'المرحلة الثالثة (المؤمنون - النور)', order: 3, surahs: level3_stage3 },
      { id: 'level3_stage4', name: 'المرحلة الرابعة (الأنبياء - الحج)', order: 4, surahs: level3_stage4 },
      { id: 'level3_stage5', name: 'المرحلة الخامسة (مريم - طه)', order: 5, surahs: level3_stage5 },
    ],
  },
  {
    id: 'level4',
    name: 'المستوى الرابع',
    levelNumber: 4,
    order: 4,
    stages: [
      { id: 'level4_stage1', name: 'المرحلة الأولى (الإسراء - الكهف)', order: 1, surahs: level4_stage1 },
      { id: 'level4_stage2', name: 'المرحلة الثانية (الحجر - النحل)', order: 2, surahs: level4_stage2 },
      { id: 'level4_stage3', name: 'المرحلة الثالثة (يوسف - إبراهيم)', order: 3, surahs: level4_stage3 },
      { id: 'level4_stage4', name: 'المرحلة الرابعة (هود)', order: 4, surahs: level4_stage4 },
      { id: 'level4_stage5', name: 'المرحلة الخامسة (يونس)', order: 5, surahs: level4_stage5 },
    ],
  },
  {
    id: 'level5',
    name: 'المستوى الخامس',
    levelNumber: 5,
    order: 5,
    stages: [
      { id: 'level5_stage1', name: 'المرحلة الأولى (الأنفال - التوبة)', order: 1, surahs: level5_stage1 },
      { id: 'level5_stage2', name: 'المرحلة الثانية (الأعراف)', order: 2, surahs: level5_stage2 },
      { id: 'level5_stage3', name: 'المرحلة الثالثة (الأنعام)', order: 3, surahs: level5_stage3 },
      { id: 'level5_stage4', name: 'المرحلة الرابعة (المائدة)', order: 4, surahs: level5_stage4 },
    ],
  },
  {
    id: 'level6',
    name: 'المستوى السادس',
    levelNumber: 6,
    order: 6,
    stages: [
      { id: 'level6_stage1', name: 'المرحلة الأولى (النساء)', order: 1, surahs: level6_stage1 },
      { id: 'level6_stage2', name: 'المرحلة الثانية (آل عمران)', order: 2, surahs: level6_stage2 },
      { id: 'level6_stage3', name: 'المرحلة الثالثة (البقرة)', order: 3, surahs: level6_stage3 },
    ],
  },
];

// الحصول على جميع السور في مستوى معين
export const getAllSurahsInLevel = (level: QuranLevel): QuranSurah[] => {
  return level.stages.flatMap(stage => stage.surahs);
};

// الحصول على المستوى الافتراضي للطالب الجديد
export const getDefaultLevel = () => {
  return quranCurriculum[0]; // المستوى الأول
};

// الحصول على المرحلة الافتراضية
export const getDefaultStage = () => {
  return quranCurriculum[0].stages[0]; // المرحلة الأولى من المستوى الأول
};

// الحصول على المرحلة التالية (ضمن المستوى أو المستوى التالي)
export const getNextStage = (levelId: string, stageId: string): { stage: QuranStage | null; newLevel: QuranLevel | null } => {
  const levelIndex = quranCurriculum.findIndex(l => l.id === levelId);
  if (levelIndex === -1) return { stage: null, newLevel: null };
  
  const level = quranCurriculum[levelIndex];
  const stageIndex = level.stages.findIndex(s => s.id === stageId);
  
  if (stageIndex < level.stages.length - 1) {
    // المرحلة التالية في نفس المستوى
    return { stage: level.stages[stageIndex + 1], newLevel: null };
  }
  
  // آخر مرحلة في المستوى - سيحتاج موافقة المشرف للمستوى التالي
  return { stage: null, newLevel: levelIndex < quranCurriculum.length - 1 ? quranCurriculum[levelIndex + 1] : null };
};

// البحث عن سورة في المنهج
export const findSurahInCurriculum = (surahId: string): { level: QuranLevel; stage: QuranStage; surah: QuranSurah } | null => {
  for (const level of quranCurriculum) {
    for (const stage of level.stages) {
      const surah = stage.surahs.find(s => s.id === surahId);
      if (surah) return { level, stage, surah };
    }
  }
  return null;
};

export default quranCurriculum;
