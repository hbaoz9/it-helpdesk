import { Button, Table } from 'antd';
import type { TableProps } from 'antd';
import type { Ticket } from '../../types/ticket';
import TicketStatusTag from './TicketStatusTag';
import TicketPriorityTag from './TicketPriorityTag';
import { UNASSIGNED_ASSIGNEE } from './ticketMetadata';
import '../../styles/InternalWorkspace.css';

interface TicketTableProps {
  tickets: Ticket[];
  // Nếu truyền vào, bảng sẽ có cột "Thao tác" để mở trang chi tiết.
  onViewDetail?: (ticket: Ticket) => void;
  emptyText?: string;
}

export default function TicketTable({
  tickets,
  onViewDetail,
  emptyText = 'Không có Ticket nào',
}: TicketTableProps) {
  const columns: NonNullable<TableProps<Ticket>['columns']> = [
    {
      title: 'Mã Ticket',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      render: (code: string) => <span className="iw-ticket-code">{code}</span>,
    },
    {
      title: 'Tiêu đề sự cố',
      dataIndex: 'title',
      key: 'title',
      width: 220,
      render: (title: string) => (
        <span className="iw-ticket-title">{title}</span>
      ),
    },
    {
      title: 'Danh mục',
      dataIndex: 'category',
      key: 'category',
      width: 110,
    },
    {
      title: 'Ưu tiên',
      dataIndex: 'priority',
      key: 'priority',
      width: 130,
      render: (priority: Ticket['priority']) => (
        <TicketPriorityTag priority={priority} />
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 230,
      render: (status: Ticket['status']) => <TicketStatusTag status={status} />,
    },
    {
      title: 'Người xử lý',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 130,
      render: (assignee: string) =>
        assignee === UNASSIGNED_ASSIGNEE ? (
          <span className="iw-muted">{assignee}</span>
        ) : (
          assignee
        ),
    },
    {
      title: 'Thời điểm tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (value: string) => new Date(value).toLocaleString('vi-VN'),
    },
  ];

  if (onViewDetail) {
    columns.push({
      title: 'Thao tác',
      key: 'action',
      width: 110,
      render: (_: unknown, record: Ticket) => (
        <Button type="link" size="small" onClick={() => onViewDetail(record)}>
          Xem chi tiết
        </Button>
      ),
    });
  }

  return (
    <Table<Ticket>
      rowKey="id"
      columns={columns}
      dataSource={tickets}
      pagination={{ pageSize: 5, showSizeChanger: false }}
      scroll={{ x: 1210 }}
      locale={{ emptyText }}
    />
  );
}
