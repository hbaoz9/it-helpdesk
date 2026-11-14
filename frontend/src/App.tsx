import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import RequesterLayout from "./layouts/RequesterLayout";
import LoginPage from "./pages/LoginPage";
import RequesterHomePage from "./pages/requester/RequesterHomePage";
import MyTicketsPage from "./pages/requester/MyTicketsPage";
import CreateTicketPage from "./pages/requester/CreateTicketPage";

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
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
