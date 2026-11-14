INSERT INTO "roles" ("id", "code", "name", "description", "created_at", "updated_at")
VALUES
    ('c5a5a85a-28c0-4b9d-873c-7c1bc72633d1', 'REQUESTER', 'Requester', 'Người gửi yêu cầu hỗ trợ', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('87390f46-00fc-4ed1-beb4-e5ab6815a1d3', 'TECHNICIAN', 'Technician', 'Nhân viên kỹ thuật xử lý yêu cầu', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('cc6ded98-aa86-47f3-908e-3c4f824929c8', 'SUPERVISOR', 'Supervisor', 'Quản lý yêu cầu hỗ trợ', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('e1fb0c15-5825-49bb-9583-277155bd1d9a', 'ADMIN', 'Admin', 'Quản trị hệ thống', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "categories" ("id", "name", "active", "created_at", "updated_at")
VALUES
    ('10000000-0000-4000-8000-000000000001', 'Mạng & Kết nối (Network / Wi-Fi / VPN)', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('10000000-0000-4000-8000-000000000002', 'Thiết bị phần cứng (PC / Laptop / Máy in)', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('10000000-0000-4000-8000-000000000003', 'Phần mềm & Ứng dụng nghiệp vụ', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('10000000-0000-4000-8000-000000000004', 'Tài khoản & Quyền truy cập (Email / Portal)', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
