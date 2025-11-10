import React, { FC, useEffect, useRef, useState } from 'react';
import { RouteComponentProps } from "react-router-dom";
import { Container, Paper, styled } from '@material-ui/core';
import { ButtonProps } from '@material-ui/core/Button';
import { SelectProps } from '@material-ui/core/Select';
import { TablePaginationProps } from '@material-ui/core/TablePagination';
import { TextFieldProps } from '@material-ui/core/TextField';
import { useFetchAssetsPivot } from './hooks';
import { FilterProps, PageProps, SortDir } from './types';
import AssetsDataTable from './AssetsDataTable';
import AssetTableFilter from './AssetDataTableFilter';
import AssetsDataTableFooter from './AssetsDataTableFooter';
import { useCurrentProject } from '../hooks';
import { useCurrentStudio } from '../../studio/hooks';
import { queryConfig } from '../../new-pipeline-setting/api';

const StyledContainer = styled(Container)(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  padding: 10,
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

const StyledTableDiv = styled('div')({
  paddingBottom: 8,
});

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

const AssetsDataTablePanel: FC<RouteComponentProps> = () => {
  const [pageProps, setPageProps] = useState<PageProps>(initPageProps);
  const [filterProps, setFilterProps] = useState<FilterProps>(initFilterProps);

  // Server-side sorting + phase (drives fetch)
  const [sortKey, setSortKey] = useState<string>('group_1');   // server sort key
  const [sortDir, setSortDir] = useState<SortDir>('asc');      // 'asc' | 'desc'
  const [phasePriority, setPhasePriority] = useState<string>('none'); // mdl|rig|bld|dsn|ldv|none

  // UI-only (instant header arrows; debounced commit to server state)
  const [uiSortKey, setUiSortKey] = useState<string>('group_1');
  const [uiSortDir, setUiSortDir] = useState<SortDir>('asc');

  // Debounce timer
  const commitTimerRef = useRef<number | null>(null);

  const { currentProject } = useCurrentProject();
  const { currentStudio } = useCurrentStudio();
  const [timeZone, setTimeZone] = useState<string | undefined>();

  // Map UI column key → { server sort, phase }
  // Accepts 'group_1', 'relation', and '<phase>_(work|appr|submitted)'
  const resolveServerSort = (key: string): { sort: string; phase: string } => {
    if (key === 'group_1') return { sort: 'group_1', phase: 'none' };
    if (key === 'relation') return { sort: 'relation', phase: 'none' };

    const m = key.match(/^(mdl|rig|bld|dsn|ldv)_(work|appr|submitted)$/i);
    if (!m) return { sort: 'group_1', phase: 'none' };

    const phase = m[1].toLowerCase();
    const field = m[2].toLowerCase();

    if (field === 'submitted') return { sort: 'submitted_at_utc', phase };
    // Until backend exposes approval-only ordering, map work/appr to work_status
    return { sort: 'work_status', phase };
  };

  // Fetch pivot data using the (debounced) server sort state
  const { assets, total } = useFetchAssetsPivot(
    currentProject,
    pageProps.page,
    pageProps.rowsPerPage,
    sortKey,
    sortDir,
    phasePriority,
  );

  // Studio timezone
  useEffect(() => {
    if (currentStudio == null) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res: string | null = await queryConfig('studio', currentStudio.key_name, 'timezone')
          .catch(e => {
            if (e && e.name === 'AbortError') return null;
            throw e;
          });
        if (res != null) setTimeZone(res);
      } catch (e) {
        // non-fatal
        // eslint-disable-next-line no-console
        console.error(e);
        setTimeZone(undefined);
      }
    })();
    return () => controller.abort();
  }, [currentStudio]);

  // Cleanup pending debounce on unmount
  useEffect(() => {
    return () => {
      if (commitTimerRef.current != null) {
        window.clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
    };
  }, []);

  // Pagination
  const handleRowsPerPageChange: TablePaginationProps['onChangeRowsPerPage'] = event => {
    setPageProps({ page: 0, rowsPerPage: parseInt(event.target.value, 10) });
  };
  const handlePageChange: TablePaginationProps['onChangePage'] = (_event, newPage) => {
    setPageProps(p => ({ ...p, page: newPage }));
  };

  // 2s debounced sort: instant UI arrows; delayed server fetch
const handleSortChange = (newUiKey: string) => {
  const { sort, phase } = resolveServerSort(newUiKey);

  // Compute next SERVER dir
  const nextServerDir: SortDir =
    sortKey === sort ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';

  // Clear pending debounce
  if (commitTimerRef.current != null) {
    window.clearTimeout(commitTimerRef.current);
  }

  // Debounce BOTH: server + UI arrow
  commitTimerRef.current = window.setTimeout(() => {
    setPhasePriority(phase);
    setSortKey(sort);
    setSortDir(nextServerDir);

    // ✅ UI updates AFTER fetch is triggered
    setUiSortKey(newUiKey);
    setUiSortDir(nextServerDir);

    commitTimerRef.current = null;
  }, 5000);
};

  // Filters
  const handleFilterAssetNameChange: TextFieldProps['onChange'] = event => {
    setFilterProps(p => ({ ...p, assetNameKey: event.target.value }));
    setPageProps(p => ({ ...p, page: 0 }));
  };
  const handleApprovalStatusesChange: SelectProps['onChange'] = (event: React.ChangeEvent<{ value: unknown }>) => {
    setFilterProps(p => ({ ...p, applovalStatues: event.target.value as string[] }));
    setPageProps(p => ({ ...p, page: 0 }));
  };
  const handleWorkStatusesChange: SelectProps['onChange'] = (event: React.ChangeEvent<{ value: unknown }>) => {
    setFilterProps(p => ({ ...p, workStatues: event.target.value as string[] }));
    setPageProps(p => ({ ...p, page: 0 }));
  };
  const handleApprovalStatusesChipDelete = (name: string) => {
    setFilterProps(p => ({ ...p, applovalStatues: p.applovalStatues.filter(v => v !== name) }));
    setPageProps(p => ({ ...p, page: 0 }));
  };
  const handleWorkStatusesChipDelete = (name: string) => {
    setFilterProps(p => ({ ...p, workStatues: p.workStatues.filter(v => v !== name) }));
    setPageProps(p => ({ ...p, page: 0 }));
  };
  const handleFilterResetClick: ButtonProps['onClick'] = () => setFilterProps(initFilterProps);

  const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  const tableFooter = (
    <AssetsDataTableFooter
      count={total}
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
        selectApprovalStatuses={filterProps.applovalStatues}
        selectWorkStatuses={filterProps.workStatues}
        onAssetNameChange={handleFilterAssetNameChange}
        onApprovalStatusesChange={handleApprovalStatusesChange}
        onWorkStatusesChange={handleWorkStatusesChange}
        onApprovalStatusChipDelete={handleApprovalStatusesChipDelete}
        onWorkStatusChipDelete={handleWorkStatusesChipDelete}
        onResetClick={handleFilterResetClick}
      />
      <StyledTableDiv>
        <StyledPaper>
          <StyledContentDiv>
            <AssetsDataTable
              project={currentProject}
              assets={assets}
              tableFooter={tableFooter}
              dateTimeFormat={dateTimeFormat}
              onSortChange={handleSortChange}
              currentSortKey={uiSortKey}   // UI key (instant arrow)
              currentSortDir={uiSortDir}   // UI dir (instant arrow)
            />
          </StyledContentDiv>
        </StyledPaper>
      </StyledTableDiv>
    </StyledContainer>
  );
};

export default AssetsDataTablePanel;
