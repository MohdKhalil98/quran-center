import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => (
  <div className="app-shell">
    <Sidebar />
    <main className="app-content">
      <div className="app-content__inner">
        <Outlet />
      </div>
    </main>
  </div>
);

export default Layout;

