# Keyboard Theme Library — Đặc tả Nghiệp vụ, API Contract & DTO (Backend MVP)

Tài liệu này là đặc tả chuẩn hóa nghiệp vụ, kiến trúc dữ liệu và hợp đồng giao tiếp API (API Contract) cho Backend MVP của hệ thống **Keyboard Theme Library**. Tài liệu đóng vai trò là "Nguồn sự thật nghiệp vụ" (Single Source of Truth) để đội ngũ kỹ thuật triển khai thiết kế Prisma Schema, Migration, Validation Schemas, Services, Controllers và OpenAPI definitions ở các giai đoạn tiếp theo mà không phải tự suy đoán business rules.

---

## 1. Mục tiêu Sản phẩm & Phạm vi MVP

### 1.1. Mục tiêu cốt lõi
Xây dựng một thư viện giao diện bàn phím (**Keyboard Theme Gallery/Library**) trực quan, cho phép người dùng khám phá, tìm kiếm, lọc theo danh mục/nền tảng, xem trước hình ảnh giao diện thực tế và tải file cài đặt (được lưu trữ trên Google Drive) sau khi đã đăng nhập tài khoản thông qua Discord OAuth.

### 1.2. Đường chạy người dùng cốt lõi (Core User Flow)
```text
Khách vãng lai / Người dùng
         │
         ▼
[1] Khám phá & Tìm kiếm (Explore / Search / Filter)
    - Xem danh sách theme PUBLISHED
    - Tìm kiếm theo tên / Lọc Category / Lọc Platform
         │
         ▼
[2] Xem chi tiết Theme (Public Detail)
    - Xem ảnh Cover & Bộ sưu tập Preview Images (Mockup điện thoại)
    - Xem thông tin mô tả, danh mục, nền tảng, lượt tải
         │
         ▼
[3] Yêu cầu Tải Theme (Download Request)
    - Chưa đăng nhập? ──► Chuyển hướng đăng nhập Discord OAuth ──► Quay lại theme
    - Đã đăng nhập?   ──► Gửi yêu cầu POST /api/v1/keyboards/:slug/download
         │
         ▼
[4] Xử lý tại Backend (Atomic Transaction & Authorization)
    - Xác thực Access Token & kiểm tra tài khoản Active
    - Kiểm tra trạng thái theme (bắt buộc PUBLISHED)
    - Thực thi Transaction: Tạo bản ghi Download + Tăng atomic counter `downloadCount`
         │
         ▼
[5] Cấp quyền & Điều hướng (HTTP 302 Found)
    - Backend phản hồi 302 Redirect đưa người dùng trực tiếp tới Google Drive file URL
```

### 1.3. Bảng phân định phạm vi (Scope Boundary)

| Phân loại | Tính năng trong MVP (In-Scope) | Tính năng nằm ngoài MVP (Out-of-Scope) |
| :--- | :--- | :--- |
| **Catalog & Theme** | - Danh sách & Chi tiết Theme đã phát hành (`PUBLISHED`).<br>- Tìm kiếm theo tên, lọc theo Category, lọc theo Platform (`IOS`, `ANDROID`, `BOTH`).<br>- Hỗ trợ 1 Cover Image + nhiều Preview Images (bảng riêng).<br>- Phân loại quan hệ Many-to-Many giữa Theme và Category. | - Creator Profile / User tự upload theme.<br>- Bộ sưu tập cá nhân (Collections / Folders).<br>- Đánh giá (Rating), Bình luận (Comments), Yêu thích (Favorites).<br>- Hệ thống gợi ý AI / Đề xuất cá nhân hóa. |
| **Authentication** | - Đăng nhập qua Discord OAuth (mở rộng `UserSocial` hiện có).<br>- Tái sử dụng JWT Access Token, Refresh Token, Cookie và Session flow. | - Kiểm tra thành viên Discord Server (Guild Membership).<br>- Kiểm tra Discord Guild Roles / Đồng bộ Role Discord. |
| **Download & Storage** | - Cấp link download qua Google Drive bằng HTTP 302 Redirect.<br>- Ghi nhận lịch sử `Download` gắn với `userId` và `keyboardThemeId`.<br>- Tăng atomic `downloadCount` trong Database Transaction.<br>- Áp dụng Rate Limiting chống spam lượt tải. | - Đồng bộ tự động file từ Google Drive về Backend.<br>- Quản lý file trên S3 / Cloudflare R2 với Signed URLs thời hạn ngắn.<br>- Hệ thống bảo vệ bản quyền DRM / Chống chia sẻ link sau redirect.<br>- Cơ chế xác nhận người dùng đã tải 100% byte dữ liệu về máy. |
| **Administration** | - Quản lý Theme & Category bằng Dynamic RBAC permissions.<br>- Lifecycle: `DRAFT`, `PUBLISHED`, `HIDDEN`.<br>- Kiểm toán hành động quản trị qua `AuditLog`. | - Thanh toán, Mua bán Theme, Gói Premium / Subscription.<br>- Báo cáo doanh thu / Chia sẻ lợi nhuận tác giả (Marketplace). |

---

## 2. Chuẩn hóa Thuật ngữ & Danh pháp Kiến trúc

Nhằm đảm bảo sự nhất quán tuyệt đối giữa Business Logic, Database Models, REST Endpoints và DTOs:

| Khái niệm | Tên Domain / Database Model | Tên Bảng (Database Table) | Tên Tài nguyên REST Route | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| **Theme Bàn phím** | `KeyboardTheme` | `keyboard_themes` | `/keyboards` | Thực thể chính đại diện cho một bộ giao diện bàn phím, chứa metadata, cấu hình nền tảng, trạng thái phát hành và URL tải về. |
| **Ảnh xem trước** | `KeyboardImage` | `keyboard_images` | Quản lý lồng trong Theme | Các hình ảnh chụp màn hình / mockup trực quan hiển thị theme trên điện thoại thực tế, có thứ tự hiển thị (`position`). |
| **Danh mục** | `Category` | `categories` | `/categories` | Nhãn chủ đề phân loại theme (ví dụ: Anime, Cyberpunk, Pastel, Minimalist...). |
| **Liên kết Theme - Danh mục** | `KeyboardThemeCategory` | `keyboard_theme_categories` | Bảng nối Many-to-Many | Thể hiện mối quan hệ nhiều-nhiều giữa Theme và Category. |
| **Sự kiện Tải file** | `Download` | `downloads` | `/keyboards/:slug/download` | Bản ghi nhật ký ghi nhận **một lần backend cấp quyền và điều hướng thành công** một người dùng tới URL tải Google Drive. |

### Quyết định kiến trúc: `KeyboardTheme` (Model) vs `/keyboards` (Route)
- **Ở tầng Database & Code Model**: Sử dụng danh từ ghép đầy đủ `KeyboardTheme` để thể hiện chính xác bản chất đối tượng là "Theme của bàn phím", tránh nhầm lẫn nếu tương lai hệ thống mở rộng quản lý phần cứng bàn phím cơ hoặc layout ký tự.
- **Ở tầng HTTP REST API**: Sử dụng URI `/keyboards` (và `/categories`) theo chuẩn thiết kế RESTful hiện đại: ngắn gọn, trực quan, thân thiện với URL trình duyệt và dễ nhớ cho Client/Frontend.

---

## 3. Vòng đời & Trạng thái của Theme (Theme Lifecycle)

Mỗi `KeyboardTheme` trong hệ thống luôn ở một trong 3 trạng thái duy nhất thuộc enum `KeyboardThemeStatus`:
- `DRAFT`: Bản nháp đang biên soạn, chưa sẵn sàng công khai.
- `PUBLISHED`: Đã phát hành chính thức cho cộng đồng.
- `HIDDEN`: Đã bị ẩn / tạm ngưng cung cấp (do link hỏng, vi phạm nội dung hoặc bảo trì).

