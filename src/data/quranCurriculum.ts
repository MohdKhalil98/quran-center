// بيانات المنهج الجديد - أجزاء القرآن الكريم
// المستويات = الأجزاء (30 جزء) بترتيب عكسي
// المراحل = السور داخل كل جزء

export interface QuranSurah {
  id: string;
  name: string;
  ayahCount: number;
  order: number;
}

export interface QuranJuz {
  id: string;
  name: string;
  juzNumber: number;
  order: number; // الترتيب في النظام (عكسي)
  surahs: QuranSurah[];
}

// سور جزء عمّ (الجزء 30) مع الفاتحة في البداية
const juz30Surahs: QuranSurah[] = [
  { id: 'fatiha', name: 'سورة الفاتحة', ayahCount: 7, order: 1 },
  { id: 'nas', name: 'سورة الناس', ayahCount: 6, order: 2 },
  { id: 'falaq', name: 'سورة الفلق', ayahCount: 5, order: 3 },
  { id: 'ikhlas', name: 'سورة الإخلاص', ayahCount: 4, order: 4 },
  { id: 'masad', name: 'سورة المسد', ayahCount: 5, order: 5 },
  { id: 'nasr', name: 'سورة النصر', ayahCount: 3, order: 6 },
  { id: 'kafirun', name: 'سورة الكافرون', ayahCount: 6, order: 7 },
  { id: 'kawthar', name: 'سورة الكوثر', ayahCount: 3, order: 8 },
  { id: 'maun', name: 'سورة الماعون', ayahCount: 7, order: 9 },
  { id: 'quraysh', name: 'سورة قريش', ayahCount: 4, order: 10 },
  { id: 'fil', name: 'سورة الفيل', ayahCount: 5, order: 11 },
  { id: 'humazah', name: 'سورة الهمزة', ayahCount: 9, order: 12 },
  { id: 'asr', name: 'سورة العصر', ayahCount: 3, order: 13 },
  { id: 'takathur', name: 'سورة التكاثر', ayahCount: 8, order: 14 },
  { id: 'qariah', name: 'سورة القارعة', ayahCount: 11, order: 15 },
  { id: 'adiyat', name: 'سورة العاديات', ayahCount: 11, order: 16 },
  { id: 'zalzalah', name: 'سورة الزلزلة', ayahCount: 8, order: 17 },
  { id: 'bayyinah', name: 'سورة البينة', ayahCount: 8, order: 18 },
  { id: 'qadr', name: 'سورة القدر', ayahCount: 5, order: 19 },
  { id: 'alaq', name: 'سورة العلق', ayahCount: 19, order: 20 },
  { id: 'tin', name: 'سورة التين', ayahCount: 8, order: 21 },
  { id: 'sharh', name: 'سورة الشرح', ayahCount: 8, order: 22 },
  { id: 'duha', name: 'سورة الضحى', ayahCount: 11, order: 23 },
  { id: 'layl', name: 'سورة الليل', ayahCount: 21, order: 24 },
  { id: 'shams', name: 'سورة الشمس', ayahCount: 15, order: 25 },
  { id: 'balad', name: 'سورة البلد', ayahCount: 20, order: 26 },
  { id: 'fajr', name: 'سورة الفجر', ayahCount: 30, order: 27 },
  { id: 'ghashiyah', name: 'سورة الغاشية', ayahCount: 26, order: 28 },
  { id: 'ala', name: 'سورة الأعلى', ayahCount: 19, order: 29 },
  { id: 'tariq', name: 'سورة الطارق', ayahCount: 17, order: 30 },
  { id: 'buruj', name: 'سورة البروج', ayahCount: 22, order: 31 },
  { id: 'inshiqaq', name: 'سورة الانشقاق', ayahCount: 25, order: 32 },
  { id: 'mutaffifin', name: 'سورة المطففين', ayahCount: 36, order: 33 },
  { id: 'infitar', name: 'سورة الانفطار', ayahCount: 19, order: 34 },
  { id: 'takwir', name: 'سورة التكوير', ayahCount: 29, order: 35 },
  { id: 'abasa', name: 'سورة عبس', ayahCount: 42, order: 36 },
  { id: 'naziat', name: 'سورة النازعات', ayahCount: 46, order: 37 },
  { id: 'naba', name: 'سورة النبأ', ayahCount: 40, order: 38 },
];

