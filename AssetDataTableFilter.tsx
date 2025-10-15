import React from 'react';
import {
  Button,
  Chip,
  FormControl,
  Input,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Theme,
} from '@material-ui/core';
import { styled, useTheme } from '@material-ui/core/styles';
import { ButtonProps } from '@material-ui/core/Button';
import { SelectProps } from '@material-ui/core/Select';
import { TextFieldProps } from '@material-ui/core/TextField';
import { ChipDeleteFunction } from './types'

const StyledChipsDiv = styled('div')({
  display: 'flex',
  flexWrap: 'wrap',
});

const StyledChip = styled(Chip)({
  margin: 2,
});

const StyledFormControl = styled(FormControl)(({ theme }) => ({
  margin: theme.spacing(1),
  minWidth: 120,
  maxWidth: 300,
}));

const StyledFilterDiv = styled('div')({
  minHeight: 70,
});

const StyledPaper = styled(Paper)({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'auto',
});

const StyledDiv = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  display: 'flex',
  flexDirection: 'row',
}));

const StyledFilterForm = styled('form')(({ theme }) => ({
  '& .MuiTextField-root': {
    margin: theme.spacing(1),
    marginRight: 0,
  },
  '& .MuiTextField-root:last-child': {
    marginRight: theme.spacing(1),
  },
}));

const StyledTextField = styled(TextField)({
  maxWidth: 200,
  minWidth: 180,
});

const StyledFilterResetForm = styled('form')(({ theme }) => ({
  flexGrow: 1,
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: theme.spacing(1),
  marginRight: theme.spacing(1),
  marginBottom: theme.spacing(0.5),
}));

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

function getStyles(name: string, statuses: string[], theme: Theme) {
  return {
    fontWeight:
      statuses.indexOf(name) === -1
        ? theme.typography.fontWeightRegular
        : theme.typography.fontWeightMedium,
  };
};

type StatusSelectProps = {
  statusType: string,
  statuses: string[],
  selectStatuses: string[],
  onStatusesChange: SelectProps['onChange'],
  onChipDelete: ChipDeleteFunction,
};

const FilterStatusSelect: React.FC<StatusSelectProps> = ({
  statusType,
  statuses,
  selectStatuses,
  onStatusesChange,
  onChipDelete,
}) => {
  const itemHeight = 48;
  const itemPaddingTop = 8;
  const theme = useTheme();
  const MenuProps = {
    PaperProps: {
      style: {
        maxHeight: itemHeight * 4.5 + itemPaddingTop,
        width: 250,
      },
    },
  };

  return (
    <StyledFormControl>
      <InputLabel id="filter-chip-label">
        {statusType}
      </InputLabel>
      <Select
        labelId="select-chip-label"
        id="select-mutiple-chip"
        multiple
        value={selectStatuses}
        onChange={onStatusesChange}
        input={<Input id="input-select-multiple-chip" />}
        renderValue={(selected) => (
          <StyledChipsDiv>
            {(selected as string[]).map((value) => (
              <StyledChip
                key={value} label={value}
                onDelete={() => onChipDelete(value)}
                onMouseDown={(event) => { event.stopPropagation(); }}
              />
            ))}
          </StyledChipsDiv>
        )}
        MenuProps={MenuProps}
      >
        {statuses.map((status) => (
          <MenuItem
            key={status}
            value={status}
            style={getStyles(status, selectStatuses, theme)}
          >
            {status}
          </MenuItem>
        ))}
      </Select>
    </StyledFormControl>
  );
};

type FilterProps = {
  filterAssetName: string,
  selectApprovalStatuses: string[],
  selectWorkStatuses: string[],
  onAssetNameChange: TextFieldProps['onChange'],
  onApprovalStatusesChange: SelectProps['onChange'],
  onWorkStatusesChange: SelectProps['onChange'],
  onApprovalStatusChipDelete: ChipDeleteFunction,
  onWorkStatusChipDelete: ChipDeleteFunction,
  onResetClick: ButtonProps['onClick'],
};

const AssetTableFilter: React.FC<FilterProps> = ({
  filterAssetName,
  selectApprovalStatuses,
  selectWorkStatuses,
  onAssetNameChange,
  onApprovalStatusesChange,
  onWorkStatusesChange,
  onApprovalStatusChipDelete,
  onWorkStatusChipDelete,
  onResetClick,
}) => {
  const handleFilterKeyPress: TextFieldProps['onKeyPress'] = event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      return false;
    }
  };

  return (
    <StyledFilterDiv>
      <StyledPaper>
        <StyledDiv>
          <StyledFilterForm>
            <StyledTextField
              id="filter-assetname"
              type="search"
              label="Asset Name"
              value={filterAssetName}
              onChange={onAssetNameChange}
              onKeyPress={handleFilterKeyPress}
            />
          </StyledFilterForm>
          <FilterStatusSelect
            statusType="Approval Status"
            statuses={approvalStatuses}
            selectStatuses={selectApprovalStatuses}
            onStatusesChange={onApprovalStatusesChange}
            onChipDelete={onApprovalStatusChipDelete}
          />
          <FilterStatusSelect
            statusType="Work Status"
            statuses={workStatuses}
            selectStatuses={selectWorkStatuses}
            onStatusesChange={onWorkStatusesChange}
            onChipDelete={onWorkStatusChipDelete}
          />
          <StyledFilterResetForm>
            <Button
              variant="outlined"
              onClick={onResetClick}
            >
              Reset
            </Button>
          </StyledFilterResetForm>
        </StyledDiv>
      </StyledPaper>
    </StyledFilterDiv>
  );
};

export default AssetTableFilter;
