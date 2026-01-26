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

/* -─────────────────────────────────────────────────────────────────────────
	Assets and Latest Submission Rows
───────────────────────────────────────────────────────────────────────────
*/

// type ReviewInfo struct {
//     db *gorm.DB
// }

// func NewReviewInfo(db *gorm.DB) *ReviewInfo {
//     return &ReviewInfo{db: db}
// }

// func (r *ReviewInfo) WithContext(ctx context.Context) *gorm.DB {
//     return r.db.WithContext(ctx)
// }

// func (r *ReviewInfo) TransactionWithContext(ctx context.Context, fn func(*gorm.DB) error) error {
//     return r.db.WithContext(ctx).Transaction(fn)
// }

/* =========================
   DATA MODELS
========================= */

type phaseRow struct {
	Project           string
	Root              string
	Group1            string
	Relation          string
	LeafGroupName     string
	GroupCategoryPath string
	TopGroupNode      string
	Phase             string
	WorkStatus        string
	ApprovalStatus    string
	SubmittedAtUTC    *time.Time
}

type AssetPivot struct {
	Project           string
	Root              string
	Group1            string
	Relation          string
	LeafGroupName     string
	GroupCategoryPath string
	TopGroupNode      string

	MDLWorkStatus     string
	MDLApprovalStatus string
	MDLSubmittedAtUTC *time.Time
	RIGWorkStatus     string
	RIGApprovalStatus string
	RIGSubmittedAtUTC *time.Time
	BLDWorkStatus     string
	BLDApprovalStatus string
	BLDSubmittedAtUTC *time.Time
	DSNWorkStatus     string
	DSNApprovalStatus string
	DSNSubmittedAtUTC *time.Time
	LDVWorkStatus     string
	LDVApprovalStatus string
	LDVSubmittedAtUTC *time.Time
}

/* =========================
   GROUPING (GO SIDE)
========================= */

type GroupedAssetBucket struct {
	TopGroup string
	Assets   []AssetPivot
}

type SortDirection string

const (
	SortAsc  SortDirection = "ASC"
	SortDesc SortDirection = "DESC"
)

func GroupAndSortByTopNode(
	assets []AssetPivot,
	dir SortDirection,
) []GroupedAssetBucket {

	m := make(map[string][]AssetPivot)

	for _, a := range assets {
		key := a.TopGroupNode
		if key == "" {
			key = "Ungrouped"
		}
		m[key] = append(m[key], a)
	}

	result := make([]GroupedAssetBucket, 0, len(m))
	for k, v := range m {
		result = append(result, GroupedAssetBucket{
			TopGroup: k,
			Assets:   v,
		})
	}

	sortFn := func(i, j int) bool {
		if dir == SortDesc {
			return result[i].TopGroup > result[j].TopGroup
		}
		return result[i].TopGroup < result[j].TopGroup
	}

	sort.Slice(result, sortFn)
	return result
}

/* =========================
   MAIN QUERY (OPTIMIZED - NO DEADLOCKS)
========================= */

