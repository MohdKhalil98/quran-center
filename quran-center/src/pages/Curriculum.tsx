import curriculumData from '../data/curriculumData';

const Curriculum = () => {
  const { اسم_المستوى, الوصف, الأجزاء } = curriculumData;

  return (
    <section className="page">
      <header className="page__header">
        <h1>المنهج</h1>
        <p>{اسم_المستوى} — {الوصف}</p>
      </header>

      <div className="curriculum-list">
        {الأجزاء.map((جزء) => (
          <article key={جزء.جزء_id} className="curriculum-part card">
            <header className="part-header">
              <h2>{جزء.اسم_الجزء} <small>({جزء.جزء_id})</small></h2>
              <div className="part-stage">{جزء.المرحلة}</div>
            </header>

            <ul className="sura-list">
              {جزء.السور.map((سورة, idx) => (
                <li key={idx} className="sura-row">
                  <span className="sura-name">{سورة.اسم_السورة}</span>
                  <span className="sura-verses">{سورة.عدد_الآيات} آية</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Curriculum;

