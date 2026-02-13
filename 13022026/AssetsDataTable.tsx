/* _________________________________________________________________________________
  
  Module Name:
  AssetsDataTable.tsx
  
  Module Description:
  React component that renders a data table displaying asset information for a project.
  
  Details:
  - Fetches and displays asset thumbnails.
  - Supports sorting by various asset attributes.
  - Allows hiding/showing of specific columns.
  - Compact mode for minimal column display.

  * Update and Modification History:
    * - 29-10-2025 - SanjayK PSI - Initial creation sorting pagination implementation.
    * - 07-11-2025 - SanjayK PSI - Column visibility toggling implementation.
    * - 20-11-2025 - SanjayK PSI - Fixed typo in filter property names handling.
    * - 24-11-2025 - SanjayK PSI - Added detailed doc comments for functions and types.
    * - [Current Date] - Added proper empty value handling in sorting
    
  Function:
    * - AssetsDataTable: Main component rendering the assets data table.
    * - RecordTableHead: Renders the table header with sortable columns.
    * - AssetRow: Renders individual rows for each asset.
    * - Styled components for consistent theming.
    * - MultIineTooltipTableCell: Table cell with multi-line tooltip support.
    * - Constants for asset phases, approval statuses, and work statuses.
    * - Column definitions for the data table.
    * - NON_FIXED_IDS: Array of column IDs excluding fixed columns.
    * - isOnlyFixedVisible: Utility to check if only fixed columns are visible.
    * - TooltipTableCellProps: Props for the MultiLineTooltipTableCell component.
    * - Status: Type defining display name and color for statuses.
    * - Columns: Configuration for the data table columns.
    * - ASSET_PHASES, APPROVAL_STATUS, WORK_STATUS: Mappings for phases and statuses.
    * - getPhaseData: Utility to extract phase-related data from an asset.
    * - isHidden: Utility to check if a column is hidden.
    * - RecordTableHead: Renders the table header with sortable columns
  * 
  ___________________________________________________________________________________ */
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  TableSortLabel,
  Box,
} from "@material-ui/core";
import {
  AssetRowProps,
  AssetsDataTableProps,
  Colors,
  Column,
  RecordTableHeadProps,
  SortDir,
  Asset,
} from "./types";
import { useFetchAssetThumbnails } from "./hooks";

const ASSET_PHASES: { [key: string]: Colors } = {
  mdl: {
    lineColor: '#3295fd',
    backgroundColor: '#354d68',
  },
  rig: {
    lineColor: '#c061fd',
    backgroundColor: '#5e3568',
  },
  bld: {
    lineColor: '#fc2f8c',
    backgroundColor: '#5a0028',
  },
  dsn: {
    lineColor: '#98f2fb',
    backgroundColor: '#045660',
  },
  ldv: {
    lineColor: '#fe5cff',
    backgroundColor: '#683566',
  },
};

type Status = Readonly<{
  displayName: string,
  color: string,
}>;

const APPROVAL_STATUS: { [key: string]: Status } = {
  check: {
    displayName: 'Check',
    color: '#ca25ed',
  },
  clientReview: {
    displayName: 'Client Review',
    color: '#005fbd',
  },
  dirReview: {
    displayName: 'Dir Review',
    color: '#007fff',
  },
  epdReview: {
    displayName: 'EPD Review',
    color: '#4fa7ff',
  },
  clientOnHold: {
    displayName: 'Client On Hold',
    color: '#d69b00',
  },
  dirOnHold: {
    displayName: 'Dir On Hold',
    color: '#ffcc00',
  },
  epdOnHold: {
    displayName: 'EPD On Hold',
    color: '#ffdd55',
  },
  execRetake: {
    displayName: 'Exec Retake',
    color: '#a60000',
  },
  clientRetake: {
    displayName: 'Client Retake',
    color: '#c60000',
  },
  dirRetake: {
    displayName: 'Dir Retake',
    color: '#ff0000',
  },
  epdRetake: {
    displayName: 'EPD Retake',
    color: '#ff4f4f',
  },
  clientApproved: {
    displayName: 'Client Approved',
    color: '#1d7c39',
  },
  dirApproved: {
    displayName: 'Dir Approved',
    color: '#27ab4f',
  },
  epdApproved: {
    displayName: 'EPD Approved',
    color: '#5cda82',
  },
  other: {
    displayName: 'Other',
    color: '#9a9a9a',
  },
  omit: {
    displayName: 'Omit',
    color: '#646464',
  },
  approved: {
    displayName: 'Approved',
    color: '#32cd32',
  },
  review: {
    displayName: 'Review',
    color: '#ffa500',
  },
};

