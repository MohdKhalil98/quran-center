import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { arabicReadingCurriculum, getNextLevel as getNextArabicLevel } from '../data/arabicReadingCurriculum';
import quranCurriculum from '../data/quranCurriculum';
import '../styles/StudentProgress.css';

interface Group {
  id: string;
  name: string;
  centerId: string;
  teacherId?: string;
}

interface Center {
  id: string;
  name: string;
}

interface CurriculumStage {
  id: string;
  name: string;
  order: number;
  ayahCount: number;
}

interface CurriculumLevel {
  id: string;
  name: string;
  order: number;
  centerId: string;
  stages: CurriculumStage[];
}

interface PendingStudent {
  uid: string;
  name: string;
  levelId?: string;
  levelName?: string;
  stageName?: string;
  pendingLevelUp?: boolean;
  totalPoints?: number;
  completedLevels?: number;
  groupName: string;
  centerName: string;
  trackType?: string;
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
  centerName: string;
  trackType: string;
  isPending: boolean;
  levelId?: string;
  pendingLevelUp?: boolean;
}

const StudentProgress = () => {
  const { isSupervisor, getSupervisorCenterIds } = useAuth();

  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState<Center[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [pendingLevelStudents, setPendingLevelStudents] = useState<PendingStudent[]>([]);
  const [curriculumLevels, setCurriculumLevels] = useState<CurriculumLevel[]>([]);
  const [processingUid, setProcessingUid] = useState<string | null>(null);
  const [studentProgressList, setStudentProgressList] = useState<StudentProgressItem[]>([]);
  const [progressSearchTerm, setProgressSearchTerm] = useState<string>('');
  const [progressFilterCenter, setProgressFilterCenter] = useState<string>('all');
  const [progressFilterGroup, setProgressFilterGroup] = useState<string>('all');
  const [progressFilterTrack, setProgressFilterTrack] = useState<string>('all');

  // ترتيب جدول التقدم
  const [progressSortColumn, setProgressSortColumn] = useState<string>('progressPercent');
  const [progressSortDirection, setProgressSortDirection] = useState<'asc' | 'desc'>('desc');

  const supervisorCenterIds = getSupervisorCenterIds();

  useEffect(() => {
    if (supervisorCenterIds.length > 0) {
      fetchData();
    }
  }, [supervisorCenterIds.length]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. جلب المراكز
      const centersList: Center[] = [];
      for (const centerId of supervisorCenterIds) {
        const centerQuery = query(collection(db, 'centers'), where('__name__', '==', centerId));
        const snap = await getDocs(centerQuery);
        snap.docs.forEach(d => centersList.push({ id: d.id, name: d.data().name }));
      }
      setCenters(centersList);

      // 2. جلب المجموعات
      let allGroups: Group[] = [];
      for (const centerId of supervisorCenterIds) {
        const gq = query(collection(db, 'groups'), where('centerId', '==', centerId));
        const gs = await getDocs(gq);
        allGroups = [...allGroups, ...gs.docs.map(d => ({ id: d.id, ...d.data() } as Group))];
      }
      setGroups(allGroups);

      // 3. جلب الطلاب التابعين لمراكز المشرف
      const allStudentDocs: any[] = [];
      for (const centerId of supervisorCenterIds) {
        const sq = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('centerId', '==', centerId)
        );
        const ss = await getDocs(sq);
        allStudentDocs.push(...ss.docs);
      }

      // 4. جلب المنهج (للانتقالات - مساق القرآن)
      const levels: CurriculumLevel[] = [];
      for (const centerId of supervisorCenterIds) {
        const cq = query(collection(db, 'curriculum'), where('centerId', '==', centerId));
        const cs = await getDocs(cq);
        cs.docs.forEach(d => levels.push({ id: d.id, ...d.data() } as CurriculumLevel));
      }
      levels.sort((a, b) => a.order - b.order);
      setCurriculumLevels(levels);

      // 5. جلب الطلاب الذين ينتظرون اعتماد الانتقال
      const pendingList: PendingStudent[] = [];
      allStudentDocs.forEach(d => {
        const data = d.data();
        if (data.levelStatus === 'pending_supervisor' || data.stageStatus === 'pending_supervisor') {
          const group = allGroups.find(g => g.id === data.groupId);
          const center = centersList.find(c => c.id === data.centerId);
          pendingList.push({
            uid: d.id,
            name: data.name || 'غير محدد',
            levelId: data.levelId,
            levelName: data.levelName,
            stageName: data.stageName,
            pendingLevelUp: data.pendingLevelUp,
            totalPoints: data.totalPoints,
            completedLevels: data.completedLevels,
            groupName: group?.name || '-',
            centerName: center?.name || '-',
            trackType: data.trackType,
          });
        }
      });
      setPendingLevelStudents(pendingList);

      // 6. بناء جدول تقدم الطلاب في المنهج
      const progressList: StudentProgressItem[] = [];
      allStudentDocs.forEach(d => {
        const data = d.data();
        if (data.status !== 'approved') return;

        const group = allGroups.find(g => g.id === data.groupId);
        const center = centersList.find(c => c.id === data.centerId);
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
          centerName: center?.name || '-',
          trackType,
          isPending: data.stageStatus === 'pending_supervisor' || data.levelStatus === 'pending_supervisor',
          levelId: data.levelId,
          pendingLevelUp: data.pendingLevelUp,
        });
      });

      progressList.sort((a, b) => b.progressPercent - a.progressPercent);
      setStudentProgressList(progressList);
    } catch (error) {
      console.error('Error fetching student progress:', error);
    }
    setLoading(false);
  };

  // اعتماد الانتقال للمستوى التالي
  const handleLevelApprove = async (student: PendingStudent) => {
    const message = 'هل أنت متأكد من اعتماد انتقال الطالب للمستوى التالي؟';
    if (!window.confirm(message)) return;

    setProcessingUid(student.uid);
    try {
      if (student.trackType === 'arabic_reading') {
        const nextLevel = student.levelId ? getNextArabicLevel(student.levelId) : null;
        if (nextLevel) {
          await updateDoc(doc(db, 'users', student.uid), {
            levelId: nextLevel.id,
            levelName: nextLevel.name,
            stageId: nextLevel.lessons[0].id,
            stageName: nextLevel.lessons[0].name,
            stageStatus: null,
            pendingLevelUp: null,
            completedLevels: (student.completedLevels || 0) + 1,
            totalPoints: (student.totalPoints || 0) + 200
          });
        } else {
          await updateDoc(doc(db, 'users', student.uid), {
            stageStatus: null,
            pendingLevelUp: null,
            completedCurriculum: true,
            completedLevels: arabicReadingCurriculum.length,
            totalPoints: (student.totalPoints || 0) + 500
          });
        }
      } else {
        const currentLevel = curriculumLevels.find(l => l.id === student.levelId);
        const currentLevelOrder = currentLevel?.order || 1;
        const nextLevel = curriculumLevels.find(l => l.order === currentLevelOrder + 1);

        if (nextLevel && nextLevel.stages && nextLevel.stages.length > 0) {
          const firstStage = nextLevel.stages.sort((a, b) => a.order - b.order)[0];
          await updateDoc(doc(db, 'users', student.uid), {
            levelId: nextLevel.id,
            levelName: nextLevel.name,
            stageId: firstStage.id,
            stageName: firstStage.name,
            levelStatus: 'in-progress',
            stageStatus: null,
            pendingLevelUp: null,
            currentChallenge: 'memorization',
            completedLevels: (student.completedLevels || 0) + 1,
            totalPoints: (student.totalPoints || 0) + 200
          });
        } else {
          await updateDoc(doc(db, 'users', student.uid), {
            levelStatus: 'completed',
            stageStatus: null,
            pendingLevelUp: null,
            completedLevels: curriculumLevels.length,
            totalPoints: (student.totalPoints || 0) + 500
          });
        }
      }

      setPendingLevelStudents(prev => prev.filter(s => s.uid !== student.uid));
      setStudentProgressList(prev => prev.map(s =>
        s.uid === student.uid ? { ...s, isPending: false, progressPercent: 0 } : s
      ));
    } catch (error) {
      console.error('Error approving:', error);
      alert('حدث خطأ أثناء الاعتماد');
    } finally {
      setProcessingUid(null);
    }
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

  if (!isSupervisor) {
    return <p style={{ padding: 40, textAlign: 'center' }}>هذه الصفحة متاحة للمشرفين فقط</p>;
  }

  return (
    <section className="page student-progress-page">
      <header className="page__header">
        <h1>📊 تقدم الطلاب</h1>
        <p className="page__subtitle">متابعة تقدم طلاب مراكزك في المنهج الدراسي</p>
      </header>

      {/* قسم طلاب بانتظار الانتقال */}
      {!loading && (
        <div className="sp-pending-section">
          <div className="sp-pending-header">
            <h2>🌟 طلاب جاهزون للانتقال</h2>
            {pendingLevelStudents.length > 0 && (
              <span className="sp-pending-count">{pendingLevelStudents.length}</span>
            )}
          </div>
          {pendingLevelStudents.length === 0 ? (
            <p className="sp-pending-empty">لا يوجد طلاب ينتظرون اعتماد الانتقال حالياً</p>
          ) : (
            <div className="sp-pending-cards">
              {pendingLevelStudents.map(student => (
                <div key={student.uid} className="sp-pending-card">
                  <div className="sp-pending-card-avatar">
                    {student.name.charAt(0)}
                  </div>
                  <div className="sp-pending-card-info">
                    <h4>{student.name}</h4>
                    <p className="sp-pending-card-details">
                      📚 {student.levelName || 'المستوى الأول'} · 👥 {student.groupName}
                      {student.trackType === 'arabic_reading' && ' · 📖 قراءة عربية'}
                    </p>
                    <p className="sp-pending-card-target">
                      ➡️ الانتقال إلى: <strong>المستوى التالي</strong>
                    </p>
                  </div>
                  <button
                    className="sp-approve-btn"
                    onClick={() => handleLevelApprove(student)}
                    disabled={processingUid === student.uid}
                  >
                    {processingUid === student.uid ? '⏳ جاري...' : '✅ اعتماد'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* جدول تقدم الطلاب في المنهج */}
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
              if (progressFilterCenter !== 'all') {
                const centerName = centers.find(c => c.id === progressFilterCenter)?.name;
                if (s.centerName !== centerName) return false;
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
            {centers.length > 1 && (
              <select className="sp-filter-select" value={progressFilterCenter} onChange={e => { setProgressFilterCenter(e.target.value); setProgressFilterGroup('all'); }}>
                <option value="all">جميع المراكز</option>
                {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <select className="sp-filter-select" value={progressFilterGroup} onChange={e => setProgressFilterGroup(e.target.value)}>
              <option value="all">جميع الحلقات</option>
              {(progressFilterCenter !== 'all' ? groups.filter(g => g.centerId === progressFilterCenter) : groups).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
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
                  <th>الحلقة</th>
                  {centers.length > 1 && <th>المركز</th>}
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {sortedList.map(s => (
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
                    <td className="sp-nowrap">{s.groupName}</td>
                    {centers.length > 1 && <td className="sp-nowrap">{s.centerName}</td>}
                    <td>
                      {s.isPending ? (
                        <button
                          className="sp-approve-btn sp-approve-btn-sm"
                          onClick={() => {
                            const pending = pendingLevelStudents.find(p => p.uid === s.uid);
                            if (pending) handleLevelApprove(pending);
                          }}
                          disabled={processingUid === s.uid}
                        >
                          {processingUid === s.uid ? '⏳' : '⬆️ انتقال'}
                        </button>
                      ) : s.progressPercent === 100 ? (
                        <span className="sp-badge-complete">✅ مكتمل</span>
                      ) : (
                        <span className="sp-badge-inprogress">📖 جاري</span>
                      )}
                    </td>
                  </tr>
                ))}
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

export default StudentProgress;
