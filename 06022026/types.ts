/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    types.ts

  Module Description:
    Type definitions for asset data table components and related structures.

  Details:
    - Defines interfaces and types for assets, table props, sorting, filtering, and related data structures.
    
  Update and Modification History:
    * - 29-10-2025 - SanjayK PSI - Initial creation sorting pagination implementation.
    * - 07-11-2025 - SanjayK PSI - Column visibility toggling implementation.
    * - 20-11-2025 - SanjayK PSI - Fixed typo in filter property names handling.
    * - 24-11-2025 - SanjayK PSI - Added detailed doc comments for functions and types.'
    * - 02-02-2026 - SanjayK PSI - Added component field to Asset type for better component tracking.
    * - 06-02-2026 - SanjayK PSI - Added take field to ReviewInfo type for enhanced review tracking.

  Functions:
    *-  AssetsDataTableProps: Interface
        - Defines the props for the Assets Data Table component.
    *-  RecordTableHeadProps: Type
        - Defines the props for the table header component.
    *-  Colors: Type
        - Defines color properties for table elements.
    *-  Column: Type
        - Defines properties for individual table columns.
    *-  PageProps: Type
        - Defines pagination properties.
    *-  AssetsPivotResponse: Type
        - Defines the structure of the response for a pivoted assets query.
    *-  ReviewInfo: Type
        - Defines the structure for review information associated with assets.
    *-  Asset: Type
        - Defines the structure of an asset with various status fields.
    *-  FilterProps: Type
        - Defines properties for filtering assets in the table.
    *-  ChipDeleteFunction: Type
        - Defines the function signature for deleting filter chips.
    *-  AssetRowProps: Type
        - Defines the props for individual asset rows in the table.
    *-  LatestAssetComponentDocument: Type
        - Defines the structure for the latest document of an asset component.
    *-  LatestComponent: Type
        - Defines the structure for the latest component information.
    *-  LatestComponents: Type
        - Defines a mapping of latest components by asset.
    *-  LatestAssetComponentDocumentsResponse: Type
        - Defines the response structure for latest asset component documents.
  * ───────────────────────────────────────────────────────────────────────── */

import React from "react";
import { TableCellProps } from "@material-ui/core/TableCell";
import { ReactElement } from "react";
import { Project } from '../../types';
import { SelectProps } from "@material-ui/core/Select";

export type SortDir = 'asc' | 'desc' | 'none';

export interface AssetsDataTableProps {
  project: Project | null | undefined;
  assets: Asset[];
  phaseComponents: { [key: string]: string[] };
  latestComponents: LatestComponents;
  tableFooter?: React.ReactNode;
  dateTimeFormat: Intl.DateTimeFormat;

  // sort props
  currentSortKey: string;
  currentSortDir: SortDir;
  onSortChange: (sortKey: string) => void;

  // pagination props
  page: number;
  rowsPerPage: number;

  hiddenColumns?: Set<string>;

  // filter props
  assetNameKey?: string;
  approvalStatuses?: string[];
  workStatuses?: string[];
}

export type RecordTableHeadProps = {
  columns: Column[],
  currentSortKey: string,
  currentSortDir: SortDir,
  onSortChange: (sortKey: string) => void,
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

export type AssetsPivotResponse = {
  project: string,
  root: string,
  page: number,
  per_page: number,
  total: number,
  count: number,
  data: Asset[],
  ts: string,
  
  assets: Asset[],
  groups: PivotGroup[],
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
  root: string, 
  project: string,
  group_1: string, 
  relation: string,

  component: string | null, // Add new component field

  mdl_work_status: string | null,
  mdl_approval_status: string | null,
  mdl_submitted_at_utc: string | null,
  mdl_take: string | null,

  rig_work_status: string | null,
  rig_approval_status: string | null,
  rig_submitted_at_utc: string | null,
  rig_take: string | null,

  bld_work_status: string | null,
  bld_approval_status: string | null,
  bld_submitted_at_utc: string | null,
  bld_take: string | null,

  dsn_work_status: string | null,
  dsn_approval_status: string | null,
  dsn_submitted_at_utc: string | null,
  dsn_take: string | null,

  ldv_work_status: string | null,
  ldv_approval_status: string | null,
  ldv_submitted_at_utc: string | null,
  ldv_take: string | null,

  leaf_group_name?: string | null,
  group_category_path?: string | null,
  top_group_node?: string | null,
  
}>;

export type FilterProps = Readonly<{
  assetNameKey: string,
  approvalStatuses: string[],
  workStatuses: string[],
  
  selectPhasePriority: string,
  selectApprovalStatus: string,
  selectWorkStatus: string,
  onPhasePriorityChange: SelectProps['onChange'],
  onApprovalStatusChange: SelectProps['onChange'],
  onWorkStatusChange: SelectProps['onChange'],
}>;

export type ChipDeleteFunction = (value: string) => void;

export type AssetRowProps = Readonly<{
  asset: Asset,
  thumbnails: { [key: string]: string },
  phaseComponents: { [key: string]: string[] },
  latestComponents: LatestComponents,
  dateTimeFormat: Intl.DateTimeFormat,
  isLastRow: boolean,
}>;

export type LatestAssetComponentDocument = Readonly<{
  component: string,
  groups: string[],
  phase: string,
  submitted_at_utc: string,
}>;

type LatestComponent = Readonly<{
  component: string,
  latest_document: LatestAssetComponentDocument,
}>;

export type LatestComponents = {
  [key: string]: LatestComponent[],
};

export type LatestAssetComponentDocumentsResponse = Readonly<{
  component: string,
  latest_document: LatestAssetComponentDocument,
}>;

export type PivotGroup = Readonly<{
  top_group_node: string | null;
  items: Asset[];
  total_count?: number;
}>;

/* ──────────────────────────────────────────────────────────────────────────
  End of Module
  ───────────────────────────────────────────────────────────────────────── */