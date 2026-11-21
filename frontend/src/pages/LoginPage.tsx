import { useEffect, useState } from 'react';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  LockOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { Alert, Button, Checkbox, Form, Input, Typography } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { homePath, workspaces, type Workspace } from '../app/workspaces';
import { ApiError } from '../shared/api/client';
import type { RoleCode } from '../shared/api/types';
import { useAuth } from '../shared/auth/useAuth';
import './LoginPage.css';

interface LoginValues {
  email: string;
  password: string;
  remember: boolean;
}

function resolvePostLoginPath(roles: RoleCode[], fromPath: string | null): string {
  if (fromPath && fromPath.startsWith('/')) {
    const matchedWorkspace = (Object.keys(workspaces) as Workspace[]).find(
      (key) =>
        fromPath === workspaces[key].path ||
        fromPath.startsWith(`${workspaces[key].path}/`),
    );
    if (matchedWorkspace && roles.includes(workspaces[matchedWorkspace].role)) {
      return fromPath;
    }
  }
  return homePath(roles);
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, login, loadError, refreshSession } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const requestedFrom =
    location.state &&
    typeof location.state === 'object' &&
    'from' in location.state &&
    typeof location.state.from === 'string'
      ? location.state.from
      : null;

  useEffect(() => {
    if (!loading && user) {
      navigate(resolvePostLoginPath(user.roles, requestedFrom), {
        replace: true,
      });
    }
  }, [loading, user, navigate, requestedFrom]);

  const submit = async ({ email, password, remember }: LoginValues) => {
    setSubmitting(true);
    setError(null);
    try {
      const signedIn = await login(email.trim(), password, remember);
      navigate(resolvePostLoginPath(signedIn.roles, requestedFrom), {
        replace: true,
      });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setError('Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.');
      } else {
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Không thể kết nối máy chủ. Vui lòng thử lại.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-top">
        <Link to="/">
          <ArrowLeftOutlined /> Về trang chủ
        </Link>
      </div>
      <div className="login-panel">
        <section className="login-story" aria-label="Giới thiệu SmartDesk">
          <div className="login-brand">
            <span className="login-brand-mark">S</span>
            <span>
              <strong>SmartDesk</strong>
              <small>INTELLIGENT IT SUPPORT</small>
            </span>
          </div>
          <div className="login-story-copy">
            <h1>Luôn có người hỗ trợ khi bạn cần.</h1>
            <p>
              Hỏi AI, gửi sự cố, theo dõi tiến độ — một điểm đến cho nhu cầu hỗ
              trợ IT nội bộ.
            </p>
          </div>
          <span className="login-story-caption">
            AN TOÀN · TẬP TRUNG · MINH BẠCH
          </span>
        </section>
        <section className="login-form-panel">
          <div className="login-form-wrap">
            <span className="login-eyebrow">ĐĂNG NHẬP</span>
            <Typography.Title level={2}>Chào mừng quay lại</Typography.Title>
            <p className="login-description">
              Sử dụng tài khoản do doanh nghiệp cấp để truy cập hệ thống.
            </p>
            {loadError && (
              <Alert
                type="warning"
                showIcon
                message="Không thể kiểm tra phiên đăng nhập"
                description={loadError}
                action={
                  <Button
                    size="small"
                    onClick={() => void refreshSession()}
                    loading={loading}
                  >
                    Thử lại
                  </Button>
                }
                className="login-alert"
              />
            )}
            {error && (
              <Alert
                type="error"
                showIcon
                message={error}
                className="login-alert"
              />
            )}
            <Form<LoginValues>
              layout="vertical"
              onFinish={submit}
              initialValues={{ remember: false }}
              requiredMark={false}
            >
              <Form.Item
                label="Email công việc"
                name="email"
                rules={[
                  { required: true, message: 'Vui lòng nhập email.' },
                  { type: 'email', message: 'Email không hợp lệ.' },
                ]}
              >
                <Input
                  size="large"
                  prefix={<MailOutlined />}
                  autoComplete="username"
                  placeholder="ten@doanhnghiep.vn"
                  disabled={submitting}
                />
              </Form.Item>
              <Form.Item
                label="Mật khẩu"
                name="password"
                rules={[{ required: true, message: 'Vui lòng nhập mật khẩu.' }]}
              >
                <Input.Password
                  size="large"
                  prefix={<LockOutlined />}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
                  disabled={submitting}
                />
              </Form.Item>
              <div className="login-options">
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox disabled={submitting}>Ghi nhớ đăng nhập</Checkbox>
                </Form.Item>
                <Button
                  type="link"
                  onClick={() => setShowHelp((value) => !value)}
                >
                  Quên mật khẩu?
                </Button>
              </div>
              {showHelp && (
                <Alert
                  type="info"
                  showIcon
                  message="Liên hệ Administrator của doanh nghiệp để được hỗ trợ khôi phục mật khẩu."
                  className="login-alert"
                />
              )}
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={submitting}
                disabled={loading}
              >
                Đăng nhập <ArrowRightOutlined />
              </Button>
            </Form>
            <p className="login-account-note">
              Chưa có tài khoản? Liên hệ Administrator để được cấp quyền.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
