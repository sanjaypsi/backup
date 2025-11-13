import React from 'react';
import { TableFooter, TablePagination, TableRow, IconButton } from '@material-ui/core';
import { TablePaginationProps } from '@material-ui/core/TablePagination';
import { styled } from '@material-ui/core';
import {
  FirstPage as FirstPageIcon,
  KeyboardArrowLeft as KeyboardArrowLeftIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
  LastPage as LastPageIcon,
} from '@material-ui/icons';
import { IconButtonProps } from '@material-ui/core/IconButton';


const StyledDiv = styled('div')(({ theme }) => ({
  flexShrink: 0,
  color: theme.palette.text.secondary,
  marginLeft: theme.spacing(2.5),
}));

const StyledTableFooter = styled(TableFooter)(({ theme }) => ({
  position: 'sticky',
  bottom: 0,
  backgroundColor: theme.palette.background.paper,
}));

const StyledTablePagination = styled(TablePagination)({
  '&:last-child': {
    paddingRight: '10%',
  },
})

type TablePaginationActionsProps = {
  count: number,
  page: number,
  rowsPerPage: number,
  onChangePage: TablePaginationProps['onChangePage'],
};

export const TablePaginationActions: React.FC<TablePaginationActionsProps> = ({
  count,
  page,
  rowsPerPage,
  onChangePage,
}) => {
  const handleFirstButtonClick: IconButtonProps['onClick'] = event => {
    onChangePage(event, 0);
  };

  const handlePrevButtonClick: IconButtonProps['onClick'] = event => {
    onChangePage(event, page - 1);
  };

  const handleNextButtonClick: IconButtonProps['onClick'] = event => {
    onChangePage(event, page + 1);
  };

  const handleLastButtonClick: IconButtonProps['onClick'] = event => {
    onChangePage(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1));
  };

  return (
    <StyledDiv>
      <IconButton
        onClick={handleFirstButtonClick}
        disabled={page === 0}
        aria-label="First Page"
      >
        <FirstPageIcon />
      </IconButton>
      <IconButton
        onClick={handlePrevButtonClick}
        disabled={page === 0}
        aria-label="Previous Page"
      >
        <KeyboardArrowLeftIcon />
      </IconButton>
      <IconButton
        onClick={handleNextButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="Next Page"
      >
        <KeyboardArrowRightIcon />
      </IconButton>
      <IconButton
        onClick={handleLastButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="Last Page"
      >
        <LastPageIcon />
      </IconButton>
    </StyledDiv>
  );
};

type Props = {
  count: number,
  page: number,
  rowsPerPage: number,
  onChangePage: TablePaginationProps['onChangePage'],
  onChangeRowsPerPage: TablePaginationProps['onChangeRowsPerPage'],
};

const AssetsDataTableFooter: React.FC<Props> = ({
  count,
  page,
  rowsPerPage,
  onChangePage,
  onChangeRowsPerPage,
}) => {
  return (
    <StyledTableFooter>
      <TableRow>
        <StyledTablePagination
          rowsPerPageOptions={[15, 30, 60, 120, 240]}
          count={count}
          rowsPerPage={rowsPerPage}
          page={Math.min(page, Math.ceil(count / rowsPerPage))}
          onChangePage={onChangePage}
          onChangeRowsPerPage={onChangeRowsPerPage}
          ActionsComponent={TablePaginationActions}
        />
      </TableRow>
    </StyledTableFooter>
  );
};

export default AssetsDataTableFooter;
