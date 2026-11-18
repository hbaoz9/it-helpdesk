import type { ReactNode } from 'react';
import { ConfigProvider, theme } from 'antd';

export default function AppProviders({ children }: { children: ReactNode }) {
  return <ConfigProvider theme={{
    algorithm: theme.defaultAlgorithm,
    token: {
      colorPrimary: '#2563eb', colorInfo: '#2563eb', colorSuccess: '#16a34a',
      colorWarning: '#d97706', colorError: '#dc2626', colorText: '#172b4d',
      colorBgLayout: '#f5f7fb', colorBorderSecondary: '#e5eaf2',
      borderRadius: 10, fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
    },
  }}>{children}</ConfigProvider>;
}
