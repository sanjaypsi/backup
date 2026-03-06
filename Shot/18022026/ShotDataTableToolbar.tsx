import React from "react";
import {
    Toolbar,
    Typography,
    IconButton,
    Box,
    Menu,
    List,
    ListItem,
    ListItemText,
    Divider,
    Collapse,
    Popover,
    Checkbox,
    Button,
    Drawer,
} from "@material-ui/core";
import { styled } from "@material-ui/core/styles";
import ViewListIcon from "@material-ui/icons/ViewList";
import ViewModuleIcon from "@material-ui/icons/ViewModule";
import FilterListIcon from "@material-ui/icons/FilterList";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import ViewColumnIcon from "@material-ui/icons/ViewColumn";
import RestoreIcon from "@material-ui/icons/Restore";

/* ------------------------------
   Styled Components
-------------------------------- */

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: theme.spacing(1, 2),
  minHeight: 56,
}));

const LeftSection = styled("div")({
  display: "flex",
  alignItems: "center",
  gap: 12,
});

const RightSection = styled("div")({
  display: "flex",
  alignItems: "center",
  gap: 8,
});

/* Toggle */
const ToggleContainer = styled(Box)({
  display: "flex",
  borderRadius: 4,
});

/* Search */
const SearchContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  backgroundColor: theme.palette.background.default,
  borderRadius: 6,
  padding: "4px 12px",
  border: `1px solid ${theme.palette.divider}`,
  height: 36,
}));

const StyledInput = styled("input")({
  color: "inherit",
  backgroundColor: "transparent",
  border: "none",
  outline: "none",
  width: 200,
  fontSize: 14,
  "&::placeholder": {
    color: "#999",
    opacity: 1,
  },
});

/* Control Buttons */
const ControlButton = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: theme.spacing(0.5, 1),
  borderRadius: 4,
  cursor: "pointer",
  height: 36,
  border: `1px solid transparent`,
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
    borderColor: theme.palette.divider,
  },
}));

/* Reset Button */
const ResetButton = styled(Button)(({ theme }) => ({
  height: 36,
  padding: theme.spacing(0.5, 1.5),
  marginLeft: theme.spacing(1),
  color: theme.palette.text.secondary,
  borderColor: theme.palette.divider,
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
    borderColor: theme.palette.text.secondary,
  },
}));

/* ------------------------------
   Types
-------------------------------- */

type Filters = {
  assetGroups: string[];
  approvalStatus: string[];
  workStatus: string[];
};

export type ViewMode = "list" | "group";

type ColumnItem = {
  id: string;
  label: string;
  group: string;
};

type ColumnState = {
  [key: string]: boolean;
};

type Props = {
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters: Filters;
  onFilterChange: (newFilters: Filters) => void;
  columnsState: ColumnState;
  onColumnsChange: (newColumns: ColumnState) => void;
  onReset?: () => void; // Optional reset handler
};

/* ------------------------------
   Filter Menu
-------------------------------- */

const FilterPanel = styled(Box)({
  display: "flex",
  flexDirection: "column",
  gap: 8,
});

