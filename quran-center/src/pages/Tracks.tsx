import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import ConfirmModal from '../components/ConfirmModal';
import '../styles/Tracks.css';

interface Track {
  id?: string;
  name: string;
  description: string;
  minAge: number;
}

const Tracks: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [trackToDelete, setTrackToDelete] = useState<Track | null>(null);
  const [formData, setFormData] = useState<Track>({
    name: '',
    description: '',
    minAge: 6,
  });

  useEffect(() => {
    fetchTracks();
  }, []);

  const fetchTracks = async () => {
    try {
      const tracksSnapshot = await getDocs(collection(db, 'tracks'));
      const tracksData = tracksSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Track[];
      setTracks(tracksData);
    } catch (error) {
      console.error('Error fetching tracks:', error);
      alert('حدث خطأ في جلب المساقات');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'minAge' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('الرجاء إدخال اسم المساق');
      return;
    }

    if (formData.minAge < 0) {
      alert('الرجاء إدخال عمر صحيح');
      return;
    }

    try {
      if (editingTrack) {
        await updateDoc(doc(db, 'tracks', editingTrack.id!), {
          name: formData.name,
          description: formData.description,
          minAge: formData.minAge,
        });
        alert('تم تحديث المساق بنجاح');
      } else {
        await addDoc(collection(db, 'tracks'), {
          name: formData.name,
          description: formData.description,
          minAge: formData.minAge,
        });
        alert('تم إضافة المساق بنجاح');
      }

      resetForm();
      fetchTracks();
    } catch (error) {
      console.error('Error saving track:', error);
      alert('حدث خطأ في حفظ المساق');
    }
  };

  const handleEdit = (track: Track) => {
    setEditingTrack(track);
    setFormData({
      name: track.name,
      description: track.description,
      minAge: track.minAge,
    });
    setShowForm(true);
  };

  const handleDeleteClick = (track: Track) => {
    setTrackToDelete(track);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (trackToDelete) {
      try {
        await deleteDoc(doc(db, 'tracks', trackToDelete.id!));
        alert('تم حذف المساق بنجاح');
        fetchTracks();
      } catch (error) {
        console.error('Error deleting track:', error);
        alert('حدث خطأ في حذف المساق');
      }
    }
    setShowDeleteModal(false);
    setTrackToDelete(null);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      minAge: 6,
    });
    setEditingTrack(null);
    setShowForm(false);
  };

  return (
      <div className="tracks-container">
        <div className="tracks-header">
          <h1>إدارة المساقات</h1>
          <button className="add-button" onClick={() => setShowForm(true)}>
            + إضافة مساق جديد
          </button>
        </div>

        {showForm && (
          <div className="form-overlay">
            <div className="form-container">
              <h2>{editingTrack ? 'تعديل المساق' : 'إضافة مساق جديد'}</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>اسم المساق *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="مثال: مساق التأسيس على القراءة العربية"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>الوصف</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="وصف المساق وأهدافه"
                    rows={4}
                  />
                </div>

                <div className="form-group">
                  <label>الحد الأدنى للعمر *</label>
                  <input
                    type="number"
                    name="minAge"
                    value={formData.minAge}
                    onChange={handleInputChange}
                    min="0"
                    required
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="submit-button">
                    {editingTrack ? 'تحديث' : 'حفظ'}
                  </button>
                  <button type="button" className="cancel-button" onClick={resetForm}>
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
                    <button className="edit-btn" onClick={() => handleEdit(track)}>
                      ✏️ تعديل
                    </button>
                    <button className="delete-btn" onClick={() => handleDeleteClick(track)}>
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

        {showDeleteModal && trackToDelete && (
          <ConfirmModal
            open={showDeleteModal}
            message={`هل أنت متأكد من حذف المساق "${trackToDelete.name}"؟`}
            onConfirm={handleDeleteConfirm}
            onCancel={() => {
              setShowDeleteModal(false);
              setTrackToDelete(null);
            }}
          />
        )}
      </div>
  );
};

export default Tracks;
