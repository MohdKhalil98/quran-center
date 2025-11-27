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

interface LowAttendanceAlert {
  studentId: string;
  studentName: string;
  groupName: string;
  attendanceRate: number;
  absentDays: number;
  totalDays: number;
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

  const [lowAttendanceAlerts, setLowAttendanceAlerts] = useState<LowAttendanceAlert[]>([]);

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

        const presentCount = todayAttendance.filter((d) => {
          const status = (d.data() as any).status;
          return status === 'حاضر' || status === 'متأخر';
        }).length;
        const absentCount = todayAttendance.filter((d) => {
          const status = (d.data() as any).status;
          return status === 'غائب' || status === 'غائب بعذر';
        }).length;

        setAttendanceSummary({
          total: todayAttendance.length,
          present: presentCount,
          late: 0,
          excused: 0,
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
      }    // Check for low attendance alerts (current month)
    try {
      const currentMonth = new Date();
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);

      const allAttendanceSnap = await getDocs(collection(db, 'attendance'));
      const studentsSnap = await getDocs(collection(db, 'students'));
      const groupsSnap = await getDocs(collection(db, 'groups'));

      // Get all groups map
      const groupsMap = new Map<string, string>();
      groupsSnap.docs.forEach((doc) => {
        groupsMap.set(doc.id, doc.data().name);
      });

      // Filter month records
      const monthRecords = allAttendanceSnap.docs.filter((docSnap) => {
        const data = docSnap.data();
        let date: Date | null = null;
        if (data.date && typeof data.date.toDate === 'function') {
          date = data.date.toDate();
        } else if (data.date) {
          date = new Date(data.date);
        }
        if (!date) return false;
        return date >= monthStart && date <= monthEnd;
      });

      // Group by student and calculate stats
      const studentStatsMap = new Map<string, { groupId: string; studentName: string; present: number; absent: number; total: number }>();
      
      studentsSnap.docs.forEach((studentDoc) => {
        const studentData = studentDoc.data();
        const studentId = studentDoc.id;
        const studentName = studentData.name || 'غير محدد';
        const groupId = studentData.groupId || '';

        const studentRecords = monthRecords.filter((doc) => doc.data().studentId === studentId);
        const presentCount = studentRecords.filter((doc) => {
          const status = doc.data().status;
          return status === 'حاضر' || status === 'متأخر';
        }).length;
        const absentCount = studentRecords.filter((doc) => {
          const status = doc.data().status;
          return status === 'غائب' || status === 'غائب بعذر';
        }).length;
        const totalCount = studentRecords.length;

        if (totalCount > 0) {
          studentStatsMap.set(studentId, {
            groupId,
            studentName,
            present: presentCount,
            absent: absentCount,
            total: totalCount
          });
        }
      });

      // Find students with low attendance (absent more than half)
      const alerts: LowAttendanceAlert[] = [];
      studentStatsMap.forEach((stats, studentId) => {
        const attendanceRate = stats.total > 0 ? (stats.present / stats.total) * 100 : 0;
        if (attendanceRate < 50) {
          alerts.push({
            studentId,
            studentName: stats.studentName,
            groupName: groupsMap.get(stats.groupId) || 'غير محدد',
            attendanceRate,
            absentDays: stats.absent,
            totalDays: stats.total
          });
        }
      });

      // Sort by attendance rate (lowest first)
      alerts.sort((a, b) => a.attendanceRate - b.attendanceRate);
      setLowAttendanceAlerts(alerts);
    } catch (e) {
      console.error('Error calculating attendance alerts:', e);
      setLowAttendanceAlerts([]);
    }      setStats({
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
          <div className="summary-item present">
            <div className="summary-label">حاضرون</div>
            <div className="summary-count">{attendanceSummary.present}</div>
          </div>
          <div className="summary-item absent">
            <div className="summary-label">غائبون</div>
            <div className="summary-count">{attendanceSummary.absent}</div>
          </div>
        </div>
      </section>

      {/* Low Attendance Alerts */}
      {lowAttendanceAlerts.length > 0 && (
        <section className="alerts-card">
          <h2>
            <span className="alert-icon">⚠️</span>
            تنبيهات الحضور (الشهر الحالي)
          </h2>
          <p className="alerts-description">طلاب غابوا أكثر من نصف الحصص هذا الشهر</p>
          <div className="alerts-list">
            {lowAttendanceAlerts.map((alert) => (
              <div key={alert.studentId} className="alert-item">
                <div className="alert-content">
                  <div className="alert-student-name">{alert.studentName}</div>
                  <div className="alert-group">المجموعة: {alert.groupName}</div>
                  <div className="alert-stats">
                    <span className="alert-rate">نسبة الحضور: {alert.attendanceRate.toFixed(1)}%</span>
                    <span className="alert-days">غاب {alert.absentDays} من {alert.totalDays} يوم</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
};

export default Dashboard;

