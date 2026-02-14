/* ──────────────────────────────────────────────────────────────────────────
	Module Name:
    	reviewInfo/reviewInfo.go

	Module Description:
		Repository for managing review information in the database.
	Details:
	- Implements CRUD operations for review information.
	- Supports listing assets and their review information.
	- Provides functions for counting and listing latest submissions with dynamic filtering and sorting.

	Update and Modification History:
	* - 29-10-2025 - SanjayK PSI - Implemented dynamic filtering and sorting for latest submissions.
	* - 17-11-2025 - SanjayK PSI - Added phase-aware status filtering and sorting.
	* - 22-11-2025 - SanjayK PSI - Fixed bugs related to phase-specific filtering and sorting.
	* - 16-01-2026 - SanjayK PSI - Added asset pivot listing with grouped view  and sorting.
	* - 02-02-2026 - SanjayK PSI - Added component field to AssetPivot and related functions for better component tracking.
	* - 05-02-2026 - Added take fields for each phase (MDL, RIG, BLD, DSN, LDV)

	Functions:
	* - List: Lists review information based on provided parameters.
	* - Get: Retrieves a specific review information record.
	* - Create: Creates a new review information record.
	* - Update: Updates an existing review information record.
	* - Delete: Marks a review information record as deleted.
	* - ListAssets: Lists unique assets based on review information.
	* - ListShotReviewInfos: Lists review information for a specific shot.
	* - ListAssetReviewInfos: Lists review information for a specific asset.
	* - CountLatestSubmissions: Counts latest submissions with dynamic filtering.
	* - ListLatestSubmissionsDynamic: Lists latest submissions with dynamic filtering and sorting.
	* - buildPhaseAwareStatusWhere: Constructs a WHERE clause for phase-aware status filtering.
	* - buildOrderClause: Constructs an ORDER BY clause based on sorting parameters.
	* - ListAssetsPivot: Lists pivoted assets with filtering and sorting options.

	────────────────────────────────────────────────────────────────────────── */

package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/PolygonPictures/central30-web/front/entity"
	"github.com/PolygonPictures/central30-web/front/repository/model"
	"gorm.io/gorm"
)

type ReviewInfo struct {
	db *gorm.DB
}

func NewReviewInfo(db *gorm.DB) (*ReviewInfo, error) {
	info := model.ReviewInfo{}

	//Specification change: https:jira.ppi.co.jp/browse/POTOO-2406
	migrator := db.Migrator()
	if migrator.HasTable(&info) && !migrator.HasColumn(&info, "take_path") {
		if err := migrator.RenameColumn(&info, "path", "take_path"); err != nil {
			return nil, err
		}
	}

	if err := db.AutoMigrate(&info); err != nil {
		return nil, err
	}

	return &ReviewInfo{
		db: db,
	}, nil
}

func (r *ReviewInfo) WithContext(ctx context.Context) *gorm.DB {
	return r.db.WithContext(ctx)
}

func (r *ReviewInfo) TransactionWithContext(
	ctx context.Context,
	fc func(tx *gorm.DB) error,
	opts ...*sql.TxOptions,
) error {
	db := r.WithContext(ctx)
	return db.Transaction(fc, opts...)
}

func (r *ReviewInfo) List(
	db *gorm.DB,
	params *entity.ListReviewInfoParams,
) ([]*entity.ReviewInfo, int, error) {
	stmt := db
	for i, g := range params.Group {
		stmt = stmt.Where(fmt.Sprintf("group_%d = ?", i+1), g)
	}
	stmt = stmt.Where("`project` = ?", params.Project)
	if params.Studio != nil {
		stmt = stmt.Where("`studio` = ?", *params.Studio)
	}
	if params.TaskID != nil {
		stmt = stmt.Where("`task_id` = ?", *params.TaskID)
	}
	if params.SubtaskID != nil {
		stmt = stmt.Where("`subtask_id` = ?", *params.SubtaskID)
	}
	if params.Root != nil {
		stmt = stmt.Where("`root` = ?", *params.Root)
	}
	for i, g := range params.Group {
		stmt = stmt.Where(fmt.Sprintf("`groups`->\"$[%d]\" = ?", i), g)
	}
	if params.Relation != nil {
		stmt = stmt.Where("relation IN (?)", params.Relation)
	}
	if params.Phase != nil {
		stmt = stmt.Where("phase IN (?)", params.Phase)
	}
	if params.Component != nil {
		stmt = stmt.Where("`component` = ?", *params.Component)
	}
	if params.Take != nil {
		stmt = stmt.Where("`take` = ?", *params.Take)
	}

	order := "`id` desc"
	if params.OrderBy != nil {
		order = *params.OrderBy
	}
	showDeleted := false
	if params.ModifiedSince != nil {
		stmt = stmt.Where("`modified_at_utc` >= ?", *params.ModifiedSince)
		order = "`modified_at_utc` asc"
		showDeleted = true
	} else {
		stmt.Where("`deleted` = ?", 0)
	}

	var total int64
	var m model.ReviewInfo
	if err := stmt.Model(&m).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var models []*model.ReviewInfo
	perPage := params.GetPerPage()
	offset := perPage * (params.GetPage() - 1)
	if err := stmt.Order(
		order,
	).Limit(perPage).Offset(offset).Find(&models).Error; err != nil {
		return nil, 0, err
	}

	var entities []*entity.ReviewInfo
	for _, m := range models {
		entities = append(entities, m.Entity(showDeleted))
	}
	return entities, int(total), nil
}

func (r *ReviewInfo) Get(
	db *gorm.DB,
	params *entity.GetReviewParams,
) (*entity.ReviewInfo, error) {
	var m model.ReviewInfo
	if err := db.Where(
		"`deleted` = ?", 0,
	).Where(
		"`project` = ?", params.Project,
	).Where(
		"`id` = ?", params.ID,
	).Take(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, entity.ErrRecordNotFound
		}
		return nil, err
	}
	return m.Entity(false), nil
}

