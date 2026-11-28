import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import {
  assignAsset,
  createAsset,
  createAssetCategory,
  createAssetMaintenance,
  getAllAssetAssignments,
  getAllAssetHistory,
  getAllAssetMaintenance,
  getAllAssets,
  getAsset,
  getAssetAssignments,
  getAssetCategories,
  getAssetDashboard,
  getAssetHistory,
  getAssetMaintenance,
  getAssets,
  getMyAssignedAssets,
  returnAsset,
  updateAsset,
  updateAssetCategory,
  updateAssetMaintenance,
  updateAssetStatus,
} from '../../shared/api/assets';
import { getAdminUsers as listAdminUsers } from '../../shared/api/admin';
import type {
  AdminUserRecord,
  AssetAssignmentRecord,
  AssetCategoryRecord,
  AssetCondition,
  AssetDashboardSummary,
  AssetHistoryRecord,
  AssetListResult,
  AssetMaintenanceRecord,
  AssetMaintenanceType,
  AssetRecord,
  AssetRecordReference,
  AssetStatus,
  MaintenanceStatus,
} from '../../shared/api/types';
import { useAuth } from '../../shared/auth/useAuth';
import '../../styles/InternalWorkspace.css';

const statusLabels: Record<AssetStatus, string> = {
  AVAILABLE: 'Khả dụng',
  ASSIGNED: 'Đang sử dụng',
  UNDER_MAINTENANCE: 'Đang bảo trì',
  RETIRED: 'Ngừng sử dụng',
  DISPOSED: 'Đã thanh lý',
  LOST: 'Báo mất',
};
const statusColors: Record<AssetStatus, string> = {
  AVAILABLE: 'green',
  ASSIGNED: 'blue',
  UNDER_MAINTENANCE: 'orange',
  RETIRED: 'default',
  DISPOSED: 'default',
  LOST: 'red',
};
const conditionLabels: Record<AssetCondition, string> = {
  NEW: 'Mới',
  GOOD: 'Tốt',
  FAIR: 'Khá',
  POOR: 'Kém',
  DAMAGED: 'Hư hỏng',
};
const maintenanceStatusLabels: Record<MaintenanceStatus, string> = {
  SCHEDULED: 'Đã lên lịch',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};
const maintenanceTypeLabels: Record<AssetMaintenanceType, string> = {
  REPAIR: 'Sửa chữa',
  MAINTENANCE: 'Bảo trì',
  UPGRADE: 'Nâng cấp',
  INSPECTION: 'Kiểm tra',
};
const historyActionLabels: Record<string, string> = {
  CREATED: 'Tạo tài sản',
  UPDATED: 'Cập nhật',
  STATUS_CHANGED: 'Đổi trạng thái',
  ASSIGNED: 'Cấp phát',
  RETURNED: 'Thu hồi',
  MAINTENANCE_CREATED: 'Tạo bảo trì',
  MAINTENANCE_UPDATED: 'Cập nhật bảo trì',
  DELETED: 'Ngừng sử dụng',
};
const historyChangedFieldLabels: Record<string, string> = {
  assetTag: 'mã tài sản',
  name: 'tên tài sản',
  categoryId: 'danh mục',
  manufacturer: 'nhà sản xuất',
  model: 'model',
  serialNumber: 'số serial',
  condition: 'tình trạng',
  purchaseDate: 'ngày mua',
  purchaseCost: 'giá mua',
  warrantyExpires: 'hạn bảo hành',
  location: 'vị trí',
  notes: 'ghi chú',
  status: 'trạng thái',
  description: 'mô tả',
  diagnosis: 'chẩn đoán',
  resolution: 'kết quả xử lý',
  provider: 'đơn vị thực hiện',
  cost: 'chi phí',
  scheduledAt: 'thời gian dự kiến',
};
const errorText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
const dateText = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('vi-VN') : '—';
const historyActionLabel = (action: string) =>
  Object.prototype.hasOwnProperty.call(historyActionLabels, action)
    ? historyActionLabels[action]
    : 'Hoạt động khác';
const historyDateTimeText = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN');
};
const cleanHistoryText = (value: unknown) =>
  typeof value === 'string'
    ? value.replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi, '').replace(/\s+/g, ' ').trim()
    : '';
const isSerializedJsonText = (value: string) => {
  const text = value.trimStart();
  return text.startsWith('{') || text.startsWith('[') || text.startsWith('"')
    || /^(?:-?\d|true\b|false\b|null\b)/i.test(text);
};
const historyDetailsRecord = (value: unknown): Record<string, unknown> | null => {
  let details = value;
  if (typeof details === 'string') {
    try {
      details = JSON.parse(details) as unknown;
    } catch {
      return null;
    }
  }
  return details !== null && typeof details === 'object' && !Array.isArray(details)
    ? details as Record<string, unknown>
    : null;
};
const assetStatusText = (value: unknown) =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(statusLabels, value)
    ? statusLabels[value as AssetStatus]
    : '';
const maintenanceStatusText = (value: unknown) =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(maintenanceStatusLabels, value)
    ? maintenanceStatusLabels[value as MaintenanceStatus]
    : '';

interface HistoryActivityDisplay {
  summary: string;
  before?: string;
  after?: string;
  changedFields: string[];
  legacyText?: string;
}

function formatHistoryActivity(record: AssetHistoryRecord): HistoryActivityDisplay {
  const details = historyDetailsRecord(record.details);
  const fieldNames = Array.isArray(details?.changedFields)
    ? details.changedFields
      .map((field) => typeof field === 'string' ? historyChangedFieldLabels[field] : undefined)
      .filter((field): field is string => Boolean(field))
    : [];
  const legacyText = typeof record.details === 'string' && !isSerializedJsonText(record.details)
    ? cleanHistoryText(record.details) || undefined
    : undefined;
  const assetName = cleanHistoryText(details?.name) || cleanHistoryText(record.asset?.name);

  switch (record.type) {
    case 'CREATED':
      return { summary: `Tạo mới tài sản${assetName ? ` ${assetName}` : ''}`, changedFields: [], legacyText };
    case 'UPDATED':
      return {
        summary: fieldNames.length ? `Cập nhật ${fieldNames.join(', ')}` : 'Cập nhật thông tin tài sản',
        changedFields: fieldNames,
        legacyText,
      };
    case 'STATUS_CHANGED': {
      const before = assetStatusText(details?.from);
      const after = assetStatusText(details?.to);
      return {
        summary: before && after ? `Thay đổi trạng thái từ ${before} sang ${after}` : 'Thay đổi trạng thái tài sản',
        before,
        after,
        changedFields: [],
        legacyText,
      };
    }
    case 'ASSIGNED':
      return { summary: 'Cấp phát tài sản', changedFields: [], legacyText };
    case 'RETURNED':
      return { summary: 'Thu hồi tài sản', changedFields: [], legacyText };
    case 'MAINTENANCE_CREATED': {
      const title = cleanHistoryText(details?.title);
      return {
        summary: title ? `Tạo bản ghi bảo trì: ${title}` : 'Tạo bản ghi bảo trì',
        changedFields: [],
        legacyText,
      };
    }
    case 'MAINTENANCE_UPDATED': {
      const before = maintenanceStatusText(details?.from);
      const after = maintenanceStatusText(details?.to);
      return {
        summary: before && after ? `Cập nhật bảo trì: ${before} sang ${after}` : 'Cập nhật thông tin bảo trì',
        before,
        after,
        changedFields: [],
        legacyText,
      };
    }
    case 'DELETED': {
      const priorStatus = assetStatusText(details?.priorStatus);
      return {
        summary: priorStatus ? `Ngừng sử dụng tài sản (trạng thái trước: ${priorStatus})` : 'Ngừng sử dụng tài sản',
        changedFields: [],
        legacyText,
      };
    }
    default:
      return { summary: 'Hoạt động tài sản đã được ghi nhận', changedFields: [], legacyText };
  }
}

