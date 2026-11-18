import { useState } from 'react';
import type { ReactNode } from 'react';
import { BarChartOutlined, BellOutlined, FileTextOutlined, HomeOutlined, LogoutOutlined, MenuOutlined, PlusOutlined, SettingOutlined, SwapOutlined, TeamOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Avatar, Button, Drawer, Dropdown, Layout, Menu, Tooltip, message } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { menu, workspaces } from '../../app/workspaces';
import type { Workspace } from '../../app/workspaces';
import '../../features/requester/RequesterPage.css';
import '../../styles/InternalWorkspace.css';
import './AppShell.css';

const { Sider, Header, Content } = Layout;
const icons: Record<string, ReactNode> = {
  '/requester': <HomeOutlined />, '/requester/tickets': <FileTextOutlined />, '/requester/tickets/new': <PlusOutlined />,
  '/technician': <HomeOutlined />, '/technician/tickets': <UnorderedListOutlined />,
  '/supervisor': <HomeOutlined />, '/supervisor/queue': <UnorderedListOutlined />,
  '/supervisor/assignments': <TeamOutlined />, '/supervisor/dashboard': <BarChartOutlined />,
  '/admin': <SettingOutlined />,
};

export default function AppShell({ workspace }: { workspace: Workspace }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const available = (Object.keys(workspaces) as Workspace[]).filter((key) =>
    user?.roles.includes(workspaces[key].role),
  );
  const currentMenu = menu.filter((item) => item.workspace === workspace);
  const selected = [...currentMenu].reverse().find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));

  const signOut = async () => {
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Không thể đăng xuất.');
    }
  };

  const sidebar = <div className="smartdesk-sidebar">
    <Link className="smartdesk-brand" to={workspaces[workspace].path} onClick={() => setMobileOpen(false)}>
      <span className="smartdesk-logo">S</span><span><strong>SmartDesk</strong><small>INTELLIGENT IT SUPPORT</small></span>
    </Link>
    <div className="smartdesk-sidebar-label">{workspaces[workspace].label.toUpperCase()}</div>
    <Menu mode="inline" selectedKeys={[selected?.path ?? workspaces[workspace].path]}
      items={currentMenu.map((item) => ({ key: item.path, icon: icons[item.path], label: <Link to={item.path} onClick={() => setMobileOpen(false)}>{item.label}</Link> }))} />
    {available.length > 1 && <>
      <div className="smartdesk-sidebar-label">WORKSPACE KHÁC</div>
      <Menu mode="inline" selectedKeys={[]}
        items={available.filter((key) => key !== workspace).map((key) => ({
          key, icon: <SwapOutlined />, label: <Link to={workspaces[key].path} onClick={() => setMobileOpen(false)}>{workspaces[key].label}</Link>,
        }))} />
    </>}
    <div className="smartdesk-sidebar-spacer" />
    <div className="smartdesk-sidebar-bottom">{user?.email}</div>
  </div>;

  return <Layout className="smartdesk-shell">
    {contextHolder}
    <Sider width={236} className="smartdesk-sider">{sidebar}</Sider>
    <Drawer title="SmartDesk" placement="left" open={mobileOpen} onClose={() => setMobileOpen(false)} className="smartdesk-drawer" size={280}>{sidebar}</Drawer>
    <Layout className="smartdesk-main">
      <Header className="smartdesk-header">
        <div className="smartdesk-header-left">
          <Button className="smartdesk-menu-toggle" type="text" icon={<MenuOutlined />} aria-label="Mở menu" onClick={() => setMobileOpen(true)} />
          <span className="smartdesk-breadcrumb">SmartDesk / {workspaces[workspace].label} / <strong>{selected?.label ?? 'Chi tiết Ticket'}</strong></span>
        </div>
        <div className="smartdesk-header-actions">
          <Tooltip title="Thông báo đang phát triển"><Button type="text" icon={<BellOutlined />} aria-label="Thông báo đang phát triển" disabled /></Tooltip>
          <Dropdown menu={{ items: [{ key: 'account', label: user?.email, disabled: true }, { type: 'divider' }, { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', onClick: signOut }] }}>
            <Button type="text" className="smartdesk-account"><Avatar size="small">{user?.fullName.slice(0, 1).toUpperCase()}</Avatar><span>{user?.fullName}</span></Button>
          </Dropdown>
        </div>
      </Header>
      <Content className="smartdesk-content"><Outlet /></Content>
    </Layout>
  </Layout>;
}
