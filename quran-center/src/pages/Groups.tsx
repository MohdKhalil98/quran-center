import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/Groups.css';
import ConfirmModal from '../components/ConfirmModal';

interface Group {
  id?: string;
  name: string;
  teacherId: string;
  teacherName?: string;
  trackId: string;
  trackName?: string;
  description: string;
  schedule?: string;
}

const Groups = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Group>({
    name: '',
    teacherId: '',
    trackId: '',
    description: '',
    schedule: ''
  });

  // Fetch groups, teachers and tracks from Firebase
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

        // Fetch teachers
        const teachersQuery = query(collection(db, 'teachers'), orderBy('name'));
        const teachersSnapshot = await getDocs(teachersQuery);
        const teachersList = teachersSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
          ...doc.data()
        } as any));

        // Fetch tracks
        const tracksQuery = query(collection(db, 'tracks'), orderBy('name'));
        const tracksSnapshot = await getDocs(tracksQuery);
        const tracksList = tracksSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
          ...doc.data()
        } as any));

        // Attach teacher names and track names to groups
        const groupsWithDetails = groupsList.map((group) => ({
          ...group,
          teacherName: teachersList.find((t) => t.id === group.teacherId)?.name || 'غير محدد',
          trackName: tracksList.find((tr) => tr.id === group.trackId)?.name || 'غير محدد'
        }));

        setGroups(groupsWithDetails);
        setTeachers(teachersList);
        setTracks(tracksList);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.teacherId || !formData.trackId) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const { id, teacherName, trackName, ...dataToSave } = formData;
      const teacherNameValue = teachers.find((t) => t.id === formData.teacherId)?.name || 'غير محدد';
      const trackNameValue = tracks.find((tr) => tr.id === formData.trackId)?.name || 'غير محدد';

      if (editingId) {
        // Update existing group
        await updateDoc(doc(db, 'groups', editingId), dataToSave);
        setGroups((prev) =>
          prev.map((g) =>
            g.id === editingId
              ? { ...dataToSave, id: editingId, teacherName: teacherNameValue, trackName: trackNameValue }
              : g
          )
        );
        setEditingId(null);
      } else {
        // Add new group
        const docRef = await addDoc(collection(db, 'groups'), dataToSave);
        setGroups((prev) => [...prev, { ...dataToSave, id: docRef.id, teacherName: teacherNameValue, trackName: trackNameValue }]);
      }

      setFormData({
        name: '',
        teacherId: '',
        trackId: '',
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
      teacherId: '',
      trackId: '',
      description: '',
      schedule: ''
    });
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
            <label htmlFor="teacherId">المعلم *</label>
            <select
              id="teacherId"
              name="teacherId"
              value={formData.teacherId}
              onChange={handleInputChange}
              required
            >
              <option value="">اختر المعلم</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
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
                <strong>المعلم:</strong> {group.teacherName}
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

