import { useEffect, useState } from 'react';
import { collection, getDocs, query, addDoc, deleteDoc, doc, Timestamp, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import StudentAchievements from './StudentAchievements';
import '../styles/Attendance.css';
import '../styles/AttendanceExtended.css';
import '../styles/TeacherDailyRecord.css';

interface Student {
  id: string;
  name: string;
  groupId?: string;
  subscriptionStatus?: 'active' | 'inactive' | 'exempt';
  participation?: 'participating' | 'not_participating' | 'pending';
  expiredSubscription?: boolean;
  levelId?: string;
  levelName?: string;
  stageId?: string;
  stageName?: string;
  trackType?: string;
  levelStatus?: string;
  currentArabicLevelId?: string;
  currentArabicLessonId?: string;
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


const TeacherDailyRecord = () => {
  const { userProfile, isTeacher } = useAuth();

  // Shared state
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<string>('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Attendance state
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Map<string, AttendanceRecord>>(new Map());
  const [savedRecords, setSavedRecords] = useState<Map<string, AttendanceRecord>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [isAttendanceCollapsed, setIsAttendanceCollapsed] = useState(false);
  const [attendanceSaved, setAttendanceSaved] = useState(false);


  // Derived: present students for achievements section
  const presentStudents = students.filter(s => {
    const record = attendance.get(s.id);
    return record && (record.status === 'حاضر' || record.status === 'متأخر');
  });

  // Attendance summary counts
  const presentCount = Array.from(attendance.values()).filter(r => r.status === 'حاضر' || r.status === 'متأخر').length;
  const absentCount = Array.from(attendance.values()).filter(r => r.status === 'غائب' || r.status === 'غائب بعذر').length;

  // Fetch centers and groups
  useEffect(() => {
    const fetchData = async () => {
      try {
        const centersSnapshot = await getDocs(collection(db, 'centers'));
        const allCenters = centersSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name
        }));

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

        if (groupsList.length > 0) {
          setSelectedGroupId(groupsList[0].id);
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
        const groupDoc = groups.find((g) => g.id === selectedGroupId);
        if (!groupDoc) return;

        const studentsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('status', '==', 'approved'),
          where('groupId', '==', selectedGroupId)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        let allStudents = studentsSnapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name,
              groupId: data.groupId,
              subscriptionStatus: data.subscriptionStatus || 'inactive',
              levelId: data.levelId,
              levelName: data.levelName,
              stageId: data.stageId,
              stageName: data.stageName,
              trackType: data.trackType,
              levelStatus: data.levelStatus,
              currentArabicLevelId: data.currentArabicLevelId,
              currentArabicLessonId: data.currentArabicLessonId,
            } as Student;
          });

        // Filter by participation status
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

            let deadlinePassed = false;
            if (activePeriodData.paymentDeadline) {
              const deadline = activePeriodData.paymentDeadline.toDate();
              deadlinePassed = new Date() > deadline;
            }

            const statusesSnap = await getDocs(collection(db, 'studentPeriodStatuses'));
            const statuses = statusesSnap.docs
              .filter(d => d.data().periodId === activePeriodId)
              .map(d => ({ studentId: d.data().studentId, participation: d.data().participation, status: d.data().status, paymentId: d.data().paymentId }));

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
        setAttendanceSaved(saved.size > 0);

        // If there are saved records, auto-collapse attendance
        if (saved.size > 0) {
          setIsAttendanceCollapsed(true);
        } else {
          setIsAttendanceCollapsed(false);
        }

        // Initialize attendance records
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


  const handleStatusChange = (studentId: string) => {
    const currentRecord = attendance.get(studentId);
    if (!currentRecord) return;

    const statusCycle: Array<'حاضر' | 'متأخر' | 'غائب بعذر' | 'غائب'> = ['حاضر', 'متأخر', 'غائب بعذر', 'غائب'];
    const currentIndex = statusCycle.indexOf(currentRecord.status);
    const nextIndex = (currentIndex + 1) % statusCycle.length;

    const newAttendance = new Map(attendance);
    newAttendance.set(studentId, { ...currentRecord, status: statusCycle[nextIndex] });
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

      for (const docToDelete of recordsToDelete) {
        await deleteDoc(doc(db, 'attendance', docToDelete.id));
      }

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
      setAttendanceSaved(true);
      setIsAttendanceCollapsed(true);
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('حدث خطأ أثناء حفظ سجل الحضور');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'حاضر': return 'status-present';
      case 'متأخر': return 'status-late';
      case 'غائب بعذر': return 'status-excused';
      case 'غائب': return 'status-absent';
      default: return '';
    }
  };

  if (loading) {
    return (
      <section className="page">
        <header className="page__header">
          <h1>حضور و تحصيل الطالب</h1>
        </header>
        <p>جاري تحميل البيانات...</p>
      </section>
    );
  }

  return (
    <section className="page teacher-daily-record">
      <header className="page__header">
        <h1>حضور و تحصيل الطالب</h1>
      </header>

      {/* Shared Filters: Date, Center, Group */}
      <div className="daily-record-filters attendance-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="sessionDate">تاريخ التسجيل *</label>
            <input
              type="date"
              id="sessionDate"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="centerSelect">اختر المركز</label>
            <select
              id="centerSelect"
              value={selectedCenterId}
              onChange={(e) => setSelectedCenterId(e.target.value)}
            >
              <option value="">-- كل المراكز --</option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>{center.name}</option>
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
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Attendance Section - Collapsible */}
      <div className="collapsible-section">
        <div
          className="collapsible-header"
          onClick={() => setIsAttendanceCollapsed(!isAttendanceCollapsed)}
        >
          <h2>
            <span className="collapse-icon">{isAttendanceCollapsed ? '◀' : '▼'}</span>
            تسجيل الحضور
          </h2>
          {attendanceSaved && isAttendanceCollapsed && (
            <div className="attendance-summary">
              <span className="summary-present">{presentCount} حاضر</span>
              <span className="summary-separator">|</span>
              <span className="summary-absent">{absentCount} غائب</span>
            </div>
          )}
        </div>

        <div className={`collapsible-body ${!isAttendanceCollapsed ? 'open' : ''}`}>
          <form className="attendance-form" onSubmit={handleSubmit} style={{ border: 'none', boxShadow: 'none', padding: '0' }}>
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
        </div>
      </div>

      {/* Achievements Section */}
      <div className="achievements-section-wrapper">
        <h2 className="section-title">تسجيل التحصيل</h2>
        {!attendanceSaved ? (
          <div className="no-attendance-message">
            <p>يرجى تسجيل وحفظ الحضور أولاً حتى تتمكن من تسجيل التحصيل للطلاب الحاضرين</p>
          </div>
        ) : presentStudents.length === 0 ? (
          <div className="no-attendance-message">
            <p>لا يوجد طلاب حاضرون لتسجيل التحصيل</p>
          </div>
        ) : (
          <StudentAchievements
            embedded={true}
            externalStudents={presentStudents}
            externalSessionDate={sessionDate}
            externalGroupId={selectedGroupId}
            attendanceSaved={attendanceSaved}
          />
        )}
      </div>



    </section>
  );
};

export default TeacherDailyRecord;
