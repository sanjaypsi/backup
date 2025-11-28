import React, { useEffect, useMemo, useState } from 'react';
import { queryPreference } from '../../pipeline-setting/api';
import { Project } from '../types';
import {
  Button,
  createStyles,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  makeStyles,
  Paper,
  Theme,
} from '@material-ui/core';
import { Category } from './types';
import AddIcon from '@material-ui/icons/Add';
import { createGroupCategory, deleteGroupCategory, updateGroupCategory } from './api';
import DeleteIcon from '@material-ui/icons/Delete';
import AddDialog from './GroupCategoryAddDialog';
import DeleteDialog from './GroupCategoryDeleteDialog';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    },

    headerRow: {
      display: 'flex',
      backgroundColor: theme.palette.background.paper,
      borderBottom: `1px solid ${theme.palette.divider}`,
      '& > div': {
        flex: 1,
        padding: theme.spacing(1),
        fontSize: 14,
        color: theme.palette.text.secondary,
        fontWeight: 500,
      },
    },

    // 🔹 3-column layout
    container: {
      width: '100%',
      height: '100%',
      backgroundColor: theme.palette.background.paper,
      display: 'grid',
      gridTemplateColumns: '125px 350px 1fr', // Roots | Tree | Right side
      columnGap: theme.spacing(0.5),
      overflow: 'hidden',
    },

    rootsColumn: {
      overflowY: 'auto',
      overflowX: 'hidden',
      marginLeft: theme.spacing(0.5),
    },

    treeColumn: {
      overflowY: 'auto',
      overflowX: 'hidden',
      borderLeft: `1px solid ${theme.palette.divider}`,
      paddingLeft: theme.spacing(1),
    },

    rightColumn: {
      overflowY: 'auto',
      overflowX: 'hidden',
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    },

    treeText: {
      fontFamily: 'monospace',
      fontSize: 14,
      whiteSpace: 'pre',
      margin: 0,
      padding: theme.spacing(0.1, 0),
      userSelect: 'text',
      color: theme.palette.text.primary,
    },

    treeRow: {
      display: 'grid',
      gridTemplateColumns: '16px auto', // arrow | text (no delete now)
      alignItems: 'center',
      columnGap: theme.spacing(0.5),
      // padding: theme.spacing(0.2, 0),
    },
  }),
);

type RootListProps = {
  project: Project,
  selected: string,
  setSelected: React.Dispatch<React.SetStateAction<string>>,
};

