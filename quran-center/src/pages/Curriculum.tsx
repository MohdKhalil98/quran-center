import { useState } from 'react';
import curriculumData from '../data/curriculumData';

const Curriculum = () => {
  const { اسم_المستوى, الوصف, الأجزاء } = curriculumData;
  const [expandedPart, setExpandedPart] = useState<number | null>(null);

  const togglePart = (partId: number) => {
    setExpandedPart(expandedPart === partId ? null : partId);
  };

  // حساب إحصائيات المنهج
  const totalSurahs = الأجزاء.reduce((sum, part) => sum + part.السور.length, 0);
  const totalVerses = الأجزاء.reduce(
    (sum, part) => sum + part.السور.reduce((partSum, sura) => partSum + sura.عدد_الآيات, 0),
    0
  );

  return (
    <section className="page">
      <header className="page__header">
        <h1>📖 المنهج الدراسي</h1>
        <p>{اسم_المستوى}</p>
        <p style={{ fontSize: '0.95em', color: '#666', marginTop: '8px' }}>{الوصف}</p>
      </header>

      {/* بطاقات الإحصائيات */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #1b8c6b 0%, #158056 100%)',
          padding: '20px',
          borderRadius: '12px',
          color: 'white',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(27, 140, 107, 0.2)'
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '2em' }}>{الأجزاء.length}</h3>
          <p style={{ margin: 0, fontSize: '0.9em', opacity: 0.9 }}>الأجزاء المقررة</p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #27a884 0%, #1b8c6b 100%)',
          padding: '20px',
          borderRadius: '12px',
          color: 'white',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(27, 140, 107, 0.2)'
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '2em' }}>{totalSurahs}</h3>
          <p style={{ margin: 0, fontSize: '0.9em', opacity: 0.9 }}>السور الكلية</p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #35c393 0%, #27a884 100%)',
          padding: '20px',
          borderRadius: '12px',
          color: 'white',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(27, 140, 107, 0.2)'
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '2em' }}>{totalVerses}</h3>
          <p style={{ margin: 0, fontSize: '0.9em', opacity: 0.9 }}>الآيات الكلية</p>
        </div>
      </div>

      {/* قائمة الأجزاء */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        {الأجزاء.map((جزء) => (
          <article
            key={جزء.جزء_id}
            style={{
              background: 'white',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(27, 140, 107, 0.08)',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              border: expandedPart === جزء.جزء_id ? '2px solid #1b8c6b' : '1px solid #e4efe9'
            }}
            onClick={() => togglePart(جزء.جزء_id)}
          >
            {/* رأس البطاقة */}
            <div style={{
              background: 'linear-gradient(135deg, #1b8c6b 0%, #158056 100%)',
              color: 'white',
              padding: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.3em' }}>
                  {جزء.اسم_الجزء}
                </h3>
                <p style={{ margin: 0, fontSize: '0.85em', opacity: 0.9 }}>
                  جزء {جزء.جزء_id}
                </p>
              </div>
              <span style={{ fontSize: '1.5em' }}>
                {expandedPart === جزء.جزء_id ? '📖' : '📕'}
              </span>
            </div>

            {/* معلومات الجزء */}
            <div style={{ padding: '16px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                paddingBottom: '12px',
                borderBottom: '1px solid #e4efe9'
              }}>
                <span style={{ color: '#5e7c71', fontSize: '0.9em' }}>
                  {جزء.السور.length} سورة
                </span>
                <span style={{
                  background: 'rgba(27, 140, 107, 0.1)',
                  color: '#1b8c6b',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '0.8em',
                  fontWeight: '600'
                }}>
                  {جزء.المرحلة}
                </span>
              </div>

              {/* السور عند التوسع */}
              {expandedPart === جزء.جزء_id && (
                <ul style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0
                }}>
                  {جزء.السور.map((سورة, idx) => (
                    <li
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 0',
                        borderBottom: idx < جزء.السور.length - 1 ? '1px solid #f0f0f0' : 'none',
                        fontSize: '0.9em'
                      }}
                    >
                      <span style={{ color: '#114d3a' }}>• {سورة.اسم_السورة}</span>
                      <span style={{
                        background: 'rgba(27, 140, 107, 0.08)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.85em',
                        color: '#1b8c6b',
                        fontWeight: '500'
                      }}>
                        {سورة.عدد_الآيات}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Curriculum;

