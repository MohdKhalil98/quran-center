import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy, where, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
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

interface Center {
  id: string;
  name: string;
}

const Groups = () => {
  const { userProfile, getSupervisorCenterIds } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);

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
        // الحصول على مراكز المشرف
        const supervisorCenterIds = getSupervisorCenterIds();
        const isSupervisorWithMultipleCenters = userProfile?.role === 'supervisor' && supervisorCenterIds.length > 0;
        
        // جلب بيانات المراكز للمشرف
        if (isSupervisorWithMultipleCenters) {
          const centersList: Center[] = [];
          for (const centerId of supervisorCenterIds) {
            const centerDoc = await getDocs(query(collection(db, 'centers'), where('__name__', '==', centerId)));
            if (!centerDoc.empty) {
              const data = centerDoc.docs[0].data();
              centersList.push({
                id: centerId,
                name: data.name || centerId
              });
            } else {
              centersList.push({
                id: centerId,
                name: centerId
              });
            }
          }
          setCenters(centersList);
          
          // تحديد المركز الافتراضي
          if (!selectedCenterId && centersList.length > 0) {
            setSelectedCenterId(centersList[0].id);
          }
        }
        
        const activeCenterId = isSupervisorWithMultipleCenters 
          ? (selectedCenterId || supervisorCenterIds[0])
          : userProfile?.centerId;

        // Fetch groups
        let groupsList: Group[] = [];
        if (activeCenterId) {
          const groupsQuery = query(
            collection(db, 'groups'), 
            where('centerId', '==', activeCenterId)
          );
          const groupsSnapshot = await getDocs(groupsQuery);
          groupsList = groupsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          } as Group));
          // ترتيب الحلقات حسب الاسم
          groupsList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
        } else {
          const groupsQuery = query(collection(db, 'groups'), orderBy('name'));
          const groupsSnapshot = await getDocs(groupsQuery);
          groupsList = groupsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          } as Group));
        }

        // Fetch tracks - جلب المساقات الخاصة بالمركز المحدد
        let tracksList: any[] = [];
        if (activeCenterId) {
          const tracksQuery = query(
            collection(db, 'tracks'),
            where('centerId', '==', activeCenterId)
          );
          const tracksSnapshot = await getDocs(tracksQuery);
          tracksList = tracksSnapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name,
            centerId: doc.data().centerId,
            ...doc.data()
          }));
          console.log('Fetched tracks for center', activeCenterId, ':', tracksList);
        } else {
          const tracksSnapshot = await getDocs(collection(db, 'tracks'));
          tracksList = tracksSnapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name,
            ...doc.data()
          } as any));
        }
        // ترتيب المساقات
        tracksList.sort((a: any, b: any) => a.name.localeCompare(b.name, 'ar'));
        
        console.log('Final tracks list:', tracksList);
        setTracks(tracksList);

        // Fetch teachers from same center (including supervisors who can teach)
        let teachersList: Teacher[] = [];
        
        if (activeCenterId) {
          // جلب المعلمين من المركز المحدد
          const teachersQuery = query(
            collection(db, 'users'),
            where('role', '==', 'teacher'),
            where('centerId', '==', activeCenterId)
          );
          const teachersSnapshot = await getDocs(teachersQuery);
          const teachers = teachersSnapshot.docs.map((doc) => ({
            uid: doc.data().uid,
            name: doc.data().name,
            email: doc.data().email
          }));
          
          // جلب المشرفين أيضاً (قد يقومون بالتدريس)
          const supervisorsQuery = query(
            collection(db, 'users'),
            where('role', '==', 'supervisor'),
            where('centerId', '==', activeCenterId)
          );
          const supervisorsSnapshot = await getDocs(supervisorsQuery);
          const supervisors = supervisorsSnapshot.docs.map((doc) => ({
            uid: doc.data().uid,
            name: doc.data().name,
            email: doc.data().email
          }));
          
          // جلب المشرفين الذين لديهم هذا المركز في centerIds
          const supervisorsWithCenterIdsQuery = query(
            collection(db, 'users'),
            where('role', '==', 'supervisor'),
            where('centerIds', 'array-contains', activeCenterId)
          );
          const supervisorsWithCenterIdsSnapshot = await getDocs(supervisorsWithCenterIdsQuery);
          const supervisorsWithCenterIds = supervisorsWithCenterIdsSnapshot.docs.map((doc) => ({
            uid: doc.data().uid,
            name: doc.data().name,
            email: doc.data().email
          }));
          
          // دمج وإزالة التكرار
          const allTeachers = [...teachers, ...supervisors, ...supervisorsWithCenterIds];
          const uniqueTeachers = allTeachers.filter((teacher, index, self) =>
            index === self.findIndex((t) => t.uid === teacher.uid)
          );
          
          teachersList = uniqueTeachers;
        }
        setTeachers(teachersList);

        // Attach track names and teacher names to groups
        let groupsWithDetails = groupsList.map((group) => ({
          ...group,
          trackName: tracksList.find((tr) => tr.id === group.trackId)?.name || 'غير محدد',
          teacherName: teachersList.find((t) => t.uid === group.teacherId)?.name || 'غير محدد'
        }));

        // تصفية الحلقات للمعلم - يرى فقط حلقاته
        if (userProfile?.role === 'teacher' && userProfile?.uid) {
          groupsWithDetails = groupsWithDetails.filter(g => g.teacherId === userProfile.uid);
        }

        setGroups(groupsWithDetails);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile, selectedCenterId]);

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

      // تحديد المركز النشط
      const supervisorCenterIds = getSupervisorCenterIds();
      const isSupervisorWithMultipleCenters = userProfile?.role === 'supervisor' && supervisorCenterIds.length > 0;
      const activeCenterId = isSupervisorWithMultipleCenters 
        ? (selectedCenterId || supervisorCenterIds[0])
        : userProfile?.centerId;

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
        // Add new group - إضافة centerId وإنشاء groupId يدوي
        const groupData: any = {
          ...dataToSave,
          createdAt: new Date(),
        };
        
        // إضافة centerId
        if (activeCenterId) {
          groupData.centerId = activeCenterId;
          
          // حساب الرقم التسلسلي للحلقة في هذا المركز
          const centerGroupsQuery = query(
            collection(db, 'groups'),
            where('centerId', '==', activeCenterId)
          );
          const centerGroupsSnapshot = await getDocs(centerGroupsQuery);
          
          // البحث عن أكبر رقم تسلسلي
          let maxNumber = 0;
          centerGroupsSnapshot.docs.forEach(doc => {
            const groupId = doc.id;
            // استخراج الرقم من groupId (مثال: center1-5 -> 5)
            const match = groupId.match(/-(\d+)$/);
            if (match) {
              const num = parseInt(match[1]);
              if (num > maxNumber) {
                maxNumber = num;
              }
            }
          });
          
          // إنشاء groupId بصيغة centerId-رقم
          const newGroupId = `${activeCenterId}-${maxNumber + 1}`;
          
          // استخدام setDoc بدلاً من addDoc لتحديد ID يدوي
          await setDoc(doc(db, 'groups', newGroupId), groupData);
          setGroups((prev) => [...prev, { ...groupData, id: newGroupId, trackName: trackNameValue, teacherName: teacherNameValue }]);
        } else {
          // إذا لم يكن هناك centerId، استخدم الطريقة القديمة
          const docRef = await addDoc(collection(db, 'groups'), groupData);
          setGroups((prev) => [...prev, { ...groupData, id: docRef.id, trackName: trackNameValue, teacherName: teacherNameValue }]);
        }
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
        <h1>{userProfile?.role === 'teacher' ? 'حلقاتي' : 'المجموعات'}</h1>
        <p>{userProfile?.role === 'teacher' ? 'عرض الحلقات المسندة إليك.' : 'عرض المجموعات والمعلمين المشرفين عليها.'}</p>
      </header>

      {/* اختيار المركز للمشرف متعدد المراكز */}
      {userProfile?.role === 'supervisor' && centers.length > 1 && (
        <div className="center-selector" style={{ marginBottom: '1rem' }}>
          <label htmlFor="centerSelect" style={{ marginLeft: '0.5rem', fontWeight: 'bold' }}>المركز:</label>
          <select
            id="centerSelect"
            value={selectedCenterId}
            onChange={(e) => setSelectedCenterId(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', minWidth: '200px' }}
          >
            {centers.map((center) => (
              <option key={center.id} value={center.id}>
                {center.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {userProfile?.role !== 'teacher' && (
        <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
          + إضافة مجموعة جديدة
        </button>
      )}

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
                {userProfile?.role !== 'teacher' && (
                  <>
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
                  </>
                )}
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

