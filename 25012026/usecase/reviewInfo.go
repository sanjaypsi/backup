/* ──────────────────────────────────────────────────────────────────────────
	Module Name:
    	usecase/reviewInfo.go

	Module Description:
		Usecase layer for managing review information.

	Details:

	Update and Modification History:
	* - 29-10-2025 - SanjayK PSI - Implemented dynamic filtering and sorting for latest submissions.
	* - 17-11-2025 - SanjayK PSI - Added phase-aware status filtering and sorting.
	* - 22-11-2025 - SanjayK PSI - Fixed bugs related to phase-specific filtering and sorting.

	Functions:
	* - List: Retrieves a list of review information based on parameters.
	* - Get: Fetches a specific review information entry.
	* - Create: Creates a new review information entry.
	* - ListAssetsPivot: Provides filtered, phase-aware pivoted asset data.

	────────────────────────────────────────────────────────────────────────── */

package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/PolygonPictures/central30-web/front/entity"
	"github.com/PolygonPictures/central30-web/front/repository"
	"github.com/gin-gonic/gin/binding"
	"gorm.io/gorm"
)

type ReviewInfo struct {
	repo         *repository.ReviewInfo
	prjRepo      *repository.ProjectInfo
	stuRepo      *repository.StudioInfo
	docRepo      entity.DocumentRepository
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

func NewReviewInfo(
	repo *repository.ReviewInfo,
	pr *repository.ProjectInfo,
	sr *repository.StudioInfo,
	dr entity.DocumentRepository,
	readTimeout time.Duration,
	writeTimeout time.Duration,
) *ReviewInfo {
	return &ReviewInfo{
		repo:         repo,
		prjRepo:      pr,
		stuRepo:      sr,
		docRepo:      dr,
		ReadTimeout:  readTimeout,
		WriteTimeout: writeTimeout,
	}
}

func (uc *ReviewInfo) checkForProject(db *gorm.DB, project string) error {
	_, err := uc.prjRepo.Get(db, &entity.GetProjectInfoParams{
		KeyName: project,
	})
	return err
}

func (uc *ReviewInfo) checkForStudio(db *gorm.DB, studio string) error {
	_, err := uc.stuRepo.Get(db, &entity.GetStudioInfoParams{
		KeyName: studio,
	})
	return err
}

func (uc *ReviewInfo) List(
	ctx context.Context,
	params *entity.ListReviewInfoParams,
) ([]*entity.ReviewInfo, int, error) {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return nil, 0, err
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.ReadTimeout)
	defer cancel()
	db := uc.repo.WithContext(timeoutCtx)
	if err := uc.checkForProject(db, params.Project); err != nil {
		return nil, 0, err
	}
	if params.Studio != nil {
		if err := uc.checkForStudio(db, *params.Studio); err != nil {
			return nil, 0, err
		}
	}
	return uc.repo.List(db, params)
}

func (uc *ReviewInfo) Get(
	ctx context.Context,
	params *entity.GetReviewParams,
) (*entity.ReviewInfo, error) {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return nil, err
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.ReadTimeout)
	defer cancel()
	db := uc.repo.WithContext(timeoutCtx)
	if err := uc.checkForProject(db, params.Project); err != nil {
		return nil, err
	}
	return uc.repo.Get(db, params)
}

func (uc *ReviewInfo) Create(
	ctx context.Context,
	params *entity.CreateReviewInfoParams,
) (*entity.ReviewInfo, error) {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return nil, err
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.WriteTimeout)
	defer cancel()
	db := uc.repo.WithContext(timeoutCtx)
	if err := uc.checkForProject(db, params.Project); err != nil {
		return nil, err
	}
	if err := uc.checkForStudio(db, params.Studio); err != nil {
		return nil, err
	}
	var e *entity.ReviewInfo
	if err := uc.repo.TransactionWithContext(timeoutCtx, func(tx *gorm.DB) error {
		var err error
		e, err = uc.repo.Create(tx, params)
		return err
	}); err != nil {
		return nil, err
	}

	// Create a comment when creating a review.
	// https://docs.google.com/spreadsheets/d/14VSOi7h_zh5TP0JK3nBXjVoAQhrete3XahPZ96h30Wo/edit#gid=734852926
	var user string
	if params.CreatedBy != nil {
		user = *params.CreatedBy
	}
	commentdata := []map[string]interface{}{}
	defaultrole := "artist"
	for _, commentinfo := range params.ReviewComments {
		role := commentinfo.ResponsiblePersonRole
		if role == nil {
			role = &defaultrole
		}
		comment := map[string]interface{}{
			"language":                commentinfo.Language,
			"text":                    commentinfo.Text,
			"attachments":             commentinfo.Attachments,
			"need_translation":        commentinfo.NeedTranslation,
			"is_translated":           commentinfo.IsTranslated,
			"responsible_person_role": role,
		}
		commentdata = append(commentdata, comment)
	}

	if _, err := uc.docRepo.CreateDocument(
		context.WithValue(timeoutCtx, entity.KeyUser, user),
		params.Project,
		"comment",
		map[string]interface{}{
			"root":                 params.Root,
			"groups":               params.Groups,
			"relation":             params.Relation,
			"phase":                params.Phase,
			"original_comment_id":  nil,
			"task_id":              params.TaskID,
			"subtask_id":           params.SubtaskID,
			"path":                 params.TakePath,
			"take":                 params.Take,
			"comment_data":         commentdata,
			"studio":               params.Studio,
			"project":              params.Project,
			"submitted_at_utc":     params.SubmittedAtUtc.Format(time.RFC3339Nano),
			"submitted_user":       params.SubmittedUser,
			"submitted_computer":   params.SubmittedComputer,
			"submitted_os":         params.SubmittedOS,
			"submitted_os_version": params.SubmittedOSVersion,
			"component":            params.Component,
			"type":                 "review",
			"tool":                 "ppiCentralWeb",
		},
	); err != nil {
		return nil, err
	}

	return e, nil
}

