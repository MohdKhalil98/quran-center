import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/StudentAchievements.css';
import curriculumData from '../data/curriculumData';
import ConfirmModal from '../components/ConfirmModal';

interface StudentAchievement {
  id?: string;
  studentId: string;
  studentName?: string;
  portion: string;
  fromAya: string;
  toAya: string;
  rating: number;
  teacherNotes: string;
  assignmentSurah: string;
  assignmentFromAya: string;
  assignmentToAya: string;
  date: string;
}

const StudentAchievements = () => {
  const [achievements, setAchievements] = useState<StudentAchievement[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStudent, setFilterStudent] = useState<string>('');
  const [filterGroup, setFilterGroup] = useState<string>('');
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
    teacherNotes: '',
    assignmentSurah: '',
    assignmentFromAya: '',
    assignmentToAya: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [availableParts, setAvailableParts] = useState<any[]>([]);
  const [availableSurahs, setAvailableSurahs] = useState<string[]>([]);

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
          ...doc.data(),
          levelId: (doc.data() as any).levelId || 1,
          levelName: (doc.data() as any).levelName || curriculumData.اسم_المستوى
        } as any));

        // Fetch groups
        const groupsQuery = query(collection(db, 'groups'), orderBy('name'));
        const groupsSnapshot = await getDocs(groupsQuery);
        const groupsList = groupsSnapshot.docs.map((doc) => ({
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
        setGroups(groupsList);
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
    const selectedStudent = students.find(s => s.id === studentId);
    
    setFormData((prev) => ({ ...prev, studentId }));
    
    if (selectedStudent && selectedStudent.partId) {
      // Filter parts based on student's current part
      const studentPart = curriculumData.الأجزاء.find(p => p.جزء_id === selectedStudent.partId);
      if (studentPart) {
        setAvailableParts([studentPart]);
        setFormData((prev) => ({ ...prev, portion: '' }));
        setAvailableSurahs(studentPart.السور.map((s: any) => s.اسم_السورة) || []);
      }
    } else {
      // Default to all parts
      setAvailableParts(curriculumData.الأجزاء || []);
      setAvailableSurahs([]);
    }
  };

  const handlePartChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const partId = parseInt(e.target.value, 10);
    const part = availableParts.find((p: any) => p.جزء_id === partId);
    if (part) {
      setFormData((prev) => ({ ...prev, portion: part.اسم_الجزء }));
      setAvailableSurahs((part.السور || []).map((s: any) => s.اسم_السورة));
    }
  };

  const handleSurahChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const surah = e.target.value;
    setFormData((prev) => ({ ...prev, portion: surah, fromAya: '', toAya: '' }));
  };

  const getMaxAyahForSelectedSurah = () => {
    const selectedStudent = students.find(s => s.id === formData.studentId);
    if (!selectedStudent || !selectedStudent.partId || !formData.portion) return 999;
    
    const studentPart = curriculumData.الأجزاء.find(p => p.جزء_id === selectedStudent.partId);
    if (!studentPart) return 999;
    
    const selectedSurah = studentPart.السور.find((s: any) => s.اسم_السورة === formData.portion);
    return selectedSurah ? selectedSurah.عدد_الآيات : 999;
  };

  const getMaxAyahForAssignmentSurah = () => {
    const selectedStudent = students.find(s => s.id === formData.studentId);
    if (!selectedStudent || !selectedStudent.partId || !formData.assignmentSurah) return 999;
    
    const studentPart = curriculumData.الأجزاء.find(p => p.جزء_id === selectedStudent.partId);
    if (!studentPart) return 999;
    
    const selectedSurah = studentPart.السور.find((s: any) => s.اسم_السورة === formData.assignmentSurah);
    return selectedSurah ? selectedSurah.عدد_الآيات : 999;
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
        teacherNotes: '',
        assignmentSurah: '',
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
    setFormData({
      ...achievement,
      teacherNotes: achievement.teacherNotes || '',
      assignmentSurah: achievement.assignmentSurah || ''
    });
    setEditingId(achievement.id || null);
    setIsAdding(true);
    // Populate parts/surahs from curriculum
    const selectedStudent = students.find(s => s.id === achievement.studentId);
    if (selectedStudent && selectedStudent.partId) {
      const studentPart = curriculumData.الأجزاء.find(p => p.جزء_id === selectedStudent.partId);
      if (studentPart) {
        setAvailableParts([studentPart]);
        setAvailableSurahs(studentPart.السور.map((s: any) => s.اسم_السورة) || []);
      }
    } else {
      setAvailableParts(curriculumData.الأجزاء || []);
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
      teacherNotes: '',
      assignmentSurah: '',
      assignmentFromAya: '',
      assignmentToAya: '',
      date: new Date().toISOString().split('T')[0]
    });
  };

  const filteredAchievements = achievements.filter((a) => {
    const matchesStudent = !filterStudent || a.studentId === filterStudent;
    const matchesGroup = !filterGroup || students.find(s => s.id === a.studentId)?.groupId === filterGroup;
    const matchesSearch =
      !searchText ||
      a.studentName?.toLowerCase().includes(searchText.toLowerCase()) ||
      a.portion?.toLowerCase().includes(searchText.toLowerCase());
    return matchesStudent && matchesGroup && matchesSearch;
  });

  const getStudentStats = (studentId: string) => {
    const studentAchievements = achievements.filter((a) => a.studentId === studentId);
    const totalAchievements = studentAchievements.length;
    const averageRating =
      totalAchievements > 0
        ? (studentAchievements.reduce((sum, a) => sum + (a.rating || 0), 0) / totalAchievements).toFixed(1)
        : 0;
    return { totalAchievements, averageRating };
  };

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
            {formData.studentId && students.find(s => s.id === formData.studentId) && (
              <div style={{
                marginTop: '8px',
                padding: '8px 12px',
                backgroundColor: 'rgba(27, 140, 107, 0.08)',
                borderRadius: '6px',
                fontSize: '0.9em',
                color: '#1b8c6b'
              }}>
                <strong>المستوى:</strong> {students.find(s => s.id === formData.studentId)?.levelName || 'غير محدد'} 
                <br />
                <strong>الجزء:</strong> {students.find(s => s.id === formData.studentId)?.partName || 'غير محدد'}
              </div>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="portion">السورة *</label>
            {availableSurahs.length > 0 ? (
              <select id="surahSelect" name="surahSelect" onChange={handleSurahChange} value={formData.portion} required>
                <option value="">اختر السورة</option>
                {availableSurahs.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                id="portion"
                name="portion"
                placeholder="مثال: سورة الفاتحة"
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
                type="number"
                id="fromAya"
                name="fromAya"
                placeholder="1"
                min="1"
                max={getMaxAyahForSelectedSurah()}
                value={formData.fromAya}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="toAya">إلى آية *</label>
              <input
                type="number"
                id="toAya"
                name="toAya"
                placeholder={`الحد الأقصى: ${getMaxAyahForSelectedSurah()}`}
                min="1"
                max={getMaxAyahForSelectedSurah()}
                value={formData.toAya}
                onChange={handleInputChange}
                required
              />
              {formData.portion && (
                <small style={{ color: '#5e7c71', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  عدد الآيات في {formData.portion}: {getMaxAyahForSelectedSurah()}
                </small>
              )}
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
            <label htmlFor="teacherNotes">ملاحظات المعلم</label>
            <textarea
              id="teacherNotes"
              name="teacherNotes"
              value={formData.teacherNotes}
              onChange={handleInputChange}
              rows={3}
              placeholder="أضف ملاحظات حول أداء الطالب..."
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid #d6e4de',
                fontFamily: 'Cairo, sans-serif',
                fontSize: '1em'
              }}
            />
          </div>
          <div className="form-group">
            <h3 style={{ margin: '16px 0 8px 0', fontSize: '1.2em', color: '#1b8c6b' }}>
              الواجب المطلوب
            </h3>
          </div>
          <div className="form-group">
            <label htmlFor="assignmentSurah">السورة</label>
            {availableSurahs.length > 0 ? (
              <select
                id="assignmentSurah"
                name="assignmentSurah"
                value={formData.assignmentSurah}
                onChange={handleInputChange}
              >
                <option value="">اختر السورة للواجب</option>
                {availableSurahs.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                id="assignmentSurah"
                name="assignmentSurah"
                placeholder="مثال: سورة الفاتحة"
                value={formData.assignmentSurah}
                onChange={handleInputChange}
              />
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="assignmentFromAya">من آية</label>
              <input
                type="number"
                id="assignmentFromAya"
                name="assignmentFromAya"
                placeholder="1"
                min="1"
                max={getMaxAyahForAssignmentSurah()}
                value={formData.assignmentFromAya}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="assignmentToAya">إلى آية</label>
              <input
                type="number"
                id="assignmentToAya"
                name="assignmentToAya"
                placeholder={formData.assignmentSurah ? `الحد الأقصى: ${getMaxAyahForAssignmentSurah()}` : 'اختر السورة أولاً'}
                min="1"
                max={getMaxAyahForAssignmentSurah()}
                value={formData.assignmentToAya}
                onChange={handleInputChange}
              />
              {formData.assignmentSurah && (
                <small style={{ color: '#5e7c71', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                  عدد الآيات في {formData.assignmentSurah}: {getMaxAyahForAssignmentSurah()}
                </small>
              )}
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
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="filter-select"
          >
            <option value="">جميع الحلقات</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
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

                {achievement.teacherNotes && (
                  <div className="achievement-row">
                    <span className="label">ملاحظات المعلم:</span>
                    <span className="value" style={{ whiteSpace: 'pre-wrap' }}>{achievement.teacherNotes}</span>
                  </div>
                )}

                {(achievement.assignmentSurah || achievement.assignmentFromAya) && (
                  <>
                    <div style={{ 
                      marginTop: '12px', 
                      paddingTop: '12px', 
                      borderTop: '2px solid #1b8c6b',
                      fontWeight: '600',
                      fontSize: '1.05em',
                      color: '#1b8c6b'
                    }}>
                      الواجب المطلوب
                    </div>
                    {achievement.assignmentSurah && (
                      <div className="achievement-row">
                        <span className="label">السورة:</span>
                        <span className="value">{achievement.assignmentSurah}</span>
                      </div>
                    )}
                    {achievement.assignmentFromAya && achievement.assignmentToAya && (
                      <div className="achievement-row">
                        <span className="label">الآيات:</span>
                        <span className="value">{achievement.assignmentFromAya} - {achievement.assignmentToAya}</span>
                      </div>
                    )}
                  </>
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
                <th>ملاحظات المعلم</th>
                <th>الواجب</th>
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
                  <td style={{ maxWidth: '200px', whiteSpace: 'pre-wrap', fontSize: '0.9em' }}>
                    {achievement.teacherNotes || '-'}
                  </td>
                  <td>
                    {achievement.assignmentSurah || achievement.assignmentFromAya ? (
                      <>
                        {achievement.assignmentSurah && <div><strong>{achievement.assignmentSurah}</strong></div>}
                        {achievement.assignmentFromAya && achievement.assignmentToAya && (
                          <div>{achievement.assignmentFromAya} - {achievement.assignmentToAya}</div>
                        )}
                      </>
                    ) : '-'}
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
