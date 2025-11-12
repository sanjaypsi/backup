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

// ========================================================================
// ========= Asset Review Pivot Listing ==================================
// =======================================================================

// ---------- Structs for Query Results ----------
type LatestSubmissionRow struct {
	Root           string     `json:"root"              gorm:"column:root"`
	Project        string     `json:"project"           gorm:"column:project"`
	Group1         string     `json:"group_1"           gorm:"column:group_1"`
	Relation       string     `json:"relation"          gorm:"column:relation"`
	Phase          string     `json:"phase"             gorm:"column:phase"`
	SubmittedAtUTC *time.Time `json:"submitted_at_utc"  gorm:"column:submitted_at_utc"`
}

// -- -------- Pivot Result Struct ----------
type AssetPivot struct {
	Root     string `json:"root"`
	Project  string `json:"project"`
	Group1   string `json:"group_1"`
	Relation string `json:"relation"`

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

// ---------- Phase Row Struct ----------
type phaseRow struct {
	Project        string     `gorm:"column:project"`
	Root           string     `gorm:"column:root"`
	Group1         string     `gorm:"column:group_1"`
	Relation       string     `gorm:"column:relation"`
	Phase          string     `gorm:"column:phase"`
	WorkStatus     *string    `gorm:"column:work_status"`
	ApprovalStatus *string    `gorm:"column:approval_status"`
	SubmittedAtUTC *time.Time `gorm:"column:submitted_at_utc"`
}

// helper builds the status-filter subquery, phase-aware when phase != "none".
func buildPhaseAwareStatusFilterSQL(phase string, approvalStatuses, workStatuses []string) (string, []any) {
	// status predicates
	whereParts := []string{}
	if len(approvalStatuses) > 0 {
		whereParts = append(whereParts, fmt.Sprintf("approval_status IN ('%s')", strings.Join(approvalStatuses, "', '")))
	}
	if len(workStatuses) > 0 {
		whereParts = append(whereParts, fmt.Sprintf("work_status IN ('%s')", strings.Join(workStatuses, "', '")))
	}
	if len(whereParts) == 0 {
		return "", nil
	}

	if strings.EqualFold(phase, "none") || phase == "" {
		// ANY-PHASE LATEST per asset (what you had)
		latestStatusSQL := `
SELECT
  group_1, relation
FROM t_review_info AS T1
INNER JOIN (
  SELECT project, root, group_1, relation, MAX(modified_at_utc) AS max_modified
  FROM t_review_info
  WHERE project = ? AND root = ? AND deleted = 0
  GROUP BY project, root, group_1, relation
) AS T2
  ON T1.project = T2.project AND T1.root = T2.root
 AND T1.group_1 = T2.group_1 AND T1.relation = T2.relation
 AND T1.modified_at_utc = T2.max_modified
WHERE T1.project = ? AND T1.root = ? AND T1.deleted = 0
`
		args := []any{}
		args = append(args /* ? */, nil) // we bind later next to project/root
		return fmt.Sprintf(
			"SELECT group_1, relation FROM (%s) AS status_check WHERE %s GROUP BY group_1, relation",
			latestStatusSQL, strings.Join(whereParts, " OR "),
		), args
	}

	// PHASE-SPECIFIC: latest per asset **for that phase**
	latestStatusSQL := `
SELECT
  group_1, relation
FROM t_review_info AS T1
INNER JOIN (
  SELECT project, root, group_1, relation, phase, MAX(modified_at_utc) AS max_modified
  FROM t_review_info
  WHERE project = ? AND root = ? AND deleted = 0 AND phase = ?
  GROUP BY project, root, group_1, relation, phase
) AS T2
  ON T1.project = T2.project AND T1.root = T2.root
 AND T1.group_1 = T2.group_1 AND T1.relation = T2.relation
 AND T1.phase   = T2.phase
 AND T1.modified_at_utc = T2.max_modified
WHERE T1.project = ? AND T1.root = ? AND T1.deleted = 0 AND T1.phase = ?
`
	// We’ll bind: project, root, phase, project, root, phase
	return fmt.Sprintf(
		"SELECT group_1, relation FROM (%s) AS status_check WHERE %s GROUP BY group_1, relation",
		latestStatusSQL, strings.Join(whereParts, " OR "),
	), []any{ /* placeholders: we’ll supply in caller */ }
}

// AND across types; OR within a type; optional phase guard when preferredPhase != "none".
func buildPhaseAwareStatusWhere(preferredPhase string, approvalStatuses, workStatuses []string) (string, []any) {
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

	// Scope to a phase if requested
	if preferredPhase != "" && !strings.EqualFold(preferredPhase, "none") {
		clauses = append(clauses, "LOWER(phase) = ?")
		args = append(args, strings.ToLower(preferredPhase))
	}

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

// ---------- Dynamic Sorting Function (alphabetical; APPR uses approval_status) ----------
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
	// Generic
	case "submitted_at_utc", "modified_at_utc", "phase":
		return col(key) + " " + dir

	// Name / relation
	case "group1_only":
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir, col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	case "relation_only":
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("relation"), dir, col("group_1"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	case "group_rel_submitted":
		return fmt.Sprintf("LOWER(%s) ASC, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)

	// Phase-specific Submitted: date sort, NULLs always last
	case "mdl_submitted", "rig_submitted", "bld_submitted", "dsn_submitted", "ldv_submitted":
		return fmt.Sprintf("(%s IS NULL) ASC, %s %s, LOWER(%s) ASC",
			col("submitted_at_utc"), col("submitted_at_utc"), dir, col("group_1"))

	// WORK columns: alphabetical on work_status, NULLs last
	case "mdl_work", "rig_work", "bld_work", "dsn_work", "ldv_work", "work_status":
		return fmt.Sprintf("(%s IS NULL) ASC, LOWER(%s) %s, LOWER(%s) ASC",
			col("work_status"), col("work_status"), dir, col("group_1"))

	// APPR columns: alphabetical on approval_status, NULLs last  ✅ FIX
	case "mdl_appr", "rig_appr", "bld_appr", "dsn_appr", "ldv_appr":
		return fmt.Sprintf("(%s IS NULL) ASC, LOWER(%s) %s, LOWER(%s) ASC",
			col("approval_status"), col("approval_status"), dir, col("group_1"))

	default:
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir, col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	}
}

// ---------- Count (for pagination total) ----------
// CountLatestSubmissions returns the number of distinct assets (group_1, relation)
// after applying optional filters: assetNameKey, approvalStatuses, workStatuses.
// When preferredPhase != "none", the status filters are applied to the latest
// row **for that phase** per asset. When "none", they are applied to the asset's
// overall latest row (any phase).
func (r *ReviewInfo) CountLatestSubmissions(
	ctx context.Context,
	project string,
	root string,
	assetNameKey string,
	preferredPhase string, // <--- NEW: pass the same phase you use for listing
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

	// Base set: distinct asset keys from t_review_info for this project/root
	// (we group here so we can simply wrap and count the groups later)
	base := db.Model(&model.ReviewInfo{}).
		Where("project = ? AND root = ? AND deleted = 0", project, root).
		Group("project, root, group_1, relation")

	// Optional: asset name contains (case-insensitive typically by collation)
	if key := strings.TrimSpace(assetNameKey); key != "" {
		base = base.Where("group_1 LIKE ?", "%"+key+"%")
	}

	// If no status filters, just count distinct groups from base
	if len(approvalStatuses) == 0 && len(workStatuses) == 0 {
		var total int64
		if err := db.Raw("SELECT COUNT(*) FROM (?) AS x", base).
			Scan(&total).Error; err != nil {
			return 0, err
		}
		return total, nil
	}

	// ---------- Build phase-aware status filter subquery ----------
	// This subquery returns (group_1, relation) that satisfy the status filters
	// at the appropriate "latest" granularity (overall latest vs phase-latest).
	var statusWhereParts []string
	if len(approvalStatuses) > 0 {
		statusWhereParts = append(statusWhereParts,
			fmt.Sprintf("approval_status IN ('%s')", strings.Join(approvalStatuses, "', '")))
	}
	if len(workStatuses) > 0 {
		statusWhereParts = append(statusWhereParts,
			fmt.Sprintf("work_status IN ('%s')", strings.Join(workStatuses, "', '")))
	}
	statusPredicate := strings.Join(statusWhereParts, " OR ")

	var filterSQL string
	var args []any

	if preferredPhase == "" || strings.EqualFold(preferredPhase, "none") {
		// ANY-PHASE: pick the asset's overall latest row (max modified_at_utc)
		filterSQL = fmt.Sprintf(`
SELECT group_1, relation
FROM (
	SELECT T1.*
	FROM t_review_info AS T1
	INNER JOIN (
		SELECT project, root, group_1, relation, MAX(modified_at_utc) AS max_modified
		FROM t_review_info
		WHERE project = ? AND root = ? AND deleted = 0
		GROUP BY project, root, group_1, relation
	) AS T2
	  ON T1.project = T2.project
	 AND T1.root = T2.root
	 AND T1.group_1 = T2.group_1
	 AND T1.relation = T2.relation
	 AND T1.modified_at_utc = T2.max_modified
	WHERE T1.project = ? AND T1.root = ? AND T1.deleted = 0
) AS latest_any
WHERE %s
GROUP BY group_1, relation
`, statusPredicate)
		args = []any{project, root, project, root}
	} else {
		// PHASE-SPECIFIC: latest row for that phase per asset
		filterSQL = fmt.Sprintf(`
SELECT group_1, relation
FROM (
	SELECT T1.*
	FROM t_review_info AS T1
	INNER JOIN (
		SELECT project, root, group_1, relation, phase, MAX(modified_at_utc) AS max_modified
		FROM t_review_info
		WHERE project = ? AND root = ? AND deleted = 0 AND phase = ?
		GROUP BY project, root, group_1, relation, phase
	) AS T2
	  ON T1.project = T2.project
	 AND T1.root = T2.root
	 AND T1.group_1 = T2.group_1
	 AND T1.relation = T2.relation
	 AND T1.phase   = T2.phase
	 AND T1.modified_at_utc = T2.max_modified
	WHERE T1.project = ? AND T1.root = ? AND T1.deleted = 0 AND T1.phase = ?
) AS latest_phase
WHERE %s
GROUP BY group_1, relation
`, statusPredicate)
		args = []any{project, root, preferredPhase, project, root, preferredPhase}
	}

	// Join the base grouped assets with the filtered keys to enforce the status filter.
	joined := base.Joins(
		"INNER JOIN (?) AS filter_keys ON t_review_info.group_1 = filter_keys.group_1 AND t_review_info.relation = filter_keys.relation",
		db.Raw(filterSQL, args...),
	)

	// Final count
	var total int64
	if err := db.Raw("SELECT COUNT(*) FROM (?) AS x", joined).
		Scan(&total).Error; err != nil {
		return 0, err
	}
	return total, nil
}

// ---------- ListLatestSubmissionsDynamic (phase priority is CONDITIONAL) ----------
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

	phaseGuard := 0
	if preferredPhase == "" || strings.EqualFold(preferredPhase, "none") {
		phaseGuard = 1
	}

	orderClauseWindow := buildOrderClause("", orderKey, direction)
	orderClauseInner := buildOrderClause("b", orderKey, direction)

	// Name prefix (case-insensitive)
	nameCond := ""
	var nameArg any
	if strings.TrimSpace(assetNameKey) != "" {
		nameCond = " AND LOWER(group_1) LIKE ?"
		nameArg = strings.ToLower(strings.TrimSpace(assetNameKey)) + "%"
	}

	// Phase-aware status filter
	statusWhere, statusArgs := buildPhaseAwareStatusWhere(preferredPhase, approvalStatuses, workStatuses)

	// Keys subquery (latest per phase, then apply filters)
	keysSQL := `
WITH latest_phase AS (
  SELECT project, root, group_1, relation, phase,
         work_status, approval_status, submitted_at_utc, modified_at_utc,
         ROW_NUMBER() OVER (
           PARTITION BY project, root, group_1, relation, phase
           ORDER BY modified_at_utc DESC
         ) rn
  FROM t_review_info
  WHERE project = ? AND root = ? AND deleted = 0` + nameCond + `
)
SELECT project, root, group_1, relation
FROM latest_phase
WHERE rn = 1` + statusWhere + `
GROUP BY project, root, group_1, relation`

	q := fmt.Sprintf(`
WITH ordered AS (
  SELECT *, ROW_NUMBER() OVER (ORDER BY %s) AS _order
  FROM (
    SELECT b.*
    FROM (
      SELECT project, root, group_1, relation, phase, MAX(modified_at_utc) AS modified_at_utc
      FROM t_review_info
      WHERE project = ? AND root = ? AND deleted = 0
      GROUP BY project, root, group_1, relation, phase
    ) AS a
    LEFT JOIN (
      SELECT root, project, group_1, phase, relation,
             work_status, approval_status, submitted_at_utc, modified_at_utc, executed_computer
      FROM t_review_info
      WHERE project = ? AND root = ? AND deleted = 0
    ) AS b
      ON a.project = b.project AND a.root = b.root AND a.group_1 = b.group_1
     AND a.relation = b.relation AND a.phase = b.phase AND a.modified_at_utc = b.modified_at_utc

    -- keep only assets present in filtered keys
    INNER JOIN ( %s ) AS fk
      ON b.project = fk.project AND b.root = fk.root AND b.group_1 = fk.group_1 AND b.relation = fk.relation

    ORDER BY %s
  ) AS k
),
offset_ordered AS (
  SELECT c.*,
         CASE WHEN ? = 1 THEN c._order
              WHEN c.phase = ? THEN c._order
              ELSE 100000 + c._order END AS __order
  FROM ordered c
),
ranked AS (
  SELECT b.*,
         ROW_NUMBER() OVER (
           PARTITION BY b.root, b.project, b.group_1, b.relation
           ORDER BY CASE WHEN ? = 1 THEN 0 WHEN b.phase = ? THEN 0 ELSE 1 END,
                    LOWER(b.group_1) ASC, LOWER(b.relation) ASC, b.modified_at_utc DESC
         ) AS _rank
  FROM offset_ordered b
)
SELECT root, project, group_1, relation, phase, submitted_at_utc
FROM (SELECT * FROM ranked WHERE _rank = 1) AS t
ORDER BY __order ASC
LIMIT ? OFFSET ?;`, orderClauseWindow, keysSQL, orderClauseInner)

	args := []any{
		// 'a' CTE
		project, root,
		// 'b' join
		project, root,
		// keys subquery params (project, root, [nameArg?], statusArgs...)
		project, root,
	}
	if nameArg != nil {
		args = append(args, nameArg)
	}
	args = append(args, statusArgs...)
	// phase offsets + limit/offset
	args = append(args, phaseGuard, preferredPhase, phaseGuard, preferredPhase, limit, offset)

	var rows []LatestSubmissionRow
	if err := r.db.WithContext(ctx).Raw(q, args...).Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("ListLatestSubmissionsDynamic: %w", err)
	}
	return rows, nil
}

