import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import MessageBox from '../components/MessageBox';
import '../styles/StudentAchievements.css';
import '../styles/TeacherAchievementRecords.css';

interface Achievement {
  id: string;
  studentId: string;
  studentName?: string;
  portion?: string;
  fromAya?: string;
  toAya?: string;
  rating?: number;
  notes?: string;
  date: string;
  challengeType?: string;
  challengeContent?: string;
  challengePassed?: boolean;
  points?: number;
  levelName?: string;
  stageName?: string;
  track?: string;
}

interface Group {
  id: string;
  name: string;
}

const TeacherAchievementRecords = () => {
  const { userProfile, isTeacher } = useAuth();
  const [loading, setLoading] = useState(true);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [studentMap, setStudentMap] = useState<Map<string, { name: string; groupId: string }>>(new Map());

  // Filters
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterStudent, setFilterStudent] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Sorting
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Delete
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmMessage, setConfirmMessage] = useState('');
  const [messageBox, setMessageBox] = useState<{ show: boolean; type: 'success' | 'error' | 'info'; message: string }>({ show: false, type: 'info', message: '' });

  const showMessage = (type: 'success' | 'error' | 'info', message: string) => {
    setMessageBox({ show: true, type, message });
  };

  useEffect(() => {
    if (!userProfile?.uid) return;
    fetchData();
  }, [userProfile?.uid]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch teacher's groups
      const groupsQuery = query(collection(db, 'groups'), where('teacherId', '==', userProfile!.uid));
      const groupsSnap = await getDocs(groupsQuery);
      const teacherGroups = groupsSnap.docs.map(d => ({ id: d.id, name: d.data().name } as Group));
      setGroups(teacherGroups);

      if (teacherGroups.length === 0) {
        setLoading(false);
        return;
      }

      const groupIds = teacherGroups.map(g => g.id);

      // Fetch students in these groups
      const sMap = new Map<string, { name: string; groupId: string }>();
      for (let i = 0; i < groupIds.length; i += 10) {
        const batch = groupIds.slice(i, i + 10);
        const sq = query(collection(db, 'users'), where('role', '==', 'student'), where('groupId', 'in', batch));
        const ss = await getDocs(sq);
        ss.docs.forEach(d => {
          const data = d.data();
          sMap.set(d.id, { name: data.name || '', groupId: data.groupId || '' });
        });
      }
      setStudentMap(sMap);

      // Fetch achievements for these students
      const studentIds = Array.from(sMap.keys());
      const allAchievements: Achievement[] = [];

      for (let i = 0; i < studentIds.length; i += 10) {
        const batch = studentIds.slice(i, i + 10);
        const aq = query(
          collection(db, 'student_achievements'),
          where('studentId', 'in', batch)
        );
        const as_ = await getDocs(aq);
        as_.docs.forEach(d => {
          allAchievements.push({ id: d.id, ...d.data() } as Achievement);
        });
      }

      // Sort by date descending
      allAchievements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAchievements(allAchievements);
    } catch (error) {
      console.error('Error fetching achievement records:', error);
    }
    setLoading(false);
  };

  const handleDeleteClick = (achievementId: string) => {
    setConfirmMessage('هل أنت متأكد من حذف هذا السجل؟');
    setConfirmAction(() => async () => {
      try {
        await deleteDoc(doc(db, 'student_achievements', achievementId));
        setAchievements(prev => prev.filter(a => a.id !== achievementId));
        showMessage('success', 'تم حذف السجل بنجاح');
      } catch (error) {
        console.error('Error deleting achievement:', error);
        showMessage('error', 'حدث خطأ أثناء حذف السجل');
      }
    });
    setShowConfirmModal(true);
  };

  const getTypeLabel = (type?: string) => {
    switch (type) {
      case 'memorization': return 'حفظ';
      case 'near_review': return 'مراجعة قريبة';
      case 'far_review': return 'مراجعة بعيدة';
      case 'arabic_lesson': return 'قراءة عربية';
      case 'stage_completion': return 'إتمام سورة';
      case 'level_completion': return 'إتمام مستوى';
      case 'arabic_level_completion': return 'إتمام مستوى عربي';
      default: return type || '-';
    }
  };

  // Get unique students for filter dropdown
  const uniqueStudents = Array.from(new Set(achievements.map(a => a.studentId)))
    .map(id => {
      const achievement = achievements.find(a => a.studentId === id);
      return { id, name: studentMap.get(id)?.name || achievement?.studentName || id };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  // Sorting
  const toggleSort = () => setSortDir(d => d === 'asc' ? 'desc' : 'asc');

  // Apply filters
  const filteredAchievements = achievements.filter(a => {
    // Group filter
    if (filterGroup !== 'all') {
      const studentInfo = studentMap.get(a.studentId);
      if (!studentInfo || studentInfo.groupId !== filterGroup) return false;
    }
    // Student filter
    if (filterStudent !== 'all' && a.studentId !== filterStudent) return false;
    // Type filter
    if (filterType !== 'all' && a.challengeType !== filterType) return false;
    // Date from
    if (filterDateFrom && new Date(a.date) < new Date(filterDateFrom + 'T00:00:00')) return false;
    // Date to
    if (filterDateTo && new Date(a.date) > new Date(filterDateTo + 'T23:59:59')) return false;
    // Search
    if (searchTerm.trim()) {
      const name = a.studentName || studentMap.get(a.studentId)?.name || '';
      if (!name.includes(searchTerm.trim()) && !(a.challengeContent || '').includes(searchTerm.trim())) return false;
    }
    return true;
  });

  // Sort filtered results
  const sortedAchievements = [...filteredAchievements].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return sortDir === 'desc' ? dateB - dateA : dateA - dateB;
  });

  if (!isTeacher) {
    return <p style={{ padding: 40, textAlign: 'center' }}>هذه الصفحة متاحة للمعلمين فقط</p>;
  }

  return (
    <section className="page achievement-records-page">
      {messageBox.show && (
        <MessageBox
          open={messageBox.show}
          type={messageBox.type}
          message={messageBox.message}
          onClose={() => setMessageBox({ ...messageBox, show: false })}
        />
      )}
      {showConfirmModal && (
        <ConfirmModal
          open={showConfirmModal}
          message={confirmMessage}
          onConfirm={() => { confirmAction(); setShowConfirmModal(false); }}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}

      <header className="page__header">
        <h1>سجل تحصيل الطلاب</h1>
        <p>متابعة جميع تسجيلات تحصيل طلاب حلقاتك</p>
      </header>

      {loading ? (
        <p style={{ textAlign: 'center', padding: 40 }}>جاري تحميل البيانات...</p>
      ) : (
        <>
          {/* Filters */}
          <div className="records-filters">
            <div className="records-filters-row">
              <div className="filter-item">
                <label>بحث:</label>
                <input
                  type="text"
                  placeholder="اسم الطالب أو المحتوى..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              {groups.length > 1 && (
                <div className="filter-item">
                  <label>المجموعة:</label>
                  <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
                    <option value="all">جميع المجموعات</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              )}
              <div className="filter-item">
                <label>الطالب:</label>
                <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)}>
                  <option value="all">جميع الطلاب</option>
                  {uniqueStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>النوع:</label>
                <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="all">جميع الأنواع</option>
                  <option value="memorization">حفظ</option>
                  <option value="near_review">مراجعة قريبة</option>
                  <option value="far_review">مراجعة بعيدة</option>
                  <option value="arabic_lesson">قراءة عربية</option>
                </select>
              </div>
              <div className="filter-item">
                <label>من تاريخ:</label>
                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
              </div>
              <div className="filter-item">
                <label>إلى تاريخ:</label>
                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
              </div>
            </div>
            <div className="records-summary">
              <span>{filteredAchievements.length} سجل</span>
              {(filterGroup !== 'all' || filterStudent !== 'all' || filterType !== 'all' || filterDateFrom || filterDateTo || searchTerm) && (
                <button className="btn-clear-filters" onClick={() => {
                  setFilterGroup('all');
                  setFilterStudent('all');
                  setFilterType('all');
                  setFilterDateFrom('');
                  setFilterDateTo('');
                  setSearchTerm('');
                }}>
                  مسح الفلاتر
                </button>
              )}
            </div>
          </div>

          {/* Records Table */}
          {filteredAchievements.length === 0 ? (
            <p className="no-data" style={{ padding: 40 }}>لا توجد سجلات</p>
          ) : (
            <div className="records-table-wrapper">
              <table className="achievements-table records-table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={toggleSort} style={{ cursor: 'pointer' }}>
                      التاريخ {sortDir === 'desc' ? '▼' : '▲'}
                    </th>
                    <th>الطالب</th>
                    <th>النوع</th>
                    <th>المحتوى</th>
                    <th>الآيات</th>
                    <th>التقييم</th>
                    <th>النتيجة</th>
                    <th>النقاط</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAchievements.map(a => (
                    <tr key={a.id} className={a.challengePassed ? 'passed' : 'failed'}>
                      <td>{new Date(a.date).toLocaleDateString('ar-SA')}</td>
                      <td className="student-name-cell">{a.studentName || studentMap.get(a.studentId)?.name || '-'}</td>
                      <td>{getTypeLabel(a.challengeType)}</td>
                      <td>{a.challengeContent || a.portion || '-'}</td>
                      <td>{a.fromAya && a.toAya ? `${a.fromAya} - ${a.toAya}` : '-'}</td>
                      <td>{a.rating || 0} / 10</td>
                      <td>
                        <span className={`badge ${a.challengePassed ? 'badge-success' : 'badge-danger'}`}>
                          {a.challengePassed ? 'ناجح' : 'إعادة'}
                        </span>
                      </td>
                      <td>{a.points || '-'}</td>
                      <td>
                        <button className="btn-delete-sm" onClick={() => handleDeleteClick(a.id)}>حذف</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default TeacherAchievementRecords;
