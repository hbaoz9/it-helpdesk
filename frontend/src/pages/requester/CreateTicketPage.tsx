import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";

import {
  MOCK_CATEGORIES,
  PRIORITY_METADATA,
  computePreviewPriority,
} from "./requesterMockData";
import type { ImpactLevel, UrgencyLevel } from "./requesterMockData";

interface CreateIncidentFormValues {
  title: string;
  categoryId: string;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  description: string;
}

function CreateTicketPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<CreateIncidentFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [lastValidatedDto, setLastValidatedDto] =
    useState<CreateIncidentFormValues | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const watchedImpact = Form.useWatch("impact", form) ?? "MEDIUM";
  const watchedUrgency = Form.useWatch("urgency", form) ?? "MEDIUM";

  const previewPriority = computePreviewPriority(watchedImpact, watchedUrgency);
  const priorityMeta = PRIORITY_METADATA[previewPriority];

  const handleSubmit = (values: CreateIncidentFormValues) => {
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      setLastValidatedDto(values);
      messageApi.info(
        "Biểu mẫu hợp lệ! Trong Tuần 3 (FE-01), dữ liệu mới được kiểm tra ở tầng giao diện, chưa lưu vào PostgreSQL qua POST /api/v1/tickets."
      );
    }, 350);
  };

  const handleReset = () => {
    form.resetFields();
    setLastValidatedDto(null);
  };

  return (
    <Row gutter={[20, 20]}>
      {contextHolder}

      <Col xs={24} lg={15}>
        <Card
          title="Biểu mẫu báo cáo sự cố CNTT (CreateIncidentRequest)"
          extra={
            <Button onClick={() => navigate("/requester/tickets")}>
              Danh sách Ticket của tôi
            </Button>
          }
        >
          <Form<CreateIncidentFormValues>
            form={form}
            layout="vertical"
            initialValues={{
              impact: "MEDIUM",
              urgency: "MEDIUM",
            }}
            onFinish={handleSubmit}
          >
            <Form.Item
              label="Tiêu đề sự cố (title)"
              name="title"
              rules={[
                {
                  required: true,
                  message: "Vui lòng nhập tiêu đề tóm tắt sự cố!",
                },
                {
                  min: 10,
                  message: "Tiêu đề cần tối thiểu 10 ký tự để mô tả rõ sự cố!",
                },
              ]}
            >
              <Input
                size="large"
                placeholder="Ví dụ: Máy in phòng kế toán không kết nối mạng"
                maxLength={150}
                showCount
              />
            </Form.Item>

            <Form.Item
              label="Danh mục sự cố (categoryId)"
              name="categoryId"
              rules={[
                {
                  required: true,
                  message: "Vui lòng chọn danh mục sự cố!",
                },
              ]}
            >
              <Select
                size="large"
                placeholder="Chọn danh mục sự cố CNTT phù hợp"
                options={MOCK_CATEGORIES.map((category) => ({
                  value: category.id,
                  label: category.name,
                }))}
              />
            </Form.Item>

            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Mức độ ảnh hưởng (impact)"
                  name="impact"
                  tooltip="Đánh giá phạm vi người dùng hoặc phòng ban bị gián đoạn công việc"
                  rules={[
                    {
                      required: true,
                      message: "Vui lòng chọn mức độ ảnh hưởng!",
                    },
                  ]}
                >
                  <Radio.Group buttonStyle="solid" style={{ width: "100%" }}>
                    <Radio.Button value="LOW">LOW (Cá nhân)</Radio.Button>
                    <Radio.Button value="MEDIUM">
                      MEDIUM (Nhóm/Phòng)
                    </Radio.Button>
                    <Radio.Button value="HIGH">HIGH (Nhiều phòng)</Radio.Button>
                  </Radio.Group>
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label="Mức độ khẩn cấp (urgency)"
                  name="urgency"
                  tooltip="Mức độ cấp thiết cần khắc phục để không đình trệ nghiệp vụ"
                  rules={[
                    {
                      required: true,
                      message: "Vui lòng chọn mức độ khẩn cấp!",
                    },
                  ]}
                >
                  <Radio.Group buttonStyle="solid" style={{ width: "100%" }}>
                    <Radio.Button value="LOW">LOW (Thấp)</Radio.Button>
                    <Radio.Button value="MEDIUM">
                      MEDIUM (Trung bình)
                    </Radio.Button>
                    <Radio.Button value="HIGH">HIGH (Khẩn cấp)</Radio.Button>
                  </Radio.Group>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="Mô tả chi tiết sự cố (description)"
              name="description"
              rules={[
                {
                  required: true,
                  message: "Vui lòng nhập mô tả chi tiết sự cố!",
                },
                {
                  min: 15,
                  message:
                    "Vui lòng mô tả ít nhất 15 ký tự (triệu chứng lỗi, thời điểm phát sinh, vị trí)!",
                },
              ]}
            >
              <Input.TextArea
                rows={5}
                placeholder="Mô tả rõ triệu chứng lỗi, mã thông báo lỗi (nếu có), thời điểm bắt đầu xảy ra và vị trí thiết bị..."
                maxLength={1500}
                showCount
              />
            </Form.Item>

            <Space wrap>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={submitting}
              >
                Kiểm tra &amp; Gửi yêu cầu (Minh họa Tuần 3)
              </Button>
              <Button size="large" onClick={handleReset}>
                Làm mới biểu mẫu
              </Button>
            </Space>
          </Form>

          {lastValidatedDto && (
            <Alert
              style={{ marginTop: 20 }}
              type="success"
              showIcon
              message="Dữ liệu biểu mẫu hợp lệ theo CreateIncidentRequest DTO"
              description={
                <div>
                  <Typography.Paragraph style={{ marginBottom: 8 }}>
                    Payload dự kiến gửi tới <code>POST /api/v1/tickets</code>{" "}
                    khi tích hợp Backend ở Tuần 4 (chưa lưu Database trong Tuần
                    3):
                  </Typography.Paragraph>
                  <pre
                    style={{
                      margin: 0,
                      padding: 12,
                      borderRadius: 8,
                      background: "#0f172a",
                      color: "#e2e8f0",
                      fontSize: 12,
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(
                      {
                        type: "INCIDENT",
                        ...lastValidatedDto,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              }
            />
          )}
        </Card>
      </Col>

      <Col xs={24} lg={9}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Card title="Dự kiến phân loại tự động (Priority Matrix 3×3)">
            <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
              Theo API Contract (Mục 3.5), Requester chỉ cung cấp{" "}
              <code>impact</code> và <code>urgency</code>. Hệ thống Backend sẽ
              tự xác định <code>requesterId</code> từ Session và tính{" "}
              <strong>Priority</strong> theo ma trận:
            </Typography.Paragraph>

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Impact × Urgency">
                <Tag>{watchedImpact}</Tag> × <Tag>{watchedUrgency}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Mức Priority dự kiến">
                <Tag color={priorityMeta.color}>{priorityMeta.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Hạn phản hồi đầu tiên (SLA)">
                <strong>{priorityMeta.responseSla}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Hạn giải quyết sự cố (SLA)">
                <strong>{priorityMeta.resolutionSla}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái khởi tạo">
                <Tag color="blue">NEW</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="Quy ước dữ liệu CreateIncidentRequest">
            <Space direction="vertical" size={6} style={{ fontSize: 13 }}>
              <Typography.Text>
                • <code>type</code>: Cố định là <code>"INCIDENT"</code> trong
                phạm vi P0.
              </Typography.Text>
              <Typography.Text>
                • <code>requesterId</code>: Không gửi từ Frontend (Backend lấy
                trực tiếp từ HttpOnly Session Cookie).
              </Typography.Text>
              <Typography.Text>
                • <code>priority</code>: Không gửi tùy ý từ Frontend; Supervisor
                có thể điều chỉnh kèm lý do sau khi Triage.
              </Typography.Text>
            </Space>
          </Card>
        </Space>
      </Col>
    </Row>
  );
}

export default CreateTicketPage;