// سور جزء تبارك (الجزء 29)
const juz29Surahs: QuranSurah[] = [
  { id: 'mursalat', name: 'سورة المرسلات', ayahCount: 50, order: 1 },
  { id: 'insan', name: 'سورة الإنسان', ayahCount: 31, order: 2 },
  { id: 'qiyamah', name: 'سورة القيامة', ayahCount: 40, order: 3 },
  { id: 'muddathir', name: 'سورة المدثر', ayahCount: 56, order: 4 },
  { id: 'muzzammil', name: 'سورة المزمل', ayahCount: 20, order: 5 },
  { id: 'jinn', name: 'سورة الجن', ayahCount: 28, order: 6 },
  { id: 'nuh', name: 'سورة نوح', ayahCount: 28, order: 7 },
  { id: 'maarij', name: 'سورة المعارج', ayahCount: 44, order: 8 },
  { id: 'haqqah', name: 'سورة الحاقة', ayahCount: 52, order: 9 },
  { id: 'qalam', name: 'سورة القلم', ayahCount: 52, order: 10 },
  { id: 'mulk', name: 'سورة الملك', ayahCount: 30, order: 11 },
];

// سور جزء قد سمع (الجزء 28)
const juz28Surahs: QuranSurah[] = [
  { id: 'tahrim', name: 'سورة التحريم', ayahCount: 12, order: 1 },
  { id: 'talaq', name: 'سورة الطلاق', ayahCount: 12, order: 2 },
  { id: 'taghabun', name: 'سورة التغابن', ayahCount: 18, order: 3 },
  { id: 'munafiqun', name: 'سورة المنافقون', ayahCount: 11, order: 4 },
  { id: 'jumuah', name: 'سورة الجمعة', ayahCount: 11, order: 5 },
  { id: 'saff', name: 'سورة الصف', ayahCount: 14, order: 6 },
  { id: 'mumtahanah', name: 'سورة الممتحنة', ayahCount: 13, order: 7 },
  { id: 'hashr', name: 'سورة الحشر', ayahCount: 24, order: 8 },
  { id: 'mujadilah', name: 'سورة المجادلة', ayahCount: 22, order: 9 },
];

// سور جزء الذاريات (الجزء 27)
const juz27Surahs: QuranSurah[] = [
  { id: 'hadid', name: 'سورة الحديد', ayahCount: 29, order: 1 },
  { id: 'waqiah', name: 'سورة الواقعة', ayahCount: 96, order: 2 },
  { id: 'rahman', name: 'سورة الرحمن', ayahCount: 78, order: 3 },
  { id: 'qamar', name: 'سورة القمر', ayahCount: 55, order: 4 },
  { id: 'najm', name: 'سورة النجم', ayahCount: 62, order: 5 },
  { id: 'tur', name: 'سورة الطور', ayahCount: 49, order: 6 },
  { id: 'dhariyat', name: 'سورة الذاريات', ayahCount: 60, order: 7 },
];

// سور جزء الأحقاف (الجزء 26)
const juz26Surahs: QuranSurah[] = [
  { id: 'qaf', name: 'سورة ق', ayahCount: 45, order: 1 },
  { id: 'hujurat', name: 'سورة الحجرات', ayahCount: 18, order: 2 },
  { id: 'fath', name: 'سورة الفتح', ayahCount: 29, order: 3 },
  { id: 'muhammad', name: 'سورة محمد', ayahCount: 38, order: 4 },
  { id: 'ahqaf', name: 'سورة الأحقاف', ayahCount: 35, order: 5 },
];

// سور جزء فصلت (الجزء 25)
const juz25Surahs: QuranSurah[] = [
  { id: 'jathiyah', name: 'سورة الجاثية', ayahCount: 37, order: 1 },
  { id: 'dukhan', name: 'سورة الدخان', ayahCount: 59, order: 2 },
  { id: 'zukhruf', name: 'سورة الزخرف', ayahCount: 89, order: 3 },
  { id: 'shura', name: 'سورة الشورى', ayahCount: 53, order: 4 },
  { id: 'fussilat', name: 'سورة فصلت', ayahCount: 54, order: 5 },
];

