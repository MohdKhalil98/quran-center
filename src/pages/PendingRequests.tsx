import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc, query, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
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
}

interface Group {
  id: string;
  name: string;
  teacherName?: string;
}

const PendingRequests = () => {
  const { isSupervisor, userProfile } = useAuth();
  const [pendingStudents, setPendingStudents] = useState<PendingStudent[]>([]);
  const [pendingLevelApprovals, setPendingLevelApprovals] = useState<PendingStudent[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [curriculumLevels, setCurriculumLevels] = useState<CurriculumLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<PendingStudent | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  
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
    }
  }, [userProfile]);

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
      const groupsSnap = await getDocs(collection(db, 'groups'));
      
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

      // Filter for Registration Requests
      const registrationRequests = allStudents.filter(s => s.status === 'pending');
      setPendingStudents(registrationRequests);

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

  const handleApprove = (student: PendingStudent) => {
    setSelectedStudent(student);
    setSelectedGroupId('');
    setShowGroupModal(true);
  };

  const confirmApprove = async () => {
    if (!selectedStudent) return;
    if (!selectedGroupId) {
      showMessage('warning', 'تنبيه', 'يرجى اختيار الحلقة أولاً');
      return;
    }

    setProcessing(selectedStudent.uid);
    try {
      await updateDoc(doc(db, 'users', selectedStudent.uid), {
        status: 'approved',
        groupId: selectedGroupId
      });
      showMessage('success', 'تم قبول الطالب', `تم قبول طلب الطالب ${selectedStudent.name} وإضافته للحلقة بنجاح`);
      setShowGroupModal(false);
      setSelectedStudent(null);
      fetchPendingStudents();
    } catch (error) {
      console.error('Error approving student:', error);
      showMessage('error', 'خطأ', 'حدث خطأ أثناء الموافقة على الطلب. يرجى المحاولة مرة أخرى.');
    } finally {
      setProcessing(null);
    }
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
      {/* Level/Stage Approvals Section */}
      {pendingLevelApprovals.length > 0 && (
        <div className="requests-section" style={{ marginBottom: '2rem' }}>
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
                    <span className="student-email">{student.email}</span>
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

      <h2>طلبات التسجيل الجديدة</h2>
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
                      <span className="student-email">{student.email}</span>
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
                        {new Date(student.createdAt).toLocaleDateString('en-GB', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        })}
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

      {/* Modal اختيار الحلقة */}
      {showGroupModal && selectedStudent && (
        <div className="modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>قبول الطالب</h2>
              <button className="close-btn" onClick={() => setShowGroupModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="modal-info">
                قبول الطالب: <strong>{selectedStudent.name}</strong>
              </p>
              <div className="form-group">
                <label>اختر الحلقة *</label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  required
                >
                  <option value="">اختر الحلقة</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.name} - المعلم: {group.teacherName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowGroupModal(false)}
              >
                إلغاء
              </button>
              <button 
                className="btn btn-approve" 
                onClick={confirmApprove}
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
