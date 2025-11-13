const curriculum = [
  {
    stage: 'المستوى الأول',
    focus: 'حفظ جزء عمّ وتثبيت أحكام التجويد الأساسية'
  },
  {
    stage: 'المستوى الثاني',
    focus: 'حفظ الأجزاء 29-28 مع مراجعة يومية'
  },
  {
    stage: 'المستوى الثالث',
    focus: 'حفظ من سورة الكهف إلى سورة الأحزاب'
  }
];

const Curriculum = () => (
  <section className="page">
    <header className="page__header">
      <h1>المنهج</h1>
      <p>خطة الحفظ والمراجعة لكل مستوى دراسي.</p>
    </header>
    <div className="card-list">
      {curriculum.map((item) => (
        <article key={item.stage} className="info-card">
          <h2>{item.stage}</h2>
          <p>{item.focus}</p>
        </article>
      ))}
    </div>
  </section>
);

export default Curriculum;

