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
	"math"
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

// buildAssetPivotQuery constructs the base pivot query for ListAssetsPivot.
func (r *ReviewInfo) buildAssetPivotQuery(db *gorm.DB, p ListAssetsPivotParams) *gorm.DB {
	sub := db.Model(&model.ReviewInfo{}).
		Select(`
			project,
			root,
			group_1,
			relation,
			MAX(CASE WHEN phase = 'MDL' THEN work_status END) AS mdl_work_status,
			MAX(CASE WHEN phase = 'MDL' THEN approval_status END) AS mdl_approval_status,
			MAX(CASE WHEN phase = 'MDL' THEN submitted_at_utc END) AS mdl_submitted_at_utc,
			MAX(CASE WHEN phase = 'RIG' THEN work_status END) AS rig_work_status,
			MAX(CASE WHEN phase = 'RIG' THEN approval_status END) AS rig_approval_status,
			MAX(CASE WHEN phase = 'RIG' THEN submitted_at_utc END) AS rig_submitted_at_utc,
			MAX(CASE WHEN phase = 'BLD' THEN work_status END) AS bld_work_status,
			MAX(CASE WHEN phase = 'BLD' THEN approval_status END) AS bld_approval_status,
			MAX(CASE WHEN phase = 'BLD' THEN submitted_at_utc END) AS bld_submitted_at_utc,
			MAX(CASE WHEN phase = 'DSN' THEN work_status END) AS dsn_work_status,
			MAX(CASE WHEN phase = 'DSN' THEN approval_status END) AS dsn_approval_status,
			MAX(CASE WHEN phase = 'DSN' THEN submitted_at_utc END) AS dsn_submitted_at_utc,
			MAX(CASE WHEN phase = 'LDV' THEN work_status END) AS ldv_work_status,
			MAX(CASE WHEN phase = 'LDV' THEN approval_status END) AS ldv_approval_status,
			MAX(CASE WHEN phase = 'LDV' THEN submitted_at_utc END) AS ldv_submitted_at_utc,
			MAX(leaf_group_name) AS leaf_group_name,
			MAX(group_category_path) AS group_category_path,
			MAX(top_group_node) AS top_group_node
		`).
		Where("project = ?", p.Project).
		Where("root = ?", func() string {
			if p.Root == "" {
				return "assets"
			}
			return p.Root
		}()).
		Where("deleted = ?", 0).
		Group("project, root, group_1, relation")

	return sub
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

// ========================================================================
// ========= Asset Review Pivot Listing ===================================
// ========================================================================

type LatestSubmissionRow struct {
	Root           string     `json:"root"              gorm:"column:root"`
	Project        string     `json:"project"           gorm:"column:project"`
	Group1         string     `json:"group_1"           gorm:"column:group_1"`
	Relation       string     `json:"relation"          gorm:"column:relation"`
	Phase          string     `json:"phase"             gorm:"column:phase"`
	SubmittedAtUTC *time.Time `json:"submitted_at_utc"  gorm:"column:submitted_at_utc"`
}

// ---- Pivot result ----
type AssetPivot struct {
	Root     string `json:"root"`
	Project  string `json:"project"`
	Group1   string `json:"group_1"`
	Relation string `json:"relation"`

	// Grouping info
	LeafGroupName     string `json:"leaf_group_name"`
	GroupCategoryPath string `json:"group_category_path"`
	TopGroupNode      string `json:"top_group_node"`

	MDLWorkStatus     *string    `json:"mdl_work_status"`
	MDLApprovalStatus *string    `json:"mdl_approval_status"`
	MDLSubmittedAtUTC *time.Time `json:"mdl_submitted_at_utc"`

	RIGWorkStatus     *string    `json:"rig_work_status"`
	RIGApprovalStatus *string    `json:"rig_approval_status"`
	RIGSubmittedAtUTC *time.Time `json:"rig_submitted_at_utc"`

	BLDWorkStatus     *string    `json:"bld_work_status"`
	BLDApprovalStatus *string    `json:"bld_approval_status"`
	BLDSubmittedAtUTC *time.Time `json:"bld_submitted_at_utc"`

	DSNWorkStatus     *string    `json:"dsn_work_status"`
	DSNApprovalStatus *string    `json:"dsn_approval_status"`
	DSNSubmittedAtUTC *time.Time `json:"dsn_submitted_at_utc"`

	LDVWorkStatus     *string    `json:"ldv_work_status"`
	LDVApprovalStatus *string    `json:"ldv_approval_status"`
	LDVSubmittedAtUTC *time.Time `json:"ldv_submitted_at_utc"`
}

// ---- phase row for internal pivot fetch ----
type phaseRow struct {
	Project        string     `gorm:"column:project"`
	Root           string     `gorm:"column:root"`
	Group1         string     `gorm:"column:group_1"`
	Relation       string     `gorm:"column:relation"`
	Phase          string     `gorm:"column:phase"`
	WorkStatus     *string    `gorm:"column:work_status"`
	ApprovalStatus *string    `gorm:"column:approval_status"`
	SubmittedAtUTC *time.Time `gorm:"column:submitted_at_utc"`

	LeafGroupName     string `gorm:"column:leaf_group_name"`
	GroupCategoryPath string `gorm:"column:group_category_path"`
	TopGroupNode      string `gorm:"column:top_group_node"`
}

// ========================================================================
// ===================== GROUP CATEGORY SUPPORT ==========================
// ========================================================================

type SortDirection string

const (
	SortASC  SortDirection = "ASC"
	SortDESC SortDirection = "DESC"
)

type GroupedAssetBucket struct {
	TopGroupNode string       `json:"top_group_node"`
	ItemCount    int          `json:"item_count"`
	Items        []AssetPivot `json:"items"`
	TotalCount   *int         `json:"total_count"`
}

func buildGlobalSubmittedAtExpr() string {
	return `
		GREATEST(
			mdl_submitted_at_utc,
			rig_submitted_at_utc,
			bld_submitted_at_utc,
			dsn_submitted_at_utc,
			ldv_submitted_at_utc
		)
	`
}

func GroupAndSortByTopNode(
	rows []AssetPivot,
	dir SortDirection,
) []GroupedAssetBucket {

	grouped := make(map[string][]AssetPivot)
	order := make([]string, 0)

	// ---- group rows preserving order ----
	for _, row := range rows {
		key := strings.TrimSpace(row.TopGroupNode)
		if key == "" {
			key = "Unassigned"
		}

		if _, exists := grouped[key]; !exists {
			grouped[key] = []AssetPivot{}
			order = append(order, key)
		}

		grouped[key] = append(grouped[key], row)
	}

	// ---- sort group headers ----
	isUnassigned := func(s string) bool {
		return strings.EqualFold(strings.TrimSpace(s), "unassigned")
	}

	sort.SliceStable(order, func(i, j int) bool {
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

		return strings.ToLower(ai) < strings.ToLower(aj)
	})

	// ---- build result ----
	result := make([]GroupedAssetBucket, 0, len(order))
	for _, key := range order {
		items := grouped[key]
		count := len(items)

		result = append(result, GroupedAssetBucket{
			TopGroupNode: key,
			ItemCount:    count,
			Items:        items,
		})
	}

	return result
}

// ========================================================================
// ========================= HELPER FUNCTIONS =============================
// ========================================================================

// Helper to convert slice to lowercase
func toLowerSlice(strs []string) []string {
	result := make([]string, len(strs))
	for i, s := range strs {
		result[i] = strings.ToLower(strings.TrimSpace(s))
	}
	return result
}

// Helper to build status condition
func buildStatusCondition(db *gorm.DB, approvalStatuses, workStatuses []string) *gorm.DB {
	if len(approvalStatuses) == 0 && len(workStatuses) == 0 {
		return db
	}

	var conditions []string
	var args []interface{}

	if len(approvalStatuses) > 0 {
		conditions = append(conditions, "LOWER(approval_status) IN (?)")
		args = append(args, toLowerSlice(approvalStatuses))
	}

	if len(workStatuses) > 0 {
		conditions = append(conditions, "LOWER(work_status) IN (?)")
		args = append(args, toLowerSlice(workStatuses))
	}

	if len(conditions) == 1 {
		return db.Where(conditions[0], args[0])
	}

	// OR condition between approval and work status
	return db.Where("("+strings.Join(conditions, " OR ")+")", args...)
}

// ORDER BY builder - FIXED for global sorting
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

	switch key {
	case "submitted_at_utc", "modified_at_utc", "phase":
		return col(key) + " " + dir

	case "group1_only", "name", "group_1":
		return fmt.Sprintf(
			"LOWER(%s) %s, LOWER(%s) %s",
			col("group_1"), dir,
			col("relation"), dir,
		)

	case "relation_only":
		return fmt.Sprintf(
			"LOWER(%s) %s, LOWER(%s) %s",
			col("relation"), dir,
			col("group_1"), dir,
		)

	case "group_rel_submitted":
		return fmt.Sprintf(
			"LOWER(%s) %s, LOWER(%s) %s, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir,
			col("relation"), dir,
			col("submitted_at_utc"),
			col("submitted_at_utc"), dir,
		)

	// Phase-specific sorting - these will be handled in post-processing
	case "mdl_submitted", "rig_submitted", "bld_submitted", "dsn_submitted", "ldv_submitted",
		"mdl_work", "rig_work", "bld_work", "dsn_work", "ldv_work",
		"mdl_appr", "rig_appr", "bld_appr", "dsn_appr", "ldv_appr":
		// Default ordering for SQL query - final sorting done in memory
		return fmt.Sprintf(
			"LOWER(%s) ASC, LOWER(%s) ASC",
			col("group_1"),
			col("relation"),
		)

	default:
		return fmt.Sprintf(
			"LOWER(%s) %s, LOWER(%s) %s",
			col("group_1"), dir,
			col("relation"), dir,
		)
	}
}

