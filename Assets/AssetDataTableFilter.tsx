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
    * - 05-02-2026 - SanjayK PSI - Added components for column visibility drawer and filter status selection.
    * - 09-02-2026 - SanjayK PSI - Added take number column and updated column sections for asset data table.
    * - 03-03-2026 - SanjayK PSI - Added component columns (MDLREND, BLDANM, BLDREND, LDVMDL) to column visibility drawer.
    * - 09-03-2026 - Fixed column visibility issue - Ensured component column IDs match between filter and table

  Functions:
    * - AssetTableFilter: Component for filtering and customizing columns in the asset data table.
    * - COLUMN_SECTIONS: Defines sections and items for column filtering.
    * - FilterStatusSelect: Sub-component for status selection with chips.
    * - getStyles: Utility function for styling selected items.
    * - buildComponentItems: Builds component column items from pipeline settings with consistent IDs

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
import { useFetchPipelineSettingAssetComponents } from './hooks';
import { useCurrentProject } from '../../hooks';

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
  /** Optional slot rendered in the top bar before COLUMNS/RESET (e.g., view toggle buttons). */
  headerLeft?: React.ReactNode;
  /** Optional slot rendered in the top bar on the right (before COLUMNS/RESET). */
  headerRight?: React.ReactNode;

  /** If false, hides the inline filter controls (Asset Name / Approval Status / Work Status). */
  showInlineFilters?: boolean;
  filterActive?: boolean;

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

/**
 * AssetTableFilter component provides a UI for filtering and customizing the columns of an asset data table.
 *
 * @component
 * @param {FilterProps} props - The props for the AssetTableFilter component.
 * @returns {JSX.Element} The rendered AssetTableFilter component.
 *
 * @remarks
 * - Includes a filter form for asset name, approval status, and work status.
 * - Provides a drawer for column visibility customization, including show/hide all and save functionality.
 * - Uses Material-UI components for layout and interactivity.
 */