func (r *ReviewInfo) Create(
	tx *gorm.DB,
	params *entity.CreateReviewInfoParams,
) (*entity.ReviewInfo, error) {
	m := model.NewReviewInfo(params)
	if err := tx.Create(m).Error; err != nil {
		return nil, err
	}
	return m.Entity(false), nil
}

func (r *ReviewInfo) Update(
	tx *gorm.DB,
	params *entity.UpdateReviewInfoParams,
) (*entity.ReviewInfo, error) {
	now := time.Now().UTC()
	modifiedBy := ""
	if params.ModifiedBy != nil {
		modifiedBy = *params.ModifiedBy
	}
	var m model.ReviewInfo
	if err := tx.Where(
		"`deleted` = ?", 0,
	).Where(
		"`project` = ?", params.Project,
	).Where(
		"`id` = ?", params.ID,
	).Take(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, entity.ErrRecordNotFound
		}
		return nil, err
	}
	var modified = false
	if params.ApprovalStatus != nil {
		m.ApprovalStatus = *params.ApprovalStatus
		m.ApprovalStatusUpdatedAtUtc = now
		modified = true
	}
	if params.ApprovalStatusUpdatedUser != nil {
		m.ApprovalStatusUpdatedUser = *params.ApprovalStatusUpdatedUser
		m.ApprovalStatusUpdatedAtUtc = now
		modified = true
	}
	if params.WorkStatus != nil {
		m.WorkStatus = *params.WorkStatus
		m.WorkStatusUpdatedAtUtc = now
		modified = true
	}
	if params.WorkStatusUpdatedUser != nil {
		m.WorkStatusUpdatedUser = *params.WorkStatusUpdatedUser
		m.WorkStatusUpdatedAtUtc = now
		modified = true
	}
	if !modified {
		return nil, errors.New("no value is given to change")
	}
	m.ModifiedAtUTC = now
	m.ModifiedBy = modifiedBy
	return m.Entity(false), tx.Save(m).Error
}

func (r *ReviewInfo) Delete(
	tx *gorm.DB,
	params *entity.DeleteReviewInfoParams,
) error {
	now := time.Now().UTC()
	var modifiedBy string
	if params.ModifiedBy != nil {
		modifiedBy = *params.ModifiedBy
	}
	var m model.ReviewInfo
	if err := tx.Where(
		"`deleted` = ?", 0,
	).Where(
		"`project` = ?", params.Project,
	).Where(
		"`id` = ?", params.ID,
	).Take(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return entity.ErrRecordNotFound
		}
		return err
	}
	m.Deleted = m.ID
	m.ModifiedAtUTC = now
	m.ModifiedBy = modifiedBy
	return tx.Save(m).Error
}

func (r *ReviewInfo) ListAssets(
	db *gorm.DB,
	params *entity.AssetListParams,
) ([]*entity.Asset, int, error) {
	stmt := db.Model(
		&ReviewInfo{},
	).Where(
		"deleted = ?", 0,
	).Where(
		"project = ?", params.Project,
	).Where(
		"root = ?", "assets",
	).Group(
		"project",
	).Group(
		"root",
	).Group(
		"group_1",
	).Group(
		"relation",
	)

	var total int64
	if err := stmt.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	stmt = stmt.Order(
		"group_1",
	).Order(
		"relation",
	)

	var reviews []*model.ReviewInfo
	perPage := params.GetPerPage()
	offset := perPage * (params.GetPage() - 1)
	if err := stmt.Select(
		"project", "root", "group_1", "relation",
	).Limit(perPage).Offset(offset).Find(&reviews).Error; err != nil {
		return nil, 0, err
	}

	assets := make([]*entity.Asset, len(reviews))
	for i, review := range reviews {
		assets[i] = &entity.Asset{
			Name:     review.Group1,
			Relation: review.Relation,
		}
	}
	return assets, int(total), nil
}

func (r *ReviewInfo) ListAssetReviewInfos(
	db *gorm.DB,
	params *entity.AssetReviewInfoListParams,
) ([]*entity.ReviewInfo, error) {
	stmtA := db.Select(
		"project",
		"root",
		"group_1",
		"relation",
		"phase",
		"MAX(modified_at_utc) AS modified_at_utc",
	).Model(
		&model.ReviewInfo{},
	).Where(
		"project = ?", params.Project,
	).Where(
		"root = ?", "assets",
	).Where(
		"group_1 = ?", params.Asset,
	).Where(
		"relation = ?", params.Relation,
	).Where(
		"deleted = ?", 0,
	).Group(
		"project",
	).Group(
		"root",
	).Group(
		"group_1",
	).Group(
		"relation",
	).Group(
		"phase",
	)

	stmtB := db.Select(
		"*",
	).Model(
		&model.ReviewInfo{},
	).Where(
		"project = ?", params.Project,
	).Where(
		"root = ?", "assets",
	).Where(
		"group_1 = ?", params.Asset,
	).Where(
		"relation = ?", params.Relation,
	).Where(
		"deleted = ?", 0,
	)

	stmt := db.Select(
		"b.*",
	).Table(
		"(?) AS a", stmtA,
	).Joins(
		"LEFT OUTER JOIN (?) AS b ON a.project = b.project AND a.root = b.root AND a.group_1 = b.group_1 AND a.relation = b.relation AND a.phase = b.phase AND a.modified_at_utc = b.modified_at_utc", stmtB,
	)

	var reviews []*model.ReviewInfo
	if err := stmt.Scan(&reviews).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	reviewInfos := make([]*entity.ReviewInfo, len(reviews))
	for i, review := range reviews {
		reviewInfos[i] = review.Entity(false)
	}
	return reviewInfos, nil
}

