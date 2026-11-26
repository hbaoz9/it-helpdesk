import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Input, Row, Select, Space, Typography, message } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { createTicket, getCategories } from '../../shared/api/tickets';
import type { Category, ImpactLevel, UrgencyLevel } from '../../shared/api/types';
import { useAuth } from '../../shared/auth/useAuth';
import { searchAssetsForTicket } from '../../shared/api/assets';
import type { AssetTicketSearchRecord } from '../../shared/api/types';

interface FormValues {
  title: string;
  categoryId: string;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  description: string;
  assetId?: string;
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
  const { user } = useAuth();
  const location = useLocation();
  const [draft] = useState(() => {
    const state: unknown = location.state;
    return state && typeof state === 'object' && 'aiDraft' in state && state.aiDraft && typeof state.aiDraft === 'object' &&
    'title' in state.aiDraft && typeof state.aiDraft.title === 'string' && 'description' in state.aiDraft && typeof state.aiDraft.description === 'string'
      ? { title: state.aiDraft.title.slice(0, 150), description: state.aiDraft.description.slice(0, 1500) } : null;
  });
  const [form] = Form.useForm<FormValues>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [assets, setAssets] = useState<AssetTicketSearchRecord[]>([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    let active = true;
    getCategories().then((result) => {
      if (!active) return;
      setCategories(result);
    }).catch((cause: unknown) => {
      if (active) setCategoryError(cause instanceof Error ? cause.message : 'Không tải được danh mục.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setAssetLoading(true);
    searchAssetsForTicket()
      .then((result) => { if (active) setAssets(result); })
      .catch((cause: unknown) => {
        if (active) setAssetError(cause instanceof Error ? cause.message : 'Không tải được danh sách tài sản.');
      })
      .finally(() => { if (active) setAssetLoading(false); });
    return () => { active = false; };
  }, []);

  const submit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const ticket = await createTicket({
        ...values,
        title: values.title.trim(),
        description: values.description.trim(),
      });
      messageApi.success(`Đã tạo yêu cầu ${ticket.code}`);
      navigate(`/requester/tickets/${encodeURIComponent(ticket.id)}`);
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
          {categoryError && <Alert showIcon type="error" title="Không tải được danh mục sự cố" description={categoryError} style={{ marginBottom: 20 }} />}
          {!loading && !categoryError && categories.length === 0 && <Alert showIcon type="warning" title="Chưa có danh mục sự cố" description="Vui lòng liên hệ quản trị viên trước khi tạo yêu cầu." style={{ marginBottom: 20 }} />}
          {draft && <Alert showIcon type="info" title="Bản nháp từ gợi ý AI" description="Hãy kiểm tra, chỉnh sửa nội dung và tự chọn danh mục, mức ảnh hưởng, mức khẩn cấp trước khi gửi." style={{ marginBottom: 20 }} />}
          <Form<FormValues> form={form} layout="vertical" requiredMark={false} initialValues={draft ?? {}} onFinish={submit}>
            <Form.Item name="title" label="Tiêu đề sự cố" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tiêu đề.' }, { max: 150, message: 'Tiêu đề tối đa 150 ký tự.' }]}>
              <Input size="large" maxLength={150} placeholder="Ví dụ: Máy in phòng kế toán không kết nối mạng" />
            </Form.Item>
            <Form.Item name="categoryId" label="Danh mục" rules={[{ required: true, message: 'Vui lòng chọn danh mục.' }]}>
              <Select size="large" loading={loading} disabled={loading || categories.length === 0} placeholder="Chọn danh mục" options={categories.map((item) => ({ value: item.id, label: item.name }))} />
            </Form.Item>
            <Form.Item name="assetId" label="Tài sản liên quan (không bắt buộc)">
              <Select
                size="large"
                allowClear
                showSearch
                loading={assetLoading}
                onSearch={(value) => {
                  setAssetLoading(true);
                  setAssetError(null);
                  searchAssetsForTicket(value)
                    .then(setAssets)
                    .catch((cause: unknown) => setAssetError(cause instanceof Error ? cause.message : 'Không tải được danh sách tài sản.'))
                    .finally(() => setAssetLoading(false));
                }}
                filterOption={false}
                placeholder="Tìm tài sản toàn công ty"
                options={assets.map((item) => ({
                  value: item.id,
                  label: `${item.code} — ${item.name} | ${item.category.name} | ${item.location || 'Chưa có vị trí'} | ${item.status}`,
                }))}
              />
            </Form.Item>
            {assetError && <Alert showIcon type="error" title="Không tải được danh sách tài sản" description={assetError} style={{ marginBottom: 16 }} />}
            <Row gutter={16}>
              <Col xs={24} md={12}><Form.Item name="impact" label="Mức độ ảnh hưởng" rules={[{ required: true, message: 'Vui lòng chọn mức ảnh hưởng.' }]}><Select size="large" placeholder="Chọn mức ảnh hưởng" options={impactOptions} /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="urgency" label="Mức độ khẩn cấp" rules={[{ required: true, message: 'Vui lòng chọn mức khẩn cấp.' }]}><Select size="large" placeholder="Chọn mức khẩn cấp" options={urgencyOptions} /></Form.Item></Col>
            </Row>
            <Form.Item name="description" label="Mô tả chi tiết" rules={[{ required: true, whitespace: true, message: 'Vui lòng mô tả sự cố.' }, { max: 1500, message: 'Mô tả tối đa 1500 ký tự.' }]}>
              <Input.TextArea rows={5} maxLength={1500} placeholder="Triệu chứng, thời điểm bắt đầu và thiết bị hoặc vị trí bị ảnh hưởng..." />
            </Form.Item>
            <Space wrap><Button type="primary" htmlType="submit" loading={submitting} disabled={loading || categories.length === 0}>Gửi yêu cầu</Button><Button onClick={() => form.resetFields()}>Xóa nội dung</Button></Space>
          </Form>
        </Card>
      </Col>
      <Col xs={24} lg={8}><Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card className="requester-card" title="Thông tin tiếp nhận">
          <Typography.Paragraph><strong>Người gửi:</strong> {user?.fullName ?? 'Tài khoản của bạn'}</Typography.Paragraph>
          <Typography.Paragraph><strong>Trạng thái ban đầu:</strong> Mới tạo, chờ bộ phận IT tiếp nhận.</Typography.Paragraph>
          <Alert type="info" showIcon title="Mức ưu tiên được Backend xác định từ mức ảnh hưởng và mức khẩn cấp khi bạn gửi yêu cầu." />
        </Card>
        <Card className="requester-card" title="Cần hỗ trợ trước khi gửi?">
          <Typography.Paragraph type="secondary">SmartDesk AI có thể gợi ý các bước tự kiểm tra và nội dung yêu cầu.</Typography.Paragraph>
          <Button onClick={() => navigate('/requester/ai')}>Mở trợ lý AI</Button>
        </Card>
      </Space></Col>
    </Row>
  </div>;
}
