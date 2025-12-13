// نظام المنهج الجديد - التحديات الثلاثة

export interface Challenge {
  id: string;
  type: 'memorization' | 'nearReview' | 'farReview'; // الحفظ | المراجعة القريبة | المراجعة البعيدة
  title: string;
  content: string; // السور أو المحتوى
  completed: boolean;
  rating?: number;
  notes?: string;
  completedAt?: string;
}

export interface Stage {
  id: number;
  stageNumber: number;
  memorization: string; // الحفظ - التحدي الأساسي
  nearReview: string; // المراجعة القريبة - التحدي الثاني
  farReview: string; // المراجعة البعيدة - التحدي الأخير
}

export interface CurriculumLevel {
  id: number;
  levelNumber: number; // 1-6
  name: string;
  stages: Stage[];
}

// حالة تقدم الطالب في التحديات
export interface StudentChallengeProgress {
  odC: string; // معرف السجل
  studentId: string;
  levelId: number;
  stageId: number;
  
  // حالة التحديات
  memorizationCompleted: boolean;
  memorizationRating?: number;
  memorizationNotes?: string;
  memorizationCompletedAt?: string;
  
  nearReviewCompleted: boolean;
  nearReviewRating?: number;
  nearReviewNotes?: string;
  nearReviewCompletedAt?: string;
  
  farReviewCompleted: boolean;
  farReviewRating?: number;
  farReviewNotes?: string;
  farReviewCompletedAt?: string;
  
  // هل اكتملت المرحلة؟
  stageCompleted: boolean;
  stageCompletedAt?: string;
}

// نظام النقاط الجديد
export const POINTS_SYSTEM = {
  MEMORIZATION_COMPLETE: 30, // إكمال تحدي الحفظ
  NEAR_REVIEW_COMPLETE: 20, // إكمال تحدي المراجعة القريبة
  FAR_REVIEW_COMPLETE: 20, // إكمال تحدي المراجعة البعيدة
  STAGE_COMPLETE_BONUS: 30, // مكافأة إكمال المرحلة كاملة
  LEVEL_COMPLETE_BONUS: 200, // مكافأة إكمال المستوى
  PERFECT_RATING_BONUS: 10, // مكافأة التقييم المثالي (10/10)
  RETRY_PENALTY: -5, // خصم عند الإعادة
};

// حساب النقاط لتحدي معين
export const calculateChallengePoints = (
  challengeType: 'memorization' | 'nearReview' | 'farReview',
  rating: number,
  isRetry: boolean = false
): number => {
  let points = 0;
  
  switch (challengeType) {
    case 'memorization':
      points = POINTS_SYSTEM.MEMORIZATION_COMPLETE;
      break;
    case 'nearReview':
      points = POINTS_SYSTEM.NEAR_REVIEW_COMPLETE;
      break;
    case 'farReview':
      points = POINTS_SYSTEM.FAR_REVIEW_COMPLETE;
      break;
  }
  
  // مكافأة التقييم المثالي
  if (rating === 10) {
    points += POINTS_SYSTEM.PERFECT_RATING_BONUS;
  }
  
  // خصم الإعادة
  if (isRetry) {
    points += POINTS_SYSTEM.RETRY_PENALTY;
  }
  
  return Math.max(0, points);
};
