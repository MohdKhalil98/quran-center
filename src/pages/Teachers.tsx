import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth, UserProfile } from '../context/AuthContext';
import '../styles/Shared.css';
import '../styles/Teachers.css';

interface TeacherUser extends UserProfile {
  groupIds?: string[];
  groupNames?: string;
  centerName?: string;
  groupsCount?: number;
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

const Teachers = () => {
  const { userProfile, isSupervisor, isAdmin } = useAuth();
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherUser | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [filterCenterId, setFilterCenterId] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, [isSupervisor, userProfile]);

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

      // Fetch teachers from users collection (role = teacher)
      let teachersQuery;
      if (isSupervisor && userProfile?.centerId) {
        teachersQuery = query(
          collection(db, 'users'),
          where('role', '==', 'teacher'),
          where('centerId', '==', userProfile.centerId)
        );
        setFilterCenterId(userProfile.centerId);
      } else {
        teachersQuery = query(
          collection(db, 'users'),
          where('role', '==', 'teacher')
        );
      }
      
      const snapshot = await getDocs(teachersQuery);
      const teachersList = snapshot.docs.map((doc) => {
        const data = doc.data() as TeacherUser;
        // حساب عدد الحلقات لكل معلم
        const teacherGroups = groupsList.filter(g => g.teacherId === data.uid);
        const groupNames = teacherGroups.map(g => g.name).join(', ');
        
        return {
          ...data,
          groupNames: groupNames || 'لا يوجد',
          groupsCount: teacherGroups.length,
          centerName: centersList.find(c => c.id === data.centerId)?.name || ''
        } as TeacherUser;
      });
      
      setTeachers(teachersList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const handleToggleStatus = async (teacher: TeacherUser) => {
    try {
      await updateDoc(doc(db, 'users', teacher.uid), {
        active: !teacher.active
      });
      fetchData();
    } catch (error) {
      console.error('Error updating teacher:', error);
      alert('حدث خطأ أثناء تحديث حالة المعلم');
    }
  };

  const handleOpenDetailsModal = (teacher: TeacherUser) => {
    setSelectedTeacher(teacher);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setSelectedTeacher(null);
    setIsDetailsModalOpen(false);
  };

  // فلترة المعلمين
  const filteredTeachers = teachers.filter(t => 
    !filterCenterId || t.centerId === filterCenterId
  );

  if (loading) {
    return (
      <section className="page">
        <header className="page__header">
          <h1>المعلمون</h1>
        </header>
        <p>جاري تحميل البيانات...</p>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1>المعلمون</h1>
        <p>عرض بيانات المعلمين.</p>
      </header>

      <div className="page-actions-header">
        {isAdmin && (
          <p className="info-note">💡 لإضافة معلم جديد، اذهب إلى صفحة "مراكز القرآن" واختر المركز ثم أضف المعلم</p>
        )}
        {isSupervisor && (
          <p className="info-note">💡 لإضافة معلم جديد، يرجى التواصل مع مدير النظام</p>
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

      {viewMode === 'cards' ? (
        <div className="cards-container">
          {filteredTeachers.length === 0 ? (
            <p className="empty-state">لا يوجد معلمون حتى الآن</p>
          ) : (
            filteredTeachers.map((teacher) => (
              <article key={teacher.uid} className="data-card">
                <header className="data-card-header">
                  <div>
                    <h3>{teacher.name}</h3>
                    <p className="data-card-id">{teacher.email}</p>
                  </div>
                  <div className="data-card-tag">
                    <span className={teacher.active ? 'active' : 'inactive'}>
                      {teacher.active ? 'نشط' : 'معطل'}
                    </span>
                  </div>
                </header>
                <section className="data-card-body">
                  <div className="data-card-row">
                    <label>رقم الهاتف:</label>
                    <span>{teacher.phone || '-'}</span>
                  </div>
                  <div className="data-card-row">
                    <label>المركز:</label>
                    <span>{teacher.centerName || '-'}</span>
                  </div>
                  <div className="data-card-row">
                    <label>الحلقات:</label>
                    <span className="tag-cell">{teacher.groupNames}</span>
                  </div>
                </section>
                <footer className="data-card-actions">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleOpenDetailsModal(teacher)}
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
          {filteredTeachers.length === 0 ? (
            <p>لا يوجد معلمون حتى الآن</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>البريد الإلكتروني</th>
                  <th>رقم الهاتف</th>
                  <th>المركز</th>
                  <th>الحلقات</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.uid}>
                    <td>{teacher.name}</td>
                    <td>{teacher.email}</td>
                    <td>{teacher.phone || '-'}</td>
                    <td>{teacher.centerName || '-'}</td>
                    <td className="tag-cell">{teacher.groupNames}</td>
                    <td>
                      <span className={`status-badge ${teacher.active ? 'active' : 'inactive'}`}>
                        {teacher.active ? 'نشط' : 'معطل'}
                      </span>
                    </td>
                    <td>
                      <div className="card-actions">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleOpenDetailsModal(teacher)}
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

      {isDetailsModalOpen && selectedTeacher && (
        <div className="modal-overlay" onClick={handleCloseDetailsModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تفاصيل المعلم: {selectedTeacher.name}</h2>
              <button className="close-btn" onClick={handleCloseDetailsModal}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="details-list">
                <p><strong>البريد الإلكتروني:</strong> {selectedTeacher.email}</p>
                <p><strong>رقم الهاتف:</strong> {selectedTeacher.phone || '-'}</p>
                <p><strong>المركز:</strong> {selectedTeacher.centerName || 'غير محدد'}</p>
                <p><strong>الحلقات:</strong> <span className="tag-cell">{selectedTeacher.groupNames}</span></p>
                <p><strong>عدد الحلقات:</strong> {selectedTeacher.groupsCount}</p>
                <p><strong>الحالة:</strong> {selectedTeacher.active ? 'نشط' : 'معطل'}</p>
                <p><strong>تاريخ الإنشاء:</strong> {new Date(selectedTeacher.createdAt).toLocaleDateString('ar-EG')}</p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className={`btn ${selectedTeacher.active ? 'btn-warning' : 'btn-success'}`}
                onClick={() => {
                  handleToggleStatus(selectedTeacher);
                  handleCloseDetailsModal();
                }}
              >
                {selectedTeacher.active ? '⏸️ إيقاف' : '▶️ تفعيل'}
              </button>
              <button className="btn btn-secondary" onClick={handleCloseDetailsModal}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Teachers;
