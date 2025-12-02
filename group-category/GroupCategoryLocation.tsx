import React, { useEffect, useMemo, useState } from 'react';
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
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';

import { queryPreference } from '../../pipeline-setting/api';
import { Project } from '../types';
import { Category } from './types';
import { createGroupCategory, deleteGroupCategory, updateGroupCategory } from './api';
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

    container: {
      width: '100%',
      height: '100%',
      backgroundColor: theme.palette.background.paper,
      display: 'grid',
      gridTemplateColumns: '125px 350px 1fr', // Roots | Tree/List | Groups
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
      paddingLeft: theme.spacing(0.1),
    },

    rightColumn: {
      overflowY: 'auto',
      overflowX: 'hidden',
      paddingLeft: theme.spacing(0.5),
      paddingRight: theme.spacing(0.5),
    },

    treeText: {
      fontFamily: 'monospace',
      fontSize: 14,
      whiteSpace: 'pre',
      margin: 0,
      padding: theme.spacing(0.25, 0.1),
      userSelect: 'text',
      color: theme.palette.text.primary,
    },

    selectedTreeRow: {
      backgroundColor: theme.palette.action.selected,
      borderRadius: theme.shape.borderRadius,
    },

    treeRow: {
      display: 'grid',
      gridTemplateColumns: '12px auto', // arrow | text
      alignItems: 'center',
      columnGap: theme.spacing(0.5),
      cursor: 'pointer',
    },
  }),
);

// -----------------------------------------------------------------------------
// Root list (left column)
// -----------------------------------------------------------------------------
type RootListProps = {
  project: Project;
  selected: string;
  setSelected: React.Dispatch<React.SetStateAction<string>>;
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
      const studio = project.key_name === 'potoodev' ? 'ppidev' : 'ppi';

      const res: string[] | null = await queryPreference(
        'default',
        studio,
        project.key_name,
        '/ppip/roots',
        controller.signal,
      ).catch(err => {
        if (err.name === 'AbortError') {
          return null;
        }
        console.error(err);
        return null;
      });

      if (res != null) {
        setRoots(res);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [project]);

  const handleListItemClick = (root: string) => {
    setSelected(root);
  };

  return (
    <List component="nav">
      {roots.map((root, index) => (
        <ListItem
          button
          selected={selected === root}
          key={index}
          onClick={() => handleListItemClick(root)}
        >
          {root}
        </ListItem>
      ))}
    </List>
  );
};

// -----------------------------------------------------------------------------
// Middle column – category list (List View)
// -----------------------------------------------------------------------------
type GroupCategoryListProps = {
  project: Project;
  root: string;
  selected: Category | null;
  setSelected: React.Dispatch<React.SetStateAction<Category | null>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  setSelectedPath?: (path: string | null) => void;
};

