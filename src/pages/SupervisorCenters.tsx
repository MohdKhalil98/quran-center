import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import '../styles/Shared.css';
import '../styles/SupervisorCenters.css';

interface Center {
  id: string;
  name: string;
  address: string;
  phone: string;
}

interface Supervisor {
  id: string;
  name: string;
  email: string;
  centerId?: string;
  centerIds?: string[];
}

const SupervisorCenters = () => {
  const { isAdmin } = useAuth();
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSupervisor, setEditingSupervisor] = useState<Supervisor | null>(null);
  const [selectedCenterIds, setSelectedCenterIds] = useState<string[]>([]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    try {
      // جلب المراكز
      const centersSnap = await getDocs(collection(db, 'centers'));
      const centersList = centersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Center));
      setCenters(centersList);

      // جلب المشرفين
      const supervisorsQuery = query(
        collection(db, 'users'),
        where('role', '==', 'supervisor')
      );
      const supervisorsSnap = await getDocs(supervisorsQuery);
      const supervisorsList = supervisorsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Supervisor));
      setSupervisors(supervisorsList);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const handleEditSupervisor = (supervisor: Supervisor) => {
    setEditingSupervisor(supervisor);
    
    // تحضير القائمة الحالية للمراكز
    let currentCenters: string[] = [];
    if (supervisor.centerIds && supervisor.centerIds.length > 0) {
      currentCenters = supervisor.centerIds;
    } else if (supervisor.centerId) {
      currentCenters = [supervisor.centerId];
    }
    
    setSelectedCenterIds(currentCenters);
  };

  const handleCenterToggle = (centerId: string) => {
    setSelectedCenterIds(prev => {
      if (prev.includes(centerId)) {
        return prev.filter(id => id !== centerId);
      } else {
        return [...prev, centerId];
      }
    });
  };

  const handleSaveCenters = async () => {
    if (!editingSupervisor) return;

    try {
      const updateData: any = {
        centerIds: selectedCenterIds
      };

      // إزالة centerId القديم إذا كان موجوداً
      if (editingSupervisor.centerId) {
        updateData.centerId = null;
      }

      await updateDoc(doc(db, 'users', editingSupervisor.id), updateData);
      
      // تحديث الواجهة
      setSupervisors(prev => prev.map(sup => 
        sup.id === editingSupervisor.id 
          ? { ...sup, centerIds: selectedCenterIds, centerId: undefined }
          : sup
      ));

      setEditingSupervisor(null);
      setSelectedCenterIds([]);
      
      alert('تم تحديث مراكز المشرف بنجاح');
    } catch (error) {
      console.error('Error updating supervisor centers:', error);
      alert('حدث خطأ أثناء التحديث');
    }
  };

  const getCenterNames = (supervisor: Supervisor): string => {
    let centerIds: string[] = [];
    
    if (supervisor.centerIds && supervisor.centerIds.length > 0) {
      centerIds = supervisor.centerIds;
    } else if (supervisor.centerId) {
      centerIds = [supervisor.centerId];
    }
    
    const names = centerIds
      .map(id => centers.find(c => c.id === id)?.name)
      .filter(Boolean);
    
    return names.length > 0 ? names.join(', ') : 'لا يوجد';
  };

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <section className="page">
        <div className="container">
          <div className="loading">جاري التحميل...</div>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="container">
        <div className="page-header">
          <h1>🏢 ربط المشرفين بالمراكز</h1>
          <p>إدارة المراكز التي يشرف عليها كل مشرف</p>
        </div>

        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>اسم المشرف</th>
                  <th>البريد الإلكتروني</th>
                  <th>المراكز المخصصة</th>
                  <th>العمليات</th>
                </tr>
              </thead>
              <tbody>
                {supervisors.map((supervisor) => (
                  <tr key={supervisor.id}>
                    <td>{supervisor.name}</td>
                    <td>{supervisor.email}</td>
                    <td>{getCenterNames(supervisor)}</td>
                    <td>
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => handleEditSupervisor(supervisor)}
                      >
                        تعديل المراكز
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* نافذة تعديل المراكز */}
        {editingSupervisor && (
          <div className="modal-overlay" onClick={() => setEditingSupervisor(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>تعديل مراكز المشرف: {editingSupervisor.name}</h2>
                <button 
                  className="close-btn"
                  onClick={() => setEditingSupervisor(null)}
                >
                  &times;
                </button>
              </div>
              
              <div className="modal-body">
                <p>اختر المراكز التي سيشرف عليها هذا المشرف:</p>
                
                <div className="centers-list">
                  {centers.map((center) => (
                    <label key={center.id} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedCenterIds.includes(center.id)}
                        onChange={() => handleCenterToggle(center.id)}
                      />
                      <span className="checkmark"></span>
                      <span className="center-info">
                        <strong>{center.name}</strong>
                        <small>{center.address}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  className="btn btn-success"
                  onClick={handleSaveCenters}
                  disabled={selectedCenterIds.length === 0}
                >
                  💾 حفظ التغييرات
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={() => setEditingSupervisor(null)}
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default SupervisorCenters;