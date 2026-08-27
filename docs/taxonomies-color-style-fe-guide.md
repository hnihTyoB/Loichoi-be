# Hướng Dẫn Tích Hợp Frontend: Taxonomies Color & Style

Tài liệu này cung cấp toàn bộ đặc tả API, cấu trúc dữ liệu và hướng dẫn UI/UX để Frontend (Web Client, Creator Studio, Admin Dashboard) tích hợp 2 taxonomy mới: **Color (Màu sắc)** và **Style (Phong cách)**.

---

## 1. Tổng Quan Kiến Trúc

- **Color**: Dùng để mô tả màu sắc đại diện của Keyboard Theme, phục vụ render Color Swatches và filter. Quan hệ **Many-to-Many** với `KeyboardTheme` (thông qua bảng `KeyboardColor`). Khuyến nghị gán **1–3 màu** cho mỗi theme.
- **Style**: Dùng để mô tả phong cách thiết kế / hình ảnh của Keyboard Theme (như *Kawaii, Minimal, Cyberpunk, Retro, Glass, Pixel, Neon, Dark, Pastel, Y2K*), phục vụ Filter Chips và tag hiển thị. Quan hệ **Many-to-Many** với `KeyboardTheme` (thông qua bảng `KeyboardStyle`).
- **Behavior khi xóa Taxonomy**: Khi Admin xóa một Color hoặc Style, hệ thống tự động xóa liên kết trong bảng trung gian (`onDelete: Cascade`), **không** làm mất theme.

---

## 2. Cấu Trúc Dữ Liệu (Data Contracts)

### 2.1. Color Entity
```typescript
interface ColorDto {
  id: string;          // UUID
  name: string;        // Ví dụ: "Pink", "Pastel Blue"
  slug: string;        // Ví dụ: "pink", "pastel-blue"
  hex: string;         // Mã hex chuẩn uppercase, ví dụ: "#FFB7C5", "#FFFFFF"
  themeCount?: number; // Số lượng theme PUBLISHED tương ứng
  createdAt: string;   // ISO Date (Management API)
  updatedAt: string;   // ISO Date (Management API)
}

interface KeyboardColorSummaryDto {
  id: string;
  name: string;
  slug: string;
  hex: string;
}
```

### 2.2. Style Entity
```typescript
interface StyleDto {
  id: string;                 // UUID
  name: string;               // Ví dụ: "Cyberpunk", "Kawaii"
  slug: string;               // Ví dụ: "cyberpunk", "kawaii"
  description?: string | null;// Mô tả phong cách
  themeCount?: number;        // Số lượng theme PUBLISHED tương ứng
  createdAt: string;          // ISO Date (Management API)
  updatedAt: string;          // ISO Date (Management API)
}

interface KeyboardStyleSummaryDto {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}
```

### 2.3. Cấu trúc Color & Style trong Keyboard Theme Response
Trong các API `GET /api/v1/keyboards`, `GET /api/v1/keyboards/:slug`, `GET /api/v1/keyboards/me/liked`, mỗi theme object sẽ chứa thêm 2 mảng:
```json
{
  "id": "7b04fa8d-b3b3-4f9e-8c8c-1e2f3a4b5c6d",
  "name": "Sakura Dream",
  "slug": "sakura-dream",
  "coverUrl": "https://images.unsplash.com/photo-1522383225653-ed111181a951",
  "platform": "BOTH",
  "accessLevel": "FREE",
  "requiredDiscordRoleIds": [],
  "downloadCount": 126000,
  "likeCount": 3400,
  "isFeatured": true,
  "isLiked": false,
  "publishedAt": "2026-08-27T06:00:00.000Z",
  "author": {
    "id": "11111111-2222-3333-4444-555555555555",
    "fullName": "Kuro Themes",
    "username": "kurothemes",
    "avatarUrl": "https://example.com/avatar.jpg"
  },
  "categories": [
    { "id": "cat-uuid-1", "name": "Pastel", "slug": "pastel" },
    { "id": "cat-uuid-2", "name": "Anime", "slug": "anime" }
  ],
  "colors": [
    { "id": "col-uuid-1", "name": "Pink", "slug": "pink", "hex": "#FFB7C5" },
    { "id": "col-uuid-2", "name": "White", "slug": "white", "hex": "#FFFFFF" }
  ],
  "styles": [
    { "id": "sty-uuid-1", "name": "Kawaii", "slug": "kawaii", "description": "Cute, anime and soft aesthetic" },
    { "id": "sty-uuid-2", "name": "Pastel", "slug": "pastel", "description": "Gentle, soothing pastel color palette" }
  ]
}
```

---

## 3. Danh Sách API Endpoints

### 3.1. Public Endpoints (Dành cho Người Dùng / Filter Trực Quan)

