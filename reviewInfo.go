package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/PolygonPictures/central30-web/front/entity"
	"github.com/PolygonPictures/central30-web/front/repository/model"
	"gorm.io/gorm"
)

const (
	PhaseMDL   = "mdl"
	PhaseRIG   = "rig"
	PhaseBLD   = "bld"
	PhaseDSN   = "dsn"
	RootAssets = "assets"
)

type ReviewInfo struct {
	db *gorm.DB
}

func NewReviewInfo(db *gorm.DB) (*ReviewInfo, error) {
	info := model.ReviewInfo{}

	// Specification change: https://jira.ppi.co.jp/browse/POTOO-2406
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

	// fmt.Printf("ListAssets A >>>>>>>>>>>>>>>>>>  %s\n", stmt.Statement.SQL.String())

	var reviews []*model.ReviewInfo
	perPage := params.GetPerPage()
	offset := perPage * (params.GetPage() - 1)
	if err := stmt.Select(
		"project", "root", "group_1", "relation",
	).Limit(perPage).Offset(offset).Find(&reviews).Error; err != nil {
		return nil, 0, err
	}

	// fmt.Printf("ListAssets >>>>>>>>>>>>>>>>>>  %s\n", stmt.Statement.SQL.String())
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

	//  print stmt for debug
	// fmt.Printf("ListAssetReviewInfos >>>>>>>>>>>>>>>>>>  SQL: %s\n", stmt.Statement.SQL.String())
	var reviews []*model.ReviewInfo
	if err := stmt.Scan(&reviews).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	// fmt.Printf("ListAssetReviewInfos >>>>>>>>>>>>>>>>>>\n", reviews)
	// Map reviews to entity.ReviewInfo
	reviewInfos := make([]*entity.ReviewInfo, len(reviews))
	for i, review := range reviews {
		reviewInfos[i] = review.Entity(false)
	}

	var reviewObj []entity.ReviewInfo
	for _, r := range reviewInfos {
		reviewObj = append(reviewObj, *r)
	}

	fmt.Printf(" === reviewObj >>>>>>>>>>>>>>>>>> %v\n", reviewObj)

	return reviewInfos, nil
}