const GroupCategoryList: React.FC<GroupCategoryListProps> = ({
  project,
  root,
  selected,
  setSelected,
  categories,
  setCategories,
  setSelectedPath,
}) => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryTitles, setCategoryTitles] = useState<string[]>([]);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(
    null,
  );

  useEffect(() => {
    if (categoryTitles.length !== 0) {
      setCategoryTitles([]);
    }

    const controller = new AbortController();

    (async () => {
      const studio = project.key_name === 'potoodev' ? 'ppidev' : 'ppi';

      const res: string[] | null = await queryPreference(
        'default',
        studio,
        project.key_name,
        `/ppip/roots/${root}/categories`,
        controller.signal,
      ).catch(err => {
        if (err.name === 'AbortError') {
          return null;
        }
        console.error(err);
        return null;
      });

      if (res != null) {
        setCategoryTitles(res);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [root]);

  const handleListItemClick = (category: Category | null) => {
    setSelected(category);
    if (setSelectedPath) {
      setSelectedPath(category ? category.path : null); // root of category
    }
  };

  const handleClickOpen = () => setAddDialogOpen(true);
  const handleAddDialogClose = () => setAddDialogOpen(false);

  const handleAddDialogAccept = (path: string) => {
    createGroupCategory(project.key_name, root, path)
      .catch(err => {
        console.error(err);
        return null;
      })
      .then(res => {
        if (res == null) return;
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
    if (categoryToDelete == null) return;

    deleteGroupCategory(project.key_name, categoryToDelete.id)
      .catch(err => {
        console.error(err);
      })
      .then(() => {
        setCategories(
          categories.filter(c => c.id !== categoryToDelete.id),
        );
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
            selected={selected != null ? category === selected : false}
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
            <ListItemIcon>
              <AddIcon fontSize="small" />
            </ListItemIcon>
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

// -----------------------------------------------------------------------------
// Right column – groups list (filtered by selectedPath)
// -----------------------------------------------------------------------------
type GroupListProps = {
  project: Project;
  category: Category;
  onDelete: (category: Category) => void;
  selectedPath?: string | null;
};

const GroupList: React.FC<GroupListProps> = ({
  project,
  category,
  onDelete,
  selectedPath,
}) => {
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const groupsToShow = useMemo(() => {
    if (!selectedPath || !selectedPath.startsWith(category.path)) {
      // nothing specific selected under this category → show all
      return category.groups;
    }

    if (selectedPath === category.path) {
      // clicked the category root
      return category.groups;
    }

    // relative path under the category
    const rel = selectedPath.slice(category.path.length + 1); // remove "category/"
    if (!rel) return category.groups;

    return category.groups.filter(g => {
      if (g === rel) return true; // clicked leaf → show only that group
      return g.startsWith(rel + '/'); // clicked folder → all groups beneath
    });
  }, [category, selectedPath]);

  const handleDeleteClick = (group: string) => {
    setGroupToDelete(group);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setGroupToDelete(null);
  };

  const handleAcceptDeleteDialog = () => {
    if (groupToDelete == null) return;

    updateGroupCategory(
      project.key_name,
      category.id,
      'remove',
      [groupToDelete],
    )
      .then(res => {
        if (res == null) return;
        onDelete(res);
      })
      .catch(err => {
        console.error(err);
      });

    setDeleteDialogOpen(false);
    setGroupToDelete(null);
  };

  return (
    <>
      <List component="nav">
        {groupsToShow.map(group => (
          <ListItem key={group} button>
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
        ))}
      </List>

      {groupToDelete != null && (
        <Dialog open={deleteDialogOpen} aria-labelledby="delete-dialog-title">
          <DialogTitle id="delete-dialog-title">Delete Group</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Group: {groupToDelete}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
            <Button onClick={handleAcceptDeleteDialog} color="secondary">
              Accept
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};

// -----------------------------------------------------------------------------
// Tree view (middle column – Tree mode)
// -----------------------------------------------------------------------------
type TreeNode = {
  name: string;
  fullPath: string;
  children: TreeNode[];
};

type GroupCategoryTreeProps = {
  categories: Category[];
  onRemoveGroup?: (category: Category, groupPath: string) => void;
  onSelectNode?: (category: Category, fullPath: string) => void;
  selectedPath?: string | null;
};

const buildTreeFromCategories = (categories: Category[]): TreeNode[] => {
  type MapNode = {
    node: TreeNode;
    children: Record<string, MapNode>;
  };

  const root: Record<string, MapNode> = {};

  const getOrCreate = (
    map: Record<string, MapNode>,
    name: string,
    fullPath: string,
  ): MapNode => {
    if (!map[name]) {
      map[name] = {
        node: { name, fullPath, children: [] },
        children: {},
      };
    }
    return map[name];
  };

  categories.forEach(category => {
    // category path (e.g. "sample/testAsset")
    const pathParts = category.path.split('/').filter(Boolean);
    let current = root;
    let fullPath = '';

    pathParts.forEach((part, idx) => {
      fullPath += (idx === 0 ? '' : '/') + part;
      current = getOrCreate(current, part, fullPath).children;
    });

    // group paths under the category
    category.groups.forEach(groupPath => {
      const groupParts = groupPath.split('/').filter(Boolean);
      let groupCurrent = current;
      let groupFullPath = category.path;

      groupParts.forEach((groupPart, idx) => {
        groupFullPath += '/' + groupPart;
        groupCurrent = getOrCreate(groupCurrent, groupPart, groupFullPath)
          .children;
      });
    });
  });

  const mapNodeToTreeNode = (map: Record<string, MapNode>): TreeNode[] =>
    Object.values(map).map(({ node, children }) => ({
      ...node,
      children: mapNodeToTreeNode(children),
    }));

  return mapNodeToTreeNode(root);
};

const GroupCategoryTree: React.FC<GroupCategoryTreeProps> = ({
  categories,
  onSelectNode,
  selectedPath,
}) => {
  const classes = useStyles();

  const tree = useMemo(
    () => buildTreeFromCategories(categories),
    [categories],
  );

  // path -> owning category
  const pathToCategory: Record<string, Category> = useMemo(() => {
    const map: Record<string, Category> = {};

    categories.forEach(cat => {
      // category node
      map[cat.path] = cat;

      // paths under this category
      cat.groups.forEach(groupPath => {
        const parts = groupPath.split('/').filter(Boolean);
        let currentPath = cat.path;

        parts.forEach(part => {
          currentPath = `${currentPath}/${part}`;
          map[currentPath] = cat;
        });
      });
    });

    return map;
  }, [categories]);

  const getCategoryForPath = (path: string): Category | undefined => {
    if (pathToCategory[path]) return pathToCategory[path];

    return categories.find(cat => path.startsWith(cat.path + '/'));

  };

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleNode = (fullPath: string) => {
    setCollapsed(prev => ({
      ...prev,
      [fullPath]: !prev[fullPath],
    }));
  };

  const renderNodes = (
    nodes: TreeNode[],
    depth = 0,
    isLastArray: boolean[] = [],
  ): React.ReactNode =>
    nodes.map((node, index) => {
      const isLast = index === nodes.length - 1;
      const thisIsLastArray = [...isLastArray, isLast];

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

      const hasChildren = node.children && node.children.length > 0;
      const isCollapsed = !!collapsed[node.fullPath];

      const nodeCategory: Category | undefined =
        pathToCategory[node.fullPath];

      const isSelected = selectedPath === node.fullPath;

      const handleSelect = () => {
        if (nodeCategory && onSelectNode) {
          onSelectNode(nodeCategory, node.fullPath);
        }
      };

      return (
        <React.Fragment key={node.fullPath}>
          <div
            className={`${classes.treeRow} ${
              isSelected ? classes.selectedTreeRow : ''
            }`}
            style={{ paddingLeft: `${depth * 16}px` }}
            onClick={handleSelect}
          >
            {/* arrow */}
            <span
              onClick={e => {
                e.stopPropagation();
                if (hasChildren) toggleNode(node.fullPath);
              }}
              style={{
                cursor: hasChildren ? 'pointer' : 'default',
                userSelect: 'none',
              }}
            >
              {hasChildren ? (isCollapsed ? '▶' : '▼') : ''}
            </span>

            {/* text */}
            <span
              className={classes.treeText}
              style={{
                fontWeight: depth === 0 || isSelected ? 'bold' : 'normal',
              }}
            >
              {prefix}
              {node.name}
            </span>
          </div>

          {!isCollapsed &&
            renderNodes(node.children, depth + 1, thisIsLastArray)}
        </React.Fragment>
      );
    });

  return <div>{renderNodes(tree)}</div>;
};

// -----------------------------------------------------------------------------
// Main container
// -----------------------------------------------------------------------------
type GroupCategoryLocationProps = {
  project?: Project | null;
  root: string;
  setRoot: React.Dispatch<React.SetStateAction<string>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
};

const GroupCategoryLocation: React.FC<GroupCategoryLocationProps> = ({
  project,
  root,
  setRoot,
  categories,
  setCategories,
}) => {
  const classes = useStyles();

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');

  const handleDeleteGroup = (updated: Category) => {
    setCategories(
      categories.map(c => (c.id === updated.id ? updated : c)),
    );
  };

  const handleRemoveGroup = (category: Category, groupPath: string) => {
    if (!project) return;

    updateGroupCategory(
      project.key_name,
      category.id,
      'remove',
      [groupPath],
    )
      .then(res => {
        if (res == null) return;
        setCategories(
          categories.map(c => (c.id === res.id ? res : c)),
        );
      })
      .catch(err => {
        console.error(err);
      });
  };

  // when categories change, keep selectedCategory in sync
  useEffect(() => {
    if (!selectedCategory) return;

    const updated = categories.find(c => c.id === selectedCategory.id);
    setSelectedCategory(updated || null);
  }, [categories]);

  const handleTreeSelect = (category: Category, fullPath: string) => {
    setSelectedCategory(category);
    setSelectedPath(fullPath);
  };

  return (
    <Paper className={classes.root}>
      {project && (
        <>
          {/* Header */}
          <div className={classes.headerRow}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '150px 1fr',
                columnGap: 16,
              }}
            >
              <div>Groups</div>
              <div
                style={{
                  display: 'flex',
                  gap: 24,
                }}
              >
                <span
                  onClick={() => setViewMode('tree')}
                  style={{
                    cursor: 'pointer',
                    fontWeight: viewMode === 'tree' ? 'bold' : 'normal',
                    textAlign: 'right',
                  }}
                >
                  Tree View
                </span>
                <span
                  onClick={() => setViewMode('list')}
                  style={{
                    cursor: 'pointer',
                    fontWeight: viewMode === 'list' ? 'bold' : 'normal',
                    textAlign: 'right',
                  }}
                >
                  List View
                </span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className={classes.container}>
            {/* Column 1 – roots */}
            <div className={classes.rootsColumn}>
              <RootList
                project={project}
                selected={root}
                setSelected={setRoot}
              />
            </div>

            {/* Column 2 – tree or list */}
            <div className={classes.treeColumn}>
              {root !== '' && (
                <>
                  {viewMode === 'tree' && (
                    <div
                      style={{
                        paddingLeft: 50,
                        overflow: 'auto',
                      }}
                    >
                      <GroupCategoryTree
                        categories={categories}
                        onSelectNode={handleTreeSelect}
                        selectedPath={selectedPath}
                      />
                    </div>
                  )}

                  {viewMode === 'list' && (
                    <div
                      style={{
                        paddingLeft: 50,
                        overflow: 'auto',
                      }}
                    >
                      <GroupCategoryList
                        project={project}
                        root={root}
                        selected={selectedCategory}
                        setSelected={setSelectedCategory}
                        categories={categories}
                        setCategories={setCategories}
                        setSelectedPath={setSelectedPath}
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Column 3 – groups for selected node */}
            <div className={classes.rightColumn}>
              {selectedCategory && (
                <GroupList
                  project={project}
                  category={selectedCategory}
                  onDelete={handleDeleteGroup}
                  selectedPath={selectedPath}
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
