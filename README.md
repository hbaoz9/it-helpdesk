# IT Helpdesk Management System

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
$utf8 = [System.Text.UTF8Encoding]::new($false)

$rootEnv = @"
POSTGRES_DB=it_helpdesk
POSTGRES_USER=helpdesk
POSTGRES_PASSWORD=$password
"@

$backendEnv = @"
DATABASE_URL="postgresql://helpdesk:$($password)@127.0.0.1:5433/it_helpdesk?schema=public"
"@

[System.IO.File]::WriteAllText(
    "$PWD\.env", $rootEnv, $utf8
)

[System.IO.File]::WriteAllText(
    "$PWD\backend\.env", $backendEnv, $utf8
)

Remove-Variable password,rootEnv,backendEnv
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
cd ..
```

Prisma Client được sinh từ schema và không commit vào Git.

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

Kiểm tra API: http://localhost:3000

Backend scaffold hiện trả về `Hello World!`.

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
npm run test
npm run test:e2e
```

Kiểm tra dependencies:

```powershell
npm audit
```

Các lệnh kiểm tra được chạy tại thư mục tương ứng.

## 7. Lỗi thường gặp

**Không chạy được Node 24:** Kiểm tra `node --version` và PATH trong terminal. Nếu đang dùng trình quản lý nhiều phiên bản Node, chọn Node 24 cho terminal làm dự án HKDN.

**Port 5174 hoặc 3000 đã được sử dụng:** Kiểm tra tiến trình chiếm cổng, không tự ý đổi cổng hoặc tắt tiến trình của dự án khác.

**PostgreSQL không kết nối được:** Kiểm tra Docker Desktop, `docker compose ps` và hai file `.env`.

**Prisma Client chưa tồn tại:** Chạy lại `npx prisma generate --config prisma7.config.ts` trong thư mục Backend.

**Sai mật khẩu PostgreSQL:** Với volume đã có dữ liệu, thay đổi `POSTGRES_PASSWORD` trong `.env` không tự đổi mật khẩu tài khoản hiện tại trong database.

## 8. Quy tắc làm việc nhóm

- Nhánh tích hợp: `develop`.
- Mỗi chức năng được triển khai trên nhánh `feature/*`.
- Tạo Pull Request để review trước khi merge.
- Không commit mật khẩu, `node_modules`, `dist` hoặc generated Prisma Client.
- Không tự ý thay đổi phiên bản công nghệ và cấu hình dùng chung.
- Chỉ tạo Prisma migrations khi schema nghiệp vụ đã được thống nhất.