// ListLatestSubmissions implements the raw SQL query to get the latest submission time for each asset group.
func (r *ReviewInfo) ListAssetReviewPivot(
	db *gorm.DB,
	params *entity.AssetReviewListParams,
) ([]map[string]interface{}, int, error) {

	if params == nil {
		return nil, 0, fmt.Errorf("params is nil")
	}
	if params.Project == "" {
		return nil, 0, fmt.Errorf("project is required")
	}

	// --- Pagination Setup (Based on your image) ---
	perPage := params.GetPerPage()
	if perPage <= 0 {
		perPage = 25
	}

	page := params.GetPage()
	if page <= 0 {
		page = 1
	}
	offset := perPage * (page - 1)

	// --- Dynamic Ordering Logic (Crucial for the feature) ---
	// Whitelist allowed columns to prevent SQL injection
	validSortColumns := map[string]bool{
		"group_1": true, "relation": true,
		"mdl_work_status": true, "mdl_approval_status": true, "mdl_submitted_at_utc": true,
		"rig_work_status": true, "rig_approval_status": true, "rig_submitted_at_utc": true,
		"bld_work_status": true, "bld_approval_status": true, "bld_submitted_at_utc": true,
		"dsn_work_status": true, "dsn_approval_status": true, "dsn_submitted_at_utc": true,
		"ldv_work_status": true, "ldv_approval_status": true, "ldv_submitted_at_utc": true,
	}

	sortColumn := "group_1" // Default sort column
	if params.SortBy != "" && validSortColumns[params.SortBy] {
		sortColumn = params.SortBy
	}

	sortOrder := "ASC" // Default sort order
	if strings.ToUpper(params.SortOrder) == "DESC" {
		sortOrder = "DESC"
	}

	// Construct the dynamic ORDER BY clause
	orderByClause := fmt.Sprintf("ORDER BY %s %s", sortColumn, sortOrder)
	// -------------------------------------------------------------------

	var total int64
	countSQL := `
	SELECT count(*) AS total_rows
	from (SELECT root, project, group_1, relation,  MAX(submitted_at_utc) AS max_ts
	FROM t_review_info where project =? and root = ?
	GROUP BY root, project, group_1, relation) as sub ;`

	if err := db.Raw(countSQL, params.Project, "assets").Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	sqlTemplate := `
SELECT
  t.root,
  t.project,
  t.group_1,
  t.relation,

  /* MDL */
  MAX(CASE WHEN t.phase = 'mdl' THEN t.work_status END)      AS mdl_work_status,
  MAX(CASE WHEN t.phase = 'mdl' THEN t.approval_status END)  AS mdl_approval_status,
  MAX(CASE WHEN t.phase = 'mdl' THEN t.submitted_at_utc END) AS mdl_submitted_at_utc,

  /* RIG */
  MAX(CASE WHEN t.phase = 'rig' THEN t.work_status END)      AS rig_work_status,
  MAX(CASE WHEN t.phase = 'rig' THEN t.approval_status END)  AS rig_approval_status,
  MAX(CASE WHEN t.phase = 'rig' THEN t.submitted_at_utc END) AS rig_submitted_at_utc,

  /* BLD */
  MAX(CASE WHEN t.phase = 'bld' THEN t.work_status END)      AS bld_work_status,
  MAX(CASE WHEN t.phase = 'bld' THEN t.approval_status END)  AS bld_approval_status,
  MAX(CASE WHEN t.phase = 'bld' THEN t.submitted_at_utc END) AS bld_submitted_at_utc,

  /* DSN */
  MAX(CASE WHEN t.phase = 'dsn' THEN t.work_status END)      AS dsn_work_status,
  MAX(CASE WHEN t.phase = 'dsn' THEN t.approval_status END)  AS dsn_approval_status,
  MAX(CASE WHEN t.phase = 'dsn' THEN t.submitted_at_utc END) AS dsn_submitted_at_utc,

  /* LDV */
  MAX(CASE WHEN t.phase = 'ldv' THEN t.work_status END)      AS ldv_work_status,
  MAX(CASE WHEN t.phase = 'ldv' THEN t.approval_status END)  AS ldv_approval_status,
  MAX(CASE WHEN t.phase = 'ldv' THEN t.submitted_at_utc END) AS ldv_submitted_at_utc

FROM (
  SELECT
	r.*,
	ROW_NUMBER() OVER (
	  PARTITION BY r.project, r.root, r.group_1, r.relation, r.phase
	  ORDER BY r.submitted_at_utc DESC, r.modified_at_utc DESC, r.id DESC
	) AS rn
  FROM t_review_info r
  WHERE r.project  = ?
	AND r.root     = 'assets'
	AND ( ? = '' OR r.relation = ? )
	AND r.deleted  = 0
) AS t
WHERE t.rn = 1
GROUP BY t.root, t.project, t.group_1, t.relation
%s 
LIMIT ? OFFSET ?;`

	// Inject the dynamic ORDER BY clause
	sqlStr := fmt.Sprintf(sqlTemplate, orderByClause)

	args := []interface{}{
		params.Project,
		params.Relation, params.Relation,
		perPage, offset,
	}

	var reviews []map[string]interface{}
	// NOTE: This is where you would log sqlStr and args if debugging the empty table issue.
	if err := db.Raw(sqlStr, args...).Scan(&reviews).Error; err != nil {
		return nil, 0, err
	}

	// fmt.Printf("ListAssetReviewPivot >>>>>>>>>>>>>>>>>>  args: %v\n", len(reviews))
	// fmt.Printf("ListAssetReviewPivot >>>>>>>>>>>>>>>>>>  reviews: %v\n", reviews)
	return reviews, int(total), nil
}
