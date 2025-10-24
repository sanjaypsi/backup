import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  TableSortLabel, // ADD TableSortLabel for sort arrows
} from "@material-ui/core";
import {
  AssetRowProps,
  AssetsDataTableProps,
  Colors,
  Column,
  RecordTableHeadProps,
  SortDir, // ADD SortDir
  AssetPhaseSummary, // ADD AssetPhaseSummary
} from "./types";
import {useFetchAssetThumbnails, useFetchAssetsPivot } from './hooks';
// import useFetchAssetReviewInfos if it exists
// import { useFetchAssetReviewInfos } from './hooks';


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
};

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
};

const columns: Column[] = [
  {
    id: 'thumbnail',
    label: 'Thumbnail',
  },
  {
    id: 'group_1_name',
    label: 'Name',
    sortable: true,
    sortKey: 'group_1',
  },
  {
    id: 'mdl_work_status',
    label: 'MDL WORK',
    colors: ASSET_PHASES['mdl'],
    sortable: true,
    sortKey: 'mdl_appr', // Match backend pivotSorters key
  },
  {
    id: 'mdl_approval_status',
    label: 'MDL APPR',
    colors: ASSET_PHASES['mdl'],
    sortable: true,
    sortKey: 'mdl_appr', // Match backend pivotSorters key
  },
  {
    id: 'mdl_submitted_at',
    label: 'MDL Submitted At',
    colors: ASSET_PHASES['mdl'],
    sortable: true,
    sortKey: 'mdl_submitted', // Match backend pivotSorters key
  },
  {
    id: 'rig_work_status',
    label: 'RIG WORK',
    colors: ASSET_PHASES['rig'],
    sortable: true,
    sortKey: 'rig_work',
  },
  {
    id: 'rig_approval_status',
    label: 'RIG APPR',
    colors: ASSET_PHASES['rig'],
    sortable: true,
    sortKey: 'rig_appr',
  },
  {
    id: 'rig_submitted_at',
    label: 'RIG Submitted At',
    colors: ASSET_PHASES['rig'],
    sortable: true,
    sortKey: 'rig_submitted',
  },
  {
    id: 'bld_work_status',
    label: 'BLD WORK',
    colors: ASSET_PHASES['bld'],
    sortable: true,
    sortKey: 'bld_work',
  },
  {
    id: 'bld_approval_status',
    label: 'BLD APPR',
    colors: ASSET_PHASES['bld'],
    sortable: true,
    sortKey: 'bld_submitted',
  },
  {
    id: 'bld_submitted_at',
    label: 'BLD Submitted At',
    colors: ASSET_PHASES['bld'],
  },
  {
    id: 'dsn_work_status',
    label: 'DSN WORK',
    colors: ASSET_PHASES['dsn'],
    sortable: true,
    sortKey: 'dsn_work',
  },
  {
    id: 'dsn_approval_status',
    label: 'DSN APPR',
    colors: ASSET_PHASES['dsn'],
    sortable: true,
    sortKey: 'dsn_appr',
  },
  {
    id: 'dsn_submitted_at',
    label: 'DSN Submitted At',
    colors: ASSET_PHASES['dsn'],
    sortable: true,
    sortKey: 'dsn_submitted',
  },
  {
    id: 'ldv_work_status',
    label: 'LDV WORK',
    colors: ASSET_PHASES['ldv'],
    sortable: true,
    sortKey: 'ldv_work',
  },
  {
    id: 'ldv_approval_status',
    label: 'LDV APPR',
    colors: ASSET_PHASES['ldv'],
    sortable: true,
    sortKey: 'ldv_appr',
  },
  {
    id: 'ldv_submitted_at',
    label: 'LDV Submitted At',
    colors: ASSET_PHASES['ldv'],
    sortable: true,
    sortKey: 'ldv_submitted',
  },
  {
    id: 'relation',
    label: 'Relation',
    sortable: true,
    sortKey: 'relation', // Match backend ListOrderedAssets key
  },
];

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
  const [open, setOpen] = React.useState(false);
  const isTooltipTextEmpty = tooltipText && tooltipText.trim().length > 0;

  const handleTooltipClose = () => {
    setOpen(false);
  };

  const handleTooltipOpen = () => {
    setOpen(true);
  };

  const statusText = (status != null) ? status['displayName'] : '-';

  return (
    <TableCell
      style={{
        color: (status != null) ? status['color'] : '',
        fontStyle: (tooltipText === '') ? 'normal' : 'oblique',
        borderLeft: leftBorderStyle,
        borderRight: rightBorderStyle,
        borderBottom: bottomBorderStyle,
      }}
      onClick={isTooltipTextEmpty ? handleTooltipOpen : undefined}
    >
      {isTooltipTextEmpty ? (
        <Tooltip
          title={
            <div
              style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
              {tooltipText}
            </div>
          }
          onClose={handleTooltipClose}
          open={open}
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

// Updated RecordTableHead to handle sorting
const RecordTableHead: React.FC<RecordTableHeadProps & {
  onSortChange: (sortKey: string) => void,
  currentSortKey: string,
}> = ({
  columns, onSortChange, currentSortKey,
}) => {
  // Determines if the column is sorted ascending, descending, or not at all.
  const getSortDir = (id: string, currentSortKey: string): SortDir => {
    if (currentSortKey === id) return 'asc';
    if (currentSortKey === `-${id}`) return 'desc';
    return 'none';
  };

  // Creates the handler that toggles between ASC, DESC, and (implicitly) back to ASC on next click
  const createSortHandler = (id: string) => () => {
    const isAsc = currentSortKey === id;
    const isDesc = currentSortKey === `-${id}`;
    
    let newSortKey = id; // Default to ASC
    if (isAsc) {
      newSortKey = `-${id}`; // Toggle to DESC
    } 
    // If it's DESC, the next click sets it back to ASC (id), which is the default.
    // If it's none, it sets it to ASC (id).

    onSortChange(newSortKey);
  };

  return (
    <TableHead>
      <TableRow>
        {columns.map((column) => {
          const borderLineStyle = column.colors ? `solid 3px ${column.colors.lineColor}` : 'none';
          const borderTopStyle = column.colors ? borderLineStyle : 'none';
          const borderLeftStyle = (column.id.indexOf('work_status') !== -1) ? borderLineStyle : 'none';
          const borderRightStyle = (column.id.indexOf('submitted_at') !== -1) ? borderLineStyle : 'none';
          
          const columnSortKey = column.sortKey || column.id;
          const sortDir = getSortDir(columnSortKey, currentSortKey);

          return (
            <TableCell
              key={column.id}
              style={
                {
                  backgroundColor: column.colors ? column.colors.backgroundColor : 'none',
                  borderTop: borderTopStyle,
                  borderLeft: borderLeftStyle,
                  borderRight: borderRightStyle,
                }
              }
            >
              {column.sortable ? (
                <TableSortLabel
                  active={sortDir !== 'none'}
                  // Material-UI direction prop must be 'asc' or 'desc'
                  direction={sortDir === 'desc' ? 'desc' : 'asc'} 
                  onClick={createSortHandler(columnSortKey)}
                >
                  {column.label}
                </TableSortLabel>
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

// Updated AssetRow to use AssetPhaseSummary
const AssetRow: React.FC<AssetRowProps> = ({
  asset, thumbnails, dateTimeFormat, isLastRow
}) => {
  // Helper to safely get value and status based on phase prefix
  const getPhaseData = (phase: string) => {
    const workStatusKey = `${phase}_work_status` as keyof AssetPhaseSummary;
    const approvalStatusKey = `${phase}_approval_status` as keyof AssetPhaseSummary;
    // Use the correct key for submitted_at (without _utc if that's how your data is structured)
    const submittedAtKey = `${phase}_submitted_at` as keyof AssetPhaseSummary;
    
    // NOTE: Review comments are not available in the current pivot payload. 
    // We assume the tooltipText remains empty for now.
    const tooltipText: string = ''; 

    const workStatusValue = asset[workStatusKey];
    const approvalStatusValue = asset[approvalStatusKey];
    const submittedAtValue = asset[submittedAtKey];

    // Safely look up status by converting field value to lowercase
    const workStatus: Status | undefined = workStatusValue ? WORK_STATUS[String(workStatusValue).toLowerCase()] : undefined;
    const approvalStatus: Status | undefined = approvalStatusValue ? APPROVAL_STATUS[String(approvalStatusValue).toLowerCase()] : undefined;
    
    const submittedAt = submittedAtValue ? new Date(submittedAtValue as string) : null;
    const localTimeText = submittedAt ? dateTimeFormat.format(submittedAt) : '-';

    return {
      workStatus, approvalStatus, submittedAt, localTimeText, tooltipText
    };
  };

  return (
    <TableRow>
      <TableCell>
        {thumbnails[`${asset.group_1}-${asset.relation}`] ? ( // Use group_1 as the asset name
          <img
            src={thumbnails[`${asset.group_1}-${asset.relation}`]}
            alt={`${asset.group_1} thumbnail`}
            style={{ width: '100px', height: 'auto' }}
          />
        ) : (
          <span>No Thumbnail</span>
        )}
      </TableCell>
      <TableCell>{asset.group_1}</TableCell>
      {Object.entries(ASSET_PHASES).map(([phase, { lineColor }]) => {
        const { workStatus, approvalStatus, localTimeText, tooltipText } = getPhaseData(phase);
        const borderLineStyle = `solid 3px ${lineColor}`;

        return (
          <React.Fragment key={`${asset.group_1}-${asset.relation}-${phase}-work-appr`}>
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
      <TableCell>{asset.relation}</TableCell>
    </TableRow>
  );
};

// Update AssetsDataTable to use the new hooks and props
const AssetsDataTable: React.FC<AssetsDataTableProps> = ({
  project,
  assets, // assets is now AssetPhaseSummary[]
  tableFooter,
  dateTimeFormat,
  onSortChange,
  currentSortKey,
}) => {
  if (project == null) {
    return null;
  }
  
  // Map AssetPhaseSummary to the expected Asset type { name, relation } for useFetchAssetThumbnails
  // const reviewAssets = assets.map(a => ({ name: a.group_1, relation: a.relation }));
  // const { reviewInfos } = useFetchAssetReviewInfos(project, reviewAssets); // REMOVE if hook does not exist

  // Fetch thumbnails for the assets
  const { thumbnails } = useFetchAssetThumbnails(project, assets.map(a => ({ name: a.group_1, relation: a.relation })));

  // Provide empty reviewInfos if not available
  const reviewInfos = {};

  return (
    <Table stickyHeader>
      <RecordTableHead
        key='asset-data-table-head'
        columns={columns}
        onSortChange={onSortChange}
        currentSortKey={currentSortKey}
      />
      <TableBody>
        {assets.map((asset, index) => (
          <AssetRow
            key={`${asset.group_1}-${asset.relation}-${index}`}
            asset={asset}
            reviewInfos={reviewInfos}
            thumbnails={thumbnails}
            dateTimeFormat={dateTimeFormat}
            isLastRow={index === assets.length - 1}
          />
        ))}
      </TableBody>
      {tableFooter || null}
    </Table>
  );
};

export default AssetsDataTable;
