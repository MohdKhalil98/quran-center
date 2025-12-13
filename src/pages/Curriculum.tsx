import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import '../styles/Curriculum.css';

// Types for the new challenge-based curriculum
interface Stage {
  id: string;
  name: string;
  order: number;
  memorization: string;      // الحفظ
  nearReview: string;        // المراجعة القريبة
  farReview: string;         // المراجعة البعيدة
  stageBonus: number;
}

interface CurriculumLevel {
  id: string;
  name: string;
  order: number;
  stages: Stage[];
  levelBonus: number;
  centerId?: string;
}

// Points configuration
const POINTS_SYSTEM = {
  MEMORIZATION: 30,
  NEAR_REVIEW: 20,
  FAR_REVIEW: 20,
  STAGE_COMPLETION: 30,
  LEVEL_COMPLETION: 200,
  PERFECT_RATING_BONUS: 10,
  RETRY_PENALTY: -5,
};

const Curriculum: React.FC = () => {
  const { userProfile, isSupervisor, isAdmin, isTeacher, isStudent } = useAuth();
  const [levels, setLevels] = useState<CurriculumLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<CurriculumLevel | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingLevel, setIsAddingLevel] = useState(false);
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);

  // Form states
  const [newLevelName, setNewLevelName] = useState('');
  const [newLevelBonus, setNewLevelBonus] = useState(200);
  const [newStageName, setNewStageName] = useState('');
  const [newStageMemorization, setNewStageMemorization] = useState('');
  const [newStageNearReview, setNewStageNearReview] = useState('');
  const [newStageFarReview, setNewStageFarReview] = useState('');
  const [newStageBonus, setNewStageBonus] = useState(30);

  const canEdit = isSupervisor || isAdmin;

  useEffect(() => {
    fetchCurriculum();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.centerId]);

  const fetchCurriculum = async () => {
    if (!userProfile?.centerId) return;
    
    try {
      setLoading(true);
      const curriculumRef = collection(db, 'curriculum');
      const q = query(curriculumRef, where('centerId', '==', userProfile.centerId));
      const snapshot = await getDocs(q);
      
      const fetchedLevels: CurriculumLevel[] = [];
      snapshot.forEach(docSnap => {
        fetchedLevels.push({
          id: docSnap.id,
          ...docSnap.data()
        } as CurriculumLevel);
      });
      
      // Sort by order
      fetchedLevels.sort((a, b) => a.order - b.order);
      setLevels(fetchedLevels);
      
      // If no curriculum exists for this center, create default
      if (fetchedLevels.length === 0 && canEdit) {
        await createDefaultCurriculum();
      }
    } catch (error) {
      console.error('Error fetching curriculum:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultCurriculum = async () => {
    if (!userProfile?.centerId) return;
    
    // Create a default curriculum structure based on "خطة منهج جزء عم"
    const defaultLevels: Omit<CurriculumLevel, 'id'>[] = [
      {
        name: 'المستوى الأول',
        order: 1,
        levelBonus: POINTS_SYSTEM.LEVEL_COMPLETION,
        centerId: userProfile.centerId,
        stages: [
          {
            id: 'stage-1-1',
            name: 'المرحلة الأولى',
            order: 1,
            memorization: 'سورة الناس - سورة الفلق',
            nearReview: '-',
            farReview: '-',
            stageBonus: POINTS_SYSTEM.STAGE_COMPLETION,
          },
          {
            id: 'stage-1-2',
            name: 'المرحلة الثانية',
            order: 2,
            memorization: 'سورة الإخلاص - سورة المسد',
            nearReview: 'سورة الناس - سورة الفلق',
            farReview: '-',
            stageBonus: POINTS_SYSTEM.STAGE_COMPLETION,
          },
          {
            id: 'stage-1-3',
            name: 'المرحلة الثالثة',
            order: 3,
            memorization: 'سورة النصر - سورة الكافرون',
            nearReview: 'سورة الإخلاص - سورة المسد',
            farReview: 'سورة الناس - سورة الفلق',
            stageBonus: POINTS_SYSTEM.STAGE_COMPLETION,
          },
        ],
      },
      {
        name: 'المستوى الثاني',
        order: 2,
        levelBonus: POINTS_SYSTEM.LEVEL_COMPLETION,
        centerId: userProfile.centerId,
        stages: [
          {
            id: 'stage-2-1',
            name: 'المرحلة الأولى',
            order: 1,
            memorization: 'سورة الكوثر - سورة الماعون',
            nearReview: 'سورة النصر - سورة الكافرون',
            farReview: 'سورة الإخلاص - سورة المسد',
            stageBonus: POINTS_SYSTEM.STAGE_COMPLETION,
          },
          {
            id: 'stage-2-2',
            name: 'المرحلة الثانية',
            order: 2,
            memorization: 'سورة قريش - سورة الفيل',
            nearReview: 'سورة الكوثر - سورة الماعون',
            farReview: 'سورة النصر - سورة الكافرون',
            stageBonus: POINTS_SYSTEM.STAGE_COMPLETION,
          },
        ],
      },
    ];

    try {
      const curriculumRef = collection(db, 'curriculum');
      for (const level of defaultLevels) {
        await addDoc(curriculumRef, level);
      }
      await fetchCurriculum();
    } catch (error) {
      console.error('Error creating default curriculum:', error);
    }
  };

  const handleAddLevel = async () => {
    if (!newLevelName.trim() || !userProfile?.centerId) return;
    
    try {
      const newLevel: Omit<CurriculumLevel, 'id'> = {
        name: newLevelName,
        order: levels.length + 1,
        levelBonus: newLevelBonus,
        centerId: userProfile.centerId,
        stages: [],
      };
      
      const curriculumRef = collection(db, 'curriculum');
      await addDoc(curriculumRef, newLevel);
      
      setNewLevelName('');
      setNewLevelBonus(200);
      setIsAddingLevel(false);
      await fetchCurriculum();
    } catch (error) {
      console.error('Error adding level:', error);
    }
  };

  const handleDeleteLevel = async (levelId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المستوى؟')) return;
    
    try {
      await deleteDoc(doc(db, 'curriculum', levelId));
      await fetchCurriculum();
      if (selectedLevel?.id === levelId) {
        setSelectedLevel(null);
      }
    } catch (error) {
      console.error('Error deleting level:', error);
    }
  };

  const handleAddStage = async () => {
    if (!selectedLevel || !newStageName.trim()) return;
    
    const newStage: Stage = {
      id: `stage-${Date.now()}`,
      name: newStageName,
      order: selectedLevel.stages.length + 1,
      memorization: newStageMemorization,
      nearReview: newStageNearReview || '-',
      farReview: newStageFarReview || '-',
      stageBonus: newStageBonus,
    };
    
    try {
      const levelRef = doc(db, 'curriculum', selectedLevel.id);
      await updateDoc(levelRef, {
        stages: [...selectedLevel.stages, newStage],
      });
      
      resetStageForm();
      setIsAddingStage(false);
      await fetchCurriculum();
      
      // Update selected level
      const updatedLevel = { ...selectedLevel, stages: [...selectedLevel.stages, newStage] };
      setSelectedLevel(updatedLevel);
    } catch (error) {
      console.error('Error adding stage:', error);
    }
  };

  const handleUpdateStage = async () => {
    if (!selectedLevel || !editingStage) return;
    
    const updatedStages = selectedLevel.stages.map(s =>
      s.id === editingStage.id
        ? {
            ...editingStage,
            name: newStageName,
            memorization: newStageMemorization,
            nearReview: newStageNearReview || '-',
            farReview: newStageFarReview || '-',
            stageBonus: newStageBonus,
          }
        : s
    );
    
    try {
      const levelRef = doc(db, 'curriculum', selectedLevel.id);
      await updateDoc(levelRef, { stages: updatedStages });
      
      resetStageForm();
      setEditingStage(null);
      await fetchCurriculum();
      
      const updatedLevel = { ...selectedLevel, stages: updatedStages };
      setSelectedLevel(updatedLevel);
    } catch (error) {
      console.error('Error updating stage:', error);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!selectedLevel || !window.confirm('هل أنت متأكد من حذف هذه المرحلة؟')) return;
    
    const updatedStages = selectedLevel.stages.filter(s => s.id !== stageId);
    
    try {
      const levelRef = doc(db, 'curriculum', selectedLevel.id);
      await updateDoc(levelRef, { stages: updatedStages });
      
      await fetchCurriculum();
      const updatedLevel = { ...selectedLevel, stages: updatedStages };
      setSelectedLevel(updatedLevel);
    } catch (error) {
      console.error('Error deleting stage:', error);
    }
  };

  const startEditStage = (stage: Stage) => {
    setEditingStage(stage);
    setNewStageName(stage.name);
    setNewStageMemorization(stage.memorization);
    setNewStageNearReview(stage.nearReview);
    setNewStageFarReview(stage.farReview);
    setNewStageBonus(stage.stageBonus);
  };

  const resetStageForm = () => {
    setNewStageName('');
    setNewStageMemorization('');
    setNewStageNearReview('');
    setNewStageFarReview('');
    setNewStageBonus(30);
  };

  if (loading) {
    return (
      <div className="curriculum-container">
        <div className="loading-spinner">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="curriculum-container">
      <div className="curriculum-header">
        <h1>📚 المنهج الدراسي</h1>
        {canEdit && (
          <div className="header-actions">
            <button 
              className={`edit-mode-btn ${isEditing ? 'active' : ''}`}
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? '✓ إنهاء التحرير' : '✏️ تحرير المنهج'}
            </button>
          </div>
        )}
      </div>

      {/* Points System Info */}
      <div className="points-info-card">
        <h3>🏆 نظام النقاط</h3>
        <div className="points-grid">
          <div className="point-item">
            <span className="point-label">الحفظ</span>
            <span className="point-value">{POINTS_SYSTEM.MEMORIZATION} نقطة</span>
          </div>
          <div className="point-item">
            <span className="point-label">المراجعة القريبة</span>
            <span className="point-value">{POINTS_SYSTEM.NEAR_REVIEW} نقطة</span>
          </div>
          <div className="point-item">
            <span className="point-label">المراجعة البعيدة</span>
            <span className="point-value">{POINTS_SYSTEM.FAR_REVIEW} نقطة</span>
          </div>
          <div className="point-item">
            <span className="point-label">إتمام المرحلة</span>
            <span className="point-value">{POINTS_SYSTEM.STAGE_COMPLETION} نقطة</span>
          </div>
          <div className="point-item">
            <span className="point-label">إتمام المستوى</span>
            <span className="point-value">{POINTS_SYSTEM.LEVEL_COMPLETION} نقطة</span>
          </div>
          <div className="point-item bonus">
            <span className="point-label">مكافأة التقييم الممتاز</span>
            <span className="point-value">+{POINTS_SYSTEM.PERFECT_RATING_BONUS} نقطة</span>
          </div>
        </div>
      </div>

      <div className="curriculum-content">
        {/* Levels Sidebar */}
        <div className="levels-sidebar">
          <h2>المستويات</h2>
          
          {levels.map(level => (
            <div
              key={level.id}
              className={`level-card ${selectedLevel?.id === level.id ? 'selected' : ''}`}
              onClick={() => setSelectedLevel(level)}
            >
              <div className="level-info">
                <span className="level-name">{level.name}</span>
                <span className="level-stages-count">{level.stages.length} مراحل</span>
              </div>
              {isEditing && (
                <button
                  className="delete-btn small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteLevel(level.id);
                  }}
                >
                  🗑️
                </button>
              )}
            </div>
          ))}

          {isEditing && !isAddingLevel && (
            <button className="add-level-btn" onClick={() => setIsAddingLevel(true)}>
              + إضافة مستوى جديد
            </button>
          )}

          {isAddingLevel && (
            <div className="add-level-form">
              <input
                type="text"
                placeholder="اسم المستوى"
                value={newLevelName}
                onChange={(e) => setNewLevelName(e.target.value)}
              />
              <input
                type="number"
                placeholder="مكافأة المستوى"
                value={newLevelBonus}
                onChange={(e) => setNewLevelBonus(Number(e.target.value))}
              />
              <div className="form-actions">
                <button className="save-btn" onClick={handleAddLevel}>حفظ</button>
                <button className="cancel-btn" onClick={() => setIsAddingLevel(false)}>إلغاء</button>
              </div>
            </div>
          )}
        </div>

        {/* Stages Table */}
        <div className="stages-panel">
          {selectedLevel ? (
            <>
              <div className="stages-header">
                <h2>{selectedLevel.name}</h2>
                <span className="level-bonus">مكافأة المستوى: {selectedLevel.levelBonus} نقطة</span>
              </div>

              <div className="stages-table-container">
                <table className="stages-table">
                  <thead>
                    <tr>
                      <th>المرحلة</th>
                      <th>الحفظ 📖</th>
                      <th>المراجعة القريبة 🔄</th>
                      <th>المراجعة البعيدة 📚</th>
                      <th>النقاط</th>
                      {isEditing && <th>إجراءات</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedLevel.stages.map(stage => (
                      <tr key={stage.id}>
                        <td className="stage-name">{stage.name}</td>
                        <td className="memorization-cell">{stage.memorization}</td>
                        <td className="near-review-cell">{stage.nearReview}</td>
                        <td className="far-review-cell">{stage.farReview}</td>
                        <td className="points-cell">{stage.stageBonus}</td>
                        {isEditing && (
                          <td className="actions-cell">
                            <button
                              className="edit-btn small"
                              onClick={() => startEditStage(stage)}
                            >
                              ✏️
                            </button>
                            <button
                              className="delete-btn small"
                              onClick={() => handleDeleteStage(stage.id)}
                            >
                              🗑️
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {isEditing && !isAddingStage && !editingStage && (
                <button className="add-stage-btn" onClick={() => setIsAddingStage(true)}>
                  + إضافة مرحلة جديدة
                </button>
              )}

              {(isAddingStage || editingStage) && (
                <div className="stage-form">
                  <h3>{editingStage ? 'تعديل المرحلة' : 'إضافة مرحلة جديدة'}</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>اسم المرحلة</label>
                      <input
                        type="text"
                        value={newStageName}
                        onChange={(e) => setNewStageName(e.target.value)}
                        placeholder="مثال: المرحلة الأولى"
                      />
                    </div>
                    <div className="form-group">
                      <label>الحفظ 📖</label>
                      <input
                        type="text"
                        value={newStageMemorization}
                        onChange={(e) => setNewStageMemorization(e.target.value)}
                        placeholder="مثال: سورة الناس - سورة الفلق"
                      />
                    </div>
                    <div className="form-group">
                      <label>المراجعة القريبة 🔄</label>
                      <input
                        type="text"
                        value={newStageNearReview}
                        onChange={(e) => setNewStageNearReview(e.target.value)}
                        placeholder="اتركه فارغاً إذا لم يكن متاحاً"
                      />
                    </div>
                    <div className="form-group">
                      <label>المراجعة البعيدة 📚</label>
                      <input
                        type="text"
                        value={newStageFarReview}
                        onChange={(e) => setNewStageFarReview(e.target.value)}
                        placeholder="اتركه فارغاً إذا لم يكن متاحاً"
                      />
                    </div>
                    <div className="form-group">
                      <label>نقاط المرحلة</label>
                      <input
                        type="number"
                        value={newStageBonus}
                        onChange={(e) => setNewStageBonus(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="form-actions">
                    <button
                      className="save-btn"
                      onClick={editingStage ? handleUpdateStage : handleAddStage}
                    >
                      {editingStage ? 'تحديث' : 'إضافة'}
                    </button>
                    <button
                      className="cancel-btn"
                      onClick={() => {
                        resetStageForm();
                        setIsAddingStage(false);
                        setEditingStage(null);
                      }}
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="no-selection">
              <div className="empty-icon">📋</div>
              <p>اختر مستوى لعرض المراحل</p>
            </div>
          )}
        </div>
      </div>

      {/* Help Section for Students/Teachers */}
      {(isStudent || isTeacher) && (
        <div className="curriculum-help">
          <h3>📌 كيف يعمل النظام</h3>
          <div className="help-content">
            <div className="help-item">
              <span className="help-icon">📖</span>
              <div>
                <strong>الحفظ</strong>
                <p>حفظ السور المطلوبة في المرحلة الحالية</p>
              </div>
            </div>
            <div className="help-item">
              <span className="help-icon">🔄</span>
              <div>
                <strong>المراجعة القريبة</strong>
                <p>مراجعة ما تم حفظه في المرحلة السابقة</p>
              </div>
            </div>
            <div className="help-item">
              <span className="help-icon">📚</span>
              <div>
                <strong>المراجعة البعيدة</strong>
                <p>مراجعة ما تم حفظه قبل مرحلتين</p>
              </div>
            </div>
            <div className="help-item">
              <span className="help-icon">✅</span>
              <div>
                <strong>إتمام المرحلة</strong>
                <p>يجب اجتياز التحديات الثلاثة للانتقال للمرحلة التالية</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Curriculum;

