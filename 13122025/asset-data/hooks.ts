import { useEffect, useReducer, useState } from 'react';
import { Asset, ReviewInfo, AssetPhaseSummary, SortDir } from './types';
import { fetchAssets, fetchAssetReviewInfos, fetchAssetThumbnail, fetchAssetsPivot } from './api';
import { Project } from '../types';

/* =========================================================
 * Flat assets (non-pivot)
 * =======================================================*/
export function useFetchAssets(
  project: Project | null | undefined,
  page: number,
  rowsPerPage: number,
): { assets: Asset[]; total: number } {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (project == null) return;

    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetchAssets(project.key_name, page, rowsPerPage, controller.signal);
        const list = res && (res as any).assets ? (res as any).assets : [];
        const count = res && (res as any).total ? (res as any).total : 0;

        setAssets(list);
        setTotal(count);

        // debug
        // eslint-disable-next-line no-console
        console.log('[HOOK][flat] list:', list.length, list);
        // eslint-disable-next-line no-console
        console.log('[HOOK][flat] total:', count);
      } catch (err) {
        if (controller.signal.aborted) return;
        const errName = err && (err as any).name ? (err as any).name : '';
        if (errName === 'AbortError') return;
        // eslint-disable-next-line no-console
        console.error(err);
      }
    })();

    return () => controller.abort();
  }, [project, page, rowsPerPage]);

  return { assets, total };
}

/* =========================================================
 * Pivot assets (sorted + optional phase bias)
 * =======================================================*/
/* =========================================================
 * Pivot assets (sorted + optional phase bias)
 * =======================================================*/
export function useFetchAssetsPivot(
  project: Project | null | undefined,
  page: number,
  rowsPerPage: number,
  sortKey: string,
  sortDir: SortDir,      // 'asc' | 'desc' | 'none'
  phase: string,         // 'mdl' | 'rig' | 'bld' | 'dsn' | 'ldv' | 'none'
  assetNameKey: string,       // ADDED
  approvalStatuses: string[], // ADDED
  workStatuses: string[],     // ADDED
): { assets: AssetPhaseSummary[]; total: number } {
  const [assets, setAssets] = useState<AssetPhaseSummary[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (project == null) return;
    if (sortDir === 'none') return;

    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetchAssetsPivot(
          project.key_name,
          page,
          rowsPerPage,
          sortKey,
          sortDir,
          phase,
          assetNameKey,      // ADDED
          approvalStatuses,  // ADDED
          workStatuses,      // ADDED
          controller.signal,
        );

        // Accept both shapes: {assets} (new) or {data} (legacy)
        const list =
          res && (res as any).assets ? (res as any).assets :
          res && (res as any).data   ? (res as any).data   : [];
        const count = res && (res as any).total ? (res as any).total : 0;

        setAssets(list);
        setTotal(count);

        // debug (log the locals, not state)
        // eslint-disable-next-line no-console
        console.log('[HOOK][pivot] list:', list.length, list);
        // eslint-disable-next-line no-console
        console.log('[HOOK][pivot] total:', count);
      } catch (err) {
        if (controller.signal.aborted) return;
        const errName = err && (err as any).name ? (err as any).name : '';
        if (errName === 'AbortError') return;
        // eslint-disable-next-line no-console
        console.error(err);
      }
    })();

    return () => controller.abort();
  }, [project, page, rowsPerPage, sortKey, sortDir, phase, assetNameKey, approvalStatuses, workStatuses]); // Updated dependency array

  return { assets, total };
}


/* =========================================================
 * Per-asset review infos
 * =======================================================*/
export function useFetchAssetReviewInfos(
  project: Project,
  asset: string,
): { reviews: ReviewInfo[]; next: string | null; total: number } {
  const [reviews, setReviews] = useState<ReviewInfo[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetchAssetReviewInfos(project.key_name, asset, (asset as any).relation, controller.signal);
        const list  = res && (res as any).reviews ? (res as any).reviews : [];
        const nxt   = res && (res as any).next    ? (res as any).next    : null;
        const count = res && (res as any).total   ? (res as any).total   : 0;

        setReviews(list);
        setNext(nxt);
        setTotal(count);

        // eslint-disable-next-line no-console
        console.log('[HOOK][reviews] list:', list.length);
      } catch (err) {
        if (controller.signal.aborted) return;
        const errName = err && (err as any).name ? (err as any).name : '';
        if (errName === 'AbortError') return;
        // eslint-disable-next-line no-console
        console.error(err);
      }
    })();

    return () => controller.abort();
  }, [project, asset]);

  return { reviews, next, total };
}

/* =========================================================
 * Thumbnails
 * =======================================================*/

type AssetThumbnailState = { [key: string]: string };
type AssetThumbnailAction =
  | { type: 'set'; payload: { key: string; value: string } };

function assetThumbnailReducer(
  state: AssetThumbnailState,
  action: AssetThumbnailAction,
): AssetThumbnailState {
  switch (action.type) {
    case 'set':
      return { ...state, [action.payload.key]: action.payload.value };
    default:
      return state;
  }
}

export function useFetchAssetThumbnails(
  project: Project,
  assets: Asset[],
): { thumbnails: { [key: string]: string } } {
  const [thumbnails, dispatch] = useReducer(assetThumbnailReducer, {});

  useEffect(() => {
    const controller = new AbortController();

    const loadAssetThumbnails = async (asset: Asset) => {
      try {
        const res = await fetchAssetThumbnail(project.key_name, asset.name, asset.relation, controller.signal);
        if (!res) return; // 204 No Content

        const blob = await res.blob();
        const objectURL = URL.createObjectURL(blob);

        // Write multiple keys so different callers succeed
        const group1 = (asset as any).group_1 ? (asset as any).group_1 : asset.name;

        dispatch({ type: 'set', payload: { key: `${project.key_name}:${asset.name}:${asset.relation}`, value: objectURL } });
        dispatch({ type: 'set', payload: { key: `${asset.name}-${asset.relation}`, value: objectURL } });
        dispatch({ type: 'set', payload: { key: `${group1}-${asset.relation}`, value: objectURL } });
        dispatch({ type: 'set', payload: { key: `${group1}:${asset.relation}`, value: objectURL } });
      } catch (err) {
        if (controller.signal.aborted) return;
        const errName = err && (err as any).name ? (err as any).name : '';
        if (errName === 'AbortError') return;
        // eslint-disable-next-line no-console
        console.error(err);
      }
    };

    for (let i = 0; i < assets.length; i++) {
      loadAssetThumbnails(assets[i]);
    }

    return () => controller.abort();
  }, [project, assets]);

  return { thumbnails };
}