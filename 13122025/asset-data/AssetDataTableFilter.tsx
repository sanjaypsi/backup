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
  Drawer,
  FormControlLabel,
  Checkbox,
} from '@material-ui/core';
import { styled, useTheme } from '@material-ui/core/styles';
import { ButtonProps } from '@material-ui/core/Button';
import { SelectProps } from '@material-ui/core/Select';
import { TextFieldProps } from '@material-ui/core/TextField';
import { ChipDeleteFunction } from './types';

import {
  ViewColumn as ViewColumnIcon,
  ArrowDropDown as ArrowDropDownIcon,
  ExpandMore as ExpandMoreIcon,
} from '@material-ui/icons';

// MUI v4 Expansion Panels
import ExpansionPanel from '@material-ui/core/ExpansionPanel';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';

/* -------------------------------------------------------------- */
/* STYLES                                                          */
/* -------------------------------------------------------------- */

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
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
}));

const LeftWrap = styled('div')({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
});

const RightWrap = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: (theme.spacing as any)(1.5),
  marginRight: (theme.spacing as any)(1),
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

const FilterButtonWrap = styled('div')({
  marginRight: 25,
  marginLeft: 8,
  border: '1px solid rgba(55, 35, 165, 0.08)',
  borderRadius: 20,
  display: 'flex',
  alignItems: 'center',
});

/* Compact collapsible styles */
const CompactExpansionPanel = styled(ExpansionPanel)({
  margin: 0,
  padding: 0,
  boxShadow: 'none',
  borderRadius: 0,
  borderTop: '1px solid rgba(255,255,255,0.08)',
  '&:first-of-type': { borderTop: 'none' },
  '&:before': { display: 'none' },
  '&.Mui-expanded': { margin: 0 },
});

const CompactSummary = styled(ExpansionPanelSummary)({
  minHeight: 28,
  padding: '0 6px',
  '& .MuiExpansionPanelSummary-content': { margin: 0, padding: 0 },
  '& .MuiExpansionPanelSummary-content.Mui-expanded': { margin: 0 },
  '&.Mui-expanded': { minHeight: 28 },
});

const StyledExpansionDetails = styled(ExpansionPanelDetails)(({ theme }) => ({
  paddingTop: 4,
  paddingBottom: 6,
  paddingLeft: 8,
  paddingRight: 8,
  display: 'flex',
  flexDirection: 'column',
  '& .MuiFormControlLabel-root': { marginLeft: -2, marginTop: 0, marginBottom: 0 },
  '& .MuiCheckbox-root': { padding: 2 },
  '& .MuiFormControlLabel-label': { fontSize: 12, whiteSpace: 'normal', wordBreak: 'break-word' },
}));

/* -------------------------------------------------------------- */
/* CONSTANTS                                                       */
/* -------------------------------------------------------------- */

const approvalStatuses = [
  'check',
  'Review',
  'dirReview',
  'epdReview',
  'OnHold',
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
}

/* Drawer column sections (Thumbnail & Name are fixed elsewhere) */
const COLUMN_SECTIONS: Array<{
  title: string;
  items: Array<{ id: string; label: string }>;
}> = [
  {
    title: 'MDL',
    items: [
      { id: 'mdl_work_status', label: 'MDL WORK' },
      { id: 'mdl_approval_status', label: 'MDL APPR' },
      { id: 'mdl_submitted_at', label: 'MDL Submitted At' },
    ],
  },
  {
    title: 'RIG',
    items: [
      { id: 'rig_work_status', label: 'RIG WORK' },
      { id: 'rig_approval_status', label: 'RIG APPR' },
      { id: 'rig_submitted_at', label: 'RIG Submitted At' },
    ],
  },
  {
    title: 'BLD',
    items: [
      { id: 'bld_work_status', label: 'BLD WORK' },
      { id: 'bld_approval_status', label: 'BLD APPR' },
      { id: 'bld_submitted_at', label: 'BLD Submitted At' },
    ],
  },
  {
    title: 'DSN',
    items: [
      { id: 'dsn_work_status', label: 'DSN WORK' },
      { id: 'dsn_approval_status', label: 'DSN APPR' },
      { id: 'dsn_submitted_at', label: 'DSN Submitted At' },
    ],
  },
  {
    title: 'LDV',
    items: [
      { id: 'ldv_work_status', label: 'LDV WORK' },
      { id: 'ldv_approval_status', label: 'LDV APPR' },
      { id: 'ldv_submitted_at', label: 'LDV Submitted At' },
    ],
  },
  {
    title: 'OTHER',
    items: [{ id: 'relation', label: 'Relation' }],
  },
];

/* -------------------------------------------------------------- */
/* TYPES                                                           */
/* -------------------------------------------------------------- */

type StatusSelectProps = {
  statusType: string;
  statuses: string[];
  selectStatuses: string[];
  onStatusesChange: SelectProps['onChange'];
  onChipDelete: ChipDeleteFunction;
};