func (r *ReviewInfo) ListAssetsPivot(
	ctx context.Context,
	project, root, preferredPhase, orderKey, direction string,
	limit, offset int,
	assetNameKey string,
	approvalStatuses []string,
	workStatuses []string,
) ([]AssetPivot, int64, error) {

	// Validate required parameters
	if project == "" {
		return nil, 0, fmt.Errorf("project is required")
	}
	if root == "" {
		root = "assets"
	}

	// Set defaults
	if orderKey == "" {
		orderKey = "group_1"
	}
	if direction == "" {
		direction = "asc"
	}
	direction = strings.ToUpper(direction)
	if direction != "ASC" && direction != "DESC" {
		direction = "ASC"
	}

	// Check context before starting
	select {
	case <-ctx.Done():
		return nil, 0, ctx.Err()
	default:
		// Continue
	}

	// ---------- STEP 1: BUILD BASE FILTERS ----------
	baseQuery := r.db.WithContext(ctx).
		Table("t_review_info").
		Where("project = ? AND root = ? AND deleted = 0", project, root)

	if assetNameKey != "" {
		baseQuery = baseQuery.Where("LOWER(group_1) LIKE ?", strings.ToLower(assetNameKey)+"%")
	}

	statusWhere, statusArgs := buildPhaseAwareStatusWhere(
		preferredPhase,
		approvalStatuses,
		workStatuses,
	)
	if statusWhere != "" {
		baseQuery = baseQuery.Where(statusWhere, statusArgs...)
	}

	// ---------- STEP 2: GET TOTAL COUNT (Optimized) ----------
	// Use a separate session for count query to prevent state pollution
	countQuery := baseQuery.Session(&gorm.Session{})

	// Count distinct assets (project+root+group1+relation)
	var total int64
	if err := countQuery.
		Distinct("project, root, group_1, relation").
		Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count assets: %w", err)
	}

	// Early return if no results
	if total == 0 || (limit > 0 && offset >= int(total)) {
		return []AssetPivot{}, total, nil
	}

	// ---------- STEP 3: GET PAGINATED DATA ----------
	var rows []phaseRow

	// Use separate session for data query
	dataQuery := baseQuery.Session(&gorm.Session{})

	// Build order clause
	orderClause := buildOrderClause(preferredPhase, orderKey, direction)

	// Execute paginated query
	if err := dataQuery.
		Select(`
            project, root, group_1 as group1, relation,
            leaf_group_name,
            group_category_path,
            top_group_node,
            phase,
            work_status,
            approval_status,
            submitted_at_utc
        `).
		Order(orderClause).
		Limit(limit).
		Offset(offset).
		Scan(&rows).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to fetch asset data: %w", err)
	}

	// ---------- STEP 4: PIVOT RESULTS IN MEMORY ----------
	pivot := make(map[string]*AssetPivot)

	for _, row := range rows {
		// Create unique key for each asset
		key := fmt.Sprintf("%s|%s|%s|%s",
			row.Project, row.Root, row.Group1, row.Relation)

		if _, exists := pivot[key]; !exists {
			pivot[key] = &AssetPivot{
				Project:           row.Project,
				Root:              row.Root,
				Group1:            row.Group1,
				Relation:          row.Relation,
				LeafGroupName:     row.LeafGroupName,
				GroupCategoryPath: row.GroupCategoryPath,
				TopGroupNode:      row.TopGroupNode,
			}
		}

		// Fill phase-specific fields
		p := pivot[key]
		phaseLower := strings.ToLower(row.Phase)

		switch phaseLower {
		case "mdl":
			p.MDLWorkStatus = row.WorkStatus
			p.MDLApprovalStatus = row.ApprovalStatus
			p.MDLSubmittedAtUTC = row.SubmittedAtUTC
		case "rig":
			p.RIGWorkStatus = row.WorkStatus
			p.RIGApprovalStatus = row.ApprovalStatus
			p.RIGSubmittedAtUTC = row.SubmittedAtUTC
		case "bld":
			p.BLDWorkStatus = row.WorkStatus
			p.BLDApprovalStatus = row.ApprovalStatus
			p.BLDSubmittedAtUTC = row.SubmittedAtUTC
		case "dsn":
			p.DSNWorkStatus = row.WorkStatus
			p.DSNApprovalStatus = row.ApprovalStatus
			p.DSNSubmittedAtUTC = row.SubmittedAtUTC
		case "ldv":
			p.LDVWorkStatus = row.WorkStatus
			p.LDVApprovalStatus = row.ApprovalStatus
			p.LDVSubmittedAtUTC = row.SubmittedAtUTC
		}
	}

	// Convert map to slice
	result := make([]AssetPivot, 0, len(pivot))
	for _, asset := range pivot {
		result = append(result, *asset)
	}

	return result, total, nil
}

/* =========================
   HELPER FUNCTIONS
========================= */

func buildPhaseAwareStatusWhere(
	preferredPhase string,
	approvalStatuses []string,
	workStatuses []string,
) (string, []interface{}) {

	var conditions []string
	var args []interface{}

	if preferredPhase != "" {
		conditions = append(conditions, "phase = ?")
		args = append(args, strings.ToUpper(preferredPhase))
	}

	if len(approvalStatuses) > 0 {
		placeholders := strings.Repeat("?,", len(approvalStatuses)-1) + "?"
		conditions = append(conditions, "approval_status IN ("+placeholders+")")
		for _, status := range approvalStatuses {
			args = append(args, status)
		}
	}

	if len(workStatuses) > 0 {
		placeholders := strings.Repeat("?,", len(workStatuses)-1) + "?"
		conditions = append(conditions, "work_status IN ("+placeholders+")")
		for _, status := range workStatuses {
			args = append(args, status)
		}
	}

	if len(conditions) == 0 {
		return "", nil
	}

	return strings.Join(conditions, " AND "), args
}

func buildOrderClause(preferredPhase, orderKey, direction string) string {
	if orderKey == "" {
		orderKey = "group_1"
	}

	if direction == "" {
		direction = "ASC"
	}

	direction = strings.ToUpper(direction)
	if direction != "ASC" && direction != "DESC" {
		direction = "ASC"
	}

	// If preferred phase is specified, prioritize assets in that phase
	if preferredPhase != "" {
		return fmt.Sprintf(
			"CASE WHEN LOWER(phase) = LOWER('%s') THEN 0 ELSE 1 END, %s %s",
			preferredPhase,
			orderKey,
			direction,
		)
	}

	return fmt.Sprintf("%s %s", orderKey, direction)
}