// سور جزء لا يحب (الجزء 24)
const juz24Surahs: QuranSurah[] = [
  { id: 'ghafir', name: 'سورة غافر', ayahCount: 85, order: 1 },
  { id: 'zumar', name: 'سورة الزمر', ayahCount: 75, order: 2 },
];

// سور جزء وما لي (الجزء 23)
const juz23Surahs: QuranSurah[] = [
  { id: 'sad', name: 'سورة ص', ayahCount: 88, order: 1 },
  { id: 'saffat', name: 'سورة الصافات', ayahCount: 182, order: 2 },
  { id: 'yasin', name: 'سورة يس', ayahCount: 83, order: 3 },
];

// سور جزء ومن يقنت (الجزء 22)
const juz22Surahs: QuranSurah[] = [
  { id: 'fatir', name: 'سورة فاطر', ayahCount: 45, order: 1 },
  { id: 'saba', name: 'سورة سبأ', ayahCount: 54, order: 2 },
  { id: 'ahzab', name: 'سورة الأحزاب', ayahCount: 73, order: 3 },
];

// سور جزء اتل (الجزء 21)
const juz21Surahs: QuranSurah[] = [
  { id: 'sajdah', name: 'سورة السجدة', ayahCount: 30, order: 1 },
  { id: 'luqman', name: 'سورة لقمان', ayahCount: 34, order: 2 },
  { id: 'rum', name: 'سورة الروم', ayahCount: 60, order: 3 },
  { id: 'ankabut', name: 'سورة العنكبوت', ayahCount: 69, order: 4 },
];

// سور جزء أمن خلق (الجزء 20)
const juz20Surahs: QuranSurah[] = [
  { id: 'qasas', name: 'سورة القصص', ayahCount: 88, order: 1 },
  { id: 'naml', name: 'سورة النمل', ayahCount: 93, order: 2 },
];

// سور جزء قال ألم (الجزء 19)
const juz19Surahs: QuranSurah[] = [
  { id: 'shuara', name: 'سورة الشعراء', ayahCount: 227, order: 1 },
  { id: 'furqan', name: 'سورة الفرقان', ayahCount: 77, order: 2 },
];

// سور جزء قد أفلح (الجزء 18)
const juz18Surahs: QuranSurah[] = [
  { id: 'nur', name: 'سورة النور', ayahCount: 64, order: 1 },
  { id: 'muminun', name: 'سورة المؤمنون', ayahCount: 118, order: 2 },
];

// سور جزء اقترب (الجزء 17)
const juz17Surahs: QuranSurah[] = [
  { id: 'hajj', name: 'سورة الحج', ayahCount: 78, order: 1 },
  { id: 'anbiya', name: 'سورة الأنبياء', ayahCount: 112, order: 2 },
];

// سور جزء قال ألم (الجزء 16)
const juz16Surahs: QuranSurah[] = [
  { id: 'taha', name: 'سورة طه', ayahCount: 135, order: 1 },
  { id: 'maryam', name: 'سورة مريم', ayahCount: 98, order: 2 },
  { id: 'kahf', name: 'سورة الكهف', ayahCount: 110, order: 3 },
];

// سور جزء سبحان (الجزء 15)
const juz15Surahs: QuranSurah[] = [
  { id: 'isra', name: 'سورة الإسراء', ayahCount: 111, order: 1 },
  { id: 'nahl', name: 'سورة النحل', ayahCount: 128, order: 2 },
];

// سور جزء الحجر (الجزء 14)
const juz14Surahs: QuranSurah[] = [
  { id: 'hijr', name: 'سورة الحجر', ayahCount: 99, order: 1 },
  { id: 'ibrahim', name: 'سورة إبراهيم', ayahCount: 52, order: 2 },
  { id: 'raad', name: 'سورة الرعد', ayahCount: 43, order: 3 },
];

// سور جزء وما أبرئ (الجزء 13)
const juz13Surahs: QuranSurah[] = [
  { id: 'yusuf', name: 'سورة يوسف', ayahCount: 111, order: 1 },
  { id: 'hud', name: 'سورة هود', ayahCount: 123, order: 2 },
];

