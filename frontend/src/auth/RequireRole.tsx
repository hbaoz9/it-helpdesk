import { Alert, Spin } from 'antd';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { RoleCode } from '../api/types';
import { useAuth } from './useAuth';

export default function RequireRole({
  roles,
  children,
}: {
  roles: RoleCode[];
  children: ReactNode;
}) {
  const { user, loading, loadError } = useAuth();

  if (loading) return <Spin fullscreen />;
  if (loadError) {
    return <Alert type="error" showIcon message="Không thể kết nối Backend" description={loadError} />;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!user.roles.some((role) => roles.includes(role))) {
    const home = user.roles.includes('SUPERVISOR') || user.roles.includes('ADMIN')
      ? '/supervisor'
      : user.roles.includes('TECHNICIAN')
        ? '/technician'
        : user.roles.includes('REQUESTER')
          ? '/requester'
          : '/login';
    return <Navigate to={home} replace />;
  }
  return children;
}
