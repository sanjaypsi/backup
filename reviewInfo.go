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
// -----------------------------------------------------------------------------
// Row structs
// -----------------------------------------------------------------------------
type LatestSubmissionRow struct {
	Root           string     `json:"root"              gorm:"column:root"`
	Project        string     `json:"project"           gorm:"column:project"`
	Group1         string     `json:"group_1"           gorm:"column:group_1"`
	Relation       string     `json:"relation"          gorm:"column:relation"`
	Phase          string     `json:"phase"             gorm:"column:phase"`
	SubmittedAtUTC *time.Time `json:"submitted_at_utc"  gorm:"column:submitted_at_utc"`
}

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

type phaseRow struct {
	Project        string     `gorm:"column:project"`
	Root           string     `gorm:"column:root"`
	Group1         string     `gorm:"column:group_1"`
	Relation       string     `gorm:"column:relation"`
	Phase          string     `gorm:"column:phase"`
	WorkStatus     *string    `gorm:"column:work_status"`
	ApprovalStatus *string    `gorm:"column:approval_status"`
	SubmittedAtUTC *time.Time `gorm:"column:submitted_at_utc"`
	ModifiedAtUTC  *time.Time `gorm:"column:modified_at_utc"`
}

// -----------------------------------------------------------------------------
// Count (total unique assets for pagination UI)
// -----------------------------------------------------------------------------
func (r *ReviewInfo) CountLatestSubmissions(ctx context.Context, project, root string) (int64, error) {
	if project == "" {
		return 0, fmt.Errorf("project is required")
	}
	if root == "" {
		root = "assets"
	}

	const countSQL = `
SELECT COUNT(*) FROM (
  SELECT project, root, group_1, relation
  FROM t_review_info
  WHERE project = ? AND root = ? AND deleted = 0
  GROUP BY project, root, group_1, relation
) x;`

	var total int64
	if err := r.db.WithContext(ctx).Raw(countSQL, project, root).Scan(&total).Error; err != nil {
		return 0, fmt.Errorf("CountLatestSubmissions: %w", err)
	}
	return total, nil
}

// -----------------------------------------------------------------------------
// Sorting helpers
// -----------------------------------------------------------------------------
func statusOrderExpr(alias string) string {
	col := func(c string) string {
		if alias == "" {
			return c
		}
		return alias + "." + c
	}
	ws := col("work_status")
	return fmt.Sprintf(`
CASE
  WHEN LOWER(%s) = 'review'                     THEN 1
  WHEN LOWER(%s) = 'check'                      THEN 2
  WHEN LOWER(%s) = 'retake'                     THEN 3
  WHEN LOWER(%s) IN ('leadonhold','cgsvonhold') THEN 4
  WHEN LOWER(%s) IN ('cgsvapproved','approved') THEN 5
  ELSE 99
END`, ws, ws, ws, ws, ws)
}

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
	case "submitted_at_utc":
		return col("submitted_at_utc") + " " + dir
	case "modified_at_utc":
		return col("modified_at_utc") + " " + dir
	case "phase":
		return col("phase") + " " + dir

	case "group1_only":
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir, col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	case "relation_only":
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("relation"), dir, col("group_1"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	case "group_rel_submitted":
		return fmt.Sprintf("LOWER(%s) ASC, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)

	case "work_status": // legacy
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("work_status"), dir, col("group_1"), col("submitted_at_utc"), col("submitted_at_utc"), dir)

	case "work_status_priority":
		return fmt.Sprintf("%s %s, LOWER(%s) ASC, LOWER(%s) ASC, %s DESC, %s DESC",
			statusOrderExpr(alias), dir,
			col("group_1"), col("relation"),
			col("modified_at_utc"), col("submitted_at_utc"))

	default:
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir, col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	}
}

