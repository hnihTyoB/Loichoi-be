# Keyboard Theme Library — mô tả sản phẩm và phạm vi Backend MVP

## 1. Mục tiêu sản phẩm

Xây dựng một thư viện keyboard theme có tài khoản người dùng, tìm kiếm/lọc, trang chi tiết và luồng tải file qua Google Drive. Discord được dùng để đăng nhập và dẫn người dùng vào cộng đồng.

MVP là **gallery/library**, chưa phải marketplace. Đường chạy cần hoàn chỉnh trước tiên:

> Quản trị viên tạo theme → người dùng khám phá theme → đăng nhập Discord → yêu cầu tải → hệ thống kiểm tra quyền và ghi nhận lượt tải → chuyển người dùng tới file trên Google Drive.

### Giá trị cốt lõi

- Người dùng tìm được theme phù hợp nhanh qua search, category và platform.
- Trang chi tiết có ảnh mockup/preview đủ trực quan trước khi tải.
- Quản trị viên quản lý metadata và trạng thái phát hành mà không upload file theme lên backend.
- Hệ thống kiểm soát quyền truy cập tại thời điểm yêu cầu tải và có dữ liệu download để thống kê.

## 2. Phạm vi MVP

### Có trong MVP

1. Danh sách keyboard theme đã phát hành.
2. Tìm kiếm theo tên và lọc theo category/platform.
3. Trang chi tiết với cover và nhiều preview image.
4. Đăng nhập bằng Discord.
5. Tải file qua endpoint backend, file thật đặt trên Google Drive.
6. Ghi nhận lịch sử và số lượt yêu cầu tải.
7. Quản trị keyboard theme và category bằng Dynamic RBAC.
8. Trạng thái `DRAFT`, `PUBLISHED`, `HIDDEN` cho theme.

### Chưa làm trong MVP

- Payment, subscription hoặc premium tier.
- Kiểm tra Discord server membership/Discord role.
- Creator profile, creator upload hoặc marketplace.
- Favorite, comment, rating, follow, collection.
- Recommendation AI, chat hoặc social feed.
- Đồng bộ file từ Google Drive vào hệ thống.
- Bảo vệ file tuyệt đối sau khi URL Google Drive đã được cấp.

Các mục trên chỉ được đưa vào roadmap sau khi luồng MVP đã chạy ổn định và có nhu cầu thực tế.

## 3. Hiện trạng codebase và nguyên tắc tích hợp

Backend hiện tại là Express + TypeScript + Prisma + PostgreSQL, API được mount dưới `/api/v1`. Dự án đã có:

- JWT access token, refresh token, cookie và quản lý phiên đăng nhập.
- `User`, `UserSocial`, `Role`, `Permission`, `RolePermission` và Dynamic RBAC.
- Luồng chuẩn `route → validation → controller → service → repository`.
- Zod validation, `AppError`, `ERROR_CODE`, audit log và rate limiting.
- Hạ tầng object storage/presigned upload có thể tái sử dụng cho cover và preview image.
- Swagger/OpenAPI, maintenance mode và notification system.

Vì vậy, phần nghiệp vụ mới phải **mở rộng nền tảng hiện có**, không tạo thêm một hệ auth, session hoặc role song song.

### Các quyết định tích hợp

- Discord OAuth là một phương thức đăng nhập mới của module auth hiện tại.
- Tài khoản Discord liên kết qua `UserSocial` với provider `DISCORD` và Discord user ID.
- Thông tin hiển thị từ Discord có thể cập nhật vào `User.fullName` và `User.avatarUrl`; không tạo một model `User` khác.
- Sau OAuth callback, backend phát hành access/refresh token theo cơ chế hiện tại.
- Không thêm cột `role = USER | ADMIN` vào model nghiệp vụ; quyền quản trị dùng Dynamic RBAC.
- Cover và preview image ưu tiên dùng object storage đã tích hợp; Google Drive chỉ chứa file theme cần tải.
- Mọi request input tiếp tục được validate bằng Zod và mọi truy vấn Prisma nằm trong repository.

## 4. Luồng người dùng

