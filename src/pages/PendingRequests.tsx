import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc, query, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth, UserProfile } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import '../styles/PendingRequests.css';

import curriculum from '../data/curriculumData';

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
  const [pendingLevelApprovals, setPendingLevelApprovals] = useState<PendingStudent[]>([]); // New state
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<PendingStudent | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState('');

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
        // Level advancement
        const currentLevelId = student.levelId || 1;
        const nextLevelId = currentLevelId + 1;
        const nextLevel = curriculum.find(l => l.id === nextLevelId);
        
        if (nextLevel) {
          const firstPart = nextLevel.parts[0];
          await updateDoc(doc(db, 'users', student.uid), {
            levelId: nextLevelId,
            levelName: nextLevel.name,
            partId: firstPart.id,
            partName: firstPart.name,
            levelStatus: 'in-progress',
            stageStatus: null,
            pendingPartId: null,
            pendingPartName: null,
            pendingLevelUp: null,
            completedLevels: (student.completedLevels || 0) + 1,
            totalPoints: (student.totalPoints || 0) + 500
          });
          alert('تم اعتماد انتقال الطالب للمستوى التالي بنجاح');
        } else {
          // Finished all levels
          await updateDoc(doc(db, 'users', student.uid), {
            levelStatus: 'completed',
            stageStatus: null,
            pendingPartId: null,
            pendingPartName: null,
            pendingLevelUp: null,
            completedLevels: 5,
            totalPoints: (student.totalPoints || 0) + 1000
          });
          alert('مبارك! أتم الطالب جميع المستويات.');
        }
      } else {
        // Stage advancement (within same level)
        await updateDoc(doc(db, 'users', student.uid), {
          partId: student.pendingPartId,
          partName: student.pendingPartName,
          stageStatus: null,
          pendingPartId: null,
          pendingPartName: null,
          pendingLevelUp: null
        });
        alert(`تم اعتماد انتقال الطالب إلى ${student.pendingPartName} بنجاح`);
      }
      
      setPendingLevelApprovals(prev => prev.filter(s => s.uid !== student.uid));
    } catch (error) {
      console.error('Error approving:', error);
      alert('حدث خطأ أثناء الاعتماد');
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
      alert('يرجى اختيار الحلقة');
      return;
    }

    setProcessing(selectedStudent.uid);
    try {
      await updateDoc(doc(db, 'users', selectedStudent.uid), {
        status: 'approved',
        groupId: selectedGroupId
      });
      alert(`تم قبول طلب الطالب ${selectedStudent.name} وإضافته للحلقة بنجاح`);
      setShowGroupModal(false);
      setSelectedStudent(null);
      fetchPendingStudents();
    } catch (error) {
      console.error('Error approving student:', error);
      alert('حدث خطأ أثناء الموافقة على الطلب');
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
      alert(`تم رفض طلب الطالب ${student.name}`);
      fetchPendingStudents();
    } catch (error) {
      console.error('Error rejecting student:', error);
      alert('حدث خطأ أثناء رفض الطلب');
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
                    <span className="info-value">{student.partName || 'الجزء الأول'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">➡️ الانتقال إلى:</span>
                    <span className="info-value" style={{ color: '#4caf50', fontWeight: 'bold' }}>
                      {student.pendingLevelUp ? 'المستوى التالي' : student.pendingPartName}
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
    </section>
  );
};

export default PendingRequests;
