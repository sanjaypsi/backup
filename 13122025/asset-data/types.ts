import { TableCellProps } from "@material-ui/core/TableCell";
import { ReactElement } from "react";
import { Project } from '../types';
import { SelectProps } from "@material-ui/core/Select";

export type SortDir = 'asc' | 'desc' | 'none';

// …

export interface AssetsDataTableProps {
  project: Project | null | undefined;
  assets: AssetPhaseSummary[];
  tableFooter?: React.ReactNode;
  dateTimeFormat: Intl.DateTimeFormat;

  // sort props already used by the table
  currentSortKey: string;
  currentSortDir: SortDir;
  onSortChange: (sortKey: string) => void;

  // optionally provided
  hiddenColumns?: Set<string>;

  // 🔽 NEW: pass-through filter props from the panel (optional)
  assetNameKey?: string;
  approvalStatuses?: string[];
  workStatuses?: string[];
}

export type RecordTableHeadProps = {
  columns: Column[],
  currentSortKey: string, // ADDED: Required for Table Head to highlight active column
  currentSortDir: SortDir, // ADDED: Required for Table Head to display arrow direction
  onSortChange: (sortKey: string) => void, // ADDED: Required for Table Head's click handler
};

export type Colors = Readonly<{
  lineColor: string,
  backgroundColor: string,
}>;

export type Column = Readonly<{
  id: string,
  label: string,
  colors?: Colors,
  align?: TableCellProps['align'],
  sortable?: boolean,
  sortKey?: string,
}>;

export type PageProps = Readonly<{
  page: number,
  rowsPerPage: number,
}>;

export type AssetPhaseSummary = {
  root: string,
  project: string,
  group_1: string,
  relation: string,

  mdl_work_status: string | null,
  mdl_approval_status: string | null,
  mdl_submitted_at_utc: string | null,

  rig_work_status: string | null,
  rig_approval_status: string | null,
  rig_submitted_at_utc: string | null,

  bld_work_status: string | null,
  bld_approval_status: string | null,
  bld_submitted_at_utc: string | null,

  dsn_work_status: string | null,
  dsn_approval_status: string | null,
  dsn_submitted_at_utc: string | null,

  ldv_work_status: string | null,
  ldv_approval_status: string | null,
  ldv_submitted_at_utc: string | null,
};

export type AssetsPivotResponse = {
  project: string,
  root: string,
  page: number,
  per_page: number,
  total: number,
  count: number,
  data: AssetPhaseSummary[],
  ts: string,
}

export type ReviewInfo = {
  task_id: string,
  project: string,
  take_path: string,
  root: string,
  relation: string,
  phase: string,
  component: string,
  take: string,
  approval_status: string,
  work_status: string,
  submitted_at_utc: string,
  submitted_user: string,
  modified_at_utc: string,
  id: number,
  groups: string[],
  group_1: string,
  review_comments: ReviewComment[],
};

type ReviewComment = {
  text: string,
  language: string,
  attachments: string[],
  is_translated: boolean,
  need_translation: boolean
};

export type Asset = Readonly<{
  name: string,
  relation: string,
}>;

export type FilterProps = Readonly<{
  assetNameKey: string,
  applovalStatues: string[],
  workStatues: string[],
  selectPhasePriority: string,
  selectApprovalStatus: string,
  selectWorkStatus: string,
  onPhasePriorityChange: SelectProps['onChange'],
  onApprovalStatusChange: SelectProps['onChange'],
  onWorkStatusChange: SelectProps['onChange'],
}>;

export type ChipDeleteFunction = (value: string) => void;

export type AssetRowProps = Readonly<{
  asset: AssetPhaseSummary,
  thumbnails: { [key: string]: string },
  dateTimeFormat: Intl.DateTimeFormat,
  isLastRow: boolean,
}>;