```text
Home / Explore
      ↓
Search hoặc filter
      ↓
Keyboard detail
      ↓
Yêu cầu download
      ↓
Chưa đăng nhập? → Discord OAuth → quay lại theme
      ↓
Backend kiểm tra theme và quyền
      ↓
Ghi nhận download + tăng bộ đếm
      ↓
Redirect tới Google Drive
```

Đăng nhập không bắt buộc để xem danh sách và trang chi tiết. Đăng nhập bắt buộc tại bước download để có thể kiểm soát quyền và ghi nhận lịch sử theo người dùng.

## 5. Discord OAuth

### Flow

```text
Frontend
   ↓
GET /api/v1/auth/discord
   ↓
Discord authorization
   ↓
GET /api/v1/auth/discord/callback
   ↓
Backend kiểm tra state và đổi authorization code
   ↓
Lấy Discord user profile
   ↓
Tìm hoặc tạo User + liên kết UserSocial
   ↓
Phát hành access token và refresh token hiện có
   ↓
Redirect về frontend theo allowlist
```

### Yêu cầu bảo mật

- Bắt buộc dùng `state` chống CSRF và state phải có thời hạn ngắn, dùng một lần.
- Redirect URI và frontend return URL phải nằm trong allowlist cấu hình; không nhận URL tùy ý từ client.
- Chỉ yêu cầu OAuth scope tối thiểu đủ nhận diện người dùng.
- Không lưu Discord access token nếu MVP chỉ dùng Discord để xác thực danh tính.
- Không đưa OAuth code, access token, refresh token hoặc cookie vào log.
- Nếu một Discord ID đã liên kết, không được tự động liên kết với tài khoản khác.
- Xử lý rõ tài khoản bị soft-delete hoặc vô hiệu hóa trước khi phát hành token.

Việc kiểm tra user có tham gia Discord server hay sở hữu role cụ thể không thuộc MVP vì cần scope, bot/API và chính sách đồng bộ riêng.

## 6. Mô hình dữ liệu đề xuất

Các model auth/RBAC hiện có được giữ nguyên. MVP bổ sung năm nhóm dữ liệu nghiệp vụ sau.

### `KeyboardTheme`

| Field | Ý nghĩa |
| --- | --- |
| `id` | UUID |
| `name` | Tên hiển thị |
| `slug` | Định danh URL duy nhất |
| `description` | Nội dung chi tiết |
| `coverUrl` | Ảnh đại diện |
| `driveUrl` | URL file Google Drive, chỉ dùng nội bộ |
| `platform` | `IOS`, `ANDROID` hoặc `BOTH` |
| `status` | `DRAFT`, `PUBLISHED` hoặc `HIDDEN` |
| `downloadCount` | Bộ đếm được cập nhật atomic |
| `publishedAt` | Thời điểm phát hành, nullable |
| `createdBy` | User tạo bản ghi |
| `updatedBy` | User cập nhật gần nhất |
| `createdAt`, `updatedAt` | Audit timestamps |

Quy tắc:

- `slug` được normalize và unique, không phân biệt cách viết hoa/thường ở tầng nghiệp vụ.
- Public API chỉ trả theme `PUBLISHED`.
- `driveUrl` không xuất hiện trong response list/detail public.
- `publishedAt` được đặt khi chuyển sang `PUBLISHED`, không dùng `createdAt` để giả định ngày phát hành.
- Nên ưu tiên ẩn/archive thay vì hard-delete theme đã có lịch sử tải.

### `KeyboardImage`

| Field | Ý nghĩa |
| --- | --- |
| `id` | UUID |
| `keyboardThemeId` | Theme sở hữu ảnh |
| `url` | URL ảnh trên object storage |
| `altText` | Nội dung thay thế phục vụ accessibility |
| `position` | Thứ tự hiển thị |
| `createdAt` | Thời điểm tạo |

Preview dùng bảng riêng thay vì JSON array để hỗ trợ reorder, thêm và xóa ảnh an toàn. Cần unique `(keyboardThemeId, position)` hoặc quy tắc tương đương.

### `Category`

| Field | Ý nghĩa |
| --- | --- |
| `id` | UUID |
| `name` | Tên hiển thị |
| `slug` | Định danh unique |
| `isActive` | Cho phép ẩn category mà không phá dữ liệu cũ |
| `createdAt`, `updatedAt` | Audit timestamps |

