import React, {
  FC,
  useEffect,
  useState,
  useCallback, // New import for useCallback
} from 'react';
import { RouteComponentProps } from "react-router-dom";
import { Container, Paper, styled } from '@material-ui/core';
import { ButtonProps } from '@material-ui/core/Button';
import { SelectProps } from '@material-ui/core/Select';
import { TablePaginationProps } from '@material-ui/core/TablePagination';
import { TextFieldProps } from '@material-ui/core/TextField';
import { useFetchAssets } from './hooks';
import { FilterProps, PageProps } from './types';
import AssetsDataTable from './AssetsDataTable'
import AssetTableFilter from './AssetDataTableFilter';
import AssetsDataTableFooter from './AssetsDataTableFooter';
import { useCurrentProject, } from '../hooks';
import { useFetchAssetPivotData } from './hooks';  // New import for pivot data fetching
import { useCurrentStudio } from '../../studio/hooks';
import { queryConfig } from '../../new-pipeline-setting/api';

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

const AssetsDataTablePanel: FC<RouteComponentProps> = () => {
  const initPageProps = {
    page: 0,
    rowsPerPage: 15,
  };
  const initFilterProps = {
    assetNameKey: '',
    applovalStatues: [],
    workStatues: [],
  };
  const [pageProps, setPageProps] = useState<PageProps>(initPageProps);
  const [filterProps, setFilterProps] = useState<FilterProps>(initFilterProps);
  const { currentProject } = useCurrentProject();
  const { assets, total } = useFetchAssets(
    currentProject,
    pageProps.page,
    pageProps.rowsPerPage,
  );

  // --- NEW SORTING STATE ---
  const [sortBy, setSortBy] = useState('group_1'); 
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // --- NEW: Fetch Pivot Data (Replaces useFetchAssets) ---
  // Assuming 'relation' filter is derived or empty for simplicity
  const relationFilter = ''; // Set actual filter value if available in filterProps
  
  const { pivotRows, totalRows } = useFetchAssetPivotData(
    currentProject, // Correctly passes the Project object
    pageProps.page,
    pageProps.rowsPerPage,
    relationFilter, 
    sortBy,
    sortOrder,
  );
  // Renamed fetched data: assets -> pivotRows, total -> totalRows

  const { currentStudio } = useCurrentStudio();
  const [timeZone, setTimeZone] = useState<string | undefined>();

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

  // --- NEW: Sorting Handler (using useCallback) ---
  const handleSort = useCallback((columnId: string) => {
    // 1. Always reset to the first page on a new sort
    setPageProps(prev => ({ ...prev, page: 0 }));

    if (columnId === sortBy) {
        // 2. Toggle the order if the same column is clicked
        setSortOrder(order => (order === 'asc' ? 'desc' : 'asc'));
    } else {
        // 3. Set the new column and default to 'asc'
        setSortBy(columnId);
        setSortOrder('asc');
    }
  }, [sortBy]); // Dependency on sortBy ensures correct toggling

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
      >
      </AssetTableFilter>
      <StyledTableDiv>
        <StyledPaper>
          <StyledContentDiv>
            <AssetsDataTable
              project={currentProject}
              // Pass the pivot data as 'assets' (or rename AssetsDataTable prop if possible)
              assets={pivotRows} 
              
              // Pass all control state and handler
              currentPage={pageProps.page}
              rowsPerPage={pageProps.rowsPerPage}
              relationFilter={relationFilter} // The filter value
              sortBy={sortBy}
              sortOrder={sortOrder}
              handleSort={handleSort} // The sorting handler
              
              tableFooter={tableFooter}
              dateTimeFormat={dateTimeFormat}
            />
          </StyledContentDiv>
        </StyledPaper>
      </StyledTableDiv>
    </StyledContainer>
  );
};

export default AssetsDataTablePanel;
