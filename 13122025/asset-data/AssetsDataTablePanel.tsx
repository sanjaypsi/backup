import React, { FC, useEffect, useRef, useState, useMemo } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import {
  Button,
  Container,
  Paper,
  styled,
} from '@material-ui/core';
import { ButtonProps } from '@material-ui/core/Button';
import { SelectProps } from '@material-ui/core/Select';
import { TablePaginationProps } from '@material-ui/core/TablePagination';
import { TextFieldProps } from '@material-ui/core/TextField';

import { useFetchAssetsPivot } from './hooks';
import { FilterProps as _FilterProps, PageProps, SortDir } from './types';
import AssetsDataTable from './AssetsDataTable';
import AssetTableFilter from './AssetDataTableFilter';
import AssetsDataTableFooter from './AssetsDataTableFooter';

import { useCurrentProject } from '../hooks';
import { useCurrentStudio } from '../../studio/hooks';
import { queryConfig } from '../../new-pipeline-setting/api';

/* ──────────────────────────────────────────────────────────────────────────
 * Styling  (overflow fixes applied)
 * ────────────────────────────────────────────────────────────────────────── */
const StyledContainer = styled(Container)(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  padding: 10,
  // allow horizontal scroll to appear from the inner wrapper
  overflowX: 'auto',
  '& > *': {
    display: 'flex',
    // IMPORTANT: do NOT clip overflow on children; let the inner div handle it
    overflow: 'visible',
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
  // was 'hidden' — changed to 'visible' so the inner scroll container works
  overflow: 'visible',
});

const StyledContentDiv = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  // ensure no clipping here either
  overflow: 'visible',
}));

const StyledTableDiv = styled('div')({
  paddingBottom: 8,
});

/* ──────────────────────────────────────────────────────────────────────────
 * Initial state
 * ────────────────────────────────────────────────────────────────────────── */