const FilterMenu: React.FC<{
  filters: Filters;
  onChange: (newFilters: Filters) => void;
}> = ({ filters, onChange }) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [openSection, setOpenSection] = React.useState<string | null>(null);

  const filterOptions = {
    assetGroups: ["Buildings", "Vehicles", "Characters", "Environment"],
    approvalStatus: [
      "Check", 
      "Client Review", 
      "Dir Review",
      "EPD Review",

      "Client On Hold", 
      "Dir On Hold",
      "EPD On Hold",

      "Exec Retake",
      "Client Retake",
      "Dir Retake",
      "EPD Retake",

      "Client Approved",
      "Dir Approved",
      "EPD Approved",

      "Other",
      "Omit",
    ],
    workStatus: [
      "Check", 
      "CGSV On Hold", 
      "SV On Hold", 
      "Lead On Hold",
      "CGSV Retake",
      "SV Retake",
      "Lead Retake",
      "CGSV Approved", 
      "SV Approved", 
      "Lead Approved",
      "SV Other",
      "Lead Other",
    ],
  };

  const handleFilterChange = (section: string, value: string) => {
    const currentValues = filters[section as keyof Filters] as string[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    
    onChange({
      ...filters,
      [section]: newValues,
    });
  };

  const activeFilterCount = Object.values(filters).flat().length;

  return (
    <>
      <ControlButton onClick={(e) => setAnchorEl(e.currentTarget)}>
        <FilterListIcon fontSize="small" />
        <Typography variant="body2">Filter</Typography>
        {activeFilterCount > 0 && (
          <Box
            component="span"
            style={{
              backgroundColor: "#1976d2",
              color: "#fff",
              borderRadius: "50%",
              width: 18,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              marginLeft: 4,
            }}
          >
            {activeFilterCount}
          </Box>
        )}
      </ControlButton>

      <Menu
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{ style: { width: 250, maxHeight: 400 } }}
      >
        <FilterPanel>
          <List dense>
            <ListItem 
              button 
              onClick={() => {
                onChange({
                  assetGroups: [],
                  approvalStatus: [],
                  workStatus: [],
                });
                setAnchorEl(null);
              }}
            >
              <ListItemText primary="Clear all filters" />
            </ListItem>

            <Divider />

            {Object.entries(filterOptions).map(([section, options]) => (
              <React.Fragment key={section}>
                <ListItem 
                  button 
                  onClick={() => setOpenSection(openSection === section ? null : section)}
                >
                  <ListItemText 
                    primary={section.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} 
                  />
                  <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                    {filters[section as keyof Filters].length > 0 && (
                      <Typography variant="caption" color="primary">
                        ({filters[section as keyof Filters].length})
                      </Typography>
                    )}
                    {openSection === section ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </Box>
                </ListItem>

                <Collapse in={openSection === section} timeout="auto" unmountOnExit>
                  <Box pl={2} pr={1} pb={1} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {options.map(option => (
                      <ListItem 
                        key={option} 
                        button 
                        onClick={() => handleFilterChange(section, option)}
                        dense
                      >
                        <Checkbox
                          edge="start"
                          checked={filters[section as keyof Filters].includes(option)}
                          size="small"
                          disableRipple
                        />
                        <ListItemText primary={option} />
                      </ListItem>
                    ))}
                  </Box>
                </Collapse>
              </React.Fragment>
            ))}
          </List>
        </FilterPanel>
      </Menu>
    </>
  );
};

/* ------------------------------
   Column Selector
-------------------------------- */

const ALL_COLUMNS: ColumnItem[] = [
  { id: "thumbnail", label: "Thumbnail", group: "Main Columns" },
  { id: "group_1_name", label: "Name 1", group: "Main Columns" },
  { id: "group_2_name", label: "Name 2", group: "Main Columns" },
  { id: "group_3_name", label: "Name 3", group: "Main Columns" },

  { id: "lay_work_status", label: "LAY WORK", group: "Layout" },
  { id: "lay_approval_status", label: "LAY APPR", group: "Layout" },
  { id: "lay_submitted_at", label: "LAY Submitted At", group: "Layout" },

  { id: "anm_work_status", label: "ANM WORK", group: "Animation" },
  { id: "anm_approval_status", label: "ANM APPR", group: "Animation" },
  { id: "anm_submitted_at", label: "ANM Submitted At", group: "Animation" },

  { id: "gnz_work_status", label: "GNZ WORK", group: "Rigging" },
  { id: "gnz_approval_status", label: "GNZ APPR", group: "Rigging" },
  { id: "gnz_submitted_at", label: "GNZ Submitted At", group: "Rigging" },

  { id: "mat_work_status", label: "MAT WORK", group: "Materials" },
  { id: "mat_approval_status", label: "MAT APPR", group: "Materials" },
  { id: "mat_submitted_at", label: "MAT Submitted At", group: "Materials" },

  { id: "fx_work_status", label: "FX WORK", group: "Effects" },
  { id: "fx_approval_status", label: "FX APPR", group: "Effects" },
  { id: "fx_submitted_at", label: "FX Submitted At", group: "Effects" },

  { id: "cmp_work_status", label: "CMP WORK", group: "Composite" },
  { id: "cmp_approval_status", label: "CMP APPR", group: "Composite" },
  { id: "cmp_submitted_at", label: "CMP Submitted At", group: "Composite" },

  { id: "relation", label: "Relation", group: "Other" },
];

