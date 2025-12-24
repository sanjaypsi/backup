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
import { Box, Container, Icon, Paper, styled } from '@material-ui/core';
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
  useFetchAssetsPivot,
  useFetchAssets,
  useFetchLatestAssetComponents,
  useFetchPipelineSettingAssetComponents
} from './hooks';
import { FilterProps, PageProps, SortDir } from './types';
import AssetsDataTable from './AssetsDataTable'
import AssetTableFilter from './AssetDataTableFilter';
import AssetsDataTableFooter from './AssetsDataTableFooter';
import DownloadFab from './DownloadFab';
import { useCurrentProject } from '../hooks';
import { Project } from '../types';
import { useCurrentStudio } from '../../studio/hooks';
import { queryConfig } from '../../new-pipeline-setting/api';
import { theme } from '../../theme';

// Add IconButton import for icon buttons listView and gridView
import IconButton from '@material-ui/core/IconButton';
import ViewModuleIcon from '@material-ui/icons/ViewModule';
import ViewComfyIcon  from '@material-ui/icons/ViewComfy';
import ViewListIcon from '@material-ui/icons/ViewList';
import FilterListIcon from '@material-ui/icons/FilterList';

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

/* ──────────────────────────────────────────────────────────────────────────
 * LEFT GROUP PANEL (step-1 UI only)
 * NOTE: Keep ALL hooks inside AssetsDataTablePanel to avoid "Invalid hook call".
 * ────────────────────────────────────────────────────────────────────────── */

type GroupPanelItem = { id: string; label: string; items: string[] };

const MOCK_GROUPS: GroupPanelItem[] = [
  { id: 'camera', label: 'Camera', items: ['camAim', 'camHero', 'camWide'] },
  { id: 'character', label: 'Character', items: ['ando', 'baseFemale', 'baseMale', 'chris'] },
  { id: 'fx', label: 'FX', items: ['fx_smoke'] },
  { id: 'other', label: 'Other', items: ['env_prop'] },
];

const LeftPanelWrap = styled('div')({
  width: 240,
  minWidth: 240,
  maxWidth: 240,
  borderRight: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(0,0,0,0.18)',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
});

const LeftPanelHeader = styled('div')({
  height: 40,
  minHeight: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 10px',
  borderBottom: '1px solid rgba(255,255,255,0.10)',
  fontSize: 12,
  letterSpacing: 0.5,
});

const GroupHeaderRow = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 10px',
  cursor: 'pointer',
  userSelect: 'none',
  borderTop: '1px solid rgba(255,255,255,0.06)',
  color: '#00b7ff',
  fontWeight: 600,
  fontSize: 12,
});

const GroupItemRow = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 10px 8px 26px',
  cursor: 'pointer',
  color: '#d7d7d7',
  fontSize: 12,
});

// List-mode rows (Thumbnail + Name only)
const ListHeaderRow = styled('div')({
  display: 'grid',
  gridTemplateColumns: '90px 1fr',
  alignItems: 'center',
  height: 40,
  minHeight: 40,
  padding: '0 10px',
  borderBottom: '1px solid rgba(255,255,255,0.10)',
  fontSize: 12,
  fontWeight: 700,
  color: '#d7d7d7',
});

const ListItemRow = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 10px',
  cursor: 'pointer',
  color: '#d7d7d7',
  fontSize: 12,
});

const ThumbBox = styled('div')({
  width: 44,
  height: 22,
  borderRadius: 2,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.06)',
});

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

const initPageProps: PageProps = { page: 0, rowsPerPage: 15 };
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

const FIXED_VISIBLE = new Set<string>(['thumbnail', 'group_1_name']);
const PIPE_KEY = '/ppiTracker/assets/hideColumns';
const lsKeyForProject = (projectKeyName?: string) => {
  return `ppi:assets:hideColumns:${projectKeyName || 'unknown'}`;
};