### 3.1. Ma trận Quyền truy cập & Hành vi theo Trạng thái

| Tiêu chí | `DRAFT` | `PUBLISHED` | `HIDDEN` |
| :--- | :--- | :--- | :--- |
| **Đối tượng được xem** | Chỉ Quản trị viên (`KEYBOARD_READ`) | Mọi người (Public & Quản trị viên) | Chỉ Quản trị viên (`KEYBOARD_READ`) |
| **Xuất hiện trong Public List** (`GET /keyboards`) | **KHÔNG** | **CÓ** | **KHÔNG** |
| **Truy cập Public Detail** (`GET /keyboards/:slug`) | **KHÔNG** (Trả về `404 Not Found`) | **CÓ** (Trả về `200 OK`) | **KHÔNG** (Trả về `404 Not Found`) |
| **Cho phép Download** (`POST /keyboards/:slug/download`) | **KHÔNG** (Trả về `404 Not Found`) | **CÓ** (Thực hiện cấp link & 302) | **KHÔNG** (Trả về `404 Not Found`) |
| **Cho phép Chỉnh sửa** (`PATCH /keyboards/:id`) | **CÓ** (`KEYBOARD_UPDATE`) | **CÓ** (`KEYBOARD_UPDATE`) | **CÓ** (`KEYBOARD_UPDATE`) |
| **Quy tắc gán trường `publishedAt`** | Luôn là `null` | Được gán `now()` khi chuyển từ `DRAFT` sang `PUBLISHED`. | **Giữ nguyên** giá trị `publishedAt` lịch sử (không xóa về `null`). |

> **Lưu ý bảo mật (Security by Obscurity)**: Mọi truy vấn công khai (Public API) tới theme ở trạng thái `DRAFT` hoặc `HIDDEN` đều bắt buộc trả về mã lỗi `404 NOT_FOUND` thay vì `403 FORBIDDEN` để ngăn chặn kẻ tấn công dò quét (enumeration) sự tồn tại của các slug chưa phát hành.

### 3.2. Sơ đồ & Quy tắc Chuyển đổi Trạng thái (State Transitions)

```text
       ┌──────────────┐
       │    DRAFT     │◄──────────────┐
       └──────┬───────┘               │
              │ (1) Publish           │ (4) Re-draft (Tùy chọn)
              ▼                       │
       ┌──────────────┐        ┌──────┴───────┐
  ┌───►│  PUBLISHED   ├───────►│    HIDDEN    │
  │    └──────────────┘ (2)    └──────┬───────┘
  │                         Hide      │
  └───────────────────────────────────┘
           (3) Unhide / Re-publish
```

1. **`DRAFT ──► PUBLISHED`**:
   - **Điều kiện**: Theme phải có đầy đủ thông tin bắt buộc (`name`, `slug`, `coverUrl`, `driveUrl`, `platform`, tối thiểu 1 `category`).
   - **Xử lý**: Hệ thống tự động gán `publishedAt = new Date()` (nếu trước đó `publishedAt` là `null`).
2. **`PUBLISHED ──► HIDDEN`**:
   - **Mục đích**: Ẩn theme khỏi trang chủ và chặn download ngay lập tức.
   - **Xử lý**: Giữ nguyên mốc thời gian `publishedAt` để bảo lưu lịch sử ngày phát hành ban đầu.
3. **`HIDDEN ──► PUBLISHED`**:
   - **Mục đích**: Khôi phục phát hành sau khi đã sửa lỗi file hoặc hoàn tất kiểm duyệt.
   - **Xử lý**: Giữ nguyên `publishedAt` ban đầu, không ghi đè ngày phát hành để tránh làm xáo trộn thứ tự sắp xếp theo thời gian (`LATEST`).
4. **`HIDDEN ──► DRAFT`**:
   - **Mục đích**: Chuyển lại về nháp nếu cần tái cấu trúc lớn nội dung.
5. **`PUBLISHED ──► DRAFT`**:
   - **Quy tắc**: **CẤM** chuyển trực tiếp từ `PUBLISHED` về `DRAFT`. Nếu muốn ngừng công khai một theme đã từng phát hành, bắt buộc chuyển sang `HIDDEN`.

### 3.3. Quy định về Xóa dữ liệu (Hard-delete vs Soft-delete/Archive)

- **Trường hợp Theme CHƯA CÓ lịch sử tải** (`downloads.count == 0`):
  - Cho phép thực hiện **Hard-delete** vật lý trong cơ sở dữ liệu.
  - Xóa kèm dữ liệu liên quan trong `keyboard_images` và `keyboard_theme_categories` thông qua quan hệ `onDelete: Cascade`.
- **Trường hợp Theme ĐÃ CÓ lịch sử tải** (`downloads.count > 0`):
  - **TUYỆT ĐỐI CẤM** hard-delete để bảo toàn toàn vẹn dữ liệu kiểm toán và lịch sử tải của người dùng (khóa ngoại `Download.keyboardThemeId` cấu hình `onDelete: Restrict`).
  - Khi quản trị viên gọi lệnh `DELETE /api/v1/keyboards/:id`:
    - Service tự động nhận diện theme đã có lịch sử tải và thực hiện **Archive = chuyển `status` sang `HIDDEN`**.
    - Phản hồi HTTP trả về `200 OK` kèm thông báo: `"Theme has existing download history and has been archived (hidden) instead of physically deleted"`.

---

## 4. Đặc tả Định danh & Chuẩn hóa Slug (Slug Specification)

Slug được dùng làm định danh URL thân thiện cho cả `KeyboardTheme` và `Category`.

### 4.1. Quy tắc Chuẩn hóa Slug (Normalization Algorithm)
1. Chuyển toàn bộ chuỗi ký tự về chữ thường (lowercase).
2. Chuyển đổi ký tự tiếng Việt có dấu thành không dấu (Unaccent/Diacritics stripping: ví dụ `bàn phím` ──► `ban phim`, `đỏ` ──► `do`).
3. Thay thế mọi ký tự khoảng trắng, gạch dưới và ký tự đặc biệt bằng dấu gạch ngang đơn `-`.
4. Loại bỏ các dấu gạch ngang liên tiếp (ví dụ `--` ──► `-`).
5. Cắt tỉa (trim) dấu gạch ngang ở đầu và cuối chuỗi.
6. **Định dạng chuẩn sau validate**: Biểu thức chính quy `^[a-z0-9]+(?:-[a-z0-9]+)*$` với độ dài từ 3 đến 100 ký tự.

### 4.2. Tính Duy nhất & Không phân biệt hoa thường
- Slug bắt buộc là **DUY NHẤT** trên toàn bảng (`@unique` index trong database).
- Do luôn được chuẩn hóa thành lowercase trước khi lưu và trước khi truy vấn, hệ thống đảm bảo tính duy nhất không phân biệt hoa thường (Case-insensitive uniqueness).

### 4.3. Quy tắc Cập nhật Slug & Xử lý Trùng lặp
- **Khi tạo mới**:
  - Nếu admin cung cấp slug thủ công: Hệ thống chuẩn hóa và kiểm tra trùng. Nếu trùng, trả lỗi `409 Conflict` (`DUPLICATE_ENTRY` hoặc `THEME_SLUG_EXISTS`).
  - Nếu admin không cung cấp slug: Hệ thống tự động sinh slug từ trường `name`. Nếu slug tự sinh bị trùng, tự động gắn thêm hậu tố số ngẫu nhiên dạng `kebab-slug-2`, `kebab-slug-3`.
