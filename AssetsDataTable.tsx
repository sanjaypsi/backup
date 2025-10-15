import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
} from "@material-ui/core";
import {
  AssetRowProps,
  AssetReviewPivotRow, // New type for single pivot row
  AssetsDataTableProps,
  Colors,
  Column,
  RecordTableHeadProps,
} from "./types";
// Import the new pivot hook and the existing thumbnail hook
import { useFetchAssetPivotData, useFetchAssetThumbnails } from './hooks'; 


// --- TYPE DEFINITIONS for Local Use (Must be defined in types.ts too) ---

// // Redefine AssetRowProps to use the single pivoted row
type PivotAssetRowProps = Readonly<{
  pivotRow: AssetReviewPivotRow; // The single row of pivoted data
  thumbnails: { [key: string]: string };
  dateTimeFormat: Intl.DateTimeFormat;
  isLastRow: boolean;
}>;

// Redefine RecordTableHeadProps to handle sorting state
type SortableRecordTableHeadProps = RecordTableHeadProps & {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  handleSort: (columnId: string) => void;
};
// --------------------------------------------------------------------------


// --- CONSTANTS (Remain the same) ---
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

// const APPROVAL_STATUS: { [key: string]: Status } = { /* ... omitted for brevity ... */ };
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
    color: '#b9eec9',
  },
};

// const WORK_STATUS: { [key: string]: Status } = { /* ... omitted for brevity ... */ };
const WORK_STATUS: { [key: string]: Status } = {
  check: {
    displayName: 'Check',
    color: '#e287f5',
  },
  cgsvOnHold: {
    displayName: 'CGSV On Hold',
    color: '#ffdd55',
  },
  svOnHold: {
    displayName: 'SV On Hold',
    color: '#ffe373',
  },
  leadOnHold: {
    displayName: 'Lead On Hold',
    color: '#fff04f',
  },
  cgsvRetake: {
    displayName: 'CGSV Retake',
    color: '#ff4f4f',
  },
  svRetake: {
    displayName: 'SV Retake',
    color: '#ff8080',
  },
  leadRetake: {
    displayName: 'Lead Retake',
    color: '#ffbbbb',
  },
  cgsvApproved: {
    displayName: 'CGSV Approved',
    color: '#5cda82',
  },
  svApproved: {
    displayName: 'SV Approved',
    color: '#83e29f',
  },
  leadApproved: {
    displayName: 'Lead Approved',
    color: '#b9eec9',
  },
  svOther: {
    displayName: 'SV Other',
    color: '#9a9a9a',
  },
  leadOther: {
    displayName: 'Lead Other',
    color: '#dbdbdb',
  },
  review: {
    displayName: 'Review',
    color: '#dbdbdb',
  },


};

// Columns array updated to use 'group_1' and pivot row IDs
const columns: Column[] = [
  {
    id: 'thumbnail',
    label: 'Thumbnail',
  },
  {
    id: 'group_1', // Use group_1 which holds the asset name in the pivot row
    label: 'Name',
  },
  {
    id: 'mdl_work_status',
    label: 'MDL WORK',
    colors: ASSET_PHASES['mdl'],
  },
  {
    id: 'mdl_approval_status',
    label: 'MDL APPR',
    colors: ASSET_PHASES['mdl'],
  },
  {
    id: 'mdl_submitted_at_utc', // Use the actual UTC field name for sorting
    label: 'MDL Submitted At',
    colors: ASSET_PHASES['mdl'],
  },
  // ... (RIG, BLD, DSN, LDV columns follow the same ID pattern) ...
  {
    id: 'rig_work_status',
    label: 'RIG WORK',
    colors: ASSET_PHASES['rig'],
  },
  {
    id: 'rig_approval_status',
    label: 'RIG APPR',
    colors: ASSET_PHASES['rig'],
  },
  {
    id: 'rig_submitted_at_utc',
    label: 'RIG Submitted At',
    colors: ASSET_PHASES['rig'],
  },
  {
    id: 'bld_work_status',
    label: 'BLD WORK',
    colors: ASSET_PHASES['bld'],
  },
  {
    id: 'bld_approval_status',
    label: 'BLD APPR',
    colors: ASSET_PHASES['bld'],
  },
  {
    id: 'bld_submitted_at_utc',
    label: 'BLD Submitted At',
    colors: ASSET_PHASES['bld'],
  },
  {
    id: 'dsn_work_status',
    label: 'DSN WORK',
    colors: ASSET_PHASES['dsn'],
  },
  {
    id: 'dsn_approval_status',
    label: 'DSN APPR',
    colors: ASSET_PHASES['dsn'],
  },
  {
    id: 'dsn_submitted_at_utc',
    label: 'DSN Submitted At',
    colors: ASSET_PHASES['dsn'],
  },
  {
    id: 'ldv_work_status',
    label: 'LDV WORK',
    colors: ASSET_PHASES['ldv'],
  },
  {
    id: 'ldv_approval_status',
    label: 'LDV APPR',
    colors: ASSET_PHASES['ldv'],
  },
  {
    id: 'ldv_submitted_at_utc',
    label: 'LDV Submitted At',
    colors: ASSET_PHASES['ldv'],
  },
  {
    id: 'relation',
    label: 'Relation',
  },
];


