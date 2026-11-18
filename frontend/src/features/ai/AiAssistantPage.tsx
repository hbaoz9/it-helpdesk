import { useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, List, Space, Typography } from 'antd';
import { ArrowRightOutlined, RobotOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { assistWithAi, type AiAssistResult } from './aiApi';
import './AiAssistantPage.css';

export default function AiAssistantPage() {
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<AiAssistResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await assistWithAi(description.trim()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể phân tích sự cố. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return <div className="requester-page ai-page">
    <div className="requester-heading"><div><Typography.Text className="ai-eyebrow">SMARTDESK AI SUPPORT</Typography.Text><Typography.Title level={2}>Trợ lý AI trước khi tạo yêu cầu</Typography.Title><Typography.Text type="secondary">Mô tả sự cố để nhận các bước tự kiểm tra và gợi ý nội dung Ticket.</Typography.Text></div><RobotOutlined className="ai-heading-icon" /></div>
    <Alert showIcon type="info" message="AI có thể đưa ra gợi ý chưa chính xác. Không nhập mật khẩu, mã xác thực, token hoặc thông tin nhạy cảm. Nếu sự cố nghiêm trọng, hãy tạo yêu cầu để nhân viên IT hỗ trợ." />
    <Card className="requester-card" title="Mô tả vấn đề của bạn">
      <Form layout="vertical" onFinish={analyze}>
        <Form.Item label="Bạn đang gặp sự cố gì?" required>
          <Input.TextArea value={description} onChange={(event) => { setDescription(event.target.value); setResult(null); setError(null); }} rows={6} maxLength={2000} showCount placeholder="Ví dụ: Máy tính không kết nối được Wi-Fi công ty từ sáng nay. Tôi đã thử tắt và bật lại Wi-Fi nhưng vẫn không thấy mạng..." />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} disabled={description.trim().length < 20}>Phân tích sự cố</Button>
      </Form>
    </Card>
    {error && <Alert showIcon type="error" message="Chưa thể nhận gợi ý từ AI" description={error} action={<Button onClick={analyze} loading={loading}>Thử lại</Button>} />}
    {result ? <Card className="requester-card" title="Gợi ý hỗ trợ ban đầu">
      <Space direction="vertical" size="large" className="ai-result">
        <div><Typography.Title level={4}>Tóm tắt vấn đề</Typography.Title><Typography.Paragraph>{result.summary}</Typography.Paragraph></div>
        <div><Typography.Title level={4}>Các bước bạn có thể kiểm tra</Typography.Title><List dataSource={result.quickChecks} renderItem={(step, index) => <List.Item><span className="ai-step-number">{index + 1}</span><span>{step}</span></List.Item>} /></div>
        <Alert showIcon type="warning" message="Khi nào cần chuyển cho IT" description={result.escalationAdvice} />
        <div className="ai-ticket-preview"><Typography.Title level={4}>Gợi ý cho yêu cầu hỗ trợ</Typography.Title><Typography.Text strong>{result.suggestedTitle}</Typography.Text><Typography.Paragraph>{result.suggestedDescription}</Typography.Paragraph></div>
        <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => navigate('/requester/tickets/new', { state: { aiDraft: { title: result.suggestedTitle, description: result.suggestedDescription } } })}>Tạo yêu cầu từ gợi ý</Button>
      </Space>
    </Card> : !loading && !error && <Card className="requester-card"><Empty description="Nhập mô tả và chọn Phân tích sự cố để nhận gợi ý." /></Card>}
  </div>;
}
