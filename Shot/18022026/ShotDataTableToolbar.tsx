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
} from "@material-ui/core";
import { styled } from "@material-ui/core/styles";
import ViewListIcon from "@material-ui/icons/ViewList";
import ViewModuleIcon from "@material-ui/icons/ViewModule";
import FilterListIcon from "@material-ui/icons/FilterList";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import ViewColumnIcon from "@material-ui/icons/ViewColumn";

import { group } from "console";


/* ------------------------------
   Styled Components
-------------------------------- */

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  paddingTop: theme.spacing(2),
  paddingBottom: theme.spacing(2),
  marginTop: theme.spacing(1),
  height: 20,
}));

const LeftSection = styled("div")({
    display: "flex",
    alignItems: "center",
    gap: 8,
});

const RightSection = styled("div")({
    display: "flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "flex-end",
});

/* Toggle Container */
const ToggleContainer = styled(Box)({
    display: "flex",
    backgroundColor: "transparent",
    borderRadius: 4,
    padding: 4,
});

/* Search Container */
const SearchContainer = styled(Box)({
    display: "flex",
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 4,
    padding: "4px 8px",
    gap: 8,
    border: "1px solid #ccc",
});

const StyledInput = styled("input")({
    color: "inherit",
    backgroundColor: "transparent",
    border: "none",
    outline: "none",
    width: 120,
    fontSize: 14,
});

/* Filter Menu Types and Styled Components */
type Filters = {
    assetGroups: string[];
    approvalStatus: string[];
    workStatus: string[];
};

interface FilterMenuProps {
    filters: Filters;
    onChange: (newFilters: Filters) => void;
}

// Add missing styled components for FilterPanel and FilterOption
const FilterPanel = styled(Box)({
    display: "flex",
    flexDirection: "column",
    gap: 8,
});