#### 1. Lấy danh sách Color để render bộ lọc Swatch
- **Endpoint**: `GET /api/v1/colors`
- **Authentication**: Không yêu cầu
- **Response**:
```json
{
  "success": true,
  "data": [
    { "id": "col-1", "name": "Black", "slug": "black", "hex": "#1E1E2E", "themeCount": 42 },
    { "id": "col-2", "name": "Blue", "slug": "blue", "hex": "#A2CFFE", "themeCount": 18 },
    { "id": "col-3", "name": "Pastel Blue", "slug": "pastel-blue", "hex": "#CDE4FE", "themeCount": 25 },
    { "id": "col-4", "name": "Pink", "slug": "pink", "hex": "#FFB7C5", "themeCount": 64 },
    { "id": "col-5", "name": "Purple", "slug": "purple", "hex": "#B57EDC", "themeCount": 31 },
    { "id": "col-6", "name": "White", "slug": "white", "hex": "#FFFFFF", "themeCount": 55 }
  ]
}
```

#### 2. Lấy danh sách Style để render bộ lọc Chips
- **Endpoint**: `GET /api/v1/styles`
- **Authentication**: Không yêu cầu
- **Response**:
```json
{
  "success": true,
  "data": [
    { "id": "sty-1", "name": "Cyberpunk", "slug": "cyberpunk", "description": "Futuristic neon-inspired visual style", "themeCount": 12 },
    { "id": "sty-2", "name": "Glass", "slug": "glass", "description": "Glassmorphism and frosted transparent aesthetic", "themeCount": 9 },
    { "id": "sty-3", "name": "Kawaii", "slug": "kawaii", "description": "Cute, anime and soft aesthetic", "themeCount": 48 },
    { "id": "sty-4", "name": "Minimal", "slug": "minimal", "description": "Clean, simple and modern design", "themeCount": 35 }
  ]
}
```

#### 3. Tìm kiếm và Lọc Theme với Color & Style
- **Endpoint**: `GET /api/v1/keyboards`
- **Query Parameters bổ sung**:
  - `color`: Lọc theo 1 màu (slug), ví dụ `?color=pink`.
  - `colors`: Lọc theo nhiều màu (dấu phẩy), ví dụ `?colors=pink,purple,white`.
  - `style`: Lọc theo 1 style (slug), ví dụ `?style=cyberpunk`.
  - `styles`: Lọc theo nhiều styles (dấu phẩy), ví dụ `?styles=kawaii,pastel`.
- **Semantics logic của Backend**:
  - Khi truyền `colors=pink,purple`: Ngữ nghĩa là **OR** (Theme chứa màu Pink HOẶC màu Purple).
  - Khi truyền `styles=kawaii,minimal`: Ngữ nghĩa là **OR** (Theme có style Kawaii HOẶC Minimal).
  - Khi kết hợp cả `colors` và `styles` (ví dụ `?colors=pink,purple&styles=kawaii`): Ngữ nghĩa là **AND** giữa các nhóm taxonomy (Theme phải có [Pink hoặc Purple] VÀ [Kawaii]).

---

### 3.2. Admin / Studio Endpoints

#### 1. Quản lý Color (`/api/v1/colors`)
| Method | Path | Quyền yêu cầu | Body / Params | Mục đích |
|---|---|---|---|---|
| `GET` | `/api/v1/colors/manage` | `COLOR_READ` | Query: `page`, `limit`, `search` | Danh sách quản trị phân trang |
| `GET` | `/api/v1/colors/manage/:id` | `COLOR_READ` | Param: `id` (UUID) | Chi tiết 1 màu |
| `POST` | `/api/v1/colors` | `COLOR_CREATE` | `{ "name": "Mint Green", "hex": "#98FF98", "slug": "mint-green" }` | Tạo mới màu (`slug` optional) |
| `PATCH` | `/api/v1/colors/:id` | `COLOR_UPDATE` | `{ "name": "Neon Pink", "hex": "#FF1493" }` | Sửa màu |
| `DELETE` | `/api/v1/colors/:id` | `COLOR_DELETE` | Param: `id` (UUID) | Xóa màu (Tự động gỡ khỏi theme) |

#### 2. Quản lý Style (`/api/v1/styles`)
| Method | Path | Quyền yêu cầu | Body / Params | Mục đích |
|---|---|---|---|---|
| `GET` | `/api/v1/styles/manage` | `STYLE_READ` | Query: `page`, `limit`, `search` | Danh sách quản trị phân trang |
| `GET` | `/api/v1/styles/manage/:id` | `STYLE_READ` | Param: `id` (UUID) | Chi tiết 1 style |
| `POST` | `/api/v1/styles` | `STYLE_CREATE` | `{ "name": "Vaporwave", "description": "80s retro synth visual", "slug": "vaporwave" }` | Tạo mới style (`slug` optional) |
| `PATCH` | `/api/v1/styles/:id` | `STYLE_UPDATE` | `{ "name": "Synthwave", "description": "Updated desc" }` | Sửa style |
| `DELETE` | `/api/v1/styles/:id` | `STYLE_DELETE` | Param: `id` (UUID) | Xóa style (Tự động gỡ khỏi theme) |