### `KeyboardThemeCategory`

Bảng nối many-to-many gồm `keyboardThemeId` và `categoryId`, có unique constraint trên cặp khóa để tránh gán trùng.

### `Download`

| Field | Ý nghĩa |
| --- | --- |
| `id` | UUID |
| `userId` | Người yêu cầu tải |
| `keyboardThemeId` | Theme được yêu cầu |
| `ipAddress` | Nullable; chỉ lưu nếu chính sách dữ liệu cho phép |
| `userAgent` | Nullable |
| `createdAt` | Thời điểm backend cấp quyền tải |

`Download` ghi nhận **lần backend cấp link/redirect**, không khẳng định người dùng đã tải file hoàn tất vì Google Drive nằm ngoài hệ thống.

### Index và tính nhất quán cần có

- Unique index cho slug của theme và category.
- Index phục vụ `status + publishedAt`, platform và truy vấn danh sách.
- Index cho `Download(userId, createdAt)` và `Download(keyboardThemeId, createdAt)`.
- Transaction gồm tạo `Download` và atomic increment `KeyboardTheme.downloadCount`.
- Không đọc bản ghi rồi cộng `downloadCount` ở application memory vì có thể mất lượt khi request đồng thời.

Các giá trị status, platform, permission và audit action phải được định nghĩa tập trung theo convention `as const`; không hard-code magic string trong service/repository.

## 7. API MVP

Tất cả endpoint nằm dưới prefix `/api/v1` và response thành công giữ shape chung của dự án: `{ success: true, data, meta? }`.

### Public/authenticated user

| Method | Endpoint | Auth | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/keyboards` | Không | Danh sách theme đã phát hành |
| `GET` | `/keyboards/:slug` | Không | Chi tiết theme đã phát hành |
| `GET` | `/categories` | Không | Category đang hoạt động |
| `POST` | `/keyboards/:slug/download` | Có | Kiểm tra quyền, ghi nhận và redirect |
| `GET` | `/auth/discord` | Không | Bắt đầu Discord OAuth |
| `GET` | `/auth/discord/callback` | Không | Xử lý OAuth callback |
| `GET` | `/auth/me` | Có | Lấy người dùng hiện tại; tái sử dụng endpoint có sẵn |
| `POST` | `/auth/logout` | Theo cơ chế hiện tại | Đăng xuất; tái sử dụng endpoint có sẵn |

Query đề xuất cho `GET /keyboards`:

```text
page=1
limit=20
search=sakura
category=anime
platform=ANDROID
sort=LATEST | POPULAR
```

Quy tắc danh sách:

- Có giới hạn tối đa cho `limit`.
- Search được normalize và escape đúng theo cơ chế query của Prisma/PostgreSQL.
- `LATEST` sắp theo `publishedAt`, `POPULAR` sắp theo `downloadCount` và có tie-breaker ổn định.
- Pagination trả `page`, `limit`, `total`, `totalPages`.
- Không trả `driveUrl`, dữ liệu audit nội bộ hoặc field quản trị.

### Quản trị bằng permission

Không cần tạo một hệ `/admin` tách biệt chỉ để check `role === ADMIN`. Có thể giữ resource route thống nhất và bảo vệ mutation bằng permission middleware hiện có.

| Method | Endpoint | Permission |
| --- | --- | --- |
| `GET` | `/keyboards/manage` | `KEYBOARD_READ` |
| `POST` | `/keyboards` | `KEYBOARD_CREATE` |
| `GET` | `/keyboards/:id/manage` | `KEYBOARD_READ` |
| `PATCH` | `/keyboards/:id` | `KEYBOARD_UPDATE` |
| `DELETE` | `/keyboards/:id` | `KEYBOARD_DELETE` |
| `POST` | `/categories` | `CATEGORY_CREATE` |
| `PATCH` | `/categories/:id` | `CATEGORY_UPDATE` |
| `DELETE` | `/categories/:id` | `CATEGORY_DELETE` |

Tên permission cần được thêm vào constants/seed RBAC khi triển khai. `DELETE` phải được định nghĩa là archive/soft-delete đối với dữ liệu đã được sử dụng; không xóa cascade lịch sử download.

> Lưu ý routing: route tĩnh như `/keyboards/manage` phải được khai báo trước route động `/:slug` để tránh bị nhận nhầm là slug.

### Payload quản trị tối thiểu

```json
{
  "name": "Sakura Night",
  "slug": "sakura-night",
  "description": "Pink sakura keyboard theme",
  "coverUrl": "https://...",
  "previewImages": [
    { "url": "https://...", "altText": "Sakura Night preview", "position": 0 }
  ],
  "driveUrl": "https://drive.google.com/...",
  "platform": "ANDROID",
  "categoryIds": ["uuid-1", "uuid-2"],
  "status": "PUBLISHED"
}
```

Backend phải kiểm tra category tồn tại/đang hợp lệ, URL ảnh hợp lệ, Drive URL thuộc host được cho phép, slug không trùng và trạng thái chuyển đổi hợp lệ.

## 8. Download flow

```text
POST /api/v1/keyboards/:slug/download
        ↓
