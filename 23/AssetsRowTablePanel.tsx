/* ──────────────────────────────────────────────────────────────────────────
  Module Name:
    AssetsRowTablePanel.tsx

  Module Description:
    "Assets Row" page mock UI:
      - Dark theme table
      - Two modes:
          1) List  : flat rows (NO group header rows)
          2) Group : group header rows inside the table (like your screenshot)
      - No extra "MDL / RIG / ..." top header row
      - Workflow columns have "box" borders per group (MDL/RIG/BLD/DSN/LDV)
─────────────────────────────────────────────────────────────────────────── */

import React from 'react';
import {
  Box,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  TextField,
  IconButton,
  styled,
} from '@material-ui/core';

import MenuIcon from '@material-ui/icons/Menu';
import ViewModuleIcon from '@material-ui/icons/ViewModule';
import ViewListIcon from '@material-ui/icons/ViewList';
import FilterListIcon from '@material-ui/icons/FilterList';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';

// ─────────────────────────────────────────────────────────────────────────────
// Theme constants

const BG = '#1e1e1e';
const PANEL = '#252525';
const HEADER_BG = '#2d2d2d';
const TEXT = '#ffffff';
const TEXT_DIM = '#b0b0b0';
const GRID = 'rgba(255,255,255,0.06)';
const ACCENT = '#00b7ff';

const GROUP_BORDER = 'rgba(255,255,255,0.28)'; // box border color for workflow groups

// ─────────────────────────────────────────────────────────────────────────────
// Styled Components

const Root = styled(Container)(({ theme }) => ({
  position: 'relative',
  padding: 0,
  backgroundColor: BG,
  minHeight: '100vh',
  '& > *': {
    padding: theme.spacing(1),
  },
}));

const Toolbar = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: HEADER_BG,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  padding: theme.spacing(1),
  height: 48,
  boxSizing: 'border-box',
}));

const TableWrap = styled(Paper)({
  width: '100%',
  overflowX: 'auto',
  backgroundColor: BG,
  borderRadius: 0,
  boxShadow: 'none',
});

const HeaderCell = styled(TableCell)({
  fontWeight: 700,
  textTransform: 'uppercase',
  fontSize: 12,
  letterSpacing: 0.1,
  whiteSpace: 'nowrap',
  padding: '8px 10px',
  backgroundColor: `${HEADER_BG} !important`,
  color: TEXT,
  borderBottom: '1px solid rgba(255,255,255,0.14)',
});

const DataCell = styled(TableCell)({
  color: TEXT_DIM,
  padding: '8px 10px',
  fontSize: 12,
  borderBottom: `1px solid ${GRID}`,
  height: 44,
  boxSizing: 'border-box',
  verticalAlign: 'middle',
  paddingLeft: 25,
});

const Thumb = styled('div')({
  width: 50,
  height: 25,
  borderRadius: 2,
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.18)',
  flex: '0 0 auto',
  marginLeft: 20,
});

const NameCellRow = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: 10, // gap between thumbnail and name
  marginLeft: 20,
});

const GroupNameRow = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontWeight: 800,
  letterSpacing: 0.3,
  color: ACCENT,
});

// ─────────────────────────────────────────────────────────────────────────────
// Types & Data

type WorkflowKey =
  | 'mdl_work' | 'mdl_appr' | 'mdl_submitted'
  | 'rig_work' | 'rig_appr' | 'rig_submitted'
  | 'bld_work' | 'bld_appr' | 'bld_submitted'
  | 'dsn_work' | 'dsn_appr' | 'dsn_submitted'
  | 'ldv_work' | 'ldv_appr' | 'ldv_submitted';

type ColumnId = 'thumbnail' | 'name' | WorkflowKey | 'relation';

type AssetRow = {
  id: string;
  name: string;
  relation: string;
} & Record<WorkflowKey, string>;

type GroupRow = {
  id: string;
  label: string;
  assets: AssetRow[];
};

