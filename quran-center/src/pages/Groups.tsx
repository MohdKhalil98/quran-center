const groups = [
  {
    name: 'مجموعة النور',
    teacher: 'الشيخ عبد الرحمن',
    schedule: 'الأحد والثلاثاء'
  },
  {
    name: 'مجموعة الفرقان',
    teacher: 'الأستاذة مريم',
    schedule: 'الاثنين والأربعاء'
  },
  {
    name: 'مجموعة التوبة',
    teacher: 'الشيخ خالد',
    schedule: 'الخميس والسبت'
  }
];

const Groups = () => (
  <section className="page">
    <header className="page__header">
      <h1>المجموعات</h1>
      <p>عرض المجموعات وجداولها والمدرسين المشرفين.</p>
    </header>
    <div className="card-list">
      {groups.map((group) => (
        <article key={group.name} className="info-card">
          <h2>{group.name}</h2>
          <p>
            <strong>المعلم:</strong> {group.teacher}
          </p>
          <p>
            <strong>الجدول:</strong> {group.schedule}
          </p>
        </article>
      ))}
    </div>
  </section>
);

export default Groups;

