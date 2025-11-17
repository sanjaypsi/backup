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

// ---------- Dynamic Sorting Function ----------
// reviewInfo.go

// ---------- Dynamic Sorting Function ----------
func buildOrderClause(alias, key, dir string) string {
	// ... (dir and col function remain the same) ...
	dir = strings.ToUpper(strings.TrimSpace(dir))
	if dir != "ASC" && dir != "DESC" {
		dir = "ASC"
	}
	col := func(c string) string {
		if alias != "" {
			return alias + "." + c
		}
		return c
	}

	switch key {
	// Generic Sorts (use column directly)
	case "submitted_at_utc", "modified_at_utc", "phase":
		return col(key) + " " + dir

	// Asset Name/Relation Sorts (use compound keys)
	case "group1_only":
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir, col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	case "relation_only":
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("relation"), dir, col("group_1"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	case "group_rel_submitted":
		return fmt.Sprintf("LOWER(%s) ASC, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)

	// Phase-Specific Sorts (use generic work/submitted status columns, let phase-bias handle the priority)
	case "mdl_submitted", "rig_submitted", "bld_submitted", "dsn_submitted", "ldv_submitted":
		// Sort by submitted_at_utc column, relying on `preferredPhase` to bring the right rows to the top.
		return fmt.Sprintf("(%s IS NULL) ASC, %s %s, LOWER(%s) ASC, LOWER(%s) ASC",
			col("submitted_at_utc"), col("submitted_at_utc"), dir, col("group_1"), col("relation"))

	case "mdl_work_status", "rig_work_status", "bld_work_status", "dsn_work_status", "ldv_work_status":
		// Sort by work_status column, relying on `preferredPhase` to bring the right rows to the top.
		return fmt.Sprintf("(%s IS NULL) ASC, %s %s, LOWER(%s) ASC, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("work_status"), col("work_status"), dir, col("group_1"), col("relation"),
			col("submitted_at_utc"), col("submitted_at_utc"), dir)

	// Default sort
	default:
		return fmt.Sprintf("LOWER(%s) %s, LOWER(%s) ASC, (%s IS NULL) ASC, %s %s",
			col("group_1"), dir, col("relation"), col("submitted_at_utc"), col("submitted_at_utc"), dir)
	}
}

// ---------- Count (for pagination total) ----------
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
) AS x;`

	var total int64
	if err := r.db.WithContext(ctx).Raw(countSQL, project, root).Scan(&total).Error; err != nil {
		return 0, fmt.Errorf("CountLatestSubmissions: %w", err)
	}
	return total, nil
}

// ---------- ListLatestSubmissionsDynamic (phase priority is CONDITIONAL) ----------
func (r *ReviewInfo) ListLatestSubmissionsDynamic(
	ctx context.Context,
	project string,
	root string,
	preferredPhase string, // e.g. "mdl" or "none"
	orderKey string, // "group1_only" | "group_rel_submitted" | "submitted_at_utc" | "modified_at_utc" | "phase"
	direction string, // "ASC" | "DESC"
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

	// Disable phase priority when caller passes phase=none
	// (Route also sets phase=none automatically for group_1/relation sorts—see main.go)
	phaseGuard := 0
	if preferredPhase == "" || strings.EqualFold(preferredPhase, "none") {
		phaseGuard = 1
	}

	// Separate order clauses for inner (alias b) vs window (unqualified)
	orderClauseWindow := buildOrderClause("", orderKey, direction)
	orderClauseInner := buildOrderClause("b", orderKey, direction)

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
		) AS a
		LEFT JOIN (
			SELECT root, project, group_1, phase, relation, work_status, submitted_at_utc, modified_at_utc, executed_computer
			FROM t_review_info
			WHERE project = ? AND root = ? AND deleted = 0
		) AS b
		  ON a.project = b.project
		 AND a.root = b.root
		 AND a.group_1 = b.group_1
		 AND a.relation = b.relation
		 AND a.phase = b.phase
		 AND a.modified_at_utc = b.modified_at_utc
		ORDER BY %s
	) AS k
),
offset_ordered AS (
	SELECT
		c.*,
		CASE
		  WHEN ? = 1 THEN c._order                      -- no phase preference
		  WHEN c.phase = ? THEN c._order                -- prefer requested phase
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
			    WHEN ? = 1 THEN 0                         -- no phase preference
			    WHEN b.phase = ? THEN 0 ELSE 1           -- prefer requested phase
			  END,
			  LOWER(b.group_1) ASC,
			  LOWER(b.relation) ASC,
			  b.modified_at_utc DESC
		) AS _rank
	FROM offset_ordered b
)
SELECT root, project, group_1, relation, phase, submitted_at_utc
FROM ( SELECT * FROM ranked WHERE _rank = 1 ) AS t
ORDER BY __order ASC
LIMIT ? OFFSET ?;
`, orderClauseWindow, orderClauseInner)

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

// ---------- ListAssetsPivot (pivot fill) ----------
func (r *ReviewInfo) ListAssetsPivot(
	ctx context.Context,
	project, root, preferredPhase, orderKey, direction string,
	limit, offset int,
) ([]AssetPivot, int64, error) {

	total, err := r.CountLatestSubmissions(ctx, project, root)
	if err != nil {
		return nil, 0, err
	}

	keys, err := r.ListLatestSubmissionsDynamic(ctx, project, root, preferredPhase, orderKey, direction, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	if len(keys) == 0 {
		return []AssetPivot{}, total, nil
	}

	// batch fetch latest-by-phase for this page of assets
	var sb strings.Builder
	var params []any
	sb.WriteString(`
WITH latest_phase AS (
	SELECT
		project, root, group_1, relation, phase,
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

	// pivot in Go
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
		ap, ok := m[id]
		if !ok {
			continue
		}

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

	// copy back filled structs in the same order
	for i := range ordered {
		id := key{ordered[i].Project, ordered[i].Root, ordered[i].Group1, ordered[i].Relation}
		if filledAp, ok := m[id]; ok {
			ordered[i] = *filledAp
		}
	}

	return ordered, total, nil
}
