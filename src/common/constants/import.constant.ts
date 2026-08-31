export const IMPORT_JOB_STATUS = {
  DISCOVERED: 'DISCOVERED',
  PROCESSING: 'PROCESSING',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  APPROVED: 'APPROVED',
  IMPORTED: 'IMPORTED',
  FAILED: 'FAILED',
  DUPLICATE: 'DUPLICATE',
  SKIPPED: 'SKIPPED',
} as const;

export type ImportJobStatus = (typeof IMPORT_JOB_STATUS)[keyof typeof IMPORT_JOB_STATUS];

export const IMPORT_JOB_PHASE = {
  COLLECT: 'COLLECT',
  NORMALIZE: 'NORMALIZE',
  PARSE: 'PARSE',
  AI: 'AI',
  DRAFT: 'DRAFT',
  DONE: 'DONE',
} as const;

export type ImportJobPhase = (typeof IMPORT_JOB_PHASE)[keyof typeof IMPORT_JOB_PHASE];

export const DRAFT_VALIDATION_STATUS = {
  PENDING: 'PENDING',
  VALID: 'VALID',
  INVALID: 'INVALID',
} as const;

export type DraftValidationStatus = (typeof DRAFT_VALIDATION_STATUS)[keyof typeof DRAFT_VALIDATION_STATUS];

export const DOWNLOAD_SOURCE = {
  GOOGLE_DRIVE: 'GOOGLE_DRIVE',
  DISCORD_ATTACHMENT: 'DISCORD_ATTACHMENT',
} as const;

export type DownloadSource = (typeof DOWNLOAD_SOURCE)[keyof typeof DOWNLOAD_SOURCE];

export const IMPORT_FLAG = {
  MISSING_COVER: 'MISSING_COVER',
  MISSING_DOWNLOAD: 'MISSING_DOWNLOAD',
  DRIVE_LINK_UNREACHABLE: 'DRIVE_LINK_UNREACHABLE',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  OUT_OF_TAXONOMY: 'OUT_OF_TAXONOMY',
  POSSIBLE_DUPLICATE: 'POSSIBLE_DUPLICATE',
  MISSING_THREAD_NAME: 'MISSING_THREAD_NAME',
  REF_NUMBER_NOT_FOUND: 'REF_NUMBER_NOT_FOUND',
} as const;

export type ImportFlag = (typeof IMPORT_FLAG)[keyof typeof IMPORT_FLAG];

export const DUPLICATE_REASON = {
  THREAD_ID: 'thread_id',
  DRIVE_URL: 'drive_url',
  FILE_IDENTITY: 'file_identity',
  NAME_SIMILARITY: 'name_similarity',
} as const;

export type DuplicateReason = (typeof DUPLICATE_REASON)[keyof typeof DUPLICATE_REASON];

/** Minimum AI confidence across all fields to be a Bulk Approve candidate (default, overridden by SystemConfig) */
export const DEFAULT_AI_CONFIDENCE_THRESHOLD = 0.85;

/** Maximum items per bulk approve operation (default, overridden by SystemConfig) */
export const DEFAULT_BULK_APPROVE_MAX = 50;