// سور جزء ومامن دابة (الجزء 12)
const juz12Surahs: QuranSurah[] = [
  { id: 'yunus', name: 'سورة يونس', ayahCount: 109, order: 1 },
  { id: 'tawbah2', name: 'سورة التوبة (تتمة)', ayahCount: 129, order: 2 },
];

// سور جزء يعتذرون (الجزء 11)
const juz11Surahs: QuranSurah[] = [
  { id: 'tawbah', name: 'سورة التوبة', ayahCount: 129, order: 1 },
  { id: 'anfal2', name: 'سورة الأنفال (تتمة)', ayahCount: 75, order: 2 },
];

// سور جزء واعلموا (الجزء 10)
const juz10Surahs: QuranSurah[] = [
  { id: 'anfal', name: 'سورة الأنفال', ayahCount: 75, order: 1 },
  { id: 'araf2', name: 'سورة الأعراف (تتمة)', ayahCount: 206, order: 2 },
];

// سور جزء قال الملأ (الجزء 9)
const juz9Surahs: QuranSurah[] = [
  { id: 'araf', name: 'سورة الأعراف', ayahCount: 206, order: 1 },
  { id: 'anam2', name: 'سورة الأنعام (تتمة)', ayahCount: 165, order: 2 },
];

// سور جزء ولو أننا (الجزء 8)
const juz8Surahs: QuranSurah[] = [
  { id: 'anam', name: 'سورة الأنعام', ayahCount: 165, order: 1 },
  { id: 'maidah2', name: 'سورة المائدة (تتمة)', ayahCount: 120, order: 2 },
];

// سور جزء لتجدن (الجزء 7)
const juz7Surahs: QuranSurah[] = [
  { id: 'maidah', name: 'سورة المائدة', ayahCount: 120, order: 1 },
  { id: 'nisa2', name: 'سورة النساء (تتمة)', ayahCount: 176, order: 2 },
];

// سور جزء لا يحب الله (الجزء 6)
const juz6Surahs: QuranSurah[] = [
  { id: 'nisa', name: 'سورة النساء', ayahCount: 176, order: 1 },
];

// سور جزء والمحصنات (الجزء 5)
const juz5Surahs: QuranSurah[] = [
  { id: 'nisa3', name: 'سورة النساء (تتمة)', ayahCount: 176, order: 1 },
  { id: 'imran2', name: 'سورة آل عمران (تتمة)', ayahCount: 200, order: 2 },
];

// سور جزء لن تنالوا (الجزء 4)
const juz4Surahs: QuranSurah[] = [
  { id: 'imran', name: 'سورة آل عمران', ayahCount: 200, order: 1 },
  { id: 'baqarah3', name: 'سورة البقرة (تتمة)', ayahCount: 286, order: 2 },
];

// سور جزء تلك الرسل (الجزء 3)
const juz3Surahs: QuranSurah[] = [
  { id: 'baqarah2', name: 'سورة البقرة (تتمة)', ayahCount: 286, order: 1 },
];

// سور جزء سيقول (الجزء 2)
const juz2Surahs: QuranSurah[] = [
  { id: 'baqarah', name: 'سورة البقرة (تتمة)', ayahCount: 286, order: 1 },
];

// سور جزء الفاتحة (الجزء 1)
const juz1Surahs: QuranSurah[] = [
  { id: 'baqarah1', name: 'سورة البقرة', ayahCount: 286, order: 1 },
];