/* -----------------------------
Default Column State
----------------------------- */

const DEFAULT_COLUMN_STATE: ColumnState = ALL_COLUMNS.reduce((acc, col) => {
  acc[col.id] = true;
  return acc;
}, {} as ColumnState);

/* -----------------------------
Styles for Column Selector Drawer
----------------------------- */

const DrawerContainer = styled(Box)(({ theme }) => ({
  width: 320,
  height: "auto",
  display: "flex",
  flexDirection: "column",
}));

const Header = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const Footer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`,
  display: "flex",
  justifyContent: "space-between",
}));

const ScrollArea = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: "auto",
  "&::-webkit-scrollbar": {
    width: 6,
  },
  "&::-webkit-scrollbar-thumb": {
    background: "#999",
    borderRadius: 4,
  },
}));

/* -----------------------------
Column Selector Component
----------------------------- */

const ColumnSelector: React.FC<{
  columnState: ColumnState;
  onChange: (state: ColumnState) => void;
}> = ({ columnState, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const [openGroups, setOpenGroups] = React.useState<string[]>([]);

  const grouped = React.useMemo(() => {
    return ALL_COLUMNS.reduce((acc, col) => {
      if (!acc[col.group]) acc[col.group] = [];
      acc[col.group].push(col);
      return acc;
    }, {} as Record<string, ColumnItem[]>);
  }, []);

  const handleReset = () => {
    onChange(DEFAULT_COLUMN_STATE);
  };

  const activeColumnCount = Object.values(columnState).filter(Boolean).length;

  // Auto-expand groups that have visible columns
  React.useEffect(() => {
    if (open) {
      const groupsWithVisibleColumns = ALL_COLUMNS
        .filter(col => columnState[col.id])
        .map(col => col.group)
        .filter((value, index, self) => self.indexOf(value) === index);
      
      setOpenGroups(groupsWithVisibleColumns);
    }
  }, [open, columnState]);

  return (
    <>
      <ControlButton onClick={() => setOpen(true)}>
        <ViewColumnIcon fontSize="small" />
        <Typography 
          variant="body2"
          style={{color: "#1976d2", fontWeight: 1000}}
        
        >
          Columns ({activeColumnCount}/{ALL_COLUMNS.length})
          </Typography>

        {activeColumnCount > 0 && activeColumnCount < ALL_COLUMNS.length && (
          <Box
            component="span"
            style={{
              backgroundColor: "#1976d2",
              color: "#fff",
              borderRadius: "50%",
              width: 18,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              marginLeft: 4,
            }}
          >
            {activeColumnCount}
          </Box>
        )}
      </ControlButton>

      <Drawer 
      anchor="right" 
      open={open} onClose={() => setOpen(false)}
      PaperProps={{ 
        style: { 
          width: 320, 
          top: 150,
          right: 150,
          height: "calc(100% - 150px)",
          maxHeight: "80vh" 
        } }}
      >
        <DrawerContainer>
          {/* <Header>
            <Typography variant="h6">Show Columns</Typography>
            <Button 
              size="small" 
              onClick={handleReset}
              disabled={activeColumnCount === ALL_COLUMNS.length}
            >
              RESET
            </Button>
          </Header> */}

          <ScrollArea>
            {Object.entries(grouped).map(([group, cols], index) => (
              <React.Fragment key={group}>
                {index !== 0 && <Divider />}
                <ListItem
                  button
                  onClick={() =>
                    setOpenGroups(prev =>
                      prev.includes(group)
                        ? prev.filter(g => g !== group)
                        : [...prev, group]
                    )
                  }
                >
                  <ListItemText 
                    primary={group}
                    // secondary={`${cols.filter(col => columnState[col.id]).length}/${cols.length}`}
                  />
                  {openGroups.includes(group) ? (
                    <ExpandLessIcon />
                  ) : (
                    <ExpandMoreIcon />
                  )}
                </ListItem>

                <Collapse in={openGroups.includes(group)} timeout="auto">
                  <Box pl={2}>
                    {cols.map(col => (
                      <ListItem
                        key={col.id}
                        button
                        dense
                        style={{paddingTop:2, paddingBottom:2}}
                        onClick={() =>
                          onChange({
                            ...columnState,
                            [col.id]: !columnState[col.id],
                          })
                        }
                        
                      >
                        <Checkbox
                          checked={!!columnState[col.id]}
                          size="small"
                          edge="start"
                          disableRipple
                          style={{padding:4}}
                        />
                        <ListItemText primary={col.label} />
                      </ListItem>
                    ))}
                  </Box>
                </Collapse>
              </React.Fragment>
            ))}

            <Footer>
              <Button size="small">HideAll</Button>
              <Button size="small" onClick={handleReset}
                disabled={activeColumnCount === ALL_COLUMNS.length}
              >
                SAVE
              </Button>
            </Footer>

          </ScrollArea>
        </DrawerContainer>
      </Drawer>
    </>
  );
};

/* ------------------------------
   View Toggle
-------------------------------- */

const ViewToggle: React.FC<{
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}> = ({ viewMode, onChange }) => (
  <ToggleContainer>
    <IconButton
      onClick={() => onChange("list")}
      size="small"
      style={{ padding: 8 }}
      title="List View"
    >
      <ViewListIcon color={viewMode === "list" ? "primary" : "action"} />
    </IconButton>
    <IconButton
      onClick={() => onChange("group")}
      size="small"
      style={{ padding: 8 }}
      title="Group View"
    >
      <ViewModuleIcon color={viewMode === "group" ? "primary" : "action"} />
    </IconButton>
  </ToggleContainer>
);

/* ------------------------------
   Main Toolbar
-------------------------------- */

const ShotDataTableToolbar: React.FC<Props> = ({
  viewMode,
  onViewChange,
  searchValue,
  onSearchChange,
  filters,
  onFilterChange,
  columnsState,
  onColumnsChange,
  onReset,
}) => {

  const DEFAULT_FILTERS: Filters = {
    assetGroups: [],
    approvalStatus: [],
    workStatus: [],
  };

  const handleReset = () => {
    // Reset to defaults
    onSearchChange("");
    onFilterChange(DEFAULT_FILTERS);
    onColumnsChange(DEFAULT_COLUMN_STATE);
    
    // Call custom reset handler if provided
    if (onReset) {
      onReset();
    }
  };

  // Check if any customizations are active
  const hasChanges = 
    searchValue !== "" ||
    Object.values(filters).flat().length > 0 ||
    Object.values(columnsState).filter(Boolean).length !== ALL_COLUMNS.length;

  return (
    <StyledToolbar>

      {/* LEFT SECTION - View Toggle */}
      <LeftSection>
        <ViewToggle viewMode={viewMode} onChange={onViewChange} />
      </LeftSection>

      {/* RIGHT SECTION - Controls */}
      <RightSection>
        <SearchContainer>
          <StyledInput
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search shots..."
          />
        </SearchContainer>

        <FilterMenu filters={filters} onChange={onFilterChange} />

        <ColumnSelector
          columnState={columnsState}
          onChange={onColumnsChange}
        />

        {hasChanges && (
          <ResetButton
            variant="outlined"
            size="small"
            startIcon={<RestoreIcon />}
            onClick={handleReset}
          >
            Reset
          </ResetButton>
        )}
      </RightSection>

    </StyledToolbar>
  );
};

export default ShotDataTableToolbar;
