import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc, query, where, getDoc, addDoc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, secondaryAuth } from '../firebase';
import { useAuth, UserProfile } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import MessageBox from '../components/MessageBox';
import '../styles/PendingRequests.css';

// New curriculum interfaces from Firebase
interface CurriculumStage {
  id: string;
  name: string;
  order: number;
}

interface CurriculumLevel {
  id: string;
  name: string;
  order: number;
  stages: CurriculumStage[];
}

interface PendingStudent extends UserProfile {
  centerName?: string;
  interviewDate?: string;
  interviewTime?: string;
  phoneNumber?: string;
}

interface Group {
  id: string;
  name: string;
  teacherName?: string;
  trackId?: string;
}

interface Track {
  id: string;
  name: string;
  centerId: string;
}

const PendingRequests = () => {
  const { isSupervisor, userProfile, getSupervisorCenterIds } = useAuth();
  const [pendingStudents, setPendingStudents] = useState<PendingStudent[]>([]);
  const [interviewStudents, setInterviewStudents] = useState<PendingStudent[]>([]);
  const [pendingLevelApprovals, setPendingLevelApprovals] = useState<PendingStudent[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [curriculumLevels, setCurriculumLevels] = useState<CurriculumLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showTrackGroupModal, setShowTrackGroupModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<PendingStudent | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('');
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  
  // فلترة وترتيب
  const [filterCenterId, setFilterCenterId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'center'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [centers, setCenters] = useState<{id: string, name: string}[]>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  
  // Message Box state
  const [messageBox, setMessageBox] = useState<{
    open: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({ open: false, type: 'info', title: '', message: '' });

  const showMessage = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    setMessageBox({ open: true, type, title, message });
  };

  // الحصول على مراكز المشرف
  const supervisorCenterIds = getSupervisorCenterIds();

  useEffect(() => {
    if (supervisorCenterIds.length > 0) {
      fetchCurriculum();
      fetchPendingStudents();
      fetchGroups();
      fetchTracks();
      fetchCenters();
    }
  }, [userProfile, supervisorCenterIds.length]);

  // جلب قائمة المراكز
  const fetchCenters = async () => {
    try {
      const centersList: {id: string, name: string}[] = [];
      for (const centerId of supervisorCenterIds) {
        const centerDoc = await getDoc(doc(db, 'centers', centerId));
        if (centerDoc.exists()) {
          centersList.push({ id: centerId, name: centerDoc.data().name });
        }
      }
      setCenters(centersList);
    } catch (error) {
      console.error('Error fetching centers:', error);
    }
  };

  // دالة الفلترة والترتيب
  const filterAndSortStudents = (students: PendingStudent[]) => {
    let filtered = [...students];
    
    // فلترة حسب المركز
    if (filterCenterId !== 'all') {
      filtered = filtered.filter(s => s.centerId === filterCenterId);
    }
    
    // الترتيب
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '', 'ar');
          break;
        case 'center':
          comparison = (a.centerName || '').localeCompare(b.centerName || '', 'ar');
          break;
        case 'date':
        default:
          const dateA = a.createdAt ? (typeof a.createdAt === 'object' && 'toDate' in a.createdAt ? (a.createdAt as any).toDate() : new Date(a.createdAt as string)) : new Date(0);
          const dateB = b.createdAt ? (typeof b.createdAt === 'object' && 'toDate' in b.createdAt ? (b.createdAt as any).toDate() : new Date(b.createdAt as string)) : new Date(0);
          comparison = dateA.getTime() - dateB.getTime();
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  };

  // تجميع الطلاب حسب المركز
  const groupByCenter = (students: PendingStudent[]) => {
    const grouped: { [centerId: string]: { centerName: string, students: PendingStudent[] } } = {};
    
    students.forEach(student => {
      const centerId = student.centerId || 'unknown';
      if (!grouped[centerId]) {
        grouped[centerId] = { centerName: student.centerName || 'غير محدد', students: [] };
      }
      grouped[centerId].students.push(student);
    });
    
    return grouped;
  };

  const fetchTracks = async () => {
    try {
      if (supervisorCenterIds.length === 0) return;
      
      // جلب المساقات لجميع مراكز المشرف
      let allTracks: Track[] = [];
      for (const centerId of supervisorCenterIds) {
        const tracksQuery = query(
          collection(db, 'tracks'),
          where('centerId', '==', centerId)
        );
        const tracksSnap = await getDocs(tracksQuery);
        const tracksList = tracksSnap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          centerId: centerId
        }));
        allTracks = [...allTracks, ...tracksList];
      }
      setTracks(allTracks);
    } catch (error) {
      console.error('Error fetching tracks:', error);
    }
  };

  // Fetch curriculum from Firebase
  const fetchCurriculum = async () => {
    if (supervisorCenterIds.length === 0) return;

    try {
      const levels: CurriculumLevel[] = [];
      
      for (const centerId of supervisorCenterIds) {
        const curriculumRef = collection(db, 'curriculum');
        const q = query(curriculumRef, where('centerId', '==', centerId));
        const snapshot = await getDocs(q);
        
        snapshot.forEach(docSnap => {
          levels.push({
            id: docSnap.id,
            ...docSnap.data()
          } as CurriculumLevel);
        });
      }
      
      levels.sort((a, b) => a.order - b.order);
      setCurriculumLevels(levels);
    } catch (error) {
      console.error('Error fetching curriculum:', error);
    }
  };

  const fetchGroups = async () => {
    try {
      if (supervisorCenterIds.length === 0) return;
      
      // جلب المجموعات لجميع مراكز المشرف
      let allGroupsDocs: any[] = [];
      for (const centerId of supervisorCenterIds) {
        const groupsQuery = query(
          collection(db, 'groups'),
          where('centerId', '==', centerId)
        );
        const groupsSnap = await getDocs(groupsQuery);
        allGroupsDocs = [...allGroupsDocs, ...groupsSnap.docs];
      }
      
      // جلب أسماء المعلمين
      const teachersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'teacher')
      );
      const teachersSnap = await getDocs(teachersQuery);
      const teachersMap = new Map(
        teachersSnap.docs.map(doc => [doc.data().uid, doc.data().name])
      );

      const groupsList = allGroupsDocs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        trackId: doc.data().trackId,
        teacherName: teachersMap.get(doc.data().teacherId) || 'غير محدد'
      }));
      
      setGroups(groupsList);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchPendingStudents = async () => {
    if (supervisorCenterIds.length === 0) return;

    try {
      // جلب المستخدمين من جميع مراكز المشرف
      let allDocs: any[] = [];
      const centerNames: Map<string, string> = new Map();
      
      for (const centerId of supervisorCenterIds) {
        const q = query(
          collection(db, 'users'),
          where('centerId', '==', centerId)
        );
        const querySnapshot = await getDocs(q);
        allDocs = [...allDocs, ...querySnapshot.docs];
        
        // Get center name
        const centerDoc = await getDoc(doc(db, 'centers', centerId));
        const centerName = centerDoc.exists() ? centerDoc.data().name : 'غير محدد';
        centerNames.set(centerId, centerName);
      }

      const allUsers = allDocs.map(docSnap => {
        const data = docSnap.data();
        return {
          uid: docSnap.id,
          ...data,
          centerName: centerNames.get(data.centerId) || 'غير محدد'
        } as PendingStudent;
      });

      // Filter for Students only
      const allStudents = allUsers.filter(u => u.role === 'student');

      // Filter for Registration Requests (pending_registration)
      const registrationRequests = allStudents.filter(s => s.status === 'pending_registration');
      setPendingStudents(registrationRequests);

      // Filter for Interview Scheduled (interview_scheduled)
      const interviewScheduled = allStudents.filter(s => s.status === 'interview_scheduled');
      setInterviewStudents(interviewScheduled);

      // Filter for Stage/Level Advancement Requests (either stageStatus OR levelStatus)
      const stageRequests = allStudents.filter(s => s.stageStatus === 'pending_supervisor' || s.levelStatus === 'pending_supervisor');
      setPendingLevelApprovals(stageRequests);

    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLevelApprove = async (student: PendingStudent) => {
    const isLevelUp = student.pendingLevelUp === true;
    const message = isLevelUp 
      ? 'هل أنت متأكد من اعتماد انتقال الطالب للمستوى التالي؟'
      : 'هل أنت متأكد من اعتماد انتقال الطالب للمرحلة التالية؟';
    
    if (!window.confirm(message)) return;
    
    setProcessing(student.uid);
    try {
      if (isLevelUp) {
        // Level advancement - Find next level from Firebase curriculum
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
          showMessage('success', 'تم الاعتماد', `تم اعتماد انتقال الطالب ${student.name} للمستوى التالي بنجاح`);
        } else {
          // Finished all levels
          await updateDoc(doc(db, 'users', student.uid), {
            levelStatus: 'completed',
            stageStatus: null,
            pendingLevelUp: null,
            completedLevels: curriculumLevels.length,
            totalPoints: (student.totalPoints || 0) + 500
          });
          showMessage('success', '🎉 مبارك!', `أتم الطالب ${student.name} جميع المستويات بنجاح!\nهذا إنجاز عظيم!`);
        }
      } else {
        // Stage advancement (within same level) - should not happen anymore
        // Stages now transition automatically, only levels need approval
        await updateDoc(doc(db, 'users', student.uid), {
          stageStatus: null,
          pendingLevelUp: null
        });
        showMessage('success', 'تم الاعتماد', 'تم اعتماد الطلب بنجاح');
      }
      
      setPendingLevelApprovals(prev => prev.filter(s => s.uid !== student.uid));
    } catch (error) {
      console.error('Error approving:', error);
      showMessage('error', 'خطأ', 'حدث خطأ أثناء الاعتماد. يرجى المحاولة مرة أخرى.');
    } finally {
      setProcessing(null);
    }
  };

  // دالة لفتح نافذة تحديد موعد المقابلة
  const handleScheduleInterview = (student: PendingStudent) => {
    setSelectedStudent(student);
    setInterviewDate('');
    setInterviewTime('');
    setShowInterviewModal(true);
  };

  // دالة لتأكيد موعد المقابلة وإرسال رسالة واتساب
  const confirmInterview = async () => {
    if (!selectedStudent) return;
    if (!interviewDate || !interviewTime) {
      showMessage('warning', 'تنبيه', 'يرجى تحديد التاريخ والوقت');
      return;
    }

    setProcessing(selectedStudent.uid);
    try {
      // تحديث حالة الطالب إلى interview_scheduled
      await updateDoc(doc(db, 'users', selectedStudent.uid), {
        status: 'interview_scheduled',
        interviewDate: interviewDate,
        interviewTime: interviewTime
      });

      showMessage('success', 'تم تحديد الموعد', `تم تحديد موعد المقابلة للطالب ${selectedStudent.name}`);
      setShowInterviewModal(false);
      setSelectedStudent(null);
      fetchPendingStudents();
      
      // فتح واتساب مع الرسالة المعدة
      openWhatsApp();
    } catch (error) {
      console.error('Error scheduling interview:', error);
      showMessage('error', 'خطأ', 'حدث خطأ أثناء تحديد موعد المقابلة.');
    } finally {
      setProcessing(null);
    }
  };

  // دالة لفتح واتساب مع الرسالة
  const openWhatsApp = () => {
    if (!selectedStudent || !interviewDate || !interviewTime) return;

    const phoneNumber = selectedStudent.phone || selectedStudent.phoneNumber || '';
    const centerName = selectedStudent.centerName || 'المركز';
    const studentName = selectedStudent.name;
    
    // تنسيق التاريخ
    const formattedDate = new Date(interviewDate).toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const message = `السلام عليكم ورحمة الله وبركاته

الطالب ${studentName}
تم قبولك في ${centerName}
موعد المقابلة: ${formattedDate} الساعة ${interviewTime}

نسأل الله لك التوفيق والسداد`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
  };

  // دالة لفتح نافذة اختيار المساق والمجموعة (من قسم المقابلات)
  const handleApproveFromInterview = (student: PendingStudent) => {
    setSelectedStudent(student);
    setSelectedTrackId('');
    setSelectedGroupId('');
    setShowTrackGroupModal(true);
  };

  // دالة لتأكيد قبول الطالب من قسم المقابلات
  // عند تأكيد اختيار المساق والمجموعة - إنشاء الحساب مباشرة
  const confirmApproveFromInterview = async () => {
    if (!selectedStudent) return;
    if (!selectedTrackId || !selectedGroupId) {
      showMessage('warning', 'تنبيه', 'يرجى اختيار المساق والمجموعة');
      return;
    }

    if (!selectedStudent.personalId) {
      showMessage('error', 'خطأ', 'الطالب ليس لديه رقم شخصي. يرجى التأكد من تسجيله برقم شخصي.');
      return;
    }

    // توليد كلمة مرور مؤقتة تلقائياً
    const tempPassword = generateTempPassword();

    setProcessing(selectedStudent.uid);
    try {
      // 1. إنشاء بريد إلكتروني داخلي من الرقم الشخصي
      const internalEmail = `${selectedStudent.personalId}@quran-center.local`;

      let newUid: string;
      let passwordToSend = tempPassword;

      // 2. التحقق إذا كان هناك حساب موجود بهذا البريد الإلكتروني في Firestore
      const existingUserQuery = query(collection(db, 'users'), where('email', '==', internalEmail));
      const existingUserSnap = await getDocs(existingUserQuery);

      if (!existingUserSnap.empty) {
        // الحساب موجود بالفعل - استخدام الـ UID الموجود
        const existingUser = existingUserSnap.docs[0];
        newUid = existingUser.id;
        
        // استخدام كلمة المرور المحفوظة إن وجدت
        const existingData = existingUser.data();
        if (existingData.tempPassword) {
          passwordToSend = existingData.tempPassword;
        }
        
        // تحديث البيانات للمستخدم الموجود
        await updateDoc(doc(db, 'users', newUid), {
          status: 'waiting_teacher_approval',
          groupId: selectedGroupId,
          trackId: selectedTrackId,
          approvedByInterviewAt: new Date().toISOString()
        });
        
        // حذف الـ document القديم إذا كان مختلفاً
        if (selectedStudent.uid !== newUid) {
          await deleteDoc(doc(db, 'users', selectedStudent.uid));
        }
      } else {
        // لا يوجد حساب - إنشاء حساب جديد
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, internalEmail, tempPassword);
          newUid = userCredential.user.uid;

          // تسجيل الخروج من التطبيق الثانوي فوراً
          await signOut(secondaryAuth);

          // جلب البيانات القديمة
          const oldDocRef = doc(db, 'users', selectedStudent.uid);
          const oldDocSnap = await getDoc(oldDocRef);
          
          if (!oldDocSnap.exists()) {
            throw new Error('لم يتم العثور على بيانات الطالب');
          }

          const oldData = oldDocSnap.data();

          // إنشاء document جديد بـ Auth UID
          await setDoc(doc(db, 'users', newUid), {
            ...oldData,
            uid: newUid,
            email: internalEmail,
            tempPassword: tempPassword,
            status: 'waiting_teacher_approval',
            groupId: selectedGroupId,
            trackId: selectedTrackId,
            approvedByInterviewAt: new Date().toISOString()
          });

          // حذف الـ document القديم
          await deleteDoc(oldDocRef);
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            // الحساب موجود في Auth لكن ليس في Firestore
            // هذا يعني أن هناك محاولة سابقة فشلت بعد إنشاء الـ Auth
            // سنحتاج لحذف هذا الحساب من Firebase Console أو Admin SDK
            showMessage('error', 'خطأ', 
              'يوجد حساب سابق غير مكتمل لهذا الطالب. يرجى التواصل مع مدير النظام لإصلاح هذه المشكلة.\n\n' +
              'الرقم الشخصي: ' + selectedStudent.personalId);
            return;
          }
          throw authError;
        }
      }

      // جلب معلومات المركز والمساق والحلقة
      const centerName = selectedStudent.centerName || 'مركز تحفيظ القرآن الكريم';
      const trackName = tracks.find(t => t.id === selectedTrackId)?.name || 'غير محدد';
      const selectedGroup = groups.find(g => g.id === selectedGroupId);
      const groupName = selectedGroup?.name || 'غير محدد';
      const teacherName = selectedGroup?.teacherName || 'غير محدد';

      // إرسال رسالة واتساب مع بيانات الدخول
      const phone = selectedStudent.phone || selectedStudent.phoneNumber;
      if (phone) {
        const whatsappMessage = `*مبارك ${selectedStudent.name}!*

تهانينا! لقد اجتزت المقابلة بنجاح

*معلومات التسجيل:*
━━━━━━━━━━━━━━━
المركز: *${centerName}*
المساق: *${trackName}*
الحلقة: *${groupName}*
المعلم: *${teacherName}*
━━━━━━━━━━━━━━━

*بيانات تسجيل الدخول:*
━━━━━━━━━━━━━━━
الرقم الشخصي: *${selectedStudent.personalId}*
كلمة المرور: *${passwordToSend}*
━━━━━━━━━━━━━━━

رابط الموقع: ${window.location.origin}

يرجى تغيير كلمة المرور بعد أول تسجيل دخول.

نتمنى لك التوفيق في رحلتك مع القرآن الكريم!`;

        const whatsappUrl = `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(whatsappUrl, '_blank');
      }
      
      showMessage('success', 'تم إنشاء الحساب', `تم إنشاء حساب الطالب ${selectedStudent.name} بنجاح.\n\nكلمة المرور المؤقتة: ${passwordToSend}`);
      setShowTrackGroupModal(false);
      setSelectedStudent(null);
      fetchPendingStudents();
    } catch (error: any) {
      console.error('Error creating student account:', error);
      showMessage('error', 'خطأ', `حدث خطأ أثناء إنشاء حساب الطالب: ${error.message}`);
    } finally {
      setProcessing(null);
    }
  };

  // توليد كلمة مرور مؤقتة عشوائية
  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleApprove = (student: PendingStudent) => {
    handleScheduleInterview(student);
  };

  const handleReject = async (student: PendingStudent) => {
    if (!window.confirm(`هل أنت متأكد من رفض طلب الطالب ${student.name}؟`)) return;

    setProcessing(student.uid);
    try {
      await updateDoc(doc(db, 'users', student.uid), {
        status: 'rejected',
        active: false
      });
      showMessage('info', 'تم الرفض', `تم رفض طلب الطالب ${student.name}`);
      fetchPendingStudents();
    } catch (error) {
      console.error('Error rejecting student:', error);
      showMessage('error', 'خطأ', 'حدث خطأ أثناء رفض الطلب. يرجى المحاولة مرة أخرى.');
    } finally {
      setProcessing(null);
    }
  };

  if (!isSupervisor) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <section className="page">
        <header className="page__header">
          <h1>طلبات الانتظار</h1>
        </header>
        <p>جاري تحميل البيانات...</p>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1>طلبات الانتظار</h1>
        <p>مراجعة طلبات انضمام الطلاب الجدد</p>
      </header>

      {/* شريط الفلترة والترتيب */}
      {centers.length > 1 && (
        <div className="filters-bar" style={{
          display: 'flex',
          gap: '15px',
          flexWrap: 'wrap',
          marginBottom: '20px',
          padding: '15px',
          background: '#f8f9fa',
          borderRadius: '10px',
          alignItems: 'center'
        }}>
          <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: '600', color: '#555' }}>🏫 المركز:</label>
            <select
              value={filterCenterId}
              onChange={(e) => setFilterCenterId(e.target.value)}
              style={{
                padding: '8px 15px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                fontSize: '0.95rem',
                minWidth: '180px'
              }}
            >
              <option value="all">جميع المراكز</option>
              {centers.map(center => (
                <option key={center.id} value={center.id}>{center.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: '600', color: '#555' }}>🗂️ الترتيب:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'center')}
              style={{
                padding: '8px 15px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                fontSize: '0.95rem'
              }}
            >
              <option value="date">حسب التاريخ</option>
              <option value="name">حسب الاسم</option>
              <option value="center">حسب المركز</option>
            </select>
          </div>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            style={{
              padding: '8px 15px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
            title={sortOrder === 'asc' ? 'تصاعدي' : 'تنازلي'}
          >
            {sortOrder === 'asc' ? '⬆️ تصاعدي' : '⬇️ تنازلي'}
          </button>

          <div style={{ display: 'flex', gap: '5px', marginRight: 'auto' }}>
            <button
              onClick={() => setViewMode('cards')}
              style={{
                padding: '8px 15px',
                borderRadius: '8px 0 0 8px',
                border: '1px solid #ddd',
                background: viewMode === 'cards' ? '#667eea' : '#fff',
                color: viewMode === 'cards' ? '#fff' : '#333',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
              title="عرض بطاقات"
            >
              📊 بطاقات
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '8px 15px',
                borderRadius: '0 8px 8px 0',
                border: '1px solid #ddd',
                borderRight: 'none',
                background: viewMode === 'table' ? '#667eea' : '#fff',
                color: viewMode === 'table' ? '#fff' : '#333',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
              title="عرض جدول"
            >
              📄 جدول
            </button>
          </div>
        </div>
      )}

      <div className="pending-container">
      
      {/* قسم طلبات التسجيل الجديدة - في الأعلى */}
      <div className="requests-section">
        <h2>📝 طلبات التسجيل الجديدة</h2>
        {filterAndSortStudents(pendingStudents).length === 0 ? (
          <div className="no-pending">
            <div className="no-pending-icon">✅</div>
            <h2>لا توجد طلبات انتظار</h2>
            <p>جميع طلبات الانضمام تمت مراجعتها</p>
          </div>
        ) : (
          <>
            <div className="pending-count">
              <span className="count-badge">{filterAndSortStudents(pendingStudents).length}</span>
              طلب انتظار
              {filterCenterId !== 'all' && centers.find(c => c.id === filterCenterId) && (
                <span style={{ marginRight: '10px', color: '#666' }}>
                  في {centers.find(c => c.id === filterCenterId)?.name}
                </span>
              )}
            </div>

            {/* عرض الجدول */}
            {viewMode === 'table' ? (
              <div style={{ overflowX: 'auto', marginTop: '15px' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  background: '#fff',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.08)'
                }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' }}>
                      <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '600' }}>#</th>
                      <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '600' }}>الاسم</th>
                      <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '600' }}>الرقم الشخصي</th>
                      <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '600' }}>الهاتف</th>
                      <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '600' }}>المركز</th>
                      <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '600' }}>تاريخ التسجيل</th>
                      <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '600' }}>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterAndSortStudents(pendingStudents).map((student, index) => (
                      <tr key={student.uid} style={{ borderBottom: '1px solid #eee', background: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                        <td style={{ padding: '12px 16px', color: '#888' }}>{index + 1}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '600' }}>{student.name}</td>
                        <td style={{ padding: '12px 16px', color: '#666' }}>{student.personalId || '-'}</td>
                        <td style={{ padding: '12px 16px', direction: 'ltr', textAlign: 'right' }}>{student.phone || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>{student.centerName}</td>
                        <td style={{ padding: '12px 16px', color: '#666', whiteSpace: 'nowrap' }}>
                          {student.createdAt ? (
                            typeof student.createdAt === 'object' && 'toDate' in student.createdAt
                              ? (student.createdAt as any).toDate().toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
                              : new Date(student.createdAt as string).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
                          ) : '-'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleApprove(student)}
                              disabled={processing === student.uid}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#28a745',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                              }}
                            >
                              {processing === student.uid ? '...' : '✓ قبول'}
                            </button>
                            <button
                              onClick={() => handleReject(student)}
                              disabled={processing === student.uid}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#dc3545',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                              }}
                            >
                              {processing === student.uid ? '...' : '✗ رفض'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* عرض البطاقات */
              <>
            {/* عرض مجمع حسب المركز إذا كان الترتيب حسب المركز والفلتر على الكل */}
            {sortBy === 'center' && filterCenterId === 'all' && centers.length > 1 ? (
              Object.entries(groupByCenter(filterAndSortStudents(pendingStudents))).map(([centerId, { centerName, students }]) => (
                <div key={centerId} style={{ marginBottom: '25px' }}>
                  <h3 style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    padding: '12px 20px',
                    borderRadius: '10px',
                    marginBottom: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    🏫 {centerName}
                    <span style={{
                      background: 'rgba(255,255,255,0.2)',
                      padding: '4px 12px',
                      borderRadius: '15px',
                      fontSize: '0.85rem'
                    }}>
                      {students.length} طلب
                    </span>
                  </h3>
                  <div className="pending-list">
                    {students.map(student => (
                      <div key={student.uid} className="pending-card">
                        <div className="pending-card-header">
                          <div className="student-avatar">
                            {student.name.charAt(0)}
                          </div>
                          <div className="student-info">
                            <h3>{student.name}</h3>
                            <span className="student-email">{student.personalId || 'غير محدد'}</span>
                          </div>
                          <span className="status-badge pending">قيد المراجعة</span>
                        </div>
                        <div className="pending-card-body">
                          <div className="info-row">
                            <span className="info-label">📞 الهاتف:</span>
                            <span className="info-value">{student.phone || 'غير محدد'}</span>
                          </div>
                          <div className="info-row">
                            <span className="info-label">📅 تاريخ التسجيل:</span>
                            <span className="info-value">
                              {student.createdAt ? (
                                typeof student.createdAt === 'object' && 'toDate' in student.createdAt
                                  ? (student.createdAt as any).toDate().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
                                  : new Date(student.createdAt as string).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
                              ) : 'غير محدد'}
                            </span>
                          </div>
                        </div>
                        <div className="pending-card-actions">
                          <button className="btn btn-approve" onClick={() => handleApprove(student)} disabled={processing === student.uid}>
                            {processing === student.uid ? '...' : '✓ قبول'}
                          </button>
                          <button className="btn btn-reject" onClick={() => handleReject(student)} disabled={processing === student.uid}>
                            {processing === student.uid ? '...' : '✗ رفض'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="pending-list">
                {filterAndSortStudents(pendingStudents).map(student => (
                <div key={student.uid} className="pending-card">
                  <div className="pending-card-header">
                    <div className="student-avatar">
                      {student.name.charAt(0)}
                    </div>
                    <div className="student-info">
                      <h3>{student.name}</h3>
                      <span className="student-email">{student.personalId || 'غير محدد'}</span>
                    </div>
                    <span className="status-badge pending">قيد المراجعة</span>
                  </div>

                  <div className="pending-card-body">
                    <div className="info-row">
                      <span className="info-label">📞 الهاتف:</span>
                      <span className="info-value">{student.phone || 'غير محدد'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">🏫 المركز:</span>
                      <span className="info-value">{student.centerName}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">📅 تاريخ التسجيل:</span>
                      <span className="info-value">
                        {student.createdAt ? (
                          typeof student.createdAt === 'object' && 'toDate' in student.createdAt
                            ? (student.createdAt as any).toDate().toLocaleDateString('ar-EG', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })
                            : new Date(student.createdAt as string).toLocaleDateString('ar-EG', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })
                        ) : 'غير محدد'}
                      </span>
                    </div>
                  </div>

                  <div className="pending-card-actions">
                    <button
                      className="btn btn-approve"
                      onClick={() => handleApprove(student)}
                      disabled={processing === student.uid}
                    >
                      {processing === student.uid ? '...' : '✓ قبول'}
                    </button>
                    <button
                      className="btn btn-reject"
                      onClick={() => handleReject(student)}
                      disabled={processing === student.uid}
                    >
                      {processing === student.uid ? '...' : '✗ رفض'}
                    </button>
                  </div>
                </div>
              ))}
              </div>
            )}
              </>
            )}
          </>
        )}
      </div>
      
      {/* قسم المقابلات المحددة */}
      <div className="requests-section" style={{ marginTop: '2rem' }}>
        <h2>📅 المقابلات المحددة</h2>
        {filterAndSortStudents(interviewStudents).length === 0 ? (
          <div className="no-pending">
            <div className="no-pending-icon">✅</div>
            <h2>لا توجد مقابلات محددة</h2>
            <p>جميع الطلاب تمت معالجة مقابلاتهم</p>
          </div>
        ) : (
          <>
            <div className="pending-count">
              <span className="count-badge">{filterAndSortStudents(interviewStudents).length}</span>
              مقابلة محددة
            </div>

            {/* عرض الجدول للمقابلات */}
            {viewMode === 'table' ? (
              <div style={{ overflowX: 'auto', marginTop: '15px' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  background: '#fff',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.08)'
                }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)', color: '#fff' }}>
                      <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '600' }}>#</th>
                      <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '600' }}>الاسم</th>
                      <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '600' }}>الرقم الشخصي</th>
                      <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '600' }}>الهاتف</th>
                      <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '600' }}>المركز</th>
                      <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '600' }}>موعد المقابلة</th>
                      <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '600' }}>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterAndSortStudents(interviewStudents).map((student, index) => (
                      <tr key={student.uid} style={{ borderBottom: '1px solid #eee', background: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                        <td style={{ padding: '12px 16px', color: '#888' }}>{index + 1}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '600' }}>{student.name}</td>
                        <td style={{ padding: '12px 16px', color: '#666' }}>{student.personalId || '-'}</td>
                        <td style={{ padding: '12px 16px', direction: 'ltr', textAlign: 'right' }}>{student.phone || student.phoneNumber || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>{student.centerName}</td>
                        <td style={{ padding: '12px 16px', color: '#666', whiteSpace: 'nowrap' }}>
                          {student.interviewDate && new Date(student.interviewDate).toLocaleDateString('ar-EG')} - {student.interviewTime || '-'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleApproveFromInterview(student)}
                              disabled={processing === student.uid}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#28a745',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                              }}
                            >
                              {processing === student.uid ? '...' : '✓ اجتاز'}
                            </button>
                            <button
                              onClick={() => handleReject(student)}
                              disabled={processing === student.uid}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#dc3545',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                              }}
                            >
                              {processing === student.uid ? '...' : '✗ رفض'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* عرض البطاقات للمقابلات */
            <div className="pending-list">
              {filterAndSortStudents(interviewStudents).map(student => (
                <div key={student.uid} className="pending-card">
                  <div className="pending-card-header">
                    <div className="student-avatar">
                      {student.name.charAt(0)}
                    </div>
                    <div className="student-info">
                      <h3>{student.name}</h3>
                      <span className="student-email">{student.personalId || 'غير محدد'}</span>
                    </div>
                    <span className="status-badge" style={{ backgroundColor: '#2196f3' }}>مقابلة محددة</span>
                  </div>

                  <div className="pending-card-body">
                    <div className="info-row">
                      <span className="info-label">📞 الهاتف:</span>
                      <span className="info-value">{student.phone || student.phoneNumber || 'غير محدد'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">🏫 المركز:</span>
                      <span className="info-value">{student.centerName}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">📅 موعد المقابلة:</span>
                      <span className="info-value">
                        {student.interviewDate && new Date(student.interviewDate).toLocaleDateString('ar-EG')} الساعة {student.interviewTime || 'غير محدد'}
                      </span>
                    </div>
                  </div>

                  <div className="pending-card-actions">
                    <button
                      className="btn btn-approve"
                      onClick={() => handleApproveFromInterview(student)}
                      disabled={processing === student.uid}
                    >
                      {processing === student.uid ? '...' : '✓ اجتاز المقابلة'}
                    </button>
                    <button
                      className="btn btn-reject"
                      onClick={() => handleReject(student)}
                      disabled={processing === student.uid}
                    >
                      {processing === student.uid ? '...' : '✗ رفض'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            )}
          </>
        )}
      </div>

      {/* Level/Stage Approvals Section */}
      {pendingLevelApprovals.length > 0 && (
        <div className="requests-section" style={{ marginTop: '2rem' }}>
          <h2>🎓 طلبات الانتقال للمرحلة/المستوى التالي</h2>
          
          <div className="pending-count">
            <span className="count-badge">{pendingLevelApprovals.length}</span>
            طلب انتقال
          </div>

          <div className="pending-list">
            {pendingLevelApprovals.map((student) => (
              <div key={student.uid} className="pending-card">
                <div className="pending-card-header">
                  <div className="student-avatar">
                    {student.name.charAt(0)}
                  </div>
                  <div className="student-info">
                    <h3>{student.name}</h3>
                    <span className="student-email">{student.personalId || 'غير محدد'}</span>
                  </div>
                  <span className="status-badge pending">بانتظار الاعتماد</span>
                </div>

                <div className="pending-card-body">
                  <div className="info-row">
                    <span className="info-label">📚 المستوى الحالي:</span>
                    <span className="info-value">{student.levelName || 'المستوى الأول'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">📖 المرحلة الحالية:</span>
                    <span className="info-value">{student.stageName || 'غير محددة'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">➡️ الانتقال إلى:</span>
                    <span className="info-value" style={{ color: '#4caf50', fontWeight: 'bold' }}>
                      {student.pendingLevelUp ? 'المستوى التالي' : 'المرحلة التالية'}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">⭐ النقاط:</span>
                    <span className="info-value">{student.totalPoints || 0}</span>
                  </div>
                </div>

                <div className="pending-card-actions">
                  <button
                    className="btn btn-approve"
                    onClick={() => handleLevelApprove(student)}
                    disabled={processing === student.uid}
                  >
                    {processing === student.uid ? '...' : (student.pendingLevelUp ? '✓ اعتماد للمستوى التالي' : '✓ اعتماد للمرحلة التالية')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      </div>

      {/* Modal تحديد موعد المقابلة */}
      {showInterviewModal && selectedStudent && (
        <div className="modal-overlay" onClick={() => setShowInterviewModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تحديد موعد المقابلة</h2>
              <button className="close-btn" onClick={() => setShowInterviewModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="modal-info">
                الطالب: <strong>{selectedStudent.name}</strong>
              </p>
              <div className="form-group">
                <label>تاريخ المقابلة *</label>
                <input
                  type="date"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div className="form-group">
                <label>وقت المقابلة *</label>
                <input
                  type="time"
                  value={interviewTime}
                  onChange={(e) => setInterviewTime(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowInterviewModal(false)}
              >
                إلغاء
              </button>
              <button 
                className="btn btn-approve" 
                onClick={confirmInterview}
                disabled={processing === selectedStudent.uid}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span>💬</span>
                {processing === selectedStudent.uid ? 'جاري التحديد...' : 'تحديد وإرسال واتساب'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal اختيار المساق والمجموعة */}
      {showTrackGroupModal && selectedStudent && (
        <div className="modal-overlay" onClick={() => setShowTrackGroupModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>قبول الطالب - اختيار المساق والمجموعة</h2>
              <button className="close-btn" onClick={() => setShowTrackGroupModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="modal-info">
                قبول الطالب: <strong>{selectedStudent.name}</strong>
              </p>
              <div className="form-group">
                <label>اختر المساق *</label>
                <select
                  value={selectedTrackId}
                  onChange={(e) => {
                    setSelectedTrackId(e.target.value);
                    setSelectedGroupId(''); // Reset group when track changes
                  }}
                  required
                >
                  <option value="">اختر المساق</option>
                  {tracks
                    .filter(track => track.centerId === selectedStudent.centerId)
                    .map(track => (
                      <option key={track.id} value={track.id}>
                        {track.name}
                      </option>
                    ))}
                </select>
              </div>
              {selectedTrackId && (
                <div className="form-group">
                  <label>اختر المجموعة *</label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    required
                  >
                    <option value="">اختر المجموعة</option>
                    {groups
                      .filter(group => group.trackId === selectedTrackId)
                      .map(group => (
                        <option key={group.id} value={group.id}>
                          {group.name} - المعلم: {group.teacherName}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowTrackGroupModal(false)}
              >
                إلغاء
              </button>
              <button 
                className="btn btn-approve" 
                onClick={confirmApproveFromInterview}
                disabled={processing === selectedStudent.uid}
              >
                {processing === selectedStudent.uid ? 'جاري القبول...' : 'تأكيد القبول'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Box */}
      <MessageBox
        open={messageBox.open}
        type={messageBox.type}
        title={messageBox.title}
        message={messageBox.message}
        onClose={() => setMessageBox({ ...messageBox, open: false })}
      />
    </section>
  );
};

export default PendingRequests;
