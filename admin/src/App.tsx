import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoadingBlock } from './components/ui';
import { RequireAccess, RequireAuth } from './auth/guards';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import { can, canEditAnyPage } from './lib/supabase';
import type { Profile } from './lib/supabase';

const PageList = lazy(() => import('./pages/content/PageList'));
const PageEditor = lazy(() => import('./pages/content/PageEditor'));
const BlogList = lazy(() => import('./pages/blogs/BlogList'));
const BlogEditor = lazy(() => import('./pages/blogs/BlogEditor'));
const ProjectList = lazy(() => import('./pages/projects/ProjectList'));
const ProjectEditor = lazy(() => import('./pages/projects/ProjectEditor'));
const Testimonials = lazy(() => import('./pages/Testimonials'));
const Enquiries = lazy(() => import('./pages/Enquiries'));
const Banner = lazy(() => import('./pages/Banner'));
const Settings = lazy(() => import('./pages/Settings'));
const Users = lazy(() => import('./pages/Users'));

const superAdmin = (p: Profile | null | undefined) => !!p?.is_active && p.role === 'super_admin';

export default function App() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<RequireAuth />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="change-password" element={<ChangePassword />} />

            <Route element={<RequireAccess check={canEditAnyPage} />}>
              <Route path="pages" element={<PageList />} />
              <Route path="pages/:id" element={<PageEditor />} />
            </Route>
            <Route element={<RequireAccess check={p => can(p, 'blogs')} />}>
              <Route path="blogs" element={<BlogList />} />
              <Route path="blogs/:id" element={<BlogEditor />} />
            </Route>
            <Route element={<RequireAccess check={p => can(p, 'projects')} />}>
              <Route path="projects" element={<ProjectList />} />
              <Route path="projects/:id" element={<ProjectEditor />} />
            </Route>
            <Route element={<RequireAccess check={p => can(p, 'testimonials')} />}>
              <Route path="testimonials" element={<Testimonials />} />
            </Route>

            <Route element={<RequireAccess check={superAdmin} />}>
              <Route path="enquiries" element={<Enquiries />} />
              <Route path="banner" element={<Banner />} />
              <Route path="settings" element={<Settings />} />
              <Route path="users" element={<Users />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
