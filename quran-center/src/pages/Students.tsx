const students = [
  { name: 'أحمد علي', group: 'مجموعة النور', progress: 'جزء عمّ' },
  { name: 'سارة سعيد', group: 'مجموعة الفرقان', progress: 'جزء تبارك' },
  { name: 'محمد يوسف', group: 'مجموعة الإخلاص', progress: 'جزء قد سمع' }
];

const Students = () => (
  <section className="page">
    <header className="page__header">
      <h1>الطلاب</h1>
      <p>إدارة بيانات الطلاب ومستوى التقدم.</p>
    </header>
    <div className="table-card">
      <table>
        <thead>
          <tr>
            <th>الاسم</th>
            <th>المجموعة</th>
            <th>التقدم</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.name}>
              <td>{student.name}</td>
              <td>{student.group}</td>
              <td>{student.progress}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export default Students;

