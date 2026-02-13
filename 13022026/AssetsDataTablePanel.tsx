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
  * - [Current Date] - Added Group View name sorting with proper empty value handling
  * - [Current Date] - Fixed pipeline settings error by using localStorage as primary

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
import { Box, Container, Icon,  Paper, styled, MenuItem, Checkbox, Divider, Typography , Drawer, InputAdornment } from '@material-ui/core';
import { Snackbar} from '@material-ui/core';

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
import ClearIcon from '@material-ui/icons/Clear';
import { fetchGenerateAssetCsv } from './api';
import {
  useFetchAssetsPivot,
  useFetchAssets,
  useFetchLatestAssetComponents,
  useFetchPipelineSettingAssetComponents,
  useFetchTopGroupNames
} from './hooks';
import { FilterProps, PageProps, SortDir } from './types';
import AssetsDataTable from './AssetsDataTable'
import AssetTableFilter from './AssetDataTableFilter';
import AssetsDataTableFooter from './AssetsDataTableFooter';
import DownloadFab from './DownloadFab';
import { useCurrentProject } from '../../hooks';
import { Project } from '../../types';
import { useCurrentStudio } from '../../../studio/hooks';
import { queryConfig } from '../../../new-pipeline-setting/api';
import { theme } from '../../../theme';

import IconButton from '@material-ui/core/IconButton';
import ViewModuleIcon from '@material-ui/icons/ViewModule';
import ViewListIcon from '@material-ui/icons/ViewList';
import FilterListIcon from '@material-ui/icons/FilterList';
import Collapse from '@material-ui/core/Collapse';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import FolderIcon from '@material-ui/icons/Folder';

import AssetsGroupedDataTable from './AssetsGroupedDataTable';

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

/**
 * Utility functions for consistent empty value handling
 */
const isEmptyValue = (value: any): boolean => {
  if (value === null || value === undefined) return true;
  const str = String(value).trim();
  return str === '' || str === '-' || str === '—' || str === 'null' || str === 'undefined';
};

const formatForDisplay = (value: any): string => {
  if (isEmptyValue(value)) return '—';
  return String(value).trim();
};

/**
 * Enhanced comparison functions that keep empty values at the end
 */
const enhancedCompareDates = (a: any, b: any, dir: SortDir): number => {
  const isAsc = dir === 'asc';
  
  const aEmpty = isEmptyValue(a);
  const bEmpty = isEmptyValue(b);
  
  // Rule: Empty values always go to the END (regardless of sort direction)
  if (aEmpty && bEmpty) return 0;      // Both empty = equal
  if (aEmpty && !bEmpty) return 1;     // a empty, b valid = a goes AFTER b
  if (!aEmpty && bEmpty) return -1;    // a valid, b empty = a goes BEFORE b
  
  // Both have valid dates, compare normally
  try {
    const dateA = new Date(a);
    const dateB = new Date(b);
    
    if (dateA.getTime() === dateB.getTime()) return 0;
    
    if (isAsc) {
      return dateA < dateB ? -1 : 1;
    } else {
      return dateA > dateB ? -1 : 1;
    }
  } catch (e) {
    // If date parsing fails, fall back to string comparison
    return enhancedCompareStrings(a, b, dir);
  }
};

const enhancedCompareStrings = (a: any, b: any, dir: SortDir): number => {
  const isAsc = dir === 'asc';
  
  const aEmpty = isEmptyValue(a);
  const bEmpty = isEmptyValue(b);
  
  // Rule: Empty values always go to the END
  if (aEmpty && bEmpty) return 0;
  if (aEmpty && !bEmpty) return 1;   // a empty, goes after b
  if (!aEmpty && bEmpty) return -1;  // a valid, goes before b
  
  // Both have valid strings, compare case-insensitive
  const compA = String(a).trim().toLowerCase();
  const compB = String(b).trim().toLowerCase();
  
  if (compA === compB) return 0;
  
  if (isAsc) {
    return compA < compB ? -1 : 1;
  } else {
    return compA > compB ? -1 : 1;
  }
};

/**
 * The main panel component for displaying and managing the asset data table within a project context.
 */

// ✅ FIXED: Use the correct pipeline setting key
const PIPE_KEY = '/ppiTracker/assets/hiddenColumns';

