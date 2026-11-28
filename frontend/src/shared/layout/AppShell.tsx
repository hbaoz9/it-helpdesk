import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  BarChartOutlined,
  BellOutlined,
  CheckOutlined,
  DesktopOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuOutlined,
  PlusOutlined,
  RobotOutlined,
  SettingOutlined,
  SwapOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  Dropdown,
  Empty,
  Layout,
  Menu,
  Popover,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import type { MenuProps } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/remoteSupport';
import type { NotificationRecord } from '../api/types';
import { useAuth } from '../auth/useAuth';
import { menu, workspaces } from '../../app/workspaces';
import type { Workspace } from '../../app/workspaces';
import '../../features/requester/RequesterPage.css';
import '../../styles/InternalWorkspace.css';
import './AppShell.css';

const { Sider, Header, Content } = Layout;
const icons: Record<string, ReactNode> = {
  '/requester': <HomeOutlined />,
  '/requester/ai': <RobotOutlined />,
  '/requester/tickets': <FileTextOutlined />,
  '/requester/tickets/new': <PlusOutlined />,
  '/requester/assets': <UnorderedListOutlined />,
  '/technician': <HomeOutlined />,
  '/technician/tickets': <UnorderedListOutlined />,
  '/technician/assets/dashboard': <BarChartOutlined />,
  '/technician/assets': <UnorderedListOutlined />,
  '/technician/asset-maintenance': <SettingOutlined />,
  '/technician/asset-history': <FileTextOutlined />,
  '/supervisor': <HomeOutlined />,
  '/supervisor/queue': <UnorderedListOutlined />,
  '/supervisor/assignments': <TeamOutlined />,
  '/supervisor/dashboard': <BarChartOutlined />,
  '/supervisor/assets/dashboard': <BarChartOutlined />,
  '/supervisor/assets': <UnorderedListOutlined />,
  '/supervisor/assets/assignments': <TeamOutlined />,
  '/supervisor/asset-maintenance': <SettingOutlined />,
  '/supervisor/asset-history': <FileTextOutlined />,
  '/admin': <TeamOutlined />,
  '/admin/categories': <UnorderedListOutlined />,
  '/admin/sla': <SettingOutlined />,
  '/admin/rustdesk': <DesktopOutlined />,
  '/admin/audit': <FileSearchOutlined />,
  '/admin/assets/dashboard': <BarChartOutlined />,
  '/admin/assets': <UnorderedListOutlined />,
  '/admin/assets/assignments': <TeamOutlined />,
  '/admin/asset-maintenance': <SettingOutlined />,
  '/admin/asset-history': <FileTextOutlined />,
  '/admin/asset-categories': <SettingOutlined />,
};

