import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import RequesterLayout from "./layouts/RequesterLayout";
import LoginPage from "./pages/LoginPage";
import RequesterHomePage from "./pages/requester/RequesterHomePage";
import MyTicketsPage from "./pages/requester/MyTicketsPage";
import CreateTicketPage from "./pages/requester/CreateTicketPage";

import InternalLayout from "./layouts/InternalLayout";
import TechnicianHomePage from "./pages/technician/TechnicianHomePage";
import AssignedTicketsPage from "./pages/technician/AssignedTicketsPage";
import TicketDetailPage from "./pages/technician/TicketDetailPage";

import SupervisorHomePage from "./pages/supervisor/SupervisorHomePage";
import TicketQueuePage from "./pages/supervisor/TicketQueuePage";
import AssignmentManagementPage from "./pages/supervisor/AssignmentManagementPage";
import SupervisorDashboardPage from "./pages/supervisor/SupervisorDashboardPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/requester" element={<RequesterLayout />}>
          <Route index element={<RequesterHomePage />} />
          <Route path="tickets" element={<MyTicketsPage />} />
          <Route path="tickets/new" element={<CreateTicketPage />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/technician" element={<InternalLayout />}>
          <Route index element={<TechnicianHomePage />} />
          <Route path="tickets" element={<AssignedTicketsPage />} />
          <Route path="tickets/:id" element={<TicketDetailPage />} />
        </Route>

        <Route path="/supervisor" element={<InternalLayout />}>
          <Route index element={<SupervisorHomePage />} />
          <Route path="queue" element={<TicketQueuePage />} />
          <Route path="assignments" element={<AssignmentManagementPage />} />
          <Route path="dashboard" element={<SupervisorDashboardPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
