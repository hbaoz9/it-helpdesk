import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { createTicket, getCategories } from '../../shared/api/tickets';
import type {
  Category,
  ImpactLevel,
  UrgencyLevel,
} from '../../shared/api/types';
import { useAuth } from '../../shared/auth/useAuth';
import {
  IMPACT_METADATA,
  PRIORITY_METADATA,
  STATUS_METADATA,
  URGENCY_METADATA,
  computePreviewPriority,
} from './ticketMetadata';

interface FormValues {
  title: string;
  categoryId: string;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  description: string;
}

const impactOptions = (
  Object.entries(IMPACT_METADATA) as [
    ImpactLevel,
    (typeof IMPACT_METADATA)[ImpactLevel],
  ][]
).map(([value, meta]) => ({
  value,
  label: `${meta.label} – ${meta.description}`,
}));

const urgencyOptions = (
  Object.entries(URGENCY_METADATA) as [
    UrgencyLevel,
    (typeof URGENCY_METADATA)[UrgencyLevel],
  ][]
).map(([value, meta]) => ({
  value,
  label: `${meta.label} – ${meta.description}`,
}));

export default function CreateTicketPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const [draft] = useState(() => {
    const state: unknown = location.state;
    return state &&
      typeof state === 'object' &&
      'aiDraft' in state &&
      state.aiDraft &&
      typeof state.aiDraft === 'object' &&
      'title' in state.aiDraft &&
      typeof state.aiDraft.title === 'string' &&
      'description' in state.aiDraft &&
      typeof state.aiDraft.description === 'string'
      ? {
          title: state.aiDraft.title.slice(0, 150),
          description: state.aiDraft.description.slice(0, 1500),
        }
      : null;
  });
  const [form] = Form.useForm<FormValues>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const watchedCategoryId = Form.useWatch('categoryId', form);
  const watchedImpact = Form.useWatch('impact', form);
  const watchedUrgency = Form.useWatch('urgency', form);

  const selectedCategoryName = useMemo(
    () =>
      categories.find((item) => item.id === watchedCategoryId)?.name ??
      'Chưa chọn',
    [categories, watchedCategoryId],
  );

  const previewPriority = computePreviewPriority(watchedImpact, watchedUrgency);
  const priorityMeta = previewPriority
    ? PRIORITY_METADATA[previewPriority]
    : null;

  useEffect(() => {
    let active = true;
    getCategories()
      .then((result) => {
        if (!active) return;
        setCategories(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setCategoryError(
            cause instanceof Error
              ? cause.message
              : 'Không tải được danh mục.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
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
      messageApi.error(
        cause instanceof Error
          ? cause.message
          : 'Không thể gửi yêu cầu. Vui lòng thử lại.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearForm = () => {
    form.setFieldsValue({
      title: '',
      categoryId: undefined,
      impact: undefined,
      urgency: undefined,
      description: '',
    });
  };

  const handleRestoreDraft = () => {
    if (!draft) return;
    form.setFieldsValue({
      title: draft.title,
      description: draft.description,
    });
    messageApi.info('Đã khôi phục tiêu đề và mô tả từ gợi ý của AI.');
  };

  return (
    <div className="requester-page">
      {contextHolder}
      <div className="requester-heading">
        <div>
          <Typography.Text className="requester-eyebrow-text">
            REQUESTER / TẠO YÊU CẦU
          </Typography.Text>
          <Typography.Title level={2}>Tạo yêu cầu hỗ trợ</Typography.Title>
          <Typography.Text type="secondary">
            Mô tả sự cố bạn đang gặp phải để bộ phận IT tiếp nhận, phân loại và
            phân công kỹ thuật viên hỗ trợ.
          </Typography.Text>
        </div>
        <Space wrap>
          <Button
            icon={<RobotOutlined />}
            onClick={() => navigate('/requester/ai')}
          >
            Nhờ AI hỗ trợ
          </Button>
          <Button onClick={() => navigate('/requester/tickets')}>
            Yêu cầu của tôi
          </Button>
        </Space>
      </div>

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={16}>
          <Card className="requester-card" title="Thông tin sự cố">
            {categoryError && (
              <Alert
                showIcon
                type="error"
                title="Không tải được danh mục sự cố"
                description={categoryError}
                style={{ marginBottom: 20 }}
              />
            )}
            {!loading && !categoryError && categories.length === 0 && (
              <Alert
                showIcon
                type="warning"
                title="Chưa có danh mục sự cố"
                description="Vui lòng liên hệ quản trị viên trước khi tạo yêu cầu."
                style={{ marginBottom: 20 }}
              />
            )}
            {draft && (
              <Alert
                showIcon
                type="info"
                title="Bản nháp được chuẩn bị từ gợi ý của Trợ lý AI"
                description="Hãy kiểm tra, chỉnh sửa nội dung cho phù hợp với thực tế và chọn danh mục, mức độ ảnh hưởng, mức độ khẩn cấp trước khi gửi."
                action={
                  <Button size="small" onClick={handleRestoreDraft}>
                    Khôi phục gợi ý AI
                  </Button>
                }
                style={{ marginBottom: 20 }}
              />
            )}

            <Form<FormValues>
              form={form}
              layout="vertical"
              requiredMark={false}
              initialValues={draft ?? {}}
              onFinish={submit}
            >
              <Form.Item
                name="title"
                label="Tiêu đề sự cố"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: 'Vui lòng nhập tiêu đề sự cố.',
                  },
                  {
                    max: 150,
                    message: 'Tiêu đề tối đa 150 ký tự.',
                  },
                ]}
              >
                <Input
                  size="large"
                  maxLength={150}
                  showCount
                  placeholder="Ví dụ: Máy in phòng kế toán không kết nối mạng"
                />
              </Form.Item>

              <Form.Item
                name="categoryId"
                label="Danh mục sự cố"
                rules={[
                  {
                    required: true,
                    message: 'Vui lòng chọn danh mục sự cố.',
                  },
                ]}
              >
                <Select
                  size="large"
                  loading={loading}
                  disabled={loading || categories.length === 0}
                  placeholder="Chọn danh mục sự cố"
                  options={categories.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="impact"
                    label="Mức độ ảnh hưởng"
                    rules={[
                      {
                        required: true,
                        message: 'Vui lòng chọn mức độ ảnh hưởng.',
                      },
                    ]}
                  >
                    <Select
                      size="large"
                      placeholder="Chọn phạm vi bị ảnh hưởng"
                      options={impactOptions}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="urgency"
                    label="Mức độ khẩn cấp"
                    rules={[
                      {
                        required: true,
                        message: 'Vui lòng chọn mức độ khẩn cấp.',
                      },
                    ]}
                  >
                    <Select
                      size="large"
                      placeholder="Chọn mức độ cấp thiết"
                      options={urgencyOptions}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="description"
                label="Mô tả chi tiết sự cố"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: 'Vui lòng mô tả chi tiết sự cố.',
                  },
                  {
                    max: 1500,
                    message: 'Mô tả tối đa 1500 ký tự.',
                  },
                ]}
              >
                <Input.TextArea
                  rows={6}
                  maxLength={1500}
                  showCount
                  placeholder="Triệu chứng gặp phải, thông báo lỗi hiển thị (nếu có), thời điểm bắt đầu xảy ra và thiết bị hoặc phòng ban bị ảnh hưởng..."
                />
              </Form.Item>

              <Space wrap>
                <Button
                  type="primary"
                  size="large"
                  htmlType="submit"
                  loading={submitting}
                  disabled={loading || categories.length === 0}
                >
                  Gửi yêu cầu hỗ trợ
                </Button>
                <Button size="large" onClick={handleClearForm}>
                  Xóa nội dung
                </Button>
              </Space>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card className="requester-card" title="Xem lại thông tin tiếp nhận">
              <div className="requester-summary-list">
                <div className="requester-summary-item">
                  <Typography.Text type="secondary">Người gửi</Typography.Text>
                  <Typography.Text strong>
                    {user?.fullName ?? 'Tài khoản của bạn'}
                  </Typography.Text>
                </div>

                <div className="requester-summary-item">
                  <Typography.Text type="secondary">Danh mục</Typography.Text>
                  <Typography.Text strong>
                    {selectedCategoryName}
                  </Typography.Text>
                </div>

                <div className="requester-summary-item">
                  <Typography.Text type="secondary">
                    Trạng thái ban đầu
                  </Typography.Text>
                  <Tag color={STATUS_METADATA.NEW.color}>
                    {STATUS_METADATA.NEW.label}
                  </Tag>
                </div>

                <div className="requester-summary-item">
                  <Typography.Text type="secondary">
                    Mức ưu tiên dự kiến
                  </Typography.Text>
                  {priorityMeta ? (
                    <Tag color={priorityMeta.color}>{priorityMeta.label}</Tag>
                  ) : (
                    <Typography.Text type="secondary">
                      Chọn mức ảnh hưởng &amp; khẩn cấp
                    </Typography.Text>
                  )}
                </div>

                {priorityMeta && (
                  <>
                    <div className="requester-summary-item">
                      <Typography.Text type="secondary">
                        Thời hạn phản hồi đầu tiên
                      </Typography.Text>
                      <Typography.Text strong>
                        {priorityMeta.responseSla}
                      </Typography.Text>
                    </div>
                    <div className="requester-summary-item">
                      <Typography.Text type="secondary">
                        Thời hạn giải quyết dự kiến
                      </Typography.Text>
                      <Typography.Text strong>
                        {priorityMeta.resolutionSla}
                      </Typography.Text>
                    </div>
                  </>
                )}
              </div>

              <Alert
                style={{ marginTop: 16 }}
                type="info"
                showIcon
                title="Mức ưu tiên chính thức được hệ thống tự động xác định khi bạn gửi yêu cầu dựa trên mức độ ảnh hưởng và tính khẩn cấp."
              />
            </Card>

            <Card
              className="requester-card"
              title="Cần hướng dẫn kiểm tra trước khi gửi?"
            >
              <Typography.Paragraph type="secondary">
                Trợ lý AI của SmartDesk có thể gợi ý các bước tự kiểm tra ban
                đầu và tóm tắt sẵn tiêu đề, mô tả sự cố cho bạn.
              </Typography.Paragraph>
              <Button
                icon={<RobotOutlined />}
                onClick={() => navigate('/requester/ai')}
              >
                Mở trợ lý AI
              </Button>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
}