export default function AppShell({ workspace }: { workspace: Workspace }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifTick, setNotifTick] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();

  const available = (Object.keys(workspaces) as Workspace[]).filter((key) =>
    user?.roles.includes(workspaces[key].role),
  );
  const currentMenu = menu.filter((item) => item.workspace === workspace);
  const assetMenu = currentMenu.filter(
    (item) => item.path.includes('/assets') || item.path.includes('/asset-'),
  );
  const menuItem = (item: (typeof currentMenu)[number]) => ({
    key: item.path,
    icon: icons[item.path],
    label: (
      <Link to={item.path} onClick={() => setMobileOpen(false)}>
        {item.label}
      </Link>
    ),
  });
  const menuItems: MenuProps['items'] =
    workspace === 'requester'
      ? currentMenu.map(menuItem)
      : [
          ...currentMenu
            .filter((item) => !assetMenu.includes(item))
            .map(menuItem),
          ...(assetMenu.length
            ? [
                {
                  type: 'group' as const,
                  label: 'QUẢN LÝ TÀI SẢN',
                  children: assetMenu.map(menuItem),
                },
              ]
            : []),
        ];
  const selected = currentMenu
    .filter(
      (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
    )
    .reduce<(typeof currentMenu)[number] | undefined>(
      (mostSpecific, item) =>
        !mostSpecific || item.path.length > mostSpecific.path.length
          ? item
          : mostSpecific,
      undefined,
    );

  useEffect(() => {
    if (!user) return;
    let active = true;
    getMyNotifications(false, 12)
      .then((res) => {
        if (!active) return;
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount);
      })
      .catch(() => {
        /* ignore notification polling errors */
      });
    return () => {
      active = false;
    };
  }, [user, pathname, notifTick]);

  const signOut = async () => {
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : 'Không thể đăng xuất.',
      );
    }
  };

  const handleNotificationClick = async (item: NotificationRecord) => {
    if (!item.readAt) {
      try {
        await markNotificationRead(item.id);
        setNotifTick((v) => v + 1);
      } catch {
        /* ignore */
      }
    }
    setNotifOpen(false);
    if (item.ticketId) {
      if (workspace === 'requester') {
        navigate(`/requester/tickets/${item.ticketId}`);
      } else if (workspace === 'technician') {
        navigate(`/technician/tickets/${item.ticketId}`);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifTick((v) => v + 1);
    } catch {
      /* ignore */
    }
  };

  const notificationContent = (
    <div style={{ width: 340, maxHeight: 420, overflowY: 'auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 8,
          borderBottom: '1px solid #f1f5f9',
          marginBottom: 8,
        }}
      >
        <Typography.Text strong>
          Thông báo hệ thống ({unreadCount} chưa đọc)
        </Typography.Text>
        {unreadCount > 0 && (
          <Button
            type="link"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => void handleMarkAllRead()}
          >
            Đọc tất cả
          </Button>
        )}
      </div>
      {notifications.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Chưa có thông báo nào"
        />
      ) : (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => void handleNotificationClick(item)}
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                background: item.readAt ? '#ffffff' : '#eff6ff',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                <Typography.Text strong style={{ fontSize: 13 }}>
                  {item.title}
                </Typography.Text>
                {!item.readAt && <Tag color="blue">Mới</Tag>}
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                {item.message}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                {new Date(item.createdAt).toLocaleString('vi-VN')}
              </div>
            </div>
          ))}
        </Space>
      )}
    </div>
  );

  const sidebar = (
    <div className="smartdesk-sidebar">
      <Link
        className="smartdesk-brand"
        to={workspaces[workspace].path}
        onClick={() => setMobileOpen(false)}
      >
        <span className="smartdesk-logo">S</span>
        <span>
          <strong>SmartDesk</strong>
          <small>INTELLIGENT IT SUPPORT</small>
        </span>
      </Link>
      <div className="smartdesk-sidebar-label">
        {workspaces[workspace].label.toUpperCase()}
      </div>
      <Menu
        mode="inline"
        selectedKeys={[selected?.path ?? workspaces[workspace].path]}
        items={menuItems}
      />
      {available.length > 1 && (
        <>
          <div className="smartdesk-sidebar-label">WORKSPACE KHÁC</div>
          <Menu
            mode="inline"
            selectedKeys={[]}
            items={available
              .filter((key) => key !== workspace)
              .map((key) => ({
                key,
                icon: <SwapOutlined />,
                label: (
                  <Link
                    to={workspaces[key].path}
                    onClick={() => setMobileOpen(false)}
                  >
                    {workspaces[key].label}
                  </Link>
                ),
              }))}
          />
        </>
      )}
      <div className="smartdesk-sidebar-spacer" />
      <div className="smartdesk-sidebar-bottom">{user?.email}</div>
    </div>
  );

  return (
    <Layout className="smartdesk-shell">
      {contextHolder}
      <Sider width={236} className="smartdesk-sider">
        {sidebar}
      </Sider>
      <Drawer
        title="SmartDesk"
        placement="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        className="smartdesk-drawer"
        size={280}
      >
        {sidebar}
      </Drawer>
      <Layout className="smartdesk-main">
        <Header className="smartdesk-header">
          <div className="smartdesk-header-left">
            <Button
              className="smartdesk-menu-toggle"
              type="text"
              icon={<MenuOutlined />}
              aria-label="Mở menu"
              onClick={() => setMobileOpen(true)}
            />
            <span className="smartdesk-breadcrumb">
              SmartDesk / {workspaces[workspace].label} /{' '}
              <strong>{selected?.label ?? 'Chi tiết Ticket'}</strong>
            </span>
          </div>
          <div className="smartdesk-header-actions">
            <Popover
              content={notificationContent}
              trigger="click"
              open={notifOpen}
              onOpenChange={(open) => {
                setNotifOpen(open);
                if (open) setNotifTick((v) => v + 1);
              }}
              placement="bottomRight"
            >
              <Badge count={unreadCount} size="small" offset={[-4, 4]}>
                <Button
                  type="text"
                  icon={<BellOutlined />}
                  aria-label="Thông báo hệ thống"
                />
              </Badge>
            </Popover>
            <Dropdown
              menu={{
                items: [
                  { key: 'account', label: user?.email, disabled: true },
                  { type: 'divider' },
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: 'Đăng xuất',
                    onClick: signOut,
                  },
                ],
              }}
            >
              <Button type="text" className="smartdesk-account">
                <Avatar size="small">
                  {user?.fullName.slice(0, 1).toUpperCase()}
                </Avatar>
                <span>{user?.fullName}</span>
              </Button>
            </Dropdown>
          </div>
        </Header>
        <Content className="smartdesk-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
