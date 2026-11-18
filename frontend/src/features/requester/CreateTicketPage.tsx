import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Input, Row, Select, Space, Tag, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { createTicket, getCategories } from '../../shared/api/tickets';
import type { Category, ImpactLevel, UrgencyLevel } from '../../shared/api/types';
import { computePreviewPriority, PRIORITY_METADATA } from './ticketMetadata';

interface FormValues {
  title: string;
  categoryId: string;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  description: string;
}

const impactOptions = [
  { value: 'LOW', label: 'Một người bị ảnh hưởng' },
  { value: 'MEDIUM', label: 'Một nhóm hoặc phòng ban' },
  { value: 'HIGH', label: 'Nhiều phòng ban hoặc toàn công ty' },
];
const urgencyOptions = [
  { value: 'LOW', label: 'Có thể chờ' },
  { value: 'MEDIUM', label: 'Cần hỗ trợ sớm' },
  { value: 'HIGH', label: 'Cần hỗ trợ ngay' },
];

export default function CreateTicketPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const impact: ImpactLevel = Form.useWatch('impact', form) ?? 'MEDIUM';
  const urgency: UrgencyLevel = Form.useWatch('urgency', form) ?? 'MEDIUM';
  const priority = computePreviewPriority(impact, urgency);

  useEffect(() => {
    let active = true;
    getCategories().then((result) => {
      if (!active) return;
      setCategories(result);
      if (result[0]) form.setFieldValue('categoryId', result[0].id);
    }).catch((cause: unknown) => {
      if (active) setCategoryError(cause instanceof Error ? cause.message : 'Không tải được danh mục.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [form]);

  const submit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const ticket = await createTicket(values);
      messageApi.success(`Đã tạo yêu cầu ${ticket.code}`);
      navigate(`/requester/tickets?selected=${encodeURIComponent(ticket.code)}`);
    } catch (cause) {
      messageApi.error(cause instanceof Error ? cause.message : 'Không thể gửi yêu cầu. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="requester-page">
    {contextHolder}
    <div className="requester-heading">
      <div><Typography.Title level={2}>Tạo yêu cầu hỗ trợ</Typography.Title><Typography.Text type="secondary">Mô tả sự cố để bộ phận IT có thể hỗ trợ bạn.</Typography.Text></div>
      <Button onClick={() => navigate('/requester/tickets')}>Yêu cầu của tôi</Button>
    </div>
    <Row gutter={[20, 20]}>
      <Col xs={24} lg={16}>
        <Card className="requester-card">
          {categoryError && <Alert showIcon type="error" message="Không tải được danh mục sự cố" description={categoryError} style={{ marginBottom: 20 }} />}
          {!loading && !categoryError && categories.length === 0 && <Alert showIcon type="warning" message="Chưa có danh mục sự cố" description="Vui lòng liên hệ quản trị viên trước khi tạo yêu cầu." style={{ marginBottom: 20 }} />}
          <Form<FormValues> form={form} layout="vertical" requiredMark={false} initialValues={{ impact: 'MEDIUM', urgency: 'MEDIUM' }} onFinish={submit}>
            <Form.Item name="title" label="Tiêu đề sự cố" rules={[{ required: true, message: 'Vui lòng nhập tiêu đề.' }, { min: 10, message: 'Tiêu đề cần ít nhất 10 ký tự.' }]}>
              <Input size="large" maxLength={150} placeholder="Ví dụ: Máy in phòng kế toán không kết nối mạng" />
            </Form.Item>
            <Form.Item name="categoryId" label="Danh mục" rules={[{ required: true, message: 'Vui lòng chọn danh mục.' }]}>
              <Select size="large" loading={loading} disabled={loading || categories.length === 0} placeholder="Chọn danh mục" options={categories.map((item) => ({ value: item.id, label: item.name }))} />
            </Form.Item>
            <Row gutter={16}>
              <Col xs={24} md={12}><Form.Item name="impact" label="Mức độ ảnh hưởng" rules={[{ required: true }]}><Select size="large" options={impactOptions} /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="urgency" label="Mức độ khẩn cấp" rules={[{ required: true }]}><Select size="large" options={urgencyOptions} /></Form.Item></Col>
            </Row>
            <Form.Item name="description" label="Mô tả chi tiết" rules={[{ required: true, message: 'Vui lòng mô tả sự cố.' }, { min: 15, message: 'Mô tả cần ít nhất 15 ký tự.' }]}>
              <Input.TextArea rows={5} maxLength={1500} placeholder="Triệu chứng, thời điểm bắt đầu và thiết bị hoặc vị trí bị ảnh hưởng..." />
            </Form.Item>
            <Space wrap><Button type="primary" htmlType="submit" loading={submitting} disabled={loading || categories.length === 0}>Gửi yêu cầu</Button><Button onClick={() => form.resetFields()}>Xóa nội dung</Button></Space>
          </Form>
        </Card>
      </Col>
      <Col xs={24} lg={8}><Card className="requester-card" title="Mức ưu tiên dự kiến">
        <Tag color={PRIORITY_METADATA[priority].color} className="requester-priority">{PRIORITY_METADATA[priority].label}</Tag>
        <Typography.Paragraph type="secondary">Mức ưu tiên được tính từ phạm vi ảnh hưởng và mức độ khẩn cấp bạn chọn. Hệ thống sẽ xác định mức chính thức khi tạo yêu cầu.</Typography.Paragraph>
      </Card></Col>
    </Row>
  </div>;
}
