import { Button, Col, Descriptions, Input, Row } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import TicketStatusTag from '../../components/tickets/TicketStatusTag';
import TicketPriorityTag from '../../components/tickets/TicketPriorityTag';
import { INTERNAL_PATHS } from '../../layouts/internalPaths';
import { MOCK_TICKETS } from '../../data/mockTickets';
import '../../styles/InternalWorkspace.css';

const ACTIVITY_ITEMS = [
  'Ticket được tạo',
  'Ticket được phân loại',
  'Ticket được phân công',
  'Các hoạt động xử lý tiếp theo',
];

const ACTION_LABELS = [
  'Bắt đầu xử lý',
  'Yêu cầu bổ sung thông tin',
  'Resolve',
  'Internal Note',
];

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const ticket = MOCK_TICKETS.find((item) => item.id === id || item.code === id);

  const backButton = (
    <button
      type="button"
      className="iw-btn-secondary"
      onClick={() => navigate(INTERNAL_PATHS.technicianTickets)}
    >
      ← Danh sách Ticket
    </button>
  );

  if (!ticket) {
    return (
      <div className="iw-card">
        <div className="iw-card-header">
          <div>
            <h2 className="iw-card-title">Không tìm thấy Ticket</h2>
            <p className="iw-card-subtitle">
              Ticket không tồn tại trong dữ liệu minh họa.
            </p>
          </div>
          {backButton}
        </div>
      </div>
    );
  }

  return (
    <div className="iw-stack">
      <div className="iw-card">
        <div className="iw-card-header">
          <div>
            <h2 className="iw-card-title">
              {ticket.code} <span>(Dữ liệu minh họa – chưa kết nối Backend)</span>
            </h2>
            <p className="iw-card-subtitle">Thông tin chung của Ticket</p>
          </div>
          <div className="iw-card-actions">
            <TicketStatusTag status={ticket.status} />
            {backButton}
          </div>
        </div>

        <h3 className="iw-detail-title">{ticket.title}</h3>

        <Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
          <Descriptions.Item label="Mã Ticket">
            <strong className="iw-ticket-code">{ticket.code}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Danh mục">{ticket.category}</Descriptions.Item>
          <Descriptions.Item label="Mức ưu tiên">
            <TicketPriorityTag priority={ticket.priority} />
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <TicketStatusTag status={ticket.status} />
          </Descriptions.Item>
          <Descriptions.Item label="Người xử lý">
            {ticket.assignee}
          </Descriptions.Item>
          <Descriptions.Item label="Thời điểm tạo">
            {new Date(ticket.createdAt).toLocaleString('vi-VN')}
          </Descriptions.Item>
        </Descriptions>
      </div>

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={15}>
          <div className="iw-stack">
            <div className="iw-card">
              <div className="iw-card-header">
                <div>
                  <h2 className="iw-card-title">Bình luận và trao đổi</h2>
                  <p className="iw-card-subtitle">
                    Bố cục minh họa, chưa lưu dữ liệu
                  </p>
                </div>
              </div>

              <div className="iw-comment">
                <div className="iw-comment-author">Người yêu cầu</div>
                <p className="iw-comment-text">
                  Mô tả sự cố và cung cấp thông tin liên quan đến Ticket.
                </p>
                <span className="iw-comment-meta">Dữ liệu bình luận minh họa</span>
              </div>

              <div className="iw-comment">
                <div className="iw-comment-author">Technician</div>
                <p className="iw-comment-text">
                  Khu vực hiển thị phản hồi và trao đổi trong quá trình xử lý.
                </p>
                <span className="iw-comment-meta">Dữ liệu bình luận minh họa</span>
              </div>

              <div className="iw-comment-form">
                <Input.TextArea
                  rows={3}
                  placeholder="Khu vực nhập bình luận (chưa kết nối Backend)"
                  disabled
                />
                <div className="iw-comment-form-footer">
                  <Button type="primary" disabled>
                    Gửi bình luận
                  </Button>
                </div>
              </div>
            </div>

            <div className="iw-card">
              <div className="iw-card-header">
                <div>
                  <h2 className="iw-card-title">Lịch sử hoạt động</h2>
                  <p className="iw-card-subtitle">
                    Lịch sử trên chỉ là bố cục minh họa
                  </p>
                </div>
              </div>

              <ul className="iw-activity">
                {ACTIVITY_ITEMS.map((item, index) => (
                  <li key={item} className={index === 0 ? 'is-first' : ''}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Col>

        <Col xs={24} lg={9}>
          <div className="iw-card">
            <div className="iw-card-header">
              <div>
                <h2 className="iw-card-title">Hành động nghiệp vụ</h2>
              </div>
            </div>

            <div className="iw-warning-banner is-compact" role="status">
              <span className="iw-warning-icon">⚠</span>
              <div>
                <div className="iw-warning-title">
                  Các thao tác chỉ ở mức giao diện
                </div>
                <div className="iw-warning-desc">
                  Chưa thực hiện Workflow hoặc cập nhật dữ liệu.
                </div>
              </div>
            </div>

            <div className="iw-action-list">
              {ACTION_LABELS.map((label) => (
                <Button key={label} block disabled>
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
}
