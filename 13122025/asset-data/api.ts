import { AuthorizationError } from '../../auth/types';
import { getAuthHeader, setNewToken } from '../../auth/util';
import { Asset, ReviewInfo, AssetsPivotResponse } from './types';

type ReviewInfoListResponse = {
  reviews: ReviewInfo[],
  next: string | null,
  total: number,
};

export type AssetsResponse = {
  assets: Asset[],
  total: number,
};

// Returns AssetsPivotResponse
// Returns AssetsPivotResponse
export const fetchAssetsPivot = async (
  project: string,
  page: number,
  rowsPerPage: number,
  sortKey: string,
  sortDir: string, // 'asc' | 'desc'
  phase: string,   // 'mdl' | 'rig' | 'bld' | 'dsn' | 'ldv' | 'none' | ''
  assetNameKey: string,       // Name filter (prefix, case-insensitive)
  approvalStatuses: string[], // Approval filter (OR within set)
  workStatuses: string[],     // Work filter (OR within set)
  signal?: AbortSignal | null,
): Promise<AssetsPivotResponse> => {
  const headers = getAuthHeader();
  let url = `/api/projects/${encodeURIComponent(project)}/reviews/assets/pivot`;

  const params = new URLSearchParams();
  params.set('per_page', String(rowsPerPage));
  params.set('page', String(page + 1));
  if (sortKey) params.set('sort', sortKey);
  if (sortDir) params.set('dir', sortDir.toUpperCase());
  if (phase)   params.set('phase', phase);

  // ✅ Server expects these keys:
  // name (with name_mode=prefix), work (CSV), appr (CSV)
  const trimmed = (typeof assetNameKey === 'string' ? assetNameKey : '').trim();
  if (trimmed) {
    params.set('name', trimmed);
    params.set('name_mode', 'prefix'); // keep prefix per your spec
  }
  if (Array.isArray(workStatuses) && workStatuses.length > 0) {
    params.set('work', workStatuses.join(',')); // CSV
  }
  if (Array.isArray(approvalStatuses) && approvalStatuses.length > 0) {
    params.set('appr', approvalStatuses.join(',')); // CSV
  }

  url += `?${params.toString()}`;

  const res = await fetch(url, {
    method: 'GET',
    headers,
    mode: 'cors',
    signal: signal || undefined,
  });

  if (res.status === 401) throw new AuthorizationError();
  if (!res.ok) throw new Error('Failed to fetch pivoted assets.');

  setNewToken(res);
  const json = (await res.json()) as AssetsPivotResponse;
  return json;
};


export const fetchAssets = async (
  project: string,
  page: number,
  rowsPerPage: number,
  signal?: AbortSignal | null,
): Promise<AssetsResponse> => {
  const headers = getAuthHeader();

  // keep your route; encode project
  let url: string = `/api/projects/${encodeURIComponent(project)}/reviews/assets`;

  const params = new URLSearchParams();
  params.set('per_page', String(rowsPerPage));
  params.set('page', String(page + 1));
  url += `?${params.toString()}`;

  const res = await fetch(url, {
    method: 'GET',
    headers,
    mode: 'cors',
    signal: signal || undefined,
  });

  if (res.status === 401) throw new AuthorizationError();
  if (!res.ok) throw new Error('Failed to fetch parameters.');

  setNewToken(res);
  const json: AssetsResponse = await res.json();
  return json;
};

export const fetchAssetReviewInfos = async (
  project: string,
  asset: string,
  relation: string,
  signal?: AbortSignal | null,
): Promise<ReviewInfoListResponse> => {
  // keep your route names; just encode
  const url =
    `/api/projects/${encodeURIComponent(project)}` +
    `/assets/${encodeURIComponent(asset)}` +
    `/relations/${encodeURIComponent(relation)}/reviewInfos`;

  const headers = getAuthHeader();
  const res = await fetch(url, {
    method: 'GET',
    headers,
    mode: 'cors',
    signal: signal || undefined,
  });

  if (res.status === 401) throw new AuthorizationError();
  if (!res.ok) throw new Error('Failed to fetch review infos.');

  setNewToken(res);
  const json = await res.json();
  // Basic validation to ensure expected structure
  if (!json || !Array.isArray(json.reviews) || typeof json.total !== 'number') {
    throw new Error('Invalid response format for review infos.');
  }
  return json as ReviewInfoListResponse;
};

export const fetchAssetThumbnail = async (
  project: string,
  asset: string,
  relation: string,
  signal?: AbortSignal | null,
): Promise<Response | null> => {
  // keep your route name; just encode
  const url =
    `/api/projects/${encodeURIComponent(project)}` +
    `/assets/${encodeURIComponent(asset)}` +
    `/relations/${encodeURIComponent(relation)}/reviewthumbnail`;

  const headers = getAuthHeader();
  const res = await fetch(url, {
    method: 'GET',
    headers,
    mode: 'cors',
    signal: signal || undefined,
  });

  if (res.status === 204) return null;
  if (res.status === 401) throw new AuthorizationError();
  if (!res.ok) throw new Error('Failed to fetch thumbnail.');

  setNewToken(res);
  return res;
};