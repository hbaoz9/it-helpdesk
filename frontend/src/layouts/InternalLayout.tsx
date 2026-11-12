import type { ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ConfigProvider, Layout, theme } from 'antd';

import { INTERNAL_PATHS } from './internalPaths';
import './InternalLayout.css';
import '../styles/InternalWorkspace.css';

const { Sider, Header, Content } = Layout;

function NavIcon({ children }: { children: ReactNode }) {
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
      {children}
    </svg>
  );
}

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Technician Workspace',
    items: [
      {
        path: INTERNAL_PATHS.technician,
        label: 'Technician Overview',
        icon: (
          <NavIcon>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </NavIcon>
        ),
      },
      {
        path: INTERNAL_PATHS.technicianTickets,
        label: 'Assigned Tickets',
        icon: (
          <NavIcon>
            <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
            <path d="M13 5v2" />
            <path d="M13 17v2" />
            <path d="M13 11v2" />
          </NavIcon>
        ),
      },
    ],
  },
  {
    label: 'Supervisor Workspace',
    items: [
      {
        path: INTERNAL_PATHS.supervisor,
        label: 'Supervisor Overview',
        icon: (
          <NavIcon>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </NavIcon>
        ),
      },
      {
        path: INTERNAL_PATHS.supervisorQueue,
        label: 'Ticket Queue',
        icon: (
          <NavIcon>
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </NavIcon>
        ),
      },
      {
        path: INTERNAL_PATHS.supervisorAssignments,
        label: 'Assignment Management',
        icon: (
          <NavIcon>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </NavIcon>
        ),
      },
      {
        path: INTERNAL_PATHS.supervisorDashboard,
        label: 'Supervisor Dashboard',
        icon: (
          <NavIcon>
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </NavIcon>
        ),
      },
    ],
  },
];

const ALL_NAV_PATHS = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => item.path),
).sort((a, b) => b.length - a.length);

function getSelectedKey(pathname: string): string {
  return (
    ALL_NAV_PATHS.find(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    ) ?? INTERNAL_PATHS.technician
  );
}

function getPageHeaderMeta(pathname: string): {
  title: string;
  subtitle: string;
} {
  if (pathname.startsWith(`${INTERNAL_PATHS.technicianTickets}/`)) {
    return {
      title: 'Chi tiết Ticket',
      subtitle:
        'Thông tin, trao đổi và lịch sử hoạt động của Ticket minh họa.',
    };
  }
  if (pathname.startsWith(INTERNAL_PATHS.technicianTickets)) {
    return {
      title: 'Ticket được phân công',
      subtitle:
        'Danh sách Ticket dành cho Technician, có thể lọc theo trạng thái.',
    };
  }
  if (pathname.startsWith(INTERNAL_PATHS.supervisorQueue)) {
    return {
      title: 'Ticket Queue',
      subtitle: 'Danh sách Ticket đang chờ phân loại.',
    };
  }
  if (pathname.startsWith(INTERNAL_PATHS.supervisorAssignments)) {
    return {
      title: 'Assignment Management',
      subtitle:
        'Khu vực theo dõi tình trạng phân công Ticket cho Technician.',
    };
  }
  if (pathname.startsWith(INTERNAL_PATHS.supervisorDashboard)) {
    return {
      title: 'Supervisor Dashboard',
      subtitle: 'Khung quản lý và theo dõi tiến độ xử lý Ticket.',
    };
  }
  if (pathname.startsWith(INTERNAL_PATHS.supervisor)) {
    return {
      title: 'Supervisor Workspace',
      subtitle: 'Tổng quan tiếp nhận, phân loại và theo dõi Ticket.',
    };
  }
  return {
    title: 'Technician Workspace',
    subtitle: 'Trang tổng quan dành cho nhân viên IT xử lý Ticket.',
  };
}

function InternalLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey = getSelectedKey(location.pathname);
  const headerMeta = getPageHeaderMeta(location.pathname);
  const isSupervisor = location.pathname.startsWith(INTERNAL_PATHS.supervisor);

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#0ea5e9',
          colorBgContainer: '#0b1220',
          colorBgElevated: '#0f172a',
          colorBorderSecondary: 'rgba(255, 255, 255, 0.07)',
          borderRadius: 10,
        },
        components: {
          Input: { colorBgContainer: '#070d19', colorBorder: '#1a273d' },
          Select: { colorBgContainer: '#070d19', colorBorder: '#1a273d' },
        },
      }}
    >
      <Layout className="internal-shell">
        <Sider
          width={255}
          breakpoint="lg"
          collapsedWidth="0"
          className="internal-sider"
        >
          <div className="internal-sider-inner">
            <div>
              <div className="internal-brand">
                <div className="internal-brand-logo">IT</div>
                <div className="internal-brand-text">
                  <span className="internal-brand-title">IT SUPPORT DESK</span>
                  <span className="internal-brand-subtitle">
                    Internal Workspace
                  </span>
                </div>
              </div>

              {NAV_GROUPS.map((group) => (
                <nav
                  key={group.label}
                  className="internal-nav-list"
                  aria-label={group.label}
                >
                  <div className="internal-nav-group-label">{group.label}</div>
                  {group.items.map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      className={`internal-nav-item ${
                        selectedKey === item.path ? 'active' : ''
                      }`}
                      onClick={() => navigate(item.path)}
                    >
                      <span className="internal-nav-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </nav>
              ))}
            </div>

            <div className="internal-sider-footer">
              <div className="internal-user-card">
                <div className="internal-user-avatar">IT</div>
                <div className="internal-user-meta">
                  <span className="internal-user-name">
                    Nhân viên IT (Demo)
                  </span>
                  <span className="internal-user-email">
                    it.staff@example.com
                  </span>
                </div>
              </div>

              <div className="internal-role-pill">
                <span className="internal-role-dot" />
                <span>
                  Role: {isSupervisor ? 'SUPERVISOR' : 'TECHNICIAN'} (Demo)
                </span>
              </div>

              <button
                type="button"
                className="internal-back-btn"
                onClick={() => navigate('/login')}
              >
                ← Back to Sign In
              </button>
            </div>
          </div>
        </Sider>

        <Layout className="internal-main-layout">
          <Header className="internal-header">
            <div className="internal-header-top">
              <h1 className="internal-header-title">{headerMeta.title}</h1>
            </div>

            <span className="internal-header-subtitle">
              {headerMeta.subtitle}
            </span>

            <div className="internal-header-actions">
              <button
                type="button"
                className="iw-btn-secondary"
                onClick={() =>
                  navigate(
                    isSupervisor
                      ? INTERNAL_PATHS.technician
                      : INTERNAL_PATHS.supervisor,
                  )
                }
              >
                <span>
                  {isSupervisor
                    ? 'Chuyển sang Technician Workspace'
                    : 'Chuyển sang Supervisor Workspace'}
                </span>
              </button>
            </div>
          </Header>

          <Content className="internal-content">
            <div className="iw-warning-banner" role="status">
              <span className="iw-warning-icon">⚠</span>
              <div>
                <div className="iw-warning-title">
                  Dữ liệu minh họa – chưa kết nối Backend
                </div>
                <div className="iw-warning-desc">
                  Giao diện nguyên mẫu FE-02 dùng dữ liệu mẫu để trình diễn bố
                  cục. Assignment, Workflow, Internal Notes và Dashboard thật
                  chưa được triển khai trong Tuần 3.
                </div>
              </div>
            </div>

            <Outlet />
          </Content>

          <footer className="internal-footer">
            <div className="internal-footer-brand">
              <strong>IT SUPPORT DESK</strong> // Enterprise Operational Command
              &amp; IT Service Management
            </div>
            <div className="internal-footer-status">
              <span className="internal-status-ok">
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

export default InternalLayout;