const WORK_STATUS: { [key: string]: Status } = {
  check: { displayName: "Check", color: "#e287f5" },
  cgsvOnHold: { displayName: "CGSV On Hold", color: "#ffdd55" },
  svOnHold: { displayName: "SV On Hold", color: "#ffe373" },
  leadOnHold: { displayName: "Lead On Hold", color: "#fff04f" },
  cgsvRetake: { displayName: "CGSV Retake", color: "#ff4f4f" },
  svRetake: { displayName: "SV Retake", color: "#ff8080" },
  leadRetake: { displayName: "Lead Retake", color: "#ffbbbb" },
  cgsvApproved: { displayName: "CGSV Approved", color: "#5cda82" },
  svApproved: { displayName: "SV Approved", color: "#83e29f" },
  leadApproved: { displayName: "Lead Approved", color: "#b9eec9" },
  svOther: { displayName: "SV Other", color: "#9a9a9a" },
  leadOther: { displayName: "Lead Other", color: "#dbdbdb" },
  review: { displayName: "Review", color: "#ffa500" },
  inProgress: { displayName: "In Progress", color: "#00bfff" },
  notStarted: { displayName: "Not Started", color: "#d3d3d3" },
  approved: { displayName: "Approved", color: "#32cd32" },
};

// ============================================
// 1. ADD HELPER FUNCTION FOR NUMERIC TAKE SORTING
// ============================================

/**
 * Enhanced comparison for TAKE values - sorts numerically, with empty values at the end
 */
const enhancedCompareTake = (a: any, b: any, dir: SortDir): number => {
  const isAsc = dir === 'asc';
  
  const aEmpty = isEmptyValue(a);
  const bEmpty = isEmptyValue(b);
  
  // Rule: Empty values always go to the END
  if (aEmpty && bEmpty) return 0;
  if (aEmpty && !bEmpty) return 1;   // a empty, goes after b
  if (!aEmpty && bEmpty) return -1;  // a valid, goes before b
  
  // Both have values - parse as integers for numeric comparison
  const aNum = parseInt(String(a).trim(), 10);
  const bNum = parseInt(String(b).trim(), 10);
  
  // If both are valid numbers, compare numerically
  if (!isNaN(aNum) && !isNaN(bNum)) {
    if (aNum === bNum) return 0;
    
    if (isAsc) {
      return aNum < bNum ? -1 : 1;
    } else {
      return aNum > bNum ? -1 : 1;
    }
  }
  
  // Fallback to string comparison if numbers are invalid
  const compA = String(a).trim().toLowerCase();
  const compB = String(b).trim().toLowerCase();
  
  if (compA === compB) return 0;
  
  if (isAsc) {
    return compA < compB ? -1 : 1;
  } else {
    return compA > compB ? -1 : 1;
  }
};