Xác thực user
        ↓
Tìm theme và kiểm tra PUBLISHED
        ↓
Kiểm tra quyền download hiện hành
        ↓
Transaction: tạo Download + atomic increment
        ↓
Audit/metrics cần thiết
        ↓
302 redirect tới Google Drive
```

MVP ưu tiên `302 redirect` để URL không xuất hiện trong API JSON hay dữ liệu list/detail. Dù vậy, người dùng vẫn có thể thấy URL đích sau redirect và chia sẻ lại; đây là giới hạn có chủ đích của Google Drive.

Các nguyên tắc bắt buộc:

- Chỉ theme `PUBLISHED` mới được tải qua public flow.
- Áp dụng auth/rate limit để hạn chế spam làm sai số bộ đếm.
- Tạo download record và tăng counter trong cùng transaction.
- Không proxy toàn bộ file qua Express.
- Không gọi/fetch URL do quản trị viên nhập trong request download; chỉ redirect tới URL đã validate và lưu trước đó.
- Không tuyên bố `downloadCount` là số lượt tải hoàn tất; đó là số lần hệ thống đã cấp redirect thành công.

Nếu sau này cần kiểm soát truy cập thật sự, chống chia sẻ link hoặc đo tải hoàn tất tốt hơn, chuyển file sang S3-compatible storage/Cloudflare R2 và dùng signed URL thời hạn ngắn.

## 9. Quy tắc nghiệp vụ

### Theme visibility

- `DRAFT`: chỉ người có quyền quản trị phù hợp được xem.
- `PUBLISHED`: xuất hiện ở public list/detail và có thể download.
- `HIDDEN`: không xuất hiện public và không cấp download mới.

### Category

- Theme có thể thuộc nhiều category.
- Không cho xóa vật lý category đang được gán; ưu tiên `isActive = false` hoặc gỡ quan hệ có chủ đích.
- Public filter chỉ nhận category active.

### Authorization

- Xem list/detail public không yêu cầu đăng nhập.
- Download yêu cầu tài khoản active.
- CRUD không phụ thuộc tên role; dùng `requirePermission(...)`.
- Service vẫn kiểm tra business rule/record state, không giao toàn bộ authorization cho frontend.

### Audit

Ghi audit log cho create/update/archive/publish/hide theme và create/update/deactivate category. Chi tiết audit không được chứa token, cookie hoặc URL bí mật ngoài mức cần thiết.

## 10. Gợi ý trải nghiệm frontend

Frontend không thuộc repository backend này, nhưng API nên hỗ trợ các khu vực:

| Trang | Mục đích |
| --- | --- |
| `/` | Landing page và theme nổi bật |
| `/keyboards` | Explore, search và filter |
| `/keyboards/[slug]` | Chi tiết, preview và download |
| `/categories/[slug]` | Danh sách theo category |
| `/profile` | Thông tin Discord; lịch sử tải có thể để sau MVP |
| `/admin` | Giao diện gọi các API quản trị có permission |

Hình preview nên ưu tiên mockup theme trên màn hình điện thoại thay vì chỉ dùng thumbnail vuông. Giao diện có thể theo hướng gaming/customization, nhưng đây là quyết định thiết kế độc lập với kiến trúc backend.

Không chốt framework frontend trong tài liệu backend này. Nếu frontend là một dự án riêng, nó chỉ cần tuân thủ contract API, CORS/cookie policy và OAuth redirect đã thống nhất.

## 11. Thứ tự triển khai đề xuất

Codebase đã có database, User, JWT, refresh token, auth middleware và Dynamic RBAC nên không lặp lại các bước nền tảng đó.

### Giai đoạn 1 — chốt contract và schema

1. Chốt quy tắc slug, platform, status và download count.
2. Thiết kế migration cho `KeyboardTheme`, `KeyboardImage`, `Category`, bảng nối và `Download`.
3. Bổ sung permission/audit action/error code ở thiết kế và seed plan.
4. Chốt API contract, pagination và public/admin response fields.

### Giai đoạn 2 — Discord OAuth

1. Mở rộng `UserSocial` flow cho provider Discord.
2. Tạo authorize/callback flow với state và redirect allowlist.
3. Tái sử dụng token/cookie/session lifecycle hiện có.
4. Xác minh login mới, login lại, account disabled và account-link conflict.

### Giai đoạn 3 — catalog

1. Category management.
2. Keyboard theme CRUD và preview ordering.
3. Public list/detail, search/filter/sort/pagination.
4. OpenAPI và automated tests cho public/admin cases.

### Giai đoạn 4 — download

1. Endpoint download có auth và kiểm tra trạng thái.
2. Transaction tạo Download + atomic increment.
3. Redirect Google Drive và rate limit.
4. Tests cho concurrency, hidden/draft theme, invalid Drive URL và unauthorized request.

### Giai đoạn 5 — hoàn thiện MVP

1. Audit log và observability.
2. Seed permissions/categories mẫu nếu thực sự cần.
3. Rà soát không lộ `driveUrl` trong public response/Swagger/log.
4. End-to-end acceptance flow từ tạo theme đến download.

## 12. Tiêu chí nghiệm thu MVP

- Người chưa đăng nhập xem được danh sách và chi tiết theme `PUBLISHED`.
- Search/filter/sort/pagination cho kết quả ổn định và có giới hạn input.
- `DRAFT` và `HIDDEN` không rò rỉ qua public API.
- Discord OAuth tạo hoặc tìm đúng user, không tạo trùng cùng Discord ID.
- User bị vô hiệu hóa không nhận được token/download redirect.
- Người không có permission không gọi được API quản trị.
- `driveUrl` không xuất hiện trong list/detail, Swagger example hoặc log public.
- Hai request download đồng thời không làm mất lượt tăng counter.
- Download record và counter không lệch do một nửa transaction thất bại.
- Theme đã có download history không bị hard-delete ngoài ý muốn.
- Toàn bộ endpoint mới có Zod validation, OpenAPI và automated tests phù hợp.

## 13. Rủi ro và giới hạn đã chấp nhận

| Rủi ro | Cách xử lý ở MVP |
| --- | --- |
| Drive URL có thể bị chia sẻ sau redirect | Chấp nhận; không quảng bá đây là DRM |
| Google Drive có quota/chính sách ngoài quyền kiểm soát | Theo dõi lỗi và chuẩn bị đường chuyển sang R2/S3 |
| Spam endpoint làm tăng download count | Auth + rate limit; định nghĩa count là số lần cấp redirect |
| OAuth account-linking sai | Unique provider ID, state, conflict handling rõ ràng |
| Public response lộ field nội bộ | Dùng DTO/select tách riêng public và management response |
| Scope phình sang premium/creator | Giữ các tính năng đó ngoài MVP |

## 14. Hướng phát triển sau MVP

Chỉ cân nhắc sau khi có dữ liệu sử dụng:

1. Discord guild membership và role-gated download.
2. R2/S3 signed URL để kiểm soát file tốt hơn.
3. Favorite và download history trên profile.
4. Premium/payment.
5. Creator profile, upload workflow và moderation.
6. Collections, rating, follow và recommendation.

Tầm nhìn dài hạn có thể phát triển thành **Theme Library × Creator Platform × Discord Community**, nhưng kiến trúc MVP chỉ cần tối ưu cho catalog, authentication, authorization và download flow đáng tin cậy.
