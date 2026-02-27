import React, { useState } from 'react';
import { quranCurriculum, QuranLevel, QuranStage, QuranSurah, getAllSurahsInLevel } from '../data/quranCurriculum';
import { arabicReadingCurriculum, ArabicLevel, ArabicLesson, ARABIC_READING_POINTS, getLevelTotalPoints as getArabicLevelPoints } from '../data/arabicReadingCurriculum';
import '../styles/Curriculum.css';

// نوع المساق المعروض
type TrackType = 'quran' | 'arabic_reading';

// Points configuration
const POINTS_SYSTEM = {
  MEMORIZATION: 30,
  NEAR_REVIEW: 20,
  FAR_REVIEW: 20,
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
    level.stages.some(stage =>
      stage.name.includes(searchTerm) ||
      stage.surahs.some(surah => surah.name.includes(searchTerm))
    )
  );

  // Filter levels based on search - Arabic Reading
  const filteredArabicLevels = arabicReadingCurriculum.filter(level =>
    level.name.includes(searchTerm) ||
    level.lessons.some(lesson => lesson.name.includes(searchTerm))
  );

  // Calculate total ayahs in a level
  const getTotalAyahs = (level: QuranLevel): number => {
    return getAllSurahsInLevel(level).reduce((sum, surah) => sum + surah.ayahCount, 0);
  };

  // Calculate total ayahs in a stage
  const getStageTotalAyahs = (stage: QuranStage): number => {
    return stage.surahs.reduce((sum, surah) => sum + surah.ayahCount, 0);
  };

  // Calculate total surahs in a level
  const getTotalSurahs = (level: QuranLevel): number => {
    return getAllSurahsInLevel(level).length;
  };

  // Calculate total points for a level
  const getLevelTotalPoints = (level: QuranLevel): number => {
    const totalSurahs = getTotalSurahs(level);
    const surahPoints = totalSurahs * (POINTS_SYSTEM.MEMORIZATION + POINTS_SYSTEM.NEAR_REVIEW + POINTS_SYSTEM.FAR_REVIEW);
    return surahPoints + POINTS_SYSTEM.LEVEL_COMPLETION;
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
              <p>بعد إتمام حفظ جميع آيات السورة ينتقل للسورة التالية</p>
            </div>
          </div>
        </div>
        <div className="system-notes">
          <div className="note-item">
            <span className="note-icon">⭐</span>
            <span>يبدأ كل طالب جديد من المرحلة الأولى في المستوى الأول</span>
          </div>
          <div className="note-item">
            <span className="note-icon">🔄</span>
            <span>بعد إتمام جميع سور المرحلة، ينتقل تلقائياً للمرحلة التالية</span>
          </div>
          <div className="note-item">
            <span className="note-icon">🏅</span>
            <span>عند إتمام المستوى كاملاً، يحتاج موافقة المشرف للانتقال للمستوى التالي</span>
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
          <div className="point-card level-completion">
            <span className="point-icon">🎖️</span>
            <span className="point-label">إتمام المستوى</span>
            <span className="point-value">{POINTS_SYSTEM.LEVEL_COMPLETION} نقطة</span>
          </div>
          <div className="point-card bonus">
            <span className="point-icon">⭐</span>
            <span className="point-label">تقييم ممتاز (10)</span>
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
            placeholder="🔍 ابحث عن مستوى أو مرحلة أو سورة..."
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
            <span className="stat-value">{quranCurriculum.reduce((sum, l) => sum + l.stages.length, 0)}</span>
            <span className="stat-label">مرحلة</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{quranCurriculum.reduce((sum, l) => sum + getAllSurahsInLevel(l).length, 0)}</span>
            <span className="stat-label">سورة</span>
          </div>
        </div>

        {/* Hierarchical Curriculum View - 3 tiers: Level → Stage → Surahs */}
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
                  <span className="level-badge">{level.levelNumber}</span>
                  <span className="level-name">{level.name}</span>
                </div>
                <div className="level-header-left">
                  <span className="level-info-tag">
                    <span className="tag-icon">📂</span>
                    {level.stages.length} مرحلة
                  </span>
                  <span className="level-info-tag">
                    <span className="tag-icon">📖</span>
                    {getTotalSurahs(level)} سورة
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
                  {level.stages.map((stage, stageIndex) => (
                    <div key={stage.id} className="stage-accordion">
                      {/* Stage Header */}
                      <div 
                        className={`stage-header ${expandedStage === stage.id ? 'expanded' : ''}`}
                        onClick={() => toggleStage(stage.id)}
                      >
                        <div className="stage-header-right">
                          <span className={`expand-icon ${expandedStage === stage.id ? 'expanded' : ''}`}>
                            {expandedStage === stage.id ? '▼' : '◀'}
                          </span>
                          <span className="stage-order">{stageIndex + 1}</span>
                          <span className="stage-name">{stage.name}</span>
                        </div>
                        <div className="stage-header-left">
                          <span className="stage-info-tag">
                            {stage.surahs.length} سورة
                          </span>
                          <span className="stage-info-tag">
                            {getStageTotalAyahs(stage)} آية
                          </span>
                        </div>
                      </div>

                      {/* Stage Content - Surahs */}
                      {expandedStage === stage.id && (
                        <div className="stage-content">
                          <div className="challenges-list">
                            {stage.surahs.map((surah) => (
                              <div key={surah.id} className="challenge-item memorization">
                                <div className="challenge-icon-wrapper">
                                  <span className="challenge-icon">📖</span>
                                </div>
                                <div className="challenge-details">
                                  <span className="challenge-type">سورة {surah.name}</span>
                                  <span className="challenge-content">{surah.ayahCount} آية</span>
                                </div>
                                <div className="challenge-points">
                                  <span>{POINTS_SYSTEM.MEMORIZATION} نقطة</span>
                                </div>
                              </div>
                            ))}
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