const RootList: React.FC<RootListProps> = ({
  project,
  selected,
  setSelected,
}) => {
  const [roots, setRoots] = useState<string[]>([]);

  useEffect(() => {
    if (roots.length !== 0) {
      setRoots([]);
      setSelected('');
    }

    const controller = new AbortController();

    (async () => {
      // The studio of the logged-in user cannot be determined because the authentication
      // feature has not been implemented yet.
      const studio = project.key_name == 'potoodev' ? 'ppidev' : 'ppi';

      const res: string[] | null = await queryPreference(
        'default',
        studio,
        project.key_name,
        '/ppip/roots',
        controller.signal,
      ).catch(err => {
        if (err.name === 'AbortError') {
          return;
        }
        console.error(err);
      });
      if (res != null) {
        setRoots(res);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [project]);

  const handlelistItemClick = (root: string) => {
    setSelected(root);
  };

  return (
    <List component="nav">
      {roots.map((root, index) => (
        <ListItem
          button
          selected={selected === root}
          key={index}
          onClick={() => handlelistItemClick(root)}
        >
          {root}
        </ListItem>
      ))}
    </List>
  );
};

type GroupCategoryListProps = {
  project: Project,
  root: string,
  selected: Category | null,
  setSelected: React.Dispatch<React.SetStateAction<Category | null>>,
  categories: Category[],
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>,
};

const GroupCategoryList: React.FC<GroupCategoryListProps> = ({
  project,
  root,
  selected,
  setSelected,
  categories,
  setCategories,
}) => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryTitles, setCategoryTitles] = useState<string[]>([]);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  useEffect(() => {
    if (categoryTitles.length !== 0) {
      setCategoryTitles([]);
    }

    const controller = new AbortController();

    (async () => {
      // The studio of the logged-in user cannot be determined because the authentication
      // feature has not been implemented yet.
      const studio = project.key_name == 'potoodev' ? 'ppidev' : 'ppi';

      const res: string[] | null = await queryPreference(
        'default',
        studio,
        project.key_name,
        `/ppip/roots/${root}/categories`,
        controller.signal,
      ).catch(err => {
        if (err.name === 'AbortError') {
          return;
        }
        console.error(err);
      });
      if (res != null) {
        setCategoryTitles(res);
      }
    })();

    return () => {
      controller.abort();
    };

  }, [root]);

  const handleListItemClick = (
    category: Category | null,
  ) => {
    setSelected(category);
  };

  const handleClickOpen = () => {
    setAddDialogOpen(true);
  };

  const handleAddDialogClose = () => {
    setAddDialogOpen(false);
  };

  const handleAddDialogAccept = (path: string) => {
    createGroupCategory(
      project.key_name,
      root,
      path,
    ).catch(err => {
      console.error(err);
    }).then(res => {
      if (res == null) {
        return;
      }
      setCategories([...categories, res]);
    });

    setAddDialogOpen(false);
  };

  const handleDeleteClick = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  const handleAcceptDeleteDialog = () => {
    if (categoryToDelete == null) {
      return;
    }
    deleteGroupCategory(
      project.key_name,
      categoryToDelete.id,
    ).catch(err => {
      console.error(err);
    }).then(() => {
      setCategories(categories.filter(c => c.id !== categoryToDelete.id));
    });
    setDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  return (
    <>
      <List component="nav">
        {categories.map(category => (
          <ListItem
            key={category.id}
            button
            selected={selected != null ? category == selected : false}
            onClick={() => handleListItemClick(category)}
          >
            <ListItemText primary={category.path} />
            {category.groups.length === 0 && (
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  aria-label="delete"
                  onClick={() => handleDeleteClick(category)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            )}
          </ListItem>
        ))}
        {categoryTitles.length !== 0 && (
          <ListItem button onClick={handleClickOpen}>
            <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
          </ListItem>
        )}
      </List>

      <AddDialog
        root={root}
        categoryTitles={categoryTitles}
        open={addDialogOpen}
        onClose={handleAddDialogClose}
        onAccept={handleAddDialogAccept}
      />

      {categoryToDelete != null && (
        <DeleteDialog
          category={categoryToDelete}
          open={deleteDialogOpen}
          onClose={handleCloseDeleteDialog}
          onAccept={handleAcceptDeleteDialog}
        />
      )}
    </>
  );
};

type GroupListProps = {
  project: Project,
  category: Category,
  onDelete: (category: Category) => void,
};

const GroupList: React.FC<GroupListProps> = ({ project, category, onDelete }) => {
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDeleteClick = (group: string) => {
    setGroupToDelete(group);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setGroupToDelete(null);
  };

  const handleAcceptDeleteDialog = () => {
    if (groupToDelete == null) {
      return;
    }
    updateGroupCategory(
      project.key_name,
      category.id,
      'remove',
      [groupToDelete],
    ).then(res => {
      if (res == null) {
        return;
      }
      onDelete(res);
    });
    setDeleteDialogOpen(false);
    setGroupToDelete(null);
  };

  return (
    <>
      <List component="nav">
        {category.groups.map(group =>
          <ListItem key={group} button >
            {group}
            <ListItemSecondaryAction>
              <IconButton
                edge="end"
                aria-label="delete"
                onClick={() => handleDeleteClick(group)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        )}
      </List>
      {groupToDelete != null && (
        <Dialog open={deleteDialogOpen} aria-labelledby="delete-dialog-title">
          <DialogTitle id="delete-dialog-title">Delete Group</DialogTitle>
          <DialogContent>
            <DialogContentText>Group: {groupToDelete}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
            <Button onClick={handleAcceptDeleteDialog} color="secondary">Accept</Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};

// --------- NEW: read-only tree view built from categories + groups ----------
type TreeNode = {
  name: string,
  fullPath: string,
  children: TreeNode[],
  isGroup: boolean,
  category?: Category,
};

type GroupCategoryTreeProps = {
  categories: Category[],
  onRemoveGroup?: (category: Category, groupPath: string) => void,
};

const buildTreeFromCategories = (categories: Category[]): TreeNode[] => {
  type MapNode = { 
    node: TreeNode,
    children: Record<string, MapNode>,
  };

  const root: Record<string, MapNode> = {};

  const getOrCreate =(
    map: Record<string, MapNode>, 
    name: string, 
    fullPath: string, 
    isGroup: boolean,
    category?: Category,
  ): MapNode => {
    if (!map[name]) {
      map[name] = {
        node: { name, fullPath, children: [], isGroup, category },
        children: {},
      };
    } else if (isGroup) {
      // mark existing node as group if needed
      map[name].node.isGroup = true;
      map[name].node.category = category;
    }
    return map[name];
  };

  // Build the tree structure
  categories.forEach(category => {
    const pathParts = category.path.split('/').filter(Boolean);
    let current = root;
    let fullPath = '';
    pathParts.forEach((part, idx) => {
      fullPath += (idx === 0 ? '' : '/') + part;
      current = getOrCreate(current, part, fullPath, false).children;
    });
    // Attach groups as children
    category.groups.forEach(groupPath => {
      const groupParts = groupPath.split('/').filter(Boolean);
      let groupCurrent = current;
      let groupFullPath = category.path;
      groupParts.forEach((groupPart, idx) => {
        groupFullPath += '/' + groupPart;
        groupCurrent = getOrCreate(groupCurrent, groupPart, groupFullPath, idx === groupParts.length - 1, category).children;
      });
    });
  });

  // Convert MapNode tree to TreeNode[]
  const mapNodeToTreeNode = (map: Record<string, MapNode>): TreeNode[] => {
    return Object.values(map).map(({ node, children }) => ({
      ...node,
      children: mapNodeToTreeNode(children),
    }));
  };

  return mapNodeToTreeNode(root);
};

// Component to render the tree
const GroupCategoryTree: React.FC<GroupCategoryTreeProps> = ({
  categories,
  onRemoveGroup,
}) => {
  const classes = useStyles();

  const tree = useMemo(
    () => buildTreeFromCategories(categories),
    [categories],
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleNode = (fullPath: string) => {
    setCollapsed(prev => ({
      ...prev,
      [fullPath]: !prev[fullPath],
    }));
  };

  // Recursive function to render tree nodes with ASCII prefixes
  const renderNodes = (
    nodes: TreeNode[],
    depth = 0,
    isLastArray: boolean[] = [],
  ): React.ReactNode =>
    nodes.map((node, index) => {
      const isLast = index === nodes.length - 1;
      const thisIsLastArray = [...isLastArray, isLast];

      // Build ASCII prefix – your existing logic
      let prefix = '';
      if (depth > 0) {
        for (let i = 0; i < depth - 1; i++) {
          const isRootColumn = i === 0;
          if (isRootColumn) {
            prefix += '   ';
          } else {
            prefix += thisIsLastArray[i] ? '   ' : '│  ';
          }
        }
        prefix += isLast ? '└─ ' : '├─ ';
      }

      const isLeafGroup =
        node.isGroup &&
        node.category &&
        (!node.children || node.children.length === 0);

      const hasChildren = node.children && node.children.length > 0;
      const isCollapsed = !!collapsed[node.fullPath];

      return (
        <React.Fragment key={node.fullPath}>
          <div className={classes.treeRow}>
            {/* column 1: + / - toggle */}
            <span
              style={{
                cursor: hasChildren ? 'pointer' : 'default',
                userSelect: 'none',
              }}
              onClick={() => hasChildren && toggleNode(node.fullPath)}
            >
            {hasChildren ? (isCollapsed ? '▶' : '▼') : ''}
            </span>

            {/* column 2: ASCII tree text */}
            <span
              className={classes.treeText}
              style={{ fontWeight: depth === 0 ? 'bold' : 'normal',
              paddingLeft: hasChildren ? 0 : 16
               }}
            >
              {prefix}
              {node.name}

            </span>

          </div>

          {/* children: render ONLY when not collapsed */}
          {!isCollapsed &&
            renderNodes(node.children, depth + 1, thisIsLastArray)}
        </React.Fragment>
      );
    });

  // Return the rendered tree
  return <div>{renderNodes(tree)}</div>;
};

// --------------------------------------------------------------------------
type GroupCategoryLocationProps = {
  project?: Project | null,
  root: string,
  setRoot: React.Dispatch<React.SetStateAction<string>>,
  categories: Category[],
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>,
};

const GroupCategoryLocation: React.FC<GroupCategoryLocationProps> = ({
  project,
  root,
  setRoot,
  categories,
  setCategories,
}) => {
  const classes = useStyles();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  
  const handleDeleteGroup = (target: Category) => {
    setCategories(
      categories.map(c => c.id === target.id ? target : c),
    );
  };

  // Handler to remove a group from a category
  const handleRemoveGroup = (category: Category, groupPath: string) => {
    if (!project) {
      return;
    }
    updateGroupCategory(
      project.key_name,
      category.id,
      'remove',
      [groupPath],
    ).then(res => {
      if (res == null) {
        return;
      }
      setCategories(
        categories.map(c => c.id === res.id ? res : c),
      );
    }).catch(err => {
      console.error(err);
    });
  };

  useEffect(() => {
    if (selectedCategory == null) {
      return;
    }
    for (const category of categories) {
      if (category.id === selectedCategory.id) {
        setSelectedCategory(category);
        return;
      }
    }
    setSelectedCategory(null);
  }, [categories]);

  return (
    <Paper className={classes.root}>
      {project != null && (
        <>
          {/* Header row for the tree view next to roots - Added New SanjayK -PSI */}
          <div className={classes.headerRow}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "150px 1fr",
                columnGap: "16px",
              }}
            >
              <div>Groups</div>
              {/* right header: Tree / list toggle view */}
              <div
                style={{
                  display: "flex",
                  gap: 24,
                }}
              >
                <span
                  onClick={() => setViewMode("tree")}
                  style={{
                    cursor: "pointer",
                    fontWeight: viewMode === "tree" ? "bold" : "normal",
                    textAlign: "right",
                  }}
                >
                  Tree View
                </span>
                <span
                  onClick={() => setViewMode("list")}
                  style={{
                    cursor: "pointer",
                    fontWeight: viewMode === "list" ? "bold" : "normal",
                    textAlign: "right",
                  }}
                >
                  List View
                </span>
              </div>
            </div>
          </div>
          {/* Content area */}
          <div className={classes.container}>
            <div className={classes.rootsColumn}>
              <RootList project={project} selected={root} setSelected={setRoot} />
            </div>

            <div className={classes.treeColumn}>
              {root !== "" && (
                <>
                  {viewMode === 'tree' && (
                    <div style={{ paddingLeft: "50px", overflow: 'auto' }}>
                    <GroupCategoryTree 
                    categories={categories} 
                    onRemoveGroup={handleRemoveGroup} // pass down the handler remove group
                    />
                    </div>
                  )}
                  {viewMode === 'list' && (
                    <div style={{ paddingLeft: "50px", overflow: 'auto' }}>
                    <GroupCategoryList 
                      project={project}
                      root={root}
                      selected={selectedCategory}
                      setSelected={setSelectedCategory}
                      categories={categories}
                      setCategories={setCategories}
                    />
                    </div>
                  )}
                </>
              )}
            </div>
            <div className={classes.rightColumn}>
              {selectedCategory != null && (
                <GroupList
                  project={project}
                  category={selectedCategory}
                  onDelete={handleDeleteGroup}
                />
              )}
            </div>
          </div>
        </>
      )}
    </Paper>
  );
};

export default GroupCategoryLocation;
