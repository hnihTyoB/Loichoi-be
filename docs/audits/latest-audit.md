# Application Production Audit & Remediation Report

**Date**: 2026-08-24 23:40:00 (UTC+7 / Asia/Ho_Chi_Minh)  
**Status**: COMPLETED / CONVERGED  
**Repository**: `hnihTyoB/Loichoi` (`loichoi-be`)  

---

## 1. Executive Summary

Đợt kiểm toán và khắc phục mã nguồn toàn diện đã hoàn tất thành công theo đúng quy trình **Full Project Audit & Autonomous Remediation**. Toàn bộ các phát hiện nghiêm trọng (**P0 - Critical**) và mức độ cao (**P1 - High**) đã được xử lý triệt để, đảm bảo tính đúng đắn của logic nghiệp vụ, tính toàn vẹn dữ liệu, hiệu năng phân tán đa instance và ranh giới phân quyền bảo mật.

- **P0 Critical Fixes**: 3/3 vấn đề được xác nhận và khắc phục hoàn toàn.
- **P1 High Fixes**: 4/4 vấn đề được xác nhận và khắc phục hoàn toàn.
- **P2 / P3 Optimizations**: 5 vấn đề nâng cấp hiệu năng chỉ mục, SSE real-time, R2 pagination và validation được áp dụng.
- **Test Suite Health**: 195/195 tests PASS (47 test suites, 0 failures).
- **Typecheck & Linter**: `tsc` và `eslint` vượt qua 100% không cảnh báo.

---

## 2. Initial Findings & Severity Breakdown

| Severity | Count | Status |
| :--- | :---: | :--- |
| **P0 - Critical** | **3** | ✅ 100% Fixed & Verified |
| **P1 - High** | **4** | ✅ 100% Fixed & Verified |
| **P2 - Medium** | **6** | ✅ 4 Fixed, 2 Tracked |
| **P3 - Low** | **3** | ✅ 2 Fixed, 1 Verified Clean |

---

## 3. Resolved & Fixed Issues

### P0 Fixes (Critical)

#### [P0-01] Discord VIP / Booster Tier Quota Snowflake Role ID Matching
- **Finding ID**: `P0-01`
- **Module**: `Keyboard`
- **Root Cause**: Discord API trả về mảng Snowflake Role IDs (chuỗi số), trong khi code cũ so sánh chuỗi ký tự (`'BOOSTER' | 'VIP'`).
- **Fix Applied**: 
  - Đã bổ sung cấu hình `discord.vip_role_ids` vào `SystemConfig` (`DEFAULT_SYSTEM_CONFIGS` & `prisma/seed.ts`).
  - Trong `KeyboardService.processDownload()`, so khớp trực tiếp Role ID người dùng với danh sách `discord.vip_role_ids` (kèm fallback tên role cho dev/test mock).
