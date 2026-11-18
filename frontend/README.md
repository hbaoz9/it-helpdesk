# SmartDesk Frontend

React 19, TypeScript, Vite 8 và Ant Design 6. Chạy `npm ci`, sau đó `npm run dev` trong thư mục `frontend` để mở http://localhost:5174. Vite chuyển tiếp `/api` đến Backend cổng 3000.

## Cấu trúc

- `src/app/`: Router, providers, cấu hình workspace và menu theo vai trò.
- `src/shared/`: AppShell, AuthContext, API client, kiểu dữ liệu và bảng Ticket dùng chung.
- `src/features/ai/`: Trợ lý AI trước khi tạo Ticket cho Requester.
- `src/features/requester/`, `technician/`, `supervisor/`, `admin/`: Các trang theo workspace.
- `src/pages/`: Landing Page công khai và Login chung.

`/` là trang giới thiệu công khai. `/login` dùng Login/Session của Backend. Không có đăng ký công khai hoặc Google SSO. Tài khoản được cấp nội bộ; xem hướng dẫn seed trong README gốc.

Các URL nghiệp vụ được giữ: `/requester`, `/requester/ai`, `/requester/tickets`, `/requester/tickets/new`, `/technician`, `/technician/tickets`, `/technician/tickets/:id`, `/supervisor`, `/supervisor/queue`, `/supervisor/assignments`, `/supervisor/dashboard`, `/admin`. Chi tiết yêu cầu của Requester dùng `/requester/tickets/:id`. AppShell chỉ hiển thị workspace có vai trò được cấp; route và API cũng kiểm tra quyền. Administrator không tự động có quyền đọc Ticket. Trợ lý AI chỉ dành cho Requester và cần cấu hình Gemini ở Backend; xem README gốc.

Danh sách Requester dùng `GET /api/v1/tickets?scope=requested&page=1&limit=10` để tìm kiếm, lọc và phân trang phía Backend. `GET /api/v1/tickets/my/count` trả `{ "total": number }` cho tài khoản Requester, áp dụng cùng bộ lọc `search`, `status`, `priority`; chi tiết dùng `GET /api/v1/tickets/:id?scope=requested`. Trang chi tiết tải lịch sử Public bằng `GET /api/v1/tickets/:id/activity`, gửi bình luận và xác nhận Close/Reopen qua API Ticket. Mỗi thao tác ghi cần `version` hiện tại để phát hiện thay đổi đồng thời; Internal Notes không được trả về Requester.

Chạy `npm run lint` và `npm run build` để kiểm tra Frontend.
