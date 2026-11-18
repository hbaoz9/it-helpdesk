# SmartDesk Frontend

React 19, TypeScript, Vite 8 và Ant Design 6. Chạy `npm ci`, sau đó `npm run dev` trong thư mục `frontend` để mở http://localhost:5174. Vite chuyển tiếp `/api` đến Backend cổng 3000.

## Cấu trúc

- `src/app/`: Router, providers, cấu hình workspace và menu theo vai trò.
- `src/shared/`: AppShell, AuthContext, API client, kiểu dữ liệu và bảng Ticket dùng chung.
- `src/features/ai/`: Trợ lý AI trước khi tạo Ticket cho Requester.
- `src/features/requester/`, `technician/`, `supervisor/`, `admin/`: Các trang theo workspace.
- `src/pages/`: Landing Page công khai và Login chung.

`/` là trang giới thiệu công khai. `/login` dùng Login/Session của Backend. Không có đăng ký công khai hoặc Google SSO. Tài khoản được cấp nội bộ; xem hướng dẫn seed trong README gốc.

Các URL nghiệp vụ được giữ: `/requester`, `/requester/ai`, `/requester/tickets`, `/requester/tickets/new`, `/technician`, `/technician/tickets`, `/technician/tickets/:id`, `/supervisor`, `/supervisor/queue`, `/supervisor/assignments`, `/supervisor/dashboard`, `/admin`. AppShell chỉ hiển thị workspace có vai trò được cấp; route và API cũng kiểm tra quyền. Administrator không tự động có quyền đọc Ticket. Trợ lý AI chỉ dành cho Requester và cần cấu hình Gemini ở Backend; xem README gốc.

Chạy `npm run lint` và `npm run build` để kiểm tra Frontend.