func (uc *ReviewInfo) Update(
	ctx context.Context,
	params *entity.UpdateReviewInfoParams,
) (*entity.ReviewInfo, error) {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return nil, err
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.WriteTimeout)
	defer cancel()
	db := uc.repo.WithContext(timeoutCtx)
	if err := uc.checkForProject(db, params.Project); err != nil {
		return nil, err
	}
	var e *entity.ReviewInfo
	if err := uc.repo.TransactionWithContext(timeoutCtx, func(tx *gorm.DB) error {
		var err error
		e, err = uc.repo.Update(tx, params)
		return err
	}); err != nil {
		return nil, err
	}
	return e, nil
}

func (uc *ReviewInfo) Delete(
	ctx context.Context,
	params *entity.DeleteReviewInfoParams,
) error {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return err
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.WriteTimeout)
	defer cancel()
	return uc.repo.TransactionWithContext(timeoutCtx, func(tx *gorm.DB) error {
		if err := uc.checkForProject(tx, params.Project); err != nil {
			return err
		}
		return uc.repo.Delete(tx, params)
	})
}

func (uc *ReviewInfo) ListAssets(
	ctx context.Context,
	params *entity.AssetListParams,
) ([]*entity.Asset, int, error) {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return nil, 0, err
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.ReadTimeout)
	defer cancel()
	db := uc.repo.WithContext(timeoutCtx)
	if err := uc.checkForProject(db, params.Project); err != nil {
		return nil, 0, err
	}
	if params.Studio != nil {
		if err := uc.checkForStudio(db, *params.Studio); err != nil {
			return nil, 0, err
		}
	}
	return uc.repo.ListAssets(db, params)
}

func (uc *ReviewInfo) ListAssetReviewInfos(
	ctx context.Context,
	params *entity.AssetReviewInfoListParams,
) ([]*entity.ReviewInfo, error) {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return nil, err
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.ReadTimeout)
	defer cancel()
	db := uc.repo.WithContext(timeoutCtx)
	if err := uc.checkForProject(db, params.Project); err != nil {
		return nil, err
	}
	if params.Studio != nil {
		if err := uc.checkForStudio(db, *params.Studio); err != nil {
			return nil, err
		}
	}
	return uc.repo.ListAssetReviewInfos(db, params)
}

func (uc *ReviewInfo) ListShotReviewInfos(
	ctx context.Context,
	params *entity.ShotReviewInfoListParams,
) ([]*entity.ReviewInfo, error) {
	if err := binding.Validator.ValidateStruct(params); err != nil {
		return nil, err
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, uc.ReadTimeout)
	defer cancel()
	db := uc.repo.WithContext(timeoutCtx)
	if err := uc.checkForProject(db, params.Project); err != nil {
		return nil, err
	}
	if params.Studio != nil {
		if err := uc.checkForStudio(db, *params.Studio); err != nil {
			return nil, err
		}
	}
	return uc.repo.ListShotReviewInfos(db, params)
}

/*
	──────────────────────────────────────────────────────────────────────────

ListAssetsPivotParams defines the parameters for listing asset pivots.
It includes filtering, sorting, pagination, and view options.

Fields:
  - Project: The project identifier to filter assets.
  - Root: The root path or identifier for asset grouping.
  - PreferredPhase: The preferred phase to filter assets.
  - OrderKey: The key by which to order the results.
  - Direction: The sort direction ("asc" or "desc").
  - Page: The page number for pagination.
  - PerPage: The number of items per page.
  - AssetNameKey: The key to filter assets by name.
  - ApprovalStatuses: List of approval statuses to filter assets.
  - WorkStatuses: List of work statuses to filter assets.
  - View: The view type, either "list" or "grouped".

──────────────────────────────────────────────────────────────────────────
*/
type ListAssetsPivotParams struct {
	Project          string
	Root             string
	PreferredPhase   string
	OrderKey         string
	Direction        string
	Page             int
	PerPage          int
	AssetNameKey     string
	ApprovalStatuses []string
	WorkStatuses     []string
	View             string // "list" or "grouped"
}