// Get pivot column value for sorting
func getPivotColumnValue(row AssetPivot, orderKey string) interface{} {
	parts := strings.Split(orderKey, "_")
	if len(parts) < 2 {
		return nil
	}

	phase := strings.ToUpper(parts[0])
	column := strings.Join(parts[1:], "_")

	switch phase {
	case "MDL":
		switch column {
		case "work":
			return row.MDLWorkStatus
		case "appr":
			return row.MDLApprovalStatus
		case "submitted":
			return row.MDLSubmittedAtUTC
		}
	case "RIG":
		switch column {
		case "work":
			return row.RIGWorkStatus
		case "appr":
			return row.RIGApprovalStatus
		case "submitted":
			return row.RIGSubmittedAtUTC
		}
	case "BLD":
		switch column {
		case "work":
			return row.BLDWorkStatus
		case "appr":
			return row.BLDApprovalStatus
		case "submitted":
			return row.BLDSubmittedAtUTC
		}
	case "DSN":
		switch column {
		case "work":
			return row.DSNWorkStatus
		case "appr":
			return row.DSNApprovalStatus
		case "submitted":
			return row.DSNSubmittedAtUTC
		}
	case "LDV":
		switch column {
		case "work":
			return row.LDVWorkStatus
		case "appr":
			return row.LDVApprovalStatus
		case "submitted":
			return row.LDVSubmittedAtUTC
		}
	}

	return nil
}

