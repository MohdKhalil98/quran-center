import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  path: string;
  label: string;
  roles?: string[]; // الأدوار المسموح لها بالوصول
  showBadge?: boolean; // لإظهار عداد
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'لوحة التحكم' },
  // صفحات المطور فقط
  { path: '/centers', label: 'مراكز القرآن', roles: ['admin'] },
  { path: '/teachers', label: 'المعلمون', roles: ['admin'] },
  { path: '/students', label: 'الطلاب', roles: ['admin'] },
  // صفحات المشرف
  { path: '/pending-requests', label: 'طلبات الانتظار', roles: ['supervisor'], showBadge: true },
  { path: '/groups', label: 'المجموعات', roles: ['supervisor'] },
  { path: '/teachers', label: 'المعلمون', roles: ['supervisor'] },
  { path: '/students', label: 'الطلاب', roles: ['supervisor'] },
  // صفحات المعلم
  { path: '/groups', label: 'حلقاتي', roles: ['teacher'] },
  { path: '/students', label: 'طلابي', roles: ['teacher'] },
  { path: '/attendance', label: 'تسجيل الحضور', roles: ['teacher'] },
  { path: '/achievements', label: 'تحصيل الطالب', roles: ['teacher'] },
  // صفحات الطالب
  { path: '/my-progress', label: 'تحصيلي', roles: ['student'] },
  // صفحات عامة
  { path: '/curriculum', label: 'المنهج', roles: ['supervisor', 'teacher', 'student'] },
  { path: '/leaderboard', label: 'المتصدرين', roles: ['supervisor', 'teacher', 'student'] }
];

const Sidebar = () => {
  const { logout, isAdmin, userProfile, isSupervisor } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchPendingCount = async () => {
      if (!isSupervisor || !userProfile?.centerId) return;
      
      try {
        const pendingQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('centerId', '==', userProfile.centerId),
          where('status', '==', 'pending')
        );
        const snapshot = await getDocs(pendingQuery);
        setPendingCount(snapshot.size);
      } catch (error) {
        console.error('Error fetching pending count:', error);
      }
    };

    fetchPendingCount();
    // تحديث كل 30 ثانية
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [isSupervisor, userProfile]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error(error);
    }
  };

  const canViewItem = (item: NavItem): boolean => {
    // صفحات بدون تحديد أدوار = للجميع
    if (!item.roles) return true;

    // التحقق من دور المستخدم
    if (!userProfile) return false;
    return item.roles.includes(userProfile.role);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span role="img" aria-label="Quran">
          📖
        </span>{' '}
        مركز التحفيظ
      </div>
      
      {userProfile && (
        <div style={{ padding: '0.5rem 0.75rem', marginBottom: '1rem', textAlign: 'right' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-primary)' }}>
            {userProfile.name}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {userProfile.role === 'admin' && 'مطور'}
            {userProfile.role === 'supervisor' && 'مشرف'}
            {userProfile.role === 'teacher' && 'معلم'}
            {userProfile.role === 'student' && 'طالب'}
            {userProfile.role === 'parent' && 'ولي أمر'}
          </div>
        </div>
      )}
      
      <nav className="sidebar__nav">
        {navItems.filter(canViewItem).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              isActive ? 'sidebar__link sidebar__link--active' : 'sidebar__link'
            }
          >
            {item.label}
            {item.showBadge && pendingCount > 0 && (
              <span className="sidebar__badge">{pendingCount}</span>
            )}
          </NavLink>
        ))}
        {process.env.NODE_ENV === 'development' && isAdmin && (
          <NavLink
            to="/dev-tools"
            className={({ isActive }) =>
              isActive ? 'sidebar__link sidebar__link--active' : 'sidebar__link'
            }
          >
            أدوات المطور
          </NavLink>
        )}
      </nav>
      <button type="button" className="sidebar__logout" onClick={handleLogout}>
        تسجيل الخروج
      </button>
    </aside>
  );
};

export default Sidebar;

