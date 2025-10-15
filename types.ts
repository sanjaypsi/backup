import { TableCellProps } from "@material-ui/core/TableCell";
import { ReactElement } from "react";
import { Project } from '../types';

// export type AssetsDataTableProps = {
//   project: Project | null | undefined,
//   assets: Asset[],
//   tableFooter: ReactElement,
//   dateTimeFormat: Intl.DateTimeFormat,
// };

export type RecordTableHeadProps = {
  columns: Column[],
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
}>;

export type PageProps = Readonly<{
  page: number,
  rowsPerPage: number,
}>;

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
}>;

export type ChipDeleteFunction = (value: string) => void;

export type AssetRowProps = Readonly<{
  asset: Asset,
  reviewInfos: { [key: string]: ReviewInfo },
  thumbnails: { [key: string]: string },
  dateTimeFormat: Intl.DateTimeFormat,
  isLastRow: boolean,
}>;



// ========== New types for the pivot API ==========
// Define the shape of each row returned by the pivot API
export type AssetReviewPivotRow = Readonly<{
  root: string;
  project: string;
  group_1: string; // This is the asset name
  relation: string;

  // Pivoted fields for each phase (MDL, RIG, BLD, DSN, LDV)
  mdl_work_status: string | null;
  mdl_approval_status: string | null;
  mdl_submitted_at_utc: string | null;

  
  rig_work_status: string | null;
  rig_approval_status: string | null;
  rig_submitted_at_utc: string | null;


  bld_work_status: string | null;
  bld_approval_status: string | null;
  bld_submitted_at_utc: string | null;

  
  dsn_work_status: string | null;
  dsn_approval_status: string | null;
  dsn_submitted_at_utc: string | null;


  ldv_work_status: string | null;
  ldv_approval_status: string | null;
  ldv_submitted_at_utc: string | null;


  // Add all other phases (BLD, DSN, LDV) following the same pattern...
  
  // If you need dynamic keys, use a more specific type or document usage.
  // [key: string]: string | number | null | undefined;
}>;

// Define the response shape for the pivot endpoint
export type AssetReviewPivotResponse = {
  count: number; // Rows returned on this page
  data: AssetReviewPivotRow[]; // The pivoted data
  total: number; // Total rows available (for pagination)
  page: number;
  perPage: number;
};

// Update the props for the data table to manage the state needed for the pivot API
export type AssetsDataTableProps = {
  project: Project | null | undefined;
  assets: Readonly<any[]>;
  tableFooter: React.ReactElement;
  dateTimeFormat: Intl.DateTimeFormat;

  // New props for controlling the API call
  currentPage: number;
  rowsPerPage: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  relationFilter: string;

  // Handlers
  handleSort: (columnId: string) => void;
  // Add handlers for page/rowsPerPage change if they are managed here
};