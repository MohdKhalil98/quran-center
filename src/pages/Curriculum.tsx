import React, { useState } from 'react';
import { quranCurriculum, QuranJuz, QuranSurah } from '../data/quranCurriculum';
import '../styles/Curriculum.css';

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
  const [selectedLevel, setSelectedLevel] = useState<QuranJuz | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter levels based on search
  const filteredLevels = quranCurriculum.filter(level =>
    level.name.includes(searchTerm) ||
    level.surahs.some(surah => surah.name.includes(searchTerm))
  );

  // Get memorization content for a stage (current surah)
  const getMemorizationContent = (surah: QuranSurah): string => {
    return `سورة ${surah.name} (${surah.ayahCount} آية)`;
  };

  // Get near review content (previous surah in the same level)
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

  return (
    <div className="curriculum-container">
      <div className="curriculum-header">
        <h1>📚 منهج حفظ القرآن الكريم</h1>
        <p className="curriculum-subtitle">30 جزءاً - من جزء عم إلى جزء ألم</p>
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

      {/* Points System Info */}
      <div className="points-info-card">
        <h3>🏆 نظام النقاط</h3>
        <div className="points-grid">
          <div className="point-item">
            <span className="point-label">الحفظ</span>
            <span className="point-value">{POINTS_SYSTEM.MEMORIZATION} نقطة</span>
          </div>
          <div className="point-item">
            <span className="point-label">المراجعة القريبة</span>
            <span className="point-value">{POINTS_SYSTEM.NEAR_REVIEW} نقطة</span>
          </div>
          <div className="point-item">
            <span className="point-label">المراجعة البعيدة</span>
            <span className="point-value">{POINTS_SYSTEM.FAR_REVIEW} نقطة</span>
          </div>
          <div className="point-item">
            <span className="point-label">إتمام المرحلة (السورة)</span>
            <span className="point-value">{POINTS_SYSTEM.STAGE_COMPLETION} نقطة</span>
          </div>
          <div className="point-item">
            <span className="point-label">إتمام المستوى (الجزء)</span>
            <span className="point-value">{POINTS_SYSTEM.LEVEL_COMPLETION} نقطة</span>
          </div>
          <div className="point-item bonus">
            <span className="point-label">مكافأة التقييم الممتاز</span>
            <span className="point-value">+{POINTS_SYSTEM.PERFECT_RATING_BONUS} نقطة</span>
          </div>
        </div>
      </div>

      <div className="curriculum-content">
        {/* Levels Sidebar */}
        <div className="levels-sidebar">
          <h2>الأجزاء ({filteredLevels.length})</h2>
          
          <div className="levels-list">
            {filteredLevels.map(level => (
              <div
                key={level.id}
                className={`level-card ${selectedLevel?.id === level.id ? 'selected' : ''}`}
                onClick={() => setSelectedLevel(level)}
              >
                <div className="level-info">
                  <span className="level-name">{level.name}</span>
                  <span className="level-stages-count">{level.surahs.length} سورة</span>
                </div>
                <div className="level-badge">
                  <span className="juz-number">{level.juzNumber}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stages Table */}
        <div className="stages-panel">
          {selectedLevel ? (
            <>
              <div className="stages-header">
                <h2>{selectedLevel.name}</h2>
                <div className="level-stats">
                  <span className="stat-item">
                    <span className="stat-icon">📖</span>
                    {selectedLevel.surahs.length} سورة
                  </span>
                  <span className="stat-item">
                    <span className="stat-icon">📝</span>
                    {getTotalAyahs(selectedLevel)} آية
                  </span>
                  <span className="stat-item bonus">
                    <span className="stat-icon">🏆</span>
                    {POINTS_SYSTEM.LEVEL_COMPLETION} نقطة
                  </span>
                </div>
              </div>

              {selectedLevel.id === 'juz-30' && (
                <div className="special-note">
                  <span className="note-icon">⭐</span>
                  <span>يبدأ الطالب الجديد من هذا الجزء - سورة الفاتحة أولاً ثم سور جزء عم</span>
                </div>
              )}

              <div className="stages-table-container">
                <table className="stages-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>السورة (المرحلة)</th>
                      <th>الحفظ 📖</th>
                      <th>المراجعة القريبة 🔄</th>
                      <th>المراجعة البعيدة 📚</th>
                      <th>عدد الآيات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedLevel.surahs.map((surah, index) => (
                      <tr key={surah.id} className={surah.name === 'الفاتحة' ? 'fatiha-row' : ''}>
                        <td className="order-cell">{index + 1}</td>
                        <td className="stage-name">
                          {surah.name === 'الفاتحة' && <span className="fatiha-badge">🌟</span>}
                          سورة {surah.name}
                        </td>
                        <td className="memorization-cell">{getMemorizationContent(surah)}</td>
                        <td className="near-review-cell">{getNearReviewContent(selectedLevel, index)}</td>
                        <td className="far-review-cell">{getFarReviewContent(selectedLevel, index)}</td>
                        <td className="ayah-count-cell">{surah.ayahCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="no-selection">
              <div className="empty-icon">📖</div>
              <h3>اختر جزءاً لعرض السور</h3>
              <p>المنهج يتكون من 30 جزءاً من القرآن الكريم</p>
              <div className="quick-stats">
                <div className="quick-stat">
                  <span className="stat-number">30</span>
                  <span className="stat-label">جزء</span>
                </div>
                <div className="quick-stat">
                  <span className="stat-number">114</span>
                  <span className="stat-label">سورة</span>
                </div>
                <div className="quick-stat">
                  <span className="stat-number">6236</span>
                  <span className="stat-label">آية</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Help Section */}
      <div className="curriculum-help">
        <h3>📌 كيف يعمل النظام</h3>
        <div className="help-content">
          <div className="help-item">
            <span className="help-icon">📖</span>
            <div>
              <strong>الحفظ</strong>
              <p>حفظ السورة المطلوبة في المرحلة الحالية</p>
            </div>
          </div>
          <div className="help-item">
            <span className="help-icon">🔄</span>
            <div>
              <strong>المراجعة القريبة</strong>
              <p>مراجعة السورة التي تم حفظها في المرحلة السابقة</p>
            </div>
          </div>
          <div className="help-item">
            <span className="help-icon">📚</span>
            <div>
              <strong>المراجعة البعيدة</strong>
              <p>مراجعة السورة التي تم حفظها قبل مرحلتين</p>
            </div>
          </div>
          <div className="help-item">
            <span className="help-icon">✅</span>
            <div>
              <strong>إتمام المرحلة</strong>
              <p>يجب اجتياز التحديات الثلاثة للانتقال للسورة التالية</p>
            </div>
          </div>
          <div className="help-item">
            <span className="help-icon">🎯</span>
            <div>
              <strong>إتمام الجزء</strong>
              <p>عند إتمام جميع سور الجزء، يتم طلب موافقة المشرف للانتقال للجزء التالي</p>
            </div>
          </div>
        </div>
      </div>

      {/* Journey Overview */}
      <div className="journey-overview">
        <h3>🚀 رحلة الحفظ</h3>
        <div className="journey-path">
          <div className="journey-step start">
            <span className="step-icon">🌟</span>
            <span className="step-label">البداية</span>
            <span className="step-detail">جزء 30 - الفاتحة</span>
          </div>
          <div className="journey-arrow">→</div>
          <div className="journey-step">
            <span className="step-icon">📖</span>
            <span className="step-label">جزء عم</span>
            <span className="step-detail">37 سورة</span>
          </div>
          <div className="journey-arrow">→</div>
          <div className="journey-step">
            <span className="step-icon">📚</span>
            <span className="step-label">الأجزاء 29-2</span>
            <span className="step-detail">بالتدريج</span>
          </div>
          <div className="journey-arrow">→</div>
          <div className="journey-step end">
            <span className="step-icon">🏆</span>
            <span className="step-label">الختم</span>
            <span className="step-detail">جزء 1 - البقرة</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Curriculum;

