// src/project/asset-data/AssetDataSorted.tsx
// or src/utils/sortAssets.ts if you want a utils folder
import { Asset } from './types';

// --------------------
// helpers
// --------------------
function compareString(a: string, b: string, asc: boolean) {
    const cmp = a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    return asc ? cmp : -cmp;
}

function compareNumber(a: number, b: number, asc: boolean) {
    if (a === b) return 0;
    return asc ? a - b : b - a;
}

function reviewKey(asset: Asset, phase: string) {
    return `${asset.name}-${asset.relation}-${phase}`;
}

// safe string accessor (avoids ??)
function toStringSafe(v: any) {
    return v !== null && v !== undefined ? String(v) : "";
}

// safe time accessor
function timeFromReview(reviewInfos: Record<string, any>, key: string) {
    const info = reviewInfos && reviewInfos[key] ? reviewInfos[key] : null;
    if (!info) return -Infinity;
    const utc = info.submitted_at_utc;
    if (!utc) return -Infinity;
    const d = new Date(utc);
    return isNaN(d.getTime()) ? -Infinity : d.getTime();
}

// --------------------
// column sorters
// --------------------
export function sortByName(a: Asset, b: Asset, asc: boolean) {
    console.log(a);
    // console.log(b);

    return compareString(toStringSafe(a.name), toStringSafe(b.name), asc);
}

export function sortByRelation(a: Asset, b: Asset, asc: boolean) {
    return compareString(toStringSafe(a.relation), toStringSafe(b.relation), asc);
}

export function sortByWork(
    a: Asset,
    b: Asset,
    asc: boolean,
    phase: string,
    reviewInfos: Record<string, any>
) {
    const infoA = reviewInfos && reviewInfos[reviewKey(a, phase)] ? reviewInfos[reviewKey(a, phase)] : null;
    const infoB = reviewInfos && reviewInfos[reviewKey(b, phase)] ? reviewInfos[reviewKey(b, phase)] : null;
    const va = infoA && infoA.work_status !== undefined && infoA.work_status !== null ? String(infoA.work_status) : "";
    const vb = infoB && infoB.work_status !== undefined && infoB.work_status !== null ? String(infoB.work_status) : "";
    return compareString(va, vb, asc);
}

export function sortByApproval(
    a: Asset,
    b: Asset,
    asc: boolean,
    phase: string,
    reviewInfos: Record<string, any>
) {
    const infoA = reviewInfos && reviewInfos[reviewKey(a, phase)] ? reviewInfos[reviewKey(a, phase)] : null;
    const infoB = reviewInfos && reviewInfos[reviewKey(b, phase)] ? reviewInfos[reviewKey(b, phase)] : null;
    const va = infoA && infoA.approval_status !== undefined && infoA.approval_status !== null ? String(infoA.approval_status) : "";
    const vb = infoB && infoB.approval_status !== undefined && infoB.approval_status !== null ? String(infoB.approval_status) : "";
    return compareString(va, vb, asc);
}

export function sortBySubmittedAt(
    a: Asset,
    b: Asset,
    asc: boolean,
    phase: string,
    reviewInfos: Record<string, any>
) {
    const ta = timeFromReview(reviewInfos, reviewKey(a, phase));
    const tb = timeFromReview(reviewInfos, reviewKey(b, phase));
    return compareNumber(ta, tb, asc);
}

// --------------------
// dispatcher
// --------------------
export function getSortedAssetsByName(
    assets: Asset[] = [],
    sortColumn: string | null,
    sortDirection: "asc" | "desc" | null,
    reviewInfos: Record<string, any> = {}
): Asset[] {
    if (!sortColumn || !sortDirection) return Array.isArray(assets) ? [...assets] : [];

    const asc = sortDirection === "asc";
    const copy = [...assets];

    copy.sort((a, b) => {
        switch (sortColumn) {
            case "name":
            case "group_1_name":
                return sortByName(a, b, asc);

            case "relation":
                return sortByRelation(a, b, asc);

            // MDL
            case "mdl_work_status":
                return sortByWork(a, b, asc, "mdl", reviewInfos);
            case "mdl_approval_status":
                return sortByApproval(a, b, asc, "mdl", reviewInfos);
            case "mdl_submitted_at":
                return sortBySubmittedAt(a, b, asc, "mdl", reviewInfos);

            // RIG
            case "rig_work_status":
                return sortByWork(a, b, asc, "rig", reviewInfos);
            case "rig_approval_status":
                return sortByApproval(a, b, asc, "rig", reviewInfos);
            case "rig_submitted_at":
                return sortBySubmittedAt(a, b, asc, "rig", reviewInfos);

            // BLD
            case "bld_work_status":
                return sortByWork(a, b, asc, "bld", reviewInfos);
            case "bld_approval_status":
                return sortByApproval(a, b, asc, "bld", reviewInfos);
            case "bld_submitted_at":
                return sortBySubmittedAt(a, b, asc, "bld", reviewInfos);

            // DSN
            case "dsn_work_status":
                return sortByWork(a, b, asc, "dsn", reviewInfos);
            case "dsn_approval_status":
                return sortByApproval(a, b, asc, "dsn", reviewInfos);
            case "dsn_submitted_at":
                return sortBySubmittedAt(a, b, asc, "dsn", reviewInfos);

            // LDV
            case "ldv_work_status":
                return sortByWork(a, b, asc, "ldv", reviewInfos);
            case "ldv_approval_status":
                return sortByApproval(a, b, asc, "ldv", reviewInfos);
            case "ldv_submitted_at":
                return sortBySubmittedAt(a, b, asc, "ldv", reviewInfos);

            default:
                return 0;
        }
    });

    return copy;
}
