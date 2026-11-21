import { Button, Result, Space, Spin } from 'antd';
import type { ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
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
  const location = useLocation();
  const { user, loading, loadError, refreshSession } = useAuth();

  if (loading) return <Spin fullscreen />;
  if (loadError) {
    return (
      <Result
        status="error"
        title="Không thể kết nối Backend"
        subTitle={loadError}
        extra={
          <Space>
            <Button type="primary" onClick={() => void refreshSession()}>
              Thử lại kết nối
            </Button>
            <Button onClick={() => navigate('/login')}>
              Về trang đăng nhập
            </Button>
          </Space>
        }
      />
    );
  }
  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: `${location.pathname}${location.search}` }}
        replace
      />
    );
  }
  if (!user.roles.some((role) => roles.includes(role))) {
    return (
      <Result
        status="403"
        title="Không có quyền truy cập"
        subTitle="Tài khoản của bạn chưa được cấp quyền vào khu vực này."
        extra={
          <Button
            type="primary"
            onClick={() => navigate(homePath(user.roles))}
          >
            Về workspace của tôi
          </Button>
        }
      />
    );
  }
  return children;
}
