import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { ApiError } from "../api/client";
import { useAuth } from "../auth/useAuth";

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
  const navigate = useNavigate();
  const { user, loading, login, register } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [previousMode, setPreviousMode] = useState<"signin" | "signup">(
    "signin",
  );
  const [submitting, setSubmitting] = useState(false);
  const [loginForm] = Form.useForm<LoginFormValues>();
  const [signUpForm] = Form.useForm<SignUpFormValues>();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!loading && user) {
      navigate(getHomePath(user.roles), { replace: true });
    }
  }, [loading, user, navigate]);

  const handleLogin = async (values: LoginFormValues) => {
    setSubmitting(true);
    try {
      const authenticatedUser = await login(values.email, values.password);
      navigate(getHomePath(authenticatedUser.roles), { replace: true });
    } catch (error) {
      messageApi.error(
        error instanceof ApiError
          ? error.message
          : "Không thể kết nối Backend. Vui lòng thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (values: SignUpFormValues) => {
    setSubmitting(true);
    try {
      const authenticatedUser = await register(
        values.username,
        values.email,
        values.password,
      );
      navigate(getHomePath(authenticatedUser.roles), { replace: true });
    } catch (error) {
      messageApi.error(
        error instanceof ApiError
          ? error.message
          : "Không thể kết nối Backend. Vui lòng thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
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
      `Google SSO chưa được cấu hình cho ${email}. Hãy đăng nhập bằng tài khoản IT Helpdesk.`,
    );
  };

  const handleUseAnotherAccount = () => {
    setAuthMode("signin");
    messageApi.info(
      "Vui lòng nhập email tài khoản khác tại biểu mẫu đăng nhập.",
    );
  };

  return (
    <div className="auth-page-backdrop">
      {contextHolder}

      {authMode === "google-sso" ? (
        <div
          className="sso-card"
          role="region"
          aria-label="Chọn tài khoản Google"
        >
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
                  handleSelectGoogleAccount("requester@example.com")
                }
              >
                <div className="sso-avatar">N</div>
                <div className="sso-account-info">
                  <div className="sso-account-name-row">
                    <span className="sso-account-name">Nhân viên Demo</span>
                    <span className="sso-domain-badge">example.com</span>
                  </div>
                  <span className="sso-account-email">
                    requester@example.com
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
                    messageApi.info(
                      "Tài liệu Chính sách quyền riêng tư minh họa.",
                    )
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
                    <Form.Item name="remember" valuePropName="checked" noStyle>
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
                        min: 12,
                        message: "Mật khẩu cần tối thiểu 12 ký tự!",
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
                            new Error("Mật khẩu xác nhận không khớp!"),
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
                                  "Vui lòng đồng ý với điều khoản dịch vụ!",
                                ),
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

      {/* Quick switch between the connected sign-in and registration forms. */}
      <div className="fe01-preview-bar">
        <span className="fe01-preview-badge">IT HELPDESK</span>
        <span className="fe01-preview-text">
          Xác thực tài khoản Requester qua Backend
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
        </div>
      </div>
    </div>
  );
}

function getHomePath(roles: string[]): string {
  if (roles.includes("SUPERVISOR") || roles.includes("ADMIN")) {
    return "/supervisor";
  }
  if (roles.includes("TECHNICIAN")) return "/technician";
  if (roles.includes("REQUESTER")) return "/requester";
  return "/login";
}

export default LoginPage;