func (r *ReviewInfo) ListShotReviewInfos(
	db *gorm.DB,
	params *entity.ShotReviewInfoListParams,
) ([]*entity.ReviewInfo, error) {
	stmtA := db.Select(
		"project",
		"root",
		"group_1",
		"group_2",
		"group_3",
		"relation",
		"phase",
		"MAX(modified_at_utc) AS modified_at_utc",
	).Model(
		&model.ReviewInfo{},
	).Where(
		"project = ?", params.Project,
	).Where(
		"root = ?", "shots",
	).Where(
		"group_1 = ?", params.Groups[0],
	).Where(
		"group_2 = ?", params.Groups[1],
	).Where(
		"group_3 = ?", params.Groups[2],
	).Where(
		"relation = ?", params.Relation,
	).Where(
		"deleted = ?", 0,
	).Group(
		"project",
	).Group(
		"root",
	).Group(
		"group_1",
	).Group(
		"group_2",
	).Group(
		"group_3",
	).Group(
		"relation",
	).Group(
		"phase",
	)

	stmtB := db.Select(
		"*",
	).Model(
		&model.ReviewInfo{},
	).Where(
		"project = ?", params.Project,
	).Where(
		"root = ?", "shots",
	).Where(
		"group_1 = ?", params.Groups[0],
	).Where(
		"group_2 = ?", params.Groups[1],
	).Where(
		"group_3 = ?", params.Groups[2],
	).Where(
		"relation = ?", params.Relation,
	).Where(
		"deleted = ?", 0,
	)

	stmt := db.Select(
		"b.*",
	).Table(
		"(?) AS a", stmtA,
	).Joins(
		"LEFT OUTER JOIN (?) AS b ON a.project = b.project AND a.root = b.root AND a.group_1 = b.group_1 AND a.group_2 = b.group_2 AND a.group_3 = b.group_3 AND a.relation = b.relation AND a.phase = b.phase AND a.modified_at_utc = b.modified_at_utc", stmtB,
	)

	var reviews []*model.ReviewInfo
	if err := stmt.Scan(&reviews).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	reviewInfos := make([]*entity.ReviewInfo, len(reviews))
	for i, review := range reviews {
		reviewInfos[i] = review.Entity(false)
	}
	return reviewInfos, nil
}

/* ──────────────────────────────────────────────────────────────────────────
   Assets and Latest Submission Rows
   ────────────────────────────────────────────────────────────────────────── */
// ---- Latest Submission row ----
type LatestSubmissionRow struct {
	Root           string     `json:"root"              gorm:"column:root"`
	Project        string     `json:"project"           gorm:"column:project"`
	Group1         string     `json:"group_1"           gorm:"column:group_1"`
	Relation       string     `json:"relation"          gorm:"column:relation"`
	Component      string     `json:"component"         gorm:"column:component"`
	Phase          string     `json:"phase"             gorm:"column:phase"`
	SubmittedAtUTC *time.Time `json:"submitted_at_utc"  gorm:"column:submitted_at_utc"`
}

// ---- Asset Pivot row ----
type AssetPivot struct {
	Root      string `json:"root"`
	Project   string `json:"project"`
	Group1    string `json:"group_1"`
	Relation  string `json:"relation"`
	Component string `json:"component"`

	// Grouping info
	LeafGroupName     string `json:"leaf_group_name"`
	GroupCategoryPath string `json:"group_category_path"`
	TopGroupNode      string `json:"top_group_node"`

	// Latest review info fields (for ListAssetsPivot2)
	WorkStatus     *string    `json:"work_status"`
	ApprovalStatus *string    `json:"approval_status"`
	SubmittedAtUTC *time.Time `json:"submitted_at_utc"`
	ModifiedAtUTC  *time.Time `json:"modified_at_utc"`
	Take           *string    `json:"take"` // Added take field for generic phase

	// MDL Phase
	MDLWorkStatus     *string    `json:"mdl_work_status"`
	MDLApprovalStatus *string    `json:"mdl_approval_status"`
	MDLSubmittedAtUTC *time.Time `json:"mdl_submitted_at_utc"`
	MDLTake           *string    `json:"mdl_take"` // Added take for MDL

	// RIG Phase
	RIGWorkStatus     *string    `json:"rig_work_status"`
	RIGApprovalStatus *string    `json:"rig_approval_status"`
	RIGSubmittedAtUTC *time.Time `json:"rig_submitted_at_utc"`
	RIGTake           *string    `json:"rig_take"` // Added take for RIG

	// BLD Phase
	BLDWorkStatus     *string    `json:"bld_work_status"`
	BLDApprovalStatus *string    `json:"bld_approval_status"`
	BLDSubmittedAtUTC *time.Time `json:"bld_submitted_at_utc"`
	BLDTake           *string    `json:"bld_take"` // Added take for BLD

	// DSN Phase
	DSNWorkStatus     *string    `json:"dsn_work_status"`
	DSNApprovalStatus *string    `json:"dsn_approval_status"`
	DSNSubmittedAtUTC *time.Time `json:"dsn_submitted_at_utc"`
	DSNTake           *string    `json:"dsn_take"` // Added take for DSN

	// LDV Phase
	LDVWorkStatus     *string    `json:"ldv_work_status"`
	LDVApprovalStatus *string    `json:"ldv_approval_status"`
	LDVSubmittedAtUTC *time.Time `json:"ldv_submitted_at_utc"`
	LDVTake           *string    `json:"ldv_take"` // Added take for LDV
}

// ---- phaseRow for intermediate query ----
type phaseRow struct {
	Project        string     `gorm:"column:project"`
	Root           string     `gorm:"column:root"`
	Group1         string     `gorm:"column:group_1"`
	Relation       string     `gorm:"column:relation"`
	Phase          string     `gorm:"column:phase"`
	WorkStatus     *string    `gorm:"column:work_status"`
	ApprovalStatus *string    `gorm:"column:approval_status"`
	SubmittedAtUTC *time.Time `gorm:"column:submitted_at_utc"`
	Component      *string    `gorm:"column:component"`
	Take           *string    `gorm:"column:take"` // Added take field

	LeafGroupName     string `gorm:"column:leaf_group_name"`
	GroupCategoryPath string `gorm:"column:group_category_path"`
	TopGroupNode      string `gorm:"column:top_group_node"`
}