// --- UTILITY COMPONENTS (Remain the same) ---
type TooltipTableCellProps = {
  tooltipText: string,
  status: Status | undefined,
  leftBorderStyle: string,
  rightBorderStyle: string,
  bottomBorderStyle: string,
};

const MultiLineTooltipTableCell: React.FC<TooltipTableCellProps> = (
  { tooltipText, status, leftBorderStyle, rightBorderStyle, bottomBorderStyle = 'none' }
) => {
  const isTooltipTextEmpty = !tooltipText || tooltipText.trim() === '';
  const statusText = status ? status.displayName : '';

  return (
    <TableCell
      style={{
        color: (status != null) ? status['color'] : '',
        fontStyle: isTooltipTextEmpty ? 'normal' : 'oblique',
        borderLeft: leftBorderStyle,
        borderRight: rightBorderStyle,
        borderBottom: bottomBorderStyle,
      }}
    >
      {!isTooltipTextEmpty ? (
        <Tooltip
          title={
            <div
              style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
              {tooltipText}
            </div>
          }
          arrow
        >
          <span>{statusText}</span>
        </Tooltip>
      ) : (
        <span>{statusText}</span>
      )}
    </TableCell >
  );
};


// --- 1. RECORD TABLE HEAD (Sorting Implementation) ---
const RecordTableHead: React.FC<SortableRecordTableHeadProps> = ({
  columns,
  sortBy,
  sortOrder,
  handleSort,
}) => {
  return (
    <TableHead>
      <TableRow>
        {columns.map((column) => {
          const borderLineStyle = column.colors ? `solid 3px ${column.colors.lineColor}` : 'none';
          const borderTopStyle = column.colors ? borderLineStyle : 'none';
          const borderLeftStyle = (column.id.indexOf('work_status') !== -1 || column.id === 'group_1') ? borderLineStyle : 'none';
          const borderRightStyle = (column.id.indexOf('submitted_at_utc') !== -1 || column.id === 'relation') ? borderLineStyle : 'none';
          
          // Determine if the column is sortable (exclude thumbnail, include pivoted fields)
          const isSortable = column.id !== 'thumbnail' && !column.id.includes('review_comments');
          const isCurrentSort = column.id === sortBy;
          const sortIcon = isCurrentSort ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : '';

          return (
            <TableCell
              key={column.id}
              style={
                {
                  backgroundColor: column.colors ? column.colors.backgroundColor : 'none',
                  borderTop: borderTopStyle,
                  borderLeft: borderLeftStyle,
                  borderRight: borderRightStyle,
                  cursor: isSortable ? 'pointer' : 'default', // Add cursor
                }
              }
              // Attach the sorting handler
              onClick={isSortable ? () => handleSort(column.id) : undefined}
            >
              {column.label} {sortIcon}
            </TableCell>
          );
        })}
      </TableRow>
    </TableHead>
  );
};