const HEADER_COLUMNS: Array<{ id: ColumnId; label: string; minWidth: number }> = [
  { id: 'thumbnail', label: 'Thumbe', minWidth: 100 },
  { id: 'name', label: 'Name', minWidth: 150 },

  { id: 'mdl_work', label: 'MDL Work', minWidth: 85 },
  { id: 'mdl_appr', label: 'MDL Appr', minWidth: 85 },
  { id: 'mdl_submitted', label: 'MDL Submitted At', minWidth: 110 },

  { id: 'rig_work', label: 'RIG Work', minWidth: 85 },
  { id: 'rig_appr', label: 'RIG Appr', minWidth: 85 },
  { id: 'rig_submitted', label: 'RIG Submitted At', minWidth: 110 },

  { id: 'bld_work', label: 'BLD Work', minWidth: 85 },
  { id: 'bld_appr', label: 'BLD Appr', minWidth: 85 },
  { id: 'bld_submitted', label: 'BLD Submitted At', minWidth: 110 },

  { id: 'dsn_work', label: 'DSN Work', minWidth: 85 },
  { id: 'dsn_appr', label: 'DSN Appr', minWidth: 85 },
  { id: 'dsn_submitted', label: 'DSN Submitted At', minWidth: 110 },

  { id: 'ldv_work', label: 'LDV Work', minWidth: 85 },
  { id: 'ldv_appr', label: 'LDV Appr', minWidth: 85 },
  { id: 'ldv_submitted', label: 'LDV Submitted At', minWidth: 110 },

  { id: 'relation', label: 'Relation', minWidth: 70 },
];

const generateMockData = (id: string, name: string): AssetRow => ({
  id,
  name,
  mdl_work: Math.random() > 0.5 ? 'In Progress' : 'Done',
  mdl_appr: Math.random() > 0.5 ? 'Pending' : 'Approved',
  mdl_submitted: '2023-11-20',

  rig_work: 'In Progress',
  rig_appr: '—',
  rig_submitted: '—',

  bld_work: 'Waiting',
  bld_appr: '—',
  bld_submitted: '—',

  dsn_work: 'Done',
  dsn_appr: 'Approved',
  dsn_submitted: '2023-10-15',

  ldv_work: '—',
  ldv_appr: '—',
  ldv_submitted: '—',

  relation: 'Master',
});