/* ------------------------------
   Filter Menu Component
-------------------------------- */
const FilterMenu: React.FC<FilterMenuProps> = ({
  filters,
  onChange,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [openSection, setOpenSection] = React.useState<string | null>(null);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const clearFilters = () => {
    onChange({
      assetGroups: [],
      approvalStatus: [],
      workStatus: [],
    });
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Box
        display="flex"
        alignItems="center"
        style={{ cursor: "pointer", color: "#ffffff" }}
        onClick={handleOpen}
      >
        <FilterListIcon fontSize="small" style={{ marginRight: 6 }} />
        <Typography variant="body2">Filter</Typography>
      </Box>

      <Menu
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <FilterPanel>
          <List dense>
            <ListItem button onClick={clearFilters}>
              <ListItemText primary="Clear all filters" />
            </ListItem>

            <Divider style={{ backgroundColor: "#444" }} />

            {/* Asset Groups */}
            <ListItem button onClick={() => toggleSection("assetGroups")}>
              <ListItemText primary="Asset Groups" />
              {openSection === "assetGroups" ? (
                <ExpandLessIcon />
              ) : (
                <ExpandMoreIcon />
              )}
            </ListItem>
            <Collapse in={openSection === "assetGroups"}>
              <Box pl={2} pb={1}>
                <Typography variant="body2">Group A</Typography>
                <Typography variant="body2">Group B</Typography>
              </Box>
            </Collapse>

            {/* Approval Status */}
            <ListItem button onClick={() => toggleSection("approvalStatus")}>
              <ListItemText primary="Approval Status" />
              {openSection === "approvalStatus" ? (
                <ExpandLessIcon />
              ) : (
                <ExpandMoreIcon />
              )}
            </ListItem>
            <Collapse in={openSection === "approvalStatus"}>
              <Box pl={2} pb={1}>
                <Typography variant="body2">Approved</Typography>
                <Typography variant="body2">Pending</Typography>
              </Box>
            </Collapse>

            {/* Work Status */}
            <ListItem button onClick={() => toggleSection("workStatus")}>
              <ListItemText primary="Work Status" />
              {openSection === "workStatus" ? (
                <ExpandLessIcon />
              ) : (
                <ExpandMoreIcon />
              )}
            </ListItem>
            <Collapse in={openSection === "workStatus"}>
              <Box pl={2} pb={1}>
                <Typography variant="body2">In Progress</Typography>
                <Typography variant="body2">Completed</Typography>
              </Box>
            </Collapse>
          </List>
        </FilterPanel>
      </Menu>
    </>
  );
};
/* End Filter Menu */

/* ------------------------------
  Column  Component
-------------------------------- */
type ColumnItem = {
    id: string;
    label: string;
    group: string; // Optional group name for grouping columns
};

type ColumnState = {
    [key: string]: boolean; // key is column id, value is visibility
};

const ALL_COLUMNS: ColumnItem[] = [
    { id: "shotName", label: "Shot Name", group: "Basic Info" },
    { id: "assetGroup", label: "Asset Group", group: "Basic Info" },
    { id: "approvalStatus", label: "Approval Status", group: "Status" },
    { id: "workStatus", label: "Work Status", group: "Status" },
    // Add more columns as needed
];

const ColumnsPanel = styled(Box)(({ theme }) => ({
    display: "flex",
    flexDirection: "column",
    padding: theme.spacing(2),
}));

interface ColumnSelectorProps {
    columnState: ColumnState;
    onChange: (columnState: ColumnState) => void;
}

/* ------------------------------
   Styled Components for Main Panel
-------------------------------- */
const ColumnSelector: React.FC<ColumnSelectorProps> = ({
  columnState,
  onChange,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [openGroups, setOpenGroups] = React.useState<string[]>([]);

  const open = Boolean(anchorEl);

  const handleToggleGroup = (group: string) => {
    setOpenGroups((prev) =>
      prev.includes(group)
        ? prev.filter((g) => g !== group)
        : [...prev, group]
    );
  };

  const handleToggleColumn = (id: string) => {
    onChange({
      ...columnState,
      [id]: !columnState[id],
    });
  };

  const handleHideAll = () => {
    const updated: ColumnState = {};
    Object.keys(columnState).forEach((key) => (updated[key] = false));
    onChange(updated);
  };

  const visibleCount = Object.values(columnState).filter(Boolean).length;

  const groupedColumns = ALL_COLUMNS.reduce((acc, col) => {
    if (!acc[col.group]) acc[col.group] = [];
    acc[col.group].push(col);
    return acc;
  }, {} as Record<string, ColumnItem[]>);

  return (
    <>
      <Box
        display="flex"
        alignItems="center"
        style={{
          cursor: "pointer",
          backgroundColor: "#3a3a3a",
          padding: "6px 10px",
          borderRadius: 4,
        }}
        onClick={(e) => setAnchorEl(e.currentTarget)}
      >
        <ViewColumnIcon fontSize="small" style={{ marginRight: 6 }} />
        <Typography variant="body2" style={{ color: "#00bcd4" }}>
          COLUMNS ({visibleCount})
        </Typography>
      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <ColumnsPanel>
          {Object.keys(groupedColumns).map((group) => (
            <Box key={group}>
              <ListItem button onClick={() => handleToggleGroup(group)}>
                <ListItemText primary={group} />
                {openGroups.includes(group) ? (
                  <ExpandLessIcon />
                ) : (
                  <ExpandMoreIcon />
                )}
              </ListItem>

              <Collapse in={openGroups.includes(group)}>
                {groupedColumns[group].map((col) => (
                  <ListItem
                    key={col.id}
                    dense
                    button
                    onClick={() => handleToggleColumn(col.id)}
                  >
                    <Checkbox
                      checked={columnState[col.id]}
                      size="small"
                      style={{ color: "#00bcd4" }}
                    />
                    <ListItemText primary={col.label} />
                  </ListItem>
                ))}
              </Collapse>

              <Divider style={{ backgroundColor: "#444" }} />
            </Box>
          ))}

          <Box
            display="flex"
            justifyContent="space-between"
            mt={1}
          >
            <Button size="small" onClick={handleHideAll}>
              HIDE ALL
            </Button>
            <Button size="small" color="primary">
              SAVE
            </Button>
          </Box>
        </ColumnsPanel>
      </Popover>
    </>
  );
};

const initialColumns: ColumnState = {};
    ALL_COLUMNS.forEach((col) => {
        initialColumns[col.id] = true;
});

const [columnsState, setColumnsState] = React.useState<ColumnState>(initialColumns);
const visibleColumns = ALL_COLUMNS.filter(col => columnsState[col.id]); 
/* ------------------------------
   Types
-------------------------------- */

export type ViewMode = "list" | "group";
type Props = {
    viewMode: ViewMode;
    onViewChange: (mode: ViewMode) => void;
    searchValue: string;
    onSearchChange: (value: string) => void;  
    filters: Filters;
    onFilterChange: (newFilters: Filters) => void;
    columnsState: ColumnState;
    onColumnsChange: (newColumns: ColumnState) => void;
};

/* ------------------------------
   View Toggle Component
-------------------------------- */
interface ViewToggleProps {
    viewMode: ViewMode;
    onChange: (mode: ViewMode) => void;

}

/* ViewToggle Component */
const ViewToggle: React.FC<ViewToggleProps> = ({
    viewMode,
    onChange,

}) => {
  const getIconColor = (mode: ViewMode) =>
    viewMode === mode ? "#00bcd4" : "#9e9e9e";

  return (
    <ToggleContainer>
      <IconButton
        onClick={() => onChange("list")}
        disableRipple
        style={{ color: getIconColor("list") }}
        aria-label="list view"
      >
        <ViewListIcon style={{ fontSize: 24 }} />
      </IconButton>
    
    {/* Group View Button */}
      <IconButton
        onClick={() => onChange("group")}
        disableRipple
        style={{ color: getIconColor("group") }}
        aria-label="group view"
      >
        <ViewModuleIcon style={{ fontSize: 24 }} />
      </IconButton>
    </ToggleContainer>
  );
};


/* ------------------------------
   Main Toolbar Component
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
}) => {
  return (
    <StyledToolbar>
      <RightSection>
        <ViewToggle
          viewMode={viewMode}
          onChange={onViewChange}
        />
      </RightSection>

      <LeftSection>
        {/* Search Input */}
        <SearchContainer>
          <StyledInput
            type="text"
            placeholder="Search shots..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </SearchContainer>
        {/* Filter Menu */}
        <FilterMenu 
            filters={filters} 
            onChange={onFilterChange} 
        />
        {/* Column Selector */}
        <ColumnSelector 
            columnState={columnsState} 
            onChange={onColumnsChange} 
        />
      </LeftSection>
    </StyledToolbar>
  );
};

export default ShotDataTableToolbar;