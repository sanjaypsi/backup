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
// Hellper models for GetDetailedLatestReviews function
// =======================================================================
type AssetKey struct {
	Seq      int    `json:"-" gorm:"column:seq"`
	Root     string `json:"root" gorm:"column:root"`
	Project  string `json:"project" gorm:"column:project"`
	Group1   string `json:"group_1" gorm:"column:group_1"`
	Relation string `json:"relation" gorm:"column:relation"`
}

type PhaseRow struct {
	Seq              int        `gorm:"column:seq" json:"-"`
	Root             string     `gorm:"column:root"`
	Project          string     `gorm:"column:project"`
	Group1           string     `gorm:"column:group_1"`
	Relation         string     `gorm:"column:relation"`
	Phase            string     `gorm:"column:phase"`
	WorkStatus       *string    `gorm:"column:work_status"`
	ApprovalStatus   *string    `gorm:"column:approval_status"`
	SubmittedAtUTC   *time.Time `gorm:"column:submitted_at_utc"`
	ModifiedAtUTC    *time.Time `gorm:"column:modified_at_utc"`
	ExecutedComputer *string    `gorm:"column:executed_computer"`
}

type AssetPhaseSummary struct {
	Root     string `json:"root"`
	Project  string `json:"project"`
	Group1   string `json:"group_1"`
	Relation string `json:"relation"`

	MdlWorkStatus     *string    `json:"mdl_work_status"`
	MdlApprovalStatus *string    `json:"mdl_approval_status"`
	MdlSubmittedAtUTC *time.Time `json:"mdl_submitted_at_utc"`

	RigWorkStatus     *string    `json:"rig_work_status"`
	RigApprovalStatus *string    `json:"rig_approval_status"`
	RigSubmittedAtUTC *time.Time `json:"rig_submitted_at_utc"`

	BldWorkStatus     *string    `json:"bld_work_status"`
	BldApprovalStatus *string    `json:"bld_approval_status"`
	BldSubmittedAtUTC *time.Time `json:"bld_submitted_at_utc"`

	DsnWorkStatus     *string    `json:"dsn_work_status"`
	DsnApprovalStatus *string    `json:"dsn_approval_status"`
	DsnSubmittedAtUTC *time.Time `json:"dsn_submitted_at_utc"`

	LdvWorkStatus     *string    `json:"ldv_work_status"`
	LdvApprovalStatus *string    `json:"ldv_approval_status"`
	LdvSubmittedAtUTC *time.Time `json:"ldv_submitted_at_utc"`

	HasPhase map[string]bool `json:"-"`
}

// ============================================================================
// LIST ORDERED ASSETS - First Query
// ============================================================================
func (r *ReviewInfo) ListOrderedAssets(
	ctx context.Context,
	db *gorm.DB,
	project, root, sortField, sortDir string,
	limit, offset int,
) ([]AssetKey, int64, error) {

	cols := map[string]string{
		"group_1":  "group_1",
		"relation": "relation",
		"project":  "project",
		"root":     "root",
	}
	col := cols["group_1"]
	if v, ok := cols[strings.ToLower(sortField)]; ok {
		col = v
	}
	dir := "ASC"
	if strings.EqualFold(sortDir, "DESC") {
		dir = "DESC"
	}

	var total int64
	countSQL := `
SELECT COUNT(*) FROM (
  SELECT project, root, group_1, relation
  FROM t_review_info
  WHERE project = ? AND root = ? AND deleted = 0
  GROUP BY project, root, group_1, relation
) x;
`
	if err := db.WithContext(ctx).Raw(countSQL, project, root).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	orderedSQL := fmt.Sprintf(`
	WITH asset_keys AS (
	SELECT
		t.project,
		t.root,
		t.group_1,
		t.relation
	FROM t_review_info t
	WHERE t.project = ? AND t.root = ? AND t.deleted = 0
	GROUP BY t.project, t.root, t.group_1, t.relation
	),
	ordered AS (
	SELECT
		project, root, group_1, relation,
		ROW_NUMBER() OVER (ORDER BY %s %s) AS seq
	FROM asset_keys
	)
	SELECT project, root, group_1, relation, seq
	FROM ordered
	ORDER BY seq
	LIMIT ? OFFSET ?;
	`, col, dir)

	var keys []AssetKey
	if err := db.WithContext(ctx).Raw(orderedSQL, project, root, limit, offset).Scan(&keys).Error; err != nil {
		return nil, 0, err
	}
	return keys, total, nil
}

