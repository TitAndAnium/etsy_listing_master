export type ApiMode = 'legacy' | 'v2';

export type InputMode = 'name' | 'short' | 'dump';

export type FieldType = 'title' | 'description' | 'tags';

export interface TargetingSettings {
  audience?: string;
  age_bracket?: '18-24' | '25-34' | '35-44' | '45-54' | '55+' | 'custom';
  niche?: string;
  tone_profile?: string;
  gift_mode?: boolean;
  gift_emotion?: string;
}

export interface UserCreditsSummary {
  uid: string;
  credits: number;
}

export interface WalletLedgerEntry {
  id: string;
  [key: string]: unknown;
}

export interface UserWalletSummary {
  uid: string;
  credits: number;
  ledger: WalletLedgerEntry[];
}

export interface GenerateRequest {
  mode: InputMode;
  payload: string;
  uid?: string;
  settings?: TargetingSettings;
}

export interface FieldPayload {
  value: string;
  retry_reason: string;
  warnings: string[];
}

export interface TagsPayload {
  items: string[];
  retry_reason: string;
  warnings: string[];
  invalid?: string[];
}

export interface GenerateResponseMeta {
  prompt_version: string;
  model: string;
  token_usage: Record<string, unknown>;
  context_used: TargetingSettings;
}

export interface GenerateResponse {
  title: FieldPayload;
  description: FieldPayload;
  tags: TagsPayload;
  meta: GenerateResponseMeta;
}

export interface RegenerateRequest {
  field: FieldType;
  context: {
    ai_fields: Record<string, unknown>;
    user_edits?: Record<string, unknown>;
  } & TargetingSettings;
}

export interface RegenerateResponse {
  field: FieldType;
  payload: FieldPayload | TagsPayload;
  meta: GenerateResponseMeta;
}

export interface ReviewEditRequest {
  field: FieldType;
  user_edits: {
    before: string | string[];
    after: string | string[];
  };
}

export type AuthTokenProvider = () => Promise<string | null>;

export interface ListingApiClient {
  generateListing(request: GenerateRequest): Promise<GenerateResponse>;
  regenerateField(request: RegenerateRequest): Promise<RegenerateResponse>;
  reviewUserEdit(request: ReviewEditRequest): Promise<void>;
  getUserCredits(): Promise<UserCreditsSummary>;
  getWallet(): Promise<UserWalletSummary>;
}

export class UnsupportedOperationError extends Error {
  constructor(operation: string) {
    super(`${operation} is not supported in legacy API mode.`);
    this.name = 'UnsupportedOperationError';
  }
}

export class HttpError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, details: unknown) {
    const message = typeof details === 'object' && details && 'error' in (details as Record<string, unknown>)
      ? String((details as Record<string, unknown>).error)
      : `Request failed with status ${status}`;
    super(message);
    this.status = status;
    this.details = details;
  }
}