// ---- Sort Direction ----
type SortDirection string

// SortDirection constants
const (
	SortASC  SortDirection = "ASC"
	SortDESC SortDirection = "DESC"
)

// ---- Grouped Asset Bucket ----
type GroupedAssetBucket struct {
	TopGroupNode string       `json:"top_group_node"` // camera / character / prop / ...
	ItemCount    int          `json:"item_count"`
	Items        []AssetPivot `json:"items"`
	TotalCount   *int         `json:"total_count"` // optional total count across pages
}

/*
──────────────────────────────────────────────────────────────────────────

	GroupAndSortByTopNode groups a slice of AssetPivot items by their TopGroupNode field,
	sorts the group headers alphabetically (A→Z, case-insensitive), and always places the
	"Unassigned" group last. Within each group, the items are sorted by their Group1 field
	in either ascending or descending order, as specified by the dir parameter.
	Returns a slice of GroupedAssetBucket, each containing a group header and its sorted items.

	Parameters:
	- rows: Slice of AssetPivot items to be grouped and sorted.
	- dir: SortDirection specifying ascending or descending order for items within each group.

	Returns:
	- []GroupedAssetBucket: Slice of grouped and sorted asset buckets.

───────────────────────────────────────────────────────────────────────────
*/
func GroupAndSortByTopNode(rows []AssetPivot, dir SortDirection) []GroupedAssetBucket {
	grouped := make(map[string][]AssetPivot)
	order := make([]string, 0)

	// group and collect TopGroupNode keys
	for _, row := range rows {
		key := strings.TrimSpace(row.TopGroupNode)
		if key == "" {
			key = "Unassigned" // represents NULL / no group
		}
		if _, exists := grouped[key]; !exists {
			grouped[key] = []AssetPivot{}
			order = append(order, key)
		}
		grouped[key] = append(grouped[key], row)
	}

	// Group header order:
	// - ALWAYS alphabetical A→Z
	// - "Unassigned" ALWAYS last (no more "unassignedFirst")
	isUnassigned := func(s string) bool {
		return strings.EqualFold(strings.TrimSpace(s), "unassigned")
	}

	sort.Slice(order, func(i, j int) bool {
		ai := strings.TrimSpace(order[i])
		aj := strings.TrimSpace(order[j])

		aui := isUnassigned(ai)
		auj := isUnassigned(aj)

		// Unassigned always last
		if aui && !auj {
			return false
		}
		if !aui && auj {
			return true
		}

		// Always A→Z (case-insensitive)
		return strings.ToLower(ai) < strings.ToLower(aj)
	})

	// sort children inside each group by Group1 using requested dir
	for _, key := range order {
		children := grouped[key]
		sort.SliceStable(children, func(i, j int) bool {
			gi := strings.ToLower(children[i].Group1)
			gj := strings.ToLower(children[j].Group1)

			if dir == SortDESC {
				return gi > gj
			}
			return gi < gj
		})
		grouped[key] = children
	}

	result := make([]GroupedAssetBucket, 0, len(order))
	for _, key := range order {
		result = append(result, GroupedAssetBucket{
			TopGroupNode: key,
			Items:        grouped[key],
		})
	}
	return result
}

// compareTake compares two take strings (possibly nil) according to the sort direction.
// It extracts the last 4 digits (if possible) and compares numerically, falling back to string comparison.
func compareTake(a, b *string, dir SortDirection) bool {
	// nil/empty handling: nil/empty is always last
	getTakeNum := func(s *string) (int, string) {
		if s == nil || *s == "" {
			return -1, ""
		}
		str := *s
		if len(str) >= 4 {
			last4 := str[len(str)-4:]
			var n int
			_, err := fmt.Sscanf(last4, "%d", &n)
			if err == nil {
				return n, str
			}
		}
		return -1, str
	}
	an, astr := getTakeNum(a)
	bn, bstr := getTakeNum(b)

	// nil/empty always last
	if an == -1 && bn != -1 {
		return false
	}
	if an != -1 && bn == -1 {
		return true
	}
	if an == -1 && bn == -1 {
		if dir == SortDESC {
			return astr > bstr
		}
		return astr < bstr
	}

	// both have numbers
	if an != bn {
		if dir == SortDESC {
			return an > bn
		}
		return an < bn
	}
	// fallback to string compare
	if dir == SortDESC {
		return astr > bstr
	}
	return astr < bstr
}

/*
──────────────────────────────────────────────────────────────────────────

	buildPhaseAwareStatusWhere constructs a SQL WHERE clause segment that filters rows based on the provided
	approvalStatuses and workStatuses. It generates case-insensitive "IN" conditions for the columns
	"approval_status" and "work_status" if their respective status slices are non-empty.
	The function returns the WHERE clause string (prefixed with " AND ") and a slice of arguments
	corresponding to the status values, all converted to lowercase and trimmed of whitespace.
	If both status slices are empty, it returns an empty string and nil arguments.

───────────────────────────────────────────────────────────────────────────
*/
func buildPhaseAwareStatusWhere(_ string, approvalStatuses, workStatuses []string) (string, []any) {
	buildIn := func(col string, vals []string) (string, []any) {
		if len(vals) == 0 {
			return "", nil
		}
		ph := strings.Repeat("?,", len(vals))
		ph = ph[:len(ph)-1]

		args := make([]any, len(vals))
		for i, v := range vals {
			args[i] = strings.ToLower(strings.TrimSpace(v))
		}

		return fmt.Sprintf("LOWER(%s) IN (%s)", col, ph), args
	}

	clauses := []string{}
	args := []any{}

	if c, a := buildIn("approval_status", approvalStatuses); c != "" {
		clauses = append(clauses, "("+c+")")
		args = append(args, a...)
	}
	if c, a := buildIn("work_status", workStatuses); c != "" {
		clauses = append(clauses, "("+c+")")
		args = append(args, a...)
	}

	if len(clauses) == 0 {
		return "", nil
	}
	return " AND " + strings.Join(clauses, " AND "), args
}

