export interface Surah {
  id: number;
  name: string;
  verses: number;
}

export interface Part {
  id: number;
  name: string;
  pages: number;
  stage: string; // e.g., "المرحلة الأولى"
  surahs: Surah[];
}

export interface Level {
  id: number;
  name: string;
  description: string;
  parts: Part[];
}

export const curriculum: Level[] = [
  {
    id: 1,
    name: 'المستوى الأول',
    description: 'البداية: الأجزاء (1-6)',
    parts: [
      {
        id: 1,
        name: 'الجزء الأول',
        pages: 20,
        stage: 'المرحلة 1',
        surahs: [
          { id: 1, name: 'الفاتحة', verses: 7 },
          { id: 2, name: 'البقرة (بداية)', verses: 141 }
        ]
      },
      {
        id: 2,
        name: 'الجزء الثاني',
        pages: 20,
        stage: 'المرحلة 2',
        surahs: [
          { id: 2, name: 'البقرة (تكملة)', verses: 111 } // 142-252
        ]
      },
      {
        id: 3,
        name: 'الجزء الثالث',
        pages: 20,
        stage: 'المرحلة 3',
        surahs: [
          { id: 2, name: 'البقرة (نهاية)', verses: 34 }, // 253-286
          { id: 3, name: 'آل عمران (بداية)', verses: 92 }
        ]
      },
      {
        id: 4,
        name: 'الجزء الرابع',
        pages: 20,
        stage: 'المرحلة 4',
        surahs: [
          { id: 3, name: 'آل عمران (تكملة)', verses: 108 }, // 93-200
          { id: 4, name: 'النساء (بداية)', verses: 23 }
        ]
      },
      {
        id: 5,
        name: 'الجزء الخامس',
        pages: 20,
        stage: 'المرحلة 5',
        surahs: [
          { id: 4, name: 'النساء (تكملة)', verses: 124 } // 24-147
        ]
      },
      {
        id: 6,
        name: 'الجزء السادس',
        pages: 20,
        stage: 'المرحلة 6',
        surahs: [
          { id: 4, name: 'النساء (نهاية)', verses: 29 }, // 148-176
          { id: 5, name: 'المائدة (بداية)', verses: 81 }
        ]
      }
    ]
  },
  {
    id: 2,
    name: 'المستوى الثاني',
    description: 'التقدم: الأجزاء (7-12)',
    parts: [
      { id: 7, name: 'الجزء السابع', pages: 20, stage: 'المرحلة 1', surahs: [{ id: 5, name: 'المائدة (تكملة)', verses: 39 }, { id: 6, name: 'الأنعام (بداية)', verses: 110 }] },
      { id: 8, name: 'الجزء الثامن', pages: 20, stage: 'المرحلة 2', surahs: [{ id: 6, name: 'الأنعام (تكملة)', verses: 55 }, { id: 7, name: 'الأعراف (بداية)', verses: 87 }] },
      { id: 9, name: 'الجزء التاسع', pages: 20, stage: 'المرحلة 3', surahs: [{ id: 7, name: 'الأعراف (تكملة)', verses: 119 }, { id: 8, name: 'الأنفال (بداية)', verses: 40 }] },
      { id: 10, name: 'الجزء العاشر', pages: 20, stage: 'المرحلة 4', surahs: [{ id: 8, name: 'الأنفال (تكملة)', verses: 35 }, { id: 9, name: 'التوبة (بداية)', verses: 92 }] },
      { id: 11, name: 'الجزء الحادي عشر', pages: 20, stage: 'المرحلة 5', surahs: [{ id: 9, name: 'التوبة (تكملة)', verses: 37 }, { id: 10, name: 'يونس', verses: 109 }, { id: 11, name: 'هود (بداية)', verses: 5 }] },
      { id: 12, name: 'الجزء الثاني عشر', pages: 20, stage: 'المرحلة 6', surahs: [{ id: 11, name: 'هود (تكملة)', verses: 118 }, { id: 12, name: 'يوسف (بداية)', verses: 52 }] }
    ]
  },
  {
    id: 3,
    name: 'المستوى الثالث',
    description: 'المتوسط: الأجزاء (13-18)',
    parts: [
      { id: 13, name: 'الجزء الثالث عشر', pages: 20, stage: 'المرحلة 1', surahs: [{ id: 12, name: 'يوسف (تكملة)', verses: 59 }, { id: 13, name: 'الرعد', verses: 43 }, { id: 14, name: 'إبراهيم', verses: 52 }, { id: 15, name: 'الحجر (بداية)', verses: 1 }] },
      { id: 14, name: 'الجزء الرابع عشر', pages: 20, stage: 'المرحلة 2', surahs: [{ id: 15, name: 'الحجر (تكملة)', verses: 98 }, { id: 16, name: 'النحل', verses: 128 }] },
      { id: 15, name: 'الجزء الخامس عشر', pages: 20, stage: 'المرحلة 3', surahs: [{ id: 17, name: 'الإسراء', verses: 111 }, { id: 18, name: 'الكهف (بداية)', verses: 74 }] },
      { id: 16, name: 'الجزء السادس عشر', pages: 20, stage: 'المرحلة 4', surahs: [{ id: 18, name: 'الكهف (تكملة)', verses: 36 }, { id: 19, name: 'مريم', verses: 98 }, { id: 20, name: 'طه', verses: 135 }] },
      { id: 17, name: 'الجزء السابع عشر', pages: 20, stage: 'المرحلة 5', surahs: [{ id: 21, name: 'الأنبياء', verses: 112 }, { id: 22, name: 'الحج', verses: 78 }] },
      { id: 18, name: 'الجزء الثامن عشر', pages: 20, stage: 'المرحلة 6', surahs: [{ id: 23, name: 'المؤمنون', verses: 118 }, { id: 24, name: 'النور', verses: 64 }, { id: 25, name: 'الفرقان (بداية)', verses: 20 }] }
    ]
  },
  {
    id: 4,
    name: 'المستوى الرابع',
    description: 'المتقدم: الأجزاء (19-24)',
    parts: [
      { id: 19, name: 'الجزء التاسع عشر', pages: 20, stage: 'المرحلة 1', surahs: [{ id: 25, name: 'الفرقان (تكملة)', verses: 57 }, { id: 26, name: 'الشعراء', verses: 227 }, { id: 27, name: 'النمل (بداية)', verses: 55 }] },
      { id: 20, name: 'الجزء العشرون', pages: 20, stage: 'المرحلة 2', surahs: [{ id: 27, name: 'النمل (تكملة)', verses: 38 }, { id: 28, name: 'القصص', verses: 88 }, { id: 29, name: 'العنكبوت (بداية)', verses: 45 }] },
      { id: 21, name: 'الجزء الحادي والعشرون', pages: 20, stage: 'المرحلة 3', surahs: [{ id: 29, name: 'العنكبوت (تكملة)', verses: 24 }, { id: 30, name: 'الروم', verses: 60 }, { id: 31, name: 'لقمان', verses: 34 }, { id: 32, name: 'السجدة', verses: 30 }, { id: 33, name: 'الأحزاب (بداية)', verses: 30 }] },
      { id: 22, name: 'الجزء الثاني والعشرون', pages: 20, stage: 'المرحلة 4', surahs: [{ id: 33, name: 'الأحزاب (تكملة)', verses: 43 }, { id: 34, name: 'سبأ', verses: 54 }, { id: 35, name: 'فاطر', verses: 45 }, { id: 36, name: 'يس (بداية)', verses: 27 }] },
      { id: 23, name: 'الجزء الثالث والعشرون', pages: 20, stage: 'المرحلة 5', surahs: [{ id: 36, name: 'يس (تكملة)', verses: 56 }, { id: 37, name: 'الصافات', verses: 182 }, { id: 38, name: 'ص', verses: 88 }, { id: 39, name: 'الزمر (بداية)', verses: 31 }] },
      { id: 24, name: 'الجزء الرابع والعشرون', pages: 20, stage: 'المرحلة 6', surahs: [{ id: 39, name: 'الزمر (تكملة)', verses: 44 }, { id: 40, name: 'غافر', verses: 85 }, { id: 41, name: 'فصلت (بداية)', verses: 46 }] }
    ]
  },
  {
    id: 5,
    name: 'المستوى الخامس',
    description: 'الخاتمة: الأجزاء (25-30)',
    parts: [
      {
        id: 25,
        name: 'الجزء الخامس والعشرون',
        pages: 20,
        stage: 'المرحلة 1',
        surahs: [
          { id: 41, name: 'فصلت (تكملة)', verses: 8 },
          { id: 42, name: 'الشورى', verses: 53 },
          { id: 43, name: 'الزخرف', verses: 89 },
          { id: 44, name: 'الدخان', verses: 59 },
          { id: 45, name: 'الجاثية', verses: 37 }
        ]
      },
      {
        id: 26,
        name: 'الجزء السادس والعشرون',
        pages: 20,
        stage: 'المرحلة 2',
        surahs: [
          { id: 46, name: 'الأحقاف', verses: 35 },
          { id: 47, name: 'محمد', verses: 38 },
          { id: 48, name: 'الفتح', verses: 29 },
          { id: 49, name: 'الحجرات', verses: 18 },
          { id: 50, name: 'ق', verses: 45 },
          { id: 51, name: 'الذاريات (بداية)', verses: 30 }
        ]
      },
      {
        id: 27,
        name: 'الجزء السابع والعشرون',
        pages: 20,
        stage: 'المرحلة 3',
        surahs: [
          { id: 51, name: 'الذاريات (تكملة)', verses: 30 },
          { id: 52, name: 'الطور', verses: 49 },
          { id: 53, name: 'النجم', verses: 62 },
          { id: 54, name: 'القمر', verses: 55 },
          { id: 55, name: 'الرحمن', verses: 78 },
          { id: 56, name: 'الواقعة', verses: 96 },
          { id: 57, name: 'الحديد', verses: 29 }
        ]
      },
      {
        id: 28,
        name: 'الجزء الثامن والعشرون',
        pages: 20,
        stage: 'المرحلة 4',
        surahs: [
          { id: 58, name: 'المجادلة', verses: 22 },
          { id: 59, name: 'الحشر', verses: 24 },
          { id: 60, name: 'الممتحنة', verses: 13 },
          { id: 61, name: 'الصف', verses: 14 },
          { id: 62, name: 'الجمعة', verses: 11 },
          { id: 63, name: 'المنافقون', verses: 11 },
          { id: 64, name: 'التغابن', verses: 18 },
          { id: 65, name: 'الطلاق', verses: 12 },
          { id: 66, name: 'التحريم', verses: 12 }
        ]
      },
      {
        id: 29,
        name: 'الجزء التاسع والعشرون',
        pages: 20,
        stage: 'المرحلة 5',
        surahs: [
          { id: 67, name: 'الملك', verses: 30 },
          { id: 68, name: 'القلم', verses: 52 },
          { id: 69, name: 'الحاقة', verses: 52 },
          { id: 70, name: 'المعارج', verses: 44 },
          { id: 71, name: 'نوح', verses: 28 },
          { id: 72, name: 'الجن', verses: 28 },
          { id: 73, name: 'المزمل', verses: 20 },
          { id: 74, name: 'المدثر', verses: 56 },
          { id: 75, name: 'القيامة', verses: 40 },
          { id: 76, name: 'الإنسان', verses: 31 },
          { id: 77, name: 'المرسلات', verses: 50 }
        ]
      },
      {
        id: 30,
        name: 'الجزء الثلاثون',
        pages: 20,
        stage: 'المرحلة 6',
        surahs: [
          { id: 78, name: 'النبأ', verses: 40 },
          { id: 79, name: 'النازعات', verses: 46 },
          { id: 80, name: 'عبس', verses: 42 },
          { id: 81, name: 'التكوير', verses: 29 },
          { id: 82, name: 'الانفطار', verses: 19 },
          { id: 83, name: 'المطففين', verses: 36 },
          { id: 84, name: 'الانشقاق', verses: 25 },
          { id: 85, name: 'البروج', verses: 22 },
          { id: 86, name: 'الطارق', verses: 17 },
          { id: 87, name: 'الأعلى', verses: 19 },
          { id: 88, name: 'الغاشية', verses: 26 },
          { id: 89, name: 'الفجر', verses: 30 },
          { id: 90, name: 'البلد', verses: 20 },
          { id: 91, name: 'الشمس', verses: 15 },
          { id: 92, name: 'الليل', verses: 21 },
          { id: 93, name: 'الضحى', verses: 11 },
          { id: 94, name: 'الشرح', verses: 8 },
          { id: 95, name: 'التين', verses: 8 },
          { id: 96, name: 'العلق', verses: 19 },
          { id: 97, name: 'القدر', verses: 5 },
          { id: 98, name: 'البينة', verses: 8 },
          { id: 99, name: 'الزلزلة', verses: 8 },
          { id: 100, name: 'العاديات', verses: 11 },
          { id: 101, name: 'القارعة', verses: 11 },
          { id: 102, name: 'التكاثر', verses: 8 },
          { id: 103, name: 'العصر', verses: 3 },
          { id: 104, name: 'الهمزة', verses: 9 },
          { id: 105, name: 'الفيل', verses: 5 },
          { id: 106, name: 'قريش', verses: 4 },
          { id: 107, name: 'الماعون', verses: 7 },
          { id: 108, name: 'الكوثر', verses: 3 },
          { id: 109, name: 'الكافرون', verses: 6 },
          { id: 110, name: 'النصر', verses: 3 },
          { id: 111, name: 'المسد', verses: 5 },
          { id: 112, name: 'الإخلاص', verses: 4 },
          { id: 113, name: 'الفلق', verses: 5 },
          { id: 114, name: 'الناس', verses: 6 }
        ]
      }
    ]
  }
];

export default curriculum;