function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return <div className="iw-card-header">
    <div><h1 className="iw-card-title">{title}</h1><p className="iw-card-subtitle">{subtitle}</p></div>
    {actions && <div className="iw-card-actions">{actions}</div>}
  </div>;
}

export function AssetDashboardPage() {
  const [data, setData] = useState<AssetDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getAssetDashboard()); setError(''); }
    catch (e) { setError(errorText(e, 'Không tải được dashboard tài sản')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const cards = data ? [
    { label: 'Tổng tài sản', value: data.total },
    { label: 'Khả dụng', value: data.byStatus.AVAILABLE ?? 0 },
    { label: 'Đang sử dụng', value: data.byStatus.ASSIGNED ?? 0 },
    { label: 'Đang bảo trì', value: data.byStatus.UNDER_MAINTENANCE ?? 0 },
    { label: 'Tình trạng kém / hỏng', value: data.attention.poorCondition + data.attention.damagedCondition },
    { label: 'Bảo trì quá hạn', value: data.attention.overdueMaintenance },
    { label: 'Bảo hành sắp hết hạn', value: data.warranty.expiringWithin30Days },
    { label: 'Đã hết bảo hành', value: data.warranty.expired },
  ] : [];
  const maxCategoryCount = Math.max(1, ...(data?.categoryCounts.map((item) => item.count) ?? []));
  return <div className="iw-stack">
    <PageHeader title="Tổng quan tài sản CNTT" subtitle="Số liệu hiện có từ hệ thống tài sản" actions={<Button icon={<ReloadOutlined />} onClick={() => void load()}>Làm mới</Button>} />
    {error && <Alert type="error" showIcon message="Không tải được dữ liệu" description={error} action={<Button size="small" onClick={() => void load()}>Thử lại</Button>} />}
    <Row gutter={[16, 16]}>{cards.map((item) => <Col xs={12} md={8} lg={6} key={item.label}><Card loading={loading}><Statistic title={item.label} value={item.value} /></Card></Col>)}</Row>
    <Card title="Tài sản theo trạng thái" loading={loading}>
      {data && Object.keys(data.byStatus).length === 0
        ? <Empty description="Chưa có tài sản" />
        : <Row gutter={[12, 12]}>{Object.entries(data?.byStatus ?? {}).map(([status, count]) => {
          const known = status as AssetStatus;
          return <Col xs={12} sm={8} md={6} key={status}><Card size="small">
            <Space direction="vertical"><Tag color={statusColors[known]}>{statusLabels[known] ?? status}</Tag><Typography.Text strong>{count} tài sản</Typography.Text></Space>
          </Card></Col>;
        })}</Row>}
    </Card>
    <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Số lượng theo danh mục" loading={loading}>
            {data?.categoryCounts.length ? data.categoryCounts.map((item) => <div key={item.id} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><Typography.Text>{item.name}</Typography.Text><Typography.Text type="secondary">{item.count}</Typography.Text></div>
              <Progress percent={Math.round(item.count / maxCategoryCount * 100)} showInfo={false} />
            </div>) : <Empty description="Chưa có danh mục tài sản" />}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Tài sản sắp hết bảo hành (30 ngày)" loading={loading}>
            {data?.warranty.items.length ? <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={data.warranty.items}
              columns={[
                { title: 'Mã tài sản', dataIndex: 'assetTag' },
                { title: 'Tên tài sản', dataIndex: 'name' },
                { title: 'Danh mục', render: (_, item) => item.category.name },
                { title: 'Hết hạn', dataIndex: 'warrantyExpires', render: dateText },
              ]}
            /> : <Empty description="Không có tài sản sắp hết bảo hành" />}
          </Card>
        </Col>
    </Row>
    <Space wrap>
      <Link to="../assets"><Button type="primary">Mở kho tài sản</Button></Link>
      <Link to="../asset-maintenance"><Button>Bảo trì</Button></Link>
      <Link to="../asset-history"><Button>Lịch sử</Button></Link>
    </Space>
  </div>;
}

export function MyAssignedAssetsPage() {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { setAssets(await getMyAssignedAssets()); setError(''); }
    catch (e) { setError(errorText(e, 'Không tải được tài sản')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const columns: ColumnsType<AssetRecord> = [
    { title: 'Mã tài sản', dataIndex: 'code', render: (v) => <strong className="iw-ticket-code">{v}</strong> },
    { title: 'Tên tài sản', dataIndex: 'name' },
    { title: 'Danh mục', render: (_, x) => x.category.name || '—' },
    { title: 'Thương hiệu / Model', render: (_, x) => [x.brand, x.model].filter(Boolean).join(' / ') || '—' },
    { title: 'Ngày cấp', render: (_, x) => dateText(x.currentAssignment?.assignedDate) },
    { title: 'Trạng thái', dataIndex: 'status', render: (v: AssetStatus) => <Tag color={statusColors[v]}>{statusLabels[v]}</Tag> },
    { title: 'Thao tác', render: (_, asset) => <Button icon={<EyeOutlined />} onClick={() => setSelectedAsset(asset)}>Chi tiết</Button> },
  ];
  return <div className="iw-stack">
    <PageHeader title="Tài sản của tôi" subtitle="Chỉ hiển thị tài sản đang được cấp cho tài khoản của bạn" actions={<Button icon={<ReloadOutlined />} onClick={() => void load()}>Làm mới</Button>} />
    {error && <Alert type="error" showIcon message="Không tải được danh sách" description={error} />}
    <Card><Table rowKey="id" columns={columns} dataSource={assets} loading={loading} locale={{ emptyText: 'Bạn chưa được cấp tài sản nào' }} pagination={{ pageSize: 10 }} /></Card>
    <Drawer title={selectedAsset?.name ?? 'Chi tiết tài sản'} open={Boolean(selectedAsset)} onClose={() => setSelectedAsset(null)} width={520}>
      {selectedAsset && <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="Mã tài sản">{selectedAsset.code}</Descriptions.Item>
        <Descriptions.Item label="Danh mục">{selectedAsset.category.name || '—'}</Descriptions.Item>
        <Descriptions.Item label="Thương hiệu / Model">{[selectedAsset.brand, selectedAsset.model].filter(Boolean).join(' / ') || '—'}</Descriptions.Item>
        <Descriptions.Item label="Serial number">{selectedAsset.serialNumber || '—'}</Descriptions.Item>
        <Descriptions.Item label="Vị trí">{selectedAsset.location || '—'}</Descriptions.Item>
        <Descriptions.Item label="Ngày cấp">{dateText(selectedAsset.currentAssignment?.assignedDate)}</Descriptions.Item>
        <Descriptions.Item label="Trạng thái">{statusLabels[selectedAsset.status]}</Descriptions.Item>
        <Descriptions.Item label="Ngày hết bảo hành">{dateText(selectedAsset.warrantyExpiration)}</Descriptions.Item>
      </Descriptions>}
    </Drawer>
  </div>;
}

type AssetFormValues = {
  code?: string;
  sharedReportable?: boolean;
  name: string;
  categoryId: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  condition?: AssetCondition;
  location?: string;
  purchaseDate?: string;
  warrantyExpiration?: string;
  description?: string;
};

function AssetEditor({ open, asset, categories, onCancel, onSave }: {
  open: boolean;
  asset?: AssetRecord | null;
  categories: AssetCategoryRecord[];
  onCancel: () => void;
  onSave: (values: AssetFormValues) => Promise<void>;
}) {
  const [form] = Form.useForm<AssetFormValues>();
  useEffect(() => {
    if (open) form.setFieldsValue(asset ? {
      code: asset.code,
      sharedReportable: asset.sharedReportable,
      name: asset.name,
      categoryId: asset.categoryId,
      brand: asset.brand ?? '',
      model: asset.model ?? '',
      serialNumber: asset.serialNumber ?? '',
      condition: asset.condition ?? undefined,
      location: asset.location ?? '',
      purchaseDate: asset.purchaseDate?.slice(0, 10) ?? '',
      warrantyExpiration: asset.warrantyExpiration?.slice(0, 10) ?? '',
      description: asset.description ?? '',
    } : {});
    else form.resetFields();
  }, [asset, form, open]);
  return <Modal title={asset ? 'Chỉnh sửa tài sản' : 'Thêm tài sản'} open={open} onCancel={onCancel} footer={null} destroyOnHidden>
    <Form form={form} layout="vertical" onFinish={onSave}>
      <Form.Item name="code" label="Mã tài sản"><Input placeholder="Để trống để tạo tự động" /></Form.Item>
      <Form.Item name="name" label="Tên tài sản" rules={[{ required: true, message: 'Vui lòng nhập tên tài sản' }]}><Input /></Form.Item>
      <Form.Item name="categoryId" label="Danh mục" rules={[{ required: true, message: 'Vui lòng chọn danh mục' }]}>
        <Select options={categories.filter((item) => item.active).map((item) => ({ value: item.id, label: item.name }))} />
      </Form.Item>
      <Row gutter={12}><Col span={12}><Form.Item name="brand" label="Thương hiệu"><Input /></Form.Item></Col><Col span={12}><Form.Item name="model" label="Model"><Input /></Form.Item></Col></Row>
      <Form.Item name="serialNumber" label="Serial number"><Input /></Form.Item>
      <Form.Item name="condition" label="Tình trạng thiết bị">
        <Select allowClear options={Object.entries(conditionLabels).map(([value, label]) => ({ value, label }))} />
      </Form.Item>
      <Form.Item name="location" label="Vị trí"><Input /></Form.Item>
      <Form.Item name="sharedReportable" label="Cho phép mọi Requester báo lỗi khi thiết bị chưa được cấp phát" valuePropName="checked"><Checkbox /></Form.Item>
      <Row gutter={12}><Col span={12}><Form.Item name="purchaseDate" label="Ngày mua"><Input type="date" /></Form.Item></Col><Col span={12}><Form.Item name="warrantyExpiration" label="Hết bảo hành"><Input type="date" /></Form.Item></Col></Row>
      <Form.Item name="description" label="Ghi chú"><Input.TextArea rows={3} /></Form.Item>
      <Button type="primary" htmlType="submit">Lưu tài sản</Button>
    </Form>
  </Modal>;
}

function AssetHistoryDetailDrawer({ record, asset, onClose }: {
  record: AssetHistoryRecord | null;
  asset?: AssetRecordReference;
  onClose: () => void;
}) {
  if (!record) return null;
  const activity = formatHistoryActivity(record);
  const displayAsset = asset ?? record.asset;
  const assetName = cleanHistoryText(displayAsset?.name);
  const assetCode = cleanHistoryText(displayAsset?.code);
  return <Drawer title="Chi tiết hoạt động" open onClose={onClose} width="min(560px, 100vw)">
    <Descriptions bordered column={1} size="small">
      <Descriptions.Item label="Tài sản">
        <Space direction="vertical" size={0}>
          <span>{assetName || 'Không xác định'}</span>
          {assetCode && <Typography.Text type="secondary">{assetCode}</Typography.Text>}
        </Space>
      </Descriptions.Item>
      <Descriptions.Item label="Sự kiện">{historyActionLabel(record.type)}</Descriptions.Item>
      <Descriptions.Item label="Thời gian">{historyDateTimeText(record.createdAt)}</Descriptions.Item>
      <Descriptions.Item label="Người thực hiện">{cleanHistoryText(record.actor?.fullName) || 'Không xác định'}</Descriptions.Item>
      <Descriptions.Item label="Nội dung">{activity.summary}</Descriptions.Item>
      {activity.before && <Descriptions.Item label="Trước đó">{activity.before}</Descriptions.Item>}
      {activity.after && <Descriptions.Item label="Sau đó">{activity.after}</Descriptions.Item>}
      {activity.changedFields.length > 0 && <Descriptions.Item label="Thông tin cập nhật">{activity.changedFields.join(', ')}</Descriptions.Item>}
      {activity.legacyText && <Descriptions.Item label="Ghi chú lịch sử">{activity.legacyText}</Descriptions.Item>}
    </Descriptions>
  </Drawer>;
}

function AssetDetailDrawer({ assetId, open, onClose, isAdmin, onEdit, onChanged }: {
  assetId: string | null;
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onEdit: (asset: AssetRecord) => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [asset, setAsset] = useState<AssetRecord | null>(null);
  const [history, setHistory] = useState<AssetHistoryRecord[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<AssetHistoryRecord | null>(null);
  const [maintenance, setMaintenance] = useState<AssetMaintenanceRecord[]>([]);
  const [assignments, setAssignments] = useState<AssetAssignmentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canSeeAssignments = user?.roles.some((role) => role === 'SUPERVISOR' || role === 'ADMIN') ?? false;
  const load = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    try {
      const results = await Promise.all([
        getAsset(assetId),
        getAssetHistory(assetId),
        getAssetMaintenance(assetId),
        canSeeAssignments ? getAssetAssignments(assetId) : Promise.resolve([]),
      ]);
      setAsset(results[0]);
      setHistory(results[1]);
      setMaintenance(results[2]);
      setAssignments(results[3]);
      setError('');
    } catch (e) { setError(errorText(e, 'Không tải được chi tiết tài sản')); }
    finally { setLoading(false); }
  }, [assetId, canSeeAssignments]);
  useEffect(() => { if (open) void Promise.resolve().then(load); }, [load, open]);

  const changeStatus = (status: AssetStatus) => {
    if (!asset) return;
    Modal.confirm({
      title: 'Thay đổi trạng thái tài sản?',
      content: `Xác nhận chuyển ${asset.code} sang trạng thái “${statusLabels[status]}”.`,
      okText: 'Xác nhận',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await updateAssetStatus(asset.id, status);
          message.success('Đã cập nhật trạng thái tài sản');
          await load();
          onChanged();
        } catch (e) {
          message.error(errorText(e, 'Không thể cập nhật trạng thái tài sản'));
          throw e;
        }
      },
    });
  };
  return <>
    <Drawer title={asset?.name ?? 'Chi tiết tài sản'} open={open} onClose={() => { setSelectedHistory(null); onClose(); }} width={760}>
    {error && <Alert type="error" showIcon message="Không tải được chi tiết" description={error} action={<Button size="small" onClick={() => void load()}>Thử lại</Button>} />}
    {loading && !asset ? <Card loading /> : asset && <>
      <Space wrap style={{ marginBottom: 16 }}>
        <Tag color={statusColors[asset.status]}>{statusLabels[asset.status]}</Tag>
        <Typography.Text code>{asset.code}</Typography.Text>
        {isAdmin && <Button icon={<EditOutlined />} onClick={() => onEdit(asset)}>Chỉnh sửa</Button>}
        {isAdmin && <Select
          value={asset.status}
          style={{ minWidth: 180 }}
          options={Object.entries(statusLabels).map(([value, label]) => ({
            value,
            label,
            disabled: value === 'ASSIGNED',
          }))}
          onChange={changeStatus}
        />}
      </Space>
      <Tabs items={[
        { key: 'info', label: 'Thông tin', children: <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Mã">{asset.code}</Descriptions.Item>
          <Descriptions.Item label="Danh mục">{asset.category.name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Thương hiệu / Model">{[asset.brand, asset.model].filter(Boolean).join(' / ') || '—'}</Descriptions.Item>
          <Descriptions.Item label="Serial number">{asset.serialNumber || '—'}</Descriptions.Item>
          <Descriptions.Item label="Tình trạng">{asset.condition ? conditionLabels[asset.condition] : '—'}</Descriptions.Item>
          <Descriptions.Item label="Vị trí">{asset.location || '—'}</Descriptions.Item>
          <Descriptions.Item label="Ngày mua">{dateText(asset.purchaseDate)}</Descriptions.Item>
          <Descriptions.Item label="Hết bảo hành">{dateText(asset.warrantyExpiration)}</Descriptions.Item>
          <Descriptions.Item label="Ghi chú">{asset.description || '—'}</Descriptions.Item>
          <Descriptions.Item label="Người đang sử dụng">{asset.currentAssignment?.assignedUser.fullName ?? '—'}</Descriptions.Item>
        </Descriptions> },
        { key: 'maintenance', label: `Bảo trì (${maintenance.length})`, children: <Table size="small" rowKey="id" dataSource={maintenance} pagination={{ pageSize: 5 }} locale={{ emptyText: 'Chưa có lịch sử bảo trì' }} columns={[
          { title: 'Nội dung', dataIndex: 'title' },
          { title: 'Trạng thái', dataIndex: 'status', render: (value: MaintenanceStatus) => <Tag>{maintenanceStatusLabels[value]}</Tag> },
          { title: 'Ngày', render: (_, item) => dateText(item.scheduledAt ?? item.startDate) },
        ]} /> },
        { key: 'history', label: `Lịch sử (${history.length})`, children: <Table size="small" rowKey="id" dataSource={history} pagination={{ pageSize: 5 }} locale={{ emptyText: 'Chưa có lịch sử' }} columns={[
          { title: 'Sự kiện', dataIndex: 'type', render: (value: string) => historyActionLabel(value) },
          { title: 'Chi tiết', render: (_, item) => {
            const activity = formatHistoryActivity(item);
            return <Tooltip title={activity.summary}><Button type="link" style={{ padding: 0, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => setSelectedHistory(item)}>{activity.summary}</Button></Tooltip>;
          } },
          { title: 'Người thực hiện', render: (_, item) => item.actor?.fullName ?? '—' },
          { title: 'Thời gian', dataIndex: 'createdAt', render: historyDateTimeText },
        ]} /> },
        ...(canSeeAssignments ? [{ key: 'assignments', label: `Phân công (${assignments.length})`, children: <Table size="small" rowKey="id" dataSource={assignments} pagination={{ pageSize: 5 }} locale={{ emptyText: 'Chưa có lịch sử phân công' }} columns={[
          { title: 'Người nhận', render: (_, item) => item.assignedUser.fullName },
          { title: 'Ngày cấp', dataIndex: 'assignedDate', render: dateText },
          { title: 'Ngày trả', dataIndex: 'returnDate', render: dateText },
          { title: 'Trạng thái', render: (_, item) => <Tag color={item.status === 'ACTIVE' ? 'blue' : 'default'}>{item.status === 'ACTIVE' ? 'Đang dùng' : 'Đã trả'}</Tag> },
        ]} /> }] : []),
      ]} />
    </>}
    </Drawer>
    <AssetHistoryDetailDrawer record={selectedHistory} asset={asset ?? undefined} onClose={() => setSelectedHistory(null)} />
  </>;
}

export function AssetInventoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('ADMIN') ?? false;
  const [result, setResult] = useState<AssetListResult>({ items: [], total: 0, page: 1, limit: 10 });
  const [categories, setCategories] = useState<AssetCategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<AssetStatus | ''>('');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<AssetRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [assetResult, categoryResult] = await Promise.all([
        getAssets({ search, categoryId: categoryId || undefined, status: status || undefined, page, limit: 10 }),
        getAssetCategories(),
      ]);
      setResult(assetResult);
      setCategories(categoryResult);
      setError('');
    } catch (e) { setError(errorText(e, 'Không tải được danh sách tài sản')); }
    finally { setLoading(false); }
  }, [categoryId, page, search, status]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const saveAsset = async (values: AssetFormValues) => {
    try {
      if (editAsset) await updateAsset(editAsset.id, values);
      else await createAsset(values);
      message.success(editAsset ? 'Đã cập nhật tài sản' : 'Đã tạo tài sản');
      setEditorOpen(false);
      setEditAsset(null);
      await load();
    } catch (e) { message.error(errorText(e, 'Không thể lưu tài sản')); }
  };
  const columns: ColumnsType<AssetRecord> = [
    { title: 'Mã tài sản', dataIndex: 'code', render: (value) => <strong className="iw-ticket-code">{value}</strong> },
    { title: 'Tên tài sản', dataIndex: 'name' },
    { title: 'Danh mục', render: (_, item) => item.category.name || '—' },
    { title: 'Vị trí', dataIndex: 'location', render: (value) => value || '—' },
    { title: 'Người sử dụng', render: (_, item) => item.currentAssignment?.assignedUser.fullName ?? '—' },
    { title: 'Trạng thái', dataIndex: 'status', render: (value: AssetStatus) => <Tag color={statusColors[value]}>{statusLabels[value]}</Tag> },
    { title: 'Thao tác', key: 'action', render: (_, item) => <Button icon={<EyeOutlined />} onClick={() => setDetailId(item.id)}>Chi tiết</Button> },
  ];
  return <div className="iw-stack">
    <PageHeader title="Kho tài sản CNTT" subtitle="Tra cứu danh mục tài sản và thông tin sử dụng" actions={<>
      <Button icon={<ReloadOutlined />} onClick={() => void load()}>Làm mới</Button>
      {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditAsset(null); setEditorOpen(true); }}>Thêm tài sản</Button>}
    </>} />
    {error && <Alert type="error" showIcon message="Không tải được dữ liệu" description={error} action={<Button size="small" onClick={() => void load()}>Thử lại</Button>} />}
    <Card>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          value={searchDraft}
          onChange={(event) => {
            setSearchDraft(event.target.value);
            if (!event.target.value) {
              setSearch('');
              setPage(1);
            }
          }}
          onSearch={(value) => { setSearch(value); setPage(1); }}
          placeholder="Mã, tên, serial hoặc model"
          allowClear
          enterButton={<SearchOutlined />}
          style={{ width: 320 }}
        />
        <Select allowClear value={categoryId || undefined} placeholder="Tất cả danh mục" style={{ width: 200 }} options={categories.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => { setCategoryId(value ?? ''); setPage(1); }} />
        <Select allowClear value={status || undefined} placeholder="Tất cả trạng thái" style={{ width: 190 }} options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} onChange={(value) => { setStatus(value ?? ''); setPage(1); }} />
      </Space>
      <Table rowKey="id" columns={columns} dataSource={result.items} loading={loading} pagination={{ current: page, pageSize: 10, total: result.total, onChange: (value) => setPage(value) }} locale={{ emptyText: 'Không có tài sản phù hợp' }} />
    </Card>
    <AssetDetailDrawer assetId={detailId} open={Boolean(detailId)} onClose={() => setDetailId(null)} isAdmin={isAdmin} onEdit={(asset) => { setEditAsset(asset); setEditorOpen(true); }} onChanged={() => void load()} />
    <AssetEditor open={editorOpen} asset={editAsset} categories={categories} onCancel={() => { setEditorOpen(false); setEditAsset(null); }} onSave={saveAsset} />
  </div>;
}

