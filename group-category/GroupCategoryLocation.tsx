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
    // Header row for the tree view next to roots - Added New SanjayK -PSI
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
      witdh: '100%',
      backgroundColor: theme.palette.background.paper,
      display: 'flex',
      overflow: 'auto hidden',
      '& > nav, & > div': {
        overflow: 'auto',
        marginRight: theme.spacing(.5),
        flexShrink: 0,
        '&:first-child': {
          marginLeft: theme.spacing(.5),
        },
      },
    },
    treeText: {
      fontFamily: 'monospace',
      fontSize: 12,
      whiteSpace: 'pre',
      margin: 0,
      padding: theme.spacing(1, 0),
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
type GroupCategoryTreeProps = {
  categories: Category[],
};

const GroupCategoryTree: React.FC<GroupCategoryTreeProps> = ({ categories }) => {
  const classes = useStyles();

  // build generic tree structure from category.path + category.groups
  const tree = useMemo(() => {
    type Node = { [name: string]: Node };
    const root: Node = {};

    const ensurePath = (base: Node, parts: string[]) => {
      let node = base;
      parts.forEach(part => {
        if (!node[part]) {
          node[part] = {};
        }
        node = node[part];
      });
      return node;
    };

    categories.forEach(cat => {
      const catParts = cat.path.split('/').filter(Boolean);
      const catNode = ensurePath(root, catParts);

      // attach groups under the category node
      cat.groups.forEach(groupPath => {
        const groupParts = groupPath.split('/').filter(Boolean);
        ensurePath(catNode, groupParts);
      });
    });

    return root;
  }, [categories]);

  const buildLines = (node: { [name: string]: any }, prefix = ''): string[] => {
    const entries = Object.entries(node).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const lines: string[] = [];

    entries.forEach(([name, child], idx) => {
      const isLast = idx === entries.length - 1;
      const connector = isLast ? '└─ ' : '├─ ';
      lines.push(prefix + connector + name);
      const childPrefix = prefix + (isLast ? '   ' : '│  ');
      lines.push(...buildLines(child, childPrefix));
    });

    return lines;
  };

  const lines = buildLines(tree);

  return (
    <div>
      <pre className={classes.treeText}>
        {lines.length === 0 ? '(no data)' : lines.join('\n')}
      </pre>
    </div>
  );
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
                  }}
                >
                  Tree View
                </span>
                <span
                  onClick={() => setViewMode("list")}
                  style={{
                    cursor: "pointer",
                    fontWeight: viewMode === "list" ? "bold" : "normal",
                  }}
                >
                  List View
                </span>
              </div>
            </div>
          </div>
          {/* Content area */}
          <div className={classes.container}>
            <RootList project={project} selected={root} setSelected={setRoot} />
            {/* NEW: tree view next to roots, for current root */}
            {root !== "" && (
              <>
                {viewMode === 'tree' && (
                  <GroupCategoryTree categories={categories} />
                )}
                {viewMode === 'list' && (
                  <GroupCategoryList 
                    project={project}
                    root={root}
                    selected={selectedCategory}
                    setSelected={setSelectedCategory}
                    categories={categories}
                    setCategories={setCategories}
                  />
                )}
              </>
            )}
          </div>
        </>
      )}
    </Paper>
  );
};

export default GroupCategoryLocation;