// Compare two values for sorting
func compareValues(a, b interface{}, direction string) bool {
	if a == nil && b == nil {
		return false
	}
	if a == nil {
		return direction == "DESC" // NULLs last for ASC, first for DESC
	}
	if b == nil {
		return direction != "DESC" // NULLs last for ASC, first for DESC
	}

	switch v := a.(type) {
	case *string:
		if v != nil && b.(*string) != nil {
			si := strings.ToLower(*v)
			sj := strings.ToLower(*b.(*string))
			result := si < sj
			if direction == "DESC" {
				return !result
			}
			return result
		}
	case *time.Time:
		if v != nil && b.(*time.Time) != nil {
			ti := *v
			tj := *b.(*time.Time)
			result := ti.Before(tj)
			if direction == "DESC" {
				return !result
			}
			return result
		}
	}
	return false
}

// Sort pivot rows by phase-specific columns
func sortPivotRowsByPhase(rows []AssetPivot, orderKey, direction string) []AssetPivot {
	sort.SliceStable(rows, func(i, j int) bool {
		iVal := getPivotColumnValue(rows[i], orderKey)
		jVal := getPivotColumnValue(rows[j], orderKey)

		// First compare by the phase-specific column
		result := compareValues(iVal, jVal, direction)
		if result || (iVal == nil && jVal == nil) {
			// If values are equal or both nil, then sort by name
			gi := strings.ToLower(rows[i].Group1)
			gj := strings.ToLower(rows[j].Group1)
			if gi != gj {
				return gi < gj
			}
			// If names are equal, sort by relation
			ri := strings.ToLower(rows[i].Relation)
			rj := strings.ToLower(rows[j].Relation)
			return ri < rj
		}

		return result
	})

	return rows
}