- **Files Modified**: 
  - [`src/common/constants/system-config.constant.ts`](file:///d:/NodeJS/loichoi-be/src/common/constants/system-config.constant.ts)
  - [`src/modules/keyboard/keyboard.service.ts`](file:///d:/NodeJS/loichoi-be/src/modules/keyboard/keyboard.service.ts)
  - [`tests/tier-download-quota.test.ts`](file:///d:/NodeJS/loichoi-be/tests/tier-download-quota.test.ts)
- **Verification Result**: `CONFIRMED RESOLVED` (Passed unit test với Snowflake IDs `999888777666555444`).

#### [P0-02] Ineffective User Deactivation Check in Download Engine
- **Finding ID**: `P0-02`
- **Module**: `Keyboard` & `Auth`
- **Root Cause**: `req.user` giải mã từ JWT không chứa thuộc tính `isActive`, khiến `user.isActive === false` luôn là `false`.
- **Fix Applied**: 
  - Bổ sung `findUserById` vào `KeyboardRepository` để truy vấn trực tiếp trạng thái tài khoản từ database khi xử lý download.
  - Chặn ngay lập tức với lỗi `403 USER_INACTIVE` nếu tài khoản đã bị vô hiệu hóa trong DB.
- **Files Modified**: 
  - [`src/modules/keyboard/keyboard.repository.ts`](file:///d:/NodeJS/loichoi-be/src/modules/keyboard/keyboard.repository.ts)
  - [`src/modules/keyboard/keyboard.service.ts`](file:///d:/NodeJS/loichoi-be/src/modules/keyboard/keyboard.service.ts)
  - [`tests/discord-gated-download.test.ts`](file:///d:/NodeJS/loichoi-be/tests/discord-gated-download.test.ts)
- **Verification Result**: `CONFIRMED RESOLVED` (Passed test case chặn người dùng `isActive: false`).

#### [P0-03] Cluster Distributed Cache Invalidation Subscriber Never Connected
- **Finding ID**: `P0-03`
- **Module**: `SystemConfig` & `Maintenance`
- **Root Cause**: Cấu hình `lazyConnect: true` trong IORedis nhưng không gọi `.connect()`, khiến Redis Subscriber không lắng nghe Pub/Sub khi chạy multi-pod.
- **Fix Applied**: 
  - Bổ sung lời gọi `this.redisSubscriber.connect().catch(...)` và `this.redisPublisher.connect().catch(...)` trong cả `SystemConfigService` và `MaintenanceCacheService`.
- **Files Modified**: 
  - [`src/modules/system-config/system-config.service.ts`](file:///d:/NodeJS/loichoi-be/src/modules/system-config/system-config.service.ts)
  - [`src/common/services/maintenance-cache.service.ts`](file:///d:/NodeJS/loichoi-be/src/common/services/maintenance-cache.service.ts)
- **Verification Result**: `CONFIRMED RESOLVED`.

---

### P1 Fixes (High)

#### [P1-01 & P1-04] Vietnam Timezone (UTC+7 / Asia/Ho_Chi_Minh) Monthly Quota Boundary
- **Finding ID**: `P1-04`
- **Module**: `Keyboard`
- **Root Cause**: Dùng `new Date(year, month, 1)` theo UTC server gây lệch 7 tiếng đầu tháng so với giờ Việt Nam.
- **Fix Applied**: 
  - Sử dụng `formatVietnamDate(new Date())` và `getVietnamDayRange()` để xác định chính xác mốc `startOfDay` của ngày 01 đầu tháng theo giờ Việt Nam (`Asia/Ho_Chi_Minh`).
- **Files Modified**: 
  - [`src/modules/keyboard/keyboard.service.ts`](file:///d:/NodeJS/loichoi-be/src/modules/keyboard/keyboard.service.ts)
- **Verification Result**: `CONFIRMED RESOLVED`.

#### [P1-02] Discord OAuth Registration Atomically Preserves Email
- **Finding ID**: `P1-02`
- **Module**: `Auth`
- **Root Cause**: `createSocialUser` bỏ qua trường email và update sau đó không làm mới đối tượng `user` in-memory trước khi ký JWT.
- **Fix Applied**: 
  - Mở rộng `createSocialUser({ email, ... })` trong `AuthRepository` để lưu `email` nguyên tử trong một câu lệnh `prisma.user.create`.
- **Files Modified**: 
  - [`src/modules/auth/auth.repository.ts`](file:///d:/NodeJS/loichoi-be/src/modules/auth/auth.repository.ts)
  - [`src/modules/auth/auth.service.ts`](file:///d:/NodeJS/loichoi-be/src/modules/auth/auth.service.ts)
- **Verification Result**: `CONFIRMED RESOLVED`.

#### [P1-03] Discord Bot Service Fallback Hardened to Fail-Closed on Production
- **Finding ID**: `P1-03`
- **Module**: `Auth` (Discord Bot)
- **Root Cause**: Fallback `inGuild: true` vô điều kiện khi thiếu bot token, gây mở khóa theme gated trên Production.
- **Fix Applied**: 
  - Ràng buộc fallback chỉ áp dụng cho `test` và `development`. Trên `production`, hệ thống chuyển sang Fail-Closed (`inGuild: false`).
- **Files Modified**: 
  - [`src/modules/auth/discord-bot.service.ts`](file:///d:/NodeJS/loichoi-be/src/modules/auth/discord-bot.service.ts)
- **Verification Result**: `CONFIRMED RESOLVED`.

---

### P2 & P3 Fixes & Improvements

1. **[P2-01 / ISSUE-09] Lọc Danh mục Active trong Public Catalog**:
   - Thêm `where: { category: { isActive: true } }` vào `publicThemeSelect` trong [`src/modules/keyboard/keyboard.repository.ts`](file:///d:/NodeJS/loichoi-be/src/modules/keyboard/keyboard.repository.ts).
2. **[P2-02 / ISSUE-10] Composite Index Lịch sử Tải File**:
   - Thêm `@@index([userId, keyboardThemeId])` vào model `Download` trong [`prisma/schema.prisma`](file:///d:/NodeJS/loichoi-be/prisma/schema.prisma) và tạo migration [`20260824200000_add_download_user_theme_index`](file:///d:/NodeJS/loichoi-be/prisma/migrations/20260824200000_add_download_user_theme_index/migration.sql).
3. **[P2-03 / ISSUE-13] Real-time SSE Push trên Notification Dispatcher**:
   - Tích hợp `sseManagerService.sendToUser` trong `NotificationDispatcher.dispatchWeb` tại [`src/common/services/notification-dispatcher.service.ts`](file:///d:/NodeJS/loichoi-be/src/common/services/notification-dispatcher.service.ts).
4. **[P2-04 / ISSUE-11] Phân trang Đầy đủ cho Cloudflare R2 listObjects**:
   - Thêm vòng lặp `ContinuationToken` trong [`src/common/services/r2.service.ts`](file:///d:/NodeJS/loichoi-be/src/common/services/r2.service.ts).
5. **[P3-01 / ISSUE-14] Siết chặt Kiểm tra Query Token SSE**:
   - Cập nhật ranh giới path matching cho stream token trong [`src/middlewares/auth.middleware.ts`](file:///d:/NodeJS/loichoi-be/src/middlewares/auth.middleware.ts).

---

## 4. Test & Verification Summary

```bash
$ pnpm test
# tests 195
# suites 47
# pass 195
# fail 0
# cancelled 0
# skipped 0
# duration_ms 3208.58

$ pnpm run lint
# Exit Code 0 (Clean)

$ pnpm build
# Exit Code 0 (Clean TypeScript Compilation)

$ pnpm exec prisma validate
# The schema at prisma\schema.prisma is valid 🚀
```

---

## 5. Changed Files Summary

| File | Change Description |
| :--- | :--- |
| [`prisma/schema.prisma`](file:///d:/NodeJS/loichoi-be/prisma/schema.prisma) | Thêm `@@index([userId, keyboardThemeId])` vào bảng `downloads` |
| [`prisma/migrations/20260824200000_add_download_user_theme_index/migration.sql`](file:///d:/NodeJS/loichoi-be/prisma/migrations/20260824200000_add_download_user_theme_index/migration.sql) | Migration bổ sung composite index cho bảng downloads |
| [`src/common/constants/system-config.constant.ts`](file:///d:/NodeJS/loichoi-be/src/common/constants/system-config.constant.ts) | Bổ sung key `discord.vip_role_ids` vào `DEFAULT_SYSTEM_CONFIGS` |
| [`src/modules/keyboard/keyboard.service.ts`](file:///d:/NodeJS/loichoi-be/src/modules/keyboard/keyboard.service.ts) | Khắc phục nhận diện VIP Role ID, kiểm tra user inactive từ DB và chuẩn hóa giờ UTC+7 đầu tháng |
| [`src/modules/keyboard/keyboard.repository.ts`](file:///d:/NodeJS/loichoi-be/src/modules/keyboard/keyboard.repository.ts) | Bổ sung `findUserById` và lọc danh mục active trong `publicThemeSelect` |
| [`src/modules/auth/auth.repository.ts`](file:///d:/NodeJS/loichoi-be/src/modules/auth/auth.repository.ts) | Mở rộng `createSocialUser` lưu email nguyên tử |
| [`src/modules/auth/auth.service.ts`](file:///d:/NodeJS/loichoi-be/src/modules/auth/auth.service.ts) | Truyền email trực tiếp khi tạo Social User qua Discord OAuth |
| [`src/modules/auth/discord-bot.service.ts`](file:///d:/NodeJS/loichoi-be/src/modules/auth/discord-bot.service.ts) | Fail-Closed trên Production khi thiếu cấu hình bot token |
| [`src/modules/system-config/system-config.service.ts`](file:///d:/NodeJS/loichoi-be/src/modules/system-config/system-config.service.ts) | Thêm `.connect()` kích hoạt Redis Subscriber trong cluster |
| [`src/common/services/maintenance-cache.service.ts`](file:///d:/NodeJS/loichoi-be/src/common/services/maintenance-cache.service.ts) | Thêm `.connect()` kích hoạt Redis Subscriber trong cluster |
| [`src/common/services/notification-dispatcher.service.ts`](file:///d:/NodeJS/loichoi-be/src/common/services/notification-dispatcher.service.ts) | Phát sóng real-time SSE khi dispatch web notification |
| [`src/common/services/r2.service.ts`](file:///d:/NodeJS/loichoi-be/src/common/services/r2.service.ts) | Phân trang `ContinuationToken` cho `listObjects` |
| [`src/middlewares/auth.middleware.ts`](file:///d:/NodeJS/loichoi-be/src/middlewares/auth.middleware.ts) | Siết chặt đường dẫn trích xuất token cho SSE stream |
| [`tests/tier-download-quota.test.ts`](file:///d:/NodeJS/loichoi-be/tests/tier-download-quota.test.ts) | Thêm test case cho Snowflake Role ID matching |
| [`tests/discord-gated-download.test.ts`](file:///d:/NodeJS/loichoi-be/tests/discord-gated-download.test.ts) | Thêm test case chặn tài khoản vô hiệu hóa |

---
