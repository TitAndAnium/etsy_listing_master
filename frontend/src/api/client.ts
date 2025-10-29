import { LegacyClient } from './legacyClient';
import { V2Client } from './v2Client';
import { getApiMode } from './env';
import type {
  AuthTokenProvider,
  GenerateRequest,
  GenerateResponse,
  ListingApiClient,
  RegenerateRequest,
  RegenerateResponse,
  ReviewEditRequest,
  ApiMode,
  UserCreditsSummary,
  UserWalletSummary,
} from './types';
export { HttpError, UnsupportedOperationError } from './types';

let authTokenProvider: AuthTokenProvider = async () => null;
let cachedV2Client: V2Client | null = null;
const legacyClient = new LegacyClient();
let runtimeModeOverride: ApiMode | null = null;

export function configureAuthTokenProvider(provider: AuthTokenProvider) {
  authTokenProvider = provider;
  cachedV2Client = null;
}

export function setRuntimeApiMode(mode: ApiMode | null) {
  runtimeModeOverride = mode;
  cachedV2Client = null;
}

function getClient(): ListingApiClient {
  const mode = runtimeModeOverride ?? getApiMode();
  if (mode === 'legacy') {
    return legacyClient;
  }

  if (!cachedV2Client) {
    cachedV2Client = new V2Client(authTokenProvider);
  }
  return cachedV2Client;
}

export function generateListing(body: GenerateRequest): Promise<GenerateResponse> {
  return getClient().generateListing(body);
}

export function regenerateField(body: RegenerateRequest): Promise<RegenerateResponse> {
  return getClient().regenerateField(body);
}

export function reviewUserEdit(body: ReviewEditRequest): Promise<void> {
  return getClient().reviewUserEdit(body);
}

export function getUserCredits(): Promise<UserCreditsSummary> {
  return getClient().getUserCredits();
}

export function getWallet(): Promise<UserWalletSummary> {
  return getClient().getWallet();
}

export const client = {
  generateListing,
  regenerateField,
  reviewUserEdit,
  getUserCredits,
  getWallet,
  configureAuthTokenProvider,
};