// ============================================================================
// LATEST PER PHASE FOR ASSETS -- Second Query
// ============================================================================
func (r *ReviewInfo) LatestPerPhaseForAssets(
	ctx context.Context,
	db *gorm.DB,
	keys []AssetKey,
) ([]PhaseRow, error) {

	if len(keys) == 0 {
		return []PhaseRow{}, nil
	}

	parts := []string{}
	params := []interface{}{}
	for i, k := range keys {
		if i == 0 {
			parts = append(parts, "SELECT ?,?,?,?,?")
		} else {
			parts = append(parts, "UNION ALL SELECT ?,?,?,?,?")
		}
		params = append(params, k.Root, k.Project, k.Group1, k.Relation, k.Seq)
	}
	sel := strings.Join(parts, "\n")

	sql := fmt.Sprintf(`
	WITH sel(root, project, group_1, relation, seq) AS (
	%s
	),
	max_modified AS (
	SELECT
		b.project, b.root, b.group_1, b.relation, b.phase,
		MAX(b.modified_at_utc) AS modified_at_utc,
		MIN(sel.seq)           AS seq
	FROM t_review_info b
	JOIN sel
		ON  sel.project  = b.project
		AND sel.root     = b.root
		AND sel.group_1  = b.group_1
		AND sel.relation = b.relation
	WHERE b.deleted = 0
	GROUP BY b.project, b.root, b.group_1, b.relation, b.phase
	)
	SELECT
	a.seq, b.project, b.root, b.group_1, b.relation, b.phase,
	b.work_status, b.approval_status, b.submitted_at_utc,
	b.modified_at_utc, b.executed_computer
	FROM max_modified a
	JOIN t_review_info b
	ON  a.project         = b.project
	AND a.root            = b.root
	AND a.group_1         = b.group_1
	AND a.relation        = b.relation
	AND a.phase           = b.phase
	AND a.modified_at_utc = b.modified_at_utc
	ORDER BY a.seq, b.group_1, b.relation;
	`, sel)

	var rows []PhaseRow
	if err := db.WithContext(ctx).Raw(sql, params...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

// =============================================================================
// PIVOT PHASE ROWS INTO ASSET PHASE SUMMARIES
// ============================================================================
func PivotPhaseRows(raw []PhaseRow, keys []AssetKey) []AssetPhaseSummary {
	// map to collect pivot data
	m := make(map[string]*AssetPhaseSummary)

	// helper to build map key
	id := func(root, project, group1, relation string) string {
		return root + "|" + project + "|" + group1 + "|" + relation
	}

	// aggregate phase rows
	for _, r := range raw {
		key := id(r.Root, r.Project, r.Group1, r.Relation)
		dst := m[key]
		if dst == nil {
			dst = &AssetPhaseSummary{
				Root:     r.Root,
				Project:  r.Project,
				Group1:   r.Group1,
				Relation: r.Relation,
				HasPhase: map[string]bool{},
			}
			m[key] = dst
		}

		p := strings.ToLower(r.Phase)
		dst.HasPhase[p] = true

		switch p {
		case "mdl":
			dst.MdlWorkStatus, dst.MdlApprovalStatus, dst.MdlSubmittedAtUTC =
				r.WorkStatus, r.ApprovalStatus, r.SubmittedAtUTC
		case "rig":
			dst.RigWorkStatus, dst.RigApprovalStatus, dst.RigSubmittedAtUTC =
				r.WorkStatus, r.ApprovalStatus, r.SubmittedAtUTC
		case "bld":
			dst.BldWorkStatus, dst.BldApprovalStatus, dst.BldSubmittedAtUTC =
				r.WorkStatus, r.ApprovalStatus, r.SubmittedAtUTC
		case "dsn":
			dst.DsnWorkStatus, dst.DsnApprovalStatus, dst.DsnSubmittedAtUTC =
				r.WorkStatus, r.ApprovalStatus, r.SubmittedAtUTC
		case "ldv":
			dst.LdvWorkStatus, dst.LdvApprovalStatus, dst.LdvSubmittedAtUTC =
				r.WorkStatus, r.ApprovalStatus, r.SubmittedAtUTC
		}
	}

	// output in same order as FIRST QUERY
	out := make([]AssetPhaseSummary, 0, len(keys))
	for _, k := range keys {
		key := id(k.Root, k.Project, k.Group1, k.Relation)
		if row, ok := m[key]; ok {
			out = append(out, *row)
		} else {
			// missing phases output blank
			out = append(out, AssetPhaseSummary{
				Root:     k.Root,
				Project:  k.Project,
				Group1:   k.Group1,
				Relation: k.Relation,
				HasPhase: map[string]bool{},
			})
		}
	}
	return out
}

// =============================================================================
// UTILITIES
// =============================================================================
func parsePhaseCSV(s string) []string {
	if s == "" {
		return nil
	}
	out := []string{}
	for _, p := range strings.Split(s, ",") {
		p = strings.ToLower(strings.TrimSpace(p))
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func hasAnyPreferred(phases []string, asset AssetPhaseSummary) bool {
	for _, p := range phases {
		if asset.HasPhase[p] {
			return true
		}
	}
	return false
}

// null-safe string compare
func stringPtrLT(a, b *string) bool {
	if a == nil && b == nil {
		return false
	}
	if a == nil {
		return false
	}
	if b == nil {
		return true
	}
	return *a < *b
}

// null-safe time compare
func timePtrLT(a, b *time.Time) bool {
	if a == nil && b == nil {
		return false
	}
	if a == nil {
		return false
	}
	if b == nil {
		return true
	}
	return a.Before(*b)
}

// Pivot sorting functions
var pivotSorters = map[string]func(a, b *AssetPhaseSummary) bool{
	"group_1":  func(a, b *AssetPhaseSummary) bool { return a.Group1 < b.Group1 },
	"relation": func(a, b *AssetPhaseSummary) bool { return a.Relation < b.Relation },

	"mdl_work":      func(a, b *AssetPhaseSummary) bool { return stringPtrLT(a.MdlWorkStatus, b.MdlWorkStatus) },
	"mdl_appr":      func(a, b *AssetPhaseSummary) bool { return stringPtrLT(a.MdlApprovalStatus, b.MdlApprovalStatus) },
	"mdl_submitted": func(a, b *AssetPhaseSummary) bool { return timePtrLT(a.MdlSubmittedAtUTC, b.MdlSubmittedAtUTC) },

	"rig_work":      func(a, b *AssetPhaseSummary) bool { return stringPtrLT(a.RigWorkStatus, b.RigWorkStatus) },
	"rig_appr":      func(a, b *AssetPhaseSummary) bool { return stringPtrLT(a.RigApprovalStatus, b.RigApprovalStatus) },
	"rig_submitted": func(a, b *AssetPhaseSummary) bool { return timePtrLT(a.RigSubmittedAtUTC, b.RigSubmittedAtUTC) },

	"bld_work":      func(a, b *AssetPhaseSummary) bool { return stringPtrLT(a.BldWorkStatus, b.BldWorkStatus) },
	"bld_appr":      func(a, b *AssetPhaseSummary) bool { return stringPtrLT(a.BldApprovalStatus, b.BldApprovalStatus) },
	"bld_submitted": func(a, b *AssetPhaseSummary) bool { return timePtrLT(a.BldSubmittedAtUTC, b.BldSubmittedAtUTC) },

	"dsn_work":      func(a, b *AssetPhaseSummary) bool { return stringPtrLT(a.DsnWorkStatus, b.DsnWorkStatus) },
	"dsn_appr":      func(a, b *AssetPhaseSummary) bool { return stringPtrLT(a.DsnApprovalStatus, b.DsnApprovalStatus) },
	"dsn_submitted": func(a, b *AssetPhaseSummary) bool { return timePtrLT(a.DsnSubmittedAtUTC, b.DsnSubmittedAtUTC) },

	"ldv_work":      func(a, b *AssetPhaseSummary) bool { return stringPtrLT(a.LdvWorkStatus, b.LdvWorkStatus) },
	"ldv_appr":      func(a, b *AssetPhaseSummary) bool { return stringPtrLT(a.LdvApprovalStatus, b.LdvApprovalStatus) },
	"ldv_submitted": func(a, b *AssetPhaseSummary) bool { return timePtrLT(a.LdvSubmittedAtUTC, b.LdvSubmittedAtUTC) },
}

// Apply pivot sorting after phase pivot
func SortPivot(rows []AssetPhaseSummary, sortKey string) {
	if sortKey == "" {
		return
	}
	asc := !strings.HasPrefix(sortKey, "-")
	field := strings.TrimPrefix(sortKey, "-")

	cmp, ok := pivotSorters[field]
	if !ok {
		return
	}

	sort.SliceStable(rows, func(i, j int) bool {
		if asc {
			return cmp(&rows[i], &rows[j])
		}
		return cmp(&rows[j], &rows[i])
	})
}

// ============================================================================
// GET ASSETS PIVOT PAGE
// ============================================================================
func (r *ReviewInfo) GetAssetsPivotPage(
	ctx context.Context,
	db *gorm.DB,
	project, root string,
	sortKey string,
	phaseCSV string,
	page, perPage int,
) ([]AssetPhaseSummary, int64, error) {

	if page <= 0 {
		page = 1
	}
	if perPage <= 0 {
		perPage = 15
	}
	offset := perPage * (page - 1)

	// asset-level sort field
	assetField := strings.TrimPrefix(sortKey, "-")
	if assetField == "" {
		assetField = "group_1"
	}

	dir := "ASC"
	if strings.HasPrefix(sortKey, "-") {
		dir = "DESC"
	}

	// FIRST QUERY
	keys, total, err := r.ListOrderedAssets(
		ctx, db, project, root, assetField, dir, perPage, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	if len(keys) == 0 {
		return []AssetPhaseSummary{}, total, nil
	}

	// SECOND QUERY
	raw, err := r.LatestPerPhaseForAssets(ctx, db, keys)
	if err != nil {
		return nil, 0, err
	}

	// PIVOT
	rows := PivotPhaseRows(raw, keys)

	// PHASE BOOSTING
	if phases := parsePhaseCSV(phaseCSV); len(phases) > 0 {
		sort.SliceStable(rows, func(i, j int) bool {
			ai := hasAnyPreferred(phases, rows[i])
			aj := hasAnyPreferred(phases, rows[j])
			if ai != aj {
				return ai && !aj
			}
			return rows[i].Group1 < rows[j].Group1
		})
	}

	// Optional pivot sort
	if sortKey != "" {
		SortPivot(rows, sortKey)
	}

	return rows, total, nil
}