const AssetsDataTablePanel: React.FC<RouteComponentProps> = () => {
  // ... (state declarations)

  // ✅ FIX: Ensure clearing filters also resets the search bar string
  const handleFilterResetClick: ButtonProps['onClick'] = () => { 
    setFilterProps(initFilterProps); 
    setBarSearch(''); // Clear the UI search bar [cite: 222]
    setPageProps(initPageProps); // Reset to page 0 [cite: 68]
  };

  const initPageProps = {
    page: 0,
    rowsPerPage: 15,
  };

  // View mode state (grid, list)
  const [barView, setBarView] = React.useState<'grid' | 'list'>('list');
  const [barSearch, setBarSearch] = React.useState<string>('');
  const [AssetTypeOpen, setAssetTypeOpen] = React.useState(true);
  const [ApprovalStatusOpen, setApprovalStatusOpen] = React.useState(true);
  const [workStatusOpen, setWorkStatusOpen] = React.useState(true);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Determine if grouped view is active based on barView state
  const isGrouped = barView === 'grid';
  const viewMode = isGrouped ? 'grouped' : 'list';

  const initFilterProps = {
    assetNameKey: '',
    approvalStatuses: [],
    workStatuses: [],

    selectPhasePriority: '',
    selectApprovalStatus: '',
    selectWorkStatus: '',
    onPhasePriorityChange: undefined,
    onApprovalStatusChange: undefined,
    onWorkStatusChange: undefined,
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

  /* Server-side sorting (drives fetch) */
  const [sortKey, setSortKey] = useState<string>('group_1');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  /* Group name sorting state */
  const [groupSortDir, setGroupSortDir] = useState<SortDir>('asc');

  /* Phase priority filter state */
  const [phasePriority, setPhasePriority] = useState<string>('none');

  /* Client-side sorting (UI state) */
  const [uiSortKey, setUiSortKey] = useState<string>('group_1');
  const [uiSortDir, setUiSortDir] = useState<SortDir>('asc');

  /* Debounce timer for committing sort changes to server-side */
  const commitTimerRef = useRef<number | null>(null);

  /* Column visibility */
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  // ============================================
  // 4. UPDATE RESOLVE SERVER SORT FOR TAKE
  // ============================================
  const resolveServerSort = (key: string): { sort: string; phase: string } => {
    if (key === 'group_1') return { sort: 'group_1', phase: 'none' };
    if (key === 'relation') return { sort: 'relation', phase: 'none' };

    const m = key.match(/^(mdl|rig|bld|dsn|ldv)_(work|appr|submitted|take)$/i);
    if (!m) return { sort: 'group_1', phase: 'none' };

    const phase = m[1].toLowerCase();
    const field = m[2].toLowerCase();

    if (field === 'submitted') return { sort: `${phase}_submitted`, phase };
    if (field === 'appr') return { sort: `${phase}_appr`, phase };
    if (field === 'take') return { sort: `${phase}_take`, phase };  // Already handled
    return { sort: `${phase}_work`, phase };
  };

  /**
   * Persists the set of hidden columns to localStorage for the current project.
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
 */
const saveHiddenColumnsToPipelineSetting = async (cols: Set<string>) => {
  try {
    if (!currentProject || !currentProject.key_name) return;
    
    console.log('Attempting to save hidden columns to pipeline settings...');
    console.log('Project:', currentProject.key_name);
    console.log('Key:', PIPE_KEY);
    console.log('Value:', Array.from(cols));
    
    // Use updateValue to save the configuration
    // queryConfig is only for reading, not writing
    const { updateValue } = await import('../../../new-pipeline-setting/api');
    
    await updateValue(
      PIPE_KEY, // key
      JSON.stringify(Array.from(cols)), // value
      'config', // group
      'project', // section
      currentProject.key_name, // entry (project name)
    );
    
    console.log('Pipeline settings save successful');
  } catch (e) {
    console.warn('PipelineSetting save failed; using local only', e);
    // Don't re-throw - we'll use localStorage as fallback
  }
};

  /**
   * Persists the set of hidden columns to both localStorage and pipeline settings.
   */
  const persistHiddenColumns = (next: Set<string>) => {
    // Always save to localStorage (primary storage)
    persistHiddenColumnsLocal(next);
    
    // Try pipeline settings as secondary (non-blocking)
    saveHiddenColumnsToPipelineSetting(next).catch(() => {
      // Silent fail - we already saved to localStorage
    });
  };

  const approvalArray =
    ((filterProps as any).approvalStatuses ||
    filterProps.approvalStatuses || []) as string[];

  const workArray =
    ((filterProps as any).workStatuses ||
    filterProps.workStatuses || []) as string[];
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

  const { topGroupNames } = useFetchTopGroupNames(currentProject);

  // state
  const [filterDrawerOpen, setFilterDrawerOpen] = React.useState(false);
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

  /* Backend pagination adjustments based on filter state */
  const shouldFetchAllForPivot = viewMode === 'grouped' || filtersActive;
  const backendPage = shouldFetchAllForPivot ? 0 : pageProps.page;
  const backendRowsPerPage = shouldFetchAllForPivot ? 100 : pageProps.rowsPerPage; // Reduced from 5000 to prevent timeout

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

  // Handle errors from the pivot fetch
  useEffect(() => {
    if (!assets && !groups && total === 0 && currentProject) {
      setError('Failed to load asset data. Please check your authentication or try again.');
      setSnackbarOpen(true);
    }
  }, [assets, groups, total, currentProject]);

  // ============================================
  // SIMPLER TAKE SORTING - Converts to integers
  // ============================================
  const enhancedCompareTake = useCallback((a: any, b: any, dir: SortDir): number => {
    const isAsc = dir === 'asc';
    
    const aEmpty = isEmptyValue(a);
    const bEmpty = isEmptyValue(b);
    
    // Empty values always go to the END
    if (aEmpty && bEmpty) return 0;
    if (aEmpty && !bEmpty) return 1;
    if (!aEmpty && bEmpty) return -1;
    
    // Extract numeric value (handles leading zeros)
    const getNumericValue = (val: any): number => {
      const str = String(val).trim();
      // Remove any non-digit characters
      const digits = str.replace(/\D/g, '');
      if (digits === '') return Infinity; // Push invalid to end
      
      const num = parseInt(digits, 10);
      return isNaN(num) ? Infinity : num;
    };
    
    const aVal = getNumericValue(a);
    const bVal = getNumericValue(b);
    
    if (aVal === bVal) return 0;
    
    if (isAsc) {
      return aVal < bVal ? -1 : 1;
    } else {
      return aVal > bVal ? -1 : 1;
    }
  }, []);


// ============================================
// OPTIMIZED USEMEMO
// ============================================
const filteredAssets = useMemo(() => {
  if (!assets) return [];

  const nameFilter = (filterProps.assetNameKey || '').trim().toLowerCase();
  const approvalFilters = approvalArray.map((s) => s.toLowerCase());
  const workFilters = workArray.map((s) => s.toLowerCase());

  const phases = ['mdl', 'rig', 'bld', 'dsn', 'ldv'] as const;

  // Comparator uses the memoized enhancedCompareTake
  const comparator = (a: any, b: any): number => {
    if (!uiSortKey || uiSortDir === 'none') return 0;

    if (uiSortKey === 'group_1') {
      return enhancedCompareStrings(a.group_1, b.group_1, uiSortDir);
    }
    if (uiSortKey === 'relation') {
      return enhancedCompareStrings(a.relation, b.relation, uiSortDir);
    }

    const m = uiSortKey.match(/^(mdl|rig|bld|dsn|ldv)_(work|appr|submitted|take)$/i);
    if (m) {
      const phase = m[1].toLowerCase();
      const field = m[2].toLowerCase();

      if (field === 'submitted') {
        const key = `${phase}_submitted_at_utc`;
        return enhancedCompareDates(a[key], b[key], uiSortDir);
      }
      
      if (field === 'take') {
        const key = `${phase}_take`;
        return enhancedCompareTake(a[key], b[key], uiSortDir);  // Now using the memoized function
      }

      const key = field === 'appr'
        ? `${phase}_approval_status`
        : `${phase}_work_status`;

      return enhancedCompareStrings(a[key], b[key], uiSortDir);
    }

    return 0;
  };

  const base = assets.filter((asset: any) => {
    // Top-group filter
    if (selectedTopGroups.length > 0) {
      const normalizeTopGroup = (v: any) => {
        const s = (v || '').toString().trim();
        if (!s) return 'unassigned';
        const ls = s.toLowerCase();
        if (ls === 'unassigned' || ls === 'unassigned/' || ls === 'none' || ls === 'null' || ls === 'undefined') {
          return 'unassigned';
        }
        return ls;
      };

      const allowed = new Set(selectedTopGroups.map(normalizeTopGroup));
      const tg = normalizeTopGroup(asset.top_group_node);
      if (!allowed.has(tg)) return false;
    }

    // Asset Name filter
    if (nameFilter) {
      const name = (asset.group_1 || '').toString().toLowerCase();
      if (!name.includes(nameFilter)) return false;
    }

    // Phase-locked matching
    const phase = effectivePhase && effectivePhase !== 'none'
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

    // If a specific phase is active, only that phase decides
    if (phase) {
      return matchesPhase(phase);
    }

    // Otherwise, keep the row if ANY phase matches
    return phases.some((p) => matchesPhase(p));
  });

  // Sort according to current UI sort key/dir
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
  selectedTopGroups,
  enhancedCompareTake, // Add this dependency
  enhancedCompareStrings,
  enhancedCompareDates,
]);

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

  /* Load hidden columns - PRIMARY: localStorage, SECONDARY: pipeline settings */
  useEffect(() => {
    let aborted = false;
    
    (async () => {
      if (!currentProject) return;
      
      const projectKey = currentProject.key_name;
      console.log('Loading hidden columns for project:', projectKey);
      
      // TRY 1: localStorage first (fast, reliable)
      try {
        const lsKey = lsKeyForProject(projectKey);
        const raw = localStorage.getItem(lsKey);
        
        if (raw) {
          const arr: string[] = JSON.parse(raw);
          console.log('Loaded from localStorage:', arr);
          const sanitized = arr.filter((id) => !FIXED_VISIBLE.has(id));
          if (!aborted) {
            setHiddenColumns(new Set(sanitized));
          }
          return; // Success with localStorage
        }
      } catch (lsError) {
        console.warn('localStorage load failed:', lsError);
      }
      
      // TRY 2: Pipeline settings as fallback (optional)
      // Comment this out if you want to skip pipeline settings entirely
      /*
      try {
        console.log('Trying pipeline settings for hidden columns...');
        const val = await queryConfig('project', projectKey, PIPE_KEY);
        
        if (aborted) return;
        
        let arr: string[] | null = null;
        if (Array.isArray(val)) {
          arr = val as string[];
        } else if (typeof val === 'string' && val.trim() !== '') {
          try {
            arr = JSON.parse(val);
          } catch {
            arr = val.split(',').map((s: string) => s.trim());
          }
        }
        
        if (arr && Array.isArray(arr)) {
          console.log('Loaded from pipeline settings:', arr);
          const sanitized = arr.filter((id) => !FIXED_VISIBLE.has(id));
          if (!aborted) {
            setHiddenColumns(new Set(sanitized));
            
            // Also save to localStorage for faster access next time
            persistHiddenColumnsLocal(new Set(sanitized));
          }
          return;
        }
      } catch (pipeError) {
        console.warn('Pipeline settings load failed (using localStorage only):', pipeError);
      }
      */
      
      // Default: empty set
      if (!aborted) {
        setHiddenColumns(new Set());
      }
    })();
    
    return () => {
      aborted = true;
    };
  }, [currentProject]);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      if (commitTimerRef.current != null) {
        window.clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
    };
  }, []);

  /**
   * Handles changes to the sort order when a user interacts with the UI sort controls.
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
  };

  /**
   * Handles group name sorting toggle.
   */
  const handleGroupSortToggle = () => {
    setGroupSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  /* Toggle column visibility */
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

  /* Show all columns */
  const showAll = () => {
    const next = new Set<string>();
    setHiddenColumns(next);
    persistHiddenColumns(next);
  };

  /* Hide all non-fixed columns */
  const hideAllNonFixed = () => {
    const next = new Set<string>(
      COLUMN_META.map((c) => c.id).filter((id) => !FIXED_VISIBLE.has(id)),
    );
    setHiddenColumns(next);
    persistHiddenColumns(next);
  };

  /* Explicit save (invoked from drawer) */
  const handleSaveColumns = async () => {
    await saveHiddenColumnsToPipelineSetting(hiddenColumns);
  };

  /* Count of currently visible togglable columns */
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
      approvalStatuses: event.target.value as string[],
    });
    setPageProps({ ...pageProps, page: 0 });
  };

  const handleWorkStatusesChange: SelectProps['onChange'] = (event: React.ChangeEvent<{ value: unknown }>) => {
    setFilterProps({
      ...filterProps,
      workStatuses: event.target.value as string[],
    });
    setPageProps({ ...pageProps, page: 0 });
  };

  const handleApprovalStatusesChipDelete = (name: string) => {
    setFilterProps({
      ...filterProps,
      approvalStatuses: filterProps.approvalStatuses.filter(value => value !== name),
    });
    setPageProps({ ...pageProps, page: 0 });
  };

  const handleWorkStatusesChipDelete = (name: string) => {
    setFilterProps({
      ...filterProps,
      workStatuses: filterProps.workStatuses.filter(value => value !== name),
    });
    setPageProps({ ...pageProps, page: 0 });
  };

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

  // build counts from current loaded groups
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
    const q = barSearch.trim().toLowerCase();
    const names = (topGroupNames || []).slice();
    if (!q) return names;
    return names.filter((n) => n.toLowerCase().includes(q));
  }, [topGroupNames, barSearch]);

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
  const pagedAssets = useMemo(() => {
    if (!filtersActive) return filteredAssets;

    const start = pageProps.page * pageProps.rowsPerPage;
    const end = start + pageProps.rowsPerPage;
    return filteredAssets.slice(start, end);
  }, [filtersActive, filteredAssets, pageProps.page, pageProps.rowsPerPage]);

  // Client-side filtering of groups based on selected top groups + other filters
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
        const n = (
          item.group_1 ||
          item.group_1_name ||
          item.name ||
          item.asset_name ||
          ''
        )
          .toString()
          .toLowerCase();
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

    // 1) Top-group filter
    let baseGroups = list;

    // ✅ NO selection → show EVERYTHING
    if (selectedTopGroups.length > 0) {
      const allowed = new Set(selectedTopGroups.map((g) => g.toLowerCase()));
      baseGroups = baseGroups.filter((g: any) =>
        allowed.has(String(g.top_group_node || '').toLowerCase())
      );
    }

    // 2) Apply asset-name / approval / work filters to items inside each group
    const out = baseGroups
      .map((g: any) => {
        const items = Array.isArray(g.items) ? g.items : [];
        const kept = items.filter(itemMatches);
        return { ...g, items: kept };
      })
      .filter((g: any) => (Array.isArray(g.items) ? g.items.length : 0) > 0);

    // If there are NO filters at all, keep all groups
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
  
  // Filtered total count based on selected top groups
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

  // Sort groups by name before pagination (empty group names go to the end)
  const sortedGroups = React.useMemo(() => {
    const groupsToSort = filteredGroups || [];
    
    // Apply group name sorting with empty values at the end
    const sorted = [...groupsToSort];
    
    sorted.sort((a, b) => {
      const nameA = (a.top_group_node || 'Unassigned').toLowerCase();
      const nameB = (b.top_group_node || 'Unassigned').toLowerCase();
      
      // Treat "Unassigned" as a special case - should go to the end
      const aIsUnassigned = nameA === 'unassigned';
      const bIsUnassigned = nameB === 'unassigned';
      
      if (aIsUnassigned && bIsUnassigned) return 0;
      if (aIsUnassigned) return 1;  // Unassigned goes after named groups
      if (bIsUnassigned) return -1; // Named groups go before Unassigned
      
      // Normal alphabetical sorting
      return groupSortDir === 'asc' 
        ? nameA.localeCompare(nameB)
        : nameB.localeCompare(nameA);
    });
    
    return sorted;
  }, [filteredGroups, groupSortDir]);

  // Sort items within each group (empty values go to the end)
  const sortedGroupsWithItems = React.useMemo(() => {
    return sortedGroups.map(group => {
      const items = [...(group.items || [])];
      
      // Apply item sorting if a sort key is active
      if (uiSortKey && uiSortDir !== 'none') {
        items.sort((a, b) => {
          // Use the enhanced comparison logic
          if (uiSortKey === 'group_1') {
            return enhancedCompareStrings(a.group_1, b.group_1, uiSortDir);
          }
          
          const m = uiSortKey.match(/^(mdl|rig|bld|dsn|ldv)_(work|appr|submitted)$/i);
          if (m) {
            const phase = m[1].toLowerCase();
            const field = m[2].toLowerCase();
            
            if (field === 'submitted') {
              const aVal = a[`${phase}_submitted_at_utc`] || '';
              const bVal = b[`${phase}_submitted_at_utc`] || '';
              return enhancedCompareDates(aVal, bVal, uiSortDir);
            }
            
            const key = field === 'appr' 
              ? `${phase}_approval_status`
              : `${phase}_work_status`;
            
            const aVal = (a[key] || '').toString().trim();
            const bVal = (b[key] || '').toString().trim();
            return enhancedCompareStrings(aVal, bVal, uiSortDir);
          }
          
          return 0;
        });
      }
      
      return { ...group, items };
    });
  }, [sortedGroups, uiSortKey, uiSortDir]);

  // Client-side pagination of groups
  const pagedGroups = React.useMemo(() => {
    const pg = paginateGroups(
      sortedGroupsWithItems || [],
      pageProps.page,
      pageProps.rowsPerPage
    );

    // Attach totalCount for "visible of total" display in grouped headers
    return pg.map((g: any) => {
      const name = String(g.top_group_node || 'Unassigned');
      return {
        ...g,
        totalCount: topGroupTotalCounts.get(name) || ((g.items || []).length || 0),
      };
    });
  }, [
    sortedGroupsWithItems,
    pageProps.page,
    pageProps.rowsPerPage,
    topGroupTotalCounts,
  ]);

  // Function to paginate groups
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

  const filterActiveColors = filtersActive ? 'primary' : 'default';
  return (
    <>
      <StyledContainer maxWidth={false}>
        <AssetTableFilter
          filterActive={filtersActive}
          showInlineFilters={false}
          headerLeft={(
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 2,
                overflow: 'hidden',
                paddingLeft: 4,
                paddingRight: 4,
                paddingTop: 10,
                height: 50,
              }}
            >
              <IconButton
                size="small"
                onClick={() => setBarView('list')}
                style={{ padding: 6, borderRadius: 0 }}
                aria-label="List view"
              >
                <ViewListIcon
                  style={{
                    fontSize: 25,
                    color: barView === 'list' ? '#00b7ff' : '#b0b0b0',
                  }}
                />
              </IconButton>

              <IconButton
                size="small"
                onClick={() => setBarView('grid')}
                style={{ padding: 6, borderRadius: 0 }}
                aria-label="Grouped view"
              >
                <ViewModuleIcon
                  style={{
                    fontSize: 25,
                    color: barView === 'grid' ? '#00b7ff' : '#b0b0b0',
                  }}
                />
              </IconButton>

              {/* Group sorting toggle */}
              {isGrouped && (
                <Box display="flex" alignItems="center" ml={2} style={{ gap: 8 }}>
                  <Typography variant="caption" style={{ color: '#aaa', fontSize: 11 }}>
                    Sort Groups:
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleGroupSortToggle}
                    style={{
                      height: 24,
                      fontSize: 11,
                      minWidth: 80,
                      padding: '0 6px',
                      color: '#00b7ff',
                      borderColor: '#00b7ff',
                    }}
                  >
                    Name {groupSortDir === 'asc' ? 'A-Z ↑' : 'Z-A ↓'}
                  </Button>
                </Box>
              )}
            </div>
          )}
          headerRight={(
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TextField
            placeholder= {barSearch.trim().length >= 3 ? "Searching assets" : "Search Assets..." }
            variant="outlined"
            value={barSearch}
            onChange={(e) => {
            const v = e.target.value;
            setBarSearch(v);

            // Update filter only if 3+ chars or cleared
            if (v.trim().length >= 3 || v.trim().length === 0) {
              setFilterProps((prev) => ({ ...prev, assetNameKey: v } as any));
              setPageProps((prev) => ({ ...prev, page: 0 }));
            }

            }}
            InputProps={{
            style: {
              height: 28,
              width: 320,
              fontSize: 12,
            },
            endAdornment: barSearch.trim().length >= 3 ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => {
                    setBarSearch('');
                    setFilterProps((prev) => ({ ...prev, assetNameKey: '' } as any));
                    setPageProps((prev) => ({ ...prev, page: 0 }));
                  }}
                >
                  <ClearIcon style={{ fontSize: 16, color: '#888' }} />
                </IconButton>
              </InputAdornment>
            ) : null,
            }}
          />

          <Button
            size="small"
            variant="contained"
            startIcon={<FilterListIcon style={{ 
                      color: filterActiveColors === 'primary' ? '#fff' : '#ffffffff' }}/> }
            onClick={() => setFilterDrawerOpen(true)}
            style={{
              height: 28,
              textTransform: 'none',
              fontSize: 12,
              backgroundColor: filterActiveColors === 'primary' ? '#00b7ff' : '#3d3d3dff',
              color: '#fff',
              borderRadius: 2,
            }}
          >
            Filter
          </Button>
          <Drawer
            anchor="right"
            open={filterDrawerOpen}
            onClose={() => setFilterDrawerOpen(false)}
            PaperProps={{
              style: {
                width: 320,
                background: "#2f2f2f",
                color: "#e0e0e0",
                borderRadius: 2,
                // ✅ push the drawer down below the top bar/header
                top: 150,
                height: "calc(100% - 150px)",
                right: 250,
              },
            }}
          >
            <Box style={{ height: "100%", overflowY: "auto" }}>
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
          <List disablePadding>
            <ListItem
              button
              dense
              onClick={() => setAssetTypeOpen((v) => !v)}
              style={{ paddingLeft: 12, paddingRight: 12 }}
            >
              <ListItemIcon style={{ minWidth: 32 }}>
                {AssetTypeOpen ? <ExpandLess /> : <ExpandMore />}
              </ListItemIcon>
              <ListItemText
                primary="Asset Groups"
                primaryTypographyProps={{ style: { fontSize: 12, fontWeight: 700} }}
              />
            </ListItem>

            <Collapse in={AssetTypeOpen} timeout="auto" unmountOnExit>
              <Box style={{ maxHeight: 360, overflowY: "hidden", padding:0 }}>
                {(topGroupNames || []).map((name) => {
                  const isChecked = selectedTopGroups.includes(name);
                  const count = topGroupCounts.get(name) || 0;

                  return (
                    <MenuItem
                      key={name}
                      dense
                      style={{
                        paddingTop: 2,
                        paddingBottom: 2,
                        minHeight: 28,
                        gap: 4, // space between items cherckbox + icon + text
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
                        style={{ padding: 4, color: '#b0b0b0' }}
                      />
                      <ListItemIcon
                        style={{
                          minWidth: 16,
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
                        primaryTypographyProps={{ style: { fontSize: 12, lineHeight: '16px' } }}
                      />
                      <Box
                        style={{
                          marginLeft: 8,
                          opacity: 0.75,
                          fontSize: 12
                        }}>
                        {count}
                      </Box>
                    </MenuItem>
                  );
                })}
              </Box>
            </Collapse>
          </List>
          <Divider />
          {/* Collapsible Section Header: Approval Status */}
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
                    const isChecked = filterProps.approvalStatuses.includes(status);
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
                            const current = prev.approvalStatuses;
                            const next = current.includes(status)
                              ? current.filter((s) => s !== status)
                              : [...current, status];
                            return { ...prev, approvalStatuses: next };
                          });
                          setPageProps((prev) => ({ ...prev, page: 0 }));
                        }}
                      >
                        <Checkbox
                          checked={isChecked}
                          size="small"
                          style={{ padding: 4, color: '#b0b0b0' }}
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
                    const isChecked = filterProps.workStatuses.includes(status);
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
                            const current = prev.workStatuses;
                            const next = current.includes(status)
                              ? current.filter((s) => s !== status)
                              : [...current, status];
                            return { ...prev, workStatuses: next };
                          });
                          setPageProps((prev) => ({ ...prev, page: 0 }));
                        }}
                      >
                        <Checkbox
                          checked={isChecked}
                          size="small"
                          style={{ padding: 4, color: '#b0b0b0' }}
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
            </Box>
          </Drawer>
      </div>
    )}
    filterAssetName={filterProps.assetNameKey}
    selectApprovalStatuses={
      filterProps.approvalStatuses
    }
    selectWorkStatuses={
      filterProps.workStatuses
    }

    onAssetNameChange={handleFilterAssetNameChange}
    onApprovalStatusesChange={handleApprovalStatusesChange}
    onWorkStatusesChange={handleWorkStatusesChange}
    onApprovalStatusChipDelete={handleApprovalStatusesChipDelete}
    onWorkStatusChipDelete={handleWorkStatusesChipDelete}
    onResetClick={handleFilterResetClick}

    /* Drawer-based column visibility */
    hiddenColumns={hiddenColumns}
    onHiddenColumnsChange={setHiddenColumns}
    onToggleColumn={toggleColumn}
    onShowAll={showAll}
    onHideAll={hideAllNonFixed}
    visibleCount={visibleCount}
    onSaveColumns={handleSaveColumns}
  >
    </AssetTableFilter>
      <StyledTableDiv>
        <StyledPaper>
        <StyledContentDiv>
        <Box 
          display="flex" 
          justifyContent="space-between" 
          alignItems="center" 
          mb={2}
        >
        {isGrouped ? (
          <Box fontSize={16} fontWeight={600} width="100%">
            <AssetsGroupedDataTable
              groups={pagedGroups}
              sortKey={uiSortKey}
              sortDir={uiSortDir}
              groupSortDir={groupSortDir}
              onSortChange={handleSortChange}
              onGroupSortToggle={handleGroupSortToggle}
              hiddenColumns={hiddenColumns}
              dateTimeFormat={dateTimeFormat}
              tableFooter={
                <AssetsDataTableFooter
                  count={filteredTotal}
                  page={pageProps.page}
                  rowsPerPage={pageProps.rowsPerPage}
                  onChangePage={(_, page) =>
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
              assets={pagedAssets}
              phaseComponents={phaseComponents}
              latestComponents={latestComponents}
              tableFooter={tableFooter}
              dateTimeFormat={dateTimeFormat}

              /* Sorting props */
              currentSortKey={uiSortKey}
              currentSortDir={uiSortDir}
              hiddenColumns={hiddenColumns}
              onSortChange={handleSortChange}

              // Pass filter props to table (optional)
              assetNameKey={filterProps.assetNameKey}
              approvalStatuses={filterProps.approvalStatuses}
              workStatuses={filterProps.workStatuses}
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
      
      {/* Error Snackbar */}
      <Snackbar 
        open={snackbarOpen} 
        autoHideDuration={6000} 
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <div style={{
          background: '#d32f',
          color: '#fff',
          borderRadius: 4,
          fontSize: 14,
        }}
        >
          {error || 'An unknown error occurred.'}
        </div>
      </Snackbar>
    </>
  );  
};

// Metadata describing the columns for the Assets Data Table panel.
const COLUMN_META: { id: string; label: string }[] = [
  { id: 'thumbnail', label: 'Thumbnail' },
  { id: 'group_1_name', label: 'Name' },

  { id: 'mdl_work_status', label: 'MDL WORK' },
  { id: 'mdl_approval_status', label: 'MDL APPR' },
  { id: 'mdl_submitted_at', label: 'MDL Submitted At' },
  { id: 'mdl_take', label: 'MDL Take' },

  { id: 'rig_work_status', label: 'RIG WORK' },
  { id: 'rig_approval_status', label: 'RIG APPR' },
  { id: 'rig_submitted_at', label: 'RIG Submitted At' },
  { id: 'rig_take', label: 'RIG Take' },

  { id: 'bld_work_status', label: 'BLD WORK' },
  { id: 'bld_approval_status', label: 'BLD APPR' },
  { id: 'bld_submitted_at', label: 'BLD Submitted At' },
  { id: 'bld_take', label: 'BLD Take' },

  { id: 'dsn_work_status', label: 'DSN WORK' },
  { id: 'dsn_approval_status', label: 'DSN APPR' },
  { id: 'dsn_submitted_at', label: 'DSN Submitted At' },
  { id: 'dsn_take', label: 'DSN Take' },

  { id: 'ldv_work_status', label: 'LDV WORK' },
  { id: 'ldv_approval_status', label: 'LDV APPR' },
  { id: 'ldv_submitted_at', label: 'LDV Submitted At' },
  { id: 'ldv_take', label: 'LDV Take' },

  { id: 'relation', label: 'Relation' },
];

// Always-visible columns
const FIXED_VISIBLE = new Set<string>(['thumbnail', 'group_1_name']);

// Settings keys
const lsKeyForProject = (projectKeyName?: string) => {
  return `ppi:assets:hiddenColumns:${projectKeyName || 'unknown'}`;
};

export default AssetsDataTablePanel;