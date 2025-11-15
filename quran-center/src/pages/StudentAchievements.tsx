import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/StudentAchievements.css';
import ConfirmModal from '../components/ConfirmModal';

interface StudentAchievement {
  id?: string;
  studentId: string;
  studentName?: string;
  portion: string;
  fromAya: string;
  toAya: string;
  rating: number;
  assignmentFromAya: string;
  assignmentToAya: string;
  date: string;
}

const StudentAchievements = () => {
  const [achievements, setAchievements] = useState<StudentAchievement[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStudent, setFilterStudent] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);
  const [formData, setFormData] = useState<StudentAchievement>({
    studentId: '',
    portion: '',
    fromAya: '',
    toAya: '',
    rating: 5,
    assignmentFromAya: '',
    assignmentToAya: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Fetch achievements and students from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch students
        const studentsQuery = query(collection(db, 'students'), orderBy('name'));
        const studentsSnapshot = await getDocs(studentsQuery);
        const studentsList = studentsSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
          ...doc.data()
        } as any));

        // Fetch achievements
        const achievementsQuery = query(collection(db, 'student_achievements'), orderBy('date', 'desc'));
        const achievementsSnapshot = await getDocs(achievementsQuery);
        const achievementsList = achievementsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        } as StudentAchievement));

        // Attach student names to achievements
        const achievementsWithNames = achievementsList.map((achievement) => ({
          ...achievement,
          studentName: studentsList.find((s) => s.id === achievement.studentId)?.name || 'غير محدد'
        }));

        setStudents(studentsList);
        setAchievements(achievementsWithNames);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === 'rating' ? parseInt(value) : value
    }));
  };

  const handleAddAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || !formData.portion || !formData.fromAya || !formData.toAya) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const studentName = students.find((s) => s.id === formData.studentId)?.name || 'غير محدد';
      const { id, studentName: _, ...dataToSave } = formData;

      if (editingId) {
        // Update existing achievement
        await updateDoc(doc(db, 'student_achievements', editingId), dataToSave);
        setAchievements((prev) =>
          prev.map((a) =>
            a.id === editingId
              ? { ...dataToSave, id: editingId, studentName } as StudentAchievement
              : a
          )
        );
        setEditingId(null);
      } else {
        // Add new achievement
        const docRef = await addDoc(collection(db, 'student_achievements'), dataToSave);
        setAchievements((prev) => [
          { ...dataToSave, id: docRef.id, studentName } as StudentAchievement,
          ...prev
        ]);
      }

      setFormData({
        studentId: '',
        portion: '',
        fromAya: '',
        toAya: '',
        rating: 5,
        assignmentFromAya: '',
        assignmentToAya: '',
        date: new Date().toISOString().split('T')[0]
      });
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding/updating achievement:', error);
      alert('حدث خطأ أثناء حفظ البيانات');
    }
  };

  const handleDeleteAchievement = (id: string) => {
    setConfirmTargetId(id);
    setConfirmOpen(true);
  };

  const performDeleteAchievement = async () => {
    const id = confirmTargetId;
    setConfirmOpen(false);
    setConfirmTargetId(null);
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'student_achievements', id));
      setAchievements((prev) => prev.filter((a) => a.id !== id));
    } catch (error) {
      console.error('Error deleting achievement:', error);
      alert('حدث خطأ أثناء حذف البيانات');
    }
  };

  const handleEditAchievement = (achievement: StudentAchievement) => {
    setFormData(achievement);
    setEditingId(achievement.id || null);
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      studentId: '',
      portion: '',
      fromAya: '',
      toAya: '',
      rating: 5,
      assignmentFromAya: '',
      assignmentToAya: '',
      date: new Date().toISOString().split('T')[0]
    });
  };

  const filteredAchievements = filterStudent
    ? achievements.filter((a) => a.studentId === filterStudent)
    : achievements;

  if (loading) {
    return (
      <section className="page">
        <header className="page__header">
          <h1>تحصيل الطالب</h1>
        </header>
        <p>جاري تحميل البيانات...</p>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1>تحصيل الطالب</h1>
        <p>تسجيل وتتبع تقدم الطلاب في حفظ وتسميع القرآن.</p>
      </header>

      <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
        + تسجيل تحصيل جديد
      </button>

      {isAdding && (
        <form className="form-card" onSubmit={handleAddAchievement}>
          <h3>{editingId ? 'تعديل التحصيل' : 'تسجيل تحصيل جديد'}</h3>
          <div className="form-group">
            <label htmlFor="studentId">الطالب *</label>
            <select
              id="studentId"
              name="studentId"
              value={formData.studentId}
              onChange={handleInputChange}
              required
            >
              <option value="">اختر الطالب</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="portion">الورد (السورة/الجزء) *</label>
            <input
              type="text"
              id="portion"
              name="portion"
              placeholder="مثال: جزء عمّ، سورة الفاتحة"
              value={formData.portion}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="fromAya">من آية *</label>
              <input
                type="text"
                id="fromAya"
                name="fromAya"
                placeholder="مثال: 1"
                value={formData.fromAya}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="toAya">إلى آية *</label>
              <input
                type="text"
                id="toAya"
                name="toAya"
                placeholder="مثال: 10"
                value={formData.toAya}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="rating">التقييم (1-10) *</label>
            <input
              type="number"
              id="rating"
              name="rating"
              min="1"
              max="10"
              value={formData.rating}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="form-group">
            <label>الواجب المطلوب:</label>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="assignmentFromAya">من آية</label>
              <input
                type="text"
                id="assignmentFromAya"
                name="assignmentFromAya"
                placeholder="مثال: 11"
                value={formData.assignmentFromAya}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="assignmentToAya">إلى آية</label>
              <input
                type="text"
                id="assignmentToAya"
                name="assignmentToAya"
                placeholder="مثال: 20"
                value={formData.assignmentToAya}
                onChange={handleInputChange}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="date">التاريخ *</label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-success">
              {editingId ? 'تحديث' : 'حفظ'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleCancel}>
              إلغاء
            </button>
          </div>
        </form>
      )}

      <div className="filter-section">
        <label htmlFor="filterStudent">تصفية حسب الطالب:</label>
        <select
          id="filterStudent"
          value={filterStudent}
          onChange={(e) => setFilterStudent(e.target.value)}
        >
          <option value="">جميع الطلاب</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </select>
      </div>

      <div className="table-card">
        {filteredAchievements.length === 0 ? (
          <p>لا توجد بيانات تحصيل حتى الآن</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>الطالب</th>
                <th>الورد</th>
                <th>من آية</th>
                <th>إلى آية</th>
                <th>التقييم</th>
                <th>الواجب (من - إلى)</th>
                <th>التاريخ</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredAchievements.map((achievement) => (
                <tr key={achievement.id}>
                  <td>{achievement.studentName}</td>
                  <td>{achievement.portion}</td>
                  <td>{achievement.fromAya}</td>
                  <td>{achievement.toAya}</td>
                  <td>
                    <span className={`rating rating-${achievement.rating}`}>
                      {achievement.rating}/10
                    </span>
                  </td>
                  <td>
                    {achievement.assignmentFromAya && achievement.assignmentToAya
                      ? `${achievement.assignmentFromAya} - ${achievement.assignmentToAya}`
                      : '-'}
                  </td>
                  <td>{new Date(achievement.date).toLocaleDateString('ar-SA')}</td>
                  <td>
                      <button
                        className="btn btn-sm btn-warning"
                        onClick={() => handleEditAchievement(achievement)}
                      >
                        تعديل
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteAchievement(achievement.id || '')}
                      >
                        حذف
                      </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
        <ConfirmModal
          open={confirmOpen}
          message="هل أنت متأكد من حذف هذا التحصيل؟"
          onConfirm={performDeleteAchievement}
          onCancel={() => {
            setConfirmOpen(false);
            setConfirmTargetId(null);
          }}
        />
    </section>
  );
};

export default StudentAchievements;