const AssetTableFilter: React.FC<FilterProps> = ({
  headerLeft,
  headerRight,
  showInlineFilters = true,
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


  const { currentProject }  = useCurrentProject();
  const { phaseComponents } = useFetchPipelineSettingAssetComponents(currentProject);

  /**
   * Builds component column items from pipeline settings
   * IMPORTANT: Ensures column IDs match exactly with table definitions
   * - MDL phase components become: mdlRend, mdl[ComponentName], etc.
   * - BLD phase components become: bldAnm, bldRend, etc.
   * - LDV phase components become: ldvMdl, etc.
   */
  const buildComponentItems = (phase: string) => {
    if (!phaseComponents || !phaseComponents[phase]) {
      return [];
    }
    
    return phaseComponents[phase].map((comp) => {
      // Generate consistent column ID based on phase and component
      // This must match what's used in AssetsDataTable.tsx and AssetsGroupedDataTable.tsx
      let columnId = '';
      
      // Handle special case mappings to match the hardcoded columns in the table
      if (phase === 'mdl' && comp.toLowerCase() === 'rend') {
        columnId = 'mdlRend';
      } else if (phase === 'bld' && comp.toLowerCase() === 'anm') {
        columnId = 'bldAnm';
      } else if (phase === 'bld' && comp.toLowerCase() === 'rend') {
        columnId = 'bldRend';
      } else if (phase === 'ldv' && comp.toLowerCase() === 'mdl') {
        columnId = 'ldvMdl';
      } else {
        // Generic format for other components: phase + capitalized component
        columnId = `${phase}${comp.charAt(0).toUpperCase() + comp.slice(1)}`;
      }
      
      return {
        id: columnId,
        label: `${comp.toUpperCase()} SUBMITTED`
      };
    });
  };

  // Debug: Log phase components and built items
  React.useEffect(() => {
    if (phaseComponents && Object.keys(phaseComponents).length > 0) {
      console.log('Phase components loaded:', phaseComponents);
      
      // Log built component items for each phase
      ['mdl', 'bld', 'ldv'].forEach(phase => {
        const items = buildComponentItems(phase);
        console.log(`Component items for ${phase}:`, items);
      });
    }
  }, [phaseComponents]);

  // Column sections definition with proper component IDs
  const COLUMN_SECTIONS: Array<{
    title: string;
    items: Array<{ id: string; label: string }>;
  }> = [
    {
      title: 'MDL',
      items: [
        { id: 'mdl_work_status', label: 'MDL WORK' },
        { id: 'mdl_approval_status', label: 'MDL APPR' },
        { id: 'mdl_take', label: 'MDL TAKE' },
        ...buildComponentItems('mdl')
      ],
    },
    
    {
      title: 'RIG',
      items: [
        { id: 'rig_work_status', label: 'RIG WORK' },
        { id: 'rig_approval_status', label: 'RIG APPR' },
        { id: 'rig_take', label: 'RIG TAKE' },
      ],
    },

    {
      title: 'BLD',
      items: [
        { id: 'bld_work_status', label: 'BLD WORK' },
        { id: 'bld_approval_status', label: 'BLD APPR' },
        { id: 'bld_take', label: 'BLD TAKE' },
        ...buildComponentItems('bld')
      ],
    },

    {
      title: 'DSN',
      items: [
        { id: 'dsn_work_status', label: 'DSN WORK' },
        { id: 'dsn_approval_status', label: 'DSN APPR' },
        { id: 'dsn_take', label: 'DSN TAKE' },
      ],
    },

    {
      title: 'LDV',
      items: [
        { id: 'ldv_work_status', label: 'LDV WORK' },
        { id: 'ldv_approval_status', label: 'LDV APPR' },
        { id: 'ldv_take', label: 'LDV TAKE' },
        ...buildComponentItems('ldv')
      ],
    },

    {
      title: 'OTHER',
      items: [
        { id: 'relation', label: 'Relation' },
      ],
    },
  ];


  const handleFilterKeyPress: TextFieldProps['onKeyPress'] = event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      return false;
    }
  };
  const [viewMode, setViewMode] = React.useState<'list' | 'grid'>('list'); // new top bar view mode state

  // Get all columns from sections
  const allColumns: Array<{ id: string; label: string }> = COLUMN_SECTIONS.flatMap(section => section.items);
  const NON_FIXED = allColumns.filter((col) => col.id !== 'thumbnail' && col.id !== 'group_1_name'); 
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

  // Single checkbox row with debugging
  const renderColumnCheckbox = (id: string, label: string) => {
    const isVisible = !hiddenColumns.has(id);
    
    // Debug: Log when rendering component columns
    if (id.includes('Rend') || id.includes('Anm') || id.includes('Mdl')) {
      console.log(`Rendering component checkbox: ${id}`, { isVisible, hidden: hiddenColumns.has(id) });
    }
    
    return (
      <FormControlLabel
        key={id}
        control={
          <Checkbox
            checked={isVisible}
            onChange={() => {
              console.log(`Toggling column: ${id}`, { wasVisible: isVisible });
              onToggleColumn(id);
            }}
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
          {/* LEFT (optional) */}
          <LeftWrap>
            {/* Optional slot (e.g. list/grid toggle buttons) */}
            {headerLeft ? (
              <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                marginRight: 8, 
                }}>
                
                {headerLeft}
              </div>
            ) : null}

            {showInlineFilters ? (
              <>
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
              </>
            ) : null}
          </LeftWrap>

          {/* RIGHT */}
          <RightWrap>
            {headerRight ? 
            <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center' 
              }}>{headerRight}</div> : null}

            <FilterButtonWrap>
              <Button
                variant="contained"
                color="primary"
                startIcon={<ViewColumnIcon />}
                endIcon={<ArrowDropDownIcon />}
                onClick={toggleDrawer(true)}
                style={{ borderRadius: 4, 
                  paddingLeft: 5, 
                  paddingRight: 5}}
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
            width: 280, // Slightly wider to accommodate longer labels
            height: '70vh',
            display: 'flex',
            position: 'fixed',
            top: 150,
            right: 100,
            backgroundColor: '#2f2f2f',
            color: '#e0e0e0',
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
                {allNonFixedColumnIds ? 'HIDE ALL' : 'SHOW ALL'}
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
