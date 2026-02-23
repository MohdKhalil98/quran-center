import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import '../styles/SupervisorAchievements.css';

interface Achievement {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  challengeType?: string;
  challengeContent?: string;
  challengePassed?: boolean;
  rating?: number;
  portion?: string;
  fromAya?: string;
  toAya?: string;
  levelName?: string;
  stageName?: string;
  notes?: string;
  groupName?: string;
  centerName?: string;
  teacherName?: string;
}

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

const CHALLENGE_LABELS: Record<string, string> = {
  memorization: 'تسميع',
  near_review: 'مراجعة قريبة',
  far_review: 'مراجعة بعيدة',
};

const SupervisorAchievements = () => {
  const { isSupervisor, getSupervisorCenterIds } = useAuth();

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState<Center[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teacherNames, setTeacherNames] = useState<Map<string, string>>(new Map());
  // فلاتر
  const [filterCenterId, setFilterCenterId] = useState<string>('all');
  const [filterGroupId, setFilterGroupId] = useState<string>('all');
  const [filterChallengeType, setFilterChallengeType] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // ترتيب
  const [sortColumn, setSortColumn] = useState<'date' | 'name' | 'ward'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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

      // 3. جلب المعلمين
      const teacherIds = Array.from(new Set(allGroups.map(g => g.teacherId).filter((id): id is string => !!id)));
      const teacherMap = new Map<string, string>();
      if (teacherIds.length > 0) {
        const teachersQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const teachersSnap = await getDocs(teachersQuery);
        teachersSnap.docs.forEach(d => {
          const data = d.data();
          teacherMap.set(data.uid || d.id, data.name || 'غير محدد');
        });
      }
      setTeacherNames(teacherMap);

      // 4. جلب الطلاب التابعين لمراكز المشرف
      let studentsList: { id: string; name: string; groupId?: string; centerId?: string }[] = [];
      const allStudentDocs: any[] = [];
      for (const centerId of supervisorCenterIds) {
        const sq = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('centerId', '==', centerId)
        );
        const ss = await getDocs(sq);
        allStudentDocs.push(...ss.docs);
        studentsList = [...studentsList, ...ss.docs.map(d => {
          const data = d.data();
          return { id: d.id, name: data.name || 'غير محدد', groupId: data.groupId, centerId: data.centerId };
        })];
      }
      const studentIds = new Set(studentsList.map(s => s.id));
      const studentMap = new Map(studentsList.map(s => [s.id, s]));

      // 5. جلب التحصيلات
      const achievementsQuery = query(collection(db, 'student_achievements'), orderBy('date', 'desc'));
      const achievementsSnap = await getDocs(achievementsQuery);
      
      const achievementsList: Achievement[] = [];
      achievementsSnap.docs.forEach(d => {
        const data = d.data();
        if (!studentIds.has(data.studentId)) return;

        const student = studentMap.get(data.studentId);
        const group = allGroups.find(g => g.id === student?.groupId);
        const center = centersList.find(c => c.id === student?.centerId);

        // بناء اسم الورد
        let wardName = '';
        if (data.challengeType && data.stageName) {
          const challengeLabel = CHALLENGE_LABELS[data.challengeType] || data.challengeType;
          wardName = `${challengeLabel} - ${data.stageName}`;
          if (data.fromAya && data.toAya) {
            wardName += ` (${data.fromAya} - ${data.toAya})`;
          }
        } else if (data.portion) {
          wardName = data.portion;
          if (data.fromAya && data.toAya) {
            wardName += ` (${data.fromAya} - ${data.toAya})`;
          }
        } else if (data.challengeContent) {
          wardName = data.challengeContent;
        }

        achievementsList.push({
          id: d.id,
          studentId: data.studentId,
          studentName: student?.name || 'غير محدد',
          date: data.date,
          challengeType: data.challengeType,
          challengeContent: data.challengeContent,
          challengePassed: data.challengePassed,
          rating: data.rating,
          portion: data.portion,
          fromAya: data.fromAya,
          toAya: data.toAya,
          levelName: data.levelName,
          stageName: data.stageName,
          notes: data.notes,
          groupName: group?.name || '-',
          centerName: center?.name || '-',
          teacherName: group?.teacherId ? (teacherMap.get(group.teacherId) || '-') : '-',
        });
      });

      setAchievements(achievementsList);
    } catch (error) {
      console.error('Error fetching achievements:', error);
    }
    setLoading(false);
  };

  // تطبيق الفلاتر
  const getFilteredAchievements = () => {
    let filtered = [...achievements];

    if (filterCenterId !== 'all') {
      filtered = filtered.filter(a => a.centerName === centers.find(c => c.id === filterCenterId)?.name);
    }
    if (filterGroupId !== 'all') {
      filtered = filtered.filter(a => a.groupName === groups.find(g => g.id === filterGroupId)?.name);
    }
    if (filterChallengeType !== 'all') {
      filtered = filtered.filter(a => a.challengeType === filterChallengeType);
    }
    if (filterDateFrom) {
      filtered = filtered.filter(a => a.date >= filterDateFrom);
    }
    if (filterDateTo) {
      filtered = filtered.filter(a => a.date <= filterDateTo);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      filtered = filtered.filter(a =>
        a.studentName.toLowerCase().includes(term) ||
        (a.stageName || '').toLowerCase().includes(term) ||
        (a.challengeContent || '').toLowerCase().includes(term)
      );
    }

    // الترتيب
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'date':
          comparison = a.date.localeCompare(b.date);
          break;
        case 'name':
          comparison = a.studentName.localeCompare(b.studentName, 'ar');
          break;
        case 'ward': {
          const wardA = getWardName(a);
          const wardB = getWardName(b);
          comparison = wardA.localeCompare(wardB, 'ar');
          break;
        }
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const getWardName = (a: Achievement): string => {
    if (a.challengeType && a.stageName) {
      return `${CHALLENGE_LABELS[a.challengeType] || a.challengeType} - ${a.stageName}`;
    }
    return a.portion || a.challengeContent || '-';
  };

  const getFullWardDisplay = (a: Achievement): string => {
    let ward = '';
    if (a.challengeType && a.stageName) {
      const label = CHALLENGE_LABELS[a.challengeType] || a.challengeType;
      ward = `${label} - ${a.stageName}`;
      if (a.fromAya && a.toAya) {
        ward += ` (${a.fromAya} - ${a.toAya})`;
      }
    } else if (a.portion) {
      ward = a.portion;
      if (a.fromAya && a.toAya) {
        ward += ` (${a.fromAya} - ${a.toAya})`;
      }
    } else if (a.challengeContent) {
      ward = a.challengeContent;
    } else {
      ward = '-';
    }
    return ward;
  };

  const handleSort = (column: 'date' | 'name' | 'ward') => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) return ' ⇅';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  const resetFilters = () => {
    setFilterCenterId('all');
    setFilterGroupId('all');
    setFilterChallengeType('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchTerm('');
  };

  const filteredGroups = filterCenterId !== 'all'
    ? groups.filter(g => g.centerId === filterCenterId)
    : groups;

  const filteredAchievements = getFilteredAchievements();

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getPassedBadge = (passed?: boolean) => {
    if (passed === undefined) return null;
    return passed
      ? <span className="badge badge-passed">✅ ناجح</span>
      : <span className="badge badge-failed">❌ لم يجتز</span>;
  };

  const getRatingStars = (rating?: number) => {
    if (!rating) return null;
    return <span className="rating-stars">{'⭐'.repeat(Math.min(rating, 5))}</span>;
  };

  if (!isSupervisor) {
    return <p style={{ padding: 40, textAlign: 'center' }}>هذه الصفحة متاحة للمشرفين فقط</p>;
  }

  return (
    <section className="page supervisor-achievements-page">
      <header className="page__header">
        <h1>📋 تحصيل الطلاب</h1>
        <p className="page__subtitle">جميع تحصيلات طلاب مراكزك المسجلة من قبل المعلمين</p>
      </header>

      {/* فلاتر */}
      <div className="sa-filters-section">
        <div className="sa-filters-row">
          <div className="sa-filter-group">
            <label>بحث</label>
            <input
              type="text"
              className="sa-filter-input"
              placeholder="ابحث باسم الطالب أو الورد..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {centers.length > 1 && (
            <div className="sa-filter-group">
              <label>المركز</label>
              <select className="sa-filter-select" value={filterCenterId} onChange={e => { setFilterCenterId(e.target.value); setFilterGroupId('all'); }}>
                <option value="all">جميع المراكز</option>
                {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="sa-filter-group">
            <label>الحلقة</label>
            <select className="sa-filter-select" value={filterGroupId} onChange={e => setFilterGroupId(e.target.value)}>
              <option value="all">جميع الحلقات</option>
              {filteredGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="sa-filter-group">
            <label>نوع الورد</label>
            <select className="sa-filter-select" value={filterChallengeType} onChange={e => setFilterChallengeType(e.target.value)}>
              <option value="all">الكل</option>
              <option value="memorization">تسميع</option>
              <option value="near_review">مراجعة قريبة</option>
              <option value="far_review">مراجعة بعيدة</option>
            </select>
          </div>
          <div className="sa-filter-group">
            <label>من تاريخ</label>
            <input type="date" className="sa-filter-input" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
          </div>
          <div className="sa-filter-group">
            <label>إلى تاريخ</label>
            <input type="date" className="sa-filter-input" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
          </div>
        </div>
        <div className="sa-filters-actions">
          <button className="btn btn-sm btn-reset-filters" onClick={resetFilters}>🔄 إعادة تعيين الفلاتر</button>
          <span className="sa-results-count">{filteredAchievements.length} تحصيل</span>
        </div>
      </div>

      {/* الجدول */}
      {loading ? (
        <div className="sa-loading">
          <div className="sa-spinner"></div>
          <p>جاري تحميل التحصيلات...</p>
        </div>
      ) : filteredAchievements.length === 0 ? (
        <div className="sa-empty">
          <span className="sa-empty-icon">📭</span>
          <h3>لا توجد تحصيلات</h3>
          <p>لم يتم العثور على تحصيلات مطابقة للفلاتر المحددة</p>
        </div>
      ) : (
        <div className="sa-table-container">
          <table className="sa-table">
            <thead>
              <tr>
                <th className="sa-sortable" onClick={() => handleSort('date')}>
                  تاريخ التحصيل{getSortIcon('date')}
                </th>
                <th className="sa-sortable" onClick={() => handleSort('name')}>
                  اسم الطالب{getSortIcon('name')}
                </th>
                <th className="sa-sortable" onClick={() => handleSort('ward')}>
                  الورد المسجل{getSortIcon('ward')}
                </th>
                <th>النتيجة</th>
                <th>الحلقة</th>
                <th>المعلم</th>
                {centers.length > 1 && <th>المركز</th>}
                <th>الملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {filteredAchievements.map(a => (
                <tr key={a.id}>
                  <td className="sa-date-cell">{formatDate(a.date)}</td>
                  <td className="sa-name-cell">{a.studentName}</td>
                  <td className="sa-ward-cell">{getFullWardDisplay(a)}</td>
                  <td>{getPassedBadge(a.challengePassed)}</td>
                  <td>{a.groupName}</td>
                  <td>{a.teacherName}</td>
                  {centers.length > 1 && <td>{a.centerName}</td>}
                  <td className="sa-notes-cell">{a.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default SupervisorAchievements;
