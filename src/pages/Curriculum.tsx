import { useState } from 'react';
import '../styles/Curriculum.css';
import curriculum, { Level, Part } from '../data/curriculumData';

const Curriculum = () => {
  const [expandedLevel, setExpandedLevel] = useState<number | null>(1);
  const [expandedPart, setExpandedPart] = useState<number | null>(30);

  const toggleLevel = (levelId: number) => {
    setExpandedLevel(expandedLevel === levelId ? null : levelId);
  };

  const togglePart = (partId: number) => {
    setExpandedPart(expandedPart === partId ? null : partId);
  };

  return (
    <section className="page">
      <header className="page__header">
        <h1>المنهج الدراسي</h1>
        <p>خطة حفظ القرآن الكريم كاملاً على 6 مستويات تعليمية.</p>
      </header>

      <div className="curriculum-container">
        {curriculum.map((level: Level) => (
          <div key={level.id} className="curriculum-level">
            <div
              className={`level-header ${expandedLevel === level.id ? 'expanded' : ''}`}
              onClick={() => toggleLevel(level.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  toggleLevel(level.id);
                }
              }}
            >
              <div className="level-info">
                <h2>{level.name}</h2>
                <p className="level-description">{level.description}</p>
                <span className="parts-count">
                  عدد الأجزاء: <strong>{level.parts.length}</strong>
                </span>
              </div>
              <div className={`expand-icon ${expandedLevel === level.id ? 'expanded' : ''}`}>
                ▼
              </div>
            </div>

            {expandedLevel === level.id && (
              <div className="level-content">
                <div className="parts-list">
                  {level.parts.map((part: Part) => (
                    <div key={part.id} className="part-wrapper">
                      <div
                        className={`part-header-expandable ${expandedPart === part.id ? 'expanded' : ''}`}
                        onClick={() => togglePart(part.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            togglePart(part.id);
                          }
                        }}
                      >
                        <div className="part-info">
                          <h3>{part.name}</h3>
                          <span className="part-stage">{part.stage}</span>
                        </div>
                        <div className="part-stats">
                          <span className="stat">الصفحات: {part.pages}</span>
                          <span className="stat">السور: {part.surahs.length}</span>
                        </div>
                        <div className={`expand-icon ${expandedPart === part.id ? 'expanded' : ''}`}>
                          ▼
                        </div>
                      </div>

                      {expandedPart === part.id && part.surahs.length > 0 && (
                        <div className="part-content">
                          <ul className="surahs-list">
                            {part.surahs.map((surah, idx) => (
                              <li key={surah.id} className="surah-item">
                                <span className="surah-number">{idx + 1}</span>
                                <span className="surah-name">{surah.name}</span>
                                <span className="surah-verses">{surah.verses} آية</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default Curriculum;

