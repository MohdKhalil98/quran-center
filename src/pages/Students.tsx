import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth, UserProfile } from '../context/AuthContext';
import quranCurriculum from '../data/quranCurriculum';
import '../styles/Shared.css';
import '../styles/Students.css';

interface StudentUser extends UserProfile {
  groupName?: string;
  centerName?: string;
}

interface Center {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  teacherId?: string;
}

interface Level {
  id: string;
  name: string;
}

interface Stage {
  id: string;
  name: string;
}

const Students = () => {
  const { userProfile, isSupervisor, isAdmin, isTeacher } = useAuth();
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [newStudents, setNewStudents] = useState<StudentUser[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [teacherGroupIds, setTeacherGroupIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedStudent, setSelectedStudent] = useState<StudentUser | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [filterCenterId, setFilterCenterId] = useState<string>('');
  const [filterGroupId, setFilterGroupId] = useState<string>('');
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [selectedNewStudent, setSelectedNewStudent] = useState<StudentUser | null>(null);
  const [selectedLevelId, setSelectedLevelId] = useState('');

  useEffect(() => {
    fetchData();
  }, [isSupervisor, isTeacher, userProfile]);

  const fetchData = async () => {
    try {
      // Fetch centers
      const centersSnapshot = await getDocs(collection(db, 'centers'));
      const centersList = centersSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name
      }));
      setCenters(centersList);

      // Fetch groups
      const groupsQuery = query(collection(db, 'groups'), orderBy('name'));
      const groupsSnapshot = await getDocs(groupsQuery);
      const groupsList = groupsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        teacherId: doc.data().teacherId
      }));
      setGroups(groupsList);

      // Get teacher's group IDs if teacher
      let myGroupIds: string[] = [];
      if (isTeacher && userProfile?.uid) {
        myGroupIds = groupsList
          .filter(g => g.teacherId === userProfile.uid)
          .map(g => g.id);
        setTeacherGroupIds(myGroupIds);
      }

      // Fetch students from users collection (role = student, status = approved)
      // جلب جميع الطلاب المعتمدين ثم تصفيتهم في الكود (لتجنب الحاجة إلى indexes معقدة)
      const studentsQuery = query(
        collection(db, 'users'),
        where('role', '==', 'student'),
        where('status', '==', 'approved')
      );
      
      const snapshot = await getDocs(studentsQuery);
      let studentsList = snapshot.docs.map((doc) => {
        const data = doc.data() as StudentUser;
        return {
          ...data,
          groupName: groupsList.find(g => g.id === data.groupId)?.name || 'غير محدد',
          centerName: centersList.find(c => c.id === data.centerId)?.name || ''
        } as StudentUser;
      });
      
      // تصفية الطلاب حسب الدور
      if (isTeacher && myGroupIds.length > 0) {
        // المعلم يرى فقط طلاب حلقاته
        studentsList = studentsList.filter(s => myGroupIds.includes(s.groupId || ''));
      } else if (isSupervisor && userProfile?.centerId) {
        // المشرف يرى طلاب مركزه
        studentsList = studentsList.filter(s => s.centerId === userProfile.centerId);
        setFilterCenterId(userProfile.centerId);
      }
      // المطور يرى جميع الطلاب (بدون تصفية)
      
      setStudents(studentsList);

      // Fetch new students (waiting for teacher approval) for teachers only
      if (isTeacher && myGroupIds.length > 0) {
        // جلب جميع الطلاب الجدد ثم تصفيتهم في الكود (لتجنب الحاجة إلى index معقد)
        const newStudentsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('status', '==', 'waiting_teacher_approval')
        );
        const newStudentsSnapshot = await getDocs(newStudentsQuery);
        
        const newStudentsList = newStudentsSnapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as StudentUser;
            return {
              ...data,
              uid: docSnap.id, // استخدام Document ID من Firestore
              groupName: groupsList.find(g => g.id === data.groupId)?.name || 'غير محدد',
              centerName: centersList.find(c => c.id === data.centerId)?.name || ''
            } as StudentUser;
          })
          // تصفية الطلاب الذين في حلقات المعلم فقط
          .filter(student => myGroupIds.includes(student.groupId || ''));
        setNewStudents(newStudentsList);

        // جلب المستويات من منهج القرآن (الأجزاء من 1 إلى 30)
        const levelsList = quranCurriculum.map((juz) => ({
          id: juz.id,
          name: juz.name
        }));
        setLevels(levelsList);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const handleToggleStatus = async (student: StudentUser) => {
    try {
      await updateDoc(doc(db, 'users', student.uid), {
        active: !student.active
      });
      fetchData();
    } catch (error) {
      console.error('Error updating student:', error);
      alert('حدث خطأ أثناء تحديث حالة الطالب');
    }
  };

  const handleOpenDetailsModal = (student: StudentUser) => {
    setSelectedStudent(student);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setSelectedStudent(null);
    setIsDetailsModalOpen(false);
  };

  const handleOpenLevelModal = (student: StudentUser) => {
    setSelectedNewStudent(student);
    setShowLevelModal(true);
  };

  const handleCloseLevelModal = () => {
    setSelectedNewStudent(null);
    setShowLevelModal(false);
    setSelectedLevelId('');
  };

  const handleDeleteNewStudent = async (student: StudentUser) => {
    if (!window.confirm(`هل أنت متأكد من حذف الطالب ${student.name} من قائمة الانتظار؟`)) {
      return;
    }

    try {
      // حذف الطالب من Firebase
      await updateDoc(doc(db, 'users', student.uid), {
        status: 'rejected'
      });

      // إزالة فورية من الـ state
      setNewStudents(prev => prev.filter(s => s.uid !== student.uid));
      
      alert('تم حذف الطالب من قائمة الانتظار');
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('حدث خطأ أثناء حذف الطالب');
    }
  };

  const handleApproveNewStudent = async () => {
    if (!selectedNewStudent || !selectedLevelId) {
      alert('يرجى اختيار المستوى');
      return;
    }

    if (!selectedNewStudent.uid) {
      alert('خطأ: لا يوجد معرف للطالب');
      return;
    }

    try {
      // الحصول على المرحلة الأولى من المنهج المحلي
      const selectedLevelData = quranCurriculum.find(juz => juz.id === selectedLevelId);
      
      if (!selectedLevelData || !selectedLevelData.surahs || selectedLevelData.surahs.length === 0) {
        alert('لا توجد مراحل لهذا المستوى');
        return;
      }

      const firstStage = selectedLevelData.surahs[0];
      const selectedLevel = levels.find(l => l.id === selectedLevelId);

      // تحديث حالة الطالب وتعيين المستوى الابتدائي
      await updateDoc(doc(db, 'users', selectedNewStudent.uid), {
        status: 'approved',
        levelId: selectedLevelId,
        levelName: selectedLevel?.name || '',
        stageId: firstStage.id,
        stageName: firstStage.name,
        approvedByTeacherAt: new Date().toISOString()
      });

      // تحديث فوري للـ state - إزالة الطالب من قائمة الطلاب الجدد
      setNewStudents(prev => prev.filter(s => s.uid !== selectedNewStudent.uid));
      
      // إضافة الطالب إلى قائمة الطلاب الرسميين مع جميع البيانات المطلوبة
      const groupsList = groups; // جلب الحلقات المحفوظة
      const centersList = centers; // جلب المراكز المحفوظة
      
      setStudents(prev => [...prev, {
        ...selectedNewStudent,
        status: 'approved',
        levelId: selectedLevelId,
        levelName: selectedLevel?.name || '',
        stageId: firstStage.id,
        stageName: firstStage.name,
        groupName: groupsList.find(g => g.id === selectedNewStudent.groupId)?.name || 'غير محدد',
        centerName: centersList.find(c => c.id === selectedNewStudent.centerId)?.name || ''
      }]);

      alert('تم قبول الطالب وتعيين المستوى بنجاح');
      handleCloseLevelModal();
      
      // تحديث البيانات من Firebase للتأكد من التزامن
      setTimeout(() => {
        fetchData();
      }, 500);
    } catch (error) {
      console.error('Error approving new student:', error);
      alert('حدث خطأ أثناء قبول الطالب');
    }
  };

  // فلترة الطلاب
  const filteredStudents = students.filter(s => {
    if (filterCenterId && s.centerId !== filterCenterId) return false;
    if (filterGroupId && s.groupId !== filterGroupId) return false;
    return true;
  });

  // الحلقات المتاحة للفلتر
  const availableGroups = isTeacher 
    ? groups.filter(g => teacherGroupIds.includes(g.id))
    : groups;

  if (loading) {
    return (
      <section className="page">
        <header className="page__header">
          <h1>{isTeacher ? 'طلابي' : 'الطلاب'}</h1>
        </header>
        <p>جاري تحميل البيانات...</p>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1>{isTeacher ? 'طلابي' : 'الطلاب'}</h1>
        <p>{isTeacher ? 'عرض طلاب حلقاتي.' : 'عرض بيانات الطلاب المسجلين.'}</p>
      </header>

      <div className="page-actions-header">
        {!isTeacher && (
          <p className="info-note">💡 الطلاب يسجلون أنفسهم من صفحة التسجيل، ويتم قبولهم من صفحة "طلبات الانتظار"</p>
        )}

        <div className="filters-section">
          {isAdmin && (
            <select 
              className="filter-select"
              value={filterCenterId} 
              onChange={(e) => setFilterCenterId(e.target.value)}
            >
              <option value="">جميع المراكز</option>
              {centers.map(center => (
                <option key={center.id} value={center.id}>{center.name}</option>
              ))}
            </select>
          )}
          {availableGroups.length > 1 && (
            <select 
              className="filter-select"
              value={filterGroupId} 
              onChange={(e) => setFilterGroupId(e.target.value)}
            >
              <option value="">{isTeacher ? 'جميع حلقاتي' : 'جميع الحلقات'}</option>
              {availableGroups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="view-mode-toggle">
          <button 
            className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
            onClick={() => setViewMode('cards')}
            title="عرض البطاقات"
          >
            📇 البطاقات
          </button>
          <button 
            className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
            title="عرض الجدول"
          >
            📋 الجدول
          </button>
        </div>
      </div>

      <div className="students-count-bar">
        <span className="count-badge">{filteredStudents.length}</span> طالب
      </div>

      {/* قسم الطلاب الجدد - للمعلمين فقط */}
      {isTeacher && newStudents.length > 0 && (
        <>
          <div className="section-header">
            <h2>📥 الطلاب الجدد (بانتظار تحديد المستوى)</h2>
          </div>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>رقم الهاتف</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {newStudents.map((student) => (
                  <tr key={student.uid}>
                    <td>{student.name}</td>
                    <td>{student.phone || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleOpenLevelModal(student)}
                        >
                          ✅ قبول وتحديد المستوى
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteNewStudent(student)}
                        >
                          🗑️ حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <hr style={{ margin: '30px 0', borderColor: '#e0e0e0' }} />
        </>
      )}

      {viewMode === 'cards' ? (
        <div className="cards-container">
          {filteredStudents.length === 0 ? (
            <p className="empty-state">لا يوجد طلاب حتى الآن</p>
          ) : (
            filteredStudents.map((student) => (
              <article key={student.uid} className="data-card">
                <header className="data-card-header">
                  <div>
                    <h3>{student.name}</h3>
                    <p className="data-card-id">{student.email}</p>
                  </div>
                  <div className="data-card-tag">
                    <span className={student.active ? 'active' : 'inactive'}>
                      {student.active ? 'نشط' : 'معطل'}
                    </span>
                  </div>
                </header>
                <section className="data-card-body">
                  <div className="data-card-row">
                    <label>رقم الهاتف:</label>
                    <span>{student.phone || '-'}</span>
                  </div>
                  <div className="data-card-row">
                    <label>الحلقة:</label>
                    <span>{student.groupName}</span>
                  </div>
                  {!isTeacher && (
                    <div className="data-card-row">
                      <label>المركز:</label>
                      <span>{student.centerName || '-'}</span>
                    </div>
                  )}
                </section>
                <footer className="data-card-actions">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleOpenDetailsModal(student)}
                  >
                    المزيد
                  </button>
                </footer>
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="table-card">
          {filteredStudents.length === 0 ? (
            <p>لا يوجد طلاب حتى الآن</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>البريد الإلكتروني</th>
                  <th>رقم الهاتف</th>
                  <th>الحلقة</th>
                  {!isTeacher && <th>المركز</th>}
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.uid}>
                    <td>{student.name}</td>
                    <td>{student.email}</td>
                    <td>{student.phone || '-'}</td>
                    <td>{student.groupName}</td>
                    {!isTeacher && <td>{student.centerName || '-'}</td>}
                    <td>
                      <span className={`status-badge ${student.active ? 'active' : 'inactive'}`}>
                        {student.active ? 'نشط' : 'معطل'}
                      </span>
                    </td>
                    <td>
                      <div className="card-actions">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleOpenDetailsModal(student)}
                        >
                          المزيد
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {isDetailsModalOpen && selectedStudent && (
        <div className="modal-overlay" onClick={handleCloseDetailsModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تفاصيل الطالب: {selectedStudent.name}</h2>
              <button className="close-btn" onClick={handleCloseDetailsModal}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="details-list">
                <p><strong>البريد الإلكتروني:</strong> {selectedStudent.email}</p>
                <p><strong>رقم الهاتف:</strong> {selectedStudent.phone || '-'}</p>
                <p><strong>الحلقة:</strong> {selectedStudent.groupName}</p>
                <p><strong>المركز:</strong> {selectedStudent.centerName || 'غير محدد'}</p>
                <p><strong>الحالة:</strong> {selectedStudent.active ? 'نشط' : 'معطل'}</p>
                <p><strong>تاريخ التسجيل:</strong> {new Date(selectedStudent.createdAt).toLocaleDateString('ar-EG')}</p>
              </div>
            </div>
            <div className="modal-footer">
              {!isTeacher && (
                <button
                  className={`btn ${selectedStudent.active ? 'btn-warning' : 'btn-success'}`}
                  onClick={() => {
                    handleToggleStatus(selectedStudent);
                    handleCloseDetailsModal();
                  }}
                >
                  {selectedStudent.active ? '⏸️ إيقاف' : '▶️ تفعيل'}
                </button>
              )}
              <button className="btn btn-secondary" onClick={handleCloseDetailsModal}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تحديد المستوى للطلاب الجدد */}
      {showLevelModal && selectedNewStudent && (
        <div className="modal-overlay" onClick={handleCloseLevelModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تحديد المستوى للطالب: {selectedNewStudent.name}</h2>
              <button className="close-btn" onClick={handleCloseLevelModal}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>الحلقة:</label>
                <p className="info-text">{selectedNewStudent.groupName}</p>
              </div>
              <div className="form-group">
                <label>اختر المستوى الحالي للطالب:</label>
                <select
                  className="form-control"
                  value={selectedLevelId}
                  onChange={(e) => setSelectedLevelId(e.target.value)}
                >
                  <option value="">-- اختر المستوى --</option>
                  {levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
                <small className="help-text">
                  💡 سيتم البدء من المرحلة الأولى في المستوى المحدد
                </small>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-success"
                onClick={handleApproveNewStudent}
                disabled={!selectedLevelId}
              >
                ✅ قبول الطالب
              </button>
              <button className="btn btn-secondary" onClick={handleCloseLevelModal}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Students;

