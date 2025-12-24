import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useMessaging } from '../hooks/useMessaging';
import '../styles/Groups.css';
import ConfirmModal from '../components/ConfirmModal';

interface Teacher {
  uid: string;
  name: string;
  email: string;
}

interface Group {
  id?: string;
  name: string;
  trackId: string;
  trackName?: string;
  teacherId?: string;
  teacherName?: string;
  description: string;
  schedule?: string;
}

const Groups = () => {
  const { userProfile } = useAuth();
  const { findOrCreateConversation } = useMessaging();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);
  const [openingChat, setOpeningChat] = useState<string | null>(null);
  const [formData, setFormData] = useState<Group>({
    name: '',
    trackId: '',
    teacherId: '',
    description: '',
    schedule: ''
  });

  // Fetch groups and tracks from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch groups
        const groupsQuery = query(collection(db, 'groups'), orderBy('name'));
        const groupsSnapshot = await getDocs(groupsQuery);
        const groupsList = groupsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        } as Group));

        // Fetch tracks
        const tracksQuery = query(collection(db, 'tracks'), orderBy('name'));
        const tracksSnapshot = await getDocs(tracksQuery);
        const tracksList = tracksSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
          ...doc.data()
        } as any));

        // Fetch teachers from same center
        let teachersList: Teacher[] = [];
        if (userProfile?.centerId) {
          const teachersQuery = query(
            collection(db, 'users'),
            where('role', '==', 'teacher'),
            where('centerId', '==', userProfile.centerId)
          );
          const teachersSnapshot = await getDocs(teachersQuery);
          teachersList = teachersSnapshot.docs.map((doc) => ({
            uid: doc.data().uid,
            name: doc.data().name,
            email: doc.data().email
          }));
        }
        setTeachers(teachersList);

        // Attach track names and teacher names to groups
        const groupsWithDetails = groupsList.map((group) => ({
          ...group,
          trackName: tracksList.find((tr) => tr.id === group.trackId)?.name || 'غير محدد',
          teacherName: teachersList.find((t) => t.uid === group.teacherId)?.name || 'غير محدد'
        }));

        setGroups(groupsWithDetails);
        setTracks(tracksList);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.trackId) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const { id, trackName, teacherName, ...dataToSave } = formData;
      const trackNameValue = tracks.find((tr) => tr.id === formData.trackId)?.name || 'غير محدد';
      const teacherNameValue = teachers.find((t) => t.uid === formData.teacherId)?.name || 'غير محدد';

      if (editingId) {
        // Update existing group
        await updateDoc(doc(db, 'groups', editingId), dataToSave);
        setGroups((prev) =>
          prev.map((g) =>
            g.id === editingId
              ? { ...dataToSave, id: editingId, trackName: trackNameValue, teacherName: teacherNameValue }
              : g
          )
        );
        setEditingId(null);
      } else {
        // Add new group
        const docRef = await addDoc(collection(db, 'groups'), dataToSave);
        setGroups((prev) => [...prev, { ...dataToSave, id: docRef.id, trackName: trackNameValue, teacherName: teacherNameValue }]);
      }

      setFormData({
        name: '',
        trackId: '',
        teacherId: '',
        description: '',
        schedule: ''
      });
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding/updating group:', error);
      alert('حدث خطأ أثناء حفظ البيانات');
    }
  };

  const handleDeleteGroup = (id: string) => {
    setConfirmTargetId(id);
    setConfirmOpen(true);
  };

  const performDeleteGroup = async () => {
    const id = confirmTargetId;
    setConfirmOpen(false);
    setConfirmTargetId(null);
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'groups', id));
      setGroups((prev) => prev.filter((g) => g.id !== id));
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('حدث خطأ أثناء حذف البيانات');
    }
  };

  const handleEditGroup = (group: Group) => {
    setFormData(group);
    setEditingId(group.id || null);
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      name: '',
      trackId: '',
      teacherId: '',
      description: '',
      schedule: ''
    });
  };

  // فتح المحادثة الجماعية للحلقة
  const openGroupChat = async (group: Group) => {
    if (!group.id || !group.teacherId) {
      alert('يجب تعيين معلم للحلقة أولاً');
      return;
    }

    setOpeningChat(group.id);

    try {
      // جلب طلاب الحلقة
      const studentsQuery = query(
        collection(db, 'users'),
        where('role', '==', 'student'),
        where('groupId', '==', group.id),
        where('status', '==', 'approved')
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      const studentIds = studentsSnapshot.docs.map(doc => doc.data().uid);

      // إضافة المعلم للقائمة
      const participantIds = [group.teacherId, ...studentIds];

      if (participantIds.length < 2) {
        alert('لا يوجد طلاب في هذه الحلقة بعد');
        setOpeningChat(null);
        return;
      }

      // إنشاء أو فتح المحادثة الجماعية
      const conversationId = await findOrCreateConversation({
        type: 'group',
        groupId: group.id,
        groupName: `حلقة ${group.name}`,
        participantIds
      });

      if (conversationId) {
        navigate(`/messages/${conversationId}`);
      }
    } catch (error) {
      console.error('Error opening group chat:', error);
      alert('حدث خطأ في فتح المحادثة');
    }

    setOpeningChat(null);
  };

  if (loading) {
    return (
      <section className="page">
        <header className="page__header">
          <h1>المجموعات</h1>
        </header>
        <p>جاري تحميل البيانات...</p>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1>المجموعات</h1>
        <p>عرض المجموعات والمعلمين المشرفين عليها.</p>
      </header>

      <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
        + إضافة مجموعة جديدة
      </button>

      {isAdding && (
        <form className="form-card" onSubmit={handleAddGroup}>
          <h3>{editingId ? 'تعديل المجموعة' : 'إضافة مجموعة جديدة'}</h3>
          <div className="form-group">
            <label htmlFor="name">اسم المجموعة *</label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder="مثال: مجموعة النور"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="trackId">المساق *</label>
            <select
              id="trackId"
              name="trackId"
              value={formData.trackId}
              onChange={handleInputChange}
              required
            >
              <option value="">اختر المساق</option>
              {tracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="teacherId">المعلم</label>
            <select
              id="teacherId"
              name="teacherId"
              value={formData.teacherId || ''}
              onChange={handleInputChange}
            >
              <option value="">اختر المعلم</option>
              {teachers.map((teacher) => (
                <option key={teacher.uid} value={teacher.uid}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="description">الوصف</label>
            <textarea
              id="description"
              name="description"
              placeholder="وصف المجموعة (اختياري)"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
            />
          </div>
          <div className="form-group">
            <label htmlFor="schedule">الجدول الزمني</label>
            <input
              type="text"
              id="schedule"
              name="schedule"
              placeholder="مثال: الأحد والثلاثاء"
              value={formData.schedule}
              onChange={handleInputChange}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-success">
              {editingId ? 'تحديث' : 'حفظ'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleCancel}>
              إلغاء
            </button>
          </div>
        </form>
      )}

      <div className="groups-container">
        {groups.length === 0 ? (
          <p>لا توجد مجموعات حتى الآن</p>
        ) : (
          groups.map((group) => (
            <article key={group.id} className="group-card">
              <h2>{group.name}</h2>
              <p>
                <strong>المساق:</strong> {group.trackName}
              </p>
              <p>
                <strong>المعلم:</strong> {group.teacherName || 'غير محدد'}
              </p>
              {group.schedule && (
                <p>
                  <strong>الجدول:</strong> {group.schedule}
                </p>
              )}
              {group.description && (
                <p>
                  <strong>الوصف:</strong> {group.description}
                </p>
              )}
              <div className="card-actions">
                <button
                  className="btn btn-sm btn-chat"
                  onClick={() => openGroupChat(group)}
                  disabled={openingChat === group.id}
                >
                  {openingChat === group.id ? '⏳' : '💬'} محادثة الحلقة
                </button>
                <button
                  className="btn btn-sm btn-warning"
                  onClick={() => handleEditGroup(group)}
                >
                  تعديل
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDeleteGroup(group.id || '')}
                >
                  حذف
                </button>
              </div>
            </article>
          ))
        )}
      </div>
      <ConfirmModal
        open={confirmOpen}
        message="هل أنت متأكد من حذف هذه المجموعة؟"
        onConfirm={performDeleteGroup}
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmTargetId(null);
        }}
      />
    </section>
  );
};

export default Groups;