// ========================================================================
// ========================= GORM QUERY METHODS ===========================
// ========================================================================

// CountLatestSubmissions returns total asset count (for pagination) after filters.
func (r *ReviewInfo) CountLatestSubmissions(
	ctx context.Context,
	project, root, assetNameKey string,
	preferredPhase string,
	approvalStatuses []string,
	workStatuses []string,
) (int64, error) {
	if project == "" {
		return 0, fmt.Errorf("project is required")
	}
	if root == "" {
		root = "assets"
	}

	db := r.db.WithContext(ctx).Model(&model.ReviewInfo{})

	// Subquery: latest record per asset-phase
	latestPhaseSubquery := db.
		Select(`
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
		`).
		Where("project = ?", project).
		Where("root = ?", root).
		Where("deleted = ?", 0)

	if assetNameKey != "" {
		latestPhaseSubquery = latestPhaseSubquery.
			Where("LOWER(group_1) LIKE ?", strings.ToLower(assetNameKey)+"%")
	}

	// Count distinct assets from the filtered latest phase records
	countQuery := r.db.WithContext(ctx).
		Table("(?) as latest_phase", latestPhaseSubquery).
		Select("COUNT(DISTINCT CONCAT(project, '|', root, '|', group_1, '|', relation))").
		Where("rn = ?", 1)

	// Apply status filters
	countQuery = buildStatusCondition(countQuery, approvalStatuses, workStatuses)

	var total int64
	err := countQuery.Scan(&total).Error
	if err != nil {
		return 0, fmt.Errorf("CountLatestSubmissions: %w", err)
	}

	return total, nil
}

// ListLatestSubmissionsDynamic returns one "primary" row per asset for a page.
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

	// Step 1: Get latest modified_at_utc per asset-phase
	latestPhaseQuery := r.db.WithContext(ctx).
		Select(`
			project,
			root,
			group_1,
			relation,
			phase,
			MAX(modified_at_utc) as modified_at_utc
		`).
		Model(&model.ReviewInfo{}).
		Where("project = ?", project).
		Where("root = ?", root).
		Where("deleted = ?", 0)

	if assetNameKey != "" {
		latestPhaseQuery = latestPhaseQuery.
			Where("LOWER(group_1) LIKE ?", strings.ToLower(assetNameKey)+"%")
	}

	latestPhaseQuery = latestPhaseQuery.
		Group("project, root, group_1, relation, phase")

	// Step 2: Join with original table to get full rows
	joinQuery := r.db.WithContext(ctx).
		Select(`
			lp.project,
			lp.root,
			lp.group_1,
			lp.relation,
			lp.phase,
			ri.submitted_at_utc,
			ri.work_status,
			ri.approval_status,
			lp.modified_at_utc
		`).
		Table("(?) as lp", latestPhaseQuery).
		Joins(`
			LEFT JOIN t_review_info as ri 
			ON ri.project = lp.project 
			AND ri.root = lp.root 
			AND ri.group_1 = lp.group_1 
			AND ri.relation = lp.relation 
			AND ri.phase = lp.phase 
			AND ri.modified_at_utc = lp.modified_at_utc 
			AND ri.deleted = 0
		`)

	// Apply status filters
	joinQuery = buildStatusCondition(joinQuery, approvalStatuses, workStatuses)

	// Step 3: Window function to rank assets with phase preference
	// FIXED: Removed conflicting ordering from window function
	rankedQuery := r.db.WithContext(ctx).
		Select(`
			*,
			ROW_NUMBER() OVER (
				PARTITION BY project, root, group_1, relation
				ORDER BY 
					CASE 
						WHEN ? = 1 THEN 0
						WHEN phase = ? THEN 0
						ELSE 1
					END,
					modified_at_utc DESC
			) as asset_rank
		`, func() int {
			if preferredPhase == "" || strings.EqualFold(preferredPhase, "none") {
				return 1
			}
			return 0
		}(), preferredPhase).
		Table("(?) as jq", joinQuery)

	// Step 4: Final query with ordering
	finalQuery := r.db.WithContext(ctx).
		Select(`
			root,
			project,
			group_1,
			relation,
			phase,
			submitted_at_utc
		`).
		Table("(?) as ranked", rankedQuery).
		Where("asset_rank = ?", 1).
		Order(buildOrderClause("", orderKey, direction)).
		Limit(limit).
		Offset(offset)

	var rows []LatestSubmissionRow
	err := finalQuery.Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("ListLatestSubmissionsDynamic: %w", err)
	}

	return rows, nil
}