// المنهج الكامل - 30 مستوى بترتيب عكسي
export const quranCurriculum: QuranJuz[] = [
  { id: 'juz30', name: 'الجزء الثلاثون (جزء عمّ)', juzNumber: 30, order: 1, surahs: juz30Surahs },
  { id: 'juz29', name: 'الجزء التاسع والعشرون (جزء تبارك)', juzNumber: 29, order: 2, surahs: juz29Surahs },
  { id: 'juz28', name: 'الجزء الثامن والعشرون (قد سمع)', juzNumber: 28, order: 3, surahs: juz28Surahs },
  { id: 'juz27', name: 'الجزء السابع والعشرون (الذاريات)', juzNumber: 27, order: 4, surahs: juz27Surahs },
  { id: 'juz26', name: 'الجزء السادس والعشرون (الأحقاف)', juzNumber: 26, order: 5, surahs: juz26Surahs },
  { id: 'juz25', name: 'الجزء الخامس والعشرون (فصلت)', juzNumber: 25, order: 6, surahs: juz25Surahs },
  { id: 'juz24', name: 'الجزء الرابع والعشرون (لا يحب)', juzNumber: 24, order: 7, surahs: juz24Surahs },
  { id: 'juz23', name: 'الجزء الثالث والعشرون (وما لي)', juzNumber: 23, order: 8, surahs: juz23Surahs },
  { id: 'juz22', name: 'الجزء الثاني والعشرون (ومن يقنت)', juzNumber: 22, order: 9, surahs: juz22Surahs },
  { id: 'juz21', name: 'الجزء الحادي والعشرون (اتل)', juzNumber: 21, order: 10, surahs: juz21Surahs },
  { id: 'juz20', name: 'الجزء العشرون (أمن خلق)', juzNumber: 20, order: 11, surahs: juz20Surahs },
  { id: 'juz19', name: 'الجزء التاسع عشر (قال ألم)', juzNumber: 19, order: 12, surahs: juz19Surahs },
  { id: 'juz18', name: 'الجزء الثامن عشر (قد أفلح)', juzNumber: 18, order: 13, surahs: juz18Surahs },
  { id: 'juz17', name: 'الجزء السابع عشر (اقترب)', juzNumber: 17, order: 14, surahs: juz17Surahs },
  { id: 'juz16', name: 'الجزء السادس عشر (قال ألم)', juzNumber: 16, order: 15, surahs: juz16Surahs },
  { id: 'juz15', name: 'الجزء الخامس عشر (سبحان)', juzNumber: 15, order: 16, surahs: juz15Surahs },
  { id: 'juz14', name: 'الجزء الرابع عشر (الحجر)', juzNumber: 14, order: 17, surahs: juz14Surahs },
  { id: 'juz13', name: 'الجزء الثالث عشر (وما أبرئ)', juzNumber: 13, order: 18, surahs: juz13Surahs },
  { id: 'juz12', name: 'الجزء الثاني عشر (ومامن دابة)', juzNumber: 12, order: 19, surahs: juz12Surahs },
  { id: 'juz11', name: 'الجزء الحادي عشر (يعتذرون)', juzNumber: 11, order: 20, surahs: juz11Surahs },
  { id: 'juz10', name: 'الجزء العاشر (واعلموا)', juzNumber: 10, order: 21, surahs: juz10Surahs },
  { id: 'juz9', name: 'الجزء التاسع (قال الملأ)', juzNumber: 9, order: 22, surahs: juz9Surahs },
  { id: 'juz8', name: 'الجزء الثامن (ولو أننا)', juzNumber: 8, order: 23, surahs: juz8Surahs },
  { id: 'juz7', name: 'الجزء السابع (لتجدن)', juzNumber: 7, order: 24, surahs: juz7Surahs },
  { id: 'juz6', name: 'الجزء السادس (لا يحب الله)', juzNumber: 6, order: 25, surahs: juz6Surahs },
  { id: 'juz5', name: 'الجزء الخامس (والمحصنات)', juzNumber: 5, order: 26, surahs: juz5Surahs },
  { id: 'juz4', name: 'الجزء الرابع (لن تنالوا)', juzNumber: 4, order: 27, surahs: juz4Surahs },
  { id: 'juz3', name: 'الجزء الثالث (تلك الرسل)', juzNumber: 3, order: 28, surahs: juz3Surahs },
  { id: 'juz2', name: 'الجزء الثاني (سيقول)', juzNumber: 2, order: 29, surahs: juz2Surahs },
  { id: 'juz1', name: 'الجزء الأول', juzNumber: 1, order: 30, surahs: juz1Surahs },
];

// الحصول على المستوى الافتراضي للطالب الجديد (الجزء 30)
export const getDefaultLevel = () => {
  return quranCurriculum[0]; // الجزء 30 (الأول في الترتيب)
};

// الحصول على المرحلة الافتراضية (الفاتحة)
export const getDefaultStage = () => {
  return quranCurriculum[0].surahs[0]; // سورة الفاتحة
};

export default quranCurriculum;
