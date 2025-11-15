import { useState } from 'react';
import '../styles/Curriculum.css';
import curriculum from '../data/curriculumData';

const Curriculum = () => {
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);

  return (
    <section className="page">
      <header className="page__header">
        <h1>المنهج الدراسي</h1>
        <p>خطة حفظ القرآن الكريم كاملاً على 6 مستويات تعليمية.</p>
      </header>

      <div className="curriculum-container">
        {curriculum.map((level) => (
          <div key={level.id} className="curriculum-level">
            <div
              className="level-header"
              onClick={() => setExpandedLevel(expandedLevel === level.id ? null : level.id)}
              role="button"
              tabIndex={0}
            >
              <div className="level-info">
                <h2>{level.name}</h2>
                <p className="level-description">{level.description}</p>
                <span className="parts-count">
                  عدد الأجزاء: {level.parts.length}
                </span>
              </div>
              <div className={`expand-icon ${expandedLevel === level.id ? 'expanded' : ''}`}>
                ▼
              </div>
            </div>

            {expandedLevel === level.id && (
              <div className="level-content">
                <div className="parts-grid">
                  {level.parts.map((part: any) => (
                    <article key={part.id} className="part-card">
                      <div className="part-header">
                        <h3>{part.name}</h3>
                        <span className="part-number">جزء {part.id}</span>
                      </div>
                      <div className="part-body">
                        <div className="part-row">
                          <span className="label">المرحلة:</span>
                          <span className="value">{part.stage || 'المرحلة'}</span>
                        </div>
                        <div className="part-row">
                          <span className="label">عدد الصفحات:</span>
                          <span className="value">{part.pages}</span>
                        </div>
                        <div className="part-row">
                          <span className="label">حالة الحفظ:</span>
                          <span className={`status ${part.status === 'لم يبدأ' ? 'not-started' : 'in-progress'}`}>
                            {part.status || 'لم يبدأ'}
                          </span>
                        </div>
                      </div>
                    </article>
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

