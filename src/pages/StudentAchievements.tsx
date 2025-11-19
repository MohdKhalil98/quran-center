import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/StudentAchievements.css';
import curriculum, { Level, Part, Surah } from '../data/curriculumData';
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
  const [searchText, setSearchText] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
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

  const [availableParts, setAvailableParts] = useState<Part[]>([]);
  const [availableSurahs, setAvailableSurahs] = useState<Surah[]>([]);

  // Fetch achievements and students from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch students
        const studentsQuery = query(collection(db, 'students'), orderBy('name'));
        const studentsSnapshot = await getDocs(studentsQuery);
        const studentsList = studentsSnapshot.docs.map((doc) => {
          const data = doc.data();
          const levelId = data.levelId || 1;
          const level = curriculum.find((l: Level) => l.id === levelId);
          return {
            id: doc.id,
            name: data.name,
            ...data,
            levelId,
            levelName: level?.name
          };
        });

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
      [name]: name === 'rating' ? parseInt(value) : value
    }));
  };

  const handleStudentSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const studentId = e.target.value;
    const student = students.find((s) => s.id === studentId);
    setFormData((prev) => ({ ...prev, studentId }));
    if (student) {
      const level = curriculum.find((l: Level) => l.id === (student.levelId || 1));
      const parts = level?.parts || [];
      setAvailableParts(parts);
      if (parts.length) {
        const firstPart = parts[0];
        setFormData((prev) => ({ ...prev, portion: firstPart.name }));
        setAvailableSurahs(firstPart.surahs || []);
      } else {
        setAvailableSurahs([]);
      }
    } else {
      setAvailableParts([]);
      setAvailableSurahs([]);
    }
  };

  const handlePartChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const partId = parseInt(e.target.value, 10);
    const part = availableParts.find((p: Part) => p.id === partId);
    if (part) {
      setFormData((prev) => ({ ...prev, portion: part.name }));
      setAvailableSurahs(part.surahs || []);
    }
  };

  const handleSurahChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const surah = e.target.value;
    setFormData((prev) => ({ ...prev, portion: surah }));
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
    // populate parts/surahs according to student's level
    const student = students.find((s) => s.id === achievement.studentId);
    if (student) {
      const level = curriculum.find((l: Level) => l.id === (student.levelId || 1));
      const parts = level?.parts || [];
      setAvailableParts(parts);
      // if portion matches a part name, show its surahs
      const matchingPart = parts.find((p: Part) => p.name === achievement.portion) || parts[0];
      setAvailableSurahs(matchingPart?.surahs || []);
    }
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

  const filteredAchievements = achievements.filter((a) => {
    const matchesStudent = !filterStudent || a.studentId === filterStudent;
    const matchesSearch =
      !searchText ||
      a.studentName?.toLowerCase().includes(searchText.toLowerCase()) ||
      a.portion?.toLowerCase().includes(searchText.toLowerCase());
    return matchesStudent && matchesSearch;
  });

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
              onChange={handleStudentSelect}
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
            <label htmlFor="portion">الورد (الجزء → السورة) *</label>
            <select id="partSelect" name="partSelect" onChange={handlePartChange}>
              <option value="">اختر الجزء</option>
              {availableParts.map((p: Part) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {availableSurahs.length > 0 && (
              <select id="surahSelect" name="surahSelect" onChange={handleSurahChange} value={formData.portion}>
                <option value="">اختر السورة</option>
                {availableSurahs.map((s: Surah) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            {!availableSurahs.length && (
              <input
                type="text"
                id="portion"
                name="portion"
                placeholder="مثال: جزء عمّ أو سورة الفاتحة"
                value={formData.portion}
                onChange={handleInputChange}
                required
              />
            )}
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
        <div className="filter-controls">
          <div className="search-box">
            <input
              type="text"
              placeholder="ابحث عن طالب أو ورد..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="search-input"
            />
          </div>
          <select
            value={filterStudent}
            onChange={(e) => setFilterStudent(e.target.value)}
            className="filter-select"
          >
            <option value="">جميع الطلاب</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
          <div className="view-mode-toggle">
            <button
              className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="عرض البطاقات"
            >
              📋
            </button>
            <button
              className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="عرض الجدول"
            >
              📊
            </button>
          </div>
        </div>
      </div>

      {filteredAchievements.length === 0 ? (
        <div className="empty-state">
          <p>لا توجد بيانات تحصيل حتى الآن</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="achievements-cards-container">
          {filteredAchievements.map((achievement) => (
            <article key={achievement.id} className="achievement-card">
              <div className="achievement-header">
                <h3>{achievement.studentName}</h3>
                <span className={`rating rating-badge rating-${achievement.rating}`}>
                  {achievement.rating}/10
                </span>
              </div>
              
              <div className="achievement-body">
                <div className="achievement-row">
                  <span className="label">الورد:</span>
                  <span className="value">{achievement.portion}</span>
                </div>
                
                <div className="achievement-row">
                  <span className="label">الآيات المحفوظة:</span>
                  <span className="value">{achievement.fromAya} - {achievement.toAya}</span>
                </div>

                {achievement.assignmentFromAya && achievement.assignmentToAya && (
                  <div className="achievement-row">
                    <span className="label">الواجب المطلوب:</span>
                    <span className="value">{achievement.assignmentFromAya} - {achievement.assignmentToAya}</span>
                  </div>
                )}

                <div className="achievement-row">
                  <span className="label">التاريخ:</span>
                  <span className="value date">
                    {new Date(achievement.date).toLocaleDateString('ar-SA', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              <div className="achievement-actions">
                <button
                  className="btn btn-sm btn-warning"
                  onClick={() => handleEditAchievement(achievement)}
                >
                  ✏️ تعديل
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDeleteAchievement(achievement.id || '')}
                >
                  🗑️ حذف
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="table-card">
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
        </div>
      )}
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