const MOCK_GROUPS: GroupRow[] = [
  {
    id: 'camera',
    label: 'CAMERA',
    assets: [
      generateMockData('camAim', 'camAim'),
      generateMockData('camHero', 'camHero'),
      generateMockData('camWide', 'camWide'),
    ],
  },
  {
    id: 'character',
    label: 'CHARACTER',
    assets: [
      generateMockData('ando', 'ando'),
      generateMockData('baseFemale', 'baseFemale'),
      generateMockData('baseMale', 'baseMale'),
      generateMockData('chris', 'chris'),
    ],
  },
  {
    id: 'fx',
    label: 'FX',
    assets: [generateMockData('fx_smoke', 'fx_smoke')],
  },
  {
    id: 'other',
    label: 'OTHER',
    assets: [generateMockData('env_prop', 'env_prop')],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Workflow "box" borders per group

const WORKFLOW_GROUPS = [
  { id: 'MDL', start: 'mdl_work', end: 'mdl_submitted' },
  { id: 'RIG', start: 'rig_work', end: 'rig_submitted' },
  { id: 'BLD', start: 'bld_work', end: 'bld_submitted' },
  { id: 'DSN', start: 'dsn_work', end: 'dsn_submitted' },
  { id: 'LDV', start: 'ldv_work', end: 'ldv_submitted' },
] as const;

const workflowStartCols = new Set<string>(WORKFLOW_GROUPS.map((g) => g.start));
const workflowEndCols = new Set<string>(WORKFLOW_GROUPS.map((g) => g.end));
const workflowCols = new Set<string>(
  WORKFLOW_GROUPS.flatMap((g) => {
    const keys: string[] = [];
    const prefix = g.start.split('_')[0]; // mdl, rig, ...
    keys.push(`${prefix}_work`, `${prefix}_appr`, `${prefix}_submitted`);
    return keys;
  })
);

const getWorkflowBoxStyle = (colId: ColumnId): React.CSSProperties => {
  if (!workflowCols.has(colId)) return {};
  return {
    borderLeft: workflowStartCols.has(colId) ? `2px solid ${GROUP_BORDER}` : undefined,
    borderRight: workflowEndCols.has(colId) ? `2px solid ${GROUP_BORDER}` : undefined,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Component

const AssetsRowTablePanel: React.FC = () => {
  const [search, setSearch] = React.useState('');
  const [barView, setBarView] = React.useState<'list' | 'group'>('group');

  // Used only in group mode
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({
    camera: true,
    character: true,
    fx: true,
    other: true,
  });

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredGroups = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MOCK_GROUPS;

    return MOCK_GROUPS.map((g) => ({
      ...g,
      assets: g.assets.filter((a) => a.name.toLowerCase().includes(q)),
    })).filter((g) => g.assets.length > 0);
  }, [search]);

  const flatRows = React.useMemo(() => {
    // list mode should be flat (no group headers)
    return filteredGroups.flatMap((g) => g.assets);
  }, [filteredGroups]);

  return (
    <Root maxWidth={false}>
      <Box>
        <Toolbar>
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <IconButton onClick={() => setBarView('list')} style={{ padding: 6 }}>
              <ViewListIcon style={{ fontSize: 18, color: barView === 'list' ? ACCENT : TEXT_DIM }} />
            </IconButton>
            <IconButton onClick={() => setBarView('group')} style={{ padding: 6 }}>
              <ViewModuleIcon style={{ fontSize: 18, color: barView === 'group' ? ACCENT : TEXT_DIM }} />
            </IconButton>

            <Typography variant="subtitle2" style={{ color: TEXT, marginLeft: 8, fontWeight: 700 }}>
              Assets Row Table
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <TextField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Assets..."
              variant="outlined"
              InputProps={{
                style: { height: 30, color: TEXT, fontSize: 12, backgroundColor: '#3a3a3a' },
              }}
              style={{ width: 220 }}
            />
            <IconButton style={{ padding: 6 }}>
              <FilterListIcon style={{ fontSize: 18, color: TEXT_DIM }} />
            </IconButton>
            <IconButton style={{ padding: 6 }}>
              <MenuIcon style={{ fontSize: 18, color: TEXT_DIM }} />
            </IconButton>
          </Box>
        </Toolbar>

        <TableWrap>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {HEADER_COLUMNS.map((c) => (
                  <HeaderCell
                    key={c.id}
                    style={{
                      minWidth: c.minWidth,
                      ...getWorkflowBoxStyle(c.id),
                      // a little stronger divider after NAME like your screenshot
                      borderRight: c.id === 'name' ? `2px solid ${GROUP_BORDER}` : undefined,
                    }}
                  >
                    {c.label}
                  </HeaderCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {barView === 'list' && (
                <>
                  {flatRows.map((asset) => (
                    <TableRow key={asset.id} hover>
                      {HEADER_COLUMNS.map((col) => {
                        const v = (asset as any)[col.id] as string | undefined;
                        const isThumb = col.id === 'thumbnail';
                        const isName = col.id === 'name';

                        return (
                          <DataCell
                            key={col.id}
                            style={{
                              ...getWorkflowBoxStyle(col.id),
                              borderRight: col.id === 'name' ? `2px solid ${GROUP_BORDER}` : undefined,
                            }}
                          >
                            {isThumb ? (
                              <Thumb />
                            ) : isName ? (
                              <NameCellRow>
                                <span style={{ color: TEXT, fontWeight: 600 }}>{asset.name}</span>
                              </NameCellRow>
                            ) : v === '—' || v === undefined ? (
                              <span style={{ opacity: 0.3 }}>—</span>
                            ) : (
                              v
                            )}
                          </DataCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </>
              )}

              {barView === 'group' && (
                <>
                  {filteredGroups.map((group) => {
                    const isOpen = !!openGroups[group.id];

                    return (
                      <React.Fragment key={group.id}>
                        {/* Group header row inside the table */}
                        <TableRow>
                          {/* THUMB column */}
                          <DataCell
                            style={{
                              padding: '6px 8px',
                              background: BG,
                              borderBottom: `2px solid rgba(255,255,255,0.10)`,
                            }}
                          >
                            <IconButton
                              onClick={() => toggleGroup(group.id)}
                              style={{ padding: 4 }}
                              aria-label="toggle group"
                            >
                              {isOpen ? (
                                <ExpandLessIcon style={{ color: TEXT_DIM, fontSize: 18 }} />
                              ) : (
                                <ExpandMoreIcon style={{ color: TEXT_DIM, fontSize: 18 }} />
                              )}
                            </IconButton>
                          </DataCell>

                          {/* NAME column */}
                          <DataCell
                            // style={{
                            //   background: PANEL,
                            //   borderBottom: `1px solid rgba(255,255,255,0.10)`,
                            //   borderRight: `2px solid ${GROUP_BORDER}`,
                            //   paddingLeft: 6,
                            // }}
                          >
                            <div style={{ display: 'flex', alignItems: 'left', marginLeft: -100 }}>
                              <span style={{ color: ACCENT, fontWeight: 800 }}>{group.label}</span>
                              {/* <span style={{ marginLeft: 8, color: TEXT_DIM, fontSize: 11 }}>({group.assets.length})</span> */}
                            </div>
                          </DataCell>

                          {/* Remaining columns: render as group spans to avoid extra inner vertical lines */}
                          {WORKFLOW_GROUPS.map((g) => (
                            <DataCell
                              key={g.id}
                              colSpan={3}
                              // style={{
                              //   background: PANEL,
                              //   borderBottom: `1px solid rgba(255,255,255,0.10)`,
                              //   borderLeft: `2px solid ${GROUP_BORDER}`,
                              //   borderRight: `2px solid ${GROUP_BORDER}`,
                              // }}
                            />
                          ))}
                          <DataCell
                            style={{
                              background: PANEL,
                              borderBottom: `2px solid rgba(255,255,255,0.10)`,
                            }}
                          />
                        </TableRow>

                        {/* Group assets */}
                        {isOpen &&
                          group.assets.map((asset) => (
                            <TableRow key={asset.id} hover>
                              {HEADER_COLUMNS.map((col) => {
                                const v = (asset as any)[col.id] as string | undefined;
                                const isThumb = col.id === 'thumbnail';
                                const isName = col.id === 'name';

                                return (
                                  <DataCell
                                    key={col.id}
                                    style={{
                                      ...getWorkflowBoxStyle(col.id),
                                      borderRight: col.id === 'name' ? `2px solid ${GROUP_BORDER}` : undefined,
                                    }}
                                  >
                                    {isThumb ? (
                                      <Thumb />
                                    ) : isName ? (
                                      <NameCellRow>
                                        <span style={{ color: TEXT, fontWeight: 600 }}>{asset.name}</span>
                                      </NameCellRow>
                                    ) : v === '—' || v === undefined ? (
                                      <span style={{ opacity: 0.3 }}>—</span>
                                    ) : (
                                      v
                                    )}
                                  </DataCell>
                                );
                              })}
                            </TableRow>
                          ))}
                      </React.Fragment>
                    );
                  })}
                </>
              )}

              {/* Empty state */}
              {barView === 'list' && flatRows.length === 0 && (
                <TableRow>
                  <DataCell colSpan={HEADER_COLUMNS.length} style={{ color: TEXT_DIM }}>
                    No assets found.
                  </DataCell>
                </TableRow>
              )}
              {barView === 'group' && filteredGroups.length === 0 && (
                <TableRow>
                  <DataCell colSpan={HEADER_COLUMNS.length} style={{ color: TEXT_DIM }}>
                    No assets found.
                  </DataCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableWrap>
      </Box>
    </Root>
  );
};

export default AssetsRowTablePanel;
