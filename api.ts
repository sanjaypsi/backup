import { AuthorizationError } from '../../auth/types';
import { getAuthHeader, setNewToken } from '../../auth/util';
import { Asset, ReviewInfo } from './types';

type ReviewInfoListResponse = {
  reviews: ReviewInfo[],
  next: string | null,
  total: number,
};

export type AssetsResponse = {
  assets: Asset[],
  total: number,
};

export const fetchAssets = async (
  project: string,
  page: number,
  rowsPerPage: number,
  signal?: AbortSignal | null,
): Promise<AssetsResponse> => {
  const headers = getAuthHeader();
  let url: string | null = `/api/projects/${project}/reviews/assets`
  const params = new URLSearchParams();
  params.set('per_page', String(rowsPerPage));
  params.set('page', String(page + 1));
  url += `?${params}`;
  const res = await fetch(
    url,
    {
      method: 'GET',
      headers,
      mode: 'cors',
      signal,
    },
  );
  if (res.status === 401) {
    throw new AuthorizationError();
  }
  if (!res.ok) {
    throw new Error('Failed to fetch parameters.');
  }
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
  const url = `/api/projects/${project}/assets/${asset}/relations/${relation}/reviewInfos`;
  const headers = getAuthHeader();
  const res = await fetch(
    url,
    {
      method: 'GET',
      headers,
      mode: 'cors',
      signal,
    },
  );
  if (res.status === 401) {
    throw new AuthorizationError();
  }
  if (!res.ok) {
    throw new Error('Failed to fetch review infos.');
  }
  setNewToken(res);
  const json: ReviewInfoListResponse = await res.json();
  return json;
};

export const fetchAssetThumbnail = async (
  project: string,
  asset: string,
  relation: string,
  signal?: AbortSignal | null,
): Promise<Response | null> => {
  const url = `/api/projects/${project}/assets/${asset}/relations/${relation}/reviewthumbnail`;
  const headers = getAuthHeader();
  const res = await fetch(
    url,
    {
      method: 'GET',
      headers,
      mode: 'cors',
      signal,
    },
  );
  if (res.status === 204) {
    return null; // 204 is allowed, it means the thumbnail does not exist.
  }
  if (res.status === 401) {
    throw new AuthorizationError();
  }
  if (!res.ok) {
    throw new Error('Failed to fetch thumbnail.');
  }
  setNewToken(res);
  return res;
};

// --- Pivot Table Fetching ---

export type AssetReviewPivotResponse = {
  data: Array<{ [key: string]: any }>;
  total: number;
};

export const fetchAssetReviewPivot = async (
  project: string,
  page: number, // 0-indexed page from frontend
  rowsPerPage: number,
  relation: string,
  sortBy: string,
  sortOrder: 'asc' | 'desc',
  signal?: AbortSignal | null,
): Promise<AssetReviewPivotResponse> => {
  const headers = getAuthHeader();
  const params = new URLSearchParams();
  
  // Convert 0-indexed frontend page to 1-indexed backend page
  params.set('page', String(page + 1)); 
  params.set('perPage', String(rowsPerPage)); 
  
  // Pass sort and filter parameters
  if (relation) params.set('relation', relation);
  params.set('sortBy', sortBy);
  params.set('sortOrder', sortOrder);

  // FIX: Ensure the URL starts with a leading slash (/) to resolve correctly from the root
  const url = `/api/projects/${project}/reviews/assets/pivot?${params}`;
  
  // You can keep this log for debugging:
  // console.log('Pivot API Request URL:', url); 

  const res = await fetch(
    url,
    {
      method: 'GET',
      headers,
      mode: 'cors',
      signal,
    },
  );

  if (res.status === 401) {
    throw new AuthorizationError();
  }
  if (!res.ok) {
    throw new Error('Failed to fetch pivot data.');
  }
  
  setNewToken(res);
  const json: AssetReviewPivotResponse = await res.json();
  return json;
};
