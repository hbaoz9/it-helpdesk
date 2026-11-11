import { useState } from "react";
import { Link } from "react-router-dom";
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

type AuthMode = "signin" | "signup" | "google-sso";

interface LoginFormValues {
  email: string;
  password: string;
  remember: boolean;
}

interface SignUpFormValues {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
}

function GoogleIcon() {
  return (
    <svg
      className="google-svg-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.3-2 3l3.2 2.5c1.9-1.7 3-4.3 3-7.4 0-.7-.1-1.4-.2-2H12z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.9v2.6C4.6 19.8 8 22 12 22z"
      />
      <path
        fill="#4A90E2"
        d="M6.2 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V7.6H2.9C2.3 8.9 2 10.4 2 12s.3 3.1.9 4.4l3.3-2.6z"
      />
      <path
        fill="#FBBC05"
        d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9C17 2.9 14.7 2 12 2 8 2 4.6 4.2 2.9 7.6l3.3 2.6C7 7.7 9.3 5.9 12 5.9z"
      />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function LoginPage() {
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [previousMode, setPreviousMode] = useState<"signin" | "signup">("signin");
  const [submitting, setSubmitting] = useState(false);
  const [loginForm] = Form.useForm<LoginFormValues>();
  const [signUpForm] = Form.useForm<SignUpFormValues>();
  const [messageApi, contextHolder] = message.useMessage();

  const handleLogin = (values: LoginFormValues) => {
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      messageApi.info(
        `Đã kiểm tra hợp lệ dữ liệu (${values.email}). Chức năng xác thực phiên làm việc sẽ được kết nối API /api/v1/auth/login ở Tuần 4.`
      );
    }, 400);
  };

  const handleSignUp = (values: SignUpFormValues) => {
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      messageApi.info(
        `Đã kiểm tra thông tin đăng ký cho "${values.username}" (${values.email}). Tính năng tạo tài khoản chưa kết nối Backend trong Tuần 3.`
      );
    }, 400);
  };

  const handleForgotPassword = () => {
    messageApi.info("Chức năng khôi phục mật khẩu sẽ được tích hợp sau.");
  };

  const handleOpenGoogleChooser = (fromMode: "signin" | "signup") => {
    setPreviousMode(fromMode);
    setAuthMode("google-sso");
  };

  const handleSelectGoogleAccount = (email: string) => {
    messageApi.info(
      `Đã chọn tài khoản ${email}. Xác thực SSO/Session thực tế sẽ được tích hợp với Backend ở giai đoạn tiếp theo.`
    );
  };

  const handleUseAnotherAccount = () => {
    setAuthMode("signin");
    messageApi.info("Vui lòng nhập email tài khoản khác tại biểu mẫu đăng nhập.");
  };

  return (
    <div className="auth-page-backdrop">
      {contextHolder}

      {authMode === "google-sso" ? (
        <div className="sso-card" role="region" aria-label="Chọn tài khoản Google">
          {/* SSO LEFT COLUMN */}
          <section className="sso-left">
            <div>
              <div className="sso-brand">
                <div className="brand-logo">IT</div>
                <div className="sso-brand-text">
                  <span className="sso-brand-title">IT HELPDESK</span>
                  <span className="sso-brand-subtitle">Enterprise SSO</span>
                </div>
              </div>

              <h1 className="sso-heading">Chọn tài khoản</h1>
              <p className="sso-description">
                Chọn tài khoản để tiếp tục truy cập{" "}
                <span className="sso-highlight">IT Helpdesk.</span>
              </p>
            </div>

            <div className="sso-left-footer">
              <GoogleIcon />
              <span>Xác thực bảo mật qua Google Identity</span>
            </div>
          </section>

          {/* SSO RIGHT COLUMN */}
          <section className="sso-right">
            <div className="sso-account-list">
              <button
                type="button"
                className="sso-account-item"
                onClick={() =>
                  handleSelectGoogleAccount("phongpt1123@ut.edu.vn")
                }
              >
                <div className="sso-avatar">P</div>
                <div className="sso-account-info">
                  <div className="sso-account-name-row">
                    <span className="sso-account-name">Phong Phan Thế</span>
                    <span className="sso-domain-badge">ut.edu.vn</span>
                  </div>
                  <span className="sso-account-email">
                    phongpt1123@ut.edu.vn
                  </span>
                </div>
              </button>

              <button
                type="button"
                className="sso-account-item sso-another-account"
                onClick={handleUseAnotherAccount}
              >
                <div className="sso-another-icon">
                  <UserPlusIcon />
                </div>
                <span className="sso-another-text">
                  Sử dụng một tài khoản khác
                </span>
              </button>
            </div>

            <div className="sso-policy-box">
              <p className="sso-policy-text">
                Để tiếp tục, Google sẽ chia sẻ tên, địa chỉ email và ảnh hồ sơ
                của bạn với IT Helpdesk.
              </p>
              <div className="sso-policy-links">
                <button
                  type="button"
                  className="sso-link-btn"
                  onClick={() =>
                    messageApi.info("Tài liệu Chính sách quyền riêng tư minh họa.")
                  }
                >
                  Chính sách quyền riêng tư
                </button>
                <span className="sso-dot">•</span>
                <button
                  type="button"
                  className="sso-link-btn"
                  onClick={() =>
                    messageApi.info("Tài liệu Điều khoản dịch vụ minh họa.")
                  }
                >
                  Điều khoản dịch vụ
                </button>
              </div>

              <div className="sso-back-row">
                <button
                  type="button"
                  className="sso-back-btn"
                  onClick={() => setAuthMode(previousMode)}
                >
                  ← Quay lại biểu mẫu{" "}
                  {previousMode === "signin" ? "đăng nhập" : "đăng ký"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div
          className={`login-card ${
            authMode === "signup" ? "login-card-signup" : ""
          }`}
        >
          {/* LEFT PANEL */}
          <section className="login-intro">
            <div className="intro-content">
              <div className="brand">
                <div className="brand-logo">IT</div>
                <span className="brand-name">IT HELPDESK</span>
              </div>

              <div className="intro-main">
                <span className="intro-tag">IT SERVICE MANAGEMENT</span>

                <h1>
                  Your IT Support,
                  <br />
                  <span>Made Simple.</span>
                </h1>

                <p className="intro-description">
                  Hệ thống quản lý và hỗ trợ dịch vụ CNTT. Tiếp nhận yêu cầu,
                  theo dõi tiến độ và kết nối với đội ngũ kỹ thuật một cách
                  nhanh chóng.
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
            </div>
          </section>

          {/* RIGHT PANEL */}
          <section className="login-form-section">
            <div className="mobile-brand">
              <div className="brand-logo">IT</div>
              <span className="brand-name">IT HELPDESK</span>
            </div>

            {authMode === "signin" ? (
              <div className="login-form-wrapper">
                <div className="welcome-text">
                  <span className="welcome-label">WELCOME BACK</span>

                  <Typography.Title level={2}>
                    Sign in to your account
                  </Typography.Title>

                  <Typography.Paragraph>
                    Vui lòng nhập thông tin để truy cập hệ thống.
                  </Typography.Paragraph>
                </div>

                <Form<LoginFormValues>
                  form={loginForm}
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
                        message: "Vui lòng nhập địa chỉ email!",
                      },
                      {
                        type: "email",
                        message: "Định dạng email không hợp lệ!",
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
                      loading={submitting}
                      className="login-submit"
                    >
                      Sign In
                      <span className="button-arrow">→</span>
                    </Button>
                  </Form.Item>
                </Form>

                <Divider className="login-divider">OR CONTINUE WITH</Divider>

                <Button
                  block
                  size="large"
                  className="google-login"
                  onClick={() => handleOpenGoogleChooser("signin")}
                >
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </Button>

                <div className="login-bottom login-bottom-split">
                  <span className="switch-auth-prompt">
                    Chưa có tài khoản?{" "}
                    <button
                      type="button"
                      className="switch-auth-link"
                      onClick={() => setAuthMode("signup")}
                    >
                      Đăng ký
                    </button>
                  </span>

                  <span className="system-caption">
                    IT Helpdesk Management System
                  </span>
                </div>
              </div>
            ) : (
              <div className="login-form-wrapper">
                <div className="welcome-text welcome-text-compact">
                  <span className="welcome-label">START YOUR JOURNEY</span>

                  <Typography.Title level={2}>
                    Create your account
                  </Typography.Title>

                  <Typography.Paragraph>
                    Vui lòng nhập thông tin để đăng ký tài khoản mới.
                  </Typography.Paragraph>
                </div>

                <Form<SignUpFormValues>
                  form={signUpForm}
                  layout="vertical"
                  requiredMark={false}
                  initialValues={{
                    agreeTerms: true,
                  }}
                  onFinish={handleSignUp}
                  className="login-form signup-form"
                >
                  <div className="signup-row-two-cols">
                    <Form.Item
                      label="Tên người dùng"
                      name="username"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng nhập tên người dùng!",
                        },
                      ]}
                    >
                      <Input
                        size="large"
                        placeholder="Nhập tên người dùng"
                        autoComplete="name"
                      />
                    </Form.Item>

                    <Form.Item
                      label="Địa chỉ Email"
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
                        autoComplete="email"
                      />
                    </Form.Item>
                  </div>

                  <Form.Item
                    label="Mật khẩu"
                    name="password"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng nhập mật khẩu!",
                      },
                      {
                        min: 6,
                        message: "Mật khẩu cần tối thiểu 6 ký tự!",
                      },
                    ]}
                  >
                    <Input.Password
                      size="large"
                      placeholder="Nhập mật khẩu của bạn"
                      autoComplete="new-password"
                    />
                  </Form.Item>

                  <Form.Item
                    label="Xác nhận mật khẩu"
                    name="confirmPassword"
                    dependencies={["password"]}
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng xác nhận mật khẩu!",
                      },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue("password") === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(
                            new Error("Mật khẩu xác nhận không khớp!")
                          );
                        },
                      }),
                    ]}
                  >
                    <Input.Password
                      size="large"
                      placeholder="Nhập lại mật khẩu của bạn"
                      autoComplete="new-password"
                    />
                  </Form.Item>

                  <Form.Item
                    name="agreeTerms"
                    valuePropName="checked"
                    className="terms-item"
                    rules={[
                      {
                        validator: (_, value) =>
                          value
                            ? Promise.resolve()
                            : Promise.reject(
                                new Error(
                                  "Vui lòng đồng ý với điều khoản dịch vụ!"
                                )
                              ),
                      },
                    ]}
                  >
                    <Checkbox className="remember-checkbox">
                      Tôi đồng ý với{" "}
                      <span className="terms-highlight">
                        Điều khoản dịch vụ
                      </span>{" "}
                      &amp;{" "}
                      <span className="terms-highlight">
                        Chính sách bảo mật
                      </span>
                    </Checkbox>
                  </Form.Item>

                  <Form.Item className="submit-item">
                    <Button
                      type="primary"
                      htmlType="submit"
                      size="large"
                      block
                      loading={submitting}
                      className="login-submit"
                    >
                      Tạo tài khoản
                      <span className="button-arrow">→</span>
                    </Button>
                  </Form.Item>
                </Form>

                <Divider className="login-divider">OR CONTINUE WITH</Divider>

                <Button
                  block
                  size="large"
                  className="google-login"
                  onClick={() => handleOpenGoogleChooser("signup")}
                >
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </Button>

                <div className="login-bottom login-bottom-split">
                  <span className="switch-auth-prompt">
                    Đã có tài khoản?{" "}
                    <button
                      type="button"
                      className="switch-auth-link"
                      onClick={() => setAuthMode("signin")}
                    >
                      Đăng nhập
                    </button>
                  </span>

                  <span className="system-caption">
                    IT Helpdesk Management System
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Thanh chuyển nhanh sang Requester Portal để phục vụ kiểm thử điều hướng FE-01 */}
      <div className="fe01-preview-bar">
        <span className="fe01-preview-badge">FE-01 UI Preview</span>
        <span className="fe01-preview-text">
          Chưa kết nối API xác thực (Tuần 3) · Điều hướng nhanh:
        </span>
        <div className="fe01-preview-links">
          <button
            type="button"
            className={`fe01-mode-pill ${authMode === "signin" ? "active" : ""}`}
            onClick={() => setAuthMode("signin")}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`fe01-mode-pill ${authMode === "signup" ? "active" : ""}`}
            onClick={() => setAuthMode("signup")}
          >
            Sign Up
          </button>
          <button
            type="button"
            className={`fe01-mode-pill ${
              authMode === "google-sso" ? "active" : ""
            }`}
            onClick={() => setAuthMode("google-sso")}
          >
            Chọn tài khoản
          </button>
          <span className="fe01-divider">|</span>
          <Link to="/requester" className="fe01-portal-link">
            Mở Requester Portal →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