const AssetsDataTablePanel: React.FC<RouteComponentProps> = () => {
  const initPageProps = {
    page: 0,
    rowsPerPage: 15,
  };

  const initFilterProps = {
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

  const [sortKey, setSortKey] = useState<string>('group_1');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [phasePriority, setPhasePriority] = useState<string>('none');

  const [uiSortKey, setUiSortKey] = useState<string>('group_1');
  const [uiSortDir, setUiSortDir] = useState<SortDir>('asc');

  const commitTimerRef = useRef<number | null>(null);

  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  const resolveServerSort = (key: string): { sort: string; phase: string } => {
    if (key === 'group_1') return { sort: 'group_1', phase: 'none' };
    if (key === 'relation') return { sort: 'relation', phase: 'none' };

    const m = key.match(/^(mdl|rig|bld|dsn|ldv)_(work|appr|submitted)$/i);
    if (!m) return { sort: 'group_1', phase: 'none' };

    const phase = m[1].toLowerCase();
    const field = m[2].toLowerCase();

    if (field === 'submitted') return { sort: `${phase}_submitted`, phase };
    if (field === 'appr') return { sort: `${phase}_appr`, phase };
    return { sort: `${phase}_work`, phase };
  };

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

  const persistHiddenColumns = (next: Set<string>) => {
    persistHiddenColumnsLocal(next);
    saveHiddenColumnsToPipelineSetting(next);
  };

  const approvalArray =
    ((filterProps as any).approvalStatuses ||
    filterProps.applovalStatues || []) as string[];

  const workArray =
    ((filterProps as any).workStatuses ||
    filterProps.workStatues || []) as string[];

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

  const filtersActive = useMemo(() => {
    const nameActive = !!(filterProps.assetNameKey || '').trim();
    return nameActive || approvalArray.length > 0 || workArray.length > 0;
  }, [filterProps.assetNameKey, approvalArray, workArray]);

  const backendPage = filtersActive ? 0 : pageProps.page;
  const backendRowsPerPage = filtersActive ? 5000 : pageProps.rowsPerPage;

  const { assets, total } = useFetchAssetsPivot(
    currentProject,
    backendPage,
    backendRowsPerPage,
    sortKey,
    sortDir,
    effectivePhase,
    filterProps.assetNameKey,
    approvalArray,
    workArray,
  );

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

      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      const ta = new Date(a as any).getTime();
      const tb = new Date(b as any).getTime();

      if (ta === tb) return 0;

      if (isAsc) return ta < tb ? -1 : 1;
      return ta > tb ? -1 : 1;
    };

    const compareStrings = (a: any, b: any, dir: SortDir) => {
      const isAsc = dir === 'asc';

      const aa = (a || '').toString().trim();
      const bb = (b || '').toString().trim();

      const aEmpty = aa === '' || aa === '-';
      const bEmpty = bb === '' || bb === '-';

      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;

      const la = aa.toLowerCase();
      const lb = bb.toLowerCase();

      if (la === lb) return 0;
      if (isAsc) return la < lb ? -1 : 1;
      return la > lb ? -1 : 1;
    };

    const comparator = (a: any, b: any): number => {
      if (!uiSortKey || uiSortDir === 'none') return 0;

      if (uiSortKey === 'group_1') return compareStrings(a.group_1, b.group_1, uiSortDir);
      if (uiSortKey === 'relation') return compareStrings(a.relation, b.relation, uiSortDir);

      const m = uiSortKey.match(/^(mdl|rig|bld|dsn|ldv)_(work|appr|submitted)$/i);
      if (m) {
        const phase = m[1].toLowerCase();
        const field = m[2].toLowerCase();

        if (field === 'submitted') {
          const key = `${phase}_submitted_at_utc`;
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

    const base = assets.filter((asset: any) => {
      if (nameFilter) {
        const name = (asset.group_1 || '').toString().toLowerCase();
        if (!name.includes(nameFilter)) return false;
      }

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

      if (!nameFilter && approvalFilters.length === 0 && workFilters.length === 0) {
        return true;
      }

      if (phase) return matchesPhase(phase);
      return phases.some((p) => matchesPhase(p));
    });

    const next = [...base];
    next.sort(comparator);
    return next;
  }, [
    assets,
    effectivePhase,
    filterProps.assetNameKey,
    approvalArray,
    workArray,
    uiSortKey,
    uiSortDir,
  ]);

  const effectiveCount = filteredAssets.length;

  const pagedAssets = useMemo(() => {
    const start = pageProps.page * pageProps.rowsPerPage;
    const end = start + pageProps.rowsPerPage;
    return filteredAssets.slice(start, end);
  }, [filteredAssets, pageProps.page, pageProps.rowsPerPage]);

  useEffect(() => {
    if (currentStudio) setTimeZone((currentStudio as any).timezone || undefined);
  }, [currentStudio]);

  const toggleColumn = (id: string) => {
    if (FIXED_VISIBLE.has(id)) return;

    const next = new Set<string>(hiddenColumns);
    if (next.has(id)) next.delete(id);
    else next.add(id);

    setHiddenColumns(next);
    persistHiddenColumnsLocal(next);
  };

  const showAll = () => {
    const next = new Set<string>();
    setHiddenColumns(next);
    persistHiddenColumnsLocal(next);
  };

  const hideAllNonFixed = () => {
    const next = new Set<string>();
    COLUMN_META.forEach((c) => {
      if (!FIXED_VISIBLE.has(c.id)) next.add(c.id);
    });
    setHiddenColumns(next);
    persistHiddenColumnsLocal(next);
  };

  const handleSaveColumns = async () => {
    persistHiddenColumns(hiddenColumns);
  };

  const handleSortChange = (key: string) => {
    setUiSortKey(key);

    setUiSortDir((prev) => {
      if (key !== uiSortKey) return 'asc';
      if (prev === 'asc') return 'desc';
      return 'asc';
    });

    const nextDir =
      key !== uiSortKey
        ? 'asc'
        : uiSortDir === 'asc'
          ? 'desc'
          : 'asc';

    const resolved = resolveServerSort(key);
    if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current);

    commitTimerRef.current = window.setTimeout(() => {
      setSortKey(resolved.sort);
      setSortDir(nextDir);
    }, 250);
  };

  const handleRowsPerPageChange: TablePaginationProps['onChangeRowsPerPage'] = event => {
    setPageProps({
      ...pageProps,
      rowsPerPage: parseInt(event.target.value, 10),
      page: 0,
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

  // View mode state (grid, compact, list)
  // NOTE: here "grid" = Group mode, "list" = List mode (for left panel)
  const [barView, setBarView] = React.useState<'grid' | 'compact' | 'list'>('list');
  const [barSearch, setBarSearch] = React.useState<string>('');

  // Left panel state
  const [leftPanelOpen, setLeftPanelOpen] = useState<boolean>(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    MOCK_GROUPS.forEach((g) => { m[g.id] = true; });
    return m;
  });
  const [selectedPanelItem, setSelectedPanelItem] = useState<string | null>(null);

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

  return (
    <StyledContainer maxWidth="xl">
      <AssetTableFilter
        filterAssetName={filterProps.assetNameKey}
        selectApprovalStatuses={
          (filterProps as any).approvalStatuses ||
          filterProps.applovalStatues
        }
        selectWorkStatuses={
          (filterProps as any).workStatuses ||
          filterProps.workStatues
        }

        onAssetNameChange={handleFilterAssetNameChange}
        onApprovalStatusesChange={handleApprovalStatusesChange}
        onWorkStatusesChange={handleWorkStatusesChange}
        onApprovalStatusChipDelete={handleApprovalStatusesChipDelete}
        onWorkStatusChipDelete={handleWorkStatusesChipDelete}
        onResetClick={handleFilterResetClick}

        hiddenColumns={hiddenColumns}
        onHiddenColumnsChange={setHiddenColumns}
        onToggleColumn={toggleColumn}
        onShowAll={showAll}
        onHideAll={hideAllNonFixed}
        visibleCount={COLUMN_META.filter(c => !FIXED_VISIBLE.has(c.id) && !hiddenColumns.has(c.id)).length}
        onSaveColumns={handleSaveColumns}
      >
      </AssetTableFilter>

      {/* Top bar */}
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
            borderRadius: 2,
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

            <IconButton
              size="small"
              onClick={() => setBarView('list')}
              style={{
                padding: 6,
                borderRadius: 0,
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
              onClick={() => setLeftPanelOpen((v) => !v)}
              style={{
                padding: 6,
                borderRadius: 0,
                marginLeft: 2,
              }}
              title={leftPanelOpen ? 'Hide groups panel' : 'Show groups panel'}
            >
              <ViewComfyIcon
                style={{
                  fontSize: 18,
                  color: leftPanelOpen ? '#00b7ff' : '#b0b0b0',
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
          </div>
        </Box>
      </div>

      <StyledTableDiv>
        <StyledPaper>
          <StyledContentDiv>
            {leftPanelOpen && (
              <LeftPanelWrap>
                {barView === 'grid' ? (
                  // GROUP MODE (Camera/Character/FX/Other)
                  <>
                    <LeftPanelHeader>
                      <div style={{ fontWeight: 700, color: '#d7d7d7' }}>GROUPS</div>
                      <div style={{ fontSize: 11, color: '#9a9a9a' }}>(mock)</div>
                    </LeftPanelHeader>

                    <div style={{ overflow: 'auto' }}>
                      {MOCK_GROUPS.map((g) => {
                        const isExpanded = !!expandedGroups[g.id];
                        return (
                          <div key={g.id}>
                            <GroupHeaderRow
                              onClick={() =>
                                setExpandedGroups((prev) => ({ ...prev, [g.id]: !prev[g.id] }))
                              }
                            >
                              <Icon style={{ fontSize: 16, color: '#8a8a8a' }}>
                                {isExpanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'}
                              </Icon>
                              {g.label.toUpperCase()}
                            </GroupHeaderRow>

                            {isExpanded &&
                              g.items.map((name) => {
                                const selected = selectedPanelItem === name;
                                return (
                                  <GroupItemRow
                                    key={name}
                                    onClick={() => {
                                      setSelectedPanelItem(name);
                                      setBarSearch(name);
                                      setFilterProps({ ...filterProps, assetNameKey: name });
                                      setPageProps({ ...pageProps, page: 0 });
                                    }}
                                    style={{
                                      background: selected ? 'rgba(0,183,255,0.12)' : 'transparent',
                                    }}
                                  >
                                    <ThumbBox />
                                    <span style={{ color: selected ? '#ffffff' : undefined }}>{name}</span>
                                  </GroupItemRow>
                                );
                              })}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  // LIST MODE (Thumbnail + Name list)
                  <>
                    <ListHeaderRow>
                      <div>THUMBNAIL</div>
                      <div>NAME</div>
                    </ListHeaderRow>

                    <div style={{ overflow: 'auto' }}>
                      {(pagedAssets || []).map((asset: any) => {
                        const name = (asset && (asset.group_1 || asset.group_1_name || asset.name)) || '';
                        const selected = selectedPanelItem === name;
                        return (
                          <ListItemRow
                            key={String(name)}
                            onClick={() => {
                              setSelectedPanelItem(String(name));
                              setBarSearch(String(name));
                              setFilterProps({ ...filterProps, assetNameKey: String(name) });
                              setPageProps({ ...pageProps, page: 0 });
                            }}
                            style={{ background: selected ? 'rgba(0,183,255,0.12)' : 'transparent' }}
                          >
                            <ThumbBox />
                            <span style={{ color: selected ? '#ffffff' : undefined }}>{String(name)}</span>
                          </ListItemRow>
                        );
                      })}
                    </div>
                  </>
                )}
              </LeftPanelWrap>
            )}

            <AssetsDataTable
              project={currentProject}
              assets={pagedAssets}
              phaseComponents={phaseComponents}
              latestComponents={latestComponents}
              tableFooter={tableFooter}
              dateTimeFormat={dateTimeFormat}

              currentSortKey={uiSortKey}
              currentSortDir={uiSortDir}
              hiddenColumns={hiddenColumns}
              onSortChange={handleSortChange}

              assetNameKey={filterProps.assetNameKey}
              approvalStatuses={filterProps.applovalStatues}
              workStatuses={filterProps.workStatues}
              page={pageProps.page}
              rowsPerPage={pageProps.rowsPerPage}
            />
          </StyledContentDiv>
        </StyledPaper>
      </StyledTableDiv>

      <CsvDownloadComponent currentProject={currentProject} />
    </StyledContainer>
  );
};

export default AssetsDataTablePanel;