export function AssetAssignmentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('ADMIN') ?? false;
  const [records, setRecords] = useState<AssetAssignmentRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'returned'>('all');
  const [assignOpen, setAssignOpen] = useState(false);
  const [returning, setReturning] = useState<AssetAssignmentRecord | null>(null);
  const [form] = Form.useForm();
  const [returnForm] = Form.useForm<{ conditionAtReturn?: AssetCondition; notes?: string }>();
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [assignmentData, assetData] = await Promise.all([getAllAssetAssignments(), getAllAssets()]);
      setRecords(assignmentData);
      setAssets(assetData);
      if (isAdmin) setUsers(await listAdminUsers({ active: 'true' }));
      setError('');
    } catch (e) { setError(errorText(e, 'Không tải được phân công tài sản')); }
    finally { setLoading(false); }
  }, [isAdmin]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const filtered = records.filter((item) => {
    const asset = item.asset ?? assetById.get(item.assetId);
    const text = `${asset?.code ?? ''} ${asset?.name ?? ''} ${item.assignedUser.fullName} ${item.assignedUser.email}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (activeFilter === 'all' || (activeFilter === 'active' ? item.status === 'ACTIVE' : item.status === 'RETURNED'));
  });
  const submitAssignment = async (values: { assetId: string; userId: string; notes?: string; conditionAtAssignment?: AssetCondition }) => {
    try {
      await assignAsset(values.assetId, {
        userId: values.userId,
        notes: values.notes,
        conditionAtAssignment: values.conditionAtAssignment,
      });
      message.success('Đã phân công tài sản');
      setAssignOpen(false);
      form.resetFields();
      await load();
    } catch (e) { message.error(errorText(e, 'Không thể phân công tài sản')); }
  };
  const confirmReturn = (item: AssetAssignmentRecord) => {
    setReturning(item);
  };
  const submitReturn = async (values: { conditionAtReturn?: AssetCondition; notes?: string }) => {
    if (!returning) return;
    try {
      await returnAsset(returning.assetId, values);
      message.success('Đã nhận lại tài sản');
      setReturning(null);
      returnForm.resetFields();
      await load();
    } catch (e) { message.error(errorText(e, 'Không thể nhận lại tài sản')); }
  };
  const columns: ColumnsType<AssetAssignmentRecord> = [
    { title: 'Tài sản', render: (_, item) => {
      const asset = item.asset ?? assetById.get(item.assetId);
      return <><strong>{asset?.code ?? '—'}</strong><br />{asset?.name ?? item.assetId}</>;
    } },
    { title: 'Người nhận', render: (_, item) => <>{item.assignedUser.fullName}<br /><Typography.Text type="secondary">{item.assignedUser.email}</Typography.Text></> },
    { title: 'Người cấp', render: (_, item) => item.assignedBy?.fullName ?? '—' },
    { title: 'Ngày cấp', dataIndex: 'assignedDate', render: dateText },
    { title: 'Ngày trả', dataIndex: 'returnDate', render: dateText },
    { title: 'Tình trạng lúc cấp', render: (_, item) => item.conditionAtAssignment ? conditionLabels[item.conditionAtAssignment] : '—' },
    { title: 'Tình trạng lúc trả', render: (_, item) => item.conditionAtReturn ? conditionLabels[item.conditionAtReturn] : '—' },
    { title: 'Ghi chú thu hồi', dataIndex: 'returnNotes', render: (value) => value || '—' },
    { title: 'Trạng thái', render: (_, item) => <Tag color={item.status === 'ACTIVE' ? 'blue' : 'default'}>{item.status === 'ACTIVE' ? 'Đang sử dụng' : 'Đã trả'}</Tag> },
    ...(isAdmin ? [{ title: 'Thao tác', render: (_: unknown, item: AssetAssignmentRecord) => item.status === 'ACTIVE' ? <Button icon={<CheckCircleOutlined />} onClick={() => confirmReturn(item)}>Nhận lại</Button> : null }] : []),
  ];
  return <div className="iw-stack">
    <PageHeader title="Theo dõi phân công tài sản" subtitle={isAdmin ? 'Quản lý bàn giao và nhận lại tài sản' : 'Giám sát lịch sử bàn giao tài sản'} actions={<>
      <Button icon={<ReloadOutlined />} onClick={() => void load()}>Làm mới</Button>
      {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={() => setAssignOpen(true)}>Phân công</Button>}
    </>} />
    {error && <Alert type="error" showIcon message="Không tải được dữ liệu" description={error} action={<Button size="small" onClick={() => void load()}>Thử lại</Button>} />}
    <Card>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search allowClear value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tài sản hoặc người nhận" style={{ width: 320 }} />
        <Select value={activeFilter} onChange={setActiveFilter} style={{ width: 170 }} options={[
          { value: 'all', label: 'Tất cả trạng thái' },
          { value: 'active', label: 'Đang sử dụng' },
          { value: 'returned', label: 'Đã trả' },
        ]} />
      </Space>
      <Table rowKey="id" columns={columns} dataSource={filtered} loading={loading} pagination={{ pageSize: 10 }} locale={{ emptyText: 'Chưa có lịch sử phân công' }} />
    </Card>
    <Modal title="Phân công tài sản" open={assignOpen} onCancel={() => setAssignOpen(false)} footer={null} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={submitAssignment}>
        <Form.Item name="assetId" label="Tài sản" rules={[{ required: true, message: 'Chọn tài sản' }]}>
          <Select showSearch optionFilterProp="label" options={assets.filter((asset) => asset.status === 'AVAILABLE').map((asset) => ({ value: asset.id, label: `${asset.code} · ${asset.name}` }))} />
        </Form.Item>
        <Form.Item name="userId" label="Người nhận" rules={[{ required: true, message: 'Chọn người nhận' }]}>
          <Select showSearch optionFilterProp="label" options={users.map((item) => ({ value: item.id, label: `${item.fullName} (${item.email})` }))} />
        </Form.Item>
        <Form.Item name="conditionAtAssignment" label="Tình trạng lúc bàn giao">
          <Select allowClear options={Object.entries(conditionLabels).map(([value, label]) => ({ value, label }))} />
        </Form.Item>
        <Form.Item name="notes" label="Ghi chú"><Input.TextArea rows={3} /></Form.Item>
        <Button type="primary" htmlType="submit">Xác nhận phân công</Button>
      </Form>
    </Modal>
    <Modal title="Nhận lại tài sản" open={Boolean(returning)} onCancel={() => { setReturning(null); returnForm.resetFields(); }} footer={null} destroyOnHidden>
      <Form form={returnForm} layout="vertical" onFinish={submitReturn}>
        <Typography.Paragraph>
          {(returning?.asset ?? assetById.get(returning?.assetId ?? ''))?.code ?? 'Tài sản'} — {returning?.assignedUser.fullName}
        </Typography.Paragraph>
        <Form.Item name="conditionAtReturn" label="Tình trạng lúc thu hồi">
          <Select allowClear options={Object.entries(conditionLabels).map(([value, label]) => ({ value, label }))} />
        </Form.Item>
        <Form.Item name="notes" label="Ghi chú"><Input.TextArea rows={3} /></Form.Item>
        <Button type="primary" htmlType="submit">Xác nhận thu hồi</Button>
      </Form>
    </Modal>
  </div>;
}

export function AssetMaintenancePage() {
  const { user } = useAuth();
  const canManage = user?.roles.some((role) => role === 'ADMIN' || role === 'TECHNICIAN') ?? false;
  const [records, setRecords] = useState<AssetMaintenanceRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<MaintenanceStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<AssetMaintenanceType | ''>('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AssetMaintenanceRecord | null>(null);
  const [form] = Form.useForm();
  const [updateForm] = Form.useForm();
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [maintenanceData, assetData] = await Promise.all([getAllAssetMaintenance(), getAllAssets()]);
      setRecords(maintenanceData);
      setAssets(assetData);
      setError('');
    } catch (e) { setError(errorText(e, 'Không tải được lịch sử bảo trì')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const filtered = records.filter((item) => {
    const asset = item.asset ?? assetById.get(item.assetId);
    return `${asset?.code ?? ''} ${asset?.name ?? ''} ${item.title} ${item.description ?? ''} ${item.diagnosis ?? ''} ${item.resolution ?? ''}`.toLowerCase().includes(query.toLowerCase())
      && (!status || item.status === status)
      && (!typeFilter || item.type === typeFilter);
  });
  const submit = async (values: {
    assetId: string;
    type: AssetMaintenanceType;
    title: string;
    description?: string;
    diagnosis?: string;
    resolution?: string;
    notes?: string;
    provider?: string;
    scheduledAt?: string;
    cost?: number;
  }) => {
    try {
      await createAssetMaintenance(values.assetId, {
        type: values.type,
        title: values.title,
        description: values.description,
        diagnosis: values.diagnosis,
        resolution: values.resolution,
        notes: values.notes,
        provider: values.provider,
        scheduledAt: values.scheduledAt || undefined,
        cost: values.cost,
      });
      message.success('Đã tạo lịch bảo trì');
      setOpen(false);
      form.resetFields();
      await load();
    } catch (e) { message.error(errorText(e, 'Không thể tạo lịch bảo trì')); }
  };
  const startEditing = (record: AssetMaintenanceRecord) => {
    setEditing(record);
    updateForm.setFieldsValue({
      status: record.status,
      description: record.description,
      diagnosis: record.diagnosis,
      resolution: record.resolution,
      notes: record.notes,
      provider: record.provider,
      cost: record.cost ?? undefined,
    });
  };
  const submitUpdate = async (values: {
    status: MaintenanceStatus;
    description?: string;
    diagnosis?: string;
    resolution?: string;
    notes?: string;
    provider?: string;
    cost?: number;
  }) => {
    if (!editing) return;
    try {
      await updateAssetMaintenance(editing.assetId, editing.id, values);
      message.success('Đã cập nhật lịch bảo trì');
      setEditing(null);
      updateForm.resetFields();
      await load();
    } catch (e) { message.error(errorText(e, 'Không thể cập nhật lịch bảo trì')); }
  };
  const columns: ColumnsType<AssetMaintenanceRecord> = [
    { title: 'Tài sản', render: (_, item) => {
      const asset = item.asset ?? assetById.get(item.assetId);
      return <><strong>{asset?.code ?? '—'}</strong><br />{asset?.name ?? item.assetId}</>;
    } },
    { title: 'Loại', dataIndex: 'type', render: (value: AssetMaintenanceType) => maintenanceTypeLabels[value] },
    { title: 'Nội dung', render: (_, item) => <><strong>{item.title}</strong>{item.description && <><br /><Typography.Text type="secondary">{item.description}</Typography.Text></>}</> },
    { title: 'Chẩn đoán', dataIndex: 'diagnosis', render: (value) => value || '—' },
    { title: 'Kết quả xử lý', dataIndex: 'resolution', render: (value) => value || '—' },
    { title: 'Đơn vị thực hiện', dataIndex: 'provider', render: (value) => value || '—' },
    { title: 'Lịch dự kiến', dataIndex: 'scheduledAt', render: dateText },
    { title: 'Hoàn tất lúc', dataIndex: 'completedAt', render: dateText },
    { title: 'Trạng thái', dataIndex: 'status', render: (value: MaintenanceStatus) => <Tag color={value === 'COMPLETED' ? 'green' : value === 'CANCELLED' ? 'default' : 'orange'}>{maintenanceStatusLabels[value]}</Tag> },
    ...(canManage ? [{ title: 'Cập nhật', render: (_: unknown, item: AssetMaintenanceRecord) => !['COMPLETED', 'CANCELLED'].includes(item.status)
      ? <Button icon={<EditOutlined />} onClick={() => startEditing(item)}>Cập nhật</Button>
      : null }] : []),
  ];
  return <div className="iw-stack">
    <PageHeader title="Bảo trì tài sản" subtitle={canManage ? 'Theo dõi và cập nhật kế hoạch bảo trì' : 'Xem lịch và tiến độ bảo trì tài sản'} actions={<>
      <Button icon={<ReloadOutlined />} onClick={() => void load()}>Làm mới</Button>
      {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Lên lịch bảo trì</Button>}
    </>} />
    {error && <Alert type="error" showIcon message="Không tải được dữ liệu" description={error} action={<Button size="small" onClick={() => void load()}>Thử lại</Button>} />}
    <Card>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search allowClear value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tài sản hoặc nội dung" style={{ width: 320 }} />
        <Select allowClear value={typeFilter || undefined} placeholder="Tất cả loại" style={{ width: 180 }} onChange={(value) => setTypeFilter(value ?? '')} options={Object.entries(maintenanceTypeLabels).map(([value, label]) => ({ value, label }))} />
        <Select allowClear value={status || undefined} placeholder="Tất cả trạng thái" style={{ width: 180 }} onChange={(value) => setStatus(value ?? '')} options={Object.entries(maintenanceStatusLabels).map(([value, label]) => ({ value, label }))} />
      </Space>
      <Table rowKey="id" columns={columns} dataSource={filtered} loading={loading} pagination={{ pageSize: 10 }} locale={{ emptyText: 'Chưa có lịch bảo trì' }} />
    </Card>
    <Modal title="Lên lịch bảo trì" open={open} onCancel={() => setOpen(false)} footer={null} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="assetId" label="Tài sản" rules={[{ required: true, message: 'Chọn tài sản' }]}>
          <Select showSearch optionFilterProp="label" options={assets.filter((asset) => !['ASSIGNED', 'RETIRED', 'DISPOSED', 'LOST'].includes(asset.status)).map((asset) => ({ value: asset.id, label: `${asset.code} · ${asset.name}` }))} />
        </Form.Item>
        <Form.Item name="type" label="Loại công việc" rules={[{ required: true, message: 'Chọn loại công việc' }]}>
          <Select options={Object.entries(maintenanceTypeLabels).map(([value, label]) => ({ value, label }))} />
        </Form.Item>
        <Form.Item name="title" label="Nội dung bảo trì" rules={[{ required: true, message: 'Nhập nội dung bảo trì' }]}><Input /></Form.Item>
        <Form.Item name="description" label="Mô tả"><Input.TextArea rows={3} /></Form.Item>
        <Form.Item name="diagnosis" label="Chẩn đoán"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="resolution" label="Kết quả xử lý"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="notes" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="provider" label="Đơn vị thực hiện"><Input /></Form.Item>
        <Row gutter={12}><Col span={12}><Form.Item name="scheduledAt" label="Thời gian dự kiến"><Input type="datetime-local" /></Form.Item></Col><Col span={12}><Form.Item name="cost" label="Chi phí"><Input type="number" min={0} step="0.01" /></Form.Item></Col></Row>
        <Button type="primary" htmlType="submit">Lưu lịch bảo trì</Button>
      </Form>
    </Modal>
    <Modal title="Cập nhật công việc bảo trì" open={Boolean(editing)} onCancel={() => { setEditing(null); updateForm.resetFields(); }} footer={null} destroyOnHidden>
      <Form form={updateForm} layout="vertical" onFinish={submitUpdate}>
        <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
          <Select options={(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as MaintenanceStatus[]).map((value) => ({ value, label: maintenanceStatusLabels[value] }))} />
        </Form.Item>
        <Form.Item name="description" label="Mô tả"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="diagnosis" label="Chẩn đoán"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="resolution" label="Kết quả xử lý"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="notes" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="provider" label="Đơn vị thực hiện"><Input /></Form.Item>
        <Form.Item name="cost" label="Chi phí"><Input type="number" min={0} step="0.01" /></Form.Item>
        <Button type="primary" htmlType="submit">Lưu cập nhật</Button>
      </Form>
    </Modal>
  </div>;
}

export function AssetHistoryPage() {
  const [records, setRecords] = useState<AssetHistoryRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<AssetHistoryRecord | null>(null);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [assetId, setAssetId] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [historyData, assetData] = await Promise.all([getAllAssetHistory(), getAllAssets()]);
      setRecords(historyData);
      setAssets(assetData);
      setError('');
    } catch (e) { setError(errorText(e, 'Không tải được lịch sử tài sản')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const filtered = records.filter((item) => {
    const asset = item.asset ?? assetById.get(item.assetId);
    const date = item.createdAt.slice(0, 10);
    return `${asset?.code ?? ''} ${asset?.name ?? ''} ${item.type} ${item.description} ${item.actor?.fullName ?? ''}`.toLowerCase().includes(query.toLowerCase())
      && (!assetId || item.assetId === assetId)
      && (!action || item.type === action)
      && (!dateFrom || date >= dateFrom)
      && (!dateTo || date <= dateTo);
  });
  const columns: ColumnsType<AssetHistoryRecord> = [
    { title: 'Thời gian', dataIndex: 'createdAt', render: historyDateTimeText },
    { title: 'Tài sản', render: (_, item) => {
      const asset = item.asset ?? assetById.get(item.assetId);
      return asset
        ? <><strong>{cleanHistoryText(asset.code) || '—'}</strong><br />{cleanHistoryText(asset.name) || 'Không xác định'}</>
        : 'Không xác định';
    } },
    { title: 'Sự kiện', dataIndex: 'type', render: (value: string) => <Tag>{historyActionLabel(value)}</Tag> },
    { title: 'Chi tiết', ellipsis: true, render: (_, item) => {
      const activity = formatHistoryActivity(item);
      return <Tooltip title={activity.summary}>
        <Button type="link" style={{ padding: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => setSelectedRecord(item)}>
          {activity.summary}
        </Button>
      </Tooltip>;
    } },
    { title: 'Người thực hiện', render: (_, item) => cleanHistoryText(item.actor?.fullName) || '—' },
  ];
  return <div className="iw-stack">
    <PageHeader title="Lịch sử tài sản" subtitle="Nhật ký tạo mới, thay đổi trạng thái, phân công và bảo trì" actions={<Button icon={<ReloadOutlined />} onClick={() => void load()}>Làm mới</Button>} />
    {error && <Alert type="error" showIcon message="Không tải được dữ liệu" description={error} action={<Button size="small" onClick={() => void load()}>Thử lại</Button>} />}
    <Card>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search allowClear value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm mã, tên tài sản hoặc người thực hiện" style={{ width: 300 }} />
        <Select allowClear value={assetId || undefined} onChange={(value) => setAssetId(value ?? '')} placeholder="Tất cả tài sản" style={{ width: 220 }} options={assets.map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` }))} />
        <Select allowClear value={action || undefined} onChange={(value) => setAction(value ?? '')} placeholder="Tất cả hoạt động" style={{ width: 200 }} options={Object.entries(historyActionLabels).map(([value, label]) => ({ value, label }))} />
        <Input aria-label="Từ ngày" title="Từ ngày" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: 160 }} />
        <Input aria-label="Đến ngày" title="Đến ngày" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: 160 }} />
      </Space>
      <Table rowKey="id" columns={columns} dataSource={filtered} loading={loading} pagination={{ pageSize: 10 }} locale={{ emptyText: 'Chưa có lịch sử tài sản' }} />
    </Card>
    <AssetHistoryDetailDrawer
      record={selectedRecord}
      asset={selectedRecord ? selectedRecord.asset ?? assetById.get(selectedRecord.assetId) : undefined}
      onClose={() => setSelectedRecord(null)}
    />
  </div>;
}

