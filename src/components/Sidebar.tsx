import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { path: '/dashboard', label: 'لوحة التحكم' },
  { path: '/tracks', label: 'المساقات' },
  { path: '/teachers', label: 'المعلمون' },
  { path: '/groups', label: 'المجموعات' },
  { path: '/students', label: 'الطلاب' },
  { path: '/attendance', label: 'تسجيل الحضور' },
  { path: '/achievements', label: 'تحصيل الطالب' },
  { path: '/curriculum', label: 'المنهج' }
];

const Sidebar = () => {
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span role="img" aria-label="Quran">
          📖
        </span>{' '}
        مركز التحفيظ
      </div>
      <nav className="sidebar__nav">
        {navItems.map((item) => (
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
        {process.env.NODE_ENV === 'development' && (
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

