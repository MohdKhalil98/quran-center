import React, { useState } from 'react';
import { quranCurriculum, QuranJuz, QuranSurah } from '../data/quranCurriculum';
import { arabicReadingCurriculum, ArabicLevel, ArabicLesson, ARABIC_READING_POINTS, getLevelTotalPoints as getArabicLevelPoints } from '../data/arabicReadingCurriculum';
import '../styles/Curriculum.css';

// نوع المساق المعروض
type TrackType = 'quran' | 'arabic_reading';

// Points configuration
const POINTS_SYSTEM = {
  MEMORIZATION: 30,
  NEAR_REVIEW: 20,
  FAR_REVIEW: 20,
  STAGE_COMPLETION: 30,
  LEVEL_COMPLETION: 200,
  PERFECT_RATING_BONUS: 10,
};

const Curriculum: React.FC = () => {
  const [activeTrack, setActiveTrack] = useState<TrackType>('quran');
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter levels based on search - Quran
  const filteredLevels = quranCurriculum.filter(level =>
    level.name.includes(searchTerm) ||
    level.surahs.some(surah => surah.name.includes(searchTerm))
  );

  // Filter levels based on search - Arabic Reading
  const filteredArabicLevels = arabicReadingCurriculum.filter(level =>
    level.name.includes(searchTerm) ||
    level.lessons.some(lesson => lesson.name.includes(searchTerm))
  );

  // Get near review content (previous surah)
  const getNearReviewContent = (level: QuranJuz, currentIndex: number): string => {
    if (currentIndex === 0) return 'لا يوجد';
    const prevSurah = level.surahs[currentIndex - 1];
    return `سورة ${prevSurah.name}`;
  };

  // Get far review content (2 surahs back)
  const getFarReviewContent = (level: QuranJuz, currentIndex: number): string => {
    if (currentIndex < 2) return 'لا يوجد';
    const farSurah = level.surahs[currentIndex - 2];
    return `سورة ${farSurah.name}`;
  };

  // Calculate total ayahs in a juz
  const getTotalAyahs = (level: QuranJuz): number => {
    return level.surahs.reduce((sum, surah) => sum + surah.ayahCount, 0);
  };

  // Calculate total points for a level
  const getLevelTotalPoints = (level: QuranJuz): number => {
    const stagesPoints = level.surahs.length * (POINTS_SYSTEM.MEMORIZATION + POINTS_SYSTEM.NEAR_REVIEW + POINTS_SYSTEM.FAR_REVIEW + POINTS_SYSTEM.STAGE_COMPLETION);
    return stagesPoints + POINTS_SYSTEM.LEVEL_COMPLETION;
  };

  // Toggle level expansion
  const toggleLevel = (levelId: string) => {
    setExpandedLevel(expandedLevel === levelId ? null : levelId);
    setExpandedStage(null);
  };

  // Toggle stage expansion
  const toggleStage = (stageId: string) => {
    setExpandedStage(expandedStage === stageId ? null : stageId);
  };

  // Switch track and reset state
  const switchTrack = (track: TrackType) => {
    setActiveTrack(track);
    setExpandedLevel(null);
    setExpandedStage(null);
    setSearchTerm('');
  };

  return (
    <div className="curriculum-container">
      {/* Header */}
      <div className="curriculum-header">
        <h1>📚 المنهج الدراسي</h1>
        <p className="curriculum-subtitle">اختر المساق لعرض تفاصيل المنهج</p>
      </div>

      {/* Track Selector */}
      <div className="track-selector">
        <button 
          className={`track-btn ${activeTrack === 'quran' ? 'active' : ''}`}
          onClick={() => switchTrack('quran')}
        >
          <span className="track-icon">📖</span>
          <span className="track-name">حفظ القرآن الكريم</span>
        </button>
        <button 
          className={`track-btn ${activeTrack === 'arabic_reading' ? 'active' : ''}`}
          onClick={() => switchTrack('arabic_reading')}
        >
          <span className="track-icon">📝</span>
          <span className="track-name">التأسيس على القراءة العربية</span>
        </button>
      </div>

      {/* Quran Track Content */}
      {activeTrack === 'quran' && (
        <>
          {/* Section 1: How the System Works */}
      <div className="info-section how-it-works">
        <div className="section-header">
          <span className="section-icon">💡</span>
          <h2>كيف يعمل النظام</h2>
        </div>
        <div className="how-it-works-content">
          <div className="step-card">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>📖 الحفظ</h4>
              <p>يحفظ الطالب السورة المطلوبة آية بآية حتى يكملها</p>
            </div>
          </div>
          <div className="step-arrow">→</div>
          <div className="step-card">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>🔄 المراجعة القريبة</h4>
              <p>مراجعة السورة السابقة التي تم حفظها</p>
            </div>
          </div>
          <div className="step-arrow">→</div>
          <div className="step-card">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4>📚 المراجعة البعيدة</h4>
              <p>مراجعة السورة التي قبل السابقة</p>
            </div>
          </div>
          <div className="step-arrow">→</div>
          <div className="step-card success">
            <div className="step-number">✓</div>
            <div className="step-content">
              <h4>🎯 الانتقال</h4>
              <p>بعد إتمام التحديات الثلاثة ينتقل للسورة التالية</p>
            </div>
          </div>
        </div>
        <div className="system-notes">
          <div className="note-item">
            <span className="note-icon">⭐</span>
            <span>يبدأ كل طالب جديد من سورة الفاتحة ثم سور جزء عم</span>
          </div>
          <div className="note-item">
            <span className="note-icon">🏅</span>
            <span>عند إتمام الجزء كاملاً، يحتاج موافقة المشرف للانتقال للجزء التالي</span>
          </div>
        </div>
      </div>

      {/* Section 2: Points System */}
      <div className="info-section points-system">
        <div className="section-header">
          <span className="section-icon">🏆</span>
          <h2>نظام النقاط</h2>
        </div>
        <div className="points-grid-new">
          <div className="point-card memorization">
            <span className="point-icon">📖</span>
            <span className="point-label">الحفظ</span>
            <span className="point-value">{POINTS_SYSTEM.MEMORIZATION} نقطة</span>
          </div>
          <div className="point-card near-review">
            <span className="point-icon">🔄</span>
            <span className="point-label">المراجعة القريبة</span>
            <span className="point-value">{POINTS_SYSTEM.NEAR_REVIEW} نقطة</span>
          </div>
          <div className="point-card far-review">
            <span className="point-icon">📚</span>
            <span className="point-label">المراجعة البعيدة</span>
            <span className="point-value">{POINTS_SYSTEM.FAR_REVIEW} نقطة</span>
          </div>
          <div className="point-card stage-completion">
            <span className="point-icon">✅</span>
            <span className="point-label">إتمام السورة</span>
            <span className="point-value">{POINTS_SYSTEM.STAGE_COMPLETION} نقطة</span>
          </div>
          <div className="point-card level-completion">
            <span className="point-icon">🎖️</span>
            <span className="point-label">إتمام الجزء</span>
            <span className="point-value">{POINTS_SYSTEM.LEVEL_COMPLETION} نقطة</span>
          </div>
          <div className="point-card bonus">
            <span className="point-icon">⭐</span>
            <span className="point-label">تقييم ممتاز (9+)</span>
            <span className="point-value">+{POINTS_SYSTEM.PERFECT_RATING_BONUS} نقطة</span>
          </div>
        </div>
      </div>

      {/* Section 3: Curriculum Structure */}
      <div className="info-section curriculum-structure">
        <div className="section-header">
          <span className="section-icon">📚</span>
          <h2>منهج حفظ القرآن الكريم</h2>
        </div>
        
        {/* Search */}
        <div className="curriculum-search">
          <input
            type="text"
            placeholder="🔍 ابحث عن جزء أو سورة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Curriculum Stats */}
        <div className="curriculum-stats">
          <div className="stat-item">
            <span className="stat-value">30</span>
            <span className="stat-label">جزء</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">114</span>
            <span className="stat-label">سورة</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">6236</span>
            <span className="stat-label">آية</span>
          </div>
        </div>

        {/* Hierarchical Curriculum View */}
        <div className="curriculum-tree">
          {filteredLevels.map((level) => (
            <div key={level.id} className="level-accordion">
              {/* Level Header */}
              <div 
                className={`level-header ${expandedLevel === level.id ? 'expanded' : ''}`}
                onClick={() => toggleLevel(level.id)}
              >
                <div className="level-header-right">
                  <span className={`expand-icon ${expandedLevel === level.id ? 'expanded' : ''}`}>
                    {expandedLevel === level.id ? '▼' : '◀'}
                  </span>
                  <span className="level-badge">{level.juzNumber}</span>
                  <span className="level-name">{level.name}</span>
                </div>
                <div className="level-header-left">
                  <span className="level-info-tag">
                    <span className="tag-icon">📖</span>
                    {level.surahs.length} سورة
                  </span>
                  <span className="level-info-tag">
                    <span className="tag-icon">📝</span>
                    {getTotalAyahs(level)} آية
                  </span>
                  <span className="level-info-tag points">
                    <span className="tag-icon">🏆</span>
                    {getLevelTotalPoints(level)} نقطة
                  </span>
                </div>
              </div>

              {/* Level Content - Stages */}
              {expandedLevel === level.id && (
                <div className="level-content">
                  {level.surahs.map((surah, index) => (
                    <div key={surah.id} className="stage-accordion">
                      {/* Stage Header */}
                      <div 
                        className={`stage-header ${expandedStage === surah.id ? 'expanded' : ''} ${surah.name === 'الفاتحة' ? 'fatiha' : ''}`}
                        onClick={() => toggleStage(surah.id)}
                      >
                        <div className="stage-header-right">
                          <span className={`expand-icon ${expandedStage === surah.id ? 'expanded' : ''}`}>
                            {expandedStage === surah.id ? '▼' : '◀'}
                          </span>
                          <span className="stage-order">{index + 1}</span>
                          {surah.name === 'الفاتحة' && <span className="fatiha-star">🌟</span>}
                          <span className="stage-name">سورة {surah.name}</span>
                        </div>
                        <div className="stage-header-left">
                          <span className="stage-info-tag">
                            {surah.ayahCount} آية
                          </span>
                        </div>
                      </div>

                      {/* Stage Content - Challenges */}
                      {expandedStage === surah.id && (
                        <div className="stage-content">
                          <div className="challenges-list">
                            {/* Memorization Challenge */}
                            <div className="challenge-item memorization">
                              <div className="challenge-icon-wrapper">
                                <span className="challenge-icon">📖</span>
                              </div>
                              <div className="challenge-details">
                                <span className="challenge-type">الحفظ</span>
                                <span className="challenge-content">سورة {surah.name} ({surah.ayahCount} آية)</span>
                              </div>
                              <div className="challenge-points">
                                <span>{POINTS_SYSTEM.MEMORIZATION} نقطة</span>
                              </div>
                            </div>

                            {/* Near Review Challenge */}
                            <div className={`challenge-item near-review ${getNearReviewContent(level, index) === 'لا يوجد' ? 'disabled' : ''}`}>
                              <div className="challenge-icon-wrapper">
                                <span className="challenge-icon">🔄</span>
                              </div>
                              <div className="challenge-details">
                                <span className="challenge-type">المراجعة القريبة</span>
                                <span className="challenge-content">{getNearReviewContent(level, index)}</span>
                              </div>
                              <div className="challenge-points">
                                {getNearReviewContent(level, index) !== 'لا يوجد' && (
                                  <span>{POINTS_SYSTEM.NEAR_REVIEW} نقطة</span>
                                )}
                              </div>
                            </div>

                            {/* Far Review Challenge */}
                            <div className={`challenge-item far-review ${getFarReviewContent(level, index) === 'لا يوجد' ? 'disabled' : ''}`}>
                              <div className="challenge-icon-wrapper">
                                <span className="challenge-icon">📚</span>
                              </div>
                              <div className="challenge-details">
                                <span className="challenge-type">المراجعة البعيدة</span>
                                <span className="challenge-content">{getFarReviewContent(level, index)}</span>
                              </div>
                              <div className="challenge-points">
                                {getFarReviewContent(level, index) !== 'لا يوجد' && (
                                  <span>{POINTS_SYSTEM.FAR_REVIEW} نقطة</span>
                                )}
                              </div>
                            </div>

                            {/* Stage Completion Bonus */}
                            <div className="challenge-item stage-bonus">
                              <div className="challenge-icon-wrapper">
                                <span className="challenge-icon">✅</span>
                              </div>
                              <div className="challenge-details">
                                <span className="challenge-type">مكافأة إتمام السورة</span>
                                <span className="challenge-content">عند إكمال جميع التحديات</span>
                              </div>
                              <div className="challenge-points">
                                <span>{POINTS_SYSTEM.STAGE_COMPLETION} نقطة</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Level Completion Bonus */}
                  <div className="level-bonus-card">
                    <span className="bonus-icon">🎖️</span>
                    <span className="bonus-text">مكافأة إتمام {level.name}</span>
                    <span className="bonus-points">{POINTS_SYSTEM.LEVEL_COMPLETION} نقطة</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
        </>
      )}

      {/* Arabic Reading Track Content */}
      {activeTrack === 'arabic_reading' && (
        <>
          {/* Section 1: How the Arabic Reading System Works */}
          <div className="info-section how-it-works">
            <div className="section-header">
              <span className="section-icon">💡</span>
              <h2>كيف يعمل النظام</h2>
            </div>
            <div className="how-it-works-content">
              <div className="step-card">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h4>📝 الدرس</h4>
                  <p>يتعلم الطالب الدرس المطلوب ويتقنه</p>
                </div>
              </div>
              <div className="step-arrow">→</div>
              <div className="step-card">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h4>✓ التقييم</h4>
                  <p>يقيّم المعلم أداء الطالب في الدرس</p>
                </div>
              </div>
              <div className="step-arrow">→</div>
              <div className="step-card">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h4>📈 الانتقال</h4>
                  <p>ينتقل للدرس التالي في نفس المستوى</p>
                </div>
              </div>
              <div className="step-arrow">→</div>
              <div className="step-card success">
                <div className="step-number">✓</div>
                <div className="step-content">
                  <h4>🎯 إتمام المستوى</h4>
                  <p>بعد إتمام جميع الدروس يحتاج موافقة المشرف</p>
                </div>
              </div>
            </div>
            <div className="system-notes">
              <div className="note-item">
                <span className="note-icon">⭐</span>
                <span>يبدأ كل طالب جديد من المستوى الأول - الدرس الأول</span>
              </div>
              <div className="note-item">
                <span className="note-icon">🏅</span>
                <span>عند إتمام المستوى كاملاً، يحتاج موافقة المشرف للانتقال للمستوى التالي</span>
              </div>
            </div>
          </div>

          {/* Section 2: Points System for Arabic Reading */}
          <div className="info-section points-system">
            <div className="section-header">
              <span className="section-icon">🏆</span>
              <h2>نظام النقاط</h2>
            </div>
            <div className="points-grid-new">
              <div className="point-card memorization">
                <span className="point-icon">📝</span>
                <span className="point-label">إتمام الدرس</span>
                <span className="point-value">{ARABIC_READING_POINTS.LESSON_COMPLETION} نقاط</span>
              </div>
              <div className="point-card bonus">
                <span className="point-icon">⭐</span>
                <span className="point-label">تقييم ممتاز</span>
                <span className="point-value">+{ARABIC_READING_POINTS.PERFECT_RATING} نقاط</span>
              </div>
              <div className="point-card level-completion">
                <span className="point-icon">🎖️</span>
                <span className="point-label">إتمام المستوى</span>
                <span className="point-value">{ARABIC_READING_POINTS.LEVEL_COMPLETION} نقطة</span>
              </div>
            </div>
          </div>

          {/* Section 3: Arabic Reading Curriculum Structure */}
          <div className="info-section curriculum-structure">
            <div className="section-header">
              <span className="section-icon">📚</span>
              <h2>منهج التأسيس على القراءة العربية</h2>
            </div>
            
            {/* Search */}
            <div className="curriculum-search">
              <input
                type="text"
                placeholder="🔍 ابحث عن مستوى أو درس..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            {/* Curriculum Stats */}
            <div className="curriculum-stats">
              <div className="stat-item">
                <span className="stat-value">6</span>
                <span className="stat-label">مستوى</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{arabicReadingCurriculum.reduce((sum, l) => sum + l.lessons.length, 0)}</span>
                <span className="stat-label">درس</span>
              </div>
            </div>

            {/* Hierarchical Curriculum View */}
            <div className="curriculum-tree">
              {filteredArabicLevels.map((level) => (
                <div key={level.id} className="level-accordion">
                  {/* Level Header */}
                  <div 
                    className={`level-header ${expandedLevel === level.id ? 'expanded' : ''}`}
                    onClick={() => toggleLevel(level.id)}
                  >
                    <div className="level-header-right">
                      <span className={`expand-icon ${expandedLevel === level.id ? 'expanded' : ''}`}>
                        {expandedLevel === level.id ? '▼' : '◀'}
                      </span>
                      <span className="level-badge">{level.levelNumber}</span>
                      <span className="level-name">{level.name}</span>
                    </div>
                    <div className="level-header-left">
                      <span className="level-info-tag">
                        <span className="tag-icon">📝</span>
                        {level.lessons.length} درس
                      </span>
                      <span className="level-info-tag points">
                        <span className="tag-icon">🏆</span>
                        {getArabicLevelPoints(level)} نقطة
                      </span>
                      {level.requiresSupervisorApproval && (
                        <span className="level-info-tag supervisor" title="يحتاج موافقة المشرف للانتقال">
                          <span className="tag-icon">👨‍💼</span>
                          موافقة المشرف
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Level Content - Lessons */}
                  {expandedLevel === level.id && (
                    <div className="level-content">
                      {level.lessons.map((lesson, index) => (
                        <div key={lesson.id} className="stage-accordion">
                          {/* Lesson Item */}
                          <div className="stage-header lesson-item">
                            <div className="stage-header-right">
                              <span className="stage-order">{lesson.order}</span>
                              <span className="stage-name">{lesson.name}</span>
                            </div>
                            <div className="stage-header-left">
                              <span className="stage-info-tag">
                                {ARABIC_READING_POINTS.LESSON_COMPLETION} نقاط
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Level Completion Bonus */}
                      <div className="level-bonus-card">
                        <span className="bonus-icon">🎖️</span>
                        <span className="bonus-text">مكافأة إتمام {level.name}</span>
                        <span className="bonus-points">{ARABIC_READING_POINTS.LEVEL_COMPLETION} نقطة</span>
                      </div>
                      
                      {/* Supervisor Approval Note */}
                      {level.requiresSupervisorApproval && (
                        <div className="supervisor-approval-note">
                          <span className="note-icon">⚠️</span>
                          <span>يحتاج الطالب موافقة المشرف للانتقال إلى المستوى التالي بعد إتمام جميع الدروس</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Curriculum;

