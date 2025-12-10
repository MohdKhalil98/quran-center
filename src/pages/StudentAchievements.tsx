import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/StudentAchievements.css';
import curriculum, { Level, Part, Surah } from '../data/curriculumData';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';

interface StudentAchievement {
  id?: string;
  studentId: string;
  studentName?: string;
  portion: string;
  fromAya: string;
  toAya: string;
  rating: number;
  notes?: string;
  assignmentPortion?: string;
  assignmentFromAya: string;
  assignmentToAya: string;
  date: string;
}

const StudentAchievements = () => {
  const { userProfile, isTeacher } = useAuth();
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
    notes: '',
    assignmentPortion: '',
    assignmentFromAya: '',
    assignmentToAya: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [availableSurahs, setAvailableSurahs] = useState<Surah[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [selectedAssignmentSurah, setSelectedAssignmentSurah] = useState<Surah | null>(null);
  const [teacherGroups, setTeacherGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [groupStudents, setGroupStudents] = useState<any[]>([]);

  // Fetch teacher's groups first
  useEffect(() => {
    const fetchTeacherGroups = async () => {
      if (!isTeacher || !userProfile?.uid) return;
      
      try {
        const groupsQuery = query(
          collection(db, 'groups'),
          where('teacherId', '==', userProfile.uid)
        );
        const groupsSnapshot = await getDocs(groupsQuery);
        const groups = groupsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTeacherGroups(groups);
        
        // Auto-select first group if only one
        if (groups.length === 1) {
          setSelectedGroupId(groups[0].id);
        }
      } catch (error) {
        console.error('Error fetching teacher groups:', error);
      }
    };

    fetchTeacherGroups();
  }, [isTeacher, userProfile?.uid]);

  // Fetch students when group is selected (for teachers)
  useEffect(() => {
    const fetchGroupStudents = async () => {
      if (!isTeacher || !selectedGroupId) {
        setGroupStudents([]);
        return;
      }

      try {
        const studentsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('status', '==', 'approved'),
          where('groupId', '==', selectedGroupId)
        );
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
        
        // Sort by name
        studentsList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
        setGroupStudents(studentsList);
      } catch (error) {
        console.error('Error fetching group students:', error);
      }
    };

    fetchGroupStudents();
  }, [isTeacher, selectedGroupId]);

  // Fetch achievements and all students from Firebase (for display and non-teachers)
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all approved students for achievements display
        let studentsList: any[] = [];
        
        if (isTeacher && teacherGroups.length > 0) {
          // Teacher sees only students in their groups
          const groupIds = teacherGroups.map(g => g.id);
          const groupBatches = [];
          for (let i = 0; i < groupIds.length; i += 10) {
            groupBatches.push(groupIds.slice(i, i + 10));
          }
          
          for (const batch of groupBatches) {
            const studentsQuery = query(
              collection(db, 'users'),
              where('role', '==', 'student'),
              where('status', '==', 'approved'),
              where('groupId', 'in', batch)
            );
            const studentsSnapshot = await getDocs(studentsQuery);
            const batchStudents = studentsSnapshot.docs.map((doc) => {
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
            studentsList = [...studentsList, ...batchStudents];
          }
        } else if (!isTeacher) {
          // Admin/Supervisor - fetch all approved students
          const studentsQuery = query(
            collection(db, 'users'),
            where('role', '==', 'student'),
            where('status', '==', 'approved')
          );
          const studentsSnapshot = await getDocs(studentsQuery);
          studentsList = studentsSnapshot.docs.map((doc) => {
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
        }

        // Sort by name
        studentsList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));

        // Fetch achievements
        const achievementsQuery = query(collection(db, 'student_achievements'), orderBy('date', 'desc'));
        const achievementsSnapshot = await getDocs(achievementsQuery);
        const achievementsList = achievementsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        } as StudentAchievement));

        // Filter achievements to only show those for students the user can see
        const studentIds = new Set(studentsList.map(s => s.id));
        const filteredAchievements = achievementsList.filter(a => studentIds.has(a.studentId));

        // Attach student names to achievements
        const achievementsWithNames = filteredAchievements.map((achievement) => ({
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

    // Wait for teacher groups to load if teacher
    if (isTeacher && teacherGroups.length === 0) {
      return;
    }
    
    fetchData();
  }, [isTeacher, teacherGroups]);

  // Handle group selection
  const handleGroupSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const groupId = e.target.value;
    setSelectedGroupId(groupId);
    // Reset student selection when group changes
    setFormData(prev => ({ ...prev, studentId: '', portion: '', fromAya: '', toAya: '', assignmentPortion: '', assignmentFromAya: '', assignmentToAya: '' }));
    setSelectedStudent(null);
    setSelectedSurah(null);
    setSelectedAssignmentSurah(null);
    setAvailableSurahs([]);
  };

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
    setSelectedStudent(student);
    setFormData((prev) => ({ ...prev, studentId, portion: '', fromAya: '', toAya: '', assignmentPortion: '', assignmentFromAya: '', assignmentToAya: '' }));
    setSelectedSurah(null);
    setSelectedAssignmentSurah(null);
    if (student) {
      const level = curriculum.find((l: Level) => l.id === (student.levelId || 1));
      const parts = level?.parts || [];
      // استخدام جزء الطالب المحفوظ
      const studentPart = parts.find((p: Part) => p.id === student.partId) || parts[0];
      setAvailableSurahs(studentPart?.surahs || []);
    } else {
      setAvailableSurahs([]);
    }
  };

  const handleSurahChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const surahName = e.target.value;
    const surah = availableSurahs.find((s: Surah) => s.name === surahName);
    setSelectedSurah(surah || null);
    setFormData((prev) => ({ ...prev, portion: surahName, fromAya: '', toAya: '' }));
  };

  const handleAssignmentSurahChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const surahName = e.target.value;
    const surah = availableSurahs.find((s: Surah) => s.name === surahName);
    setSelectedAssignmentSurah(surah || null);
    setFormData((prev) => ({ ...prev, assignmentPortion: surahName, assignmentFromAya: '', assignmentToAya: '' }));
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
        notes: '',
        assignmentPortion: '',
        assignmentFromAya: '',
        assignmentToAya: '',
        date: new Date().toISOString().split('T')[0]
      });
      setSelectedStudent(null);
      setSelectedSurah(null);
      setSelectedAssignmentSurah(null);
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
    setSelectedStudent(student);
    if (student) {
      const level = curriculum.find((l: Level) => l.id === (student.levelId || 1));
      const parts = level?.parts || [];
      // استخدام جزء الطالب المحفوظ
      const studentPart = parts.find((p: Part) => p.id === student.partId) || parts[0];
      const surahs = studentPart?.surahs || [];
      setAvailableSurahs(surahs);
      const surah = surahs.find((s: Surah) => s.name === achievement.portion);
      setSelectedSurah(surah || null);
      setSelectedAssignmentSurah(surah || null);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setSelectedStudent(null);
    setSelectedSurah(null);
    setSelectedAssignmentSurah(null);
    setFormData({
      studentId: '',
      portion: '',
      fromAya: '',
      toAya: '',
      rating: 5,
      notes: '',
      assignmentPortion: '',
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

      {/* نموذج التسجيل - يظهر دائماً */}
      <form className="form-card" onSubmit={handleAddAchievement}>
        <h3>{editingId ? 'تعديل التحصيل' : 'تسجيل تحصيل جديد'}</h3>
        
        {/* اختيار الحلقة للمعلم */}
        {isTeacher && teacherGroups.length > 0 && (
          <div className="form-group">
            <label htmlFor="groupSelect">الحلقة *</label>
            <select
              id="groupSelect"
              name="groupSelect"
              value={selectedGroupId}
              onChange={handleGroupSelect}
              required
            >
              <option value="">اختر الحلقة</option>
              {teacherGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="studentId">الطالب *</label>
          <select
            id="studentId"
            name="studentId"
            value={formData.studentId}
            onChange={handleStudentSelect}
            required
            disabled={isTeacher && !selectedGroupId}
          >
            <option value="">{isTeacher && !selectedGroupId ? 'اختر الحلقة أولاً' : 'اختر الطالب'}</option>
            {(isTeacher ? groupStudents : students).map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </div>

        {/* عرض مستوى الطالب والورد المطلوب */}
        {selectedStudent && (
          <div className="student-level-section">
            <div className="level-info-box">
              <h4>📚 مستوى الطالب</h4>
              <div className="level-details">
                <span className="level-badge">{selectedStudent.levelName || 'المستوى الأول'}</span>
                {selectedStudent.partName && (
                  <span className="part-badge">{selectedStudent.partName}</span>
                )}
              </div>
            </div>
            
            <div className="required-portion-section">
              <h4>📖 الورد المطلوب</h4>
              {availableSurahs.length > 0 && (
                <div className="form-group">
                  <label htmlFor="surahSelect">السورة *</label>
                  <select id="surahSelect" name="surahSelect" onChange={handleSurahChange} value={formData.portion} required>
                    <option value="">اختر السورة</option>
                    {availableSurahs.map((s: Surah) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.verses} آية)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {selectedSurah && (
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="fromAya">من آية *</label>
                    <input
                      type="number"
                      id="fromAya"
                      name="fromAya"
                      placeholder="1"
                      min="1"
                      max={selectedSurah.verses}
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
                      placeholder={selectedSurah.verses.toString()}
                      min="1"
                      max={selectedSurah.verses}
                      value={formData.toAya}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ملاحظات المعلم - تظهر بعد اختيار السورة */}
        {selectedSurah && (
          <>
            <div className="form-group">
              <label htmlFor="notes">ملاحظات المعلم</label>
              <textarea
                id="notes"
                name="notes"
                placeholder="أضف ملاحظاتك هنا..."
                value={formData.notes || ''}
                onChange={handleInputChange}
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="rating">تقييم الطالب (1-10) *</label>
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

            <div className="assignment-section">
              <h4>📝 الواجب المطلوب</h4>
              {availableSurahs.length > 0 && (
                <div className="form-group">
                  <label htmlFor="assignmentSurahSelect">السورة</label>
                  <select 
                    id="assignmentSurahSelect" 
                    name="assignmentSurahSelect" 
                    onChange={handleAssignmentSurahChange}
                    value={selectedAssignmentSurah?.name || ''}
                  >
                    <option value="">اختر السورة</option>
                    {availableSurahs.map((s: Surah) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.verses} آية)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {selectedAssignmentSurah && (
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="assignmentFromAya">من آية</label>
                    <input
                      type="number"
                      id="assignmentFromAya"
                      name="assignmentFromAya"
                      placeholder="1"
                      min="1"
                      max={selectedAssignmentSurah.verses}
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
                      placeholder={selectedAssignmentSurah.verses.toString()}
                      min="1"
                      max={selectedAssignmentSurah.verses}
                      value={formData.assignmentToAya}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              )}
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
          </>
        )}

          <div className="form-actions">
            <button type="submit" className="btn btn-success" disabled={!selectedSurah}>
              {editingId ? 'تحديث' : 'حفظ'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                إلغاء التعديل
              </button>
            )}
          </div>
        </form>

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
