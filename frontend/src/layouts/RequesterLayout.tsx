import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ConfigProvider, Layout, Typography, message, theme } from "antd";

import "./RequesterLayout.css";

const { Sider, Header, Content } = Layout;

function OverviewGridIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" />
      <path d="M13 17v2" />
      <path d="M13 11v2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function getSelectedKey(pathname: string): string {
  if (pathname.startsWith("/requester/tickets/new")) {
    return "/requester/tickets/new";
  }
  if (pathname.startsWith("/requester/tickets")) {
    return "/requester/tickets";
  }
  return "/requester";
}

function getPageHeaderMeta(pathname: string): {
  title: string;
  subtitle: string;
} {
  if (pathname.startsWith("/requester/tickets/new")) {
    return {
      title: "Requester Portal Overview",
      subtitle:
        "Điền thông tin sự cố để hệ thống tự động phân loại mức ưu tiên (3×3 Priority Matrix) và điều phối tới bộ phận IT.",
    };
  }
  if (pathname.startsWith("/requester/tickets")) {
    return {
      title: "Ticket của tôi (My Tickets)",
      subtitle:
        "Theo dõi tiến độ xử lý, phản hồi kỹ thuật viên, xác nhận kết quả hoặc mở lại yêu cầu trong 72 giờ.",
    };
  }
  return {
    title: "Requester Portal Overview",
    subtitle:
      "Cổng tiếp nhận và theo dõi yêu cầu hỗ trợ CNTT dành cho nhân viên các phòng ban.",
  };
}

function RequesterLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();

  const selectedKey = getSelectedKey(location.pathname);
  const headerMeta = getPageHeaderMeta(location.pathname);

  const handleBackToLogin = () => {
    messageApi.info("Chuyển về màn hình Đăng nhập (FE-01).");
    navigate("/login");
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#0ea5e9",
          colorBgContainer: "#0b1220",
          colorBgElevated: "#0f172a",
          colorBorderSecondary: "rgba(255, 255, 255, 0.07)",
          borderRadius: 10,
        },
      }}
    >
      <Layout className="requester-shell">
        {contextHolder}

        <Sider
          width={255}
          breakpoint="lg"
          collapsedWidth="0"
          className="requester-sider"
        >
          <div className="requester-sider-inner">
            <div>
              <div className="requester-brand">
                <div className="requester-brand-logo">IT</div>
                <div className="requester-brand-text">
                  <span className="requester-brand-title">IT SUPPORT DESK</span>
                  <span className="requester-brand-subtitle">
                    Requester Portal
                  </span>
                </div>
              </div>

              <nav className="requester-nav-list" aria-label="Requester Menu">
                <button
                  type="button"
                  className={`requester-nav-item ${
                    selectedKey === "/requester" ? "active" : ""
                  }`}
                  onClick={() => navigate("/requester")}
                >
                  <span className="requester-nav-icon">
                    <OverviewGridIcon />
                  </span>
                  <span>Requester Overview</span>
                </button>

                <button
                  type="button"
                  className={`requester-nav-item ${
                    selectedKey === "/requester/tickets" ? "active" : ""
                  }`}
                  onClick={() => navigate("/requester/tickets")}
                >
                  <span className="requester-nav-icon">
                    <TicketIcon />
                  </span>
                  <span>My Tickets</span>
                </button>

                <button
                  type="button"
                  className={`requester-nav-item ${
                    selectedKey === "/requester/tickets/new" ? "active" : ""
                  }`}
                  onClick={() => navigate("/requester/tickets/new")}
                >
                  <span className="requester-nav-icon">
                    <PlusIcon />
                  </span>
                  <span>Create Support Request</span>
                </button>
              </nav>
            </div>

            <div className="requester-sider-footer">
              <div className="requester-user-card">
                <div className="requester-user-avatar">N</div>
                <div className="requester-user-meta">
                  <span className="requester-user-name">Nhân viên Demo</span>
                  <span className="requester-user-email">
                    requester@example.com
                  </span>
                </div>
              </div>

              <div className="requester-role-pill">
                <span className="requester-role-dot" />
                <span>Role: REQUESTER (Demo)</span>
              </div>

              <button
                type="button"
                className="requester-back-btn"
                onClick={handleBackToLogin}
              >
                ← Back to Sign In
              </button>
            </div>
          </div>
        </Sider>

        <Layout className="requester-main-layout">
          <Header className="requester-header">
            <div className="requester-header-top">
              <Typography.Title level={3} className="requester-header-title">
                {headerMeta.title}
              </Typography.Title>
              <span className="requester-version-badge">v1.0.3-preview</span>
            </div>

            <span className="requester-header-subtitle">
              {headerMeta.subtitle}
            </span>

            <div className="requester-header-actions">
              <button
                type="button"
                className="rp-btn-secondary"
                onClick={handleBackToLogin}
              >
                <span>Sign In Screen</span>
              </button>

              <button
                type="button"
                className="rp-btn-primary"
                onClick={() => navigate("/requester/tickets/new")}
              >
                <span>+ Create New Ticket</span>
              </button>
            </div>
          </Header>

          <Content className="requester-content">
            <div className="rp-warning-banner" role="status">
              <span className="rp-warning-icon">⚠</span>
              <div>
                <div className="rp-warning-title">
                  Dữ liệu minh họa Tuần 3 – Chưa kết nối API Backend &amp;
                  PostgreSQL
                </div>
                <div className="rp-warning-desc">
                  Giao diện nguyên mẫu FE-01 phục vụ kiểm chứng luồng trải
                  nghiệm và bố cục của Requester. Xác thực phiên làm việc thực
                  tế (<code>/api/v1/auth/*</code>) và lưu trữ Ticket (
                  <code>/api/v1/tickets</code>) sẽ được tích hợp ở Tuần 4.
                </div>
              </div>
            </div>

            <Outlet />
          </Content>

          <footer className="requester-footer">
            <div className="requester-footer-brand">
              <strong>IT SUPPORT DESK</strong> // Enterprise Operational Command
              &amp; IT Service Management
            </div>
            <div className="requester-footer-status">
              <span className="requester-status-ok">
                ● ALL SYSTEMS OPERATIONAL
              </span>
              <span>© 2026 IT HELPDESK. TELEMETRY LEVEL 0.</span>
            </div>
          </footer>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default RequesterLayout;
