import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Layout,
  Menu,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import type { MenuProps } from "antd";

import "./RequesterLayout.css";

const { Sider, Header, Content } = Layout;

function getSelectedKey(pathname: string): string {
  if (pathname.startsWith("/requester/tickets/new")) {
    return "/requester/tickets/new";
  }
  if (pathname.startsWith("/requester/tickets")) {
    return "/requester/tickets";
  }
  return "/requester";
}

function getPageHeaderMeta(pathname: string): {
  title: string;
  subtitle: string;
} {
  if (pathname.startsWith("/requester/tickets/new")) {
    return {
      title: "Tạo yêu cầu hỗ trợ CNTT (Incident)",
      subtitle:
        "Điền thông tin sự cố để hệ thống tự động xác định mức ưu tiên (Priority Matrix) và phân phối cho bộ phận IT.",
    };
  }
  if (pathname.startsWith("/requester/tickets")) {
    return {
      title: "Ticket của tôi (My Tickets)",
      subtitle:
        "Theo dõi tiến độ xử lý, phản hồi kỹ thuật viên, xác nhận kết quả hoặc mở lại yêu cầu trong 72 giờ.",
    };
  }
  return {
    title: "Trang tổng quan Requester",
    subtitle:
      "Cổng tiếp nhận và theo dõi yêu cầu hỗ trợ CNTT dành cho nhân viên các phòng ban.",
  };
}

function RequesterLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();

  const selectedKey = getSelectedKey(location.pathname);
  const headerMeta = getPageHeaderMeta(location.pathname);

  const menuItems: MenuProps["items"] = [
    {
      key: "/requester",
      label: "Tổng quan Requester",
    },
    {
      key: "/requester/tickets",
      label: "Ticket của tôi",
    },
    {
      key: "/requester/tickets/new",
      label: "Tạo yêu cầu hỗ trợ",
    },
  ];

  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    navigate(key);
  };

  const handleBackToLogin = () => {
    messageApi.info("Chuyển về màn hình Đăng nhập (FE-01).");
    navigate("/login");
  };

  return (
    <Layout className="requester-shell">
      {contextHolder}

      <Sider
        width={260}
        breakpoint="lg"
        collapsedWidth="0"
        className="requester-sider"
      >
        <div className="requester-sider-inner">
          <div>
            <div className="requester-brand">
              <div className="requester-brand-logo">IT</div>
              <div className="requester-brand-text">
                <span className="requester-brand-title">IT HELPDESK</span>
                <span className="requester-brand-subtitle">
                  Requester Portal
                </span>
              </div>
            </div>

            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[selectedKey]}
              items={menuItems}
              onClick={handleMenuClick}
              className="requester-menu"
            />
          </div>

          <div className="requester-sider-footer">
            <div className="requester-user-card">
              <div className="requester-user-avatar">P</div>
              <div className="requester-user-meta">
                <span className="requester-user-name">
                  Phan Thế Phong (Demo)
                </span>
                <span className="requester-user-email">
                  phongpt1123@ut.edu.vn
                </span>
              </div>
            </div>

            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Tag color="processing" style={{ margin: 0 }}>
                Vai trò: REQUESTER (Minh họa)
              </Tag>
              <Button
                size="small"
                block
                ghost
                onClick={handleBackToLogin}
              >
                ← Về trang Đăng nhập
              </Button>
            </Space>
          </div>
        </div>
      </Sider>

      <Layout>
        <Header className="requester-header">
          <div className="requester-header-left">
            <Typography.Title level={4} className="requester-header-title">
              {headerMeta.title}
            </Typography.Title>
            <span className="requester-header-subtitle">
              {headerMeta.subtitle}
            </span>
          </div>

          <Space wrap>
            <Button
              type="primary"
              onClick={() => navigate("/requester/tickets/new")}
            >
              + Tạo Ticket mới
            </Button>
            <Button onClick={handleBackToLogin}>Màn hình Login</Button>
          </Space>
        </Header>

        <Content className="requester-content">
          <Alert
            type="warning"
            showIcon
            className="requester-mock-banner"
            message="Dữ liệu minh họa Tuần 3 – Chưa kết nối API Backend & PostgreSQL"
            description="Giao diện nền tảng FE-01 phục vụ kiểm tra điều hướng, bố cục và biểu mẫu của Requester. Việc xác thực phiên làm việc (/api/v1/auth/*) và lưu/truy vấn Ticket thật (/api/v1/tickets) sẽ được tích hợp ở Tuần 4."
          />

          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default RequesterLayout;
