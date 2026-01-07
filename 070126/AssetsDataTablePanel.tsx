/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    AssetsDataTablePanel.tsx

  Module Description:
    Panel component for the Assets Data Table, managing state and interactions.
    Handles filtering, sorting, pagination, column visibility, and CSV export.
    Integrates with project and studio context, and persists user settings.

  Details:
    - Utilizes multiple hooks for data fetching and state management.
    - Supports both backend and client-side filtering and sorting.
    - Provides robust handling of column visibility with persistence.

  * Update and Modification History:
  * - 29-10-2025 - SanjayK PSI - Initial creation sorting pagination implementation.
  * - 07-11-2025 - SanjayK PSI - Column visibility toggling implementation.
  * - 20-11-2025 - SanjayK PSI - Fixed typo in filter property names handling.
  * - 24-11-2025 - SanjayK PSI - Added detailed doc comments for functions and types.

  Functions:
  * - resolveServerSort: Resolves column key to server-side sort and phase.
  * - persistHiddenColumnsLocal: Persists hidden columns to localStorage.
  * - saveHiddenColumnsToPipelineSetting: Saves hidden columns to pipeline settings.
  * - persistHiddenColumns: Persists hidden columns to both localStorage and pipeline settings.
  * - CsvDownloadComponent: Component for downloading asset data as CSV.
  * - AssetsDataTablePanel: Main panel component for asset data table management.
  * - toggleColumn: Toggles visibility of a column by ID.
  * - showAll: Shows all columns by clearing hidden columns.
  * - handleSortChange: Handles sort order changes from UI.
  * - handleSaveColumns: Saves hidden columns to pipeline settings.
  * - filteredAssets: Computes filtered and sorted assets based on current state.
  * - effectivePhase: Computes effective phase based on filters and selection.
  * - filtersActive: Determines if any filters are currently active.
  * - approvalArray: Extracts approval statuses from filter properties.
  * - workArray: Extracts work statuses from filter properties.
  * - visibleCount: Computes count of currently visible togglable columns.
  * - COLUMN_META: Metadata describing columns for the asset data table.
  * - FIXED_VISIBLE: Set of always-visible column IDs.
  * - PIPE_KEY: Settings key for hidden columns in pipeline settings.
  * - lsKeyForProject: Generates localStorage key for hidden columns per project.
  * - initPageProps: Initial pagination properties.
  * - initFilterProps: Initial filter properties.
  *
  * ───────────────────────────────────────────────────────────────────────── */
import React, {
  FC,
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import { RouteComponentProps } from "react-router-dom";
import { Box, Container, Icon, Menu, Paper, styled, MenuItem, Checkbox, Divider } from '@material-ui/core';
import { ButtonProps } from '@material-ui/core/Button';
import { SelectProps } from '@material-ui/core/Select';
import { TablePaginationProps } from '@material-ui/core/TablePagination';
import TextField, { TextFieldProps } from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import Button from '@material-ui/core/Button';
import { fetchGenerateAssetCsv } from './api';
import {
  useFetchAssetsPivot, // imported useFetchAssetsPivot
  useFetchAssets,
  useFetchLatestAssetComponents,
  useFetchPipelineSettingAssetComponents,
  useFetchTopGroupNames
} from './hooks';
import { FilterProps, PageProps, SortDir } from './types'; // Added SortDir import
import AssetsDataTable from './AssetsDataTable'
import AssetTableFilter from './AssetDataTableFilter';
import AssetsDataTableFooter from './AssetsDataTableFooter';
import DownloadFab from './DownloadFab';
import { useCurrentProject } from '../hooks';
import { Project } from '../types';
import { useCurrentStudio } from '../../studio/hooks';
import { queryConfig } from '../../new-pipeline-setting/api';
import { theme } from '../../theme';
import { borderRadius } from 'react-select/lib/theme';  // Adjust the import path as necessary

// Add IconButton import for icon buttons listView and gridView
import IconButton from '@material-ui/core/IconButton';  // Import IconButton for icon buttons
import ViewModuleIcon from '@material-ui/icons/ViewModule';
import ViewComfyIcon  from '@material-ui/icons/ViewComfy';
import ViewListIcon from '@material-ui/icons/ViewList';
import color from '@material-ui/core/colors/amber';
import FilterListIcon from '@material-ui/icons/FilterList';
import Collapse from '@material-ui/core/Collapse';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import FolderIcon from '@material-ui/icons/Folder';

// Import Group Data Table component
import AssetsGroupedDataTable from './AssetsGroupeDataTable';

const StyledContainer = styled(Container)(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  padding: 0,
  '& > *': {
    display: 'flex',
    overflow: 'hidden',
    padding: theme.spacing(1),
    paddingBottom: 0,
  },
  '& > *:last-child': {
    paddingBottom: theme.spacing(1),
  },
}));

const StyledPaper = styled(Paper)({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'auto',
});

const StyledContentDiv = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  display: 'flex',
  flexDirection: 'row',
}));

const StyledTableDiv = styled('div')(({
  paddingBottom: 8,
}));

