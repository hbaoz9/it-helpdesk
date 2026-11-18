# SmartDesk Frontend

React 19, TypeScript, Vite 8 và Ant Design 6. Chạy `npm ci`, sau đó `npm run dev` tại thư mục `frontend` (cổng 5174). Vite chuyển tiếp `/api` đến Backend cổng 3000.

## Cấu trúc

- `src/app/`: Router, providers, cấu hình workspace và menu theo role.
- `src/shared/`: AppShell, AuthContext, API client, kiểu dữ liệu và bảng Ticket dùng chung.
- `src/features/requester/`, `technician/`, `supervisor/`, `admin/`: Các trang của từng workspace. Chức năng Administrator đang phát triển và chưa gọi API quản trị.
- `src/pages/LoginPage.tsx`: Trang đăng nhập chung. Luồng đăng ký Requester hiện có được giữ nguyên; thay đổi `/auth/register` nằm ngoài phạm vi foundation.

Giữ các URL `/requester`, `/requester/tickets`, `/requester/tickets/new`, `/technician`, `/technician/tickets`, `/technician/tickets/:id`, `/supervisor`, `/supervisor/queue`, `/supervisor/assignments`, `/supervisor/dashboard`. `/admin` chỉ cho role ADMIN. Menu workspace được lọc theo role do `/auth/me` trả về, và route cũng được bảo vệ độc lập với menu.

Chạy `npm run lint` và `npm run build` để kiểm tra Frontend.
