import type {
  AuthTokenProvider,
  GenerateRequest,
  GenerateResponse,
  ListingApiClient,
  RegenerateRequest,
  RegenerateResponse,
  ReviewEditRequest,
  UserCreditsSummary,
  UserWalletSummary,
} from './types';
import { HttpError } from './types';
import { getApiBaseUrl } from './env';

function resolveEndpoint(path: string): string {
  const base = getApiBaseUrl();
  return `${base}/${path.replace(/^\//, '')}`;
}

async function buildHeaders(tokenProvider: AuthTokenProvider): Promise<HeadersInit> {
  const token = await tokenProvider();
  if (!token) {
    throw new Error('Authentication token is required for this request.');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  } satisfies HeadersInit;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  const payload = contentType?.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const error = typeof payload === 'string' ? { message: payload } : payload;
    throw new HttpError(response.status, error);
  }

  return payload as T;
}

export class V2Client implements ListingApiClient {
  constructor(private readonly authTokenProvider: AuthTokenProvider) {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(resolveEndpoint(path), {
      method: 'POST',
      headers: await buildHeaders(this.authTokenProvider),
      body: JSON.stringify(body),
    });
    return parseResponse<T>(response);
  }

  generateListing(body: GenerateRequest): Promise<GenerateResponse> {
    return this.post<GenerateResponse>('api_generateV2', body);
  }

  regenerateField(body: RegenerateRequest): Promise<RegenerateResponse> {
    // TODO: backend-route nog afstemmen
    return this.post<RegenerateResponse>('regenerate', body);
  }

  async reviewUserEdit(body: ReviewEditRequest): Promise<void> {
    // TODO: backend-route nog afstemmen
    await this.post('review-ai-fields', body);
  }

  async getUserCredits(): Promise<UserCreditsSummary> {
    const response = await fetch(resolveEndpoint('api_getUserCredits'), {
      method: 'GET',
      headers: await buildHeaders(this.authTokenProvider),
    });
    return parseResponse<UserCreditsSummary>(response);
  }

  async getWallet(): Promise<UserWalletSummary> {
    const response = await fetch(resolveEndpoint('api_getWallet'), {
      method: 'GET',
      headers: await buildHeaders(this.authTokenProvider),
    });
    return parseResponse<UserWalletSummary>(response);
  }
}
