# SmartDesk (IT Helpdesk Management System)

Dự án Học kỳ Doanh nghiệp — Nhóm 5
Hệ thống quản lý yêu cầu hỗ trợ IT cho doanh nghiệp.

## 1. Công nghệ

| Thành phần | Công nghệ                                  | Cổng local |
| ---------- | ------------------------------------------ | ---------- |
| Frontend   | React 19, TypeScript, Vite 8, Ant Design 6 | 5174       |
| Backend    | NestJS 12, TypeScript, Node.js 24          | 3000       |
| Database   | PostgreSQL 17, Docker Compose              | 5433       |
| ORM        | Prisma 7                                   | —          |

## 2. Yêu cầu môi trường

Trên Windows cần có:

- Node.js 24 LTS và npm.
- Git.
- Docker Desktop đang chạy Linux containers.
- PowerShell hoặc terminal VS Code.

Kiểm tra:

```powershell
node --version
npm --version
docker version
docker compose version
```

## 3. Cấu trúc repository

```text
it-helpdesk/
├── frontend/             # React + Vite
├── backend/              # NestJS + Prisma
│   ├── prisma/
│   │   └── schema.prisma
│   ├── prisma7.config.ts
│   └── src/
├── compose.yaml
├── .env.example
├── .gitignore
└── README.md
```

Frontend được tổ chức trong `src/app/` (router, providers, workspace menu),
`src/shared/` (AppShell, AuthContext, API client, Ticket UI và types),
`src/features/` (AI, Requester, Technician, Supervisor, Administrator) và
`src/pages/` (Landing Page công khai và Login chung). Xem [Frontend README](frontend/README.md) để biết
route và trạng thái các workspace.

## 4. Cài đặt lần đầu

```powershell
git clone https://github.com/hbaoz9/it-helpdesk.git
cd it-helpdesk
git switch develop
```

### 4.1. Cài dependencies

Frontend:

```powershell
cd frontend
npm ci
cd ..
```

Backend:

```powershell
cd backend
npm ci
cd ..
```

Sử dụng `npm ci` để cài đúng phiên bản từ `package-lock.json`.

### 4.2. Tạo file môi trường local

Chạy đoạn PowerShell dưới đây tại thư mục gốc repository.

**Lưu ý: Chỉ chạy đoạn script này một lần khi setup dự án trên máy mới. Không chỉnh sửa $password hay thay thủ công CHANGE_ME. Script sẽ tự tạo hai file .env với cùng mật khẩu. Nếu đã có .env hoặc database đang sử dụng, không chạy lại; giữ nguyên cấu hình hiện tại.**

```powershell
if ((Test-Path .env) -or (Test-Path backend/.env)) {
    throw "File .env da ton tai. Khong ghi de."
}

$password = [guid]::NewGuid().ToString("N")
$authSecret = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
$utf8 = [System.Text.UTF8Encoding]::new($false)

$rootEnv = @"
POSTGRES_DB=it_helpdesk
POSTGRES_USER=helpdesk
POSTGRES_PASSWORD=$password
"@

$backendEnv = @"
DATABASE_URL="postgresql://helpdesk:$($password)@127.0.0.1:5433/it_helpdesk?schema=public"
"@

$backendEnv = $backendEnv + "AUTH_SESSION_SECRET=$authSecret`n"

[System.IO.File]::WriteAllText(
    "$PWD\.env", $rootEnv, $utf8
)

[System.IO.File]::WriteAllText(
    "$PWD\backend\.env", $backendEnv, $utf8
)

Remove-Variable password,authSecret,rootEnv,backendEnv
```

Đoạn lệnh tạo cùng một mật khẩu ngẫu nhiên cho Docker PostgreSQL và kết nối Prisma.

**Không commit hoặc chia sẻ hai file `.env` thật.** Mỗi thành viên sử dụng môi trường local riêng.

### 4.3. Khởi động PostgreSQL

Tại thư mục gốc:

```powershell
docker compose up -d db
docker compose ps
```

Kỳ vọng container PostgreSQL có trạng thái `healthy`.

Database được lưu trong Docker named volume `it-helpdesk_pgdata`.

Không chạy `docker compose down -v` nếu muốn giữ dữ liệu.

### 4.4. Sinh Prisma Client

```powershell
cd backend
npx prisma validate --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
cd ..
```

Prisma Client được sinh từ schema và không commit vào Git.
Migration cũng tạo các role và danh mục mặc định để tạo Ticket.
`AUTH_SESSION_SECRET` được tạo cùng file `backend/.env`; không chia sẻ giá trị này.

Sau lần clone đầu tiên, cũng cần chạy `prisma generate` mỗi khi schema thay đổi.

## 5. Chạy ứng dụng

Mở hai terminal PowerShell, cả hai sử dụng Node 24.

**Terminal Frontend:**

```powershell
cd frontend
npm run dev
```

Truy cập: http://localhost:5174

**Terminal Backend:**

```powershell
cd backend
npm run start:dev
```

Frontend gọi API qua Vite proxy `/api` tới backend tại cổng 3000.
Backend API có prefix `/api/v1` (ví dụ `GET http://localhost:3000/api/v1/health`).

Trang `/` giới thiệu SmartDesk; đăng nhập tại `/login`. Không có đăng ký công khai. Tài khoản và vai trò do nhóm quản trị cấp nội bộ. Để tạo bốn tài khoản thử nghiệm trên database local đã chuẩn bị, chạy `npm run db:seed` trong `backend/` (không chạy trên dữ liệu cần giữ). Các tài khoản seed là `requester@helpdesk.local`, `technician@helpdesk.local`, `supervisor@helpdesk.local`, `admin@helpdesk.local`; mật khẩu mặc định `Helpdesk@LocalTest123` hoặc giá trị `SEED_TEST_PASSWORD` đã cấu hình. Đổi mật khẩu khi dùng ngoài môi trường local.

