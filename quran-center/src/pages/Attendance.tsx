import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/Attendance.css';
import '../styles/AttendanceExtended.css';

interface Student {
  id: string;
  name: string;
  groupId?: string;
}

interface Group {
  id: string;
  name: string;
}

interface AttendanceRecord {
  studentId: string;
  studentName: string;
  status: 'حاضر' | 'متأخر' | 'غائب بعذر' | 'غائب';
}

const Attendance = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<Map<string, AttendanceRecord>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [savedRecords, setSavedRecords] = useState<Map<string, AttendanceRecord>>(new Map());

  // Fetch groups and students
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch groups
        const groupsQuery = query(collection(db, 'groups'), orderBy('name'));
        const groupsSnapshot = await getDocs(groupsQuery);
        const groupsList = groupsSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name
        } as Group));
        setGroups(groupsList);
        setLoading(false);

        // Set first group as default
        if (groupsList.length > 0) {
          setSelectedGroupId(groupsList[0].id);
        }
      } catch (error) {
        console.error('Error fetching groups:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch students for selected group
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedGroupId) return;

      try {
        // Get group details
        const groupDoc = groups.find((g) => g.id === selectedGroupId);
        if (!groupDoc) return;

        // Fetch all students
        const studentsQuery = query(collection(db, 'students'), orderBy('name'));
        const studentsSnapshot = await getDocs(studentsQuery);
        const allStudents = studentsSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            name: doc.data().name,
            groupId: doc.data().groupId
          } as Student))
          .filter((student) => student.groupId === selectedGroupId);

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
      // Enable edit mode by default (allow clicking immediately)
      setIsEditMode(true);
      } catch (error) {
        console.error('Error fetching students:', error);
      }
    };

  fetchStudents();
}, [selectedGroupId, groups, sessionDate]);

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
            <label htmlFor="groupSelect">اختر المجموعة *</label>
            <select
              id="groupSelect"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              required
            >
              <option value="">-- اختر مجموعة --</option>
              {groups.map((group) => (
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
                return (
                  <div key={student.id} className="attendance-row">
                    <div className="student-name">{student.name}</div>
                    <button
                      type="button"
                      className={`status-btn ${getStatusColor(status)}`}
                      onClick={() => handleStatusChange(student.id)}
                    >
                      {status}
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
    </section>
  );
};

export default Attendance;
