import { AuthorizationError } from '../../auth/types';
import { getAuthHeader, setNewToken } from '../../auth/util';
import { Asset, ReviewInfo, AssetsPivotResponse } from './types'; // ADD IMPORT AssetsPivotResponse

type ReviewInfoListResponse = {
  reviews: ReviewInfo[],
  next: string | null,
  total: number,
};

export type AssetsResponse = {
  assets: Asset[],
  total: number,
};

// NEW FUNCTION: Fetch data from the pivot API endpoint
export const fetchAssetsPivot = async (
  project: string,
  page: number,
  rowsPerPage: number,
  sortKey: string, // NEW parameter for sorting
  signal?: AbortSignal | null,
): Promise<AssetsResponse> => {
  const headers = getAuthHeader();
  // TARGETING THE NEW BACKEND ENDPOINT
  let url: string | null = `/api/assets/${project}/pivot`
  const params = new URLSearchParams();
  params.set('per_page', String(rowsPerPage));
  // The frontend uses 0-based page, backend uses 1-based page
  params.set('page', String(page + 1)); 
  if (sortKey) {
    params.set('sort', sortKey); // PASS the sort key
  }

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
    throw new Error('Failed to fetch pivoted assets.');
  }
  setNewToken(res);
  const json: AssetsPivotResponse = await res.json();
  // Transform AssetsPivotResponse to AssetsResponse
  return {
    assets: json.data.map((item: any) => ({
      name: item.name,
      relation: item.relation,
    })),
    total: json.total,
  };
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