// ============================================
// 2. UPDATE THE COLUMN DEFINITIONS - Ensure sortable is true
// ============================================
const columns: Column[] = [
  { id: "thumbnail", label: "Thumbnail" },
  { id: "group_1_name", label: "Name", sortable: true, sortKey: "group_1" },

  // MDL Phase
  { id: "mdl_work_status", label: "MDL WORK", colors: ASSET_PHASES.mdl, sortable: true, sortKey: "mdl_work" },
  { id: "mdl_approval_status", label: "MDL APPR", colors: ASSET_PHASES.mdl, sortable: true, sortKey: "mdl_appr" },
  { id: "mdl_submitted_at", label: "MDL Submitted At", colors: ASSET_PHASES.mdl, sortable: true, sortKey: "mdl_submitted" },
  { id: "mdl_take", label: "MDL TAKE", colors: ASSET_PHASES.mdl, sortable: true, sortKey: "mdl_take" },  // Already sortable

  // RIG Phase
  { id: "rig_work_status", label: "RIG WORK", colors: ASSET_PHASES.rig, sortable: true, sortKey: "rig_work" },
  { id: "rig_approval_status", label: "RIG APPR", colors: ASSET_PHASES.rig, sortable: true, sortKey: "rig_appr" },
  { id: "rig_submitted_at", label: "RIG Submitted At", colors: ASSET_PHASES.rig, sortable: true, sortKey: "rig_submitted" },
  { id: "rig_take", label: "RIG TAKE", colors: ASSET_PHASES.rig, sortable: true, sortKey: "rig_take" },

  // BLD Phase
  { id: "bld_work_status", label: "BLD WORK", colors: ASSET_PHASES.bld, sortable: true, sortKey: "bld_work" },
  { id: "bld_approval_status", label: "BLD APPR", colors: ASSET_PHASES.bld, sortable: true, sortKey: "bld_appr" },
  { id: "bld_submitted_at", label: "BLD Submitted At", colors: ASSET_PHASES.bld, sortable: true, sortKey: "bld_submitted" },
  { id: "bld_take", label: "BLD TAKE", colors: ASSET_PHASES.bld, sortable: true, sortKey: "bld_take" },

  // DSN Phase
  { id: "dsn_work_status", label: "DSN WORK", colors: ASSET_PHASES.dsn, sortable: true, sortKey: "dsn_work" },
  { id: "dsn_approval_status", label: "DSN APPR", colors: ASSET_PHASES.dsn, sortable: true, sortKey: "dsn_appr" },
  { id: "dsn_submitted_at", label: "DSN Submitted At", colors: ASSET_PHASES.dsn, sortable: true, sortKey: "dsn_submitted" },
  { id: "dsn_take", label: "DSN TAKE", colors: ASSET_PHASES.dsn, sortable: true, sortKey: "dsn_take" },

  // LDV Phase
  { id: "ldv_work_status", label: "LDV WORK", colors: ASSET_PHASES.ldv, sortable: true, sortKey: "ldv_work" },
  { id: "ldv_approval_status", label: "LDV APPR", colors: ASSET_PHASES.ldv, sortable: true, sortKey: "ldv_appr" },
  { id: "ldv_submitted_at", label: "LDV Submitted At", colors: ASSET_PHASES.ldv, sortable: true, sortKey: "ldv_submitted" },
  { id: "ldv_take", label: "LDV TAKE", colors: ASSET_PHASES.ldv, sortable: true, sortKey: "ldv_take" },

  { id: "relation", label: "Relation", sortable: true, sortKey: "relation" },
  { id: "component", label: "Component", sortable: true, sortKey: "component" },
];

const NON_FIXED_IDS = columns.map(c => c.id).filter(id => id !== "thumbnail" && id !== "group_1_name");
const isOnlyFixedVisible = (hidden: Set<string>) => NON_FIXED_IDS.every(id => hidden.has(id));

type TooltipTableCellProps = {
  tooltipText: string;
  status: Status | undefined;
  leftBorderStyle: string;
  rightBorderStyle: string;
  bottomBorderStyle: string;
};

/**
 * Utility functions for consistent empty value handling
 */
const isEmptyValue = (value: any): boolean => {
  if (value === null || value === undefined) return true;
  const str = String(value).trim();
  return str === '' || str === '-' || str === '—' || str === 'null' || str === 'undefined';
};

const formatForDisplay = (value: any): string => {
  if (isEmptyValue(value)) return '—';
  return String(value).trim();
};

const MultiLineTooltipTableCell: React.FC<TooltipTableCellProps> = ({
  tooltipText, status, leftBorderStyle, rightBorderStyle, bottomBorderStyle = "none",
}) => {
  const [open, setOpen] = React.useState(false);
  const hasTooltipText = tooltipText && tooltipText.trim().length > 0;
  const statusText = status ? status.displayName : '—';

  return (
    <TableCell
      style={{
        color: status ? status.color : "",
        fontStyle: tooltipText === "" ? "normal" : "oblique",
        borderLeft: leftBorderStyle,
        borderRight: rightBorderStyle,
        borderBottom: bottomBorderStyle,
      }}
      onClick={hasTooltipText ? () => setOpen(true) : undefined}
    >
      {hasTooltipText ? (
        <Tooltip
          title={<div style={{ fontSize: "0.8rem", whiteSpace: "pre-wrap" }}>{tooltipText}</div>}
          onClose={() => setOpen(false)}
          open={open}
          arrow
        >
          <span>{statusText}</span>
        </Tooltip>
      ) : (
        <span>{statusText}</span>
      )}
    </TableCell>
  );
};
           
