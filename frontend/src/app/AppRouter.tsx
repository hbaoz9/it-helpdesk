import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import RequireRole from '../shared/auth/RequireRole';
import AppShell from '../shared/layout/AppShell';
import LoginPage from '../pages/LoginPage';
import LandingPage from '../pages/LandingPage';
import RequesterHomePage from '../features/requester/RequesterHomePage';
import MyTicketsPage from '../features/requester/MyTicketsPage';
import RequesterTicketDetailPage from '../features/requester/RequesterTicketDetailPage';
import CreateTicketPage from '../features/requester/CreateTicketPage';
import AiAssistantPage from '../features/ai/AiAssistantPage';
import TechnicianHomePage from '../features/technician/TechnicianHomePage';
import AssignedTicketsPage from '../features/technician/AssignedTicketsPage';
import TicketDetailPage from '../features/technician/TicketDetailPage';
import SupervisorHomePage from '../features/supervisor/SupervisorHomePage';
import TicketQueuePage from '../features/supervisor/TicketQueuePage';
import AssignmentManagementPage from '../features/supervisor/AssignmentManagementPage';
import SupervisorDashboardPage from '../features/supervisor/SupervisorDashboardPage';
import AdminHomePage from '../features/admin/AdminHomePage';
import { useAuth } from '../shared/auth/useAuth';
import { homePath } from './workspaces';

function EntryRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? homePath(user.roles) : '/login'} replace />;
}

export default function AppRouter() {
  return <BrowserRouter><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/requester" element={<RequireRole roles={['REQUESTER']}><AppShell workspace="requester" /></RequireRole>}>
      <Route index element={<RequesterHomePage />} />
      <Route path="tickets" element={<MyTicketsPage />} />
      <Route path="tickets/new" element={<CreateTicketPage />} />
      <Route path="tickets/:id" element={<RequesterTicketDetailPage />} />
      <Route path="ai" element={<AiAssistantPage />} />
    </Route>
    <Route path="/technician" element={<RequireRole roles={['TECHNICIAN']}><AppShell workspace="technician" /></RequireRole>}>
      <Route index element={<TechnicianHomePage />} />
      <Route path="tickets" element={<AssignedTicketsPage />} />
      <Route path="tickets/:id" element={<TicketDetailPage />} />
    </Route>
    <Route path="/supervisor" element={<RequireRole roles={['SUPERVISOR']}><AppShell workspace="supervisor" /></RequireRole>}>
      <Route index element={<SupervisorHomePage />} />
      <Route path="queue" element={<TicketQueuePage />} />
      <Route path="assignments" element={<AssignmentManagementPage />} />
      <Route path="dashboard" element={<SupervisorDashboardPage />} />
    </Route>
    <Route path="/admin" element={<RequireRole roles={['ADMIN']}><AppShell workspace="admin" /></RequireRole>}>
      <Route index element={<AdminHomePage />} />
    </Route>
    <Route path="*" element={<EntryRoute />} />
  </Routes></BrowserRouter>;
}
