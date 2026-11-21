import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import { FileAddOutlined, ReloadOutlined, RobotOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getRequesterTicketCount, getTickets } from '../../shared/api/tickets';
import type {
  TicketPriority,
  TicketRecord,
  TicketStatus,
} from '../../shared/api/types';
import { useAuth } from '../../shared/auth/useAuth';
import { PRIORITY_METADATA, STATUS_METADATA } from './ticketMetadata';

const PAGE_SIZE = 10;

const statusOptions = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  ...Object.entries(STATUS_METADATA).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

const priorityOptions = [
  { value: 'ALL', label: 'Tất cả mức ưu tiên' },
  ...Object.entries(PRIORITY_METADATA).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

const QUICK_STATUS_FILTERS: {
  value: 'ALL' | TicketStatus;
  label: string;
}[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'WAITING_REQUESTER', label: 'Chờ bạn phản hồi' },
  { value: 'RESOLVED', label: 'Chờ xác nhận hoàn tất' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'NEW', label: 'Mới tạo' },
  { value: 'CLOSED', label: 'Đã đóng' },
];

export default function MyTicketsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | TicketStatus>('ALL');
  const [priority, setPriority] = useState<'ALL' | TicketPriority>('ALL');
  const [page, setPage] = useState(1);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      if (next !== search) {
        setLoading(true);
        setPage(1);
        setSearch(next);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    let active = true;
    const filters = {
      scope: 'requested' as const,
      search: search || undefined,
      status: status === 'ALL' ? undefined : status,
      priority: priority === 'ALL' ? undefined : priority,
      limit: PAGE_SIZE,
    };
    Promise.all([
      getTickets({ ...filters, page }),
      getRequesterTicketCount(filters),
    ])
      .then(([current, count]) => {
        if (!active) return;
        setTickets(current);
        setTotal(count);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Không tải được yêu cầu.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search, status, priority, page, retry, user?.id]);

  // Keep links created with ?selected=INC-... working smoothly.
  useEffect(() => {
    const selected = searchParams.get('selected');
    if (!selected) return;
    let active = true;
    getTickets({ scope: 'requested', search: selected, limit: 100 })
      .then((found) => {
        const ticket = found.find(
          (item) => item.code === selected && item.requester.id === user?.id,
        );
        if (active && ticket) {
          navigate(`/requester/tickets/${encodeURIComponent(ticket.id)}`, {
            replace: true,
          });
        }
      })
      .catch(() => {
        /* Main list displays its own error state. */
      });
    return () => {
      active = false;
    };
  }, [searchParams, navigate, user?.id]);

  const hasActiveFilters =
    Boolean(searchInput.trim()) || status !== 'ALL' || priority !== 'ALL';

  const handleResetFilters = () => {
    setLoading(true);
    setSearchInput('');
    setSearch('');
    setStatus('ALL');
    setPriority('ALL');
    setPage(1);
  };

  const columns: ColumnsType<TicketRecord> = [
    {
      title: 'Mã yêu cầu',
      dataIndex: 'code',
      width: 155,
      render: (code: string, ticket) => (
        <Button
          type="link"
          style={{ padding: 0, fontWeight: 700 }}
          onClick={() => navigate(`/requester/tickets/${ticket.id}`)}
        >
          {code}
        </Button>
      ),
    },
    {
      title: 'Nội dung sự cố',
      dataIndex: 'title',
      render: (title: string, ticket) => (
        <div>
          <Typography.Text strong>{title}</Typography.Text>
          <br />
          <Typography.Text type="secondary">
            {ticket.category.name}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Ưu tiên',
      dataIndex: 'priority',
      width: 145,
      render: (value: TicketPriority) => (
        <Tag color={PRIORITY_METADATA[value].color}>
          {PRIORITY_METADATA[value].shortLabel}
        </Tag>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 180,
      render: (value: TicketStatus) => (
        <Tag color={STATUS_METADATA[value].color}>
          {STATUS_METADATA[value].label}
        </Tag>
      ),
    },
    {
      title: 'Người xử lý',
      key: 'assignee',
      width: 165,
      responsive: ['lg'],
      render: (_, ticket) =>
        ticket.assignee?.fullName ?? (
          <Typography.Text type="secondary">Chưa phân công</Typography.Text>
        ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      width: 165,
      responsive: ['md'],
      render: (value: string) => new Date(value).toLocaleString('vi-VN'),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 120,
      render: (_, ticket) => (
        <Button
          type="link"
          onClick={() => navigate(`/requester/tickets/${ticket.id}`)}
        >
          Xem chi tiết
        </Button>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="requester-page">
      <div className="requester-heading">
        <div>
          <Typography.Text className="requester-eyebrow-text">
            REQUESTER / YÊU CẦU CỦA TÔI
          </Typography.Text>
          <Typography.Title level={2}>Yêu cầu của tôi</Typography.Title>
          <Typography.Text type="secondary">
            Theo dõi tiến độ, phản hồi kỹ thuật viên và xác nhận kết quả các sự
            cố bạn đã gửi.
          </Typography.Text>
        </div>
        <Space wrap>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setLoading(true);
              setRetry((value) => value + 1);
            }}
          >
            Làm mới
          </Button>
          <Button
            icon={<RobotOutlined />}
            onClick={() => navigate('/requester/ai')}
          >
            Nhờ AI hỗ trợ
          </Button>
          <Button
            type="primary"
            icon={<FileAddOutlined />}
            onClick={() => navigate('/requester/tickets/new')}
          >
            Tạo yêu cầu
          </Button>
        </Space>
      </div>

      <Card className="requester-card">
        {/* Các nút lọc nhanh theo trạng thái thường dùng */}
        <div className="requester-quick-tabs">
          {QUICK_STATUS_FILTERS.map((item) => (
            <Button
              key={item.value}
              size="small"
              type={status === item.value ? 'primary' : 'default'}
              onClick={() => {
                if (status !== item.value) {
                  setLoading(true);
                  setStatus(item.value);
                  setPage(1);
                }
              }}
            >
              {item.label}
            </Button>
          ))}
          {hasActiveFilters && (
            <Button size="small" type="link" onClick={handleResetFilters}>
              Xóa bộ lọc
            </Button>
          )}
        </div>

        <Row gutter={[12, 12]} className="requester-filters">
          <Col xs={24} md={10}>
            <Input.Search
              allowClear
              aria-label="Tìm yêu cầu"
              placeholder="Tìm theo mã, tiêu đề hoặc mô tả"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </Col>
          <Col xs={24} sm={12} md={7}>
            <Select
              aria-label="Lọc trạng thái"
              style={{ width: '100%' }}
              value={status}
              options={statusOptions}
              onChange={(value) => {
                setLoading(true);
                setStatus(value as typeof status);
                setPage(1);
              }}
            />
          </Col>
          <Col xs={24} sm={12} md={7}>
            <Select
              aria-label="Lọc ưu tiên"
              style={{ width: '100%' }}
              value={priority}
              options={priorityOptions}
              onChange={(value) => {
                setLoading(true);
                setPriority(value as typeof priority);
                setPage(1);
              }}
            />
          </Col>
        </Row>

        {error && (
          <Alert
            showIcon
            type="error"
            title="Không tải được yêu cầu"
            description={error}
            action={
              <Button
                onClick={() => {
                  setLoading(true);
                  setRetry((value) => value + 1);
                }}
              >
                Thử lại
              </Button>
            }
          />
        )}

        {loading ? (
          <div className="requester-loading">
            <Spin />
          </div>
        ) : (
          !error && (
            <>
              <Table<TicketRecord>
                rowKey="id"
                columns={columns}
                dataSource={tickets}
                pagination={false}
                scroll={{ x: 860 }}
                locale={{
                  emptyText: (
                    <Empty description="Chưa có yêu cầu phù hợp.">
                      <Button
                        type="primary"
                        onClick={() => navigate('/requester/tickets/new')}
                      >
                        Tạo yêu cầu
                      </Button>
                    </Empty>
                  ),
                }}
              />
              <div className="requester-pager">
                <Typography.Text type="secondary">
                  {total} yêu cầu · Trang {page} / {totalPages}
                </Typography.Text>
                <Space>
                  <Button
                    disabled={page === 1}
                    onClick={() => {
                      setLoading(true);
                      setPage((value) => value - 1);
                    }}
                  >
                    Trước
                  </Button>
                  <Button
                    disabled={page * PAGE_SIZE >= total}
                    onClick={() => {
                      setLoading(true);
                      setPage((value) => value + 1);
                    }}
                  >
                    Tiếp
                  </Button>
                </Space>
              </div>
            </>
          )
        )}
      </Card>
    </div>
  );
}
