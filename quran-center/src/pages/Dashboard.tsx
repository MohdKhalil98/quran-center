import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface DashboardStats {
  totalStudents: number;
  activeGroups: number;
  teachers: number;
  reviewsThisWeek: number;
  recentUpdates: string[];
  loading: boolean;
  error: string | null;
}

interface AttendanceSummary {
  total: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    activeGroups: 0,
    teachers: 0,
    reviewsThisWeek: 0,
    recentUpdates: [],
    loading: true,
    error: null
  });

  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary>({
    total: 0,
    present: 0,
    late: 0,
    excused: 0,
    absent: 0
  });

  const fetchDashboard = async () => {
    try {
      // students
      const studentsSnap = await getDocs(collection(db, 'students'));
      const totalStudents = studentsSnap.size;

      // groups (active)
      let activeGroups = 0;
      try {
        const groupsSnap = await getDocs(collection(db, 'groups'));
        activeGroups = groupsSnap.size;
      } catch (e) {
        console.error('Error fetching groups:', e);
        activeGroups = 0;
      }

      // teachers
      const teachersSnap = await getDocs(collection(db, 'teachers'));
      const teachers = teachersSnap.size;

      // sessions -> reviews this week
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const sessionsSnap = await getDocs(collection(db, 'sessions'));
      const reviewsThisWeek = sessionsSnap.docs.filter((d) => {
        const data: any = d.data();
        const type = data.type;
        let date: Date | null = null;
        if (data.date && typeof data.date.toDate === 'function') {
          date = data.date.toDate();
        } else if (data.date) {
          date = new Date(data.date);
        }
        return type === 'review' && date && date >= weekAgo && date <= now;
      }).length;

      // recent activities
      const activitiesSnap = await getDocs(collection(db, 'activities'));
      const recentUpdates = activitiesSnap.docs
        .map((d) => ({ ...(d.data() as any) }))
        .sort((a: any, b: any) => {
          const da = a.date && typeof a.date.toDate === 'function' ? a.date.toDate() : new Date(a.date || 0);
          const dbt = b.date && typeof b.date.toDate === 'function' ? b.date.toDate() : new Date(b.date || 0);
          return dbt.getTime() - da.getTime();
        })
        .slice(0, 3)
        .map((a: any) => a.description || a.title || 'تحديث جديد');

      // Attendance summary for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      try {
        const attendanceSnap = await getDocs(collection(db, 'attendance'));
        const todayAttendance = attendanceSnap.docs.filter((d) => {
          const data: any = d.data();
          let date: Date | null = null;
          if (data.date && typeof data.date.toDate === 'function') {
            date = data.date.toDate();
          } else if (data.date) {
            date = new Date(data.date);
          }
          if (!date) return false;
          date.setHours(0, 0, 0, 0);
          return date.getTime() === today.getTime();
        });

        const presentCount = todayAttendance.filter((d) => (d.data() as any).status === 'حاضر').length;
        const lateCount = todayAttendance.filter((d) => (d.data() as any).status === 'متأخر').length;
        const excusedCount = todayAttendance.filter((d) => (d.data() as any).status === 'غائب بعذر').length;
        const absentCount = todayAttendance.filter((d) => (d.data() as any).status === 'غائب').length;

        setAttendanceSummary({
          total: todayAttendance.length,
          present: presentCount,
          late: lateCount,
          excused: excusedCount,
          absent: absentCount
        });
      } catch (e) {
        console.error('Error fetching attendance:', e);
        setAttendanceSummary({
          total: 0,
          present: 0,
          late: 0,
          excused: 0,
          absent: 0
        });
      }

      setStats({
        totalStudents,
        activeGroups,
        teachers,
        reviewsThisWeek,
        recentUpdates: recentUpdates.length ? recentUpdates : [
          'تم إضافة مجموعة جديدة لحفظ جزء عمّ.',
          'اكتمل تسميع خمسة طلاب لجزء تبارك هذا الأسبوع.',
          'بدء التسجيل للفصل الصيفي القادم.'
        ],
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setStats((prev) => ({ ...prev, loading: false, error: 'خطأ في جلب البيانات من قاعدة البيانات' }));
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (stats.loading) {
    return (
      <section className="page">
        <header className="page__header">
          <h1>لوحة التحكم</h1>
          <p>جاري تحميل البيانات...</p>
        </header>
      </section>
    );
  }

  const cards = [
    { title: 'إجمالي الطلاب', value: stats.totalStudents.toString(), description: 'طلاب مسجلون حالياً' },
    { title: 'المجموعات', value: stats.activeGroups.toString(), description: 'إجمالي عدد المجموعات' },
    { title: 'المدرسون', value: stats.teachers.toString(), description: 'مشرفون على الحلقات' },
    { title: 'المراجعات هذا الأسبوع', value: stats.reviewsThisWeek.toString(), description: 'عدد جلسات المراجعة المكتملة' }
  ];

  return (
    <section className="page">
      <header className="page__header">
        <h1>لوحة التحكم</h1>
        <p>مرحباً بك في مركز متابعة تحفيظ القرآن.</p>
      </header>

      {stats.error && (
        <div style={{ color: 'red', padding: '10px', marginBottom: '20px' }}>{stats.error}</div>
      )}

      <div className="stats-grid">
        {cards.map((card) => (
          <article key={card.title} className="stat-card">
            <h2>{card.title}</h2>
            <p className="stat-card__value">{card.value}</p>
            <p className="stat-card__description">{card.description}</p>
          </article>
        ))}
      </div>

      <section className="overview-card">
        <h2>آخر التحديثات</h2>
        <ul className="overview-list">
          {stats.recentUpdates.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>
      </section>

      <section className="attendance-summary-card">
        <h2>ملخص الحضور اليومي</h2>
        <div className="summary-grid">
          <div className="summary-item total">
            <div className="summary-label">إجمالي</div>
            <div className="summary-count">{attendanceSummary.total}</div>
          </div>
          <div className="summary-item present">
            <div className="summary-label">حاضرون</div>
            <div className="summary-count">{attendanceSummary.present}</div>
          </div>
          <div className="summary-item late">
            <div className="summary-label">متأخرون</div>
            <div className="summary-count">{attendanceSummary.late}</div>
          </div>
          <div className="summary-item excused">
            <div className="summary-label">غائبون بعذر</div>
            <div className="summary-count">{attendanceSummary.excused}</div>
          </div>
          <div className="summary-item absent">
            <div className="summary-label">غائبون</div>
            <div className="summary-count">{attendanceSummary.absent}</div>
          </div>
        </div>
      </section>
    </section>
  );
};

export default Dashboard;

