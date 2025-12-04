package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/PolygonPictures/central30-web/front/entity"
	"github.com/PolygonPictures/central30-web/front/entity/groupCategory"
	"github.com/PolygonPictures/central30-web/front/repository/model"
	"github.com/go-sql-driver/mysql"
	"gorm.io/gorm"
)

type GroupCategory struct {
	db *gorm.DB
}

func NewGroupCategory(db *gorm.DB) (*GroupCategory, error) {
	var m model.GroupCategory
	if err := db.AutoMigrate(&m, &model.GroupCategoryGroup{}); err != nil {
		return nil, err
	}
	if err := db.Model(&m).Association("Groups").Error; err != nil {
		return nil, err
	}
	return &GroupCategory{
		db: db,
	}, nil
}

func (r *GroupCategory) WithContext(ctx context.Context) *gorm.DB {
	return r.db.WithContext(ctx)
}

func (r *GroupCategory) TransactionWithContext(
	ctx context.Context,
	fc func(tx *gorm.DB) error,
	opts ...*sql.TxOptions,
) error {
	db := r.WithContext(ctx)
	return db.Transaction(fc, opts...)
}

func (r *GroupCategory) List(
	tx *gorm.DB,
	params *groupCategory.ListParams,
) ([]groupCategory.Entity, uint, error) {
	if sp, ok := params.SubParams.(groupCategory.ListStandardSubParams); ok {
		return r.listStandard(tx, sp, params.Project, params.OrderBy, params.BaseListParams)
	}
	if sp, ok := params.SubParams.(groupCategory.ListSinceSubParams); ok {
		return r.listSince(tx, sp, params.Project, params.OrderBy, params.BaseListParams)
	}
	return nil, 0, fmt.Errorf("invalid sub parameter type: %v", params.SubParams)
}

func (r *GroupCategory) listStandard(
	tx *gorm.DB,
	sp groupCategory.ListStandardSubParams,
	project string,
	ob []string,
	baseListParams *entity.BaseListParams,
) ([]groupCategory.Entity, uint, error) {
	stmt := tx.Where("`deleted` = ?", 0).Where("`project` = ?", project)

	if sp.Root != nil {
		stmt = stmt.Where("`root` = ?", *sp.Root)
	}

	var total int64
	var m model.GroupCategory
	if err := stmt.Model(&m).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	stmt = orderBy(stmt, ob)
	stmt = limitOffset(stmt, baseListParams)

	var models []*model.GroupCategory
	if err := stmt.Preload("Groups", "`deleted` = ?", 0).Find(&models).Error; err != nil {
		return nil, 0, err
	}

	entities := make([]groupCategory.Entity, len(models))
	for i, m := range models {
		entities[i] = m.Entity(false)
	}
	return entities, uint(total), nil
}

func (r *GroupCategory) listSince(
	tx *gorm.DB,
	sp groupCategory.ListSinceSubParams,
	project string,
	ob []string,
	baseListParams *entity.BaseListParams,
) ([]groupCategory.Entity, uint, error) {
	stmt := tx.Where("`project` = ?", project)

	if sp.ModifiedSince != nil {
		stmt = stmt.Where("`modified_at_utc` >= ?", *sp.ModifiedSince)
	}

	var total int64
	if sp.Type == groupCategory.CategoryType {
		stmt = stmt.Model(&model.GroupCategory{})
	} else {
		stmt = stmt.Model(&model.GroupCategoryGroup{})
	}
	if err := stmt.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	stmt = orderBy(stmt, ob)
	stmt = limitOffset(stmt, baseListParams)

	var entities []groupCategory.Entity
	if sp.Type == groupCategory.CategoryType {
		models := []*model.GroupCategory{}
		if err := stmt.Find(&models).Error; err != nil {
			return nil, 0, err
		}
		for _, m := range models {
			entities = append(entities, m.Entity(true))
		}
	} else {
		models := []*model.GroupCategoryGroup{}
		if err := stmt.Find(&models).Error; err != nil {
			return nil, 0, err
		}
		for _, m := range models {
			entities = append(entities, m.Entity(true))
		}
	}
	return entities, uint(total), nil
}

func (r *GroupCategory) Get(
	db *gorm.DB,
	params *groupCategory.GetParams,
) (*groupCategory.CategoryEntity, error) {
	m, err := r.get(db, params)
	if err != nil {
		return nil, err
	}
	return m.Entity(false), nil
}