- **Sau khi đã PUBLISHED**:
  - Admin vẫn có quyền đổi slug qua `PATCH /api/v1/keyboards/:id` (với điều kiện slug mới chưa ai dùng).
  - Tuy nhiên, hệ thống khuyến cáo hạn chế việc đổi slug để tránh làm gãy các liên kết bên ngoài và bookmark của người dùng.

### 4.4. Chính sách Chuyển hướng Slug cũ (Redirect Policy)
- **Quyết định MVP**: **KHÔNG triển khai bảng lưu trữ lịch sử slug cũ (Slug Alias / 301 Redirect Table) trong MVP** để giữ kiến trúc tinh gọn.
- Nếu slug bị thay đổi, truy cập vào URL theo slug cũ sẽ nhận về `404 Not Found`. Tính năng tự động 301 Redirect từ slug cũ được xếp vào phạm vi sau MVP (Post-MVP).

---

## 5. Danh mục Theme (Category Management & Rules)

### 5.1. Mô hình quan hệ
- Mối quan hệ giữa `KeyboardTheme` và `Category` là **Many-to-Many** thông qua bảng nối `KeyboardThemeCategory` (`keyboard_theme_categories`).
- Bảng nối chứa cặp khóa `(keyboardThemeId, categoryId)` với ràng buộc `@@unique([keyboardThemeId, categoryId])` để chống gán trùng lặp.

### 5.2. Ràng buộc gán Category & Trạng thái kích hoạt (`isActive`)
- **Bắt buộc có danh mục**: Một theme khi tạo mới hoặc khi chuyển sang trạng thái `PUBLISHED` bắt buộc phải được gán **tối thiểu 1 danh mục** (`categoryIds.length >= 1`).
- **Chỉ gán Category Active**: Backend validation sẽ từ chối nếu trong danh sách `categoryIds` có bất kỳ category nào không tồn tại hoặc đang có `isActive = false` (trả lỗi `400 Bad Request` - `CATEGORY_INACTIVE`).

### 5.3. Quy tắc Bảo vệ Toàn vẹn khi Xóa Category
- **Cấm Hard-delete Category đang được sử dụng**: Nếu một category đang được liên kết với ít nhất một theme (kể cả theme đó là draft hay hidden), endpoint `DELETE /api/v1/categories/:id` sẽ từ chối xóa và trả lỗi `400 Bad Request` (`CATEGORY_IN_USE`).
- **Phương thức Deactivate**: Khi muốn ngừng sử dụng một danh mục, quản trị viên cập nhật `isActive = false` qua `PATCH /api/v1/categories/:id`. Khi đó, category này sẽ không xuất hiện trên Public Navigation, nhưng các theme cũ vẫn giữ nguyên liên kết dữ liệu lịch sử.

### 5.4. Hành vi Bộ lọc Category tại Public API (`GET /api/v1/keyboards?category=<slug>`)
- Nếu người dùng truyền vào một `category` slug không tồn tại hoặc thuộc về một category đang bị vô hiệu hóa (`isActive = false`):
  - Backend **KHÔNG** ném lỗi 404 mà xử lý trả về danh sách rỗng chuẩn RESTful:
    ```json
    {
      "success": true,
      "data": [],
      "meta": {
        "total": 0,
        "page": 1,
        "limit": 20,
        "totalPages": 0
      }
    }
    ```

---

## 6. Nền tảng Hỗ trợ (Platform Specification & Filtering)

Hệ thống hỗ trợ 3 giá trị nền tảng cố định thông qua enum `PlatformType`:
- `IOS`: Dành riêng cho hệ điều hành iOS.
- `ANDROID`: Dành riêng cho hệ điều hành Android.
- `BOTH`: Tương thích hoàn toàn với cả iOS và Android.

### Ma trận Logic Lọc Platform (Platform Filtering Matrix)

Khi Client gọi `GET /api/v1/keyboards` kèm query `platform`:

| Giá trị Query truyền lên | Điều kiện truy vấn Database (`WHERE platform IN (...)`) | Kết quả trả về |
| :--- | :--- | :--- |
| `platform=IOS` | `['IOS', 'BOTH']` | Tất cả theme dùng được trên iOS (gồm theme chuyên iOS và theme tương thích cả hai). |
| `platform=ANDROID` | `['ANDROID', 'BOTH']` | Tất cả theme dùng được trên Android (gồm theme chuyên Android và theme tương thích cả hai). |
| `platform=BOTH` | `['BOTH']` | Chỉ những theme hỗ trợ đồng thời cả hai hệ điều hành. |
| *Không truyền query `platform`* | *Không lọc theo platform* | Toàn bộ theme thuộc tất cả nền tảng (`IOS`, `ANDROID`, `BOTH`). |

> **Quy tắc phạm vi**: Không bổ sung thêm các nền tảng khác (Windows, macOS, Linux, Web) vào phạm vi MVP.

---

## 7. Cơ chế & Ngữ nghĩa Tải file (Download Semantics & Security)

### 7.1. Định nghĩa Bản ghi `Download`
Một bản ghi trong bảng `downloads` đại diện cho **một lần hệ thống Backend đã xác thực thành công danh tính người dùng, kiểm tra trạng thái theme hợp lệ và cấp lệnh điều hướng (HTTP 302 Redirect) tới Google Drive**.
- Bản ghi này **KHÔNG** thể hiện và không đảm bảo việc người dùng đã tải trọn vẹn 100% dung lượng file về máy (do việc truyền dữ liệu tải file thực tế diễn ra trực tiếp giữa máy client và máy chủ của Google Drive).

### 7.2. Điều kiện Tiên quyết để Tải file
Một yêu cầu tải `POST /api/v1/keyboards/:slug/download` chỉ được chấp thuận khi thỏa mãn toàn bộ các điều kiện sau:
1. **Xác thực hợp lệ**: Request đính kèm JWT Access Token hợp lệ (qua Header `Authorization: Bearer <token>` hoặc Cookie `accessToken`).
2. **Tài khoản hoạt động**: Tài khoản của người dùng có `isActive = true` và `deletedAt = null`.
3. **Theme tồn tại & Đã phát hành**: Theme có `status = 'PUBLISHED'` và có trường `driveUrl` hợp lệ.
4. **Vượt qua Rate Limit**: Người dùng chưa vượt quá ngưỡng giới hạn lượt tải trong khung thời gian quy định.

### 7.3. Cách tính Bộ đếm `downloadCount` & Chống Race Condition
- `downloadCount` lưu trữ **Tổng số lượt yêu cầu tải thành công** (Total successful download requests), không phải số lượng người dùng duy nhất (Unique users). Mỗi lần một user hợp lệ click tải thành công, hệ thống sẽ ghi 1 bản ghi `Download` và tăng `downloadCount` lên 1.
- **Thực thi trong Database Transaction**:
  Thao tác chèn bản ghi vào `downloads` và tăng bộ đếm `KeyboardTheme.downloadCount` **BẮT BUỘC** nằm trong cùng một Prisma Transaction (`prisma.$transaction`).
  ```typescript
  // Atomic increment chống race condition
  await prisma.$transaction([
    prisma.download.create({
      data: {
        userId: user.id,
        keyboardThemeId: theme.id,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || null,
      },
    }),
    prisma.keyboardTheme.update({
      where: { id: theme.id },
      data: { downloadCount: { increment: 1 } },
    }),
  ]);
  ```
- **Fail-safe**: Nếu transaction ghi cơ sở dữ liệu thất bại, Backend **TUYỆT ĐỐI KHÔNG** thực hiện redirect và trả về mã lỗi `500 INTERNAL_SERVER_ERROR`.

### 7.4. Quyết định Kỹ thuật Phản hồi: HTTP 302 Found Redirect

