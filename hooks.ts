import { useEffect, useState, useReducer } from 'react';
import { Asset, ReviewInfo, AssetReviewPivotRow, AssetReviewPivotResponse } from './types';
import { fetchAssets, fetchAssetReviewInfos, fetchAssetThumbnail, fetchAssetReviewPivot } from './api';
import { Project } from '../types';

export function useFetchAssets(
  project: Project | null | undefined,
  page: number,
  rowsPerPage: number,
): { assets: Asset[], total: number } {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (project == null) {
      return;
    }
    const controller = new AbortController();

    (async () => {
      const res = await fetchAssets(
        project.key_name,
        page,
        rowsPerPage,
        controller.signal,
      ).catch((err) => {
        if (err.name === 'AbortError') {
          return;
        }
        console.error(err)
      });
      if (res != null) {
        setAssets(res.assets);
        setTotal(res.total);
      }
    })();
    return () => controller.abort();
  }, [project, page, rowsPerPage]);

  return { assets, total };
};

function reducer(
  state: { [key: string]: ReviewInfo },
  action: { asset: Asset, reviewInfos: ReviewInfo[] },
): { [key: string]: ReviewInfo } {
  const data: { [key: string]: ReviewInfo } = {};
  for (const reviewInfo of action.reviewInfos) {
    data[`${action.asset.name}-${action.asset.relation}-${reviewInfo.phase}`] = reviewInfo;
  }
  return { ...state, ...data };
};

export function useFetchAssetReviewInfos(
  project: Project,
  assets: Asset[],
): { reviewInfos: { [key: string]: ReviewInfo } } {
  const [reviewInfos, dispatch] = useReducer(reducer, {});
  const controller = new AbortController();

  console.log('useFetchAssetReviewInfos called with assets:', assets);
  useEffect(() => {
    const loadAssetReviewInfos = async (asset: Asset) => {
      try {
        const res = await fetchAssetReviewInfos(
          project.key_name,
          asset.name,
          asset.relation,
          controller.signal,
        );
        const data = res.reviews;
        console.log('==================================== Fetched', data);
        if (data.length > 0) {

          dispatch({ asset, reviewInfos: data });
        }
      } catch (err) {
        console.error('Failed to fetch asset review infos:', err);
      }
    };

    for (const asset of assets) {
      loadAssetReviewInfos(asset);
    }

    return () => controller.abort();
  }, [project, assets]);

  return { reviewInfos };
};

function assetThumbnailReducer(
  state: { [key: string]: string },
  action: { asset: Asset, responseResult: string },
): { [key: string]: string } {
  const data: { [key: string]: string } = {};
  data[`${action.asset.name}-${action.asset.relation}`] = action.responseResult;
  return { ...state, ...data };
};

export function useFetchAssetThumbnails(
  project: Project,
  assets: Asset[],
): { thumbnails: { [key: string]: string } } {
  const [thumbnails, dispatch] = useReducer(assetThumbnailReducer, {});
  const controller = new AbortController();

  useEffect(() => {
    const loadAssetThumbnails = async (asset: Asset) => {
      try {
        const res = await fetchAssetThumbnail(
          project.key_name,
          asset.name,
          asset.relation,
          controller.signal,
        );
        if (res != null && res.ok) {
          const reader = new FileReader();
          const blob = await res.blob();
          reader.onload = () => {
            dispatch({ asset, responseResult: reader.result as string });
          };
          reader.readAsDataURL(blob);
        }
      } catch (err) {
        console.error(err);
      }
    };

    for (const asset of assets) {
      loadAssetThumbnails(asset);
    }

    return () => controller.abort();
  }, [project, assets]);

  return { thumbnails };
};

// ============== New Hook for Pivot API ==============
// import { useEffect, useState } from 'react';
// import { AssetReviewPivotRow, AssetReviewPivotResponse } from './types';
// import { fetchAssetReviewPivot } from './api'; 
// import { Project } from '../types';

// The single hook to fetch all table data
export function useFetchAssetPivotData(
  project: Project | null | undefined,
  page: number,
  rowsPerPage: number,
  relationFilter: string,
  sortBy: string,
  sortOrder: 'asc' | 'desc',
): { pivotRows: AssetReviewPivotRow[], totalRows: number } {
  
  const [pivotRows, setPivotRows] = useState<AssetReviewPivotRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  useEffect(() => {
    if (project == null) {
      return;
    }
    const controller = new AbortController();

    (async () => {
      const res = await fetchAssetReviewPivot(
        project.key_name,
        page,
        rowsPerPage,
        relationFilter,
        sortBy,
        sortOrder,
        controller.signal,
      ).catch((err) => {
        if (err.name === 'AbortError') {
          return;
        }
        console.error(err);
      });
      
      if (res != null) {

        console.log("Pivot Data Fetched:", res); // Debug log
        console.log("Total Rows:", res.total); // Debug log
        console.log("Data Rows:", res.data); // Debug log
        
        setPivotRows(res.data as AssetReviewPivotRow[]);
        setTotalRows(res.total);
      }

    })();
    return () => controller.abort();
  }, [project, page, rowsPerPage, relationFilter, sortBy, sortOrder]); // Crucial dependencies

  return { pivotRows, totalRows };
}

// Keep useFetchAssetThumbnails if you still need it, but update the AssetRow component to map thumbnail fetch keys from the PivotRow.
// REMOVE useFetchAssets and useFetchAssetReviewInfos.