export function AssetCategoriesPage() {
  const [items, setItems] = useState<AssetCategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AssetCategoryRecord | null>(null);
  const [form] = Form.useForm<{ name: string; description?: string }>();
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await getAssetCategories()); setError(''); }
    catch (e) { setError(errorText(e, 'Không tải được danh mục tài sản')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const save = async (values: { name: string; description?: string }) => {
    try {
      if (editing) await updateAssetCategory(editing.id, values);
      else await createAssetCategory(values);
      message.success(editing ? 'Đã cập nhật danh mục' : 'Đã tạo danh mục');
      setOpen(false);
      setEditing(null);
      form.resetFields();
      await load();
    } catch (e) { message.error(errorText(e, 'Không thể lưu danh mục')); }
  };
  const toggleActive = (item: AssetCategoryRecord) => {
    const active = !item.active;
    Modal.confirm({
      title: active ? 'Kích hoạt danh mục?' : 'Ngừng sử dụng danh mục?',
      content: `${item.name} (${item.assetCount} tài sản)`,
      okText: 'Xác nhận',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await updateAssetCategory(item.id, { active });
          message.success(active ? 'Đã kích hoạt danh mục' : 'Đã ngừng danh mục');
          await load();
        } catch (e) {
          message.error(errorText(e, 'Không thể cập nhật danh mục'));
          throw e;
        }
      },
    });
  };
  const columns: ColumnsType<AssetCategoryRecord> = [
    { title: 'Tên danh mục', dataIndex: 'name' },
    { title: 'Số tài sản', dataIndex: 'assetCount' },
    { title: 'Trạng thái', dataIndex: 'active', render: (active) => <Tag color={active ? 'green' : 'default'}>{active ? 'Đang dùng' : 'Ngừng dùng'}</Tag> },
    { title: 'Thao tác', render: (_, item) => <Space>
      <Button icon={<EditOutlined />} onClick={() => { setEditing(item); form.setFieldsValue({ name: item.name, description: item.description ?? undefined }); setOpen(true); }}>Sửa</Button>
      <Button danger={item.active} icon={item.active ? <StopOutlined /> : <CheckCircleOutlined />} onClick={() => toggleActive(item)}>{item.active ? 'Ngừng dùng' : 'Kích hoạt'}</Button>
    </Space> },
  ];
  return <div className="iw-stack">
    <PageHeader title="Danh mục tài sản" subtitle="Quản lý phân loại thiết bị CNTT" actions={<>
      <Button icon={<ReloadOutlined />} onClick={() => void load()}>Làm mới</Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>Thêm danh mục</Button>
    </>} />
    {error && <Alert type="error" showIcon message="Không tải được danh mục" description={error} />}
    <Card><Table rowKey="id" columns={columns} dataSource={items} loading={loading} pagination={{ pageSize: 10 }} locale={{ emptyText: 'Chưa có danh mục tài sản' }} /></Card>
    <Modal title={editing ? 'Chỉnh sửa danh mục' : 'Thêm danh mục'} open={open} onCancel={() => { setOpen(false); setEditing(null); }} footer={null} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={save}>
        <Form.Item name="name" label="Tên danh mục" rules={[{ required: true, message: 'Nhập tên danh mục' }]}><Input /></Form.Item>
        <Form.Item name="description" label="Mô tả"><Input.TextArea rows={3} /></Form.Item>
        <Button type="primary" htmlType="submit">Lưu danh mục</Button>
      </Form>
    </Modal>
  </div>;
}