func (r *GroupCategory) get(
	db *gorm.DB,
	params *groupCategory.GetParams,
) (*model.GroupCategory, error) {
	var m model.GroupCategory
	if err := db.Where(
		"`deleted` = 0",
	).Where(
		"`project` = ?", params.Project,
	).Where(
		"`id` = ?", params.ID,
	).Preload(
		"Groups", "`deleted` = ?", 0,
	).Take(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf(
				"%w: category with ID %d not found", entity.ErrRecordNotFound, params.ID,
			)
		}
		return nil, err
	}
	return &m, nil
}

func (r *GroupCategory) Create(
	tx *gorm.DB,
	params *groupCategory.CreateParams,
) (*groupCategory.CategoryEntity, error) {
	m := model.NewGroupCategory(params)
	if err := tx.Create(m).Error; err != nil {
		var mysqlErr *mysql.MySQLError
		if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
			return nil, fmt.Errorf(
				"%w: category with path %q is already exists",
				entity.ErrBadRequest, params.Path,
			)
		}
		return nil, err
	}
	return m.Entity(false), nil
}

func (r *GroupCategory) Update(
	tx *gorm.DB,
	params *groupCategory.UpdateParams,
) (*groupCategory.CategoryEntity, error) {
	now := time.Now().UTC()
	var modifiedBy string
	if params.ModifiedBy != nil {
		modifiedBy = *params.ModifiedBy
	}

	switch params.Operation {
	case "add":
		var groups []*model.GroupCategoryGroup
		for _, path := range params.Groups {
			gm := model.NewGroupCategoryGroup(&groupCategory.CreateGroupParams{
				GroupCategoryID: params.ID,
				Path:            path,
				Project:         params.Project,
				CreatedBy:       &modifiedBy,
			})
			groups = append(groups, gm)
		}
		if err := tx.Create(&groups).Error; err != nil {
			var mysqlErr *mysql.MySQLError
			if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
				return nil, fmt.Errorf(
					"%w: one of the groups %q is already exists",
					entity.ErrBadRequest, params.Groups,
				)
			}
			return nil, err
		}

	case "remove":
		var gm *model.GroupCategoryGroup
		result := tx.Model(gm).Where(
			"`deleted` = ?", 0,
		).Where(
			"`project` = ?", params.Project,
		).Where(
			"`group_category_id` = ?", params.ID,
		).Where(
			"`path` IN ?", params.Groups,
		).Updates(map[string]interface{}{
			"deleted":         gorm.Expr("id"),
			"modified_at_utc": now,
			"modified_by":     modifiedBy,
		})
		if err := result.Error; err != nil {
			return nil, err
		}
		if result.RowsAffected == 0 {
			return nil, fmt.Errorf(
				"%w: any of the groups %q not found", entity.ErrRecordNotFound, params.Groups,
			)
		}

	default:
		return nil, fmt.Errorf("invalid operation %q", params.Operation)
	}

	var cm *model.GroupCategory
	result := tx.Model(cm).Where(
		"`deleted` = ?", 0,
	).Where(
		"`project` = ?", params.Project,
	).Where(
		"`id` = ?", params.ID,
	).Updates(map[string]interface{}{
		"modified_at_utc": now,
		"modified_by":     modifiedBy,
	})
	if err := result.Error; err != nil {
		return nil, err
	}
	if result.RowsAffected == 0 {
		return nil, fmt.Errorf(
			"%w: category with ID %d not found", entity.ErrRecordNotFound, params.ID,
		)
	}

	cm, err := r.get(tx, &groupCategory.GetParams{
		Project: params.Project,
		ID:      params.ID,
	})
	if err != nil {
		return nil, err
	}
	return cm.Entity(false), nil
}

func (r *GroupCategory) Delete(
	tx *gorm.DB,
	params *groupCategory.DeleteParams,
) error {
	now := time.Now().UTC()
	var modifiedBy string
	if params.ModifiedBy != nil {
		modifiedBy = *params.ModifiedBy
	}
	var m *model.GroupCategory
	result := tx.Model(m).Where(
		"`deleted` = ?", 0,
	).Where(
		"`project` = ?", params.Project,
	).Where(
		"`id` = ?", params.ID,
	).Updates(map[string]interface{}{
		"deleted":         gorm.Expr("id"),
		"modified_at_utc": now,
		"modified_by":     modifiedBy,
	})
	if err := result.Error; err != nil {
		return err
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf(
			"%w: category with ID %d not found", entity.ErrRecordNotFound, params.ID,
		)
	}
	return nil
}
