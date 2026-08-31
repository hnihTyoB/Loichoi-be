import {
  ImportJob,
  KeyboardDraft,
  DiscordThread,
  Category,
  Color,
  Style,
  KeyboardTheme,
} from '@prisma/client';

// ──────────────────────────────────────────────
// Raw Input (từ Bot / external POST)
// ──────────────────────────────────────────────

export interface DiscordMessageRaw {
  messageId: string;
  author: string;
  content: string;
  timestamp: string;
  attachments: DiscordAttachmentRaw[];
  embeds: unknown[];
}

export interface DiscordAttachmentRaw {
  filename: string;
  url: string;
  contentType?: string;
  size?: number;
  width?: number;
  height?: number;
  messageId: string;
}

export interface CreateImportJobPayload {
  discordThreadId: string;
  discordChannelId?: string;
  originalName: string;
  discordReferenceNumber?: number;
  createdAtDiscord?: string;
  messages: DiscordMessageRaw[];
}

// ──────────────────────────────────────────────
// Normalized Input (sau Normalization layer)
// ──────────────────────────────────────────────

export interface NormalizedImportInput {
  threadId: string;
  originalName: string;
  referenceNumber?: number;
  images: NormalizedImage[];
  files: NormalizedFile[];
  links: NormalizedLink[];
  allTextContent: string;
}

export interface NormalizedImage {
  url: string;
  filename: string;
  messageId: string;
  width?: number | null;
  height?: number | null;
  position: number;
}

export interface NormalizedFile {
  filename: string;
  extension: string;
  url: string;
  size?: number | null;
  messageId: string;
}

export interface NormalizedLink {
  url: string;
  type: 'GOOGLE_DRIVE' | 'OTHER';
  messageId: string;
}

// ──────────────────────────────────────────────
// Response DTOs
// ──────────────────────────────────────────────

export type ImportJobWithDraftAndThread = ImportJob & {
  thread: DiscordThread;
  draft: KeyboardDraftWithRelations | null;
};

export type KeyboardDraftWithRelations = KeyboardDraft;

/** Lightweight DTO cho danh sách Bulk Review */
export interface ImportJobListItemDto {
  id: string;
  status: string;
  phase: string;
  retryCount: number;
  lastError: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  thread: {
    id: string;
    discordThreadId: string;
    discordReferenceNumber: number | null;
    originalName: string;
  };
  draft: ImportDraftSummaryDto | null;
}

export interface ImportDraftSummaryDto {
  id: string;
  englishName: string | null;
  platform: string | null;
  downloadSource: string | null;
  coverUrl: string | null;
  previewUrls: string[];
  isDuplicateCandidate: boolean;
  duplicateReason: string | null;
  validationStatus: string;
  flags: string[] | null;
  confidenceScore: number | null; // min of all confidence fields
  suggestedCategoryIds: string[];
  suggestedColorIds: string[];
  suggestedStyleIds: string[];
}

/** Full DTO cho Detail Review — does NOT extend list DTO to avoid type conflicts */
export interface ImportJobDetailDto {
  id: string;
  status: string;
  phase: string;
  retryCount: number;
  lastError: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  thread: {
    id: string;
    discordThreadId: string;
    discordReferenceNumber: number | null;
    originalName: string;
  };
  draft: ImportDraftDetailDto | null;
}

export interface ImportDraftDetailDto {
  id: string;
  englishName: string | null;
  description: string | null;
  platform: string | null;
  downloadSource: string | null;
  downloadUrl: string | null;
  downloadDiscordMsgId: string | null;
  downloadFileName: string | null;
  coverUrl: string | null;
  previewUrls: string[];
  isDuplicateCandidate: boolean;
  duplicateOfId: string | null;
  duplicateReason: string | null;
  flags: string[] | null;
  validationStatus: string;
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  keyboardThemeId: string | null;

  // AI confidence
  confidenceName: number | null;
  confidenceCategory: number | null;
  confidenceColor: number | null;
  confidenceStyle: number | null;
  confidenceDescription: number | null;

  // Taxonomy references (IDs → resolved by FE with taxonomy lists)
  suggestedCategoryIds: string[];
  suggestedColorIds: string[];
  suggestedStyleIds: string[];
  suggestedTags: SuggestedTagItem[] | null;
}

export interface SuggestedTagItem {
  type: 'category' | 'color' | 'style';
  name: string;
  confidence: number;
}

/** Payload cho Admin sửa draft */
export interface UpdateDraftPayload {
  englishName?: string;
  description?: string;
  platform?: string;
  downloadSource?: string;
  downloadUrl?: string;
  suggestedCategoryIds?: string[];
  suggestedColorIds?: string[];
  suggestedStyleIds?: string[];
  adminNotes?: string;
}

/** Payload cho Bulk Approve */
export interface BulkApprovePayload {
  jobIds: string[];
}

/** Result của 1 lần Approve */
export interface ApproveResult {
  importJobId: string;
  keyboardThemeId: string;
  slug: string;
}

export interface BulkApproveResult {
  succeeded: ApproveResult[];
  failed: Array<{ importJobId: string; reason: string }>;
}

/** Filter params cho list endpoint */
export interface ImportJobFilter {
  status?: string;
  validationStatus?: string;
  isDuplicateCandidate?: boolean;
  minConfidence?: number;
  hasFlags?: boolean;
  page?: number;
  limit?: number;
}
