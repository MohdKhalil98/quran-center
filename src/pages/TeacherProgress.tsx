import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { arabicReadingCurriculum } from '../data/arabicReadingCurriculum';
import quranCurriculum from '../data/quranCurriculum';
import '../styles/StudentProgress.css';

interface Group {
  id: string;
  name: string;
  centerId: string;
  teacherId?: string;
}

interface StudentProgressItem {
  uid: string;
  name: string;
  levelName: string;
  stageName: string;
  completedLevels: number;
  totalPoints: number;
  progressPercent: number;
  groupName: string;
  trackType: string;
  isPending: boolean;
}

const TeacherProgress = () => {
  const { isTeacher, userProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [studentProgressList, setStudentProgressList] = useState<StudentProgressItem[]>([]);
  const [progressSearchTerm, setProgressSearchTerm] = useState<string>('');
  const [progressFilterGroup, setProgressFilterGroup] = useState<string>('all');
  const [progressFilterTrack, setProgressFilterTrack] = useState<string>('all');

  const [progressSortColumn, setProgressSortColumn] = useState<string>('progressPercent');
  const [progressSortDirection, setProgressSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (userProfile?.uid) {
      fetchData();
    }
  }, [userProfile?.uid]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. جلب مجموعات المعلم
      const gq = query(collection(db, 'groups'), where('teacherId', '==', userProfile!.uid));
      const gs = await getDocs(gq);
      const teacherGroups = gs.docs.map(d => ({ id: d.id, ...d.data() } as Group));
      setGroups(teacherGroups);

      if (teacherGroups.length === 0) {
        setStudentProgressList([]);
        setLoading(false);
        return;
      }

      // 2. جلب طلاب هذه المجموعات
      const groupIds = teacherGroups.map(g => g.id);
      const allStudentDocs: any[] = [];

      // Firestore 'in' supports max 10 values
      for (let i = 0; i < groupIds.length; i += 10) {
        const batch = groupIds.slice(i, i + 10);
        const sq = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('groupId', 'in', batch)
        );
        const ss = await getDocs(sq);
        allStudentDocs.push(...ss.docs);
      }

      // 3. بناء جدول تقدم الطلاب
      const progressList: StudentProgressItem[] = [];
      allStudentDocs.forEach(d => {
        const data = d.data();
        if (data.status !== 'approved') return;

        const group = teacherGroups.find(g => g.id === data.groupId);
        const trackType = data.trackType || 'quran';

        let progressPercent = 0;
        const levelName = data.levelName || 'لم يبدأ';
        const stageName = data.stageName || '-';

        if (data.stageStatus === 'pending_supervisor' || data.levelStatus === 'pending_supervisor') {
          progressPercent = 100;
        } else if (trackType === 'arabic_reading') {
          const arabicLevel = arabicReadingCurriculum.find(l => l.id === data.levelId);
          if (arabicLevel && data.stageId) {
            const lessonIndex = arabicLevel.lessons.findIndex(l => l.id === data.stageId);
            if (lessonIndex !== -1) {
              progressPercent = Math.round((lessonIndex / arabicLevel.lessons.length) * 100);
            }
          }
        } else {
          const quranLevel = quranCurriculum.find(j => j.id === data.levelId);
          if (quranLevel && data.stageId) {
            const stageIndex = quranLevel.surahs.findIndex(s => s.id === data.stageId);
            if (stageIndex !== -1) {
              progressPercent = Math.round((stageIndex / quranLevel.surahs.length) * 100);
            }
          }
        }

        if (data.levelStatus === 'completed' || data.completedCurriculum) {
          progressPercent = 100;
        }

        progressList.push({
          uid: d.id,
          name: data.name || 'غير محدد',
          levelName,
          stageName,
          completedLevels: data.completedLevels || 0,
          totalPoints: data.totalPoints || 0,
          progressPercent,
          groupName: group?.name || '-',
          trackType,
          isPending: data.stageStatus === 'pending_supervisor' || data.levelStatus === 'pending_supervisor',
        });
      });

      progressList.sort((a, b) => b.progressPercent - a.progressPercent);
      setStudentProgressList(progressList);
    } catch (error) {
      console.error('Error fetching teacher progress:', error);
    }
    setLoading(false);
  };

  const handleProgressSort = (column: string) => {
    if (progressSortColumn === column) {
      setProgressSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setProgressSortColumn(column);
      setProgressSortDirection('asc');
    }
  };

  const getProgressSortIcon = (column: string) => {
    if (progressSortColumn !== column) return ' ⇅';
    return progressSortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  if (!isTeacher) {
    return <p style={{ padding: 40, textAlign: 'center' }}>هذه الصفحة متاحة للمعلمين فقط</p>;
  }

  return (
    <section className="page student-progress-page">
      <header className="page__header">
        <h1>📊 تقدم الطلاب</h1>
        <p className="page__subtitle">متابعة تقدم طلاب حلقاتك في المنهج الدراسي</p>
      </header>

      {loading ? (
        <div className="sp-loading">
          <div className="sp-spinner"></div>
          <p>جاري تحميل بيانات التقدم...</p>
        </div>
      ) : (
        <div className="sp-progress-section">
          {(() => {
            const filteredList = studentProgressList.filter(s => {
              if (progressSearchTerm.trim()) {
                if (!s.name.toLowerCase().includes(progressSearchTerm.trim().toLowerCase())) return false;
              }
              if (progressFilterGroup !== 'all') {
                const groupName = groups.find(g => g.id === progressFilterGroup)?.name;
                if (s.groupName !== groupName) return false;
              }
              if (progressFilterTrack !== 'all') {
                if (s.trackType !== progressFilterTrack) return false;
              }
              return true;
            });

            const sortedList = [...filteredList].sort((a, b) => {
              let comparison = 0;
              switch (progressSortColumn) {
                case 'name':
                  comparison = a.name.localeCompare(b.name, 'ar');
                  break;
                case 'levelName':
                  comparison = a.levelName.localeCompare(b.levelName, 'ar');
                  break;
                case 'progressPercent':
                  comparison = a.progressPercent - b.progressPercent;
                  break;
                case 'totalPoints':
                  comparison = a.totalPoints - b.totalPoints;
                  break;
              }
              return progressSortDirection === 'asc' ? comparison : -comparison;
            });

            return (
              <>
                <div className="sp-progress-header">
                  <h2>📊 تقدم الطلاب في المنهج</h2>
                  <span className="sp-results-count">{filteredList.length} طالب</span>
                </div>

                <div className="sp-progress-filters">
                  <input
                    type="text"
                    className="sp-filter-input"
                    placeholder="ابحث باسم الطالب..."
                    value={progressSearchTerm}
                    onChange={e => setProgressSearchTerm(e.target.value)}
                  />
                  {groups.length > 1 && (
                    <select className="sp-filter-select" value={progressFilterGroup} onChange={e => setProgressFilterGroup(e.target.value)}>
                      <option value="all">جميع الحلقات</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  )}
                  <select className="sp-filter-select" value={progressFilterTrack} onChange={e => setProgressFilterTrack(e.target.value)}>
                    <option value="all">جميع المساقات</option>
                    <option value="quran">حفظ القرآن</option>
                    <option value="arabic_reading">القراءة العربية</option>
                  </select>
                </div>

                <div className="sp-table-container">
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th className="sp-sortable" onClick={() => handleProgressSort('name')}>اسم الطالب{getProgressSortIcon('name')}</th>
                        <th className="sp-sortable" onClick={() => handleProgressSort('levelName')}>المستوى الحالي{getProgressSortIcon('levelName')}</th>
                        <th>المرحلة / الدرس</th>
                        <th className="sp-sortable" onClick={() => handleProgressSort('progressPercent')}>نسبة إتمام المستوى{getProgressSortIcon('progressPercent')}</th>
                        <th className="sp-sortable" onClick={() => handleProgressSort('totalPoints')}>النقاط{getProgressSortIcon('totalPoints')}</th>
                        {groups.length > 1 && <th>الحلقة</th>}
                        <th>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedList.length === 0 ? (
                        <tr>
                          <td colSpan={groups.length > 1 ? 7 : 6} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
                            لا يوجد طلاب مطابقون للبحث
                          </td>
                        </tr>
                      ) : (
                        sortedList.map(s => (
                          <tr key={s.uid}>
                            <td className="sp-name-cell">{s.name}</td>
                            <td className="sp-nowrap">
                              {s.levelName}
                              {s.trackType === 'arabic_reading' && <span className="sp-track-badge">📖 قراءة</span>}
                            </td>
                            <td className="sp-nowrap">{s.stageName}</td>
                            <td>
                              <div className="sp-progress-bar-container">
                                <div className="sp-progress-bar">
                                  <div
                                    className={`sp-progress-fill ${s.progressPercent === 100 ? 'sp-progress-complete' : ''}`}
                                    style={{ width: `${s.progressPercent}%` }}
                                  />
                                </div>
                                <span className="sp-progress-text">{s.progressPercent}%</span>
                              </div>
                            </td>
                            <td className="sp-center-text">{s.totalPoints}</td>
                            {groups.length > 1 && <td className="sp-nowrap">{s.groupName}</td>}
                            <td>
                              {s.isPending ? (
                                <span className="sp-badge-pending">⏳ بانتظار الاعتماد</span>
                              ) : s.progressPercent === 100 ? (
                                <span className="sp-badge-complete">✅ مكتمل</span>
                              ) : (
                                <span className="sp-badge-inprogress">📖 جاري</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </section>
  );
};

export default TeacherProgress;