Sau khi cân nhắc kỹ lưỡng, dự án **CHỐT DUY NHẤT một phương án phản hồi cho MVP**:
**Sử dụng HTTP Status Code `302 Found` kèm header `Location: <driveUrl>`**.

#### Phân tích Trade-off & Lý do lựa chọn:
- **Ưu điểm vượt trội**:
  1. **Bảo mật tầng ứng dụng**: `driveUrl` không bao giờ xuất hiện trong payload JSON phản hồi của API và không bị lưu vết trong Application State của Single Page App (SPA).
  2. **Trải nghiệm người dùng liền mạch**: Trình duyệt hoặc Mobile WebView tự động điều hướng sang tab Google Drive tải file ngay khi nhận phản hồi mà không cần client phải viết thêm code xử lý parse JSON và trigger `window.location`.
  3. **Tương thích chuẩn REST**: `POST` yêu cầu cấp tài nguyên tạm thời và điều hướng qua mã 302 là chuẩn kỹ thuật được công nhận rộng rãi.
- **Trade-off & Giới hạn đã chấp nhận**:
  - Khi trình duyệt nhận mã 302 và điều hướng sang Google Drive, người dùng có thể nhìn thấy URL trên thanh địa chỉ và có thể copy lại link này. Do Google Drive là dịch vụ lưu trữ ngoài và MVP không áp dụng DRM, điều này hoàn toàn được chấp nhận trong phạm vi sản phẩm.

### 7.5. Chính sách Rate Limiting & Chống Spam Download
- Áp dụng middleware Rate Limiting riêng biệt cho endpoint download: Tối đa **5 lượt download / 1 phút** trên mỗi `userId` (kết hợp IP).
- Khi vượt ngưỡng, hệ thống từ chối bằng HTTP `429 Too Many Requests` (`RATE_LIMIT_EXCEEDED`), bảo vệ database không bị spam bản ghi và giữ cho bộ đếm `downloadCount` luôn phản ánh đúng giá trị thực.

### 7.6. Giới hạn Bảo mật & Kiểm soát `driveUrl`
- `driveUrl` bắt buộc phải là URL trỏ tới dịch vụ Google Drive (`drive.google.com` hoặc `docs.google.com`). Backend áp dụng URL Validator / Allowlist khi admin nhập link.
- **TUYỆT ĐỐI KHÔNG** trả về trường `driveUrl` trong bất kỳ Public DTO nào (`KeyboardListItemDto`, `KeyboardPublicDetailDto`). `driveUrl` chỉ được phép xuất hiện trong Management Detail DTO dành riêng cho quản trị viên có quyền `KEYBOARD_READ`.

---

## 8. Cơ chế Xác thực & Phân quyền (Auth & Dynamic RBAC)

Dự án tuyệt đối không tạo thêm hệ thống phân quyền song song, không hard-code role trong code nghiệp vụ mà tái sử dụng toàn diện nền tảng sẵn có.

### 8.1. Tích hợp Discord OAuth
- Đăng nhập Discord là một phương thức xác thực mở rộng trong `auth` module.
- Khi người dùng đăng nhập Discord thành công:
  - Backend tìm hoặc tạo bản ghi trong bảng `users`.
  - Lưu thông tin định danh vào bảng `user_socials` với `provider = 'DISCORD'` và `providerUserId = <discord_user_id>`.
  - Tự động gán Role mặc định của hệ thống (`USER`).
  - Phát hành cặp JWT Access Token (15 phút) và Refresh Token theo cơ chế chuẩn hiện tại.

### 8.2. Hệ thống Quyền Dynamic RBAC (Permissions)
Dự án bổ sung 8 quyền nghiệp vụ tập trung vào hằng số `PERMISSIONS`:

```typescript
export const KEYBOARD_PERMISSIONS = {
  // Quản trị Keyboard Theme
  KEYBOARD_READ: 'KEYBOARD_READ',       // Xem danh sách quản trị (gồm Draft/Hidden) & xem Drive URL
  KEYBOARD_CREATE: 'KEYBOARD_CREATE',   // Tạo mới theme
  KEYBOARD_UPDATE: 'KEYBOARD_UPDATE',   // Cập nhật thông tin, ảnh preview, trạng thái theme
  KEYBOARD_DELETE: 'KEYBOARD_DELETE',   // Xóa theme (hoặc archive nếu đã có download)

  // Quản trị Category
  CATEGORY_READ: 'CATEGORY_READ',       // Xem danh sách quản trị category (gồm Inactive)
  CATEGORY_CREATE: 'CATEGORY_CREATE',   // Tạo mới category
  CATEGORY_UPDATE: 'CATEGORY_UPDATE',   // Cập nhật tên, slug, cờ isActive của category
  CATEGORY_DELETE: 'CATEGORY_DELETE',   // Xóa category (nếu chưa gán cho theme nào)
} as const;
```

### 8.3. Phân cấp 3 Tầng Truy cập Hệ thống

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ 1. PUBLIC ACCESS (Không cần token)                                         │
│    - GET /api/v1/keyboards (Chỉ lấy PUBLISHED)                             │
│    - GET /api/v1/keyboards/:slug (Chỉ lấy PUBLISHED)                       │
│    - GET /api/v1/categories (Chỉ lấy isActive = true)                      │
│    - GET /api/v1/auth/discord & GET /api/v1/auth/discord/callback          │
└────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 2. AUTHENTICATED USER (Yêu cầu JWT Token - authMiddleware)                 │
│    - POST /api/v1/keyboards/:slug/download (Cần tài khoản isActive = true) │
│    - GET /api/v1/auth/me                                                   │
│    - POST /api/v1/auth/logout                                              │
└────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 3. MANAGEMENT ACCESS (Yêu cầu JWT Token + Dynamic Permission)              │
│    - GET    /api/v1/keyboards/manage       ──► requirePermission('KEYBOARD_READ')   │
│    - GET    /api/v1/keyboards/manage/:id   ──► requirePermission('KEYBOARD_READ')   │
│    - POST   /api/v1/keyboards              ──► requirePermission('KEYBOARD_CREATE') │
│    - PATCH  /api/v1/keyboards/:id          ──► requirePermission('KEYBOARD_UPDATE') │
│    - DELETE /api/v1/keyboards/:id          ──► requirePermission('KEYBOARD_DELETE') │
│    - GET    /api/v1/categories/manage      ──► requirePermission('CATEGORY_READ')   │
│    - POST   /api/v1/categories             ──► requirePermission('CATEGORY_CREATE') │
│    - PATCH  /api/v1/categories/:id         ──► requirePermission('CATEGORY_UPDATE') │
│    - DELETE /api/v1/categories/:id         ──► requirePermission('CATEGORY_DELETE') │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Đặc tả Hợp đồng Giao tiếp API (API Contract)

### 9.1. Quy ước Chung
- **Base URL**: Toàn bộ endpoint được định tuyến dưới tiền tố `/api/v1`.
- **Response Format chuẩn**:
  ```json
  {
    "success": true,
    "data": {},
    "meta": {}
  }
  ```
- **Error Format chuẩn**:
  ```json
  {
    "success": false,
    "message": "Mô tả lỗi chi tiết cho client",
    "code": "ERROR_CODE_NAME"
  }
  ```

---

### 9.2. Bảng Tổng hợp Toàn bộ Endpoints

