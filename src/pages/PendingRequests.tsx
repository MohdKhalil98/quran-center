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
}

const PendingRequests = () => {
  const { isSupervisor, userProfile } = useAuth();
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

  useEffect(() => {
    if (userProfile?.centerId) {
      fetchCurriculum();
      fetchPendingStudents();
      fetchGroups();
      fetchTracks();
    }
  }, [userProfile]);

  const fetchTracks = async () => {
    try {
      let tracksQuery;
      if (userProfile?.centerId) {
        tracksQuery = query(
          collection(db, 'tracks'),
          where('centerId', '==', userProfile.centerId)
        );
      } else {
        tracksQuery = collection(db, 'tracks');
      }
      const tracksSnap = await getDocs(tracksQuery);
      const tracksList = tracksSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setTracks(tracksList);
    } catch (error) {
      console.error('Error fetching tracks:', error);
    }
  };

  // Fetch curriculum from Firebase
  const fetchCurriculum = async () => {
    if (!userProfile?.centerId) return;

    try {
      const curriculumRef = collection(db, 'curriculum');
      const q = query(curriculumRef, where('centerId', '==', userProfile.centerId));
      const snapshot = await getDocs(q);
      
      const levels: CurriculumLevel[] = [];
      snapshot.forEach(docSnap => {
        levels.push({
          id: docSnap.id,
          ...docSnap.data()
        } as CurriculumLevel);
      });
      
      levels.sort((a, b) => a.order - b.order);
      setCurriculumLevels(levels);
    } catch (error) {
      console.error('Error fetching curriculum:', error);
    }
  };

  useEffect(() => {
    if (userProfile?.centerId) {
      fetchPendingStudents();
      fetchGroups();
    }
  }, [userProfile]);

  const fetchGroups = async () => {
    try {
      let groupsQuery;
      if (userProfile?.centerId) {
        groupsQuery = query(
          collection(db, 'groups'),
          where('centerId', '==', userProfile.centerId)
        );
      } else {
        groupsQuery = collection(db, 'groups');
      }
      const groupsSnap = await getDocs(groupsQuery);
      
      // جلب أسماء المعلمين
      const teachersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'teacher')
      );
      const teachersSnap = await getDocs(teachersQuery);
      const teachersMap = new Map(
        teachersSnap.docs.map(doc => [doc.data().uid, doc.data().name])
      );

      const groupsList = groupsSnap.docs.map(doc => ({
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
    if (!userProfile?.centerId) return;

    try {
      // Simplify query to avoid index issues: Fetch all users in the center
      const q = query(
        collection(db, 'users'),
        where('centerId', '==', userProfile.centerId)
      );

      const querySnapshot = await getDocs(q);
      
      // Get center name
      const centerDoc = await getDoc(doc(db, 'centers', userProfile.centerId));
      const centerName = centerDoc.exists() ? centerDoc.data().name : 'غير محدد';

      console.log('Raw Query Snapshot Size:', querySnapshot.size);

      const allUsers = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Log raw data for debugging
        console.log(`Raw User Data [${doc.id}]:`, data);
        return {
          uid: doc.id, // Ensure uid is captured from doc.id
          ...data,
          centerName: centerName
        } as PendingStudent;
      });

      console.log('All Users Parsed:', allUsers);

      // Filter for Students only
      const allStudents = allUsers.filter(u => u.role === 'student');
      console.log('All Students Filtered:', allStudents);

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

      <div className="pending-container">
      
      {/* قسم طلبات التسجيل الجديدة - في الأعلى */}
      <div className="requests-section">
        <h2>📝 طلبات التسجيل الجديدة</h2>
        {pendingStudents.length === 0 ? (
          <div className="no-pending">
            <div className="no-pending-icon">✅</div>
            <h2>لا توجد طلبات انتظار</h2>
            <p>جميع طلبات الانضمام تمت مراجعتها</p>
          </div>
        ) : (
          <>
            <div className="pending-count">
              <span className="count-badge">{pendingStudents.length}</span>
              طلب انتظار
            </div>

            <div className="pending-list">
              {pendingStudents.map(student => (
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
          </>
        )}
      </div>

      {/* قسم المقابلات المحددة */}
      <div className="requests-section" style={{ marginTop: '2rem' }}>
        <h2>📅 المقابلات المحددة</h2>
        {interviewStudents.length === 0 ? (
          <div className="no-pending">
            <div className="no-pending-icon">✅</div>
            <h2>لا توجد مقابلات محددة</h2>
            <p>جميع الطلاب تمت معالجة مقابلاتهم</p>
          </div>
        ) : (
          <>
            <div className="pending-count">
              <span className="count-badge">{interviewStudents.length}</span>
              مقابلة محددة
            </div>

            <div className="pending-list">
              {interviewStudents.map(student => (
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
                  {tracks.map(track => (
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
