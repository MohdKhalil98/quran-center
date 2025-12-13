import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../context/AuthContext';
import '../styles/Leaderboard.css';

interface LeaderboardEntry extends UserProfile {
  totalPoints: number;
  completedLevels: number;
}

const Leaderboard = () => {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        // In a real app, you might want to index 'totalPoints' and use orderBy
        // For now, we'll fetch students and sort client-side if the dataset is small
        // or use a compound query if indexes exist.
        const q = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          // orderBy('totalPoints', 'desc'), // Requires index
          // limit(50)
        );
        
        const snapshot = await getDocs(q);
        const students: LeaderboardEntry[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            totalPoints: data.totalPoints || 0,
            completedLevels: data.completedLevels || 0
          } as LeaderboardEntry;
        });

        // Sort by points descending
        students.sort((a, b) => b.totalPoints - a.totalPoints);

        setLeaders(students);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) {
    return <div className="loading">جاري تحميل المتصدرين...</div>;
  }

  return (
    <div className="leaderboard-container">
      <h1 className="page-title">🏆 لوحة المتصدرين</h1>
      
      <div className="leaderboard-list">
        {leaders.length === 0 ? (
          <div className="no-data">لا يوجد طلاب مسجلين بعد</div>
        ) : (
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>الترتيب</th>
                <th>الطالب</th>
                <th>المستويات المنجزة</th>
                <th>النقاط</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((student, index) => (
                <tr key={student.uid} className={`rank-${index + 1}`}>
                  <td>
                    <span className="rank-badge">{index + 1}</span>
                  </td>
                  <td>
                    <div className="student-info">
                      <span className="student-name">{student.name}</span>
                    </div>
                  </td>
                  <td>
                    <div className="level-badges">
                      {Array.from({ length: student.completedLevels }).map((_, i) => (
                        <span key={i} className="level-star">⭐</span>
                      ))}
                      {student.completedLevels === 0 && '-'}
                    </div>
                  </td>
                  <td className="points-cell">
                    {student.totalPoints.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