// -----------------------------------------------------------------------------
// First query: get one row per asset (phase preference + dynamic sort)
// -----------------------------------------------------------------------------
func (r *ReviewInfo) ListLatestSubmissionsDynamic(
	ctx context.Context,
	project string,
	root string,
	preferredPhase string, // "mdl"|"rig"|"bld"|"dsn"|"ldv"|"none"
	orderKey string, // group1_only|relation_only|group_rel_submitted|submitted_at_utc|modified_at_utc|phase|work_status|work_status_priority
	direction string, // ASC|DESC
	limit, offset int,
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

	// Disable phase preference when phase=none
	phaseGuard := 0
	if preferredPhase == "" || strings.EqualFold(preferredPhase, "none") {
		phaseGuard = 1
	}

	orderClauseWindow := buildOrderClause("", orderKey, direction) // for ROW_NUMBER() OVER
	orderClauseInner := buildOrderClause("b", orderKey, direction) // for inner ORDER BY

	q := fmt.Sprintf(`
WITH ordered AS (
  SELECT
    *,
    ROW_NUMBER() OVER (ORDER BY %s) AS _order
  FROM (
    SELECT b.* FROM (
      SELECT project, root, group_1, relation, phase, MAX(modified_at_utc) AS modified_at_utc
      FROM t_review_info
      WHERE project = ? AND root = ? AND deleted = 0
      GROUP BY project, root, group_1, relation, phase
    ) a
    LEFT JOIN (
      SELECT root, project, group_1, phase, relation, work_status, submitted_at_utc, modified_at_utc, executed_computer
      FROM t_review_info
      WHERE project = ? AND root = ? AND deleted = 0
    ) b
      ON a.project = b.project
     AND a.root = b.root
     AND a.group_1 = b.group_1
     AND a.relation = b.relation
     AND a.phase = b.phase
     AND a.modified_at_utc = b.modified_at_utc
    ORDER BY %s
  ) k
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
        CASE WHEN ? = 1 THEN 0 WHEN b.phase = ? THEN 0 ELSE 1 END,
        LOWER(b.group_1) ASC,
        LOWER(b.relation) ASC,
        b.modified_at_utc DESC
    ) AS _rank
  FROM offset_ordered b
)
SELECT root, project, group_1, relation, phase, submitted_at_utc
FROM (SELECT * FROM ranked WHERE _rank = 1) t
ORDER BY __order ASC
LIMIT ? OFFSET ?;`, orderClauseWindow, orderClauseInner)

	args := []any{
		project, root, // inner latest-per-phase
		project, root, // inner join rows
		phaseGuard, preferredPhase, // offset_ordered CASE
		phaseGuard, preferredPhase, // ranked CASE
		limit, offset,
	}

	var rows []LatestSubmissionRow
	if err := r.db.WithContext(ctx).Raw(q, args...).Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("ListLatestSubmissionsDynamic: %w", err)
	}
	return rows, nil
}

// -----------------------------------------------------------------------------
// Second query + pivot: latest row per (asset, phase) for just this page
//   - CTE-free (uses simple OR list) → portable & safe
//   - Preserves the order produced by the first query
//
// -----------------------------------------------------------------------------
// --- Add this helper (once) ---
func normalizeStatus(s *string) *string {
	if s == nil {
		return nil
	}
	switch strings.ToLower(*s) {
	case "leadOnhold", "cgsvonhold":
		v := "onHold"
		return &v
	case "cgsvapproved", "approved":
		v := "Approved"
		return &v
	case "check":
		v := "Check"
		return &v
	case "review":
		v := "Review"
		return &v
	case "retake":
		v := "Retake"
		return &v
	default:
		// keep original if we don't recognize it
		return s
	}
}