/*
──────────────────────────────────────────────────────────────────────────

	buildOrderClause constructs an SQL ORDER BY clause string based on the provided
	alias, key, and direction. It supports various keys for sorting, including generic
	columns (e.g., submitted_at_utc, modified_at_utc, phase), name/relation combinations,
	phase-specific submitted dates, work status, and approval status. The direction
	(dir) is normalized to "ASC" or "DESC", defaulting to "ASC" if invalid. The alias
	is prepended to column names if provided. For unrecognized keys, a default ordering
	by group_1, relation, and submitted_at_utc is used. The function ensures proper
	handling of NULL values and alphabetical sorting where applicable.

	Parameters:

		alias string - Optional table alias to prefix column names.
		key   string - The column or logical key to sort by.
		dir   string - Sort direction ("ASC" or "DESC").

	Returns:

		string - The constructed SQL ORDER BY clause.

──────────────────────────────────────────────────────────────────────────
*/
func buildOrderClause(alias, key, dir string) string {
	dir = strings.ToUpper(strings.TrimSpace(dir))
	if dir != "ASC" && dir != "DESC" {
		dir = "ASC"
	}

	col := func(c string) string {
		if alias == "" {
			return c
		}
		return alias + "." + c
	}

	sortComponent := func() string {
		return fmt.Sprintf(
			"CASE WHEN %s IS NULL OR %s = '' THEN 1 ELSE 0 END ASC, LOWER(TRIM(%s)) %s",
			col("component"),
			col("component"),
			col("component"),
			dir,
		)
	}

	switch key {
	// generic columns
	case "submitted_at_utc", "modified_at_utc", "phase":
		return col(key) + " " + dir

	// name / relation
	case "group1_only":
		// PRIMARY for LIST VIEW:
		// ORDER BY group_1, relation, submitted_at_utc (NULL last)
		return fmt.Sprintf(
			"LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir,
			col("relation"),
			col("submitted_at_utc"),
			col("submitted_at_utc"), dir,
		)

	case "relation_only":
		return fmt.Sprintf(
			"LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("relation"), dir,
			col("group_1"),
			col("submitted_at_utc"),
			col("submitted_at_utc"), dir,
		)

	case "component", "component_only":
		return fmt.Sprintf(
			"%s, LOWER(%s) ASC",
			sortComponent(),
			col("group_1"),
		)

	case "group_rel_submitted":
		return fmt.Sprintf(
			"LOWER(%s) ASC, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"),
			col("relation"),
			col("submitted_at_utc"),
			col("submitted_at_utc"), dir,
		)

	// phase-specific submitted date (NULL last)
	case "mdl_submitted", "rig_submitted", "bld_submitted", "dsn_submitted", "ldv_submitted":
		phase := strings.ToUpper(strings.Split(key, "_")[0])
		return fmt.Sprintf(
			"(CASE WHEN %s = '%s' THEN 0 ELSE 1 END) ASC, %s %s, LOWER(%s) ASC",
			col("phase"), phase,
			col("submitted_at_utc"), dir,
			col("group_1"),
		)

	// work columns (alphabetical, NULL last)
	case "mdl_work", "rig_work", "bld_work", "dsn_work", "ldv_work":
		phase := strings.ToUpper(strings.Split(key, "_")[0])
		return fmt.Sprintf(
			"(CASE WHEN %s = '%s' THEN 0 ELSE 1 END) ASC, (%s IS NULL) ASC, LOWER(%s) %s, LOWER(%s) ASC",
			col("phase"), phase,
			col("work_status"),
			col("work_status"), dir,
			col("group_1"),
		)

	case "work_status":
		return fmt.Sprintf(
			"(%s IS NULL) ASC, LOWER(%s) %s, LOWER(%s) ASC",
			col("work_status"),
			col("work_status"), dir,
			col("group_1"),
		)

	// approval columns (alphabetical, NULL last)
	case "mdl_appr", "rig_appr", "bld_appr", "dsn_appr", "ldv_appr":
		phase := strings.ToUpper(strings.Split(key, "_")[0])
		return fmt.Sprintf(
			"(CASE WHEN %s = '%s' THEN 0 ELSE 1 END) ASC, (%s IS NULL) ASC, LOWER(%s) %s, LOWER(%s) ASC",
			col("phase"), phase,
			col("approval_status"),
			col("approval_status"), dir,
			col("group_1"),
		)

	// ============================================
	// ALTERNATIVE: Using RIGHT() function (MySQL/PostgreSQL)
	// ============================================
	case "mdl_take", "rig_take", "bld_take", "dsn_take", "ldv_take":
		phase := strings.ToUpper(strings.Split(key, "_")[0])
		return fmt.Sprintf(
			"(CASE WHEN %s = '%s' THEN 0 ELSE 1 END) ASC, "+
				"CASE WHEN %s IS NULL OR %s = '' THEN 1 ELSE 0 END ASC, "+
				"CAST(RIGHT(%s, 4) AS UNSIGNED) %s, "+
				"LOWER(%s) ASC",
			col("phase"), phase,
			col("take"), col("take"),
			col("take"), dir,
			col("group_1"),
		)

	case "take":
		return fmt.Sprintf(
			"CASE WHEN %s IS NULL OR %s = '' THEN 1 ELSE 0 END ASC, "+
				"CAST(RIGHT(%s, 4) AS UNSIGNED) %s, "+
				"LOWER(%s) ASC",
			col("take"), col("take"),
			col("take"), dir,
			col("group_1"),
		)

	// default: group_1 + relation + submitted_at_utc
	default:
		return fmt.Sprintf(
			"LOWER(%s) %s, LOWER(%s) ASC, LOWER(TRIM(LEADING '_' FROM %s)) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir,
			col("relation"),
			col("component"),
			col("submitted_at_utc"),
			col("submitted_at_utc"), dir,
		)
	}
}

