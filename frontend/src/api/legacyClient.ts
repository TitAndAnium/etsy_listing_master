import { postGenerate } from './httpGenerate';
import type {
  GenerateRequest,
  GenerateResponse,
  ListingApiClient,
  RegenerateRequest,
  RegenerateResponse,
  ReviewEditRequest,
  TargetingSettings,
  UserCreditsSummary,
  UserWalletSummary,
} from './types';
import { UnsupportedOperationError } from './types';

type LegacyFieldShape =
  | string
  | {
      value?: string;
      retry_reason?: string;
      warnings?: string[];
      invalid?: string[];
    };

type LegacyTagsShape =
  | string[]
  | {
      items?: string[];
      retry_reason?: string;
      warnings?: string[];
      invalid?: string[];
    };

interface LegacyResultEnvelope {
  fields?: {
    title?: LegacyFieldShape;
    description?: LegacyFieldShape;
    tags?: LegacyTagsShape;
  };
  meta?: Record<string, unknown>;
}

interface LegacyGenerateResponse {
  ok: boolean;
  result?: LegacyResultEnvelope;
  error?: string;
}

interface NormalizedFieldPayload {
  value: string;
  retry_reason: string;
  warnings: string[];
}

interface NormalizedTagsPayload {
  items: string[];
  retry_reason: string;
  warnings: string[];
  invalid?: string[];
}

function normaliseFieldPayload(source: LegacyFieldShape, fallbackValue = ''): NormalizedFieldPayload {
  if (typeof source === 'string') {
    return {
      value: source,
      retry_reason: '',
      warnings: [],
    };
  }

  if (source && typeof source === 'object') {
    const value = typeof source.value === 'string' ? source.value : fallbackValue;
    const warnings = Array.isArray(source.warnings) ? [...source.warnings] : [];
    const retryReason = typeof source.retry_reason === 'string' ? source.retry_reason : '';

    return {
      value,
      retry_reason: retryReason,
      warnings,
    };
  }

  return {
    value: fallbackValue,
    retry_reason: '',
    warnings: [],
  };
}

function normaliseTagsPayload(source: LegacyTagsShape): NormalizedTagsPayload {
  if (Array.isArray(source)) {
    return {
      items: [...source],
      retry_reason: '',
      warnings: [],
    };
  }

  if (source && typeof source === 'object') {
    const items = Array.isArray(source.items) ? [...source.items] : [];
    const warnings = Array.isArray(source.warnings) ? [...source.warnings] : [];
    const retryReason = typeof source.retry_reason === 'string' ? source.retry_reason : '';
    const invalid = Array.isArray(source.invalid) ? [...source.invalid] : undefined;
    return {
      items,
      retry_reason: retryReason,
      warnings,
      invalid,
    };
  }

  return {
    items: [],
    retry_reason: '',
    warnings: [],
  };
}

export class LegacyClient implements ListingApiClient {
  async generateListing(request: GenerateRequest): Promise<GenerateResponse> {
    const { payload, uid } = request;
    if (!uid) {
      throw new Error('Legacy API mode requires a `uid` in the generate request payload.');
    }

    const legacyResponse = (await postGenerate(payload, uid)) as LegacyGenerateResponse;
    if (!legacyResponse.ok) {
      throw new Error(legacyResponse.error ?? 'Legacy generate request failed.');
    }

    const fields = legacyResponse.result?.fields ?? {};
    const title = normaliseFieldPayload(fields.title ?? '', '');
    const description = normaliseFieldPayload(fields.description ?? '', '');
    const tags = normaliseTagsPayload(fields.tags ?? []);
    const meta = legacyResponse.result?.meta ?? {};

    const contextUsed = (meta.context_used as TargetingSettings | undefined) ?? (request.settings ?? {});

    return {
      title: {
        value: title.value,
        retry_reason: title.retry_reason,
        warnings: title.warnings,
      },
      description: {
        value: description.value,
        retry_reason: description.retry_reason,
        warnings: description.warnings,
      },
      tags: {
        items: tags.items,
        retry_reason: tags.retry_reason,
        warnings: tags.warnings,
        invalid: tags.invalid,
      },
      meta: {
        prompt_version: (meta.prompt_version as string) ?? 'legacy',
        model: (meta.model as string) ?? 'legacy',
        token_usage: (meta.token_usage as Record<string, unknown>) ?? {},
        context_used: contextUsed,
      },
    };
  }

  async regenerateField(_: RegenerateRequest): Promise<RegenerateResponse> {
    throw new UnsupportedOperationError('regenerateField');
  }

  async reviewUserEdit(_: ReviewEditRequest): Promise<void> {
    throw new UnsupportedOperationError('reviewUserEdit');
  }

  async getUserCredits(): Promise<UserCreditsSummary> {
    throw new UnsupportedOperationError('getUserCredits');
  }

  async getWallet(): Promise<UserWalletSummary> {
    throw new UnsupportedOperationError('getWallet');
  }
}