// ---------- ListAssetsPivot (pivot fill) ----------
func (r *ReviewInfo) ListAssetsPivot(
	ctx context.Context,
	project, root, preferredPhase, orderKey, direction string,
	limit, offset int,
	assetNameKey string,
	approvalStatuses []string,
	workStatuses []string,
) ([]AssetPivot, int64, error) {

	// ✅ pass preferredPhase so the total matches the UI filter
	total, err := r.CountLatestSubmissions(ctx, project, root, assetNameKey, preferredPhase, approvalStatuses, workStatuses)
	if err != nil {
		return nil, 0, err
	}

	keys, err := r.ListLatestSubmissionsDynamic(
		ctx, project, root, preferredPhase, orderKey, direction,
		limit, offset, assetNameKey, approvalStatuses, workStatuses,
	)
	if err != nil {
		return nil, 0, err
	}
	if len(keys) == 0 {
		return []AssetPivot{}, total, nil
	}

	// fetch latest-by-phase for just this page (unchanged)
	var sb strings.Builder
	var params []any
	sb.WriteString(`
WITH latest_phase AS (
  SELECT project, root, group_1, relation, phase,
         work_status, approval_status, submitted_at_utc, modified_at_utc,
         ROW_NUMBER() OVER (
           PARTITION BY project, root, group_1, relation, phase
           ORDER BY modified_at_utc DESC
         ) rn
  FROM t_review_info
  WHERE project = ? AND root = ? AND deleted = 0
    AND (
`)
	params = append(params, project, root)
	for i, k := range keys {
		if i > 0 {
			sb.WriteString(" OR ")
		}
		sb.WriteString("(group_1 = ? AND relation = ?)")
		params = append(params, k.Group1, k.Relation)
	}
	sb.WriteString(`
    )
)
SELECT project, root, group_1, relation, phase, work_status, approval_status, submitted_at_utc
FROM latest_phase
WHERE rn = 1;`)

	var phases []phaseRow
	if err := r.db.WithContext(ctx).Raw(sb.String(), params...).Scan(&phases).Error; err != nil {
		return nil, 0, fmt.Errorf("ListAssetsPivot.phaseFetch: %w", err)
	}

	type key struct{ p, r, g, rel string }
	m := make(map[key]*AssetPivot, len(keys))
	ordered := make([]AssetPivot, 0, len(keys))
	for _, k := range keys {
		id := key{k.Project, k.Root, k.Group1, k.Relation}
		ap := &AssetPivot{Root: k.Root, Project: k.Project, Group1: k.Group1, Relation: k.Relation}
		m[id] = ap
		ordered = append(ordered, *ap)
	}
	for _, pr := range phases {
		id := key{pr.Project, pr.Root, pr.Group1, pr.Relation}
		if ap, ok := m[id]; ok {
			switch strings.ToLower(pr.Phase) {
			case "mdl":
				ap.MDLWorkStatus = pr.WorkStatus
				ap.MDLApprovalStatus = pr.ApprovalStatus
				ap.MDLSubmittedAtUTC = pr.SubmittedAtUTC
			case "rig":
				ap.RIGWorkStatus = pr.WorkStatus
				ap.RIGApprovalStatus = pr.ApprovalStatus
				ap.RIGSubmittedAtUTC = pr.SubmittedAtUTC
			case "bld":
				ap.BLDWorkStatus = pr.WorkStatus
				ap.BLDApprovalStatus = pr.ApprovalStatus
				ap.BLDSubmittedAtUTC = pr.SubmittedAtUTC
			case "dsn":
				ap.DSNWorkStatus = pr.WorkStatus
				ap.DSNApprovalStatus = pr.ApprovalStatus
				ap.DSNSubmittedAtUTC = pr.SubmittedAtUTC
			case "ldv":
				ap.LDVWorkStatus = pr.WorkStatus
				ap.LDVApprovalStatus = pr.ApprovalStatus
				ap.LDVSubmittedAtUTC = pr.SubmittedAtUTC
			}
		}
	}
	for i := range ordered {
		id := key{ordered[i].Project, ordered[i].Root, ordered[i].Group1, ordered[i].Relation}
		if filled, ok := m[id]; ok {
			ordered[i] = *filled
		}
	}
	return ordered, total, nil
}
