import React, {
    FC,
    useEffect,
    useState,
} from 'react';
import { RouteComponentProps } from "react-router-dom";
import { Container, Paper, styled, Box, Divider } from '@material-ui/core';
import { TablePaginationProps } from '@material-ui/core/TablePagination';
import {
    useFetchShots,
    useFetchLatestShotComponents,
    useFetchPipelineSettingShotComponents,
} from './hooks';
import { PageProps } from './types';
import ShotsDataTable from './ShotsDataTable'
import ShotsDataTableFooter from './ShotsDataTableFooter';
import { useCurrentProject } from '../../hooks';
import { useCurrentStudio } from '../../../studio/hooks';
import { queryConfig } from '../../../new-pipeline-setting/api';

/* import shotsDataTablebar */
import ShotDataTableToolbar, { ViewMode } from './ShotDataTableToolbar';



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
    gap: theme.spacing(2),
}));

const StyledTableDiv = styled('div')(({
    paddingBottom: 8,
}));

const Separator = styled('div')(({ theme }) => ({
    height: 4,
    backgroundColor: 'transparent',
}));

const ToolBarWrapper = styled('div')(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
}));


/* ------------------------------
   Main Component
-------------------------------- */
type Filters = {
    assetGroups: string[];
    approvalStatus: string[];
    workStatus: string[];
    // Add more filter fields as needed
};

const ShotsDataTablePanel: FC<RouteComponentProps> = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('list'); // 'list' or 'group'
    const [searchValue, setSearchValue] = useState<string>(''); // Search input state
    const [filters, setFilters] = useState<Filters>({
        assetGroups: [],
        approvalStatus: [],
        workStatus: [],
        // Add more filter fields as needed
    });

    const initPageProps = {
        page: 0,
        rowsPerPage: 15,
    };
    const [pageProps, setPageProps] = useState<PageProps>(initPageProps);
    const { currentProject } = useCurrentProject();
    const { shots, total } = useFetchShots(
        currentProject,
        pageProps.page,
        pageProps.rowsPerPage,
    );
    const { phaseComponents } = useFetchPipelineSettingShotComponents(currentProject);
    const { currentStudio } = useCurrentStudio();
    const [timeZone, setTimeZone] = useState<string | undefined>();
    const { latestComponents } = useFetchLatestShotComponents(currentProject, shots, phaseComponents);

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

    const dateTimeFormat = new Intl.DateTimeFormat(
        undefined,
        {
            timeZone: timeZone,
            dateStyle: 'medium',
            timeStyle: 'medium'
        }
    );

    const tableFooter = (
        <ShotsDataTableFooter
            count={total}
            page={pageProps.page}
            rowsPerPage={pageProps.rowsPerPage}
            onChangePage={handlePageChange}
            onChangeRowsPerPage={handleRowsPerPageChange}
        />
    );

    return (
        <StyledContainer maxWidth="xl">
            <ToolBarWrapper>
                <ShotDataTableToolbar
                    viewMode={viewMode}
                    onViewChange={(mode: ViewMode) => setViewMode(mode)}
                    searchValue={searchValue}
                    onSearchChange={(value: string) => setSearchValue(value)}
                    filters={filters}
                    onFilterChange={(newFilters: Filters) => setFilters(newFilters)}
                    columnsState={{}} // Pass the current column visibility state
                    onColumnsChange={(newColumns) => { }} // Handle column visibility changes
                    
                />
            </ToolBarWrapper>

            <StyledTableDiv>
                <StyledPaper>
                    <StyledContentDiv>
                        <ShotsDataTable
                            project={currentProject}
                            shots={shots}
                            phaseComponents={phaseComponents}
                            latestComponents={latestComponents}
                            tableFooter={tableFooter}
                            dateTimeFormat={dateTimeFormat}
                        />
                    </StyledContentDiv>
                </StyledPaper>
            </StyledTableDiv>
        </StyledContainer>
    );
};

export default ShotsDataTablePanel;
