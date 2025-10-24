// ================================================
// utils/pivotSort.ts
// ================================================
// src/utils/pivotSort.ts
export type SortDir = 'asc' | 'desc';

export interface SortState {
  sort: string;   // e.g. "group_1" | "mdl_work" | "rig_submitted"
  dir: SortDir;   // "asc" | "desc"
  phase?: string; // "", "mdl", "rig", "bld", "dsn", "ldv"
}

// Map UI column id -> backend sort key
const SORT_KEY_MAP: Record<string, string> = {
  // asset-level
  group_1: 'group_1',
  relation: 'relation',

  // mdl
  mdl_work: 'mdl_work',
  mdl_appr: 'mdl_appr',
  mdl_submitted: 'mdl_submitted',

  // rig
  rig_work: 'rig_work',
  rig_appr: 'rig_appr',
  rig_submitted: 'rig_submitted',

  // bld
  bld_work: 'bld_work',
  bld_appr: 'bld_appr',
  bld_submitted: 'bld_submitted',

  // dsn
  dsn_work: 'dsn_work',
  dsn_appr: 'dsn_appr',
  dsn_submitted: 'dsn_submitted',

  // ldv
  ldv_work: 'ldv_work',
  ldv_appr: 'ldv_appr',
  ldv_submitted: 'ldv_submitted',
};

export function phaseFromColumnId(columnId: string): '' | 'mdl' | 'rig' | 'bld' | 'dsn' | 'ldv' {
  const id = columnId.toLowerCase();
  if (id.startsWith('mdl_')) return 'mdl';
  if (id.startsWith('rig_')) return 'rig';
  if (id.startsWith('bld_')) return 'bld';
  if (id.startsWith('dsn_')) return 'dsn';
  if (id.startsWith('ldv_')) return 'ldv';
  return '';
}

/** Compute next sort+phase for a clicked column header */
export function nextSortForColumn(columnId: string, current: SortState): SortState {
  const key = (SORT_KEY_MAP[columnId] ?? columnId).toLowerCase();
  const nextDir: SortDir = current.sort === key ? (current.dir === 'asc' ? 'desc' : 'asc') : 'asc';
  const phase = phaseFromColumnId(columnId); // empty for asset-level
  return { sort: key, dir: nextDir, phase };
}
