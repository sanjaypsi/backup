/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    AssetDataTableFilter.tsx

  Module Description:
    Type definitions and API functions for asset data management.

  Details:
    - Defines interfaces and types for assets, table props, sorting, filtering, and related data structures.
            
  * Update and Modification History:
    * - 29-10-2025 - SanjayK PSI - Initial creation sorting pagination implementation.
    * - 20-11-2025 - SanjayK PSI - Fixed typo in filter property names handling.
    * 

  Functions:
    * - AssetTableFilter: Component for filtering and customizing columns in the asset data table.
    * - COLUMN_SECTIONS: Defines sections and items for column filtering.
    * - FilterStatusSelect: Sub-component for status selection with chips.
    * - getStyles: Utility function for styling selected items.

  * ───────────────────────────────────────────────────────────────────────── */

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
  ButtonGroup,
  IconButton,
} from '@material-ui/core';
import { styled, useTheme } from '@material-ui/core/styles';
import { ButtonProps } from '@material-ui/core/Button';
import { SelectProps } from '@material-ui/core/Select';
import { TextFieldProps } from '@material-ui/core/TextField';
import { ChipDeleteFunction } from './types';
import {
  ViewColumn as ViewColumnIcon, // corrected import name
  ArrowDropDown as ArrowDropDownIcon, // corrected import name
  ExpandMore as ExpandMoreIcon, // corrected import name
} from '@material-ui/icons';

// MUI v4 Expansion Panels
import ExpansionPanel from '@material-ui/core/ExpansionPanel';
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary';
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails';
import ViewListIcon from '@material-ui/icons/ViewList';
import ViewModuleIcon from '@material-ui/icons/ViewModule';

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

// const  newBar = styled('div')({
//   height: '4px',
//   width: '100%',
//   backgroundColor: '#373fa3',
// });


/**
 * Returns a style object for a given item name based on its selection status.
 *
 * @param name - The name of the item to style.
 * @param statuses - An array of selected item names.
 * @param theme - The theme object containing typography settings.
 * @returns A React.CSSProperties object with appropriate font weight and color.
 */
function getStyles(name: string, statuses: string[], theme: Theme) {
  const isSelected = statuses.indexOf(name) !== -1;

  const style: React.CSSProperties = {
    fontWeight: isSelected
      ? theme.typography.fontWeightMedium
      : theme.typography.fontWeightRegular,
  };

  if (isSelected) {
    style.color = '#888888';
  }

  return style;
}

/* Drawer column sections (Thumbnail & Name are fixed elsewhere) */
/**
 * Defines the sections and items for column filtering in the Asset Data Table.
 *
 * Each section represents a category (e.g., MDL, RIG, BLD, DSN, LDV, OTHER) and contains
 * an array of items, where each item specifies a unique column identifier (`id`) and its display label (`label`).
 *
 * This structure is used to organize and display filter options grouped by their respective categories.
 */
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
  const itemHeight    = 48;
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
                key={value} 
                label={value}
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

/**
 * Props for the AssetDataTableFilter component.
 *
 * @property filterAssetName - The current value of the asset name filter input.
 * @property selectApprovalStatuses - Array of selected approval statuses for filtering.
 * @property selectWorkStatuses - Array of selected work statuses for filtering.
 * @property onAssetNameChange - Handler for changes to the asset name filter input.
 * @property onApprovalStatusesChange - Handler for changes to the approval statuses selection.
 * @property onWorkStatusesChange - Handler for changes to the work statuses selection.
 * @property onApprovalStatusChipDelete - Handler for deleting an approval status chip.
 * @property onWorkStatusChipDelete - Handler for deleting a work status chip.
 * @property onResetClick - Handler for resetting all filters.
 *
 * @property hiddenColumns - Set of column IDs that are currently hidden.
 * @property onHiddenColumnsChange - Handler for when the set of hidden columns changes.
 * @property onToggleColumn - Handler for toggling the visibility of a column by ID.
 * @property onShowAll - Handler to show all columns.
 * @property onHideAll - Handler to hide all columns.
 * @property visibleCount - The number of currently visible columns.
 * @property onSaveColumns - Optional handler to save the current column visibility state.
 */
type FilterProps = {
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

/**
 * AssetTableFilter component provides a UI for filtering and customizing the columns of an asset data table.
 *
 * @component
 * @param {FilterProps} props - The props for the AssetTableFilter component.
 * @param {string} props.filterAssetName - The current value of the asset name filter input.
 * @param {string[]} props.selectApprovalStatuses - The selected approval statuses for filtering.
 * @param {string[]} props.selectWorkStatuses - The selected work statuses for filtering.
 * @param {(event: React.ChangeEvent<HTMLInputElement>) => void} props.onAssetNameChange - Handler for asset name input changes.
 * @param {(statuses: string[]) => void} props.onApprovalStatusesChange - Handler for approval status selection changes.
 * @param {(statuses: string[]) => void} props.onWorkStatusesChange - Handler for work status selection changes.
 * @param {(status: string) => void} props.onApprovalStatusChipDelete - Handler for deleting an approval status chip.
 * @param {(status: string) => void} props.onWorkStatusChipDelete - Handler for deleting a work status chip.
 * @param {() => void} props.onResetClick - Handler for resetting all filters.
 * @param {Set<string>} props.hiddenColumns - Set of column IDs that are currently hidden.
 * @param {(hiddenColumns: Set<string>) => void} props.onHiddenColumnsChange - Handler for changes to hidden columns.
 * @param {(columnId: string) => void} props.onToggleColumn - Handler for toggling the visibility of a column.
 * @param {() => void} props.onShowAll - Handler to show all non-fixed columns.
 * @param {() => void} props.onHideAll - Handler to hide all non-fixed columns.
 * @param {number} props.visibleCount - The number of currently visible columns.
 * @param {() => Promise<void>} [props.onSaveColumns] - Optional handler to save the current column visibility settings.
 *
 * @returns {JSX.Element} The rendered AssetTableFilter component.
 *
 * @remarks
 * - Includes a filter form for asset name, approval status, and work status.
 * - Provides a drawer for column visibility customization, including show/hide all and save functionality.
 * - Uses Material-UI components for layout and interactivity.
 */
const AssetTableFilter: React.FC<FilterProps> = ({
  // filters
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
  const handleFilterKeyPress: TextFieldProps['onKeyPress'] = event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      return false;
    }
  };
    const [viewMode, setViewMode] = React.useState<'list' | 'grid'>('list'); // new top bar view mode state

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
              borderTop: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            {/* Left side: Show all / Hide all */}
            <div>
              <Button size="small" onClick={handleToggleAllColumns}>
                {allNonFixedColumnIds ? 'Hide all' : 'Show all'}
              </Button>
            </div>

            {/* Right side: SAVE + CLOSE */}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                size="small"
                onClick={async () => {
                  if (onSaveColumns) {
                    await onSaveColumns();   // Save to Pipeline Setting
                  }
                  setDrawerOpen(false);      // Optional: close drawer after saving
                }}
                style={{ width: '80px' }}
              >
                SAVE
                
              </Button>
            </div>
          </div>
        </div>
      </Drawer>
    </StyledFilterDiv>
  );
}

export default AssetTableFilter;