/*
	──────────────────────────────────────────────────────────────────────────
	CountLatestSubmissions returns the count of latest review submissions for a given project and asset root,
	optionally filtered by asset name prefix, approval statuses, and work statuses.
	The function ignores the preferredPhase parameter for filtering but keeps it for API compatibility.
	It queries the database for the latest (by modified_at_utc) review info per asset and relation,
	applying the specified filters, and returns the total count.
	Returns an error if the project is not specified or if the database query fails.

	Parameters:
	ctx              - Context for database operations.
	project          - Project identifier (required).
	root             - Asset root; defaults to "assets" if empty.
	assetNameKey     - Optional asset name prefix filter (case-insensitive).
	preferredPhase   - Phase parameter (ignored in filtering; kept for compatibility).
	approvalStatuses - List of approval statuses to filter by.
	workStatuses     - List of work statuses to filter by.

	Returns:
	int64 - Count of latest submissions matching the filters.
	error - Error if project is missing or database query fails.

──────────────────────────────────────────────────────────────────────────
*/
func (r *ReviewInfo) CountLatestSubmissions(
	ctx context.Context,
	project, root, assetNameKey string,
	preferredPhase string, // kept for API compatibility; ignored in filtering
	approvalStatuses []string,
	workStatuses []string,
) (int64, error) {
	if project == "" {
		return 0, fmt.Errorf("project is required")
	}
	if root == "" {
		root = "assets"
	}

	db := r.db.WithContext(ctx)

	// name prefix filter
	nameCond := ""
	var nameArg any
	if strings.TrimSpace(assetNameKey) != "" {
		nameCond = " AND LOWER(group_1) LIKE ?"
		nameArg = strings.ToLower(strings.TrimSpace(assetNameKey)) + "%"
	}

	// status filter (no phase restriction)
	statusWhere, statusArgs := buildPhaseAwareStatusWhere(preferredPhase, approvalStatuses, workStatuses)

	sql := `
WITH latest_phase AS (
  SELECT
    project,
    root,
    group_1,
    relation,
    phase,
    work_status,
    approval_status,
    submitted_at_utc,
    modified_at_utc,
    ROW_NUMBER() OVER (
      PARTITION BY project, root, group_1, relation, phase
      ORDER BY modified_at_utc DESC
    ) AS rn
  FROM t_review_info
  WHERE project = ? AND root = ? AND deleted = 0` + nameCond + `
)
SELECT COUNT(*) FROM (
  SELECT project, root, group_1, relation
  FROM latest_phase
  WHERE rn = 1` + statusWhere + `
  GROUP BY project, root, group_1, relation
) AS x;
`

	args := []any{project, root}
	if nameArg != nil {
		args = append(args, nameArg)
	}
	args = append(args, statusArgs...)

	var total int64
	if err := db.Raw(sql, args...).Scan(&total).Error; err != nil {
		return 0, fmt.Errorf("CountLatestSubmissions: %w", err)
	}

	return total, nil
}