// --- 2. ASSET ROW (Rendering Pivot Data) ---
const AssetRow: React.FC<PivotAssetRowProps> = ({
  pivotRow, thumbnails, dateTimeFormat, isLastRow
}) => {
    // Helper to pull status map based on value
    const getStatus = (value: string | null | undefined, type: 'work' | 'approval'): Status | undefined => {
        if (!value) return undefined;
        const statusMap = type === 'work' ? WORK_STATUS : APPROVAL_STATUS;
        console.log(`Getting status for value: ${value}, type: ${type}`); // Debug log
        return (statusMap[value])
    };

    const assetKey = `${pivotRow.group_1}-${pivotRow.relation}`;
    
    // We assume review_comments are returned as a single string field in the pivot row
    const getComments = (phase: string): string => {
        const key = `${phase}_review_comments` as keyof AssetReviewPivotRow;
        return (pivotRow[key] as string) || '';
    };

    return (
        <TableRow>
            {/* Thumbnail Cell */}
            <TableCell>
                {thumbnails[assetKey] ? (
                    <img
                        src={thumbnails[assetKey]}
                        alt={`${pivotRow.group_1} thumbnail`}
                        style={{ width: '100px', height: 'auto' }}
                    />
                ) : (
                    <span>No Thumbnail</span>
                )}
            </TableCell>
            
            {/* Name Cell */}
            <TableCell>{pivotRow.group_1}</TableCell>
            
            {/* Phase Cells (Pivoted Data) */}
            {Object.entries(ASSET_PHASES).map(([phase, { lineColor }]) => {
                const workStatusKey = getDataString(`${phase}_work_status`);
                const workStatus: Status | undefined = workStatusKey ? WORK_STATUS[workStatusKey] : undefined;
                // const workStatus: Status | undefined = getStatus(getDataString(`${phase}_work_status`), 'work');

                const approvalStatusKey = getDataString(`${phase}_approval_status`);
                const approvalStatus: Status | undefined = approvalStatusKey ? APPROVAL_STATUS[approvalStatusKey] : undefined;

                // const approvalStatus: Status | undefined = getStatus(getDataString(`${phase}_approval_status`), 'approval');
                const tooltipText: string = getComments(phase);
                
                const submittedAtUtc = getDataString(`${phase}_submitted_at_utc`);
                const submittedAt = submittedAtUtc ? new Date(submittedAtUtc) : null;
                const localTimeText = submittedAt ? dateTimeFormat.format(submittedAt) : '-';
                const borderLineStyle = `solid 3px ${lineColor}`;
                
                // Helper to safely access dynamic field from pivotRow
                function getDataString(key: string): string | null {
                    // console.log(`Getting data for key: ${key}`); // Debug log
                    return (pivotRow as any)[key] || null;
                }

                return (
                    <React.Fragment key={`${assetKey}-${phase}`}>
                        {/* Work Status */}
                        <MultiLineTooltipTableCell
                          tooltipText={tooltipText}
                          status={workStatus}
                          leftBorderStyle={borderLineStyle}
                          rightBorderStyle={'none'}
                          bottomBorderStyle={isLastRow ? borderLineStyle : 'none'}
                        />
                        <MultiLineTooltipTableCell
                          tooltipText={tooltipText}
                          status={approvalStatus}
                          leftBorderStyle={'none'}
                          rightBorderStyle={'none'}
                          bottomBorderStyle={isLastRow ? borderLineStyle : 'none'}
                        />
                        <TableCell
                          style={{
                            borderLeft: 'none',
                            borderRight: borderLineStyle,
                            borderBottom: isLastRow ? borderLineStyle : 'none',
                          }}
                        >
                            {localTimeText}
                        </TableCell>
                    </React.Fragment>
                );
            })}
            
            {/* Relation Cell */}
            <TableCell>{pivotRow.relation}</TableCell>
        </TableRow>
    );
};

// const AssetRow: React.FC<AssetRowProps> = ({
//   asset, reviewInfos, thumbnails, dateTimeFormat, isLastRow
// }) => {
//   return (
//     <TableRow>
//       <TableCell>
//         {thumbnails[`${asset.name}-${asset.relation}`] ? (
//           <img
//             src={thumbnails[`${asset.name}-${asset.relation}`]}
//             alt={`${asset.name} thumbnail`}
//             style={{ width: '100px', height: 'auto' }}
//           />
//         ) : (
//           <span>No Thumbnail</span>
//         )}
//       </TableCell>
//       <TableCell>{asset.name}</TableCell>
//       {Object.entries(ASSET_PHASES).map(([phase, { lineColor }]) => {
//         const reviewInfoName = `${asset.name}-${asset.relation}-${phase}`;
//         const info = reviewInfos[reviewInfoName];
        