| # | Method | Path | Auth / Permission | Mục đích |
| :---: | :--- | :--- | :--- | :--- |
| **1** | `GET` | `/api/v1/keyboards` | Public | Danh sách theme đã phát hành (Search, Filter, Pagination, Sort) |
| **2** | `GET` | `/api/v1/keyboards/:slug` | Public | Chi tiết theme đã phát hành (kèm Cover & Preview Images) |
| **3** | `GET` | `/api/v1/categories` | Public | Danh sách danh mục đang hoạt động (`isActive = true`) |
| **4** | `POST` | `/api/v1/keyboards/:slug/download` | Authenticated | Kiểm tra quyền, ghi nhận download và chuyển hướng (302) tới Google Drive |
| **5** | `GET` | `/api/v1/auth/discord` | Public | Bắt đầu luồng xác thực Discord OAuth (trả về URL authorize hoặc redirect) |
| **6** | `GET` | `/api/v1/auth/discord/callback` | Public | Tiếp nhận OAuth code và state, phát hành Access/Refresh Token |
| **7** | `GET` | `/api/v1/keyboards/manage` | `KEYBOARD_READ` | Danh sách theme quản trị (lọc theo mọi status: Draft, Published, Hidden) |
| **8** | `GET` | `/api/v1/keyboards/manage/:id` | `KEYBOARD_READ` | Chi tiết theme quản trị (bao gồm `driveUrl`, audit fields) |
| **9** | `POST` | `/api/v1/keyboards` | `KEYBOARD_CREATE` | Tạo mới một theme (kèm danh sách preview images) |
| **10** | `PATCH` | `/api/v1/keyboards/:id` | `KEYBOARD_UPDATE` | Cập nhật metadata, ảnh, danh mục, trạng thái phát hành |
| **11** | `DELETE` | `/api/v1/keyboards/:id` | `KEYBOARD_DELETE` | Xóa vật lý (nếu chưa có download) hoặc lưu trữ Archive / Hidden |
| **12** | `GET` | `/api/v1/categories/manage` | `CATEGORY_READ` | Danh sách danh mục quản trị (gồm cả active và inactive) |
| **13** | `POST` | `/api/v1/categories` | `CATEGORY_CREATE` | Tạo mới danh mục |
| **14** | `PATCH` | `/api/v1/categories/:id` | `CATEGORY_UPDATE` | Cập nhật thông tin danh mục hoặc bật/tắt `isActive` |
| **15** | `DELETE` | `/api/v1/categories/:id` | `CATEGORY_DELETE` | Xóa danh mục chưa có theme nào sử dụng |

> **Lưu ý định tuyến Express**: Route tĩnh `/api/v1/keyboards/manage` bắt buộc phải được khai báo **trước** route động `/api/v1/keyboards/:slug` để tránh việc Express hiểu nhầm chuỗi `"manage"` là một `:slug`.

---

### 9.3. Chi tiết API Public & Authenticated

#### 1. `GET /api/v1/keyboards`
- **Mô tả**: Lấy danh sách theme đã phát hành phục vụ trang chủ / khám phá.
- **Auth**: Public (Không yêu cầu đăng nhập).
- **Query Parameters**:
  - `page`: Số trang, nguyên dương (Mặc định: `1`).
  - `limit`: Số phần tử/trang, từ `1` đến `100` (Mặc định: `20`).
  - `search`: Từ khóa tìm kiếm theo tên theme (Tự động trim, escape ký tự đặc biệt).
  - `category`: Slug của danh mục cần lọc (Ví dụ: `anime`, `minimalist`).
  - `platform`: Lọc theo nền tảng: `IOS` (lấy IOS + BOTH), `ANDROID` (lấy ANDROID + BOTH), `BOTH` (chỉ lấy BOTH).
  - `sort`: Tiêu chí sắp xếp:
    - `LATEST` (Mặc định): Sắp theo `publishedAt DESC, id DESC`.
    - `POPULAR`: Sắp theo `downloadCount DESC, publishedAt DESC, id DESC`.
    - `NAME_ASC`: Sắp theo `name ASC, id ASC`.
    - `NAME_DESC`: Sắp theo `name DESC, id DESC`.
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "c1f7a8b2-5e3a-4a8f-9a1b-3f2d1e0c9a8b",
        "name": "Sakura Night",
        "slug": "sakura-night",
        "coverUrl": "https://cdn.example.com/themes/sakura-cover.webp",
        "platform": "BOTH",
        "downloadCount": 1250,
        "publishedAt": "2026-08-20T10:00:00.000Z",
        "categories": [
          {
            "id": "e2a1b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
            "name": "Anime",
            "slug": "anime"
          }
        ]
      }
    ],
    "meta": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
  ```

---

#### 2. `GET /api/v1/keyboards/:slug`
- **Mô tả**: Lấy thông tin chi tiết một theme đã phát hành theo slug, kèm danh sách ảnh xem trước (Preview Images).
- **Auth**: Public.
- **Path Parameters**: `slug` (Chuỗi slug của theme, ví dụ `sakura-night`).
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "c1f7a8b2-5e3a-4a8f-9a1b-3f2d1e0c9a8b",
      "name": "Sakura Night",
      "slug": "sakura-night",
      "description": "Giao diện bàn phím hoa anh đào phong cách Anime ban đêm tuyệt đẹp.",
      "coverUrl": "https://cdn.example.com/themes/sakura-cover.webp",
      "platform": "BOTH",
      "downloadCount": 1250,
      "publishedAt": "2026-08-20T10:00:00.000Z",
      "categories": [
        {
          "id": "e2a1b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
          "name": "Anime",
          "slug": "anime"
        }
      ],
      "previewImages": [
        {
          "id": "f3b2c1d0-e4a5-4b6c-7d8e-9f0a1b2c3d4e",
          "url": "https://cdn.example.com/themes/sakura-preview-1.webp",
          "altText": "Bàn phím Sakura Night chế độ gõ chữ",
          "position": 0
        },
        {
          "id": "a4b5c6d7-e8f9-4a0b-1c2d-3e4f5a6b7c8d",
          "url": "https://cdn.example.com/themes/sakura-preview-2.webp",
          "altText": "Bàn phím Sakura Night chế độ Emoji",
          "position": 1
        }
      ]
    }
  }
  ```
- **Error Cases**:
  - `404 Not Found` (`THEME_NOT_FOUND`): Khi không tìm thấy theme hoặc theme đang ở trạng thái `DRAFT` / `HIDDEN`.

---

