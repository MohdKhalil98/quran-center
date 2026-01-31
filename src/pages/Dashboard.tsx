import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

interface AdminRequest {
  id: string;
  type: string;
  userId: string;
  userName: string;
  userEmail: string;
  requestedBy: string;
  requestedByRole: string;
  requestedAt: string;
  status: string;
  message: string;
}

interface Center {
  id: string;
  name: string;
}

interface DashboardStats {
  totalStudents: number;
  totalUsers: number;
  activeGroups: number;
  teachers: number;
  supervisors: number;
  reviewsThisWeek: number;
  completedStudents: number;
  recentUpdates: { text: string; date: string }[];
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
  const { userProfile, isTeacher, isAdmin, isSupervisor, getSupervisorCenterIds } = useAuth();
  const [supervisorCenters, setSupervisorCenters] = useState<Center[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<string>('');
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalUsers: 0,
    activeGroups: 0,
    teachers: 0,
    supervisors: 0,
    reviewsThisWeek: 0,
    completedStudents: 0,
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
  const [teacherGroups, setTeacherGroups] = useState<string[]>([]);
  const [adminRequests, setAdminRequests] = useState<AdminRequest[]>([]);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  
  // حالة اختيار التاريخ وتفاصيل الحضور
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendanceDetails, setAttendanceDetails] = useState<{studentId: string; studentName: string; status: string; groupName: string}[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // جلب طلبات المطور المعلقة
  const fetchAdminRequests = async () => {
    if (!isAdmin) return;
    
    try {
      const requestsQuery = query(
        collection(db, 'admin_requests'),
        where('status', '==', 'pending')
      );
      const requestsSnapshot = await getDocs(requestsQuery);
      const requests: AdminRequest[] = requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AdminRequest));
      
      // ترتيب حسب التاريخ (الأحدث أولاً)
      requests.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
      setAdminRequests(requests);
    } catch (error) {
      console.error('Error fetching admin requests:', error);
    }
  };

  // جلب تفاصيل الحضور لتاريخ محدد
  const fetchAttendanceDetails = async (dateStr: string) => {
    if (!isSupervisor) return;
    
    setLoadingAttendance(true);
    try {
      const filterCenterId = selectedCenterId || null;
      
      // جلب المجموعات للمركز المختار
      let groupIds: string[] = [];
      let groupsMap = new Map<string, string>();
      
      if (filterCenterId) {
        const groupsQuery = query(
          collection(db, 'groups'),
          where('centerId', '==', filterCenterId)
        );
        const groupsSnap = await getDocs(groupsQuery);
        groupsSnap.docs.forEach(doc => {
          groupIds.push(doc.id);
          groupsMap.set(doc.id, doc.data().name);
        });
      } else {
        const groupsSnap = await getDocs(collection(db, 'groups'));
        groupsSnap.docs.forEach(doc => {
          groupIds.push(doc.id);
          groupsMap.set(doc.id, doc.data().name);
        });
      }
      
      // جلب أسماء الطلاب
      const studentsMap = new Map<string, {name: string; groupId: string}>();
      let studentsQuery;
      if (filterCenterId) {
        studentsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('centerId', '==', filterCenterId)
        );
      } else {
        studentsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student')
        );
      }
      const studentsSnap = await getDocs(studentsQuery);
      studentsSnap.docs.forEach(doc => {
        studentsMap.set(doc.id, {
          name: doc.data().name,
          groupId: doc.data().groupId
        });
      });
      
      // جلب سجلات الحضور لهذا التاريخ
      const targetDate = new Date(dateStr);
      targetDate.setHours(0, 0, 0, 0);
      
      const attendanceSnap = await getDocs(collection(db, 'attendance'));
      const details: {studentId: string; studentName: string; status: string; groupName: string}[] = [];
      
      attendanceSnap.docs.forEach(doc => {
        const data = doc.data();
        
        // تصفية حسب المجموعات
        if (!groupIds.includes(data.groupId)) return;
        
        // تصفية حسب التاريخ
        let recordDate: Date | null = null;
        if (data.date && typeof data.date.toDate === 'function') {
          recordDate = data.date.toDate();
        } else if (data.date) {
          recordDate = new Date(data.date);
        }
        
        if (!recordDate) return;
        recordDate.setHours(0, 0, 0, 0);
        
        if (recordDate.getTime() !== targetDate.getTime()) return;
        
        const studentInfo = studentsMap.get(data.studentId);
        if (studentInfo) {
          details.push({
            studentId: data.studentId,
            studentName: studentInfo.name,
            status: data.status || 'غير محدد',
            groupName: groupsMap.get(data.groupId) || 'غير محدد'
          });
        }
      });
      
      // ترتيب حسب الاسم
      details.sort((a, b) => a.studentName.localeCompare(b.studentName, 'ar'));
      
      setAttendanceDetails(details);
      
      // تحديث الملخص
      const presentCount = details.filter(d => d.status === 'حاضر' || d.status === 'متأخر').length;
      const absentCount = details.filter(d => d.status === 'غائب' || d.status === 'غائب بعذر').length;
      
      setAttendanceSummary(prev => ({
        ...prev,
        present: presentCount,
        absent: absentCount,
        total: details.length
      }));
      
    } catch (error) {
      console.error('Error fetching attendance details:', error);
    } finally {
      setLoadingAttendance(false);
    }
  };

  // تحديث حالة الطلب إلى "تم"
  const markRequestAsDone = async (requestId: string) => {
    setProcessingRequest(requestId);
    try {
      await updateDoc(doc(db, 'admin_requests', requestId), {
        status: 'done',
        completedAt: new Date().toISOString()
      });
      setAdminRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (error) {
      console.error('Error updating request:', error);
      alert('حدث خطأ أثناء تحديث الطلب');
    } finally {
      setProcessingRequest(null);
    }
  };

  // فتح Firebase Auth Console
  const openFirebaseAuth = () => {
    window.open('https://console.firebase.google.com/project/halqatmoza/authentication/users', '_blank');
  };

  // جلب مراكز المشرف
  const fetchSupervisorCenters = async () => {
    if (!isSupervisor) return;
    
    const centerIds = getSupervisorCenterIds();
    if (centerIds.length === 0) return;
    
    try {
      const centersData: Center[] = [];
      for (const centerId of centerIds) {
        const centerDoc = await getDoc(doc(db, 'centers', centerId));
        if (centerDoc.exists()) {
          centersData.push({
            id: centerDoc.id,
            name: centerDoc.data().name
          });
        }
      }
      setSupervisorCenters(centersData);
      
      // تعيين المركز الأول كافتراضي
      if (centersData.length > 0 && !selectedCenterId) {
        setSelectedCenterId(centersData[0].id);
      }
    } catch (error) {
      console.error('Error fetching supervisor centers:', error);
    }
  };

  const fetchDashboard = async () => {
    try {
      let totalStudents = 0;
      let totalUsers = 0;
      let activeGroups = 0;
      let teachers = 0;
      let supervisors = 0;
      let reviewsThisWeek = 0;
      let completedStudents = 0;
      let recentUpdates: { text: string; date: string }[] = [];

      // For teachers - get their groups first
      let teacherGroupIds: string[] = [];
      if (isTeacher && userProfile?.uid) {
        const groupsQuery = query(
          collection(db, 'groups'),
          where('teacherId', '==', userProfile.uid)
        );
        const groupsSnapshot = await getDocs(groupsQuery);
        teacherGroupIds = groupsSnapshot.docs.map(doc => doc.id);
        setTeacherGroups(teacherGroupIds);
        activeGroups = teacherGroupIds.length;

        // Count students in teacher's groups
        if (teacherGroupIds.length > 0) {
          for (const groupId of teacherGroupIds) {
            const studentsQuery = query(
              collection(db, 'users'),
              where('role', '==', 'student'),
              where('status', '==', 'approved'),
              where('groupId', '==', groupId)
            );
            const studentsSnapshot = await getDocs(studentsQuery);
            totalStudents += studentsSnapshot.size;
          }
        }

        // Get teacher's recent achievements (تحصيل)
        const achievementsSnap = await getDocs(collection(db, 'student_achievements'));
        const teacherAchievements = achievementsSnap.docs
          .filter(doc => {
            const data = doc.data();
            // Filter by students in teacher's groups
            return true; // We'll filter by date mainly
          })
          .map(doc => {
            const data = doc.data();
            let dateStr = '';
            if (data.date) {
              dateStr = data.date;
            }
            return {
              ...data,
              id: doc.id,
              dateStr
            };
          })
          .sort((a: any, b: any) => {
            return new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime();
          })
          .slice(0, 5);

        // Get student names for achievements
        const studentsMap = new Map<string, string>();
        if (teacherGroupIds.length > 0) {
          for (const groupId of teacherGroupIds) {
            const studentsQuery = query(
              collection(db, 'users'),
              where('role', '==', 'student'),
              where('groupId', '==', groupId)
            );
            const studentsSnapshot = await getDocs(studentsQuery);
            studentsSnapshot.docs.forEach(doc => {
              studentsMap.set(doc.id, doc.data().name);
            });
          }
        }

        // Format recent updates from achievements
        recentUpdates = teacherAchievements
          .filter((a: any) => studentsMap.has(a.studentId))
          .map((a: any) => ({
            text: `تم تسجيل تحصيل للطالب ${studentsMap.get(a.studentId) || 'غير محدد'} - ${a.portion || ''} (${a.fromAya}-${a.toAya})`,
            date: a.dateStr
          }))
          .slice(0, 5);

        // Get attendance records count this week
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const attendanceSnap = await getDocs(collection(db, 'attendance'));
        reviewsThisWeek = attendanceSnap.docs.filter(doc => {
          const data = doc.data();
          if (!teacherGroupIds.includes(data.groupId)) return false;
          let date: Date | null = null;
          if (data.date && typeof data.date.toDate === 'function') {
            date = data.date.toDate();
          } else if (data.date) {
            date = new Date(data.date);
          }
          return date && date >= weekAgo && date <= now;
        }).length;

      } else {
        // Admin/Supervisor view
        // تحديد المركز المستخدم للفلترة
        const filterCenterId = isSupervisor && selectedCenterId ? selectedCenterId : null;
        
        // جميع المستخدمين
        if (filterCenterId) {
          const filteredUsersQuery = query(
            collection(db, 'users'),
            where('centerId', '==', filterCenterId)
          );
          const filteredUsersSnap = await getDocs(filteredUsersQuery);
          totalUsers = filteredUsersSnap.size;
        } else {
          const allUsersSnap = await getDocs(collection(db, 'users'));
          totalUsers = allUsersSnap.size;
        }

        // students from users collection
        let studentsQuery;
        if (filterCenterId) {
          studentsQuery = query(
            collection(db, 'users'),
            where('role', '==', 'student'),
            where('status', '==', 'approved'),
            where('centerId', '==', filterCenterId)
          );
        } else {
          studentsQuery = query(
            collection(db, 'users'),
            where('role', '==', 'student'),
            where('status', '==', 'approved')
          );
        }
        const studentsSnap = await getDocs(studentsQuery);
        totalStudents = studentsSnap.size;
        
        // Get student IDs for filtering achievements
        const studentIds = studentsSnap.docs.map(doc => doc.id);

        // Count successful students (with achievements and high average ratings)
        try {
          const achievementsSnap = await getDocs(collection(db, 'student_achievements'));
          const studentAchievementsMap = new Map<string, number[]>();
          
          // Group achievements by student and collect ratings (filter by center students if needed)
          achievementsSnap.docs.forEach(doc => {
            const data = doc.data();
            // Filter by students in the selected center
            if (filterCenterId && !studentIds.includes(data.studentId)) return;
            
            if (data.studentId && data.challengePassed && data.rating) {
              if (!studentAchievementsMap.has(data.studentId)) {
                studentAchievementsMap.set(data.studentId, []);
              }
              studentAchievementsMap.get(data.studentId)!.push(data.rating);
            }
          });
          
          // Count students with at least 5 achievements with average rating >= 7
          let completedCount = 0;
          studentAchievementsMap.forEach((ratings, studentId) => {
            const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
            if (ratings.length >= 5 && avgRating >= 7) {
              completedCount++;
            }
          });
          
          completedStudents = completedCount;
        } catch (e) {
          console.error('Error calculating completed students:', e);
          completedStudents = 0;
        }

        // groups (active) - filter by center if needed
        try {
          if (filterCenterId) {
            const groupsQuery = query(
              collection(db, 'groups'),
              where('centerId', '==', filterCenterId)
            );
            const groupsSnap = await getDocs(groupsQuery);
            activeGroups = groupsSnap.size;
          } else {
            const groupsSnap = await getDocs(collection(db, 'groups'));
            activeGroups = groupsSnap.size;
          }
        } catch (e) {
          console.error('Error fetching groups:', e);
          activeGroups = 0;
        }

        // teachers from users collection - filter by center if needed
        let teachersQuery;
        if (filterCenterId) {
          teachersQuery = query(
            collection(db, 'users'),
            where('role', '==', 'teacher'),
            where('centerId', '==', filterCenterId)
          );
        } else {
          teachersQuery = query(
            collection(db, 'users'),
            where('role', '==', 'teacher')
          );
        }
        const teachersSnap = await getDocs(teachersQuery);
        teachers = teachersSnap.size;

        // supervisors from users collection
        const supervisorsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'supervisor')
        );
        const supervisorsSnap = await getDocs(supervisorsQuery);
        supervisors = supervisorsSnap.size;

        // Admin recent activities (أعمال المطور)
        if (isAdmin) {
          recentUpdates = [
            { text: 'إضافة مشرفين ومعلمين جدد', date: '' },
            { text: 'مراجعة إعدادات النظام', date: '' },
            { text: 'متابعة أداء المراكز', date: '' }
          ];
        } else {
          // sessions -> reviews this week
          const now = new Date();
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const sessionsSnap = await getDocs(collection(db, 'sessions'));
          reviewsThisWeek = sessionsSnap.docs.filter((d) => {
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
          recentUpdates = activitiesSnap.docs
            .map((d) => ({ ...(d.data() as any) }))
            .sort((a: any, b: any) => {
              const da = a.date && typeof a.date.toDate === 'function' ? a.date.toDate() : new Date(a.date || 0);
              const dbt = b.date && typeof b.date.toDate === 'function' ? b.date.toDate() : new Date(b.date || 0);
              return dbt.getTime() - da.getTime();
            })
            .slice(0, 3)
            .map((a: any) => ({
              text: a.description || a.title || 'تحديث جديد',
              date: ''
            }));
        }
      }

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
        totalUsers,
        activeGroups,
        teachers,
        supervisors,
        reviewsThisWeek,
        completedStudents,
        recentUpdates: recentUpdates.length ? recentUpdates : (isTeacher ? [
          { text: 'لم تقم بتسجيل أي تحصيل بعد', date: '' }
        ] : isAdmin ? [
          { text: 'إضافة مشرفين ومعلمين جدد', date: '' },
          { text: 'مراجعة إعدادات النظام', date: '' },
          { text: 'متابعة أداء المراكز', date: '' }
        ] : [
          { text: 'تم إضافة مجموعة جديدة لحفظ جزء عمّ.', date: '' },
          { text: 'اكتمل تسميع خمسة طلاب لجزء تبارك هذا الأسبوع.', date: '' },
          { text: 'بدء التسجيل للفصل الصيفي القادم.', date: '' }
        ]),
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setStats((prev) => ({ ...prev, loading: false, error: 'خطأ في جلب البيانات من قاعدة البيانات' }));
    }
  };

  useEffect(() => {
    fetchSupervisorCenters();
  }, []);

  // إعادة جلب البيانات عند تغيير المركز المختار
  useEffect(() => {
    fetchDashboard();
  }, [selectedCenterId]);

  // جلب تفاصيل الحضور عند تغيير التاريخ أو المركز
  useEffect(() => {
    if (isSupervisor && selectedCenterId) {
      fetchAttendanceDetails(attendanceDate);
    }
  }, [attendanceDate, selectedCenterId, isSupervisor]);

  // جلب طلبات المطور عند تحديد isAdmin
  useEffect(() => {
    if (isAdmin) {
      fetchAdminRequests();
    }
  }, [isAdmin]);

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

  const cards = isTeacher ? [
    { title: 'طلابي', value: stats.totalStudents.toString(), description: 'طلاب في حلقاتي' },
    { title: 'حلقاتي', value: stats.activeGroups.toString(), description: 'عدد الحلقات المسندة إلي' },
    { title: 'تسجيلات الحضور', value: stats.reviewsThisWeek.toString(), description: 'تسجيلات هذا الأسبوع' }
  ] : isAdmin ? [
    { title: 'إجمالي المستخدمين', value: stats.totalUsers.toString(), description: 'جميع المستخدمين في النظام' },
    { title: 'المشرفون', value: stats.supervisors.toString(), description: 'عدد المشرفين' },
    { title: 'المعلمون', value: stats.teachers.toString(), description: 'عدد المعلمين' },
    { title: 'الطلاب', value: stats.totalStudents.toString(), description: 'طلاب مسجلون حالياً' },
    { title: 'الطلاب الناجحون', value: stats.completedStudents.toString(), description: 'طلاب اجتازوا المقررات بنجاح' }
  ] : [
    { title: 'إجمالي الطلاب', value: stats.totalStudents.toString(), description: 'طلاب مسجلون حالياً' },
    { title: 'المجموعات', value: stats.activeGroups.toString(), description: 'إجمالي عدد المجموعات' },
    { title: 'المدرسون', value: stats.teachers.toString(), description: 'مشرفون على الحلقات' },
    { title: 'الطلاب الناجحون', value: stats.completedStudents.toString(), description: 'طلاب اجتازوا المقررات بنجاح' }
  ];

  return (
    <section className="page">
      <header className="page__header">
        <h1>لوحة التحكم</h1>
        <p>{isTeacher ? `مرحباً ${userProfile?.name || 'بك'}، هذه لوحة التحكم الخاصة بك.` : 'مرحباً بك في مركز متابعة تحفيظ القرآن.'}</p>
      </header>

      {/* اختيار المركز للمشرفين */}
      {isSupervisor && supervisorCenters.length > 1 && (
        <div className="center-selector-card" style={{
          background: '#eef2ff',
          border: '2px solid #4f46e5',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontWeight: '600', color: '#4f46e5' }}>🏛️ المركز الحالي:</span>
          <select
            value={selectedCenterId}
            onChange={(e) => setSelectedCenterId(e.target.value)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '2px solid #4f46e5',
              fontSize: '1rem',
              fontWeight: '500',
              background: 'white',
              color: '#333',
              cursor: 'pointer',
              minWidth: '200px'
            }}
          >
            {supervisorCenters.map(center => (
              <option key={center.id} value={center.id}>{center.name}</option>
            ))}
          </select>
          <span style={{ color: '#666', fontSize: '0.9rem' }}>
            (أنت مشرف على {supervisorCenters.length} مراكز)
          </span>
        </div>
      )}

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

      {/* قسم آخر أعمالي للمعلمين فقط */}
      {isTeacher && (
        <section className="overview-card">
          <h2>آخر أعمالي</h2>
          <ul className="overview-list">
            {stats.recentUpdates.map((u, i) => (
              <li key={i}>
                {u.text}
                {u.date && <span className="update-date"> - {u.date}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* طلبات المطور المعلقة */}
      {isAdmin && adminRequests.length > 0 && (
        <section className="admin-requests-card" style={{
          background: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: '12px',
          padding: '20px',
          marginTop: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, color: '#856404', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚠️</span>
              طلبات معلقة ({adminRequests.length})
            </h2>
            <button
              onClick={openFirebaseAuth}
              style={{
                padding: '10px 20px',
                background: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🔗 فتح Firebase Auth
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {adminRequests.map((request) => (
              <div key={request.id} style={{
                background: 'white',
                borderRadius: '8px',
                padding: '16px',
                border: '1px solid #e0e0e0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <div style={{ 
                    display: 'inline-block',
                    background: request.type === 'delete_auth_user' ? '#dc3545' : '#6c757d',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    marginBottom: '8px'
                  }}>
                    {request.type === 'delete_auth_user' ? '🗑️ حذف مستخدم' : request.type}
                  </div>
                  <div style={{ fontWeight: '600', fontSize: '1.1rem', color: '#333', marginBottom: '4px' }}>
                    {request.userName}
                  </div>
                  <div style={{ color: '#666', fontSize: '0.9rem', marginBottom: '4px' }}>
                    📧 {request.userEmail}
                  </div>
                  <div style={{ color: '#888', fontSize: '0.85rem' }}>
                    👤 طلب بواسطة: {request.requestedBy} ({request.requestedByRole})
                  </div>
                  <div style={{ color: '#888', fontSize: '0.85rem' }}>
                    📅 {new Date(request.requestedAt).toLocaleDateString('ar-SA', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(request.userEmail);
                      alert('تم نسخ البريد الإلكتروني');
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    📋 نسخ البريد
                  </button>
                  <button
                    onClick={() => markRequestAsDone(request.id)}
                    disabled={processingRequest === request.id}
                    style={{
                      padding: '8px 16px',
                      background: processingRequest === request.id ? '#ccc' : '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: processingRequest === request.id ? 'not-allowed' : 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600'
                    }}
                  >
                    {processingRequest === request.id ? '⏳ جاري...' : '✅ تم'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* رسالة عند عدم وجود طلبات معلقة */}
      {isAdmin && adminRequests.length === 0 && (
        <section style={{
          background: '#d4edda',
          border: '2px solid #28a745',
          borderRadius: '12px',
          padding: '20px',
          marginTop: '24px',
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#155724', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span>✅</span>
            لا توجد طلبات معلقة
          </h3>
        </section>
      )}

      {/* إخفاء ملخص الحضور اليومي وتنبيهات الحضور للمطور */}
      {!isAdmin && (
        <>
          <section className="attendance-summary-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h2 style={{ margin: 0 }}>ملخص الحضور</h2>
              {isSupervisor && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '0.9rem', color: '#666' }}>📅 التاريخ:</label>
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #ddd',
                      fontSize: '0.9rem',
                      cursor: 'pointer'
                    }}
                  />
                </div>
              )}
            </div>
            
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
            
            {/* جدول تفاصيل الحضور للمشرف */}
            {isSupervisor && (
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '1rem', color: '#333', marginBottom: '12px', borderBottom: '2px solid #4caf50', paddingBottom: '8px' }}>
                  📋 تفاصيل الحضور
                  {attendanceDetails.length > 0 && (
                    <span style={{ fontSize: '0.85rem', color: '#666', fontWeight: 'normal', marginRight: '10px' }}>
                      ({attendanceDetails.length} سجل)
                    </span>
                  )}
                </h3>
                
                {loadingAttendance ? (
                  <p style={{ textAlign: 'center', color: '#666' }}>جاري تحميل البيانات...</p>
                ) : attendanceDetails.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#999', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                    لا توجد سجلات حضور لهذا التاريخ
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#2e7d32' }}>
                        <tr>
                          <th style={{ padding: '12px 15px', textAlign: 'right', color: 'white', fontWeight: '600' }}>اسم الطالب</th>
                          <th style={{ padding: '12px 15px', textAlign: 'center', color: 'white', fontWeight: '600' }}>الحالة</th>
                          <th style={{ padding: '12px 15px', textAlign: 'right', color: 'white', fontWeight: '600' }}>الحلقة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceDetails.map((item, index) => (
                          <tr key={item.studentId + index} style={{ 
                            backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9',
                            borderBottom: '1px solid #eee'
                          }}>
                            <td style={{ padding: '10px 15px', fontWeight: '500' }}>{item.studentName}</td>
                            <td style={{ padding: '10px 15px', textAlign: 'center' }}>
                              <span style={{
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                backgroundColor: 
                                  item.status === 'حاضر' ? '#e8f5e9' :
                                  item.status === 'متأخر' ? '#fff3e0' :
                                  item.status === 'غائب' ? '#ffebee' :
                                  item.status === 'غائب بعذر' ? '#e3f2fd' : '#f5f5f5',
                                color: 
                                  item.status === 'حاضر' ? '#2e7d32' :
                                  item.status === 'متأخر' ? '#e65100' :
                                  item.status === 'غائب' ? '#c62828' :
                                  item.status === 'غائب بعذر' ? '#1565c0' : '#666'
                              }}>
                                {item.status === 'حاضر' && '✓ '}
                                {item.status === 'متأخر' && '⏰ '}
                                {item.status === 'غائب' && '✗ '}
                                {item.status === 'غائب بعذر' && '📝 '}
                                {item.status}
                              </span>
                            </td>
                            <td style={{ padding: '10px 15px', color: '#666', fontSize: '0.85rem' }}>{item.groupName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
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
        </>
      )}
    </section>
  );
};

export default Dashboard;