/*
	──────────────────────────────────────────────────────────────────────────

	ListLatestSubmissionsDynamic retrieves a list of the latest review submissions
	for a specified project and asset root, with dynamic filtering and sorting options.
	Parameters:
	- ctx: Context for database operations.
	- project: Project identifier (required).
	- root: Asset root; defaults to "assets" if empty.
	- preferredPhase: Phase to prioritize in sorting; if empty or "none", no bias is applied.
	- orderKey: Column or logical key to sort by (e.g., "submitted_at_utc", "group1_only").
	- direction: Sort direction ("ASC" or "DESC").
	- limit: Maximum number of results to return; defaults to 60 if <= 0.
	- offset: Number of results to skip; defaults to 0 if < 0.
	- assetNameKey: Optional asset name prefix filter (case-insensitive).
	- approvalStatuses: List of approval statuses to filter by.
	- workStatuses: List of work statuses to filter by.
	Returns:
	- []LatestSubmissionRow: Slice of latest submission rows matching the filters.
	- error: Error if project is missing or database query fails.

───────────────────────────────────────────────────────────────────────────
*/
func (r *ReviewInfo) ListLatestSubmissionsDynamic(
	ctx context.Context,
	project string,
	root string,
	preferredPhase string,
	orderKey string,
	direction string,
	limit, offset int,
	assetNameKey string,
	approvalStatuses []string,
	workStatuses []string,
) ([]LatestSubmissionRow, error) {
	if project == "" {
		return nil, fmt.Errorf("project is required")
	}
	if root == "" {
		root = "assets"
	}
	if limit <= 0 {
		limit = 60
	}
	if offset < 0 {
		offset = 0
	}

	// phaseGuard: 1 = no phase bias, 0 = prefer preferredPhase
	phaseGuard := 0
	if preferredPhase == "" || strings.EqualFold(preferredPhase, "none") {
		phaseGuard = 1
	}

	orderClauseWindow := buildOrderClause("", orderKey, direction)
	orderClauseInner := buildOrderClause("b", orderKey, direction)

	// name prefix filter
	nameCond := ""
	var nameArg any
	if strings.TrimSpace(assetNameKey) != "" {
		nameCond = " AND LOWER(group_1) LIKE ?"
		nameArg = strings.ToLower(strings.TrimSpace(assetNameKey)) + "%"
	}

	// status filter
	statusWhere, statusArgs := buildPhaseAwareStatusWhere(preferredPhase, approvalStatuses, workStatuses)

	// keys subquery: which assets (root+project+group_1+relation) are in scope
	keysSQL := `
WITH latest_phase AS (
  SELECT
    project,
    root,
    group_1,
    relation,
	component,
    phase,
    work_status,
    approval_status,
    submitted_at_utc,
    modified_at_utc,
    ROW_NUMBER() OVER (
      PARTITION BY project, root, group_1, relation, phase
      ORDER BY modified_at_utc DESC
    ) AS rn
  FROM t_review_info
  WHERE project = ? AND root = ? AND deleted = 0` + nameCond + `
)
SELECT project, root, group_1, relation, component
FROM latest_phase
WHERE rn = 1` + statusWhere + `
GROUP BY project, root, group_1, relation, component
`

	q := fmt.Sprintf(`
WITH ordered AS (
  SELECT
    *,
    ROW_NUMBER() OVER (ORDER BY %s) AS _order
  FROM (
    SELECT b.*
    FROM (
      SELECT
        project,
        root,
        group_1,
        relation,
		component,
        phase,
        MAX(modified_at_utc) AS modified_at_utc
      FROM t_review_info
      WHERE project = ? AND root = ? AND deleted = 0
      GROUP BY project, root, group_1, relation, phase, component
    ) AS a
    LEFT JOIN (
      SELECT
        root,
        project,
        group_1,
        phase,
        relation,
		component,
        work_status,
        approval_status,
        submitted_at_utc,
        modified_at_utc,
		take
      FROM t_review_info
      WHERE project = ? AND root = ? AND deleted = 0
    ) AS b
      ON a.project = b.project
     AND a.root    = b.root
     AND a.group_1 = b.group_1
     AND a.relation = b.relation
     AND a.phase    = b.phase
     AND a.modified_at_utc = b.modified_at_utc

    INNER JOIN ( %s ) AS fk
      ON b.project = fk.project
     AND b.root    = fk.root
     AND b.group_1 = fk.group_1
     AND b.relation = fk.relation
     AND b.component = fk.component
    ORDER BY %s
  ) AS k
),
offset_ordered AS (
  SELECT
    c.*,
    CASE
      WHEN ? = 1 THEN c._order
      WHEN c.phase = ? THEN c._order
      ELSE 100000 + c._order
    END AS __order
  FROM ordered c
),
ranked AS (
  SELECT
    b.*,
    ROW_NUMBER() OVER (
      PARTITION BY b.root, b.project, b.group_1, b.relation
      ORDER BY
        CASE
          WHEN ? = 1 THEN 0
          WHEN b.phase = ? THEN 0
          ELSE 1
        END,
        LOWER(b.group_1)   ASC,
        LOWER(b.relation)  ASC,
        b.modified_at_utc  DESC
    ) AS _rank
  FROM offset_ordered b
)
SELECT
  root,
  project,
  group_1,
  relation,
  component,
  phase,
  submitted_at_utc
FROM ranked
WHERE _rank = 1
ORDER BY __order ASC
LIMIT ? OFFSET ?;
`, orderClauseWindow, keysSQL, orderClauseInner)

	args := []any{
		// 'a' CTE
		project, root,
		// 'b' join
		project, root,
		// keys subquery
		project, root,
	}
	if nameArg != nil {
		args = append(args, nameArg)
	}
	args = append(args, statusArgs...)
	// phase bias + limit/offset
	args = append(args,
		phaseGuard, preferredPhase,
		phaseGuard, preferredPhase,
		limit, offset,
	)

	var rows []LatestSubmissionRow
	if err := r.db.WithContext(ctx).Raw(q, args...).Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("ListLatestSubmissionsDynamic: %w", err)
	}

	return rows, nil
}