#### 3. `GET /api/v1/categories`
- **Mô tả**: Lấy danh sách các danh mục đang hoạt động (`isActive = true`) phục vụ menu lọc trên giao diện.
- **Auth**: Public.
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "e2a1b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
        "name": "Anime",
        "slug": "anime",
        "themeCount": 18
      },
      {
        "id": "b7c8d9e0-f1a2-4b3c-4d5e-6f7a8b9c0d1e",
        "name": "Pastel",
        "slug": "pastel",
        "themeCount": 12
      }
    ]
  }
  ```

---

#### 4. `POST /api/v1/keyboards/:slug/download`
- **Mô tả**: Xác thực người dùng, ghi nhận lịch sử tải, tăng bộ đếm và điều hướng trực tiếp sang file Google Drive.
- **Auth**: **Bắt buộc đăng nhập** (`authMiddleware`).
- **Path Parameters**: `slug` (Chuỗi slug của theme).
- **Rate Limit**: Tối đa 5 requests / phút / user.
- **Response Success (302 Found)**:
  - **HTTP Status**: `302 Found`
  - **Headers**:
    ```http
    Location: https://drive.google.com/uc?export=download&id=1A2B3C4D5E6F7G8H9I0J
    ```
- **Error Cases**:
  - `401 Unauthorized` (`UNAUTHORIZED` / `TOKEN_EXPIRED`): Chưa đăng nhập hoặc token hết hạn.
  - `403 Forbidden` (`USER_INACTIVE`): Tài khoản bị vô hiệu hóa hoặc soft-deleted.
  - `404 Not Found` (`THEME_NOT_FOUND`): Theme không tồn tại hoặc không ở trạng thái `PUBLISHED`.
  - `429 Too Many Requests` (`RATE_LIMIT_EXCEEDED`): Tải quá giới hạn cho phép trong 1 phút.
  - `500 Internal Server Error` (`DOWNLOAD_TRANSACTION_FAILED`): Gặp sự cố khi ghi database transaction (không cấp redirect).

---

#### 5. Interface Spec: Discord OAuth (`/api/v1/auth/discord` & `/callback`)
*(Đặc tả giao diện hợp đồng, phục vụ tích hợp ở Giai đoạn 2)*

- `GET /api/v1/auth/discord`:
  - Query: `redirectUri?` (Tùy chọn, phải thuộc Allowlist).
  - Hành vi: Sinh ngẫu nhiên mã `state` CSRF (lưu bộ nhớ tạm với TTL 5 phút), tạo Discord OAuth2 authorize URL với scopes `identify email` và trả về URL hoặc 302 chuyển hướng.
- `GET /api/v1/auth/discord/callback`:
  - Query: `code`, `state`.
  - Hành vi: Kiểm tra tính hợp lệ của `state`, gửi `code` lên Discord API lấy Access Token và thông tin User Profile, tìm hoặc tạo `User` kèm `UserSocial (provider = 'DISCORD')`, sau đó phát hành cặp token JWT và điều hướng người dùng quay trở lại Frontend URL.

---

### 9.4. Chi tiết API Quản trị (Management API)

#### 1. `GET /api/v1/keyboards/manage`
- **Mô tả**: Lấy danh sách theme dành cho trang quản trị, hỗ trợ lọc theo tất cả các trạng thái (`DRAFT`, `PUBLISHED`, `HIDDEN`).
- **Permission**: `KEYBOARD_READ`
- **Query Parameters**: `page`, `limit`, `search`, `status` (`DRAFT | PUBLISHED | HIDDEN`), `platform`, `categoryId`, `sort`.
- **Response Success (200 OK)**: Trả về danh sách `KeyboardManagementListItemDto` kèm metadata phân trang.

---

#### 2. `GET /api/v1/keyboards/manage/:id`
- **Mô tả**: Lấy chi tiết toàn diện của một theme theo ID phục vụ form chỉnh sửa (bao gồm `driveUrl`, người tạo, người sửa, audit dates).
- **Permission**: `KEYBOARD_READ`
- **Path Parameters**: `id` (UUID của theme).
- **Response Success (200 OK)**: Trả về `KeyboardManagementDetailDto`.

---

#### 3. `POST /api/v1/keyboards`
- **Mô tả**: Tạo mới một theme kèm danh sách ảnh preview và gán category.
- **Permission**: `KEYBOARD_CREATE`
- **Request Body (`CreateKeyboardDto`)**:
  ```json
  {
    "name": "Cyberpunk Neon 2077",
    "slug": "cyberpunk-neon-2077",
    "description": "Giao diện bàn phím Cyberpunk với hiệu ứng ánh sáng Neon rực rỡ.",
    "coverUrl": "https://cdn.example.com/themes/cyberpunk-cover.webp",
    "driveUrl": "https://drive.google.com/file/d/1XyZ987654321/view",
    "platform": "BOTH",
    "status": "DRAFT",
    "categoryIds": [
      "e2a1b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c"
    ],
    "previewImages": [
      {
        "url": "https://cdn.example.com/themes/cyberpunk-pv1.webp",
        "altText": "Giao diện chính Cyberpunk Neon",
        "position": 0
      },
      {
        "url": "https://cdn.example.com/themes/cyberpunk-pv2.webp",
        "altText": "Bàn phím số Cyberpunk Neon",
        "position": 1
      }
    ]
  }
  ```
- **Response Success (201 Created)**: Trả về `KeyboardManagementDetailDto`.
- **Validation Rules**:
  - `name`: String, 3 - 150 ký tự.
  - `slug`: String, kebab-case, 3 - 100 ký tự (nếu không truyền, tự sinh từ `name`).
  - `coverUrl`: String, định dạng URL ảnh hợp lệ (`.webp`, `.png`, `.jpg`), vượt qua kiểm tra SSRF.
  - `driveUrl`: String, bắt buộc là URL thuộc domain Google Drive (`drive.google.com` hoặc `docs.google.com`).
  - `platform`: Thuộc enum `IOS | ANDROID | BOTH`.
  - `status`: Thuộc enum `DRAFT | PUBLISHED | HIDDEN` (Mặc định: `DRAFT`).
  - `categoryIds`: Array UUID, tối thiểu 1 phần tử khi `status = PUBLISHED`, tất cả category phải tồn tại và `isActive = true`.
  - `previewImages`: Array đối tượng ảnh, tối đa 10 ảnh, `position` là số nguyên không âm không trùng lặp.

---

#### 4. `PATCH /api/v1/keyboards/:id`
- **Mô tả**: Cập nhật thông tin theme, đổi trạng thái phát hành, cập nhật danh sách ảnh preview hoặc thay đổi danh mục.
- **Permission**: `KEYBOARD_UPDATE`
- **Path Parameters**: `id` (UUID).
- **Request Body (`UpdateKeyboardDto`)**: Các trường tương tự `CreateKeyboardDto` nhưng đều là tùy chọn (partial update).
- **Response Success (200 OK)**: Trả về `KeyboardManagementDetailDto` đã cập nhật.

---

#### 5. `DELETE /api/v1/keyboards/:id`
- **Mô tả**: Xóa theme. Nếu theme chưa từng có lượt tải, xóa hoàn toàn trong database. Nếu theme đã có lịch sử tải, tự động chuyển `status = HIDDEN` (Archive).
- **Permission**: `KEYBOARD_DELETE`
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Theme deleted successfully" // hoặc "Theme archived (hidden) due to existing download history"
  }
  ```

---

#### 6. Quản trị Categories (`/api/v1/categories/*`)
- `GET /api/v1/categories/manage` (`CATEGORY_READ`): Lấy toàn bộ danh mục kèm cờ `isActive` và tổng số theme đang gán.
- `POST /api/v1/categories` (`CATEGORY_CREATE`):
  - Request Body: `{ "name": "Pastel Aesthetic", "slug": "pastel-aesthetic", "isActive": true }`.
- `PATCH /api/v1/categories/:id` (`CATEGORY_UPDATE`):
  - Request Body: `{ "name"?: string, "slug"?: string, "isActive"?: boolean }`.
- `DELETE /api/v1/categories/:id` (`CATEGORY_DELETE`):
  - Chỉ cho phép xóa khi danh mục không có bất kỳ theme nào liên kết. Nếu có, trả lỗi `400 Bad Request` (`CATEGORY_IN_USE`).

---

## 10. Đặc tả Data Transfer Objects (DTO)

### 10.1. Nguyên tắc Bảo mật DTO
1. **Tuyệt đối phân tách Public DTO và Management DTO**:
   - **Public DTOs**: `KeyboardListItemDto`, `KeyboardPublicDetailDto`, `CategoryDto`. Tuyệt đối **KHÔNG** chứa `driveUrl`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt`, `deletedAt` hoặc các dữ liệu nội bộ.
   - **Management DTOs**: `KeyboardManagementDetailDto`, `KeyboardManagementListItemDto`, `CategoryManagementDto`. Chỉ được trả về qua các endpoint đã được bảo vệ bởi quyền `KEYBOARD_READ` hoặc `CATEGORY_READ`.
2. **Loại bỏ dữ liệu nhạy cảm**: Không xuất hiện token, user password hay secret keys trong bất kỳ cấu trúc DTO nào.

---

### 10.2. Chi tiết Public DTOs

```typescript
/**
 * DTO cho từng phần tử trong danh sách công khai (Explore / Homepage)
 */