// ============================================
// 3. UPDATE THE RECORDTABLEHEAD COMPONENT
// ============================================
const RecordTableHead: React.FC<RecordTableHeadProps & {
  onSortChange: (sortKey: string) => void;
  currentSortKey: string;
  currentSortDir: SortDir;
  headerCellStylesById?: Record<string, React.CSSProperties>;
}> = ({
  columns, onSortChange, currentSortKey, currentSortDir, headerCellStylesById = {},
}) => {
  const getSortDir = (id: string, activeKey: string, activeDir: SortDir): SortDir =>
    activeKey === id ? activeDir : "none";

  const createSortHandler = (id: string) => () => onSortChange(id);

  return (
    <TableHead>
      <TableRow>
        {columns.map((column) => {
          // Determine "first/last visible" within a phase to draw borders
          const phase = ["mdl", "rig", "bld", "dsn", "ldv"].find(p => column.id.startsWith(p));
          const inPhaseIds = phase
            ? [`${phase}_work_status`, `${phase}_approval_status`, `${phase}_submitted_at`, `${phase}_take`]
                .filter(id => columns.some(c => c.id === id))
            : [];
          const firstId = inPhaseIds[0];
          const lastId  = inPhaseIds[inPhaseIds.length - 1];

          const hasPhase = Boolean(phase && column.colors);
          const rail = hasPhase ? `solid 3px ${column.colors!.lineColor}` : "none";

          const sortKey = column.sortKey || column.id;
          const sortDir = getSortDir(sortKey, currentSortKey, currentSortDir);

          return (
            <TableCell
              key={column.id}
              style={{
                backgroundColor: column.colors ? column.colors.backgroundColor : "none",
                borderTop: hasPhase ? rail : "none",
                borderLeft: hasPhase && firstId === column.id ? rail : "none",
                borderRight: hasPhase && lastId  === column.id ? rail : "none",
                ...(headerCellStylesById[column.id] || {}),
                cursor: column.sortable ? "pointer" : "default",
              }}
              onClick={column.sortable ? createSortHandler(sortKey) : undefined}
            >
              {column.sortable ? (
                <Box display="flex" alignItems="center" justifyContent="center">
                  <span style={{ fontSize: 12, fontWeight: 500 }}>
                    {column.label}
                  </span>
                  <Box ml={0.5} display="inline-flex" alignItems="center">
                    {sortDir !== "none" && (
                      <span style={{ 
                        fontSize: 12,
                        color: '#fcfeffff',
                        lineHeight: '12px',
                        marginLeft: 2,
                        fontWeight: 'bold'
                      }}>
                        {sortDir === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </Box>
                </Box>
              ) : (
                column.label
              )}
            </TableCell>
          );
        })}
      </TableRow>
    </TableHead>
  );
};

const AssetRow: React.FC<AssetRowProps & { hiddenColumns: Set<string>; compact: boolean }> = ({
  asset, thumbnails, dateTimeFormat, isLastRow, hiddenColumns, compact, phaseComponents, latestComponents,
}) => {
  const isHidden = (id: string) => hiddenColumns.has(id);

  const getPhaseData = (phase: string) => {
    const workStatusKey     = `${phase}_work_status` as keyof Asset;
    const approvalStatusKey = `${phase}_approval_status` as keyof Asset;
    const submittedAtKey    = `${phase}_submitted_at_utc` as keyof Asset;
    const takeKey           = `${phase}_take` as keyof Asset;

    const workStatusValue     = asset[workStatusKey];
    const approvalStatusValue = asset[approvalStatusKey];
    const submittedAtValue    = asset[submittedAtKey];
    const takeValue           = asset[takeKey];

    // Status lookup with fallback for empty values
    let workStatus: Status | undefined = undefined;
    if (!isEmptyValue(workStatusValue)) {
        const raw = String(workStatusValue);
        workStatus = WORK_STATUS[raw] || 
        WORK_STATUS[raw.toLowerCase()] || 
        WORK_STATUS[raw.charAt(0).toLowerCase() + raw.slice(1)];

        // Use a generic status if the key is not found
        if (!workStatus) {
            workStatus = WORK_STATUS.svOther;
        }
    }
    
    let approvalStatus: Status | undefined = undefined;
    if (!isEmptyValue(approvalStatusValue)) {
        const raw = String(approvalStatusValue);
        approvalStatus = APPROVAL_STATUS[raw] || 
        APPROVAL_STATUS[raw.toLowerCase()] || 
        APPROVAL_STATUS[raw.charAt(0).toLowerCase() + raw.slice(1)];

        // Use a generic status if the key is not found
        if (!approvalStatus) {
            approvalStatus = APPROVAL_STATUS.other;
        }
    }

    const submittedAt = !isEmptyValue(submittedAtValue) ? new Date(submittedAtValue as string) : null;
    const localTimeText = submittedAt ? dateTimeFormat.format(submittedAt) : '—';
    // const takeText = !isEmptyValue(takeValue) ? String(takeValue) : '—';

    let takeText = '—';
    if (!isEmptyValue(takeValue)) {
      const rawTake = String(takeValue).trim();
      takeText    = rawTake.slice(-4); // Last 4 characters as fallback

      console.log('Computed takeText:', takeText);
    }

    return { 
      workStatus, 
      approvalStatus, 
      localTimeText,
      takeText,
      tooltipText: "" };
  };

  
  // function to get component display value
  const getComponentData = () => {
    // Check if component exists directly on the asset (from the API response)
    if (asset.component && !isEmptyValue(asset.component)) {
      const componentStr = String(asset.component).trim();
      // Clean underscores first, then format
      const cleanComponent = componentStr.replace(/^_+|_+$/g, '');
      return formatForDisplay(cleanComponent);
    }
    
    // Fallback to latestComponents if needed (for backward compatibility)
    const assetKey = `${asset.root}-${asset.relation}`;
    const component = latestComponents[assetKey];

    if (!component || component.length === 0) {
      return '—';
    }

    const componentNames = component.map(comp => {
      const compStr = String(comp.component).trim();
      const cleanComp = compStr.replace(/^_+|_+$/g, '');
      return formatForDisplay(cleanComp);
    }).filter(name => name !== '—'); // Remove empty display values
    
    return componentNames.join(', ') || '—';
  };
  
  const componentData = getComponentData();

  return (
    <TableRow>
      {!isHidden("thumbnail") && (
        <TableCell style={compact ? { width: 140, minWidth: 140, maxWidth: 140 } : undefined}>
          {thumbnails[`${asset.group_1}-${asset.relation}`] ? (
            <img
              src={thumbnails[`${asset.group_1}-${asset.relation}`]}
              alt={`${asset.group_1} thumbnail`}
              style={{ width: "100px", height: "auto" }}
            />
          ) : (
            <span>No Thumbnail</span>
          )}
        </TableCell>
      )}

      {/* NAME */}
      {!isHidden("group_1_name") && (
        <TableCell style={compact ? { minWidth: 220 } : undefined}>
          {formatForDisplay(asset.group_1)}
        </TableCell>
      )}

      {/* PHASES */}
      {(Object.entries(ASSET_PHASES) as Array<[string, { lineColor: string }]>).map(
          ([phase, { lineColor }]) => {
            const ids = {
              work: `${phase}_work_status`,
              appr: `${phase}_approval_status`,
              subm: `${phase}_submitted_at`,
              take: `${phase}_take`,
            };

            const visibleIds = [
              !isHidden(ids.work) ? ids.work : null,
              !isHidden(ids.appr) ? ids.appr : null,
              !isHidden(ids.subm) ? ids.subm : null,
              !isHidden(ids.take) ? ids.take : null,
            ].filter(Boolean) as string[];

            if (visibleIds.length === 0) return null;

            const firstId = visibleIds[0];
            const lastId  = visibleIds[visibleIds.length - 1];
            const rail = `solid 3px ${lineColor}`;

            const { workStatus, approvalStatus, localTimeText, takeText, tooltipText } = getPhaseData(phase);

            return (
              <React.Fragment key={`${asset.group_1}-${asset.relation}-${phase}`}>
                {/* WORK */}
                {!isHidden(ids.work) && (
                  <MultiLineTooltipTableCell
                    tooltipText={tooltipText}
                    status={workStatus}
                    leftBorderStyle={firstId === ids.work ? rail : "none"}
                    rightBorderStyle={lastId  === ids.work ? rail : "none"}
                    bottomBorderStyle={isLastRow ? rail : "none"}
                  />
                )}

                {/* APPR */}
                {!isHidden(ids.appr) && (
                  <MultiLineTooltipTableCell
                    tooltipText={tooltipText}
                    status={approvalStatus}
                    leftBorderStyle={firstId === ids.appr ? rail : "none"}
                    rightBorderStyle={lastId  === ids.appr ? rail : "none"}
                    bottomBorderStyle={isLastRow ? rail : "none"}
                  />
                )}

                {/* SUBMITTED */}
                {!isHidden(ids.subm) && (
                  <TableCell
                    style={{
                      borderLeft: firstId === ids.subm ? rail : "none",
                      borderRight: lastId === ids.subm ? rail : "none",
                      borderBottom: isLastRow ? rail : "none",
                    }}
                  >
                    {localTimeText}
                  </TableCell>
                )}

                {/* TAKE */}
                {!isHidden(ids.take) && (
                  <TableCell
                    style={{
                      borderLeft: firstId === ids.take ? rail : "none",
                      borderRight: lastId === ids.take ? rail : "none",
                      borderBottom: isLastRow ? rail : "none",
                    }}
                  >
                    {takeText}
                  </TableCell>
                )}
              </React.Fragment>
            );
          }
        )}

      {/* RELATION */}
      {!isHidden("relation") && !compact && (
        <TableCell>{formatForDisplay(asset.relation)}</TableCell>
      )}
      {/* COMPONENT */}
      {!isHidden("component") && !compact && (
          <TableCell>
            {componentData ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px',
                }}
              >
                {componentData.split(', ').map((comp: string, index: number) => (
                  <span
                    key={index}
                    style={{
                      padding: '2px 6px',
                      // backgroundColor: '#e0e0e0',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                    }}
                  >
                    {comp}
                  </span>
                ))}
              </div>
            ) : '—'}
          </TableCell>
        )}
      </TableRow>
  );
};

const AssetsDataTable: React.FC<AssetsDataTableProps> = ({
  project,
  assets,
  tableFooter,
  dateTimeFormat,
  onSortChange,
  currentSortKey,
  currentSortDir,
  hiddenColumns = new Set(),
}) => {
  if (!project) return null;

  const { thumbnails } = useFetchAssetThumbnails(
    project,
    assets
  );

  // Compact mode: only Thumbnail + Name visible
  const compact = isOnlyFixedVisible(hiddenColumns);

  // Header widths to keep header/body aligned in compact mode
  const headerCellStylesById: Record<string, React.CSSProperties> = compact
    ? {
        thumbnail: { width: 140, minWidth: 140, maxWidth: 140 },
        group_1_name: { minWidth: 220 },
      }
    : {};

  // Visible columns for header
  const visibleColumns = columns.filter(
    (c) =>
      !hiddenColumns.has(c.id) || c.id === "thumbnail" || c.id === "group_1_name"
  );

  return (
    <Table stickyHeader style={{ ...(compact ? { tableLayout: 'fixed' } : {}), width: '100%' }}>
      <RecordTableHead
        key="asset-data-table-head"
        columns={visibleColumns}
        onSortChange={onSortChange}
        currentSortKey={currentSortKey}
        currentSortDir={currentSortDir}
        headerCellStylesById={headerCellStylesById}
      />

      <TableBody>
        {assets.map((asset, index) => (
          <AssetRow
            key={`${asset.group_1}-${asset.relation}-${index}`}
            asset={asset}
            thumbnails={thumbnails}
            phaseComponents={{}}
            latestComponents={{}}
            dateTimeFormat={dateTimeFormat}
            isLastRow={index === assets.length - 1}
            hiddenColumns={hiddenColumns}
            compact={compact}
          />
        ))}
      </TableBody>

      {tableFooter || null}
    </Table>
  );
};

export default AssetsDataTable;