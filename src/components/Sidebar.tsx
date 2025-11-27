import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  path: string;
  label: string;
  permission?: string;
  adminOnly?: boolean;
  supervisorOnly?: boolean;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'لوحة التحكم' },
  { path: '/tracks', label: 'المساقات', permission: 'manage_curriculum' },
  { path: '/groups', label: 'المجموعات', permission: 'manage_groups' },
  { path: '/teachers', label: 'المعلمون', supervisorOnly: true },
  { path: '/students', label: 'الطلاب', permission: 'view_students' },
  { path: '/attendance', label: 'تسجيل الحضور', permission: 'record_attendance' },
  { path: '/achievements', label: 'تحصيل الطالب', permission: 'update_achievements' },
  { path: '/curriculum', label: 'المنهج', permission: 'manage_curriculum' },
  { path: '/users', label: 'إدارة المستخدمين', adminOnly: true }
];

const Sidebar = () => {
  const { logout, hasPermission, isAdmin, isSupervisor, userProfile } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error(error);
    }
  };

  const canViewItem = (item: NavItem): boolean => {
    // Admin يرى كل شيء
    if (isAdmin) return true;

    // صفحات خاصة بالـ Admin فقط
    if (item.adminOnly) return false;

    // صفحات خاصة بالمشرفين والـ Admin
    if (item.supervisorOnly) return isSupervisor;

    // صفحات بصلاحيات محددة
    if (item.permission) return hasPermission(item.permission);

    // صفحات عامة (مثل لوحة التحكم)
    return true;
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