/* =========================
   CRUD METHODS
========================= */

// func (r *ReviewInfo) List(db *gorm.DB, params *entity.ListReviewInfoParams) ([]*entity.ReviewInfo, int, error) {
// 	var results []*entity.ReviewInfo
// 	var total int64

// 	query := db.Table("t_review_info").
// 		Where("project = ? AND deleted = 0", params.Project)

// 	if params.Studio != nil && *params.Studio != "" {
// 		query = query.Where("studio = ?", *params.Studio)
// 	}

// 	// Get total count
// 	if err := query.Count(&total).Error; err != nil {
// 		return nil, 0, err
// 	}

// 	// Get paginated results
// 	if err := query.
// 		Offset(params.Offset).
// 		Limit(params.Limit).
// 		Order("created_at DESC").
// 		Find(&results).Error; err != nil {
// 		return nil, 0, err
// 	}

// 	return results, int(total), nil
// }

// func (r *ReviewInfo) Get(db *gorm.DB, params *entity.GetReviewParams) (*entity.ReviewInfo, error) {
// 	var result entity.ReviewInfo

// 	err := db.Table("t_review_info").
// 		Where("project = ? AND root = ? AND group_1 = ? AND relation = ? AND phase = ?",
// 			params.Project, params.Root, params.Group1, params.Relation, params.Phase).
// 		Where("deleted = 0").
// 		First(&result).Error

// 	if err != nil {
// 		return nil, err
// 	}

// 	return &result, nil
// }

// func (r *ReviewInfo) Create(db *gorm.DB, params *entity.CreateReviewInfoParams) (*entity.ReviewInfo, error) {
// 	now := time.Now().UTC()

// 	review := &entity.ReviewInfo{
// 		Project:        params.Project,
// 		Root:           params.Root,
// 		Group1:         params.Group1,
// 		Relation:       params.Relation,
// 		Phase:          params.Phase,
// 		WorkStatus:     params.WorkStatus,
// 		ApprovalStatus: params.ApprovalStatus,
// 		Studio:         params.Studio,
// 		SubmittedAtUTC: params.SubmittedAtUTC,
// 		CreatedAt:      &now,
// 		UpdatedAt:      &now,
// 	}

// 	err := db.Table("t_review_info").Create(review).Error
// 	if err != nil {
// 		return nil, err
// 	}

// 	return review, nil
// }

// func (r *ReviewInfo) Update(db *gorm.DB, params *entity.UpdateReviewInfoParams) (*entity.ReviewInfo, error) {
// 	var review entity.ReviewInfo

// 	// Find existing record
// 	err := db.Table("t_review_info").
// 		Where("project = ? AND root = ? AND group_1 = ? AND relation = ? AND phase = ?",
// 			params.Project, params.Root, params.Group1, params.Relation, params.Phase).
// 		Where("deleted = 0").
// 		First(&review).Error

// 	if err != nil {
// 		return nil, fmt.Errorf("review not found: %w", err)
// 	}

// 	// Update fields
// 	if params.WorkStatus != "" {
// 		review.WorkStatus = params.WorkStatus
// 	}
// 	if params.ApprovalStatus != "" {
// 		review.ApprovalStatus = params.ApprovalStatus
// 	}
// 	if params.SubmittedAtUTC != nil {
// 		review.SubmittedAtUTC = params.SubmittedAtUTC
// 	}

// 	now := time.Now().UTC()
// 	review.UpdatedAt = &now

// 	// Save changes
// 	err = db.Save(&review).Error
// 	if err != nil {
// 		return nil, err
// 	}

// 	return &review, nil
// }

// func (r *ReviewInfo) Delete(db *gorm.DB, params *entity.DeleteReviewInfoParams) error {
// 	// Soft delete - mark as deleted
// 	now := time.Now().UTC()

// 	result := db.Table("t_review_info").
// 		Where("project = ? AND root = ? AND group_1 = ? AND relation = ?",
// 			params.Project, params.Root, params.Group1, params.Relation).
// 		Where("deleted = 0").
// 		Updates(map[string]interface{}{
// 			"deleted":    1,
// 			"updated_at": now,
// 		})

// 	if result.Error != nil {
// 		return result.Error
// 	}

// 	if result.RowsAffected == 0 {
// 		return fmt.Errorf("no records found to delete")
// 	}

// 	return nil
// }
