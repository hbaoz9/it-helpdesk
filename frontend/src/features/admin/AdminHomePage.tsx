import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  LockOutlined,
  MailOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  createAdminCategory,
  createAdminUser,
  getAdminCategories,
  getAdminSlaPolicies,
  getAdminUsers,
  updateAdminCategory,
  updateAdminSlaPolicy,
  updateAdminUser,
} from '../../shared/api/admin';
import { ApiError } from '../../shared/api/client';
import type {
  AdminCategoryRecord,
  AdminSlaPolicyRecord,
  AdminUserRecord,
  RoleCode,
  TicketPriority,
} from '../../shared/api/types';
import { useAuth } from '../../shared/auth/useAuth';
import '../../styles/InternalWorkspace.css';
import './AdminWorkspace.css';

type AdminSection = 'users' | 'categories' | 'sla';

const ROLE_OPTIONS: ReadonlyArray<{
  value: RoleCode;
  label: string;
  color: string;
}> = [
  { value: 'REQUESTER', label: 'Requester (Người yêu cầu)', color: 'blue' },
  { value: 'TECHNICIAN', label: 'Technician (Kỹ thuật viên)', color: 'cyan' },
  {
    value: 'SUPERVISOR',
    label: 'Supervisor (Người điều phối)',
    color: 'purple',
  },
  { value: 'ADMIN', label: 'Administrator (Quản trị viên)', color: 'gold' },
];

const ROLE_TAG_META: Record<RoleCode, { label: string; color: string }> = {
  REQUESTER: { label: 'Requester', color: 'blue' },
  TECHNICIAN: { label: 'Technician', color: 'cyan' },
  SUPERVISOR: { label: 'Supervisor', color: 'purple' },
  ADMIN: { label: 'Administrator', color: 'gold' },
};

const SLA_PRIORITY_META: Record<
  TicketPriority,
  { title: string; className: string; desc: string }
> = {
  P1: {
    title: 'P1 — Critical',
    className: 'adm-sla-badge adm-sla-p1',
    desc: 'Sự cố nghiêm trọng diện rộng (Impact High × Urgency High)',
  },
  P2: {
    title: 'P2 — High',
    className: 'adm-sla-badge adm-sla-p2',
    desc: 'Sự cố ưu tiên cao ảnh hưởng trực tiếp công việc',
  },
  P3: {
    title: 'P3 — Medium',
    className: 'adm-sla-badge adm-sla-p3',
    desc: 'Sự cố mức trung bình hoặc có phương án tạm thời',
  },
  P4: {
    title: 'P4 — Low',
    className: 'adm-sla-badge adm-sla-p4',
    desc: 'Sự cố nhỏ hoặc yêu cầu hỗ trợ thông thường',
  },
};

function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} phút`;
  }
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours} giờ (${minutes}p)` : `${hours}h ${rem}p`;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

interface CreateUserFormValues {
  fullName: string;
  email: string;
  password: string;
  roles: RoleCode[];
  active: boolean;
}

interface EditUserFormValues {
  fullName: string;
  roles: RoleCode[];
  active: boolean;
  password?: string;
}

interface CategoryFormValues {
  name: string;
  active: boolean;
}

interface SlaFormValues {
  responseMinutes: number;
  resolutionMinutes: number;
  reason?: string;
}

