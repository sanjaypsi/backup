package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/PolygonPictures/central30-web/front/entity"
	"gorm.io/gorm"
)

type GenerateCsv struct {
	db *gorm.DB
}

func NewGenerateCsv(db *gorm.DB) *GenerateCsv {
	return &GenerateCsv{
		db: db,
	}
}

func (gc *GenerateCsv) WithContext(ctx context.Context) *gorm.DB {
	return gc.db.WithContext(ctx)
}

func (gc *GenerateCsv) ListLatestAssetsReviews(db *gorm.DB, project string) ([]*entity.AssetReviewInfoCsv, error) {
	var results []*entity.AssetReviewInfoCsv

	subQuery := db.Model(&entity.AssetReviewInfoCsv{}).
		Select("relation, phase, group_1, MAX(modified_at_utc) AS max_modified_at_utc").
		Where("project = ?", project).
		Where("root = ?", "assets").
		Where("phase IN ?", []string{"mdl", "rig", "ldv"}).
		Group("relation, phase, group_1")

	err := db.Table("t_review_info AS t").
		Select("t.project, t.root, t.relation, t.phase, t.work_status, t.approval_status, t.group_1").
		Joins("INNER JOIN (?) AS lt ON t.relation = lt.relation AND t.phase = lt.phase AND t.group_1 = lt.group_1 AND t.modified_at_utc = lt.max_modified_at_utc", subQuery).
		Where("t.project = ?", project).
		Where("t.root = ?", "assets").
		Where("t.phase IN ?", []string{"mdl", "rig", "ldv"}).
		Find(&results).Error

	if err != nil {
		return nil, fmt.Errorf("latest ReviewInfo query failed: %w", err)
	}

	return results, nil
}

func (gc *GenerateCsv) ListAssetsGroupCategory(db *gorm.DB, project string) ([]*entity.GroupPathInfo, error) {
	var results []*entity.GroupPathInfo

	result := db.Table("t_group_category_group AS tgcg").
		Joins("INNER JOIN t_group_category AS tgc ON tgcg.group_category_id = tgc.id").
		Select(
			"tgcg.path AS group_path",
			"tgc.path AS category_path",
			"tgcg.id AS group_category_group_id",
			"tgc.id AS group_category_id",
		).
		Where("tgcg.project = ?", project).
		Where("tgcg.deleted = ?", 0).
		Where("tgc.root = ?", "assets").
		Where("tgc.deleted = ?", 0).
		Where("tgc.project = ?", project).
		Scan(&results)

	if result.Error != nil {
		return nil, fmt.Errorf("groupCategory query failed: %w", result.Error)
	}

	return results, nil
}

func (gc *GenerateCsv) ListAllBldReviews(db *gorm.DB, project string) ([]*entity.BldComponentReviewInfo, error) {
	var results []*entity.BldComponentReviewInfo

	type scanResult struct {
		TargetComponents []byte `gorm:"column:target_components"`
		Group1           string `gorm:"column:group_1"`
		Relation         string `gorm:"column:relation"`
		ApprovalStatus   string `gorm:"column:approval_status"`
	}
	var rawResults []scanResult

	err := db.Table("t_review_info").
		Select(
			"target_components",
			"group_1",
			"relation",
			"approval_status",
			"modified_at_utc",
		).
		Where("project = ?", project).
		Where("root = ?", "assets").
		Where("deleted = ?", 0).
		Where("phase = ?", "bld").
		Order("id ASC").
		Scan(&rawResults).Error

	if err != nil {
		return nil, fmt.Errorf("all bld reviews query failed: %w", err)
	}

	for _, r := range rawResults {
		var components []string
		if len(r.TargetComponents) > 0 {
			if err := json.Unmarshal(r.TargetComponents, &components); err != nil {
				fmt.Printf("failed to unmarshal target_components: %v\n", err)
			}
		}

		info := &entity.BldComponentReviewInfo{
			TargetComponents: components,
			Group1:           r.Group1,
			Relation:         r.Relation,
			ApprovalStatus:   r.ApprovalStatus,
		}
		results = append(results, info)
	}

	return results, nil
}
