# Quy ước kỹ thuật mặc định

## TypeScript

- Giữ `strict` và tránh thêm `any`; nếu thư viện buộc phải dùng, cô lập và giải
  thích ở phạm vi nhỏ nhất.
- Ưu tiên type/interface rõ ràng ở biên module.
- Không dùng type assertion để bỏ qua validation hoặc nullability nếu có thể kiểm
  tra đúng tại runtime.
- Theo style hiện tại: single quote, semicolon, trailing comma ở multiline.
- Hằng số dùng chung (roles, permissions, audit actions, error codes, enum domain) bắt buộc định nghĩa tập trung trong `src/common/constants/` dưới dạng `as const` kèm export type tương ứng; không hard-code magic strings trong code logic hoặc repository/service.

## Express và API

- Response thành công giữ shape nhất quán: `{ success: true, ... }`.
- Error đi qua `errorMiddleware` và có `message`, `code`.
- Route mới phải xác định rõ public hay cần `authMiddleware`/`requireRole`.
- Không tin dữ liệu từ `req.body`, `req.query`, `req.params` trước validation.
- Không ghi access token, refresh token, password hay cookie nhạy cảm vào log.

## Auth và security

- Hash password bằng primitive hiện có; không lưu hoặc trả password plaintext.
- Kiểm tra ownership/role ở server, không dựa vào client.
- Secret chỉ lấy từ environment/config; không hard-code secret mới.
- Với thay đổi token/cookie/CORS/rate limit, kiểm tra cả luồng login, refresh,
  logout và failure path.

## Prisma

- Query nằm ở repository.
- Dùng `$transaction` cho các write phụ thuộc nhau.
- Cân nhắc pagination và index cho endpoint dạng danh sách.
- Select/omit field nhạy cảm một cách chủ động.
- Chạy validate/generate phù hợp khi sửa `schema.prisma`.

## Dependency và generated output

- Không thêm production dependency nếu thư viện hiện có hoặc Node.js built-in đã
  đáp ứng rõ ràng.
- Không sửa `dist/`, `node_modules/` hoặc generated Prisma Client.
- Khi thêm env var, cập nhật `.env.example` bằng placeholder an toàn và cập nhật
  config validation/access tương ứng; không sao chép giá trị từ `.env`.

## System Configuration & Feature Flags

- Mọi tính năng mới, cấu hình tích hợp (OAuth, Discord, Webhook, Bot, Email), cờ tính năng (Feature Flags), thông số giới hạn nghiệp vụ hoặc cấu hình công khai, **BẮT BUỘC** phải:
  1. Khai báo key và giá trị mặc định trong `src/common/constants/system-config.constant.ts` (`FEATURE_FLAGS`, `DEFAULT_SYSTEM_CONFIGS`).
  2. Bổ sung vào bước seed trong `prisma/seed.ts` để đồng bộ vào bảng `system_configs`.
  3. Đảm bảo Admin có thể quản trị động qua `/api/v1/system/*` và Client có thể bootstrap qua `GET /api/v1/system/public` mà không cần redeploy code.

