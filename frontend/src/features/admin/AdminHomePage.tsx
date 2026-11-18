import { SafetyCertificateOutlined } from '@ant-design/icons';
import { Card, Typography } from 'antd';

export default function AdminHomePage() {
  return <div style={{ maxWidth: 900 }}>
    <Typography.Text style={{ color: '#2563eb', fontWeight: 700, letterSpacing: '.1em' }}>QUẢN TRỊ HỆ THỐNG</Typography.Text>
    <Typography.Title level={2} style={{ marginTop: 8 }}>Quản trị SmartDesk</Typography.Title>
    <Typography.Paragraph type="secondary">Khu vực dành cho tài khoản có vai trò Administrator.</Typography.Paragraph>
    <Card style={{ marginTop: 24, borderRadius: 16, borderColor: '#e4ebf5' }}>
      <SafetyCertificateOutlined style={{ fontSize: 32, color: '#2563eb', marginBottom: 12 }} />
      <Typography.Title level={4}>Quản lý tài khoản và phân quyền</Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>Chức năng quản trị đang phát triển. Vui lòng liên hệ nhóm phụ trách để cấp tài khoản hoặc điều chỉnh vai trò. Tài khoản Administrator không tự động có quyền xem Ticket.</Typography.Paragraph>
    </Card>
  </div>;
}
