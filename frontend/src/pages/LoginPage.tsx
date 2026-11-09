
import {
  Button,
  Checkbox,
  Divider,
  Form,
  Input,
  Typography,
  message,
} from "antd";

import "./LoginPage.css";

interface LoginFormValues {
  email: string;
  password: string;
  remember: boolean;
}

function LoginPage() {
  const [messageApi, contextHolder] = message.useMessage();

  // Xử lý đăng nhập
  const handleLogin = (values: LoginFormValues) => {
    console.log("Login information:", values);

    messageApi.info(
      "Giao diện đã hoạt động. Đang chờ tích hợp API xác thực."
    );
  };

  // Xử lý quên mật khẩu
  const handleForgotPassword = () => {
    messageApi.info(
      "Chức năng khôi phục mật khẩu sẽ được tích hợp sau."
    );
  };

  // Xử lý đăng nhập Google
  const handleGoogleLogin = () => {
    messageApi.info(
      "Đăng nhập Google sẽ được tích hợp với Firebase Auth."
    );
  };

  return (
    <div className="login-container">
      {contextHolder}

      {/* LEFT PANEL */}
      <section className="login-intro">
        <div className="intro-content">

          <div className="brand">
            <div className="brand-logo">IT</div>

            <span className="brand-name">
              IT HELPDESK
            </span>
          </div>

          <div className="intro-main">
            <span className="intro-tag">
              IT SERVICE MANAGEMENT
            </span>

            <h1>
              Your IT Support,
              <br />
              <span>Made Simple.</span>
            </h1>

            <p className="intro-description">
              Hệ thống quản lý và hỗ trợ dịch vụ CNTT.
              Tiếp nhận yêu cầu, theo dõi tiến độ và kết nối
              với đội ngũ kỹ thuật một cách nhanh chóng.
            </p>

            <div className="intro-features">

              <div className="feature-item">
                <div className="feature-icon">01</div>
                <div>
                  <h3>Easy Request</h3>
                  <p>Tạo yêu cầu hỗ trợ dễ dàng</p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon">02</div>
                <div>
                  <h3>Real-time Tracking</h3>
                  <p>Theo dõi trạng thái Ticket</p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon">03</div>
                <div>
                  <h3>Technical Support</h3>
                  <p>Kết nối với đội ngũ kỹ thuật</p>
                </div>
              </div>

            </div>
          </div>

          <div className="intro-footer">
            <span className="status-dot" />
            IT Support System

            <span className="footer-year">
              © 2026 IT Helpdesk
            </span>
          </div>

        </div>
      </section>

      {/* RIGHT PANEL */}
      <section className="login-form-section">

        <div className="mobile-brand">
          <div className="brand-logo">IT</div>
          <span className="brand-name">
            IT HELPDESK
          </span>
        </div>

        <div className="login-form-wrapper">

          <div className="welcome-text">
            <span className="welcome-label">
              WELCOME BACK
            </span>

            <Typography.Title level={2}>
              Sign in to your account
            </Typography.Title>

            <Typography.Paragraph>
              Vui lòng nhập thông tin để truy cập hệ thống.
            </Typography.Paragraph>
          </div>

          <Form<LoginFormValues>
            layout="vertical"
            requiredMark={false}
            initialValues={{
              remember: true,
            }}
            onFinish={handleLogin}
            className="login-form"
          >

            <Form.Item
              label="Email Address"
              name="email"
              rules={[
                {
                  required: true,
                  message: "Vui lòng nhập email!",
                },
                {
                  type: "email",
                  message: "Email không hợp lệ!",
                },
              ]}
            >
              <Input
                size="large"
                placeholder="name@example.com"
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[
                {
                  required: true,
                  message: "Vui lòng nhập mật khẩu!",
                },
              ]}
            >
              <Input.Password
                size="large"
                placeholder="Nhập mật khẩu của bạn"
                autoComplete="current-password"
              />
            </Form.Item>

            <div className="login-options">

              <Form.Item
                name="remember"
                valuePropName="checked"
                noStyle
              >
                <Checkbox className="remember-checkbox">
                  Ghi nhớ đăng nhập
                </Checkbox>
              </Form.Item>

              <button
                type="button"
                className="forgot-password"
                onClick={handleForgotPassword}
              >
                Quên mật khẩu?
              </button>

            </div>

            <Form.Item className="submit-item">
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                className="login-submit"
              >
                Sign In
                <span className="button-arrow">→</span>
              </Button>
            </Form.Item>

          </Form>

          <Divider className="login-divider">
            OR CONTINUE WITH
          </Divider>

          <Button
            block
            size="large"
            className="google-login"
            onClick={handleGoogleLogin}
          >
            <span className="google-icon">G</span>
            Continue with Google
          </Button>

          <div className="login-bottom">
            <Typography.Text>
              IT Helpdesk Management System
            </Typography.Text>

            <p>
              Secure access · Simple support · Better service
            </p>
          </div>

        </div>

      </section>
    </div>
  );
}

export default LoginPage;
