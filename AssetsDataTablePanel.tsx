import React, {
  FC,
  useEffect,
  useState,
} from 'react';
import { RouteComponentProps } from "react-router-dom";
import { Container, Paper, styled } from '@material-ui/core';
import { ButtonProps } from '@material-ui/core/Button';
import { SelectProps } from '@material-ui/core/Select';
import { TablePaginationProps } from '@material-ui/core/TablePagination';
import { TextFieldProps } from '@material-ui/core/TextField';
import { useFetchAssetsPivot } from './hooks'; // CHANGE: Import useFetchAssetsPivot
import { FilterProps, PageProps } from './types';
import AssetsDataTable from './AssetsDataTable'
import AssetTableFilter from './AssetDataTableFilter';
import AssetsDataTableFooter from './AssetsDataTableFooter';
import { useCurrentProject } from '../hooks';
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
  // NEW: State for sorting, defaulting to 'group_1' (asset name) ascending
  const [sortKey, setSortKey] = useState<string>('group_1');

  const { currentProject } = useCurrentProject();
  
  // CHANGE: Use useFetchAssetsPivot and pass sortKey
  const { assets, total } = useFetchAssetsPivot(
    currentProject,
    pageProps.page,
    pageProps.rowsPerPage,
    sortKey,
  );
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

    // NEW: Handler for sorting
  const handleSortChange = (newSortKey: string) => {
    setSortKey(newSortKey);
    setPageProps({ ...pageProps, page: 0 }); // Reset to first page on sort change
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
              assets={assets}
              tableFooter={tableFooter}
              dateTimeFormat={dateTimeFormat}
              // NEW PROPS
              onSortChange={handleSortChange}
              currentSortKey={sortKey}
            />
          </StyledContentDiv>
        </StyledPaper>
      </StyledTableDiv>
    </StyledContainer>
  );
};

export default AssetsDataTablePanel;