export default function AdminHomePage() {
  const { user: currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();

  const activeSection: AdminSection = useMemo(() => {
    if (location.pathname.endsWith('/categories')) return 'categories';
    if (location.pathname.endsWith('/sla')) return 'sla';
    return 'users';
  }, [location.pathname]);

  // Users state
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<RoleCode | ''>('');
  const [userActiveFilter, setUserActiveFilter] = useState<
    'true' | 'false' | ''
  >('');

  // Categories state
  const [categories, setCategories] = useState<AdminCategoryRecord[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryActiveFilter, setCategoryActiveFilter] = useState<
    'true' | 'false' | ''
  >('');

  // SLA Policies state
  const [slaPolicies, setSlaPolicies] = useState<AdminSlaPolicyRecord[]>([]);
  const [slaLoading, setSlaLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);
  const [userSubmitting, setUserSubmitting] = useState(false);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<AdminCategoryRecord | null>(null);
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  const [editingSla, setEditingSla] = useState<AdminSlaPolicyRecord | null>(
    null,
  );
  const [slaSubmitting, setSlaSubmitting] = useState(false);

  const [createUserForm] = Form.useForm<CreateUserFormValues>();
  const [editUserForm] = Form.useForm<EditUserFormValues>();
  const [categoryForm] = Form.useForm<CategoryFormValues>();
  const [slaForm] = Form.useForm<SlaFormValues>();

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const data = await getAdminUsers({
        search: userSearch,
        role: userRoleFilter,
        active: userActiveFilter,
      });
      setUsers(data);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Không thể tải danh sách tài khoản.',
      );
    } finally {
      setUsersLoading(false);
    }
  }, [userSearch, userRoleFilter, userActiveFilter]);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const data = await getAdminCategories({
        search: categorySearch,
        active: categoryActiveFilter,
      });
      setCategories(data);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Không thể tải danh mục sự cố.',
      );
    } finally {
      setCategoriesLoading(false);
    }
  }, [categorySearch, categoryActiveFilter]);

  const loadSlaPolicies = useCallback(async () => {
    setSlaLoading(true);
    try {
      const data = await getAdminSlaPolicies();
      setSlaPolicies(data);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Không thể tải cấu hình SLA.',
      );
    } finally {
      setSlaLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getAdminUsers({
      search: userSearch,
      role: userRoleFilter,
      active: userActiveFilter,
    })
      .then((data) => {
        if (active) {
          setUsers(data);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Không thể tải danh sách tài khoản.',
          );
        }
      })
      .finally(() => {
        if (active) setUsersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userSearch, userRoleFilter, userActiveFilter]);

  useEffect(() => {
    let active = true;
    getAdminCategories({
      search: categorySearch,
      active: categoryActiveFilter,
    })
      .then((data) => {
        if (active) {
          setCategories(data);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Không thể tải danh mục sự cố.',
          );
        }
      })
      .finally(() => {
        if (active) setCategoriesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [categorySearch, categoryActiveFilter]);

  useEffect(() => {
    let active = true;
    getAdminSlaPolicies()
      .then((data) => {
        if (active) {
          setSlaPolicies(data);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Không thể tải cấu hình SLA.',
          );
        }
      })
      .finally(() => {
        if (active) setSlaLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleTabChange = (key: string) => {
    if (key === 'categories') {
      navigate('/admin/categories');
    } else if (key === 'sla') {
      navigate('/admin/sla');
    } else {
      navigate('/admin/users');
    }
  };

  // User handlers
  const openCreateUserModal = () => {
    createUserForm.setFieldsValue({
      fullName: '',
      email: '',
      password: '',
      roles: ['REQUESTER'],
      active: true,
    });
    setCreateUserOpen(true);
  };

  const handleCreateUser = async (values: CreateUserFormValues) => {
    setUserSubmitting(true);
    try {
      const created = await createAdminUser(values);
      messageApi.success(`Đã cấp tài khoản nội bộ cho ${created.email}`);
      setCreateUserOpen(false);
      createUserForm.resetFields();
      await loadUsers();
    } catch (cause) {
      messageApi.error(
        cause instanceof ApiError
          ? cause.message
          : 'Không thể tạo tài khoản mới.',
      );
    } finally {
      setUserSubmitting(false);
    }
  };

  const openEditUserModal = (record: AdminUserRecord) => {
    setEditingUser(record);
    editUserForm.setFieldsValue({
      fullName: record.fullName,
      roles: record.roles,
      active: record.active,
      password: '',
    });
  };

  const handleEditUser = async (values: EditUserFormValues) => {
    if (!editingUser) return;
    setUserSubmitting(true);
    try {
      const payload = {
        fullName: values.fullName,
        roles: values.roles,
        active: values.active,
        ...(values.password && values.password.trim().length > 0
          ? { password: values.password }
          : {}),
      };
      const updated = await updateAdminUser(editingUser.id, payload);
      messageApi.success(`Đã cập nhật tài khoản ${updated.email}`);
      setEditingUser(null);
      await loadUsers();
    } catch (cause) {
      messageApi.error(
        cause instanceof ApiError
          ? cause.message
          : 'Không thể cập nhật tài khoản.',
      );
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleToggleUserActive = async (record: AdminUserRecord) => {
    if (record.id === currentUser?.id) {
      messageApi.warning(
        'Không thể tự vô hiệu hóa tài khoản Administrator đang đăng nhập.',
      );
      return;
    }
    try {
      const updated = await updateAdminUser(record.id, {
        active: !record.active,
      });
      messageApi.success(
        updated.active
          ? `Đã kích hoạt tài khoản ${updated.email}`
          : `Đã vô hiệu hóa tài khoản ${updated.email} và thu hồi phiên đăng nhập`,
      );
      await loadUsers();
    } catch (cause) {
      messageApi.error(
        cause instanceof ApiError
          ? cause.message
          : 'Không thể thay đổi trạng thái tài khoản.',
      );
    }
  };

  // Category handlers
  const openCreateCategoryModal = () => {
    setEditingCategory(null);
    categoryForm.setFieldsValue({
      name: '',
      active: true,
    });
    setCategoryModalOpen(true);
  };

  const openEditCategoryModal = (record: AdminCategoryRecord) => {
    setEditingCategory(record);
    categoryForm.setFieldsValue({
      name: record.name,
      active: record.active,
    });
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async (values: CategoryFormValues) => {
    setCategorySubmitting(true);
    try {
      if (editingCategory) {
        const updated = await updateAdminCategory(editingCategory.id, values);
        messageApi.success(`Đã cập nhật danh mục "${updated.name}"`);
      } else {
        const created = await createAdminCategory(values);
        messageApi.success(`Đã thêm danh mục "${created.name}"`);
      }
      setCategoryModalOpen(false);
      setEditingCategory(null);
      await loadCategories();
    } catch (cause) {
      messageApi.error(
        cause instanceof ApiError
          ? cause.message
          : 'Không thể lưu danh mục sự cố.',
      );
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleToggleCategoryActive = async (record: AdminCategoryRecord) => {
    try {
      const updated = await updateAdminCategory(record.id, {
        active: !record.active,
      });
      messageApi.success(
        updated.active
          ? `Đã kích hoạt lại danh mục "${updated.name}"`
          : `Đã vô hiệu hóa danh mục "${updated.name}"`,
      );
      await loadCategories();
    } catch (cause) {
      messageApi.error(
        cause instanceof ApiError
          ? cause.message
          : 'Không thể cập nhật trạng thái danh mục.',
      );
    }
  };

  // SLA handlers
  const openEditSlaModal = (record: AdminSlaPolicyRecord) => {
    setEditingSla(record);
    slaForm.setFieldsValue({
      responseMinutes: record.responseMinutes,
      resolutionMinutes: record.resolutionMinutes,
      reason: '',
    });
  };

  const handleSaveSla = async (values: SlaFormValues) => {
    if (!editingSla) return;
    setSlaSubmitting(true);
    try {
      const updated = await updateAdminSlaPolicy(editingSla.id, values);
      messageApi.success(
        `Đã cập nhật SLA ${updated.priority} (Phiên bản v${updated.revision})`,
      );
      setEditingSla(null);
      await loadSlaPolicies();
    } catch (cause) {
      messageApi.error(
        cause instanceof ApiError
          ? cause.message
          : 'Không thể cập nhật chính sách SLA.',
      );
    } finally {
      setSlaSubmitting(false);
    }
  };

  // Table columns
  const userColumns: ColumnsType<AdminUserRecord> = [
    {
      title: 'Tài khoản nội bộ',
      key: 'user',
      render: (_, record) => (
        <div className="adm-user-cell">
          <span className="adm-user-name">
            {record.fullName}{' '}
            {record.id === currentUser?.id && (
              <Tag color="geekblue" style={{ marginLeft: 6 }}>
                Bạn
              </Tag>
            )}
          </span>
          <span className="adm-user-email">{record.email}</span>
        </div>
      ),
    },
    {
      title: 'Vai trò (RBAC)',
      key: 'roles',
      render: (_, record) => (
        <div className="adm-role-tags">
          {record.roles.map((role) => (
            <Tag key={role} color={ROLE_TAG_META[role]?.color ?? 'default'}>
              {ROLE_TAG_META[role]?.label ?? role}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'active',
      width: 170,
      render: (_, record) =>
        record.active ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Đang hoạt động
          </Tag>
        ) : (
          <Tag icon={<StopOutlined />} color="error">
            Đã vô hiệu hóa
          </Tag>
        ),
    },
    {
      title: 'Ngày cấp',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 165,
      render: (val: string) => (
        <span className="iw-muted">{formatDateTime(val)}</span>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 240,
      render: (_, record) => {
        const isSelf = record.id === currentUser?.id;
        return (
          <Space size="small">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditUserModal(record)}
            >
              Phân quyền / Sửa
            </Button>
            <Tooltip
              title={
                isSelf
                  ? 'Không thể tự vô hiệu hóa tài khoản đang đăng nhập'
                  : record.active
                    ? 'Vô hiệu hóa tài khoản & thu hồi phiên'
                    : 'Kích hoạt lại tài khoản'
              }
            >
              <Button
                size="small"
                danger={record.active}
                disabled={isSelf}
                onClick={() => void handleToggleUserActive(record)}
              >
                {record.active ? 'Vô hiệu hóa' : 'Kích hoạt'}
              </Button>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  const categoryColumns: ColumnsType<AdminCategoryRecord> = [
    {
      title: 'Tên danh mục sự cố',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <span className="iw-ticket-title">{name}</span>
      ),
    },
    {
      title: 'Số Ticket liên kết',
      dataIndex: 'ticketCount',
      key: 'ticketCount',
      width: 170,
      render: (count: number) => (
        <Tag color={count > 0 ? 'processing' : 'default'}>
          {count} Ticket
        </Tag>
      ),
    },
    {
      title: 'Trạng thái hiển thị',
      key: 'active',
      width: 180,
      render: (_, record) =>
        record.active ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Đang sử dụng
          </Tag>
        ) : (
          <Tag icon={<StopOutlined />} color="default">
            Đã ngưng (Ẩn ở Form)
          </Tag>
        ),
    },
    {
      title: 'Cập nhật gần nhất',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 170,
      render: (val: string) => (
        <span className="iw-muted">{formatDateTime(val)}</span>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 230,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditCategoryModal(record)}
          >
            Đổi tên
          </Button>
          <Button
            size="small"
            danger={record.active}
            onClick={() => void handleToggleCategoryActive(record)}
          >
            {record.active ? 'Vô hiệu hóa' : 'Kích hoạt'}
          </Button>
        </Space>
      ),
    },
  ];

  const slaColumns: ColumnsType<AdminSlaPolicyRecord> = [
    {
      title: 'Mức ưu tiên (Priority)',
      key: 'priority',
      width: 280,
      render: (_, record) => {
        const meta = SLA_PRIORITY_META[record.priority];
        return (
          <div>
            <span className={meta.className}>{meta.title}</span>
            <div className="adm-user-email" style={{ marginTop: 4 }}>
              {meta.desc}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Hạn phản hồi đầu tiên (First Response)',
      dataIndex: 'responseMinutes',
      key: 'responseMinutes',
      render: (mins: number) => (
        <Tag icon={<ClockCircleOutlined />} color="blue">
          {formatDurationMinutes(mins)}
        </Tag>
      ),
    },
    {
      title: 'Hạn giải quyết (Resolution SLA)',
      dataIndex: 'resolutionMinutes',
      key: 'resolutionMinutes',
      render: (mins: number) => (
        <Tag icon={<ClockCircleOutlined />} color="purple">
          {formatDurationMinutes(mins)}
        </Tag>
      ),
    },
    {
      title: 'Revision',
      dataIndex: 'revision',
      key: 'revision',
      width: 120,
      render: (rev: number) => <Tag color="geekblue">v{rev}</Tag>,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 170,
      render: (_, record) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => openEditSlaModal(record)}
        >
          Điều chỉnh SLA
        </Button>
      ),
    },
  ];

  const activeUsersCount = users.filter((u) => u.active).length;
  const activeCategoriesCount = categories.filter((c) => c.active).length;

  return (
    <div className="iw-stack">
      {contextHolder}

      <div className="adm-header-banner">
        <div>
          <span className="adm-banner-eyebrow">
            QUẢN TRỊ HỆ THỐNG · IDENTITY &amp; MASTER DATA
          </span>
          <Typography.Title level={2} className="adm-banner-title">
            Bảng điều khiển Administrator
          </Typography.Title>
          <p className="adm-banner-desc">
            Cấp phát tài khoản nội bộ, phân quyền RBAC, quản lý danh mục sự cố và
            cấu hình chính sách cam kết SLA 24/7. Theo quy tắc BR-11,
            Administrator không mặc nhiên can thiệp nội dung Ticket.
          </p>
        </div>
        <div className="adm-banner-actions">
          <Button
            type="primary"
            size="large"
            icon={<UserAddOutlined />}
            onClick={openCreateUserModal}
          >
            Cấp tài khoản nội bộ
          </Button>
          <Button
            size="large"
            icon={<PlusOutlined />}
            onClick={openCreateCategoryModal}
          >
            Thêm danh mục sự cố
          </Button>
        </div>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Lỗi tải dữ liệu quản trị"
          description={error}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <div className="iw-card iw-stat">
            <div className="iw-stat-label">Tổng tài khoản nội bộ</div>
            <div className="iw-stat-value is-cyan">{users.length} Tài khoản</div>
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div className="iw-card iw-stat">
            <div className="iw-stat-label">Tài khoản đang hoạt động</div>
            <div className="iw-stat-value is-green">
              {activeUsersCount} Hoạt động
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div className="iw-card iw-stat">
            <div className="iw-stat-label">Danh mục sự cố đang bật</div>
            <div className="iw-stat-value">
              {activeCategoriesCount} / {categories.length} Danh mục
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div className="iw-card iw-stat">
            <div className="iw-stat-label">Chính sách SLA 24/7</div>
            <div className="iw-stat-value is-amber">
              {slaPolicies.length} Mức ưu tiên
            </div>
          </div>
        </Col>
      </Row>

      <div className="iw-card">
        <Tabs
          activeKey={activeSection}
          onChange={handleTabChange}
          items={[
            {
              key: 'users',
              label: (
                <span>
                  <TeamOutlined /> Tài khoản &amp; Phân quyền ({users.length})
                </span>
              ),
              children: (
                <div>
                  <div className="adm-policy-note">
                    <SafetyCertificateOutlined
                      style={{ color: '#2563eb', fontSize: 18, marginTop: 2 }}
                    />
                    <div>
                      <strong>Chính sách Định danh SmartDesk:</strong> Hệ thống
                      không mở đăng ký công khai. Mọi tài khoản nhân viên
                      (Requester), kỹ thuật viên (Technician), điều phối viên
                      (Supervisor) và quản trị viên (Administrator) đều do
                      Administrator cấp phát. Khi vô hiệu hóa tài khoản, toàn bộ
                      phiên đăng nhập đang mở sẽ bị thu hồi ngay lập tức.
                    </div>
                  </div>

                  <div className="adm-toolbar">
                    <div className="adm-filters">
                      <Input
                        allowClear
                        prefix={<SearchOutlined />}
                        placeholder="Tìm theo họ tên hoặc email..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="adm-search-input"
                      />
                      <Select<RoleCode | ''>
                        value={userRoleFilter}
                        onChange={(val) => setUserRoleFilter(val)}
                        style={{ width: 210 }}
                        options={[
                          { value: '', label: 'Tất cả vai trò' },
                          ...ROLE_OPTIONS.map((r) => ({
                            value: r.value,
                            label: r.label,
                          })),
                        ]}
                      />
                      <Select<'true' | 'false' | ''>
                        value={userActiveFilter}
                        onChange={(val) => setUserActiveFilter(val)}
                        style={{ width: 180 }}
                        options={[
                          { value: '', label: 'Tất cả trạng thái' },
                          { value: 'true', label: 'Đang hoạt động' },
                          { value: 'false', label: 'Đã vô hiệu hóa' },
                        ]}
                      />
                    </div>
                    <Space>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={() => void loadUsers()}
                      >
                        Làm mới
                      </Button>
                      <Button
                        type="primary"
                        icon={<UserAddOutlined />}
                        onClick={openCreateUserModal}
                      >
                        Cấp tài khoản
                      </Button>
                    </Space>
                  </div>

                  <Table<AdminUserRecord>
                    rowKey="id"
                    loading={usersLoading}
                    columns={userColumns}
                    dataSource={users}
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                  />
                </div>
              ),
            },
            {
              key: 'categories',
              label: (
                <span>
                  <AppstoreOutlined /> Danh mục sự cố ({categories.length})
                </span>
              ),
              children: (
                <div>
                  <div className="adm-policy-note">
                    <AppstoreOutlined
                      style={{ color: '#2563eb', fontSize: 18, marginTop: 2 }}
                    />
                    <div>
                      <strong>Ràng buộc Toàn vẹn Dữ liệu:</strong> Để bảo toàn
                      lịch sử Ticket (`ON DELETE RESTRICT`), các danh mục đã phát
                      sinh Ticket không bị xóa vật lý khỏi Database. Khi cần
                      ngưng sử dụng một danh mục, hãy chuyển trạng thái sang{' '}
                      <strong>Vô hiệu hóa</strong> để ẩn khỏi biểu mẫu tạo
                      Ticket mới của Requester.
                    </div>
                  </div>

                  <div className="adm-toolbar">
                    <div className="adm-filters">
                      <Input
                        allowClear
                        prefix={<SearchOutlined />}
                        placeholder="Tìm kiếm tên danh mục..."
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        className="adm-search-input"
                      />
                      <Select<'true' | 'false' | ''>
                        value={categoryActiveFilter}
                        onChange={(val) => setCategoryActiveFilter(val)}
                        style={{ width: 190 }}
                        options={[
                          { value: '', label: 'Tất cả trạng thái' },
                          { value: 'true', label: 'Đang sử dụng' },
                          { value: 'false', label: 'Đã ngưng sử dụng' },
                        ]}
                      />
                    </div>
                    <Space>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={() => void loadCategories()}
                      >
                        Làm mới
                      </Button>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openCreateCategoryModal}
                      >
                        Thêm danh mục
                      </Button>
                    </Space>
                  </div>

                  <Table<AdminCategoryRecord>
                    rowKey="id"
                    loading={categoriesLoading}
                    columns={categoryColumns}
                    dataSource={categories}
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                  />
                </div>
              ),
            },
            {
              key: 'sla',
              label: (
                <span>
                  <ClockCircleOutlined /> Chính sách SLA 24/7 (
                  {slaPolicies.length})
                </span>
              ),
              children: (
                <div>
                  <div className="adm-policy-note">
                    <ClockCircleOutlined
                      style={{ color: '#2563eb', fontSize: 18, marginTop: 2 }}
                    />
                    <div>
                      <strong>Cấu hình SLA V1 (Chuẩn bị cho SLA Engine):</strong>{' '}
                      Thời gian SLA được tính liên tục 24/7 từ thời điểm tạo
                      Ticket dựa trên mức Priority (tính từ ma trận Impact ×
                      Urgency 3×3). Mỗi lần điều chỉnh thời hạn sẽ tăng số{' '}
                      <strong>Revision</strong> và tự động ghi nhận vào bảng{' '}
                      <code>audit_logs</code>.
                    </div>
                  </div>

                  <Table<AdminSlaPolicyRecord>
                    rowKey="id"
                    loading={slaLoading}
                    columns={slaColumns}
                    dataSource={slaPolicies}
                    pagination={false}
                  />
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Modal: Cấp tài khoản nội bộ */}
      <Modal
        title="Cấp tài khoản nội bộ mới"
        open={createUserOpen}
        onCancel={() => setCreateUserOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form<CreateUserFormValues>
          form={createUserForm}
          layout="vertical"
          onFinish={(values) => void handleCreateUser(values)}
          initialValues={{ roles: ['REQUESTER'], active: true }}
        >
          <Form.Item
            label="Họ và tên nhân sự"
            name="fullName"
            rules={[
              { required: true, message: 'Vui lòng nhập họ và tên.' },
              { max: 120, message: 'Tối đa 120 ký tự.' },
            ]}
          >
            <Input placeholder="Ví dụ: Nguyễn Văn An" />
          </Form.Item>

          <Form.Item
            label="Email công việc"
            name="email"
            rules={[
              { required: true, message: 'Vui lòng nhập email.' },
              { type: 'email', message: 'Định dạng email không hợp lệ.' },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="ten.nhanvien@helpdesk.local"
            />
          </Form.Item>

          <Form.Item
            label="Mật khẩu khởi tạo (Băm Argon2id)"
            name="password"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu khởi tạo.' },
              {
                min: 12,
                message: 'Mật khẩu nội bộ phải có tối thiểu 12 ký tự.',
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Nhập mật khẩu tối thiểu 12 ký tự"
            />
          </Form.Item>

          <Form.Item
            label="Cấp vai trò (Có thể chọn nhiều vai trò)"
            name="roles"
            rules={[
              {
                required: true,
                message: 'Vui lòng chọn ít nhất 1 vai trò.',
              },
            ]}
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[8, 8]}>
                {ROLE_OPTIONS.map((role) => (
                  <Col span={24} key={role.value}>
                    <Checkbox value={role.value}>{role.label}</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>

          <Form.Item
            label="Trạng thái kích hoạt ngay"
            name="active"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Đang hoạt động"
              unCheckedChildren="Vô hiệu hóa"
            />
          </Form.Item>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 16,
            }}
          >
            <Button onClick={() => setCreateUserOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={userSubmitting}>
              Tạo tài khoản
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal: Chỉnh sửa & Phân quyền tài khoản */}
      <Modal
        title={`Cập nhật tài khoản: ${editingUser?.email ?? ''}`}
        open={Boolean(editingUser)}
        onCancel={() => setEditingUser(null)}
        footer={null}
        destroyOnHidden
      >
        <Form<EditUserFormValues>
          form={editUserForm}
          layout="vertical"
          onFinish={(values) => void handleEditUser(values)}
        >
          <Form.Item
            label="Họ và tên nhân sự"
            name="fullName"
            rules={[
              { required: true, message: 'Vui lòng nhập họ và tên.' },
              { max: 120, message: 'Tối đa 120 ký tự.' },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Phân quyền vai trò (RBAC)"
            name="roles"
            rules={[
              {
                required: true,
                message: 'Tài khoản phải có ít nhất 1 vai trò.',
              },
            ]}
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[8, 8]}>
                {ROLE_OPTIONS.map((role) => (
                  <Col span={24} key={role.value}>
                    <Checkbox
                      value={role.value}
                      disabled={
                        editingUser?.id === currentUser?.id &&
                        role.value === 'ADMIN'
                      }
                    >
                      {role.label}
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>

          <Form.Item
            label="Đặt lại mật khẩu mới (Để trống nếu giữ nguyên)"
            name="password"
            rules={[
              {
                validator: (_, value: string | undefined) => {
                  if (!value || value.length === 0 || value.length >= 12) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error('Mật khẩu mới phải có tối thiểu 12 ký tự.'),
                  );
                },
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Nhập mật khẩu mới nếu người dùng quên mật khẩu"
            />
          </Form.Item>

          <Form.Item
            label="Trạng thái tài khoản"
            name="active"
            valuePropName="checked"
          >
            <Switch
              disabled={editingUser?.id === currentUser?.id}
              checkedChildren="Đang hoạt động"
              unCheckedChildren="Vô hiệu hóa"
            />
          </Form.Item>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 16,
            }}
          >
            <Button onClick={() => setEditingUser(null)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={userSubmitting}>
              Lưu thay đổi
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal: Thêm / Sửa Danh mục sự cố */}
      <Modal
        title={
          editingCategory
            ? `Chỉnh sửa danh mục: ${editingCategory.name}`
            : 'Thêm danh mục sự cố mới'
        }
        open={categoryModalOpen}
        onCancel={() => {
          setCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        footer={null}
        destroyOnHidden
      >
        <Form<CategoryFormValues>
          form={categoryForm}
          layout="vertical"
          onFinish={(values) => void handleSaveCategory(values)}
          initialValues={{ active: true }}
        >
          <Form.Item
            label="Tên danh mục sự cố CNTT"
            name="name"
            rules={[
              { required: true, message: 'Vui lòng nhập tên danh mục.' },
              { max: 120, message: 'Tối đa 120 ký tự.' },
            ]}
          >
            <Input placeholder="Ví dụ: Hệ thống Máy chủ & Cloud" />
          </Form.Item>

          <Form.Item
            label="Trạng thái sử dụng"
            name="active"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Đang sử dụng"
              unCheckedChildren="Vô hiệu hóa"
            />
          </Form.Item>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 16,
            }}
          >
            <Button onClick={() => setCategoryModalOpen(false)}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={categorySubmitting}
            >
              {editingCategory ? 'Cập nhật danh mục' : 'Thêm danh mục'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal: Điều chỉnh chính sách SLA */}
      <Modal
        title={
          editingSla
            ? `Điều chỉnh chính sách SLA — ${SLA_PRIORITY_META[editingSla.priority].title}`
            : 'Điều chỉnh SLA'
        }
        open={Boolean(editingSla)}
        onCancel={() => setEditingSla(null)}
        footer={null}
        destroyOnHidden
      >
        <Form<SlaFormValues>
          form={slaForm}
          layout="vertical"
          onFinish={(values) => void handleSaveSla(values)}
        >
          <Form.Item
            label="Thời hạn phản hồi đầu tiên (Phút)"
            name="responseMinutes"
            rules={[
              {
                required: true,
                message: 'Vui lòng nhập số phút phản hồi.',
              },
            ]}
          >
            <InputNumber min={1} max={10080} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="Thời hạn giải quyết sự cố (Phút)"
            name="resolutionMinutes"
            rules={[
              {
                required: true,
                message: 'Vui lòng nhập số phút giải quyết.',
              },
            ]}
          >
            <InputNumber min={1} max={43200} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="Lý do điều chỉnh (Ghi nhận vào Audit Log)"
            name="reason"
          >
            <Input.TextArea
              rows={3}
              placeholder="Ví dụ: Điều chỉnh cam kết SLA cho giai đoạn vận hành cao điểm"
            />
          </Form.Item>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 16,
            }}
          >
            <Button onClick={() => setEditingSla(null)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={slaSubmitting}>
              Lưu chính sách SLA
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
