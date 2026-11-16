import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Col,
  Form,
  Input,
  Row,
  Select,
  Tag,
  message,
} from "antd";
import { ApiError } from "../../api/client";
import { createTicket, getCategories } from "../../api/tickets";
import type {
  Category,
  ImpactLevel,
  TicketPriority,
  UrgencyLevel,
} from "../../api/types";

import {
  PRIORITY_METADATA,
  computePreviewPriority,
} from "./ticketMetadata";

interface CreateIncidentFormValues {
  title: string;
  categoryId: string;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  description: string;
}

const IMPACT_OPTIONS: {
  value: ImpactLevel;
  code: string;
  desc: string;
}[] = [
  { value: "LOW", code: "LOW", desc: "(Individual)" },
  { value: "MEDIUM", code: "MEDIUM", desc: "(Team/Dept)" },
  { value: "HIGH", code: "HIGH", desc: "(Company-wide)" },
];

const URGENCY_OPTIONS: {
  value: UrgencyLevel;
  code: string;
  desc: string;
}[] = [
  { value: "LOW", code: "LOW", desc: "(Can wait)" },
  { value: "MEDIUM", code: "MEDIUM", desc: "(Soon / Standard)" },
  { value: "HIGH", code: "HIGH", desc: "(Critical)" },
];

const MATRIX_ROWS: {
  impact: ImpactLevel;
  cells: { urgency: UrgencyLevel; priority: TicketPriority; label: string }[];
}[] = [
  {
    impact: "LOW",
    cells: [
      { urgency: "LOW", priority: "P4", label: "P4 (Low)" },
      { urgency: "MEDIUM", priority: "P4", label: "P4 (Med)" },
      { urgency: "HIGH", priority: "P3", label: "P3 (High)" },
    ],
  },
  {
    impact: "MEDIUM",
    cells: [
      { urgency: "LOW", priority: "P4", label: "P4 (Low)" },
      { urgency: "MEDIUM", priority: "P3", label: "P3 (Med)" },
      { urgency: "HIGH", priority: "P2", label: "P2 (High)" },
    ],
  },
  {
    impact: "HIGH",
    cells: [
      { urgency: "LOW", priority: "P3", label: "P3 (High)" },
      { urgency: "MEDIUM", priority: "P2", label: "P2 (High)" },
      { urgency: "HIGH", priority: "P1", label: "P1 (Critical)" },
    ],
  },
];

function shortLevel(level: ImpactLevel | UrgencyLevel): string {
  if (level === "MEDIUM") return "MED";
  return level;
}

function DocumentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function CreateTicketPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<CreateIncidentFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const watchedTitle = Form.useWatch("title", form) ?? "";
  const watchedCategoryId = Form.useWatch("categoryId", form) ?? "";
  const watchedImpact: ImpactLevel = Form.useWatch("impact", form) ?? "MEDIUM";
  const watchedUrgency: UrgencyLevel =
    Form.useWatch("urgency", form) ?? "MEDIUM";
  const watchedDescription = Form.useWatch("description", form) ?? "";

  const previewPriority = computePreviewPriority(watchedImpact, watchedUrgency);
  const priorityMeta = PRIORITY_METADATA[previewPriority];

  useEffect(() => {
    let active = true;
    getCategories()
      .then((result) => {
        if (!active) return;
        setCategories(result);
        if (result.length > 0) {
          form.setFieldValue("categoryId", result[0].id);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setCategoryError(
            error instanceof Error ? error.message : "Không tải được danh mục",
          );
        }
      })
      .finally(() => {
        if (active) setLoadingCategories(false);
      });
    return () => {
      active = false;
    };
  }, [form]);

  const handleSubmit = async (values: CreateIncidentFormValues) => {
    setSubmitting(true);
    try {
      const ticket = await createTicket(values);
      messageApi.success(`Đã tạo Ticket ${ticket.code}`);
      navigate(`/requester/tickets?selected=${encodeURIComponent(ticket.code)}`);
    } catch (error) {
      messageApi.error(
        error instanceof ApiError
          ? error.message
          : "Không thể gửi yêu cầu. Vui lòng thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    form.resetFields();
    if (categories[0]) form.setFieldValue("categoryId", categories[0].id);
  };

  const livePayload = {
    type: "INCIDENT",
    title:
      watchedTitle.trim() ||
      "Máy in phòng kế toán không kết nối mạng nội bộ",
    categoryId: watchedCategoryId,
    impact: watchedImpact,
    urgency: watchedUrgency,
    description:
      watchedDescription.trim() ||
      "Triệu chứng lỗi, thời điểm phát sinh và thiết bị bị ảnh hưởng...",
  };

  return (
    <Row gutter={[20, 20]}>
      {contextHolder}

      {/* LEFT COLUMN: FORM CARD */}
      <Col xs={24} lg={15}>
        <div className="rp-card">
          <div className="rp-card-header">
            <div className="rp-card-header-left">
              <div className="rp-card-icon-box">
                <DocumentIcon />
              </div>
              <div>
                <h2 className="rp-card-title">
                  Biểu mẫu báo cáo sự cố CNTT{" "}
                  <span>(CreateIncidentRequest)</span>
                </h2>
                <p className="rp-card-subtitle">
                  Cung cấp thông tin chính xác để hệ thống tự động phân loại
                  (Triage) và điều phối kỹ thuật viên
                </p>
              </div>
            </div>

            <button
              type="button"
              className="rp-btn-secondary"
              onClick={() => navigate("/requester/tickets")}
            >
              <span>Danh sách Ticket</span>
            </button>
          </div>

          <Form<CreateIncidentFormValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            className="rp-dark-form"
            initialValues={{
              impact: "MEDIUM",
              urgency: "MEDIUM",
            }}
            onFinish={handleSubmit}
          >
            <Form.Item
              label={
                <span className="rp-field-label">
                  TIÊU ĐỀ SỰ CỐ <span className="rp-field-key">(TITLE)</span>{" "}
                  <span className="rp-field-req">*</span>
                </span>
              }
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
                placeholder="Ví dụ: Máy in phòng kế toán không kết nối mạng nội bộ"
                maxLength={150}
                showCount
              />
            </Form.Item>

            <Form.Item
              label={
                <span className="rp-field-label">
                  DANH MỤC SỰ CỐ{" "}
                  <span className="rp-field-key">(CATEGORYID)</span>{" "}
                  <span className="rp-field-req">*</span>
                </span>
              }
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
                loading={loadingCategories}
                disabled={loadingCategories || categories.length === 0}
                options={categories.map((category) => ({
                  value: category.id,
                  label: category.name,
                }))}
              />
            </Form.Item>

            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item
                  label={
                    <span className="rp-field-label">
                      MỨC ĐỘ ẢNH HƯỞNG{" "}
                      <span className="rp-field-key">(IMPACT)</span>{" "}
                      <span className="rp-field-req">*</span>
                    </span>
                  }
                  name="impact"
                  rules={[
                    {
                      required: true,
                      message: "Vui lòng chọn mức độ ảnh hưởng!",
                    },
                  ]}
                >
                  <div className="rp-level-grid">
                    {IMPACT_OPTIONS.map((item) => {
                      const isSelected = watchedImpact === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          className={`rp-level-card ${
                            isSelected ? "selected" : ""
                          }`}
                          onClick={() =>
                            form.setFieldValue("impact", item.value)
                          }
                        >
                          <span className="rp-level-code">{item.code}</span>
                          <span className="rp-level-desc">{item.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label={
                    <span className="rp-field-label">
                      MỨC ĐỘ KHẨN CẤP{" "}
                      <span className="rp-field-key">(URGENCY)</span>{" "}
                      <span className="rp-field-req">*</span>
                    </span>
                  }
                  name="urgency"
                  rules={[
                    {
                      required: true,
                      message: "Vui lòng chọn mức độ khẩn cấp!",
                    },
                  ]}
                >
                  <div className="rp-level-grid">
                    {URGENCY_OPTIONS.map((item) => {
                      const isSelected = watchedUrgency === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          className={`rp-level-card ${
                            isSelected ? "selected" : ""
                          }`}
                          onClick={() =>
                            form.setFieldValue("urgency", item.value)
                          }
                        >
                          <span className="rp-level-code">{item.code}</span>
                          <span className="rp-level-desc">{item.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label={
                <span className="rp-field-label">
                  MÔ TẢ CHI TIẾT SỰ CỐ{" "}
                  <span className="rp-field-key">(DESCRIPTION)</span>{" "}
                  <span className="rp-field-req">*</span>
                </span>
              }
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
                placeholder="Mô tả rõ triệu chứng lỗi, mã thông báo lỗi (nếu có), thời điểm bắt đầu xảy ra và thiết bị/vị trí..."
                maxLength={1500}
                showCount
              />
            </Form.Item>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginTop: 22,
                paddingTop: 18,
                borderTop: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <button
                type="button"
                className="rp-btn-secondary"
                onClick={handleReset}
              >
                <span>↺ Làm mới biểu mẫu</span>
              </button>

              <button
                type="submit"
                className="rp-btn-primary"
                disabled={submitting}
                style={{ height: 42, padding: "0 22px", fontSize: 13 }}
              >
                <span>
                  {submitting
                    ? "Đang kiểm tra..."
                    : "✦ Gửi yêu cầu hỗ trợ"}
                </span>
              </button>
            </div>
          </Form>

          {categoryError && (
            <Alert
              style={{ marginTop: 20 }}
              type="error"
              showIcon
              message="Không tải được danh mục Ticket"
              description={categoryError}
            />
          )}
          {!loadingCategories && !categoryError && categories.length === 0 && (
            <Alert
              style={{ marginTop: 20 }}
              type="warning"
              showIcon
              message="Chưa có danh mục hoạt động"
              description="Vui lòng yêu cầu quản trị viên cấu hình danh mục trước khi tạo Ticket."
            />
          )}
        </div>
      </Col>

      {/* RIGHT COLUMN: AUTOMATED PRIORITY ASSESSMENT & PAYLOAD PREVIEW */}
      <Col xs={24} lg={9}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* CARD 1: PRIORITY ASSESSMENT + 3x3 MATRIX */}
          <div className="rp-card">
            <div className="rp-side-header">
              <h3 className="rp-side-title">
                <span className="rp-cyan-dot" />
                <span>Dự kiến phân loại tự động</span>
              </h3>
              <span className="rp-matrix-badge">3×3 Matrix</span>
            </div>

            <p className="rp-side-desc">
              Theo API Contract (Mục 3.5), Requester chỉ cung cấp{" "}
              <code>impact</code> và <code>urgency</code>. Backend tự lấy{" "}
              <code>requesterId</code> từ Session và tính Priority theo ma trận:
            </p>

            <div className="rp-kv-box">
              <div className="rp-kv-row">
                <span className="rp-kv-label">Impact × Urgency:</span>
                <span className="rp-kv-val">
                  {watchedImpact} × {watchedUrgency}
                </span>
              </div>

              <div className="rp-kv-row">
                <span className="rp-kv-label">Mức Priority dự kiến:</span>
                <span className={`rp-priority-pill ${previewPriority}`}>
                  ● {priorityMeta.label}
                </span>
              </div>

              <div className="rp-kv-row">
                <span className="rp-kv-label">Hạn phản hồi đầu tiên (SLA):</span>
                <span className="rp-kv-val">{priorityMeta.responseSla}</span>
              </div>

              <div className="rp-kv-row">
                <span className="rp-kv-label">Hạn giải quyết (SLA):</span>
                <span className="rp-kv-val">{priorityMeta.resolutionSla}</span>
              </div>

              <div className="rp-kv-row">
                <span className="rp-kv-label">Trạng thái khởi tạo:</span>
                <Tag color="cyan" style={{ margin: 0, fontWeight: 700 }}>
                  NEW
                </Tag>
              </div>
            </div>

            {/* 3x3 VISUAL MATRIX */}
            <div className="rp-matrix-header">
              <span>IMPACT / URGENCY MATRIX</span>
              <span className="rp-matrix-coords">
                COORDINATES: [{shortLevel(watchedImpact)},{" "}
                {shortLevel(watchedUrgency)}]
              </span>
            </div>

            <div className="rp-matrix-grid">
              {MATRIX_ROWS.flatMap((row) =>
                row.cells.map((cell) => {
                  const isActive =
                    row.impact === watchedImpact &&
                    cell.urgency === watchedUrgency;
                  const isP1 = cell.priority === "P1";
                  return (
                    <div
                      key={`${row.impact}-${cell.urgency}`}
                      className={`rp-matrix-cell ${isP1 ? "cell-p1" : ""} ${
                        isActive ? "active-cell" : ""
                      }`}
                    >
                      {isActive ? `★ ${cell.priority}` : cell.label}
                    </div>
                  );
                })
              )}
            </div>

            <div className="rp-matrix-axis">
              <span>X-Axis: Urgency →</span>
              <span>Y-Axis: Impact ↓</span>
            </div>
          </div>

          {/* CARD 2: PAYLOAD & RULES */}
          <div className="rp-card">
            <div className="rp-side-header">
              <h3 className="rp-side-title">
                <span>CreateIncidentRequest Payload &amp; Rules</span>
              </h3>
              <span className="rp-green-dot" />
            </div>

            <ul className="rp-rule-list">
              <li>
                <code>type</code>: Cố định giá trị <strong>"INCIDENT"</strong>{" "}
                trong phạm vi P0.
              </li>
              <li>
                <code>requesterId</code>: Xác định qua HttpOnly Cookie (không
                gửi từ Client).
              </li>
              <li>
                <code>priority</code>: Tính tự động phía Server; Supervisor có
                thể điều chỉnh kèm lý do Audit.
              </li>
            </ul>

            <div className="rp-json-header">
              <span>Payload Preview (JSON)</span>
              <span>POST /api/v1/tickets</span>
            </div>

            <pre className="rp-json-box">
              {JSON.stringify(livePayload, null, 2)}
            </pre>
          </div>
        </div>
      </Col>
    </Row>
  );
}

export default CreateTicketPage;
