import { ArrowRightOutlined, ClockCircleOutlined, CustomerServiceOutlined, RobotOutlined, SafetyCertificateOutlined, SendOutlined, SolutionOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { Link } from 'react-router-dom';
import { homePath } from '../app/workspaces';
import { useAuth } from '../shared/auth/useAuth';
import './LandingPage.css';

export default function LandingPage() {
  const { user } = useAuth();
  const destination = user ? homePath(user.roles) : '/login';
  const action = user ? 'Vào workspace' : 'Đăng nhập';

  return <div className="landing">
    <header className="landing-header">
      <Link className="landing-brand" to="/"><span className="landing-mark">S</span><span><strong>SmartDesk</strong><small>INTELLIGENT IT SUPPORT</small></span></Link>
      <nav aria-label="Điều hướng chính"><a href="#nang-luc">Năng lực</a><a href="#quy-trinh">Quy trình</a></nav>
      <Link className="landing-header-action" to={destination}>{action} <ArrowRightOutlined /></Link>
    </header>
    <main>
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-kicker">NỀN TẢNG HỖ TRỢ IT NỘI BỘ</span>
          <h1>Hỗ trợ IT rõ ràng hơn, từ yêu cầu đầu tiên đến khi giải quyết.</h1>
          <p>SmartDesk kết nối nhân viên với đội ngũ IT trong một không gian làm việc thống nhất. Gửi yêu cầu, theo dõi tiến độ và phối hợp xử lý dễ dàng.</p>
          <div className="landing-hero-actions"><Link to={destination}><Button type="primary" size="large">{action} <ArrowRightOutlined /></Button></Link><a href="#nang-luc">Khám phá SmartDesk</a></div>
        </div>
        <div className="landing-hero-visual" aria-hidden="true">
          <div className="landing-visual-top"><span className="landing-visual-dot" /> SmartDesk Workspace <span>● ● ●</span></div>
          <div className="landing-visual-body">
            <div className="landing-visual-title">Một nơi cho mọi yêu cầu hỗ trợ</div>
            <div className="landing-visual-row"><span className="landing-visual-icon"><SendOutlined /></span><span><strong>Gửi yêu cầu</strong><small>Mô tả vấn đề của bạn</small></span><span className="landing-visual-pill">Bước 1</span></div>
            <div className="landing-visual-row"><span className="landing-visual-icon"><SolutionOutlined /></span><span><strong>Đội IT tiếp nhận</strong><small>Phân loại và xử lý</small></span><span className="landing-visual-pill">Bước 2</span></div>
            <div className="landing-visual-row"><span className="landing-visual-icon"><SafetyCertificateOutlined /></span><span><strong>Theo dõi kết quả</strong><small>Minh bạch từng trạng thái</small></span><span className="landing-visual-pill">Bước 3</span></div>
          </div>
        </div>
      </section>
      <section className="landing-section" id="nang-luc">
        <div className="landing-section-heading"><span className="landing-kicker">SMARTDESK CÓ GÌ?</span><h2>Mọi bước hỗ trợ, cùng một trải nghiệm</h2><p>Nhân viên và đội IT có thông tin cần thiết để phối hợp, không phải tìm kiếm qua nhiều kênh.</p></div>
        <div className="landing-capabilities">
          <article><span className="landing-card-icon"><RobotOutlined /></span><h3>Hỗ trợ AI ban đầu</h3><p>Định hướng cách mô tả sự cố và gợi ý bước kiểm tra trước khi cần đến đội IT.</p><span className="landing-status">Đang phát triển</span></article>
          <article><span className="landing-card-icon"><CustomerServiceOutlined /></span><h3>Quản lý Ticket</h3><p>Tạo yêu cầu và theo dõi trạng thái xử lý trong một hệ thống tập trung.</p></article>
          <article><span className="landing-card-icon"><ClockCircleOutlined /></span><h3>Giám sát SLA</h3><p>Giúp đội điều phối theo dõi mức ưu tiên và thời hạn phục vụ của từng yêu cầu.</p><span className="landing-status">Đang phát triển</span></article>
        </div>
      </section>
      <section className="landing-process" id="quy-trinh">
        <div className="landing-section-heading"><span className="landing-kicker">QUY TRÌNH HỖ TRỢ</span><h2>Từ sự cố đến giải pháp</h2></div>
        <div className="landing-steps"><div><b>01</b><h3>Gửi yêu cầu</h3><p>Mô tả sự cố và mức ảnh hưởng.</p></div><div><b>02</b><h3>Tiếp nhận</h3><p>Đội IT xem và phân công yêu cầu.</p></div><div><b>03</b><h3>Giải quyết</h3><p>Theo dõi tiến độ và kết quả xử lý.</p></div></div>
      </section>
      <section className="landing-cta"><div><h2>Sẵn sàng bắt đầu với SmartDesk?</h2><p>Sử dụng tài khoản được doanh nghiệp cấp để vào workspace của bạn.</p></div><Link to={destination}><Button size="large">{action} <ArrowRightOutlined /></Button></Link></section>
    </main>
    <footer className="landing-footer"><div className="landing-brand"><span className="landing-mark">S</span><strong>SmartDesk</strong></div><span>Hỗ trợ IT tập trung, minh bạch và dễ sử dụng.</span></footer>
  </div>;
}