const initPageProps: PageProps = { page: 0, rowsPerPage: 15 };
const initFilterProps: _FilterProps = {
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
 * Column metadata (ids must match table columns)
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

/* ──────────────────────────────────────────────────────────────────────────
 * Component
 * ────────────────────────────────────────────────────────────────────────── */
const AssetsDataTablePanel: FC<RouteComponentProps> = () => {
  const [pageProps, setPageProps] = useState<PageProps>(initPageProps);
  const [filterProps, setFilterProps] = useState<_FilterProps>(initFilterProps);

  // Server-side sorting (drives fetch)
  const [sortKey, setSortKey] = useState<string>('group_1');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [phasePriority, setPhasePriority] = useState<string>('none'); // mdl|rig|bld|dsn|ldv|none

  // UI sort (instant arrow feedback; DEBOUNCE REMOVED)
  const [uiSortKey, setUiSortKey] = useState<string>('group_1');
  const [uiSortDir, setUiSortDir] = useState<SortDir>('asc');
  
  // Debounce ref is now unused but kept for history
  const commitTimerRef = useRef<number | null>(null);

  // Column visibility
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  const { currentProject } = useCurrentProject();
  const { currentStudio } = useCurrentStudio();
  const [timeZone, setTimeZone] = useState<string | undefined>();

  /* Resolve UI key -> server sort + phase */
  const resolveServerSort = (key: string): { sort: string; phase: string } => {
    // Fixed keys: map directly
    if (key === 'group_1') return { sort: 'group_1', phase: 'none' };
    if (key === 'relation') return { sort: 'relation', phase: 'none' };

    // Phase-specific keys: map to the specific column ID for correct backend resolution
    const m = key.match(/^(mdl|rig|bld|dsn|ldv)_(work|appr|submitted)$/i);
    if (!m) return { sort: 'group_1', phase: 'none' };

    const phase = m[1].toLowerCase();
    const field = m[2].toLowerCase();

    // CHANGE: Return the full, specific key (e.g., "mdl_submitted") instead of generic keys.
    if (field === 'submitted') return { sort: `${phase}_submitted`, phase };
    if (field === 'appr') return { sort: `${phase}_appr`, phase };
    return { sort: `${phase}_work`, phase }; // Resolves to e.g., "mdl_work"
  };

  /* Persist hidden columns (localStorage mirror) */
  const persistHiddenColumnsLocal = (next: Set<string>) => {
    const key = lsKeyForProject(currentProject && currentProject.key_name ? currentProject.key_name : undefined);
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(next)));
    } catch (e) {
      console.error('localStorage save failed', e);
    }
  };

  /** ____________________________________________________________________________________________
   Save to PipelineSetting (explicit “Save” from drawer) 
   _______________________________________________________________________________________________*/
  const saveHiddenColumnsToPipelineSetting = async (cols: Set<string>) => {
    try {
      if (!currentProject || !currentProject.key_name) return;
      // If your queryConfig setter signature differs, replace this call accordingly.
      await (queryConfig as any)(
        'project',
        currentProject.key_name,
        PIPE_KEY,
        JSON.stringify(Array.from(cols))
      );
    } catch (e) {
      console.warn('PipelineSetting save failed; using local only', e);
    }
  };

  // Wrapper used by toggle/showAll/hideAll to keep local mirror up-to-date
  const persistHiddenColumns = (next: Set<string>) => {
    persistHiddenColumnsLocal(next);
  };

  /* Fetch data */
  const { assets, total } = useFetchAssetsPivot(
    currentProject,
    pageProps.page,
    pageProps.rowsPerPage,
    sortKey,
    sortDir,
    phasePriority,
    filterProps.assetNameKey,         // ADDED: Passed filter state to hook
    filterProps.applovalStatues,      // ADDED
    filterProps.workStatues,          // ADDED
  );

  /* Studio timezone */
  useEffect(() => {
    if (currentStudio == null) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res: string | null = await queryConfig(
          'studio',
          currentStudio.key_name,
          'timezone',
        ).catch((e: any) => {
          if (e && e.name === 'AbortError') return null;
          throw e;
        });
        if (res != null) setTimeZone(res);
      } catch (e) {
        console.error(e);
        setTimeZone(undefined);
      }
    })();
    return () => controller.abort();
  }, [currentStudio]);

  /* Load hidden columns: PipelineSetting -> localStorage fallback */
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
          try { arr = JSON.parse(val); } catch { arr = val.split(',').map(s => s.trim()); }
        }

        if (!arr) {
          try {
            const raw = localStorage.getItem(lsKeyForProject(currentProject.key_name));
            if (raw) arr = JSON.parse(raw);
          } catch { /* ignore */ }
        }

        const sanitized = (arr || []).filter(id => !FIXED_VISIBLE.has(id));
        setHiddenColumns(new Set(sanitized));
      } catch (e) {
        console.error('Load hideColumns failed; falling back to localStorage', e);
        try {
          const raw = localStorage.getItem(lsKeyForProject(currentProject.key_name));
          const arr: string[] = raw ? JSON.parse(raw) : [];
          const sanitized = arr.filter(id => !FIXED_VISIBLE.has(id));
          setHiddenColumns(new Set(sanitized));
        } catch {
          setHiddenColumns(new Set());
        }
      }
    })();
    return () => { aborted = true; };
  }, [currentProject]);

  /* Cleanup pending debounce on unmount */
  useEffect(() => {
    return () => {
      if (commitTimerRef.current != null) {
        window.clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
    };
  }, []);

  /* Pagination */
  const handleRowsPerPageChange: TablePaginationProps['onChangeRowsPerPage'] = (event) => {
    setPageProps({ page: 0, rowsPerPage: parseInt(event.target.value, 10) });
  };
  const handlePageChange: TablePaginationProps['onChangePage'] = (_event, newPage) => {
    setPageProps(p => ({ ...p, page: newPage }));
  };

  /* Immediate sort commit (Replaced 2s debounce) */
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

  /* Filters */
  const handleFilterAssetNameChange: TextFieldProps['onChange'] = (event) => {
    setFilterProps(p => ({ ...p, assetNameKey: event.target.value }));
    setPageProps(p => ({ ...p, page: 0 })); // Reset page on filter change
  };
  const handleApprovalStatusesChange: SelectProps['onChange'] = (event: React.ChangeEvent<{ value: unknown }>) => {
    setFilterProps(p => ({ ...p, applovalStatues: event.target.value as string[] }));
    setPageProps(p => ({ ...p, page: 0 })); // Reset page on filter change
  };
  const handleWorkStatusesChange: SelectProps['onChange'] = (event: React.ChangeEvent<{ value: unknown }>) => {
    setFilterProps(p => ({ ...p, workStatues: event.target.value as string[] }));
    setPageProps(p => ({ ...p, page: 0 })); // Reset page on filter change
  };
  const handleApprovalStatusesChipDelete = (name: string) => {
    setFilterProps(p => ({ ...p, applovalStatues: p.applovalStatues.filter(v => v !== name) }));
    setPageProps(p => ({ ...p, page: 0 })); // Reset page on filter change
  };
  const handleWorkStatusesChipDelete = (name: string) => {
    setFilterProps(p => ({ ...p, workStatues: p.workStatues.filter(v => v !== name) }));
    setPageProps(p => ({ ...p, page: 0 })); // Reset page on filter change
  };
  const handleFilterResetClick: ButtonProps['onClick'] = () => {
    setFilterProps(initFilterProps);
    setPageProps(p => ({ ...p, page: 0 })); // Reset page on filter reset
  };

  /* Column actions for Drawer */
  const toggleColumn = (id: string) => {
    if (FIXED_VISIBLE.has(id)) return;
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistHiddenColumns(next);
      return next;
    });
  };

  const showAll = () => {
    const next = new Set<string>();
    setHiddenColumns(next);
    persistHiddenColumns(next);
  };

  const hideAllNonFixed = () => {
    const next = new Set<string>(
      COLUMN_META.map(c => c.id).filter(id => !FIXED_VISIBLE.has(id)),
    );
    setHiddenColumns(next);
    persistHiddenColumns(next);
  };

  // Explicit save (invoked from drawer)
  const handleSaveColumns = async () => {
    await saveHiddenColumnsToPipelineSetting(hiddenColumns);
  };

  /* Date/Time format */
  const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  /* Footer */
  const tableFooter = (
    <AssetsDataTableFooter
      count={total}
      page={pageProps.page}
      rowsPerPage={pageProps.rowsPerPage}
      onChangePage={handlePageChange}
      onChangeRowsPerPage={handleRowsPerPageChange}
    />
  );

  /* Drawer badge count (visible columns among togglable ones) */
  const visibleCount = useMemo(() => {
    const togglable = COLUMN_META.map(c => c.id).filter(id => !FIXED_VISIBLE.has(id));
    let c = 0;
    togglable.forEach(id => { if (!hiddenColumns.has(id)) c += 1; });
    return c;
  }, [hiddenColumns]);

  /* Render */
  return (
    <StyledContainer maxWidth="xl">
      {/* Filter bar with Reset + COLUMNS (COLUMNS opens Drawer inside AssetTableFilter) */}
      <AssetTableFilter
        filterAssetName={filterProps.assetNameKey}
        selectApprovalStatuses={filterProps.applovalStatues}
        selectWorkStatuses={filterProps.workStatues}
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
      />

      {/* Table inside horizontal scroll container */}
      <StyledTableDiv>
        <StyledPaper>
          <StyledContentDiv>
            <div
              style={{
                // The actual scroll container
                overflowX: 'auto',   // use 'scroll' if you want the bar always visible
                overflowY: 'hidden',
                width: '100%',
                paddingBottom: 4,
              }}
            >
              <AssetsDataTable
                project={currentProject}
                assets={assets}
                tableFooter={tableFooter}
                dateTimeFormat={dateTimeFormat}
                onSortChange={handleSortChange}
                currentSortKey={uiSortKey}
                currentSortDir={uiSortDir}
                hiddenColumns={hiddenColumns}
                // Pass filter props to table (useful if client-side filtering/logic is added later)
                assetNameKey={filterProps.assetNameKey}      
                approvalStatuses={filterProps.applovalStatues} 
                workStatuses={filterProps.workStatues}        
              />
            </div>
          </StyledContentDiv>
        </StyledPaper>
      </StyledTableDiv>
    </StyledContainer>
  );
};

export default AssetsDataTablePanel;