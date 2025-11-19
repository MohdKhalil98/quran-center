import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import ConfirmModal from '../components/ConfirmModal';
import '../styles/TracksAndGroups.css';

interface Track {
  id?: string;
  name: string;
  description: string;
  minAge: number;
}

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

const TracksAndGroups: React.FC = () => {
  // Tracks State
  const [tracks, setTracks] = useState<Track[]>([]);
  const [showTrackForm, setShowTrackForm] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [showDeleteTrackModal, setShowDeleteTrackModal] = useState(false);
  const [trackToDelete, setTrackToDelete] = useState<Track | null>(null);
  const [trackFormData, setTrackFormData] = useState<Track>({
    name: '',
    description: '',
    minAge: 6,
  });

  // Groups State
  const [groups, setGroups] = useState<Group[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [groupFormData, setGroupFormData] = useState<Group>({
    name: '',
    teacherId: '',
    trackId: '',
    description: '',
    schedule: ''
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      // Fetch tracks
      const tracksSnapshot = await getDocs(collection(db, 'tracks'));
      const tracksData = tracksSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Track[];
      setTracks(tracksData);

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

      // Attach teacher names and track names to groups
      const groupsWithDetails = groupsList.map((group) => ({
        ...group,
        teacherName: teachersList.find((t) => t.id === group.teacherId)?.name || 'غير محدد',
        trackName: tracksData.find((tr) => tr.id === group.trackId)?.name || 'غير محدد'
      }));

      setGroups(groupsWithDetails);
      setTeachers(teachersList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
      alert('حدث خطأ في جلب البيانات');
    }
  };

  // ==================== TRACKS FUNCTIONS ====================

  const handleTrackInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTrackFormData((prev) => ({
      ...prev,
      [name]: name === 'minAge' ? parseInt(value) || 0 : value,
    }));
  };

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!trackFormData.name.trim()) {
      alert('الرجاء إدخال اسم المساق');
      return;
    }

    if (trackFormData.minAge < 0) {
      alert('الرجاء إدخال عمر صحيح');
      return;
    }

    try {
      if (editingTrack) {
        await updateDoc(doc(db, 'tracks', editingTrack.id!), {
          name: trackFormData.name,
          description: trackFormData.description,
          minAge: trackFormData.minAge,
        });
        alert('تم تحديث المساق بنجاح');
      } else {
        await addDoc(collection(db, 'tracks'), {
          name: trackFormData.name,
          description: trackFormData.description,
          minAge: trackFormData.minAge,
        });
        alert('تم إضافة المساق بنجاح');
      }

      resetTrackForm();
      fetchAllData();
    } catch (error) {
      console.error('Error saving track:', error);
      alert('حدث خطأ في حفظ المساق');
    }
  };

  const handleEditTrack = (track: Track) => {
    setEditingTrack(track);
    setTrackFormData({
      name: track.name,
      description: track.description,
      minAge: track.minAge,
    });
    setShowTrackForm(true);
  };

  const handleDeleteTrackClick = (track: Track) => {
    setTrackToDelete(track);
    setShowDeleteTrackModal(true);
  };

  const handleDeleteTrackConfirm = async () => {
    if (trackToDelete) {
      try {
        await deleteDoc(doc(db, 'tracks', trackToDelete.id!));
        alert('تم حذف المساق بنجاح');
        fetchAllData();
      } catch (error) {
        console.error('Error deleting track:', error);
        alert('حدث خطأ في حذف المساق');
      }
    }
    setShowDeleteTrackModal(false);
    setTrackToDelete(null);
  };

  const resetTrackForm = () => {
    setTrackFormData({
      name: '',
      description: '',
      minAge: 6,
    });
    setEditingTrack(null);
    setShowTrackForm(false);
  };

  // ==================== GROUPS FUNCTIONS ====================

  const handleGroupInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setGroupFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupFormData.name || !groupFormData.teacherId || !groupFormData.trackId) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const { id, teacherName, trackName, ...dataToSave } = groupFormData;

      if (editingGroup) {
        await updateDoc(doc(db, 'groups', editingGroup.id!), dataToSave);
        alert('تم تحديث المجموعة بنجاح');
      } else {
        await addDoc(collection(db, 'groups'), dataToSave);
        alert('تم إضافة المجموعة بنجاح');
      }

      resetGroupForm();
      fetchAllData();
    } catch (error) {
      console.error('Error saving group:', error);
      alert('حدث خطأ في حفظ المجموعة');
    }
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setGroupFormData({
      name: group.name,
      teacherId: group.teacherId,
      trackId: group.trackId,
      description: group.description,
      schedule: group.schedule || ''
    });
    setShowGroupForm(true);
  };

  const handleDeleteGroupClick = (group: Group) => {
    setGroupToDelete(group);
    setShowDeleteGroupModal(true);
  };

  const handleDeleteGroupConfirm = async () => {
    if (groupToDelete) {
      try {
        await deleteDoc(doc(db, 'groups', groupToDelete.id!));
        alert('تم حذف المجموعة بنجاح');
        fetchAllData();
      } catch (error) {
        console.error('Error deleting group:', error);
        alert('حدث خطأ في حذف المجموعة');
      }
    }
    setShowDeleteGroupModal(false);
    setGroupToDelete(null);
  };

  const resetGroupForm = () => {
    setGroupFormData({
      name: '',
      teacherId: '',
      trackId: '',
      description: '',
      schedule: ''
    });
    setEditingGroup(null);
    setShowGroupForm(false);
  };

  if (loading) {
    return (
      <div className="tracks-groups-container">
        <p>جاري تحميل البيانات...</p>
      </div>
    );
  }

  return (
    <div className="tracks-groups-container">
      {/* ==================== TRACKS SECTION ==================== */}
      <section className="tracks-section">
        <div className="section-header">
          <h1>المساقات</h1>
          <button className="add-button" onClick={() => setShowTrackForm(true)}>
            + إضافة مساق جديد
          </button>
        </div>

        {showTrackForm && (
          <div className="form-overlay">
            <div className="form-container">
              <h2>{editingTrack ? 'تعديل المساق' : 'إضافة مساق جديد'}</h2>
              <form onSubmit={handleTrackSubmit}>
                <div className="form-group">
                  <label>اسم المساق *</label>
                  <input
                    type="text"
                    name="name"
                    value={trackFormData.name}
                    onChange={handleTrackInputChange}
                    placeholder="مثال: مساق التأسيس على القراءة العربية"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>الوصف</label>
                  <textarea
                    name="description"
                    value={trackFormData.description}
                    onChange={handleTrackInputChange}
                    placeholder="وصف المساق وأهدافه"
                    rows={4}
                  />
                </div>

                <div className="form-group">
                  <label>الحد الأدنى للعمر *</label>
                  <input
                    type="number"
                    name="minAge"
                    value={trackFormData.minAge}
                    onChange={handleTrackInputChange}
                    min="0"
                    required
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="submit-button">
                    {editingTrack ? 'تحديث' : 'حفظ'}
                  </button>
                  <button type="button" className="cancel-button" onClick={resetTrackForm}>
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="tracks-grid">
          {tracks.length === 0 ? (
            <div className="no-data">
              <p>لا توجد مساقات حالياً</p>
              <p>قم بإضافة مساق جديد للبدء</p>
            </div>
          ) : (
            tracks.map((track) => (
              <div key={track.id} className="track-card">
                <div className="track-header">
                  <h3>{track.name}</h3>
                  <div className="track-actions">
                    <button className="edit-btn" onClick={() => handleEditTrack(track)}>
                      ✏️ تعديل
                    </button>
                    <button className="delete-btn" onClick={() => handleDeleteTrackClick(track)}>
                      🗑️ حذف
                    </button>
                  </div>
                </div>
                <div className="track-body">
                  {track.description && (
                    <p className="track-description">{track.description}</p>
                  )}
                  <div className="track-info">
                    <span className="age-badge">
                      العمر المناسب: {track.minAge} سنوات فما فوق
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ==================== GROUPS SECTION ==================== */}
      <section className="groups-section">
        <div className="section-header">
          <h1>المجموعات</h1>
          <button className="add-button" onClick={() => setShowGroupForm(true)}>
            + إضافة مجموعة جديدة
          </button>
        </div>

        {showGroupForm && (
          <div className="form-overlay">
            <div className="form-container">
              <h2>{editingGroup ? 'تعديل المجموعة' : 'إضافة مجموعة جديدة'}</h2>
              <form onSubmit={handleGroupSubmit}>
                <div className="form-group">
                  <label htmlFor="name">اسم المجموعة *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    placeholder="مثال: مجموعة النور"
                    value={groupFormData.name}
                    onChange={handleGroupInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="trackId">المساق *</label>
                  <select
                    id="trackId"
                    name="trackId"
                    value={groupFormData.trackId}
                    onChange={handleGroupInputChange}
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
                    value={groupFormData.teacherId}
                    onChange={handleGroupInputChange}
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
                    value={groupFormData.description}
                    onChange={handleGroupInputChange}
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
                    value={groupFormData.schedule}
                    onChange={handleGroupInputChange}
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="submit-button">
                    {editingGroup ? 'تحديث' : 'حفظ'}
                  </button>
                  <button type="button" className="cancel-button" onClick={resetGroupForm}>
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="groups-grid">
          {groups.length === 0 ? (
            <div className="no-data">
              <p>لا توجد مجموعات حتى الآن</p>
              <p>قم بإضافة مجموعة جديدة للبدء</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.id} className="group-card">
                <div className="group-header">
                  <h3>{group.name}</h3>
                  <div className="group-actions">
                    <button className="edit-btn" onClick={() => handleEditGroup(group)}>
                      ✏️ تعديل
                    </button>
                    <button className="delete-btn" onClick={() => handleDeleteGroupClick(group)}>
                      🗑️ حذف
                    </button>
                  </div>
                </div>
                <div className="group-body">
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
                    <p className="group-description">
                      <strong>الوصف:</strong> {group.description}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Delete Modals */}
      {showDeleteTrackModal && trackToDelete && (
        <ConfirmModal
          open={showDeleteTrackModal}
          message={`هل أنت متأكد من حذف المساق "${trackToDelete.name}"؟`}
          onConfirm={handleDeleteTrackConfirm}
          onCancel={() => {
            setShowDeleteTrackModal(false);
            setTrackToDelete(null);
          }}
        />
      )}

      {showDeleteGroupModal && groupToDelete && (
        <ConfirmModal
          open={showDeleteGroupModal}
          message={`هل أنت متأكد من حذف المجموعة "${groupToDelete.name}"؟`}
          onConfirm={handleDeleteGroupConfirm}
          onCancel={() => {
            setShowDeleteGroupModal(false);
            setGroupToDelete(null);
          }}
        />
      )}
    </div>
  );
};

export default TracksAndGroups;
