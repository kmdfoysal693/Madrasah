import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {StandaloneAdminApp} from './components/StandaloneAdminApp.tsx';
import './index.css';

const normalizedPath = window.location.pathname.replace(/\/+$/, '');
const isAdminRoute =
  normalizedPath === '/admin' ||
  normalizedPath.startsWith('/admin/') ||
  window.location.hash === '#/admin';

createRoot(document.getElementById('root')!).render(
  isAdminRoute ? <StandaloneAdminApp /> : <App />,
);