const CsvDownloadComponent = ({ currentProject }: { currentProject: Project | null | undefined }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleErrorDialogClose = () => {
    setErrorDialogOpen(false);
  };

  const handleFetchGenerateAssetCsv = useCallback(async () => {
    if (currentProject == null) {
      console.warn('Project not selected.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60 * 5000);

    try {
      const res = await fetchGenerateAssetCsv(
        currentProject.key_name,
        controller.signal,
      );

      if (res != null) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'asset_data.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to download CSV:', err);
      setErrorMessage('Failed to download CSV');
      setErrorDialogOpen(true);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [currentProject]);

  return (
    <div>
      <DownloadFab
        onClick={handleFetchGenerateAssetCsv}
        disabled={isLoading}
      />
      <Dialog
        open={errorDialogOpen}
        onClose={handleErrorDialogClose}
        aria-labelledby="error-dialog-title"
      >
        <DialogTitle id="error-dialog-title">CSV Download Error</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {errorMessage}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleErrorDialogClose} color="primary" autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

const approvalStatuses = [
  'check',
  'clientReview',
  'dirReview',
  'epdReview',
  'clientOnHold',
  'dirOnHold',
  'epdOnHold',
  'execRetake',
  'clientRetake',
  'dirRetake',
  'epdRetake',
  'clientApproved',
  'dirApproved',
  'epdApproved',
  'other',
  'omit',
  'approved',
  'review',
];

const workStatuses = [
  'check',
  'cgsvOnHold',
  'svOnHold',
  'leadOnHold',
  'cgsvRetake',
  'svRetake',
  'leadRetake',
  'cgsvApproved',
  'svApproved',
  'leadApproved',
  'svOther',
  'leadOther',
];
/** * Initial values for the asset data table pagination properties.
const initPageProps: PageProps = { page: 0, rowsPerPage: 15 };
/**
 * Initial values for the asset data table filter properties.
 *
 * @remarks
 * This object provides default values for the filter state used in the AssetsDataTablePanel component.
 *
 * @type {FilterProps}
 * @property {string} assetNameKey - The key or name of the asset to filter by.
 * @property {string[]} applovalStatues - List of selected approval statuses for filtering.
 * @property {string[]} workStatues - List of selected work statuses for filtering.
 * @property {string} selectPhasePriority - Selected phase priority for filtering.
 * @property {string} selectApprovalStatus - Selected approval status for filtering.
 * @property {string} selectWorkStatus - Selected work status for filtering.
 * @property {(value: string) => void | undefined} onPhasePriorityChange - Callback for phase priority change.
 * @property {(value: string) => void | undefined} onApprovalStatusChange - Callback for approval status change.
 * @property {(value: string) => void | undefined} onWorkStatusChange - Callback for work status change.
 */
const initFilterProps: FilterProps = {
  assetNameKey: '',
  applovalStatues: [],
  workStatues: [],
  selectPhasePriority: '',
  selectApprovalStatus: '',
  selectWorkStatus: '',
  onPhasePriorityChange: undefined,
  onApprovalStatusChange: undefined,
  onWorkStatusChange: undefined,
};

/* ──────────────────────────────────────────────────────────────────────────
 * Metadata describing the columns for the Assets Data Table panel.
 * Each object in the array represents a column with a unique `id` and a display `label`.
 *
 * Columns include:
 * - Thumbnail preview
 * - Asset name
 * - Work, approval, and submission status for MDL, RIG, BLD, DSN, and LDV stages
 * - Relation information
* ────────────────────────────────────────────────────────────────────────── */
const COLUMN_META: { id: string; label: string }[] = [
  { id: 'thumbnail', label: 'Thumbnail' },
  { id: 'group_1_name', label: 'Name' },

  { id: 'mdl_work_status', label: 'MDL WORK' },
  { id: 'mdl_approval_status', label: 'MDL APPR' },
  { id: 'mdl_submitted_at', label: 'MDL Submitted At' },

  { id: 'rig_work_status', label: 'RIG WORK' },
  { id: 'rig_approval_status', label: 'RIG APPR' },
  { id: 'rig_submitted_at', label: 'RIG Submitted At' },

  { id: 'bld_work_status', label: 'BLD WORK' },
  { id: 'bld_approval_status', label: 'BLD APPR' },
  { id: 'bld_submitted_at', label: 'BLD Submitted At' },

  { id: 'dsn_work_status', label: 'DSN WORK' },
  { id: 'dsn_approval_status', label: 'DSN APPR' },
  { id: 'dsn_submitted_at', label: 'DSN Submitted At' },

  { id: 'ldv_work_status', label: 'LDV WORK' },
  { id: 'ldv_approval_status', label: 'LDV APPR' },
  { id: 'ldv_submitted_at', label: 'LDV Submitted At' },

  { id: 'relation', label: 'Relation' },
];

// Always-visible columns
const FIXED_VISIBLE = new Set<string>(['thumbnail', 'group_1_name']);

// Settings keys
const PIPE_KEY = '/ppiTracker/assets/hideColumns';
const lsKeyForProject = (projectKeyName?: string) => {
  return `ppi:assets:hideColumns:${projectKeyName || 'unknown'}`;
};


function paginateGroups(
  groups: any[],
  page: number,
  rowsPerPage: number
) {
  const start = page * rowsPerPage;
  const end = start + rowsPerPage;

  // Flatten items in display order
  const flat: Array<{ key: string; group: any; item: any }> = [];
  for (const g of groups || []) {
    const items = Array.isArray(g.items) ? g.items : [];
    for (const item of items) {
      flat.push({ key: String(g.top_group_node || ""), group: g, item });
    }
  }

  // Slice only the requested page items
  const slice = flat.slice(start, end);

  // Rebuild groups with sliced items (keep order)
  const out: any[] = [];
  const seen = new Map<string, any>();

  for (const row of slice) {
    if (!seen.has(row.key)) {
      const ng = { ...row.group, items: [] as any[] };
      seen.set(row.key, ng);
      out.push(ng);
    }
    seen.get(row.key).items.push(row.item);
  }

  return out;
}

/**
 * The main panel component for displaying and managing the asset data table within a project context.
 *
 * `AssetsDataTablePanel` provides a comprehensive UI for viewing, filtering, sorting, paginating, and exporting
 * asset data. It integrates with project and studio context, supports server-side and client-side sorting and filtering,
 * and allows users to customize column visibility with persistence to both localStorage and backend pipeline settings.
 *
 * ### Features
 * - Fetches and displays asset data for the current project, supporting both backend and client-side filtering/sorting.
 * - Supports filtering by asset name, approval status, and work status, with robust handling of property name typos.
 * - Provides server-side and client-side sorting, including phase-specific sorting logic.
 * - Allows users to toggle column visibility, with persistence across sessions and projects.
 * - Handles pagination, with dynamic adjustment based on filter state.
 * - Integrates with pipeline phase components and latest asset components.
 * - Supports CSV export of asset data.
 * - Handles timezone formatting based on studio settings.
 *
 * ### Props
 * This component does not accept any props directly; it relies on context hooks and internal state.
 *
 * @component
 * @example
 * ```tsx
 * <AssetsDataTablePanel />
 * ```
 *
 * @remarks
 * - Uses multiple hooks for fetching data and managing state.
 * - Designed for extensibility, with placeholders for future filter expansion.
 * - Handles both backend and client-side logic for optimal performance and user experience.
 *
 * @returns {JSX.Element} The rendered asset data table panel UI.
 */
const AssetsDataTablePanel: React.FC<RouteComponentProps> = () => {
  const initPageProps = {
    page: 0,
    rowsPerPage: 15,
  };


  // View mode state (grid, compact, list) - Add by PSI
  const [barView, setBarView] = React.useState<'grid' | 'compact' | 'list'>('list');
  const [barSearch, setBarSearch] = React.useState<string>('');
  const [AssetTypeOpen, setAssetTypeOpen] = React.useState(true);
  const [ApprovalStatusOpen, setApprovalStatusOpen] = React.useState(true);
  const [workStatusOpen, setWorkStatusOpen] = React.useState(true);


  // Determine if grouped view is active based on barView state
  const isGrouped = barView === 'grid';
  // IMPORTANT: backend expects view=list OR view=grouped
  // - list => flat rows in `assets`
  // - grouped => grouped rows in `groups`
  const viewMode = isGrouped ? 'grouped' : 'list';

  const initFilterProps = {
    assetNameKey: '',
    applovalStatues: [],
    workStatues: [],

    /* Add unused filter props for future use expansion possibility - Add by PSI */
    selectPhasePriority: '',  // Unused but kept for future use expansion possibility - phase priority filter
    selectApprovalStatus: '', // Unused but kept for future use expansion possibility - approval status filter
    selectWorkStatus: '', // Unused but kept for future use expansion possibility - work status filter
    onPhasePriorityChange: undefined, // Unused but kept for future use expansion possibility - phase priority filter
    onApprovalStatusChange: undefined, // Unused but kept for future use expansion possibility - approval status filter
    onWorkStatusChange: undefined, // Unused but kept for future use expansion possibility - work status filter

  };

  const [pageProps, setPageProps]     = useState<PageProps>(initPageProps);
  const [filterProps, setFilterProps] = useState<FilterProps>(initFilterProps);
  const { currentProject }            = useCurrentProject();
  const { assets: rawAssets, total: rawTotal } = useFetchAssets(
    currentProject,
    pageProps.page,
    pageProps.rowsPerPage,
  );
  const { phaseComponents }     = useFetchPipelineSettingAssetComponents(currentProject);
  const { currentStudio }       = useCurrentStudio();
  const [timeZone, setTimeZone] = useState<string | undefined>();
  const { latestComponents }    = useFetchLatestAssetComponents(currentProject, rawAssets, phaseComponents);

  /* Server-side sorting (drives fetch) - Add by PSI */
  const [sortKey, setSortKey] = useState<string>('group_1'); // e.g., group_1, mdl_approval_status, rig_work_status, etc.
  const [sortDir, setSortDir] = useState<SortDir>('asc'); // 'asc' | 'desc'

  /* Phase priority filter state (for future use expansion possibility) - Add by PSI */
  const [phasePriority, setPhasePriority] = useState<string>('none'); // mdl|rig|bld|dsn|ldv|none

  /* Client-side sorting (UI state) - Add by PSI */
  const [uiSortKey, setUiSortKey] = useState<string>('group_1'); // e.g., group_1, mdl_approval_status, rig_work_status, etc.
  const [uiSortDir, setUiSortDir] = useState<SortDir>('asc'); // 'asc' | 'desc'

  /* Debounce timer for committing sort changes to server-side - Add by PSI */
  const commitTimerRef = useRef<number | null>(null);  // Timer ID for debouncing

  /* Column visibility - Add by PSI */
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set()); // Set of column IDs that are hidden


  
  /**
   * Resolves a given column key to the corresponding server-side sort and phase values.
   *
   * - For fixed keys ('group_1', 'relation'), returns a direct mapping with phase set to 'none'.
   * - For phase-specific keys matching the pattern `^(mdl|rig|bld|dsn|ldv)_(work|appr|submitted)$`,
   *   extracts the phase and field, and maps them to the appropriate backend column ID.
   * - If the key does not match any known pattern, defaults to sorting by 'group_1' with phase 'none'.
   *
   * @param key - The column key to resolve for server-side sorting.
   * @returns An object containing the `sort` field (backend column ID) and `phase` (phase identifier).
   */
  const resolveServerSort = (key: string): { sort: string; phase: string } => {
    // Fixed keys: map directly
    if (key === 'group_1') return { sort: 'group_1', phase: 'none' };
    if (key === 'relation') return { sort: 'relation', phase: 'none' };

    // Phase-specific keys: map to the specific column ID for correct backend resolution
    const m = key.match(/^(mdl|rig|bld|dsn|ldv)_(work|appr|submitted)$/i);
    if (!m) return { sort: 'group_1', phase: 'none' };

    const phase = m[1].toLowerCase();
    const field = m[2].toLowerCase();

    if (field === 'submitted') return { sort: `${phase}_submitted`, phase };
    if (field === 'appr') return { sort: `${phase}_appr`, phase };
    return { sort: `${phase}_work`, phase };
  };

  /**
   * Persists the set of hidden columns to localStorage for the current project.
   *
   * @param next - The set of column IDs that are currently hidden.
   */
  const persistHiddenColumnsLocal = (next: Set<string>) => {
    const key = lsKeyForProject(
      currentProject && currentProject.key_name ? currentProject.key_name : undefined,
    );
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(next)));
    } catch (e) {
      console.error('localStorage save failed', e);
    }
  };

  /**
   * Saves the set of hidden columns to the pipeline settings on the server for the current project.
   *
   * @param cols - The set of column IDs that are currently hidden.
   */
  const saveHiddenColumnsToPipelineSetting = async (cols: Set<string>) => {
    try {
      if (!currentProject || !currentProject.key_name) return;
      await (queryConfig as any)(
        'project',
        currentProject.key_name,
        PIPE_KEY,
        JSON.stringify(Array.from(cols)),
      );
    } catch (e) {
      console.warn('PipelineSetting save failed; using local only', e);
    }
  };

  /**
   * Persists the set of hidden columns to both localStorage and pipeline settings.
   *
   * @param next - The set of column IDs that are currently hidden.
   */
  const persistHiddenColumns = (next: Set<string>) => {
    persistHiddenColumnsLocal(next);
    saveHiddenColumnsToPipelineSetting(next);
  };

  /**
   * Retrieves the array of approval statuses from the filter properties.
   * Handles possible misspellings of the property name ('approvalStatuses' and 'applovalStatues').
   * Defaults to an empty array if neither property is present.
   *
   * @type {string[]}
   */
  const approvalArray =
    ((filterProps as any).approvalStatuses ||
    filterProps.applovalStatues || []) as string[];

  /**
   * Extracts the array of work statuses from the `filterProps` object.
   *
   * This handles two possible property names: `workStatuses` (preferred) and `workStatues` (fallback, possibly a typo).
   * If neither property exists, it defaults to an empty array.
   *
   * @remarks
   * The cast to `any` is used to safely access both possible property names.
   * The result is always cast to a string array.
   *
   * @example
   * // Given filterProps = { workStatuses: ['Open', 'Closed'] }
   * // workArray will be ['Open', 'Closed']
   *
   * // Given filterProps = { workStatues: ['Pending'] }
   * // workArray will be ['Pending']
   *
   * // Given filterProps = {}
   * // workArray will be []
   */
  const workArray =
    ((filterProps as any).workStatuses ||
    filterProps.workStatues || []) as string[];

  /**
   * Computes the effective phase to be used based on the current filter and selection state.
   *
   * - If any filter is active (asset name, approval, or work arrays), returns 'none'.
   * - Otherwise, returns the provided `phasePriority` if it is set and not 'none'.
   * - Defaults to 'none' if no phase is prioritized or filters are active.
   *
   * Dependencies:
   * - `phasePriority`: The current prioritized phase.
   * - `filterProps.assetNameKey`: The asset name filter key.
   * - `approvalArray`: Array of selected approvals.
   * - `workArray`: Array of selected works.
   *
   * @returns {string} The effective phase, or 'none' if filters are active or no phase is prioritized.
   */
  const effectivePhase = useMemo(() => {
    const nameFilterActive = !!(filterProps.assetNameKey || '').trim();
    const approvalSelected = approvalArray.length > 0;
    const workSelected = workArray.length > 0;

    const isFilterActive = nameFilterActive || approvalSelected || workSelected;
    if (isFilterActive) return 'none';

    if (phasePriority && phasePriority !== 'none') return phasePriority;
    return 'none';
  }, [
    phasePriority,
    filterProps.assetNameKey,
    approvalArray,
    workArray,
  ]);

  /**
   * Determines if any filters are currently active in the asset data table panel.
   *
   * This memoized value checks if the asset name filter is non-empty (ignoring whitespace),
   * or if there are any selected approval or work items.
   *
   * @returns {boolean} `true` if any filter is active; otherwise, `false`.
   *
   * @dependency Depends on `filterProps.assetNameKey`, `approvalArray`, and `workArray`.
   */


  const { topGroupNames } = useFetchTopGroupNames(currentProject);
  // print log for debugging
  console.log('topGroupNames:', topGroupNames);

  // state
  const [filterAnchorEl, setFilterAnchorEl] = React.useState<null | HTMLElement>(null);
  const [topGroupQuery, setTopGroupQuery] = React.useState("");
  const open = Boolean(filterAnchorEl);
  const [selectedTopGroups, setSelectedTopGroups] = React.useState<string[]>([]);

  const filtersActive = useMemo(() => {
    const nameActive = !!(filterProps.assetNameKey || '').trim();
    return (
      nameActive ||
      approvalArray.length > 0 ||
      workArray.length > 0 ||
      selectedTopGroups.length > 0
    );
  }, [
    filterProps.assetNameKey,
    approvalArray,
    workArray,
    selectedTopGroups,
  ]);


  /* Backend pagination adjustments based on filter state - Add by PSI */
  const shouldFetchAllForPivot = viewMode === 'grouped' || filtersActive;
  const backendPage = shouldFetchAllForPivot ? 0 : pageProps.page;
  const backendRowsPerPage = shouldFetchAllForPivot ? 5000 : pageProps.rowsPerPage;

  /**
   * Fetches asset data and total count for the current project using the `useFetchAssetsPivot` hook.
   *
   * @returns An object containing:
   * - `assets`: The list of asset data matching the current filters, pagination, and sorting.
   * - `total`: The total number of assets matching the current filters.
   *
   * @see useFetchAssetsPivot
   */

  const { assets, total, groups } = useFetchAssetsPivot(
    currentProject,
    backendPage,
    backendRowsPerPage,
    sortKey,
    sortDir,
    effectivePhase,
    filterProps.assetNameKey,
    approvalArray,
    workArray,
    viewMode,
  );

  

  /* Client-side filtering and sorting of assets - Add by PSI */
  /**
   * Returns a filtered and sorted array of assets based on the provided filters and sort options.
   *
   * - Filters assets by asset name, approval status, and work status.
   * - Supports filtering by a specific phase or across all defined phases.
   * - Sorting is performed based on the current UI sort key and direction, supporting string and date fields.
   * - Handles empty, null, or placeholder values by always placing them last in the sort order.
   *
   * Dependencies:
   * - `assets`: The list of asset objects to filter and sort.
   * - `effectivePhase`: The currently selected phase for filtering, or 'none' for all phases.
   * - `uiSortKey`: The key indicating which field to sort by.
   * - `uiSortDir`: The direction of sorting ('asc', 'desc', or 'none').
   * - `filterProps.assetNameKey`: The asset name filter string.
   * - `approvalArray`: Array of approval status filters.
   * - `workArray`: Array of work status filters.
   *
   * @returns {any[]} The filtered and sorted array of asset objects.
   */
  const filteredAssets = useMemo(() => {
    if (!assets) return [];

    const nameFilter      = (filterProps.assetNameKey || '').trim().toLowerCase();
    const approvalFilters = approvalArray.map((s) => s.toLowerCase());
    const workFilters     = workArray.map((s) => s.toLowerCase());

    const phases = ['mdl', 'rig', 'bld', 'dsn', 'ldv'] as const;

    const compareDates = (a: any, b: any, dir: SortDir) => {
      const isAsc = dir === 'asc';

      const aNull = !a || a === '-';
      const bNull = !b || b === '-';

      // NULL / empty handling – ALWAYS last
      if (aNull && bNull) return 0;
      if (aNull) return 1; // a goes after b (ASC or DESC)
      if (bNull) return -1; // b goes after a

      const ta = new Date(a as any).getTime();
      const tb = new Date(b as any).getTime();

      if (ta === tb) return 0;

      if (isAsc) {
        return ta < tb ? -1 : 1;
      } else {
        return ta > tb ? -1 : 1;
      }
    };

    /**
     * Compares two string values for sorting, handling empty values and sort direction.
     *
     * - Converts both values to strings, trims whitespace, and treats `''` and `'-'` as empty.
     * - Empty values are always sorted last, regardless of direction.
     * - Comparison is case-insensitive.
     * - Sort direction is determined by the `dir` parameter (`'asc'` for ascending, `'desc'` for descending).
     *
     * @param a - The first value to compare.
     * @param b - The second value to compare.
     * @param dir - The sort direction, either `'asc'` or `'desc'`.
     * @returns `-1` if `a` should come before `b`, `1` if `a` should come after `b`, or `0` if they are equal.
     */
    const compareStrings = (a: any, b: any, dir: SortDir) => {
      const isAsc = dir === 'asc';

      const aa = (a || '').toString().trim();
      const bb = (b || '').toString().trim();

      const aEmpty = aa === '' || aa === '-';
      const bEmpty = bb === '' || bb === '-';

      // EMPTY handling – ALWAYS last
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1; // a after b
      if (bEmpty) return -1; // b after a

      const la = aa.toLowerCase();
      const lb = bb.toLowerCase();

      if (la === lb) return 0;

      if (isAsc) {
        return la < lb ? -1 : 1;
      } else {
        return la > lb ? -1 : 1;
      }
    };

    /**
     * Comparator function for sorting asset data rows based on the current UI sort key and direction.
     *
     * - If no sort key or direction is set, returns 0 (no sorting).
     * - Supports sorting by 'group_1' and 'relation' fields using string comparison.
     * - Supports dynamic sorting for keys matching the pattern `^(mdl|rig|bld|dsn|ldv)_(work|appr|submitted)$`:
     *   - For 'submitted', sorts by the corresponding submission date field.
     *   - For 'appr' and 'work', sorts by the respective approval or work status fields.
     *
     * @param a - The first row object to compare.
     * @param b - The second row object to compare.
     * @returns A negative number if `a` should come before `b`, a positive number if `a` should come after `b`, or 0 if they are considered equal.
     */
    const comparator = (a: any, b: any): number => {
      if (!uiSortKey || uiSortDir === 'none') return 0;

      if (uiSortKey === 'group_1') {
        return compareStrings(a.group_1, b.group_1, uiSortDir);
      }
      if (uiSortKey === 'relation') {
        return compareStrings(a.relation, b.relation, uiSortDir);
      }

      const m = uiSortKey.match(/^(mdl|rig|bld|dsn|ldv)_(work|appr|submitted)$/i);
      if (m) {
        const phase = m[1].toLowerCase();
        const field = m[2].toLowerCase();

        if (field === 'submitted') {
          const key = `${phase}_submitted_at_utc`; // or _submitted_at if that’s your field
          return compareDates(a[key], b[key], uiSortDir);
        }

        const key =
          field === 'appr'
            ? `${phase}_approval_status`
            : `${phase}_work_status`;

        return compareStrings(a[key], b[key], uiSortDir);
      }

      return 0;
    };

    /**
     * Filters the `assets` array based on multiple criteria:
     *
     * 1. **Asset Name Filter**: If `nameFilter` is provided, only assets whose `group_1` property
     *    (converted to lowercase string) includes the `nameFilter` string are kept.
     * 2. **Phase-Locked Matching**: If `effectivePhase` is set and not `'none'`, only assets matching
     *    the approval and work status filters for that phase are kept.
     * 3. **Approval and Work Status Filters**: For each phase, if `approvalFilters` or `workFilters`
     *    are provided, only assets whose corresponding approval and work status fields (e.g.,
     *    `${phase}_approval_status`, `${phase}_work_status`) match the filters are kept.
     * 4. **No Filters**: If no filters are applied, all assets are kept.
     * 5. **Any Phase Matching**: If no specific phase is active, the asset is kept if it matches
     *    the approval and work status filters for any phase in the `phases` array.
     *
     * @param assets - The array of asset objects to filter.
     * @param nameFilter - Optional string to filter assets by name (`group_1` property).
     * @param effectivePhase - The currently active phase to filter by, or `null`/`'none'` for all phases.
     * @param approvalFilters - Array of approval status strings to filter by.
     * @param workFilters - Array of work status strings to filter by.
     * @param phases - Array of phase names to check for matching approval/work status.
     * @returns The filtered array of assets matching all active filters.
     */
    const base = assets.filter((asset: any) => {
      // 1) Asset Name filter (group_1)
      if (nameFilter) {
        const name = (asset.group_1 || '').toString().toLowerCase();
        if (!name.includes(nameFilter)) return false;
      }

      // 2) Phase-locked matching (for client view)
      const phase =
        effectivePhase && effectivePhase !== 'none'
          ? effectivePhase.toLowerCase()
          : null;

      const matchesPhase = (p: string) => {
        if (approvalFilters.length > 0) {
          const rawAppr = (asset[`${p}_approval_status`] || '')
            .toString()
            .toLowerCase();
          if (!approvalFilters.includes(rawAppr)) return false;
        }
        if (workFilters.length > 0) {
          const rawWork = (asset[`${p}_work_status`] || '')
            .toString()
            .toLowerCase();
          if (!workFilters.includes(rawWork)) return false;
        }
        return true;
      };

      // No filters at all → keep row
      if (!nameFilter && approvalFilters.length === 0 && workFilters.length === 0) {
        return true;
      }

      // If a specific phase is active (e.g. "rig"), only that phase decides.
      if (phase) {
        return matchesPhase(phase);
      }

      // Otherwise, keep the row if ANY phase matches.
      return phases.some((p) => matchesPhase(p));
    });

    // --- then sort according to current UI sort key/dir ---
    base.sort(comparator);
    return base;
  }, [
    assets,
    effectivePhase,
    uiSortKey,
    uiSortDir,
    filterProps.assetNameKey,
    approvalArray,
    workArray,
  ]);




  /**
   * Determines the effective count of assets to display based on whether filters are active.
   * If filters are active, uses the length of the filtered assets array; otherwise, uses the total count.
   *
   * @remarks
   * This value is used to reflect the correct number of assets shown in the UI,
   * depending on the current filter state.
   *
   * @const
   * @type {number}
   * @see filteredAssets
   * @see filtersActive
   * @see total
   */
  const effectiveCount = filtersActive ? filteredAssets.length : total;

  useEffect(() => {
    if (currentStudio == null) {
      return
    }
    const controller = new AbortController();
    (async () => {
      try {
        const res: string | null = await queryConfig(
          'studio',
          currentStudio.key_name,
          'timezone',
        ).catch(e => {
          if (e.name === 'AbortError') {
            return;
          }
          throw e;
        });
        if (res != null) {
          setTimeZone(res);
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      controller.abort();
    };
  }, [currentStudio]);

  /* Load hidden columns from pipeline setting or localStorage - Add by PSI */
  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!currentProject) return;
      try {
        const val = await queryConfig('project', currentProject.key_name, PIPE_KEY);
        if (aborted) return;

        let arr: string[] | null = null;
        if (Array.isArray(val)) arr = val as string[];
        else if (typeof val === 'string' && val.trim() !== '') {
          try {
            arr = JSON.parse(val);
          } catch {
            arr = val.split(',').map((s) => s.trim());
          }
        }

        if (!arr) {
          try {
            const raw = localStorage.getItem(lsKeyForProject(currentProject.key_name));
            if (raw) arr = JSON.parse(raw);
          } catch {
            /* ignore */
          }
        }

        const sanitized = (arr || []).filter((id) => !FIXED_VISIBLE.has(id));
        setHiddenColumns(new Set(sanitized));
      } catch (e) {
        console.error('Load hideColumns failed; falling back to localStorage', e);
        try {
          const raw = localStorage.getItem(lsKeyForProject(currentProject.key_name));
          const arr: string[] = raw ? JSON.parse(raw) : [];
          const sanitized = arr.filter((id) => !FIXED_VISIBLE.has(id));
          setHiddenColumns(new Set(sanitized));
        } catch {
          setHiddenColumns(new Set());
        }
      }
    })();
    return () => {
      aborted = true;
    };
  }, [currentProject]);

  /* Cleanup on unmount - Add by PSI */
  useEffect(() => {
    return () => {
      if (commitTimerRef.current != null) {
        window.clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
    };
  }, []);

  /* Immediate sort commit (Replaced 2s debounce) */
  /**
   * Handles changes to the sort order when a user interacts with the UI sort controls.
   *
   * Resolves the server-side sort key and phase from the provided UI key, determines the next sort direction,
   * updates both server and UI sort states, and resets pagination if needed.
   *
   * @param newUiKey - The UI-specific key representing the column or field to sort by.
   */
  const handleSortChange = (newUiKey: string) => {
    const { sort: newServerSortKey, phase } = resolveServerSort(newUiKey);

    // Determine the next direction: Flip only if clicking the currently active server key.
    const nextServerDir: SortDir =
      sortKey === newServerSortKey ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';

    // 1. Update the server state immediately. This triggers useFetchAssetsPivot.
    setPhasePriority(phase);
    setSortKey(newServerSortKey);
    setSortDir(nextServerDir);

    // 2. Update the UI sort state immediately to reflect the arrow.
    setUiSortKey(newUiKey);
    setUiSortDir(nextServerDir);

    // Also reset page when sorting changes
    // setPageProps(p => ({ ...p, page: 0 }));
  };

  /* Toggle column visibility - Add by PSI */
  /**
   * Toggles the visibility of a column by its ID.
   *
   * If the column ID is present in the `FIXED_VISIBLE` set, the function does nothing.
   * Otherwise, it updates the `hiddenColumns` state by either adding or removing the column ID.
   * The updated set of hidden columns is persisted using `persistHiddenColumns`.
   *
   * @param id - The unique identifier of the column to toggle.
   */
  const toggleColumn = (id: string) => {
    if (FIXED_VISIBLE.has(id)) return;
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistHiddenColumns(next);
      return next;
    });
  };

  /* Show all columns - Add by PSI */
  /**
   * Shows all columns in the data table by clearing the set of hidden columns.
   * Updates both the local state and persists the change.
   *
   * @remarks
   * This function resets the hidden columns to an empty set, effectively making all columns visible.
   *
   * @returns void
   */
  const showAll = () => {
    const next = new Set<string>();
    setHiddenColumns(next);
    persistHiddenColumns(next);
  };

  /* Hide all non-fixed columns - Add by PSI */
  /**
   * Hides all columns that are not marked as fixed visible.
   *
   * This function creates a new set of column IDs by filtering out those that are present
   * in the `FIXED_VISIBLE` set. It then updates the hidden columns state and persists
   * the new hidden columns set.
   *
   * @remarks
   * - Only columns whose IDs are not in `FIXED_VISIBLE` will be hidden.
   * - The hidden columns state is both updated locally and persisted.
   */
  const hideAllNonFixed = () => {
    const next = new Set<string>(
      COLUMN_META.map((c) => c.id).filter((id) => !FIXED_VISIBLE.has(id)),
    );
    setHiddenColumns(next);
    persistHiddenColumns(next);
  };

  /* Explicit save (invoked from drawer) - Add by PSI */
  /**
   * Handles saving the currently hidden columns to the pipeline settings.
   *
   * This function asynchronously saves the `hiddenColumns` state to the pipeline settings
   * by calling `saveHiddenColumnsToPipelineSetting`.
   *
   * @returns {Promise<void>} A promise that resolves when the hidden columns have been saved.
   */
  const handleSaveColumns = async () => {
    await saveHiddenColumnsToPipelineSetting(hiddenColumns);
  };

  /* Count of currently visible togglable columns - Add by PSI */
  /**
   * Computes the number of currently visible columns that are not fixed.
   *
   * Uses `COLUMN_META` to get all column IDs, filters out those that are fixed (present in `FIXED_VISIBLE`),
   * and then counts how many of the remaining columns are not present in `hiddenColumns`.
   *
   * Memoized to only recompute when `hiddenColumns` changes.
   *
   * @returns {number} The count of visible, non-fixed columns.
   */
  const visibleCount = useMemo(() => {
    const togglable = COLUMN_META.map((c) => c.id).filter((id) => !FIXED_VISIBLE.has(id));
    let c = 0;
    togglable.forEach((id) => {
      if (!hiddenColumns.has(id)) c += 1;
    });
    return c;
  }, [hiddenColumns]);


  const handleRowsPerPageChange: TablePaginationProps['onChangeRowsPerPage'] = event => {
    setPageProps({
      page: 0,
      rowsPerPage: parseInt(event.target.value),
    });
  };

  const handlePageChange: TablePaginationProps['onChangePage'] = (event, newPage) => {
    setPageProps({
      ...pageProps,
      page: newPage,
    });
  };

  const handleFilterAssetNameChange: TextFieldProps['onChange'] = event => {
    setFilterProps({
      ...filterProps,
      assetNameKey: event.target.value,
    });
    setPageProps({ ...pageProps, page: 0 });
  };

  const handleApprovalStatusesChange: SelectProps['onChange'] = (event: React.ChangeEvent<{ value: unknown }>) => {
    setFilterProps({
      ...filterProps,
      applovalStatues: event.target.value as string[],
    });
    setPageProps({ ...pageProps, page: 0 });
  };

  const handleWorkStatusesChange: SelectProps['onChange'] = (event: React.ChangeEvent<{ value: unknown }>) => {
    setFilterProps({
      ...filterProps,
      workStatues: event.target.value as string[],
    });
    setPageProps({ ...pageProps, page: 0 });
  };

  const handleApprovalStatusesChipDelete = (name: string) => {
    setFilterProps({
      ...filterProps,
      applovalStatues: filterProps.applovalStatues.filter(value => value !== name),
    });
    setPageProps({ ...pageProps, page: 0 });
  };

  const handleWorkStatusesChipDelete = (name: string) => {
    setFilterProps({
      ...filterProps,
      workStatues: filterProps.workStatues.filter(value => value !== name),
    });
    setPageProps({ ...pageProps, page: 0 });
  };

  const handleFilterResetClick: ButtonProps['onClick'] = () => { setFilterProps(initFilterProps); };

  // View mode state (grid, compact, list) - Add by PSI
  // (Moved up above first usage)

  const dateTimeFormat = new Intl.DateTimeFormat(
    undefined,
    {
      timeZone: timeZone,
      dateStyle: 'medium',
      timeStyle: 'medium'
    }
  );

  const tableFooter = (
    <AssetsDataTableFooter
      count={effectiveCount}
      page={pageProps.page}
      rowsPerPage={pageProps.rowsPerPage}
      onChangePage={handlePageChange}
      onChangeRowsPerPage={handleRowsPerPageChange}
    />
  );

  // build counts from current loaded groups (or from API if you have totals)
  const topGroupCounts = React.useMemo(() => {
    const map = new Map<string, number>();
    (groups || []).forEach((g: any) => {
      const name = String(g.top_group_node || "Unassigned");
      const cnt = Array.isArray(g.items) ? g.items.length : 0;
      map.set(name, (map.get(name) || 0) + cnt);
    });
    return map;
  }, [groups]);

  const filteredTopGroupNames = React.useMemo(() => {
    const q = topGroupQuery.trim().toLowerCase();
    const names = (topGroupNames || []).slice();
    if (!q) return names;
    return names.filter((n) => n.toLowerCase().includes(q));
  }, [topGroupNames, topGroupQuery]);

  const rawGroups = groups || [];

  const topGroupTotalCounts = React.useMemo(() => {
    const map = new Map<string, number>();
    rawGroups.forEach((g: any) => {
      const name = String(g.top_group_node || "Unassigned");
      const cnt = Array.isArray(g.items) ? g.items.length : 0;
      map.set(name, (map.get(name) || 0) + cnt);
    });
    return map;
  }, [rawGroups]);

  // Client-side pagination when filters are active
  /**
   * Memoized selector that returns a paginated subset of filtered assets.
   *
   * - If filters are not active, returns the entire `filteredAssets` array.
   * - If filters are active, returns a slice of `filteredAssets` based on the current page and rows per page.
   *
   * Dependencies:
   * - `filtersActive`: Whether filters are currently applied.
   * - `filteredAssets`: The array of assets after filtering.
   * - `pageProps.page`: The current page index.
   * - `pageProps.rowsPerPage`: The number of rows to display per page.
   *
   * @returns {AssetType[]} The paginated array of filtered assets.
   */
  const pagedAssets = useMemo(() => {
    if (!filtersActive) return filteredAssets;

    const start = pageProps.page * pageProps.rowsPerPage;
    const end = start + pageProps.rowsPerPage;
    return filteredAssets.slice(start, end);
  }, [filtersActive, filteredAssets, pageProps.page, pageProps.rowsPerPage]);

  // Client-side filtering of groups based on selected top groups + other filters - Add by PSI
  const filteredGroups = useMemo(() => {
    const list = groups || [];

    const nameFilter = (filterProps.assetNameKey || '').trim().toLowerCase();
    const approvalFilters = approvalArray.map((s) => s.toLowerCase());
    const workFilters = workArray.map((s) => s.toLowerCase());
    const phases = ['mdl', 'rig', 'bld', 'dsn', 'ldv'] as const;
    const phase = effectivePhase && effectivePhase !== 'none'
      ? effectivePhase.toLowerCase()
      : null;

    const itemMatches = (item: any) => {
      // Asset name filter
      if (nameFilter) {
        const n = (item.group_1_name || item.name || item.asset_name || '').toString().toLowerCase();
        if (!n.includes(nameFilter)) return false;
      }

      const matchesPhase = (p: string) => {
        if (approvalFilters.length > 0) {
          const rawAppr = (item[`${p}_approval_status`] || '')
            .toString()
            .toLowerCase();
          if (!approvalFilters.includes(rawAppr)) return false;
        }
        if (workFilters.length > 0) {
          const rawWork = (item[`${p}_work_status`] || '')
            .toString()
            .toLowerCase();
          if (!workFilters.includes(rawWork)) return false;
        }
        return true;
      };

      // No approval/work filters → keep item (name filter already applied above)
      if (approvalFilters.length === 0 && workFilters.length === 0) {
        return true;
      }

      // If a specific phase is active (e.g. "rig"), only that phase decides.
      if (phase) return matchesPhase(phase);

      // Otherwise, keep the item if ANY phase matches.
      return phases.some((p) => matchesPhase(p));
    };

    // 1) Top-group filter (checkbox logic)
    let baseGroups = list;

    // ✅ NO selection → show EVERYTHING
    if (selectedTopGroups.length > 0) {
      const allowed = new Set(selectedTopGroups.map((g) => g.toLowerCase()));
      baseGroups = baseGroups.filter((g: any) =>
        allowed.has(String(g.top_group_node || '').toLowerCase())
      );
    }

    // 2) Apply asset-name / approval / work filters to items inside each group,
    //    and drop empty groups (so group headers don't show with 0 items)
    const out = baseGroups
      .map((g: any) => {
        const items = Array.isArray(g.items) ? g.items : [];
        const kept = items.filter(itemMatches);
        return { ...g, items: kept };
      })
      .filter((g: any) => (Array.isArray(g.items) ? g.items.length : 0) > 0);

    // If there are NO filters at all, keep all groups (including empty ones if backend returns them)
    const anyInnerFilter =
      !!nameFilter || approvalFilters.length > 0 || workFilters.length > 0;
    if (!anyInnerFilter) return baseGroups;

    return out;
  }, [
    groups,
    selectedTopGroups,
    filterProps.assetNameKey,
    approvalArray,
    workArray,
    effectivePhase,
  ]);
  
  // Filtered total count based on selected top groups - Add by PSI
  const filteredTotal = React.useMemo(() => {
    if (barView !== "grid") return total || 0;

    // if no group filter -> backend total
    if (selectedTopGroups.length === 0) return total || 0;

    // sum of items in visible groups
    return (filteredGroups || []).reduce((acc: number, g: any) => {
      const items = Array.isArray(g.items) ? g.items : [];
      return acc + items.length;
    }, 0);
  }, [barView, total, selectedTopGroups, filteredGroups]);

  // Client-side pagination of groups - Add by PSI
  /**
   * Returns a paginated subset of filtered groups based on the current page and rows per page.
   * Uses the `paginateGroups` utility function to slice the groups array.
   * Memoized to only recompute when dependencies change.
   * Dependencies:
   * - `filteredGroups`: The array of groups after applying filters.
   * - `pageProps.page`: The current page index.
   * - `pageProps.rowsPerPage`: The number of rows to display per page.
   * 
   * @returns {any[]} The paginated array of filtered groups.
   */
  
  // const pagedGroups = React.useMemo(() => {
  //   return paginateGroups(filteredGroups || [], pageProps.page, pageProps.rowsPerPage);
  // }, [filteredGroups, pageProps.page, pageProps.rowsPerPage]);
  
  const pagedGroups = React.useMemo(() => {
  const pg = paginateGroups(
    filteredGroups || [],
    pageProps.page,
    pageProps.rowsPerPage
  );

  return pg.map((g: any) => {
    const name = String(g.top_group_node || "Unassigned");
    return {
      ...g,
      totalCount: topGroupTotalCounts.get(name) || (g.items.length || 0),
    };
  });
  }, [
    filteredGroups,
    pageProps.page,
    pageProps.rowsPerPage,
    topGroupTotalCounts,
  ]);

  return (
    <StyledContainer maxWidth={false}>
      <AssetTableFilter
        onResetClick={handleFilterResetClick}
        hiddenColumns={hiddenColumns}
        onHiddenColumnsChange={setHiddenColumns}
        onToggleColumn={toggleColumn}
        onShowAll={showAll}
        onHideAll={hideAllNonFixed}
        visibleCount={visibleCount}
      />

        {/* new bar */}
        {/* ─────────────────────────────────────────────────────────────
            PIPELINE BAR (below filters, above table)
          ───────────────────────────────────────────────────────────── */}
        <div style={{ paddingLeft: 8, paddingRight: 8 }}>
          <Box
            style={{
              width: '100%',
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxSizing: 'border-box',
              marginBottom: 6,
              borderRadius: 0,
              backgroundColor: theme.palette.background.paper,
              paddingLeft: 8,
              paddingRight: 8,
            }}
          >
            {/* LEFT: view icons */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 2,
                overflow: 'hidden',

              }}
            >
            <IconButton
                size="small"
                onClick={() => setBarView('list')}
                style={{
                  padding: 6,
                  borderRadius: 0,
                  // (you asked to remove the backgroundColor conditional)
                }}
              >
                <ViewListIcon
                  style={{
                    fontSize: 18,
                    color: barView === 'list' ? '#00b7ff' : '#b0b0b0',
                  }}
                />
              </IconButton>

              <IconButton
                size="small"
                onClick={() => setBarView('grid')}
                style={{
                  padding: 6,
                  borderRadius: 0,
                }}
              >
                <ViewModuleIcon
                  style={{
                    fontSize: 18,
                    color: barView === 'grid' ? '#00b7ff' : '#b0b0b0',
                  }}
                />
              </IconButton>
            </div>

            {/* RIGHT: search + filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TextField
                placeholder="Search Assets..."
                variant="outlined"
                value={barSearch}
                onChange={(e) => {
                  const v = e.target.value;
                  setBarSearch(v);
                  // tie into the existing backend/client filter
                  setFilterProps((prev) => ({ ...prev, assetNameKey: v } as any));
                  setPageProps((prev) => ({ ...prev, page: 0 }));
                }}
                InputProps={{
                  style: {
                    height: 28,
                    width: 320,
                    fontSize: 12,
                  },
                }}
              />

              <Button
                size="small"
                variant="contained"
                startIcon={<FilterListIcon />}
                onClick={(e) => setFilterAnchorEl(e.currentTarget)}
                style={{
                  height: 28,
                  textTransform: 'none',
                  fontSize: 12,
                  backgroundColor: '#3479e0',
                  color: '#fff',
                }}
              >
                Filter
              </Button>
                <Menu
                  anchorEl={filterAnchorEl}
                  open={Boolean(filterAnchorEl)}
                  onClose={() => setFilterAnchorEl(null)}
                  keepMounted
                  PaperProps={{
                    style: {
                      width: 320,
                      maxHeight: 520,
                      background: "#2f2f2f",
                      color: "#e0e0e0",
                      borderRadius: 2,
                    },
                  }}
                >
                  {/* Clear all */}
                  <MenuItem
                    dense
                    onClick={() => setSelectedTopGroups([])}
                    style={{ fontWeight: 600 }}
                  >
                    Clear all filters
                  </MenuItem>

                  <Divider />

                  {/* Collapsible Section Header: Asset Type */}
                  <List 
                    disablePadding
                  >
                  <ListItem
                    button
                    dense
                    onClick={() => setAssetTypeOpen((v) => !v)}
                    style={{ paddingLeft: 12, paddingRight: 12 }}
                  >
                  <ListItemIcon 
                    style={{ minWidth: 32 }}>
                    {AssetTypeOpen ? <ExpandLess /> : <ExpandMore />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Asset Type"
                    primaryTypographyProps={{ style: { fontSize: 12, fontWeight: 700 } }}
                  />
                </ListItem>
                  
                <Collapse in={AssetTypeOpen} timeout="auto" unmountOnExit>
                <Box style={{ maxHeight: 360, overflowY: "hidden" }}>
                  {(topGroupNames || []).map((name) => {
                    const isChecked = selectedTopGroups.includes(name);
                    const count = topGroupCounts.get(name) || 0; // keep your counts logic

                return (
                  <MenuItem
                    key={name}
                    dense
                    style={{
                      paddingTop: 2,
                      paddingBottom: 2,
                      minHeight: 28,
                    }}
                    onClick={() => {
                      setSelectedTopGroups((prev) =>
                        prev.includes(name)
                          ? prev.filter((n) => n !== name)
                          : [...prev, name]
                      );
                    }}
                  >
                  <Checkbox 
                    checked={isChecked} 
                    size="small"
                    style={{padding: 4}}
                    />
                  <ListItemIcon 
                    style={{ minWidth: 16, 
                    color: '#f0f0f0'
                    }}>
                  <FolderIcon
                    style={{
                    fontSize: 14,
                    color: isChecked ? '#00b7ff' : '#b0b0b0', 
                  }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={name}
                    primaryTypographyProps={{ style: { fontSize: 12 } }}
                  />
                  <Box 
                    style={{ marginLeft: 8, 
                    opacity: 0.75, 
                    fontSize: 12 }}>
                  {count}
                  </Box>
                </MenuItem>
              );
            })}
            </Box>
            </Collapse>
            </List>
            <Divider 
            />
            {/* Collapsible Section Header: Approval Status */}
            {(() => {
              return (
                <>
                  <List disablePadding>
                    <ListItem
                      button
                      dense
                      onClick={() => setApprovalStatusOpen((v: boolean) => !v)}
                      style={{ paddingLeft: 12, paddingRight: 12 }}
                    >
                      <ListItemIcon style={{ minWidth: 32 }}>
                        {ApprovalStatusOpen ? <ExpandLess /> : <ExpandMore />}
                      </ListItemIcon>
                      <ListItemText
                        primary="Approval Status"
                        primaryTypographyProps={{ style: { fontSize: 12, fontWeight: 700 } }}
                      />
                    </ListItem>
                    <Collapse in={ApprovalStatusOpen} timeout="auto" unmountOnExit>
                      <Box style={{ maxHeight: 1500, overflowY: "hidden" }}>
                        {approvalStatuses.map((status: string) => {
                          // Use correct property name: applovalStatues
                          const isChecked = filterProps.applovalStatues.includes(status);
                          return (
                            <MenuItem
                              key={status}
                              dense
                              style={{
                                paddingTop: 2,
                                paddingBottom: 2,
                                minHeight: 28
                              }}
                              onClick={() => {
                                setFilterProps((prev) => {
                                  const current = prev.applovalStatues;
                                  const next = current.includes(status)
                                    ? current.filter((s) => s !== status)
                                    : [...current, status];
                                  return { ...prev, applovalStatues: next };
                                });
                                setPageProps((prev) => ({ ...prev, page: 0 }));
                              }}
                            >
                              <Checkbox
                                checked={isChecked}
                                size="small"
                                style={{ padding: 4 }}
                              />
                              <ListItemText
                                primary={status}
                                primaryTypographyProps={{ style: { fontSize: 12 } }}
                              />
                            </MenuItem>
                          );
                        })}
                      </Box>
                    </Collapse>
                  </List>
                  <Divider />

                  {/* Collapsible Section Header: Work Status */}
                  <List disablePadding>
                    <ListItem
                      button
                      dense
                      onClick={() => setWorkStatusOpen((v: boolean) => !v)}
                      style={{ paddingLeft: 12, paddingRight: 12 }}
                    >
                      <ListItemIcon style={{ minWidth: 32 }}>
                        {workStatusOpen ? <ExpandLess /> : <ExpandMore />}
                      </ListItemIcon>
                      <ListItemText
                        primary="Work Status"
                        primaryTypographyProps={{ style: { fontSize: 12, fontWeight: 700 } }}
                      />
                    </ListItem>
                    <Collapse in={workStatusOpen} timeout="auto" unmountOnExit>
                      <Box style={{ maxHeight: 1500, overflowY: "hidden" }}>
                        {workStatuses.map((status: string) => {
                          // Use correct property name: workStatues
                          const isChecked = filterProps.workStatues.includes(status);
                          return (
                            <MenuItem
                              key={status}
                              dense
                              style={{
                                paddingTop: 2,
                                paddingBottom: 2,
                                minHeight: 28
                              }}
                              onClick={() => {
                                setFilterProps((prev) => {
                                  const current = prev.workStatues;
                                  const next = current.includes(status)
                                    ? current.filter((s) => s !== status)
                                    : [...current, status];
                                  return { ...prev, workStatues: next };
                                });
                                setPageProps((prev) => ({ ...prev, page: 0 }));
                              }}
                            >
                              <Checkbox
                                checked={isChecked}
                                size="small"
                                style={{ padding: 4 }}
                              />
                              <ListItemText
                                primary={status}
                                primaryTypographyProps={{ style: { fontSize: 12 } }}
                              />
                            </MenuItem>
                          );
                        })}
                      </Box>
                    </Collapse>
                  </List>
                </>
              );
            })()}


            </Menu>
            </div>
            </Box>
            </div>

            <StyledTableDiv>
            <StyledPaper>
            <StyledContentDiv>
            <Box 
              display ="flex" 
              justifyContent="space-between" 
              alignItems="center" 
              mb={2}
            >
            {isGrouped ? (
            <Box fontSize={16} fontWeight={600}>
            <AssetsGroupedDataTable
              groups={pagedGroups} // Use pagedGroups for client-side pagination
              sortKey={uiSortKey} 
              sortDir={uiSortDir}
              onSortChange={handleSortChange}
              hiddenColumns={hiddenColumns}
              dateTimeFormat={dateTimeFormat}
              tableFooter={
                <AssetsDataTableFooter
                  count={filteredTotal}     // ✅ CORRECT
                  page={pageProps.page}
                  rowsPerPage={pageProps.rowsPerPage}
                  onChangePage={(e, page) =>
                    setPageProps((p) => ({ ...p, page }))
                  }
                  onChangeRowsPerPage={(e) =>
                    setPageProps((p) => ({
                      ...p,
                      page: 0,
                      rowsPerPage: parseInt(e.target.value, 10),
                    }))
                  }
                />
              }
            />
            </Box>
            ) : (
              <AssetsDataTable
                project={currentProject}
                assets={pagedAssets} // Use pagedAssets for client-side pagination
                phaseComponents={phaseComponents} // Pipeline phase components
                latestComponents={latestComponents} // Latest asset components
                tableFooter={tableFooter}
                dateTimeFormat={dateTimeFormat}

                /* Sorting props */
                currentSortKey={uiSortKey}// Current UI sort key
                currentSortDir={uiSortDir}// Current UI sort direction
                hiddenColumns={hiddenColumns} // Set of hidden column IDs
                onSortChange={handleSortChange} // Sort change handler

                // Pass filter props to table (optional)
                assetNameKey={filterProps.assetNameKey}
                approvalStatuses={filterProps.applovalStatues}
                workStatuses={filterProps.workStatues}
                page={pageProps.page}
                rowsPerPage={pageProps.rowsPerPage}
              />
            )}
            </Box>

            </StyledContentDiv>
            </StyledPaper>
            </StyledTableDiv>

            <CsvDownloadComponent
              currentProject={currentProject}
            />

            </StyledContainer>
  );
};

export default AssetsDataTablePanel;