// ---------- ListAssetsPivot (with status normalization) ----------
func (r *ReviewInfo) ListAssetsPivot(
	ctx context.Context,
	project, root, preferredPhase, orderKey, direction string,
	limit, offset int,
) ([]AssetPivot, int64, error) {

	total, err := r.CountLatestSubmissions(ctx, project, root)
	if err != nil {
		return nil, 0, err
	}

	// Get current page keys (ordered like the grid)
	keys, err := r.ListLatestSubmissionsDynamic(ctx, project, root, preferredPhase, orderKey, direction, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	if len(keys) == 0 {
		return []AssetPivot{}, total, nil
	}

	// Fetch latest row per (asset, phase) for ONLY these keys (CTE-free, MySQL 8 safe)
	var sb strings.Builder
	var params []any

	sb.WriteString(`
SELECT project, root, group_1, relation, phase, work_status, approval_status, submitted_at_utc
FROM (
  SELECT
    t.project, t.root, t.group_1, t.relation, t.phase,
    t.work_status, t.approval_status, t.submitted_at_utc, t.modified_at_utc,
    ROW_NUMBER() OVER (
      PARTITION BY t.project, t.root, t.group_1, t.relation, t.phase
      ORDER BY t.modified_at_utc DESC, t.submitted_at_utc DESC
    ) rn
  FROM t_review_info t
  WHERE t.deleted = 0
    AND t.project = ? AND t.root = ?
    AND (
`)
	params = append(params, project, root)
	for i, k := range keys {
		if i > 0 {
			sb.WriteString(" OR ")
		}
		sb.WriteString("(t.group_1 = ? AND t.relation = ?)")
		params = append(params, k.Group1, k.Relation)
	}
	sb.WriteString(`
    )
) latest_phase
WHERE rn = 1;`)

	var pr []phaseRow
	if err := r.db.WithContext(ctx).Raw(sb.String(), params...).Scan(&pr).Error; err != nil {
		fmt.Println("\n----- ListAssetsPivot: phase fetch SQL ERROR -----")
		fmt.Println("SQL:\n", sb.String())
		fmt.Println("PARAMS:", params)
		fmt.Println("ERROR:", err)
		fmt.Println("--------------------------------------------------")
		return nil, 0, fmt.Errorf("ListAssetsPivot.phaseFetch: %w", err)
	}

	// Pivot in Go, preserving order
	type akey struct{ P, R, G, L string }
	idx := make(map[akey]*AssetPivot, len(keys))
	out := make([]AssetPivot, 0, len(keys))

	for _, k := range keys {
		id := akey{k.Project, k.Root, k.Group1, k.Relation}
		ap := &AssetPivot{Root: k.Root, Project: k.Project, Group1: k.Group1, Relation: k.Relation}
		idx[id] = ap
		out = append(out, *ap)
	}

	for _, rrow := range pr {
		id := akey{rrow.Project, rrow.Root, rrow.Group1, rrow.Relation}
		ap, ok := idx[id]
		if !ok {
			continue
		}

		switch strings.ToLower(rrow.Phase) {
		case "mdl":
			ap.MDLWorkStatus = normalizeStatus(rrow.WorkStatus)
			ap.MDLApprovalStatus = rrow.ApprovalStatus
			ap.MDLSubmittedAtUTC = rrow.SubmittedAtUTC
		case "rig":
			ap.RIGWorkStatus = normalizeStatus(rrow.WorkStatus)
			ap.RIGApprovalStatus = rrow.ApprovalStatus
			ap.RIGSubmittedAtUTC = rrow.SubmittedAtUTC
		case "bld":
			ap.BLDWorkStatus = normalizeStatus(rrow.WorkStatus)
			ap.BLDApprovalStatus = rrow.ApprovalStatus
			ap.BLDSubmittedAtUTC = rrow.SubmittedAtUTC
		case "dsn":
			ap.DSNWorkStatus = normalizeStatus(rrow.WorkStatus)
			ap.DSNApprovalStatus = rrow.ApprovalStatus
			ap.DSNSubmittedAtUTC = rrow.SubmittedAtUTC
		case "ldv":
			ap.LDVWorkStatus = normalizeStatus(rrow.WorkStatus)
			ap.LDVApprovalStatus = rrow.ApprovalStatus
			ap.LDVSubmittedAtUTC = rrow.SubmittedAtUTC
		}
	}

	for i := range out {
		id := akey{out[i].Project, out[i].Root, out[i].Group1, out[i].Relation}
		if filled, ok := idx[id]; ok {
			out[i] = *filled
		}
	}
	return out, total, nil
}

// ========================================================================
