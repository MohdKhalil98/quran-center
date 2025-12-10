import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc, query, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth, UserProfile } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import '../styles/PendingRequests.css';

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
      // جلب الطلاب في حالة انتظار الموافقة من نفس المركز
      const studentsQuery = query(
        collection(db, 'users'),
        where('role', '==', 'student'),
        where('centerId', '==', userProfile.centerId),
        where('status', '==', 'pending')
      );

      const studentsSnap = await getDocs(studentsQuery);
      
      // جلب اسم المركز
      const centerDoc = await getDoc(doc(db, 'centers', userProfile.centerId));
      const centerName = centerDoc.exists() ? centerDoc.data().name : 'غير محدد';

      const studentsList = studentsSnap.docs.map(doc => ({
        ...doc.data(),
        centerName: centerName
      } as PendingStudent));

      setPendingStudents(studentsList);
    } catch (error) {
      console.error('Error fetching pending students:', error);
    } finally {
      setLoading(false);
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
