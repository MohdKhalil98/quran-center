const stats = [
  { title: 'إجمالي الطلاب', value: '125', description: 'طلاب مسجلون حالياً' },
  { title: 'المجموعات النشطة', value: '12', description: 'ضمن فترات مختلفة' },
  { title: 'المدرسون', value: '8', description: 'مشرفون على الحلقات' },
  {
    title: 'المراجعات هذا الأسبوع',
    value: '54',
    description: 'عدد جلسات المراجعة المكتملة'
  }
];

const Dashboard = () => (
  <section className="page">
    <header className="page__header">
      <h1>لوحة التحكم</h1>
      <p>مرحباً بك في مركز متابعة تحفيظ القرآن.</p>
    </header>
    <div className="stats-grid">
      {stats.map((card) => (
        <article key={card.title} className="stat-card">
          <h2>{card.title}</h2>
          <p className="stat-card__value">{card.value}</p>
          <p className="stat-card__description">{card.description}</p>
        </article>
      ))}
    </div>
    <section className="overview-card">
      <h2>آخر التحديثات</h2>
      <ul className="overview-list">
        <li>تم إضافة مجموعة جديدة لحفظ جزء عمّ.</li>
        <li>اكتمل تسميع خمسة طلاب لجزء تبارك هذا الأسبوع.</li>
        <li>بدء التسجيل للفصل الصيفي القادم.</li>
      </ul>
    </section>
  </section>
);

export default Dashboard;

