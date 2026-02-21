import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, addDoc, deleteDoc, doc, Timestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import '../styles/Attendance.css';
import '../styles/AttendanceExtended.css';

interface Student {
  id: string;
  name: string;
  groupId?: string;
  subscriptionStatus?: 'active' | 'inactive' | 'exempt'; // حالة الاشتراك
  participation?: 'participating' | 'not_participating' | 'pending'; // حالة المشاركة
  expiredSubscription?: boolean; // هل انتهت مهلة الدفع بدون تجديد
}

interface Center {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  centerId?: string;
}

interface AttendanceRecord {
  studentId: string;
  studentName: string;
  status: 'حاضر' | 'متأخر' | 'غائب بعذر' | 'غائب';
}

interface StudentAttendanceStats {
  studentId: string;
  studentName: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  attendanceRate: number;
}

const Attendance = () => {
  const { userProfile, isTeacher } = useAuth();
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<string>('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<Map<string, AttendanceRecord>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);

  const [savedRecords, setSavedRecords] = useState<Map<string, AttendanceRecord>>(new Map());
  const [attendanceStats, setAttendanceStats] = useState<StudentAttendanceStats[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Fetch centers and groups
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all centers first
        const centersSnapshot = await getDocs(collection(db, 'centers'));
        const allCenters = centersSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name
        }));

        // Fetch groups - for teachers, only fetch their groups
        let groupsList: Group[] = [];
        if (isTeacher && userProfile?.uid) {
          const groupsQuery = query(
            collection(db, 'groups'),
            where('teacherId', '==', userProfile.uid)
          );
          const groupsSnapshot = await getDocs(groupsQuery);
          groupsList = groupsSnapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name,
            centerId: doc.data().centerId
          } as Group));
          
          // Filter centers to only include those that have groups for this teacher
          const teacherCenterIds = Array.from(new Set(groupsList.map(g => g.centerId).filter(Boolean)));
          const teacherCenters = allCenters.filter(c => teacherCenterIds.includes(c.id));
          setCenters(teacherCenters);
        } else {
          const groupsQuery = query(collection(db, 'groups'), orderBy('name'));
          const groupsSnapshot = await getDocs(groupsQuery);
          groupsList = groupsSnapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name,
            centerId: doc.data().centerId
          } as Group));
          setCenters(allCenters);
        }
        setGroups(groupsList);
        setFilteredGroups(groupsList);
        setLoading(false);

        // Set first group as default
        if (groupsList.length > 0) {
          setSelectedGroupId(groupsList[0].id);
          // Set the center of the first group as default
          if (groupsList[0].centerId) {
            setSelectedCenterId(groupsList[0].centerId);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [isTeacher, userProfile?.uid]);

  // Filter groups when center changes
  useEffect(() => {
    if (selectedCenterId) {
      const filtered = groups.filter(g => g.centerId === selectedCenterId);
      setFilteredGroups(filtered);
      // If current group is not in filtered list, reset to first filtered group
      if (!filtered.find(g => g.id === selectedGroupId)) {
        if (filtered.length > 0) {
          setSelectedGroupId(filtered[0].id);
        } else {
          setSelectedGroupId('');
        }
      }
    } else {
      setFilteredGroups(groups);
    }
  }, [selectedCenterId, groups]);

  // Fetch students for selected group
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedGroupId) return;

      try {
        // Get group details
        const groupDoc = groups.find((g) => g.id === selectedGroupId);
        if (!groupDoc) return;

        // Fetch students from users collection where role='student', status='approved', and groupId matches
        const studentsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('status', '==', 'approved'),
          where('groupId', '==', selectedGroupId)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        let allStudents = studentsSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            name: doc.data().name,
            groupId: doc.data().groupId,
            subscriptionStatus: doc.data().subscriptionStatus || 'inactive'
          } as Student));
        
        // جلب الفترة النشطة وحالات المشاركة لتصفية الطلاب غير المشاركين
        try {
          const periodsQuery = query(
            collection(db, 'studyPeriods'),
            where('isActive', '==', true)
          );
          const periodsSnap = await getDocs(periodsQuery);
          
          if (!periodsSnap.empty) {
            const activePeriodDoc = periodsSnap.docs[0];
            const activePeriodId = activePeriodDoc.id;
            const activePeriodData = activePeriodDoc.data();
            
            // التحقق من انتهاء مهلة الدفع
            let deadlinePassed = false;
            if (activePeriodData.paymentDeadline) {
              const deadline = activePeriodData.paymentDeadline.toDate();
              deadlinePassed = new Date() > deadline;
            }
            
            // جلب حالات المشاركة للطلاب
            const statusesSnap = await getDocs(collection(db, 'studentPeriodStatuses'));
            const statuses = statusesSnap.docs
              .filter(d => d.data().periodId === activePeriodId)
              .map(d => ({ studentId: d.data().studentId, participation: d.data().participation, status: d.data().status, paymentId: d.data().paymentId }));
            
            // تحديث حالة المشاركة لكل طالب وتصفية غير المشاركين
            allStudents = allStudents
              .map(student => {
                const statusRecord = statuses.find(s => s.studentId === student.id);
                const isParticipating = (statusRecord?.participation || 'not_participating') === 'participating';
                const isPaid = statusRecord?.status === 'active' || statusRecord?.status === 'exempt';
                return {
                  ...student,
                  participation: statusRecord?.participation || 'not_participating',
                  subscriptionStatus: statusRecord?.status || student.subscriptionStatus,
                  expiredSubscription: isParticipating && !isPaid && deadlinePassed
                };
              })
              .filter(student => student.participation === 'participating');
          }
        } catch (error) {
          console.error('Error fetching participation statuses:', error);
        }
        
        // Sort by name
        allStudents.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));

        setStudents(allStudents);

      // Load saved records for this date
      const sessionDateObj = new Date(sessionDate + 'T00:00:00');
      const nextDay = new Date(sessionDateObj);
      nextDay.setDate(nextDay.getDate() + 1);

      const allAttendanceSnap = await getDocs(collection(db, 'attendance'));
      const existingRecords = allAttendanceSnap.docs.filter((docSnap) => {
        const data = docSnap.data();
        if (data.groupId !== selectedGroupId) return false;

        let date: Date | null = null;
        if (data.date && typeof data.date.toDate === 'function') {
          date = data.date.toDate();
        } else if (data.date) {
          date = new Date(data.date);
        }

        if (!date) return false;
        return date.getTime() >= sessionDateObj.getTime() && date.getTime() < nextDay.getTime();
      });

      const saved = new Map<string, AttendanceRecord>();
      existingRecords.forEach((docSnap) => {
        const data = docSnap.data();
        saved.set(data.studentId, {
          studentId: data.studentId,
          studentName: data.studentName,
          status: data.status
        });
      });

      setSavedRecords(saved);

      // Initialize attendance records - use saved if available
        const newAttendance = new Map<string, AttendanceRecord>();
        allStudents.forEach((student) => {
        const savedRecord = saved.get(student.id);
          newAttendance.set(student.id, {
            studentId: student.id,
            studentName: student.name,
          status: savedRecord?.status || 'حاضر'
          });
        });
        setAttendance(newAttendance);
      } catch (error) {
        console.error('Error fetching students:', error);
      }
    };

  fetchStudents();
}, [selectedGroupId, groups, sessionDate]);

  // دالة لحساب الإحصائيات
  const calculateStats = async () => {
    if (!selectedGroupId || students.length === 0) {
      setAttendanceStats([]);
      return;
    }

    try {
      // Get all attendance records for selected group
      const allAttendanceSnap = await getDocs(collection(db, 'attendance'));
      const selectedMonthDate = new Date(selectedMonth + '-01');
      const monthStart = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), 1);
      const monthEnd = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0, 23, 59, 59);

      // Filter records for this group and month
      const monthRecords = allAttendanceSnap.docs.filter((docSnap) => {
        const data = docSnap.data();
        if (data.groupId !== selectedGroupId) return false;

        let date: Date | null = null;
        if (data.date && typeof data.date.toDate === 'function') {
          date = data.date.toDate();
        } else if (data.date) {
          date = new Date(data.date);
        }

        if (!date) return false;
        return date >= monthStart && date <= monthEnd;
      });

      // Calculate stats for each student
      const stats: StudentAttendanceStats[] = students.map((student) => {
        const studentRecords = monthRecords.filter((docSnap) => {
          const data = docSnap.data();
          return data.studentId === student.id;
        });

        const presentDays = studentRecords.filter((docSnap) => {
          const status = docSnap.data().status;
          return status === 'حاضر' || status === 'متأخر';
        }).length;

        const absentDays = studentRecords.filter((docSnap) => {
          const status = docSnap.data().status;
          return status === 'غائب' || status === 'غائب بعذر';
        }).length;

        const totalDays = studentRecords.length;
        const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

        return {
          studentId: student.id,
          studentName: student.name,
          totalDays: totalDays,
          presentDays: presentDays,
          absentDays: absentDays,
          attendanceRate: attendanceRate
        };
      });

      setAttendanceStats(stats);
    } catch (error) {
      console.error('Error calculating attendance stats:', error);
      setAttendanceStats([]);
    }
  };

  // Calculate monthly attendance statistics - استدعاء الدالة عند تغيير المجموعة أو الشهر
  useEffect(() => {
    calculateStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, students, selectedMonth]);

  const handleStatusChange = (studentId: string) => {
    const currentRecord = attendance.get(studentId);
    if (!currentRecord) return;

    const statusCycle: Array<'حاضر' | 'متأخر' | 'غائب بعذر' | 'غائب'> = [
      'حاضر',
      'متأخر',
      'غائب بعذر',
      'غائب'
    ];

    const currentIndex = statusCycle.indexOf(currentRecord.status);
    const nextIndex = (currentIndex + 1) % statusCycle.length;
    const nextStatus = statusCycle[nextIndex];

    const newAttendance = new Map(attendance);
    newAttendance.set(studentId, {
      ...currentRecord,
      status: nextStatus
    });
    setAttendance(newAttendance);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const selectedGroup = groups.find((g) => g.id === selectedGroupId);
      if (!selectedGroup) {
        alert('يرجى اختيار مجموعة');
        setSubmitting(false);
        return;
      }

      // Get all attendance records for this date and group, then filter in code
      const allAttendanceSnap = await getDocs(collection(db, 'attendance'));
      const sessionDateObj = new Date(sessionDate + 'T00:00:00');
      const nextDay = new Date(sessionDateObj);
      nextDay.setDate(nextDay.getDate() + 1);

      const recordsToDelete = allAttendanceSnap.docs.filter((docSnap) => {
        const data = docSnap.data();
        if (data.groupId !== selectedGroupId) return false;
        
        let date: Date | null = null;
        if (data.date && typeof data.date.toDate === 'function') {
          date = data.date.toDate();
        } else if (data.date) {
          date = new Date(data.date);
        }
        
        if (!date) return false;
        return date.getTime() >= sessionDateObj.getTime() && date.getTime() < nextDay.getTime();
      });

      // Delete existing records
      for (const docToDelete of recordsToDelete) {
        await deleteDoc(doc(db, 'attendance', docToDelete.id));
      }

      // Save new attendance records
      const attendanceRecords = Array.from(attendance.values());
      for (const record of attendanceRecords) {
        await addDoc(collection(db, 'attendance'), {
          studentId: record.studentId,
          studentName: record.studentName,
          groupId: selectedGroupId,
          groupName: selectedGroup.name,
          status: record.status,
          date: Timestamp.fromDate(sessionDateObj),
          createdAt: Timestamp.now()
        });
      }

      alert('تم حفظ سجل الحضور بنجاح');
      setSavedRecords(new Map(attendance));
      
      // إعادة حساب الإحصائيات بعد الحفظ
      await calculateStats();
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('حدث خطأ أثناء حفظ سجل الحضور');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'حاضر':
        return 'status-present';
      case 'متأخر':
        return 'status-late';
      case 'غائب بعذر':
        return 'status-excused';
      case 'غائب':
        return 'status-absent';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <section className="page">
        <header className="page__header">
          <h1>تسجيل الحضور</h1>
        </header>
        <p>جاري تحميل البيانات...</p>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1>تسجيل الحضور</h1>
        <p>تسجيل حضور طلاب المجموعات.</p>
      </header>

      <form className="attendance-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="centerSelect">اختر المركز</label>
            <select
              id="centerSelect"
              value={selectedCenterId}
              onChange={(e) => setSelectedCenterId(e.target.value)}
            >
              <option value="">-- كل المراكز --</option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="groupSelect">اختر المجموعة *</label>
            <select
              id="groupSelect"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              required
            >
              <option value="">-- اختر مجموعة --</option>
              {filteredGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="sessionDate">تاريخ الجلسة *</label>
            <input
              type="date"
              id="sessionDate"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="attendance-list">
          {students.length === 0 ? (
            <p>لا توجد طلاب في هذه المجموعة</p>
          ) : (
            <>
              <div className="attendance-header">
                <div className="student-name">الطالب</div>
                <div className="status-button">الحضور</div>
              </div>
              {students.map((student) => {
                const record = attendance.get(student.id);
                const status = record?.status || 'حاضر';
                const isExpired = student.expiredSubscription === true;
                return (
                  <div key={student.id} className={`attendance-row ${isExpired ? 'inactive-student' : ''}`}>
                    <div className="student-name">
                      {student.name}
                      {isExpired && <span className="inactive-badge" style={{ backgroundColor: '#dc354520', color: '#dc3545', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', marginRight: '8px' }}>لم يجدد الاشتراك</span>}
                    </div>
                    <button
                      type="button"
                      className={`status-btn ${isExpired ? 'status-disabled' : getStatusColor(status)}`}
                      onClick={() => !isExpired && handleStatusChange(student.id)}
                      disabled={isExpired}
                    >
                      {isExpired ? '-' : status}
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-success" disabled={submitting || students.length === 0}>
            {submitting ? 'جاري الحفظ...' : savedRecords.size > 0 ? 'تحديث سجل الحضور' : 'حفظ سجل الحضور'}
          </button>
        </div>
      </form>

      {/* Monthly Attendance Statistics */}
      <div className="attendance-stats-section">
        <div className="stats-header">
          <h2>إحصائيات الحضور الشهري</h2>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="monthSelect">اختر الشهر:</label>
            <input
              type="month"
              id="monthSelect"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
        </div>

        {attendanceStats.length === 0 ? (
          <p className="no-data">لا توجد إحصائيات للعرض</p>
        ) : (
          <div className="stats-table-container">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>اسم الطالب</th>
                  <th>أيام الحضور</th>
                  <th>أيام الغياب</th>
                  <th>إجمالي الأيام</th>
                  <th>نسبة الحضور</th>
                </tr>
              </thead>
              <tbody>
                {attendanceStats.map((stat) => {
                  const isLowAttendance = stat.attendanceRate < 50 && stat.totalDays > 0;
                  return (
                    <tr key={stat.studentId} className={isLowAttendance ? 'low-attendance' : ''}>
                      <td>{stat.studentName}</td>
                      <td>{stat.presentDays}</td>
                      <td>{stat.absentDays}</td>
                      <td>{stat.totalDays}</td>
                      <td>
                        <span className={`attendance-rate ${isLowAttendance ? 'warning' : ''}`}>
                          {stat.totalDays > 0 ? `${stat.attendanceRate.toFixed(1)}%` : 'لا توجد بيانات'}
                        </span>
                        {isLowAttendance && <span className="alert-icon" title="تنبيه: نسبة حضور منخفضة">⚠️</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default Attendance;
