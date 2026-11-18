import { Alert, Button, Result, Spin } from 'antd';
import type { ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { RoleCode } from '../api/types';
import { homePath } from '../../app/workspaces';
import { useAuth } from './useAuth';

export default function RequireRole({
  roles,
  children,
}: {
  roles: RoleCode[];
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { user, loading, loadError } = useAuth();

  if (loading) return <Spin fullscreen />;
  if (loadError) {
    return <Alert type="error" showIcon message="Không thể kết nối Backend" description={loadError} />;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!user.roles.some((role) => roles.includes(role))) {
    return <Result status="403" title="Không có quyền truy cập" subTitle="Tài khoản của bạn chưa được cấp quyền vào khu vực này." extra={<Button type="primary" onClick={() => navigate(homePath(user.roles))}>Về workspace của tôi</Button>} />;
  }
  return children;
}