/*
──────────────────────────────────────────────────────────────────────────

	ListAssetsPivot retrieves a paginated list of AssetPivot rows for a specified project and asset root,
	optionally filtered by asset name prefix, preferred phase, approval statuses, and work statuses.
	Parameters:
	- ctx: Context for database operations.
	- project: Project identifier (required).
	- root: Asset root; defaults to "assets" if empty.
	- preferredPhase: Phase to prioritize in sorting; if empty or "none", no bias is applied.
	- orderKey: Column or logical key to sort by (e.g., "submitted_at_utc", "group1_only").
	- direction: Sort direction ("ASC" or "DESC").
	- limit: Maximum number of results to return; defaults to 60 if <= 0.
	- offset: Number of results to skip; defaults to 0 if < 0.
	- assetNameKey: Optional asset name prefix filter (case-insensitive).
	- approvalStatuses: List of approval statuses to filter by.
	- workStatuses: List of work statuses to filter by.
	Returns:
	- []AssetPivot: Slice of AssetPivot rows matching the filters.
	- int64: Total count of assets matching the filters (for pagination).
	- error: Error if project is missing or database query fails.

───────────────────────────────────────────────────────────────────────────
*/
func (r *ReviewInfo) ListAssetsPivot(
	ctx context.Context,
	project, root, preferredPhase, orderKey, direction string,
	limit, offset int,
	assetNameKey string,
	approvalStatuses []string,
	workStatuses []string,
) ([]AssetPivot, int64, error) {
	if project == "" {
		return nil, 0, fmt.Errorf("project is required")
	}
	if root == "" {
		root = "assets"
	}

	// 1) Get total count for pagination (after filters)
	total, err := r.CountLatestSubmissions(
		ctx,
		project,
		root,
		assetNameKey,
		preferredPhase,
		approvalStatuses,
		workStatuses,
	)
	if err != nil {
		return nil, 0, err
	}

	// 2) Get page "keys" (one primary row per asset, correctly ordered)
	keys, err := r.ListLatestSubmissionsDynamic(
		ctx,
		project,
		root,
		preferredPhase,
		orderKey,
		direction,
		limit,
		offset,
		assetNameKey,
		approvalStatuses,
		workStatuses,
	)
	if err != nil {
		return nil, 0, err
	}
	if len(keys) == 0 {
		return []AssetPivot{}, total, nil
	}

	// 3) Build dynamic WHERE ( ... OR ... ) to restrict phase fetch
	//    strictly to this page's assets.
	var sb strings.Builder
	var params []any

	sb.WriteString(`
WITH latest_phase AS (
  SELECT
    ri.project,
    ri.root,
    ri.group_1,
    ri.relation,
	COALESCE(ri.component, '') AS component,
    ri.phase,
    ri.work_status,
    ri.approval_status,
    ri.submitted_at_utc,
    ri.modified_at_utc,
	RIGHT(ri.take, 4) AS take,
    JSON_UNQUOTE(JSON_EXTRACT(ri.` + "`groups`" + `, '$[0]')) AS leaf_group_name,
    gc.path AS group_category_path,
    SUBSTRING_INDEX(gc.path, '/', 1) AS top_group_node,
    ROW_NUMBER() OVER (
      PARTITION BY ri.project, ri.root, ri.group_1, ri.relation, ri.component, ri.phase
      ORDER BY ri.modified_at_utc DESC
    ) AS rn
  FROM t_review_info AS ri
  LEFT JOIN t_group_category_group AS gcg
         ON gcg.project = ri.project
        AND gcg.deleted = 0
        AND gcg.path = JSON_UNQUOTE(JSON_EXTRACT(ri.` + "`groups`" + `, '$[0]'))
  LEFT JOIN t_group_category AS gc
         ON gc.id = gcg.group_category_id
        AND gc.deleted = 0
        AND gc.root = 'assets'
  WHERE ri.project = ? AND ri.root = ? AND ri.deleted = 0
    AND (
`)

	params = append(params, project, root)

	for i, k := range keys {
		if i > 0 {
			sb.WriteString("      OR ")
		}
		sb.WriteString("(ri.group_1 = ? AND ri.relation = ? AND ri.component = ?)\n")
		params = append(params, k.Group1, k.Relation, k.Component)
	}

	sb.WriteString(`    )
)
SELECT
  project,
  root,
  group_1,
  relation,
  component,
  phase,
  work_status,
  approval_status,
  submitted_at_utc,
  take,
  leaf_group_name,
  group_category_path,
  top_group_node
FROM latest_phase
WHERE rn = 1;
`)

	var phases []phaseRow
	if err := r.db.WithContext(ctx).Raw(sb.String(), params...).Scan(&phases).Error; err != nil {
		return nil, 0, fmt.Errorf("ListAssetsPivot.phaseFetch: %w", err)
	}

	// 4) Stitch phases into pivot rows, preserving the page order from `keys`.
	type keyStruct struct {
		p, r, g, rel, comp string
	}

	// helper to safely dereference *string
	ptrToString := func(s *string) string {
		if s == nil {
			return ""
		}
		return *s
	}

	m := make(map[keyStruct]*AssetPivot, len(keys))
	orderedPtrs := make([]*AssetPivot, 0, len(keys))

	// create base pivot row per asset in the same order as `keys`
	for _, k := range keys {
		id := keyStruct{k.Project, k.Root, k.Group1, k.Relation, k.Component}
		ap := &AssetPivot{
			Root:      k.Root,
			Project:   k.Project,
			Group1:    k.Group1,
			Relation:  k.Relation,
			Component: k.Component,
		}
		m[id] = ap
		orderedPtrs = append(orderedPtrs, ap)
	}

	// fill per-phase fields + grouping info
	for _, pr := range phases {
		id := keyStruct{pr.Project, pr.Root, pr.Group1, pr.Relation, ptrToString(pr.Component)}
		ap, ok := m[id]
		if !ok {
			continue
		}

		//  -- Add your code here----
		if pr.Component != nil && *pr.Component != "" {
			ap.Component = strings.TrimPrefix(*pr.Component, "_")
		}

		// Grouping info (set once)
		if ap.LeafGroupName == "" {
			ap.LeafGroupName = pr.LeafGroupName
			ap.GroupCategoryPath = pr.GroupCategoryPath
			ap.TopGroupNode = pr.TopGroupNode
		}

		switch strings.ToLower(pr.Phase) {
		case "mdl":
			ap.MDLWorkStatus = pr.WorkStatus
			ap.MDLApprovalStatus = pr.ApprovalStatus
			ap.MDLSubmittedAtUTC = pr.SubmittedAtUTC
			ap.MDLTake = pr.Take // Added take for MDL

		case "rig":
			ap.RIGWorkStatus = pr.WorkStatus
			ap.RIGApprovalStatus = pr.ApprovalStatus
			ap.RIGSubmittedAtUTC = pr.SubmittedAtUTC
			ap.RIGTake = pr.Take // Added take for RIG

		case "bld":
			ap.BLDWorkStatus = pr.WorkStatus
			ap.BLDApprovalStatus = pr.ApprovalStatus
			ap.BLDSubmittedAtUTC = pr.SubmittedAtUTC
			ap.BLDTake = pr.Take // Added take for BLD

		case "dsn":
			ap.DSNWorkStatus = pr.WorkStatus
			ap.DSNApprovalStatus = pr.ApprovalStatus
			ap.DSNSubmittedAtUTC = pr.SubmittedAtUTC
			ap.DSNTake = pr.Take // Added take for DSN

		case "ldv":
			ap.LDVWorkStatus = pr.WorkStatus
			ap.LDVApprovalStatus = pr.ApprovalStatus
			ap.LDVSubmittedAtUTC = pr.SubmittedAtUTC
			ap.LDVTake = pr.Take // Added take for LDV
		}
	}

	// 5) Convert []*AssetPivot → []AssetPivot in the same order as keys.
	ordered := make([]AssetPivot, len(orderedPtrs))
	for i, ap := range orderedPtrs {
		ordered[i] = *ap
	}

	// print the resulting rows for debugging
	for _, row := range ordered {
		fmt.Printf("%+v\n", row)
	}
	return ordered, total, nil
}