Nhấn `Ctrl + C` để dừng từng server.

## 6. Kiểm thử

Frontend:

```powershell
cd frontend
npm run lint
npm run build
```

Backend:

```powershell
cd backend
npm run lint
npm run build
npm run test -- src/auth/auth.spec.ts src/tickets/tickets.spec.ts
npm run test:e2e -- test/app.e2e-spec.ts
```

Kiểm tra dependencies:

```powershell
npm audit
```

Các lệnh kiểm tra được chạy tại thư mục tương ứng.

### AI Assistant (Requester)

Sau khi chuẩn bị Backend, thêm `GEMINI_API_KEY` vào `backend/.env` theo `backend/.env.example`. `GEMINI_MODEL` không bắt buộc; mặc định là `gemini-3.8-flash`. Tạo key trong Google AI Studio và kiểm tra model được cấp quyền cho project. Giữ API key trên server, không đưa vào biến `VITE_*` hoặc commit Git. Khởi động lại Backend sau khi cấu hình.

Requester đăng nhập, mở `/requester/ai`, nhập mô tả sự cố và chọn **Phân tích sự cố**. API `POST /api/v1/ai/assist` nhận `{ "description": "..." }` (20–2000 ký tự), trả `summary`, `quickChecks` (2–4 bước), `suggestedTitle`, `suggestedDescription`, `escalationAdvice`. Chọn **Tạo yêu cầu từ gợi ý** để mở bản nháp tại `/requester/tickets/new`; người dùng tự kiểm tra, sửa nội dung, chọn danh mục, mức ảnh hưởng và mức khẩn cấp rồi gửi qua Ticket API hiện có.

Endpoint cần Session và role `REQUESTER`. Giới hạn 10 lượt mỗi người dùng trong một giờ trên mỗi tiến trình Backend; triển khai nhiều instance cần rate limiter dùng chung. Thiếu key, key/model không hợp lệ hoặc Gemini tạm ngừng trả 503; timeout trả 504; lỗi provider khác trả 502; hết quota hoặc vượt giới hạn trả 429. Không có kết quả AI giả khi provider chưa cấu hình. Có thể chạy test không cần key bằng `npm run test -- src/ai/ai.spec.ts` trong `backend/`. Demo live cần key hợp lệ, quota khả dụng và kết nối tới Gemini. Free Tier có giới hạn theo project và model; kiểm tra hạn mức hiện tại trong Google AI Studio.

## 7. Lỗi thường gặp

**Không chạy được Node 24:** Kiểm tra `node --version` và PATH trong terminal. Nếu đang dùng trình quản lý nhiều phiên bản Node, chọn Node 24 cho terminal làm dự án HKDN.

**Port 5174 hoặc 3000 đã được sử dụng:** Kiểm tra tiến trình chiếm cổng, không tự ý đổi cổng hoặc tắt tiến trình của dự án khác.

**PostgreSQL không kết nối được:** Kiểm tra Docker Desktop, `docker compose ps` và hai file `.env`.

**Backend báo thiếu `AUTH_SESSION_SECRET`:** Thêm một giá trị bí mật ngẫu nhiên dài ít nhất 32 byte vào `backend/.env`. Không dùng chung giá trị này giữa môi trường hoặc commit file `.env`.

**Prisma Client chưa tồn tại:** Chạy lại `npx prisma generate --config prisma7.config.ts` trong thư mục Backend.

**Sai mật khẩu PostgreSQL:** Với volume đã có dữ liệu, thay đổi `POSTGRES_PASSWORD` trong `.env` không tự đổi mật khẩu tài khoản hiện tại trong database.

### RustDesk Remote Support (PR #19)

Remote Support mặc định tắt. Administrator chỉ bật sau khi cấu hình RustDesk server/client thật và kiểm tra kết nối. Thiết bị do Requester tự khai báo có trạng thái `PENDING`; việc nhập ID không chứng minh quyền sở hữu hoặc khả năng kết nối. Administrator phải quan sát ID trực tiếp trên thiết bị, nhập lại ID và ghi bằng chứng (ít nhất 20 ký tự) trước khi đánh dấu `VERIFIED`. Nếu Requester đổi ID, thiết bị trở lại `PENDING`. Tất cả thao tác xác minh được ghi Audit Log.

Chấp thuận trên SmartDesk chỉ cho phép quy trình yêu cầu phiên và hiển thị ID cho Technician đang phụ trách Ticket trong thời hạn chấp thuận. Quyền điều khiển máy và sự đồng ý cuối cùng do RustDesk client/host thực thi. Không bật unattended access, không tự cấp mật khẩu. Chưa có kiểm thử kết nối giữa hai thiết bị thật thì chỉ coi API/workflow đã được kiểm tra, không coi Remote Support hoàn chỉnh.

## 8. Quy tắc làm việc nhóm

- Nhánh tích hợp: `develop`.
- Mỗi chức năng được triển khai trên nhánh `feature/*`.
- Tạo Pull Request để review trước khi merge.
- Không commit mật khẩu, `node_modules`, `dist` hoặc generated Prisma Client.
- Không tự ý thay đổi phiên bản công nghệ và cấu hình dùng chung.
- Chỉ tạo Prisma migrations khi schema nghiệp vụ đã được thống nhất.