//         const workStatus: Status | undefined = info && WORK_STATUS[info.work_status];
//         const approvalStatus: Status | undefined = info && APPROVAL_STATUS[info.approval_status];
//         const tooltipText: string = info && info.review_comments
//           .filter(reviewComment => reviewComment.text !== '')
//           .map(reviewComment => `${reviewComment.language}:\n${reviewComment.text}`)
//           .join('\n') || '';
//         const submittedAt = info ? new Date(info.submitted_at_utc) : null;
//         const localTimeText = submittedAt ? dateTimeFormat.format(submittedAt) : '-';
//         const borderLineStyle = `solid 3px ${lineColor}`;

//         return (
//           <React.Fragment key={`${reviewInfoName}-work-appr`}>
//             <MultiLineTooltipTableCell
//               tooltipText={tooltipText}
//               status={workStatus}
//               leftBorderStyle={borderLineStyle}
//               rightBorderStyle={'none'}
//               bottomBorderStyle={isLastRow ? borderLineStyle : 'none'}
//             />
//             <MultiLineTooltipTableCell
//               tooltipText={tooltipText}
//               status={approvalStatus}
//               leftBorderStyle={'none'}
//               rightBorderStyle={'none'}
//               bottomBorderStyle={isLastRow ? borderLineStyle : 'none'}
//             />
//             <TableCell
//               style={{
//                 borderLeft: 'none',
//                 borderRight: borderLineStyle,
//                 borderBottom: isLastRow ? borderLineStyle : 'none',
//               }}
//             >
//               {localTimeText}
//             </TableCell>
//           </React.Fragment>
//         );
//       })}
//       <TableCell>{asset.relation}</TableCell>
//     </TableRow>
//   );
// };

// --- 3. ASSETS DATA TABLE (Main Component) ---
const AssetsDataTable: React.FC<AssetsDataTableProps> = ({
  project,
  tableFooter,
  dateTimeFormat,
  // State props for the pivot API call
  currentPage,
  rowsPerPage,
  sortBy,
  sortOrder,
  relationFilter,
  handleSort, // Sorting handler
}) => {
  if (project == null) {
    return null;
  }
  
  // A. Fetch the Pivoted Data using the new hook
  // Assuming useFetchAssetPivotData is now defined in hooks.ts
  const { pivotRows, totalRows } = useFetchAssetPivotData(
    project,
    currentPage, 
    rowsPerPage,
    relationFilter, 
    sortBy, 
    sortOrder
  );

  // console.log("Pivot Data  ************:", pivotRows); // Debug log
  // console.log("Total Rows  ************:", totalRows); // Debug log

  // B. Prepare the asset list for the Thumbnail hook
  // The thumbnail hook is called once per row displayed
  const assetsForThumbnails = pivotRows.map(row => ({ 
      name: row.group_1, 
      relation: row.relation 
  }));
  
  // C. Fetch Thumbnails (Still per-asset for now)
  const { thumbnails } = useFetchAssetThumbnails(project, assetsForThumbnails);
  // NOTE: The old useFetchAssetReviewInfos is removed entirely, as its job is done by the pivot hook.

  return (
    <Table stickyHeader>
      <RecordTableHead
        columns={columns}
        // Pass sorting state and handler to the header
        sortBy={sortBy}
        sortOrder={sortOrder}
        handleSort={handleSort}
      />
      <TableBody>
        {pivotRows.map((pivotRow, index) => (
          <AssetRow
            key={`${pivotRow.group_1}-${pivotRow.relation}-${index}`}
            pivotRow={pivotRow} // Pass the single pivot row object
            thumbnails={thumbnails}
            dateTimeFormat={dateTimeFormat}
            isLastRow={(index === pivotRows.length - 1)}
          />
        ))}
      </TableBody>
      {/* totalRows should ideally be used in the tableFooter component for pagination metadata */}
      {tableFooter || null}
    </Table>
  );
};

export default AssetsDataTable;