type ListAssetsPivotResult struct {
	Assets   []repository.AssetPivot
	Groups   []repository.GroupedAssetBucket
	Total    int64
	Page     int
	PerPage  int
	PageLast int
	HasNext  bool
	HasPrev  bool
	Sort     string
	Dir      string
}

/*
	──────────────────────────────────────────────────────────────────────────

	Add this method on your existing usecase.ReviewInfo
	ListAssetsPivot retrieves a paginated list of asset pivots for a given project.
	It supports both flat and grouped views, with sorting and filtering options.

	Parameters:
	- ctx: Context for request-scoped values and cancellation.
	- p: ListAssetsPivotParams containing query parameters such as project, root, pagination, sorting, filtering, and view type.

	Returns:
	- *ListAssetsPivotResult: The result containing assets, groups, pagination info, and sorting details.
	- error: Non-nil if an error occurred during retrieval.

	Behavior:
	- Validates required parameters and applies defaults for pagination and sorting.
	- For flat view, retrieves assets directly from the repository with pagination.
	- For grouped view, fetches all assets, groups and sorts them, then paginates the grouped result.
	- Returns pagination metadata including total count, current page, last page, and navigation flags.

	Errors:
	- Returns an error if the project parameter is missing or if repository access fails.

──────────────────────────────────────────────────────────────────────────
*/
func (u *ReviewInfo) ListAssetsPivot(ctx context.Context, p ListAssetsPivotParams) (*ListAssetsPivotResult, error) {
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

	isGroupedView := p.View == "group" || p.View == "grouped" || p.View == "category"

	// ---------- LIST VIEW ----------
	if !isGroupedView {
		assets, total, err := u.repo.ListAssetsPivot(
			ctx,
			p.Project,
			p.Root,
			p.PreferredPhase,
			p.OrderKey,
			strings.ToLower(dir),
			limit,
			offset,
			p.AssetNameKey,
			p.ApprovalStatuses,
			p.WorkStatuses,
		)
		if err != nil {
			return nil, err
		}

		pageLast := int((total + int64(p.PerPage) - 1) / int64(p.PerPage))

		return &ListAssetsPivotResult{
			Assets:   assets,
			Groups:   nil,
			Total:    total,
			Page:     p.Page,
			PerPage:  p.PerPage,
			PageLast: pageLast,
			HasNext:  offset+limit < int(total),
			HasPrev:  p.Page > 1,
			Sort:     p.OrderKey,
			Dir:      strings.ToLower(dir),
		}, nil
	}

	// ---------- GROUPED VIEW (group-first order, then paginate) ----------
	const allLimit = 1_000_000
	assetsAll, total, err := u.repo.ListAssetsPivot(
		ctx,
		p.Project,
		p.Root,
		p.PreferredPhase,
		"group_1",
		"asc",
		allLimit,
		0,
		p.AssetNameKey,
		p.ApprovalStatuses,
		p.WorkStatuses,
	)
	if err != nil {
		return nil, err
	}

	groupedAll := repository.GroupAndSortByTopNode(assetsAll, repository.SortDirection(dir))

	flat := make([]repository.AssetPivot, 0, len(assetsAll))
	for _, g := range groupedAll {
		flat = append(flat, g.Items...)
	}

	totalAssets := len(flat)
	if totalAssets == 0 {
		return &ListAssetsPivotResult{
			Assets:   []repository.AssetPivot{},
			Groups:   []repository.GroupedAssetBucket{},
			Total:    0,
			Page:     p.Page,
			PerPage:  p.PerPage,
			PageLast: 0,
			HasNext:  false,
			HasPrev:  false,
			Sort:     "group_1",
			Dir:      strings.ToLower(dir),
		}, nil
	}

	start := offset
	if start > totalAssets {
		start = totalAssets
	}
	end := start + limit
	if end > totalAssets {
		end = totalAssets
	}

	pageSlice := flat[start:end]
	pageGroups := repository.GroupAndSortByTopNode(pageSlice, repository.SortDirection(dir))

	pageLast := (totalAssets + p.PerPage - 1) / p.PerPage

	return &ListAssetsPivotResult{
		Assets:   pageSlice,
		Groups:   pageGroups,
		Total:    total,
		Page:     p.Page,
		PerPage:  p.PerPage,
		PageLast: pageLast,
		HasNext:  offset+limit < totalAssets,
		HasPrev:  p.Page > 1,
		Sort:     "group_1",
		Dir:      strings.ToLower(dir),
	}, nil
}