const FilterStatusSelect: React.FC<StatusSelectProps> = ({
  statusType,
  statuses,
  selectStatuses,
  onStatusesChange,
  onChipDelete,
}) => {
  const theme = useTheme();
  const MenuProps = {
    PaperProps: {
      style: { maxHeight: 48 * 4.5 + 8, width: 250 },
    },
  };

  return (
    <StyledFormControl>
      <InputLabel id="filter-chip-label">{statusType}</InputLabel>
      <Select
        labelId="select-chip-label"
        multiple
        value={selectStatuses}
        onChange={onStatusesChange}
        input={<Input />}
        renderValue={(selected) => (
          <StyledChipsDiv>
            {(selected as string[]).map((value) => (
              <StyledChip
                key={value}
                label={value}
                onDelete={() => onChipDelete(value)}
                onMouseDown={(e) => e.stopPropagation()}
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
  // filters
  filterAssetName: string;
  selectApprovalStatuses: string[];
  selectWorkStatuses: string[];
  onAssetNameChange: TextFieldProps['onChange'];
  onApprovalStatusesChange: SelectProps['onChange'];
  onWorkStatusesChange: SelectProps['onChange'];
  onApprovalStatusChipDelete: ChipDeleteFunction;
  onWorkStatusChipDelete: ChipDeleteFunction;
  onResetClick: ButtonProps['onClick'];

  // columns
  hiddenColumns: Set<string>;
  onHiddenColumnsChange: (s: Set<string>) => void; // (kept for symmetry with panel)
  onToggleColumn: (id: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  visibleCount: number;
  onSaveColumns?: () => Promise<void> | void;
};

/* -------------------------------------------------------------- */
/* MAIN                                                            */
/* -------------------------------------------------------------- */

const AssetTableFilter: React.FC<FilterProps> = ({
  // filters
  filterAssetName,
  selectApprovalStatuses,
  selectWorkStatuses,
  onAssetNameChange,
  onApprovalStatusesChange,
  onWorkStatusesChange,
  onApprovalStatusChipDelete,
  onWorkStatusChipDelete,
  onResetClick,

  // columns
  hiddenColumns,
  onHiddenColumnsChange,
  onToggleColumn,
  onShowAll,
  onHideAll,
  visibleCount,
  onSaveColumns,
}) => {
  const handleFilterKeyPress: TextFieldProps['onKeyPress'] = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      return false;
    }
  };

  // TODO: Replace this with your actual columns array or import from the correct module
    const allColumns: Array<{ id: string; label: string }> = COLUMN_SECTIONS.flatMap(section => section.items);
    const NON_FIXED = allColumns.filter((col) => col.id !== 'thumbnail' && col.id !== 'name'); 
    const allNonFixedColumnIds = NON_FIXED.every((col) => !hiddenColumns.has(col.id));

    const handleToggleAllColumns = () => {
      if (allNonFixedColumnIds) {
        onHideAll();
      } else {
        onShowAll();
      }
    };

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const toggleDrawer = (open: boolean) => () => setDrawerOpen(open);

  // Single checkbox row
  const renderColumnCheckbox = (id: string, label: string) => {
    const isVisible = !hiddenColumns.has(id);
    return (
      <FormControlLabel
        key={id}
        control={
          <Checkbox
            checked={isVisible}
            onChange={() => onToggleColumn(id)}
            color="default"
            style={{color: "#caccc8ff"}}
          />
        }
        label={label}
        style={{ marginLeft: 6, marginRight: 6 }}
      />
    );
  };

  return (
    <StyledFilterDiv>
      <StyledPaper>
        <StyledDiv>
          {/* LEFT */}
          <LeftWrap>
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
          </LeftWrap>

          {/* RIGHT */}
          <RightWrap>
            <FilterButtonWrap>
              <Button
                variant="contained"
                color="primary"
              
                startIcon={<ViewColumnIcon />}
                endIcon={<ArrowDropDownIcon />}
                onClick={toggleDrawer(true)}
                style={{ borderRadius: 4, paddingLeft: 5, paddingRight: 5}}
              >
                {`COLUMNS (${visibleCount})`}
              </Button>
            </FilterButtonWrap>

            <Button
              variant="outlined"
              onClick={onResetClick}
              style={{ borderRadius: 4, paddingLeft: 5, paddingRight: 5}}
            >
              RESET
            </Button>
          </RightWrap>
        </StyledDiv>
      </StyledPaper>

      {/* Drawer RIGHT (fixed size + vertical scroll, offset from top) */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={toggleDrawer(false)}
        PaperProps={{
          style: {
            width: 240,
            height: '50vh',
            display: 'flex',
            position: 'fixed',
            top: 180,
            right: 100,
          },
        }}
        ModalProps={{ keepMounted: true }}
      >
        {/* container fills the paper and scrolls internally */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflowX: 'hidden',
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingTop: 6,
              paddingBottom: 6,
            }}
          >
            {/* Fixed columns info */}
            {/* <div style={{ fontSize: 12, opacity: 0.75, padding: '0 10px 6px 10px' }}>
              <b>Fixed:</b> Thumbnail, Name
            </div> */}

            {/* Collapsible groups */}
            {COLUMN_SECTIONS.map((section) => (
              <CompactExpansionPanel key={section.title} defaultExpanded>
                <CompactSummary expandIcon={<ExpandMoreIcon />}>
                  <strong style={{ fontSize: 12 }}>{section.title}</strong>
                </CompactSummary>

                <StyledExpansionDetails>
                  {section.items.map(({ id, label }) => renderColumnCheckbox(id, label))}
                </StyledExpansionDetails>
              </CompactExpansionPanel>
            ))}
          </div>

          {/* Drawer footer: Show all / Hide all + Save + Close */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 8px',
            }}
          >
            <div>
              <Button size="small" onClick={handleToggleAllColumns}>
                { allNonFixedColumnIds ? 'Hide all' : 'Show all' }
              </Button>
              {/* <Button size="small" onClick={onHideAll}>
                Hide all
              </Button> */}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {/* <Button
                size="small"
                variant="contained"
                color="primary"
                onClick={() => {
                  if (onSaveColumns) onSaveColumns();
                }}
              >
                Save
              </Button> */}
              {/* <Button onClick={toggleDrawer(false)}>Close</Button> */}
            </div>
          </div>
        </div>
      </Drawer>
    </StyledFilterDiv>
  );
}

export default AssetTableFilter;