// ListAssetsPivotResult is the result structure for ListAssetsPivot.
type ListAssetsPivotResult struct {
	Assets   []AssetPivot         `json:"assets,omitempty"`
	Groups   []GroupedAssetBucket `json:"groups,omitempty"`
	Total    int64                `json:"total"`
	Page     int                  `json:"page"`
	PerPage  int                  `json:"per_page"`
	PageLast int                  `json:"page_last,omitempty"`
	HasNext  bool                 `json:"has_next,omitempty"`
	HasPrev  bool                 `json:"has_prev,omitempty"`
	Sort     string               `json:"sort,omitempty"`
	Dir      string               `json:"dir,omitempty"`
}

// ListAssetsPivotParams defines the parameters for ListAssetsPivot.
type ListAssetsPivotParams struct {
	Project          string   `json:"project"`
	Root             string   `json:"root"`
	View             string   `json:"view"`
	Page             int      `json:"page"`
	PerPage          int      `json:"per_page"`
	OrderKey         string   `json:"order_key"`
	Direction        string   `json:"direction"`
	ApprovalStatuses []string `json:"approval_statuses"`
	WorkStatuses     []string `json:"work_statuses"`
}

func (r *ReviewInfo) ListAssetsPivot(
	db *gorm.DB,
	p ListAssetsPivotParams,
) (*ListAssetsPivotResult, error) {

	if p.Project == "" {
		return nil, fmt.Errorf("project is required")
	}

	if p.Root == "" {
		p.Root = "assets"
	}

	if p.PerPage <= 0 {
		p.PerPage = 15
	}
	if p.Page <= 0 {
		p.Page = 1
	}

	limit := p.PerPage
	offset := (p.Page - 1) * p.PerPage

	// normalize dir
	dir := strings.ToUpper(strings.TrimSpace(p.Direction))
	if dir != "ASC" && dir != "DESC" {
		dir = "ASC"
	}

	isGroupedView :=
		p.View == "group" ||
			p.View == "grouped" ||
			p.View == "category"

	// ---------------------------------------------------------------------
	// BASE PIVOT QUERY (ALREADY EXISTS IN YOUR FILE)
	// ---------------------------------------------------------------------
	pivotQuery := r.buildAssetPivotQuery(db, p)

	// ---------------------------------------------------------------------
	// GLOBAL SUBMITTED AT (FOR GLOBAL SORTING)
	// ---------------------------------------------------------------------
	globalSubmittedExpr := `
		GREATEST(
			mdl_submitted_at_utc,
			rig_submitted_at_utc,
			bld_submitted_at_utc,
			dsn_submitted_at_utc,
			ldv_submitted_at_utc
		)
	`

	// =====================================================================
	// ============================ LIST VIEW ===============================
	// =====================================================================
	if !isGroupedView {

		q := db.Table("(?) AS p", pivotQuery).
			Select("p.*, " + globalSubmittedExpr + " AS global_submitted_at")

		// ---------- FILTERS ----------
		if len(p.ApprovalStatuses) > 0 {
			q = q.Where(
				"(mdl_approval_status IN ? OR rig_approval_status IN ? OR bld_approval_status IN ? OR dsn_approval_status IN ? OR ldv_approval_status IN ?)",
				p.ApprovalStatuses,
				p.ApprovalStatuses,
				p.ApprovalStatuses,
				p.ApprovalStatuses,
				p.ApprovalStatuses,
			)
		}

		if len(p.WorkStatuses) > 0 {
			q = q.Where(
				"(mdl_work_status IN ? OR rig_work_status IN ? OR bld_work_status IN ? OR dsn_work_status IN ? OR ldv_work_status IN ?)",
				p.WorkStatuses,
				p.WorkStatuses,
				p.WorkStatuses,
				p.WorkStatuses,
				p.WorkStatuses,
			)
		}

		// ---------- COUNT ----------
		var total int64
		if err := q.Count(&total).Error; err != nil {
			return nil, err
		}

		// ---------- SORT COLUMN ----------
		orderCol := "global_submitted_at"

		switch p.OrderKey {
		case "mdl_submitted":
			orderCol = "mdl_submitted_at_utc"
		case "rig_submitted":
			orderCol = "rig_submitted_at_utc"
		case "bld_submitted":
			orderCol = "bld_submitted_at_utc"
		case "dsn_submitted":
			orderCol = "dsn_submitted_at_utc"
		case "ldv_submitted":
			orderCol = "ldv_submitted_at_utc"
		}

		q = q.Order(fmt.Sprintf("%s %s NULLS LAST", orderCol, dir)).
			Limit(limit).
			Offset(offset)

		var rows []AssetPivot
		if err := q.Scan(&rows).Error; err != nil {
			return nil, err
		}

		lastPage := int(math.Ceil(float64(total) / float64(limit)))

		return &ListAssetsPivotResult{
			Assets:   rows,
			Total:    total,
			Page:     p.Page,
			PerPage:  p.PerPage,
			PageLast: lastPage,
			HasNext:  p.Page < lastPage,
			HasPrev:  p.Page > 1,
			Sort:     p.OrderKey,
			Dir:      dir,
		}, nil
	}

	// =====================================================================
	// ========================== GROUPED VIEW ==============================
	// =====================================================================

	q := db.Table("(?) AS p", pivotQuery).
		Select("p.*, " + globalSubmittedExpr + " AS global_submitted_at")

	// ---------- FILTERS ----------
	if len(p.ApprovalStatuses) > 0 {
		q = q.Where(
			"(mdl_approval_status IN ? OR rig_approval_status IN ? OR bld_approval_status IN ? OR dsn_approval_status IN ? OR ldv_approval_status IN ?)",
			p.ApprovalStatuses,
			p.ApprovalStatuses,
			p.ApprovalStatuses,
			p.ApprovalStatuses,
			p.ApprovalStatuses,
		)
	}

	if len(p.WorkStatuses) > 0 {
		q = q.Where(
			"(mdl_work_status IN ? OR rig_work_status IN ? OR bld_work_status IN ? OR dsn_work_status IN ? OR ldv_work_status IN ?)",
			p.WorkStatuses,
			p.WorkStatuses,
			p.WorkStatuses,
			p.WorkStatuses,
			p.WorkStatuses,
		)
	}

	// ---------- SORT COLUMN ----------
	orderCol := "global_submitted_at"

	switch p.OrderKey {
	case "mdl_submitted":
		orderCol = "mdl_submitted_at_utc"
	case "rig_submitted":
		orderCol = "rig_submitted_at_utc"
	case "bld_submitted":
		orderCol = "bld_submitted_at_utc"
	case "dsn_submitted":
		orderCol = "dsn_submitted_at_utc"
	case "ldv_submitted":
		orderCol = "ldv_submitted_at_utc"
	}

	q = q.Order(fmt.Sprintf("%s %s NULLS LAST", orderCol, dir))

	var rows []AssetPivot
	if err := q.Scan(&rows).Error; err != nil {
		return nil, err
	}

	// ---------- GROUP (ORDER PRESERVED) ----------
	groups := GroupAndSortByTopNode(rows, SortDirection(dir))

	return &ListAssetsPivotResult{
		Groups:  groups,
		Total:   int64(len(rows)),
		Page:    1,
		PerPage: len(rows),
		Sort:    p.OrderKey,
		Dir:     dir,
	}, nil
}