export interface KeyboardListItemDto {
  id: string;
  name: string;
  slug: string;
  coverUrl: string;
  platform: 'IOS' | 'ANDROID' | 'BOTH';
  downloadCount: number;
  publishedAt: Date | string | null;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

/**
 * DTO cho chi tiết một theme công khai
 */
export interface KeyboardPublicDetailDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string;
  platform: 'IOS' | 'ANDROID' | 'BOTH';
  downloadCount: number;
  publishedAt: Date | string | null;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  previewImages: Array<{
    id: string;
    url: string;
    altText: string | null;
    position: number;
  }>;
}

/**
 * DTO cho danh mục công khai
 */
export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  themeCount?: number;
}

/**
 * DTO cấu trúc phân trang chuẩn toàn hệ thống
 */
export interface PaginationMetaDto {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

---

### 10.3. Chi tiết Management DTOs

```typescript
/**
 * DTO chi tiết đầy đủ của theme phục vụ màn hình quản trị
 */
export interface KeyboardManagementDetailDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string;
  driveUrl: string; // CHỈ xuất hiện trong Management DTO
  platform: 'IOS' | 'ANDROID' | 'BOTH';
  status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
  downloadCount: number;
  publishedAt: Date | string | null;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
  }>;
  previewImages: Array<{
    id: string;
    url: string;
    altText: string | null;
    position: number;
    createdAt: Date | string;
  }>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * DTO cho danh sách quản trị theme
 */
export interface KeyboardManagementListItemDto {
  id: string;
  name: string;
  slug: string;
  coverUrl: string;
  driveUrl: string;
  platform: 'IOS' | 'ANDROID' | 'BOTH';
  status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
  downloadCount: number;
  publishedAt: Date | string | null;
  categoryNames: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * DTO quản trị danh mục
 */
export interface CategoryManagementDto {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  themeCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}
```

---

### 10.4. Chi tiết Request Payload DTOs

```typescript
export interface CreateKeyboardPreviewImagePayload {
  url: string;
  altText?: string;
  position: number;
}

export interface CreateKeyboardDto {
  name: string;
  slug?: string;
  description?: string;
  coverUrl: string;
  driveUrl: string;
  platform: 'IOS' | 'ANDROID' | 'BOTH';
  status?: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
  categoryIds: string[];
  previewImages?: CreateKeyboardPreviewImagePayload[];
}

export interface UpdateKeyboardDto {
  name?: string;
  slug?: string;
  description?: string;
  coverUrl?: string;
  driveUrl?: string;
  platform?: 'IOS' | 'ANDROID' | 'BOTH';
  status?: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
  categoryIds?: string[];
  previewImages?: CreateKeyboardPreviewImagePayload[];
}

export interface CreateCategoryDto {
  name: string;
  slug?: string;
  isActive?: boolean;
}

export interface UpdateCategoryDto {
  name?: string;
  slug?: string;
  isActive?: boolean;
}

export interface KeyboardQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  platform?: 'IOS' | 'ANDROID' | 'BOTH';
  sort?: 'LATEST' | 'POPULAR' | 'NAME_ASC' | 'NAME_DESC';
}
```

---

## 11. Danh mục Validation & Xử lý Mã lỗi (Error Catalog)

Khi xử lý các tình huống nghiệp vụ không hợp lệ, hệ thống sử dụng `AppError` kết hợp với các mã lỗi định danh chuẩn hóa theo định dạng `ERROR_CODE`:

| HTTP Status | Mã Lỗi (`code`) | Tình huống kích hoạt | Thông báo mẫu (`message`) |
| :---: | :--- | :--- | :--- |
| **400** | `VALIDATION_ERROR` | Dữ liệu đầu vào không vượt qua kiểm tra của Zod schema (sai kiểu, thiếu trường bắt buộc). | `Dữ liệu đầu vào không hợp lệ` |
| **400** | `INVALID_DRIVE_URL` | URL Google Drive không đúng cú pháp hoặc không thuộc allowlist (`drive.google.com`). | `URL tải file phải là đường dẫn Google Drive hợp lệ` |
| **400** | `INVALID_IMAGE_URL` | URL ảnh cover hoặc preview không đúng định dạng ảnh hoặc vi phạm SSRF check. | `Đường dẫn hình ảnh không hợp lệ hoặc không an toàn` |
| **400** | `CATEGORY_INACTIVE` | Cố gắng gán category đang có `isActive = false` vào theme. | `Không thể gán danh mục đang bị vô hiệu hóa` |
| **400** | `CATEGORY_IN_USE` | Cố gắng xóa một danh mục đang được liên kết với ít nhất một theme. | `Không thể xóa danh mục đang có theme sử dụng. Hãy chuyển sang trạng thái ẩn.` |
| **400** | `INVALID_STATUS_TRANSITION` | Chuyển đổi trạng thái không hợp lệ (ví dụ: chuyển trực tiếp từ `PUBLISHED` về `DRAFT`). | `Không thể chuyển trạng thái theme từ PUBLISHED về DRAFT` |
| **400** | `OAUTH_STATE_INVALID` | `state` trong OAuth callback không khớp hoặc bị thiếu (phòng chống CSRF). | `Mã trạng thái OAuth không hợp lệ hoặc đã hết hạn` |
| **401** | `UNAUTHORIZED` | Request yêu cầu đăng nhập nhưng không cung cấp JWT Access Token. | `Yêu cầu xác thực tài khoản` |
| **401** | `TOKEN_EXPIRED` | JWT Access Token đã hết hạn sử dụng. | `Phiên đăng nhập đã hết hạn. Vui lòng làm mới token` |
| **401** | `TOKEN_INVALID` | JWT Access Token bị sai chữ ký hoặc hỏng định dạng. | `Token xác thực không hợp lệ` |
| **403** | `FORBIDDEN` | Người dùng không đủ quyền Dynamic RBAC (ví dụ thiếu `KEYBOARD_CREATE`). | `Bạn không có quyền thực hiện hành động này` |
| **403** | `USER_INACTIVE` | Tài khoản người dùng đang bị khóa (`isActive = false`) hoặc đã bị xóa. | `Tài khoản của bạn đã bị vô hiệu hóa` |
| **404** | `THEME_NOT_FOUND` | Không tìm thấy theme theo ID/slug hoặc theme chưa ở trạng thái `PUBLISHED` (đối với Public API). | `Giao diện bàn phím không tồn tại hoặc chưa được phát hành` |
| **404** | `CATEGORY_NOT_FOUND` | Không tìm thấy danh mục theo ID hoặc slug. | `Danh mục không tồn tại` |
| **409** | `DUPLICATE_ENTRY` / `THEME_SLUG_EXISTS` | Slug của theme đã tồn tại trong cơ sở dữ liệu. | `Đường dẫn định danh (slug) của theme đã tồn tại` |
| **409** | `CATEGORY_SLUG_EXISTS` | Slug của category đã tồn tại. | `Đường dẫn định danh (slug) của danh mục đã tồn tại` |
| **409** | `OAUTH_ACCOUNT_LINK_CONFLICT` | Tài khoản Discord này đã được liên kết với một User ID khác. | `Tài khoản Discord này đã được liên kết với một người dùng khác` |
| **429** | `RATE_LIMIT_EXCEEDED` | Vượt quá số lần gọi API download hoặc auth trong khung thời gian quy định. | `Bạn đã thực hiện quá nhiều yêu cầu. Vui lòng thử lại sau giây lát` |
| **500** | `DOWNLOAD_TRANSACTION_FAILED` | Database transaction ghi nhận Download record và tăng atomic counter thất bại. | `Không thể xử lý yêu cầu tải file. Vui lòng thử lại sau` |

---

## 12. Bảng Truy vết Nghiệp vụ (Traceability Matrix)

Bảng đối chiếu đảm bảo toàn bộ Business Rules được ánh xạ đầy đủ và chính xác vào Endpoints, DTOs và Error Codes:

| Mã Quy tắc | Tên Quy tắc Nghiệp vụ | Endpoints liên quan | DTOs liên quan | Error Codes kiểm soát |
| :---: | :--- | :--- | :--- | :--- |
| **BR-01** | Public API chỉ hiển thị theme `PUBLISHED` | `GET /keyboards`<br>`GET /keyboards/:slug` | `KeyboardListItemDto`<br>`KeyboardPublicDetailDto` | `THEME_NOT_FOUND` |
| **BR-02** | Ẩn hoàn toàn `driveUrl` khỏi phản hồi Public | `GET /keyboards`<br>`GET /keyboards/:slug` | `KeyboardListItemDto`<br>`KeyboardPublicDetailDto` | *DTO Type Safety* |
| **BR-03** | Quản trị viên xem được `DRAFT`, `HIDDEN` và `driveUrl` | `GET /keyboards/manage`<br>`GET /keyboards/manage/:id` | `KeyboardManagementListItemDto`<br>`KeyboardManagementDetailDto` | `FORBIDDEN` |
| **BR-04** | Download bắt buộc đăng nhập tài khoản Active | `POST /keyboards/:slug/download` | *Không trả Body (HTTP 302)* | `UNAUTHORIZED`<br>`USER_INACTIVE` |
| **BR-05** | Ghi nhận Download + Tăng counter nguyên tử trong 1 Transaction | `POST /keyboards/:slug/download` | *Không trả Body (HTTP 302)* | `DOWNLOAD_TRANSACTION_FAILED` |
| **BR-06** | Giới hạn tần suất tải file chống spam | `POST /keyboards/:slug/download` | *Rate Limit Middleware* | `RATE_LIMIT_EXCEEDED` |
| **BR-07** | Chuẩn hóa Slug & Đảm bảo Unique | `POST /keyboards`<br>`PATCH /keyboards/:id`<br>`POST /categories`<br>`PATCH /categories/:id` | `CreateKeyboardDto`<br>`UpdateKeyboardDto`<br>`CreateCategoryDto` | `DUPLICATE_ENTRY`<br>`THEME_SLUG_EXISTS`<br>`CATEGORY_SLUG_EXISTS` |
| **BR-08** | Lọc Platform kế thừa (`IOS`/`ANDROID` bao gồm `BOTH`) | `GET /keyboards` | `KeyboardQueryDto`<br>`KeyboardListItemDto` | `VALIDATION_ERROR` |
| **BR-09** | Cấm xóa cứng Category đang có theme liên kết | `DELETE /categories/:id` | *N/A* | `CATEGORY_IN_USE` |
| **BR-10** | Cấm gán Category Inactive vào theme | `POST /keyboards`<br>`PATCH /keyboards/:id` | `CreateKeyboardDto`<br>`UpdateKeyboardDto` | `CATEGORY_INACTIVE` |
| **BR-11** | Bảo vệ theme có lịch sử tải (Archive thay vì Hard-delete) | `DELETE /keyboards/:id` | *N/A* | *Service Auto-Archive* |
| **BR-12** | Phân quyền qua Dynamic RBAC thay vì hard-code role | Toàn bộ `/manage` endpoints & Mutations | *Header Authorization* | `FORBIDDEN` |

---

## 13. Kế hoạch Thực hiện các Giai đoạn Tiếp theo

Dựa trên đặc tả hoàn chỉnh tại tài liệu này, lộ trình triển khai kỹ thuật được chia thành 4 giai đoạn nối tiếp:

```text
Giai đoạn 1 (Hiện tại) ──► Chốt Business Rules, API Contract & DTO Specification (Hoàn tất)
       │
       ▼
Giai đoạn 2 ─────────────► Thiết kế Prisma Schema, Indexes, Relations & Tạo Migration mới
       │
       ▼
Giai đoạn 3 ─────────────► Tích hợp Discord OAuth Module (UserSocial, State, Callback, JWT)
       │
       ▼
Giai đoạn 4 ─────────────► Triển khai Catalog Module (Category CRUD, Keyboard CRUD, Public List/Detail)
       │
       ▼
Giai đoạn 5 ─────────────► Triển khai Download Engine (Auth Guard, Transaction, 302 Redirect, Rate Limit)
```

---

## 14. Quyết định Kỹ thuật Đã chốt & Các điểm Mở

### 14.1. Các Quyết định Kỹ thuật Đã chốt Dứt khoát
1. **HTTP Response cho Download**: Chốt dùng **HTTP 302 Found Redirect** kèm header `Location: <driveUrl>`. Không dùng JSON response chứa URL.
2. **Mô hình Phân quyền**: Chốt dùng **Dynamic RBAC** với 8 quyền cụ thể (`KEYBOARD_*`, `CATEGORY_*`). Không tạo cột role riêng hay middleware `requireAdmin`.
3. **Mô hình Tài khoản**: Chốt sử dụng duy nhất bảng `User` và `UserSocial` hiện có. Không tạo hệ thống User/Session thứ hai.
4. **Bảo mật File URL**: Chốt nguyên tắc `driveUrl` chỉ nằm trong Management DTO và được điều hướng ngầm tại backend.
5. **Bộ đếm Tải**: Chốt `downloadCount` là tổng số lượt cấp link thành công, tăng nguyên tử trong Prisma Transaction cùng lúc tạo bản ghi `Download`.
6. **Lọc Platform**: Chốt `IOS` lấy cả `BOTH`, `ANDROID` lấy cả `BOTH`.

### 14.2. Các Quyết định Mở & Hướng xử lý Tương lai (Open Decisions)

| Vấn đề mở | Tùy chọn A (Được chọn cho MVP) | Tùy chọn B (Xem xét Post-MVP) | Tác động & Lý do chọn Tùy chọn A |
| :--- | :--- | :--- | :--- |
| **Chuyển hướng khi đổi Slug** | Không lưu lịch sử slug cũ (trả `404 Not Found` nếu truy cập slug cũ). | Tạo bảng `slug_redirects` lưu lại các slug cũ để tự động `301 Moved Permanently`. | **Chọn A**: Tiết kiệm chi phí vận hành và giữ schema tinh gọn trong giai đoạn MVP. Sẽ nâng cấp lên B nếu số lượng người dùng chia sẻ link tăng cao. |
| **Cơ chế Lưu trữ File tải** | Sử dụng Google Drive link do Admin cấu hình. | Chuyển file sang Cloudflare R2 / AWS S3 và cấp Presigned Signed URLs thời hạn 60 giây. | **Chọn A**: Phù hợp hoàn toàn với định hướng MVP không tốn chi phí băng thông lưu trữ. Sẽ chuyển đổi sang B khi cần đo đạc chính xác dung lượng tải về và hạn chế việc chia sẻ link ngoài. |
| **Kiểm soát Thành viên Discord** | Hệ thống Phân tầng Quyền tải (Discord-Gated Tiering): Hỗ trợ `FREE`, `DISCORD_MEMBER` (bắt buộc vào Discord Server) và `DISCORD_ROLE` (Server Booster / VIP) qua Bot API kèm TTL Cache (10 phút). | Đồng bộ thời gian thực qua Discord Gateway WebSocket. | **Đã hoàn thành**: Sử dụng Discord Bot API kèm in-memory TTL caching 10 phút, trả về `403 Forbidden` (`DISCORD_GUILD_REQUIRED` / `DISCORD_ROLE_REQUIRED`) kèm `inviteUrl` Discord Server để kích thích tăng trưởng cộng đồng. |

