import { useState } from 'react';
import { Avatar, Badge, Button, Drawer, Dropdown, Layout, Menu, Typography, message } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { menu, workspaces } from '../../app/workspaces';
import type { Workspace } from '../../app/workspaces';
import '../../features/requester/RequesterWorkspace.css';
import '../../styles/InternalWorkspace.css';
import './AppShell.css';

const { Sider, Header, Content } = Layout;

export default function AppShell({ workspace }: { workspace: Workspace }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const available = (Object.keys(workspaces) as Workspace[]).filter((key) =>
    user?.roles.includes(workspaces[key].role) || (key === 'supervisor' && user?.roles.includes('ADMIN')),
  );
  const currentMenu = menu.filter((item) => item.workspace === workspace);
  const selected = [...currentMenu].reverse().find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));

  const signOut = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'KhÃ´ng thá»ƒ Ä‘Äƒng xuáº¥t.');
    }
  };

  const sidebar = <div className="smartdesk-sidebar">
    <Link className="smartdesk-brand" to={workspaces[workspace].path} onClick={() => setMobileOpen(false)}>
      <span className="smartdesk-logo">S</span><span><strong>SmartDesk</strong><small>IT Service Management</small></span>
    </Link>
    <div className="smartdesk-sidebar-label">WORKSPACE</div>
    <Menu mode="inline" selectedKeys={[selected?.path ?? workspaces[workspace].path]}
      items={currentMenu.map((item) => ({ key: item.path, label: <Link to={item.path} onClick={() => setMobileOpen(false)}>{item.label}</Link> }))} />
    {available.length > 1 && <>
      <div className="smartdesk-sidebar-label">CHUYá»‚N WORKSPACE</div>
      <Menu mode="inline" selectedKeys={[]}
        items={available.filter((key) => key !== workspace).map((key) => ({
          key, label: <Link to={workspaces[key].path} onClick={() => setMobileOpen(false)}>{workspaces[key].label}</Link>,
        }))} />
    </>}
    <div className="smartdesk-sidebar-spacer" />
    <div className="smartdesk-sidebar-bottom">{user?.email}</div>
  </div>;

  return <Layout className="smartdesk-shell">
    {contextHolder}
    <Sider width={248} className="smartdesk-sider">{sidebar}</Sider>
    <Drawer title="SmartDesk" placement="left" open={mobileOpen} onClose={() => setMobileOpen(false)} className="smartdesk-drawer" size={280}>{sidebar}</Drawer>
    <Layout className="smartdesk-main">
      <Header className="smartdesk-header">
        <div className="smartdesk-header-left">
          <Button className="smartdesk-menu-toggle" type="text" aria-label="Má»Ÿ menu" onClick={() => setMobileOpen(true)}>â˜°</Button>
          <div><span className="smartdesk-eyebrow">{workspaces[workspace].label} Workspace</span><Typography.Title level={4}>{selected?.label ?? 'Chi tiáº¿t Ticket'}</Typography.Title></div>
        </div>
        <div className="smartdesk-header-actions">
          <Button type="text" aria-label="ThÃ´ng bÃ¡o" onClick={() => messageApi.info('ThÃ´ng bÃ¡o Ä‘ang phÃ¡t triá»ƒn.')}><Badge dot={false}>ðŸ””</Badge></Button>
          <Dropdown menu={{ items: [{ key: 'account', label: user?.email, disabled: true }, { type: 'divider' }, { key: 'logout', label: 'ÄÄƒng xuáº¥t', onClick: signOut }] }}>
            <Button type="text" className="smartdesk-account"><Avatar size="small">{user?.fullName.slice(0, 1).toUpperCase()}</Avatar><span>{user?.fullName}</span></Button>
          </Dropdown>
        </div>
      </Header>
      <Content className="smartdesk-content"><Outlet /></Content>
    </Layout>
  </Layout>;
}