#### 3. Tạo / Chỉnh sửa Keyboard Theme với Color & Style
Khi gọi `POST /api/v1/keyboards` hoặc `PATCH /api/v1/keyboards/:id`:
```json
{
  "name": "Cyberpunk Neon Blue",
  "coverUrl": "https://cdn.example.com/cover.webp",
  "driveUrl": "https://drive.google.com/file/d/xxxx/view",
  "platform": "BOTH",
  "status": "PUBLISHED",
  "categoryIds": ["05d21a24-2c7c-473d-82d2-8b431fc576a0"],
  "colorIds": [
    "3f7a1b2c-...", 
    "8d9e2a1b-..."
  ],
  "styleIds": [
    "5c6d7e8f-..."
  ]
}
```

---

## 4. Hướng Dẫn Triển Khai UI/UX Cho Frontend

### 4.1. Color Swatch Filter Component
```tsx
// Gợi ý cấu trúc Component ColorFilter
interface ColorFilterProps {
  colors: ColorDto[];
  selectedColors: string[]; // Mảng các slugs: ['pink', 'purple']
  onChange: (newSelected: string[]) => void;
}

export const ColorFilter: React.FC<ColorFilterProps> = ({ colors, selectedColors, onChange }) => {
  const toggleColor = (slug: string) => {
    if (selectedColors.includes(slug)) {
      onChange(selectedColors.filter((s) => s !== slug));
    } else {
      onChange([...selectedColors, slug]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {colors.map((color) => {
        const isSelected = selectedColors.includes(color.slug);
        return (
          <button
            key={color.id}
            onClick={() => toggleColor(color.slug)}
            title={`${color.name} (${color.themeCount ?? 0} themes)`}
            className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
              isSelected ? 'ring-2 ring-primary ring-offset-2 scale-110' : 'border-gray-200 hover:scale-105'
            }`}
            style={{ backgroundColor: color.hex }}
          >
            {isSelected && (
              <span className={`text-xs ${isLightColor(color.hex) ? 'text-black' : 'text-white'}`}>
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// Helper nhận biết màu sáng/tối để đổi màu checkmark
function isLightColor(hex: string) {
  const c = hex.replace('#', '');
  const rgb = parseInt(c, 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 180;
}
```

### 4.2. Style Filter Chips Component
```tsx
export const StyleFilterChips: React.FC<StyleFilterProps> = ({ styles, selectedStyles, onChange }) => {
  return (
    <div className="flex flex-wrap gap-1.5">
      {styles.map((style) => {
        const isSelected = selectedStyles.includes(style.slug);
        return (
          <button
            key={style.id}
            onClick={() => toggleStyle(style.slug)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              isSelected
                ? 'bg-primary text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            #{style.name}
          </button>
        );
      })}
    </div>
  );
};
```

### 4.3. Form Chọn Color & Style Trong Admin / Creator Studio
- **Color Selector**: Render dạng multi-select swatch grid. Khi click vào 1 ô màu, viền sáng lên và thêm ID vào `colorIds`. Giới hạn người dùng chọn tối đa 3 màu đại diện để bảo đảm giao diện gọn gàng.
- **Style Selector**: Render dạng multi-select tag input hoặc checkable badges.

---

## 5. Danh Sách Error Codes Cần Xử Lý Trên Frontend

| Error Code | HTTP Status | Thông điệp | Cách xử lý trên FE |
|---|---|---|---|
| `COLOR_NOT_FOUND` | 404 / 400 | Màu sắc không tồn tại hoặc ID không hợp lệ | Hiển thị toast lỗi, tải lại danh sách màu sắc |
| `COLOR_SLUG_EXISTS` | 409 | Slug màu sắc đã tồn tại | Focus vào ô slug/tên và báo lỗi trùng |
| `INVALID_HEX_COLOR` | 400 | Mã hex không đúng định dạng `#RRGGBB` | Hiển thị validate lỗi tại Color Picker |
| `STYLE_NOT_FOUND` | 404 / 400 | Phong cách không tồn tại | Hiển thị toast lỗi, tải lại danh sách style |
| `STYLE_SLUG_EXISTS` | 409 | Slug phong cách đã tồn tại | Báo lỗi trùng tên/slug phong cách |
