package delivery

/* ──────────────────────────────────────────────────────────────────────────
	Module Name:
    	delivery/reviewInfo.go

	Module Description:
		HTTP delivery handlers for review information management.

	Details:

	Update and Modification History:
		* - 29-10-2025 - SanjayK PSI - Initial creation sorting pagination implementation.
		* - 07-11-2025 - SanjayK PSI - Column visibility toggling implementation.
		* - 20-11-2025 - SanjayK PSI - Fixed typo in filter property names handling.

	Functions:
		* NewReviewInfo: Creates a new ReviewInfo handler.
		* (ReviewInfo) List: Handles listing review information with filtering and pagination.
		* (ReviewInfo) Get: Handles retrieving a specific review information by ID.
		* (ReviewInfo) Post: Handles creating new review information.
		* (ReviewInfo) Update: Handles updating existing review information.
		* (ReviewInfo) Delete: Handles deleting review information by ID.
		* (ReviewInfo) ListAssets: Handles listing assets with filtering and pagination.
		* (ReviewInfo) ListAssetReviewInfos: Handles listing review information for a specific asset.
		* (ReviewInfo) ListShotReviewInfos: Handles listing review information for specific shots.
		* (splitCSV) – utility function: Splits a comma-separated string into a slice of trimmed strings.
		* (ReviewInfo) ListAssetsPivot: Handles listing pivoted assets with filtering and sorting.
	────────────────────────────────────────────────────────────────────────── */

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/PolygonPictures/central30-web/front/entity"
	"github.com/PolygonPictures/central30-web/front/libs"
	"github.com/PolygonPictures/central30-web/front/usecase"
	"github.com/gin-gonic/gin"
)

type listReviewInfoParams struct {
	Studio        *string    `form:"studio"`
	TaskID        *string    `form:"task_id"`
	SubtaskID     *string    `form:"subtask_id"`
	Root          *string    `form:"root"`
	Group         *string    `form:"groups"`
	Relation      *string    `form:"relation"`
	Phase         *string    `form:"phase"`
	Component     *string    `form:"component"`
	Take          *string    `form:"take"`
	PerPage       *int       `form:"per_page"`
	Page          *int       `form:"page"`
	ModifiedSince *time.Time `form:"modified_since"`
}

func (p *listReviewInfoParams) Entity(project string) *entity.ListReviewInfoParams {
	var group []string
	if p.Group != nil {
		group = strings.Split(*p.Group, "/")
	}
	var relation []string
	if p.Relation != nil {
		relation = strings.Split(*p.Relation, ",")
	}
	var phase []string
	if p.Phase != nil {
		phase = strings.Split(*p.Phase, ",")
	}
	params := &entity.ListReviewInfoParams{
		Project:   project,
		Studio:    p.Studio,
		TaskID:    p.TaskID,
		SubtaskID: p.SubtaskID,
		Root:      p.Root,
		Group:     group,
		Relation:  relation,
		Phase:     phase,
		Component: p.Component,
		Take:      p.Take,
		BaseListParams: &entity.BaseListParams{
			PerPage: p.PerPage,
			Page:    p.Page,
		},
	}
	if p.ModifiedSince != nil {
		params.ModifiedSince = p.ModifiedSince
	}

	return params
}

type createReviewInfoParams struct {
	TaskID                    string              `json:"task_id"`
	SubtaskID                 string              `json:"subtask_id"`
	Studio                    string              `json:"studio"`
	ProjectPath               string              `json:"project_path"`
	ReviewComments            []*libs.CommentInfo `json:"review_comments"`
	Path                      *string             `json:"path"`
	TakePath                  string              `json:"take_path" binding:"required_without=Path"`
	Root                      string              `json:"root"`
	Groups                    []string            `json:"groups"`
	Relation                  string              `json:"relation"`
	Phase                     string              `json:"phase"`
	Component                 string              `json:"component"`
	Take                      string              `json:"take"`
	ApprovalStatus            string              `json:"approval_status"`
	ApprovalStatusUpdatedUser string              `json:"approval_status_updated_user"`
	WorkStatus                string              `json:"work_status"`
	WorkStatusUpdatedUser     string              `json:"work_status_updated_user"`
	ReviewTarget              []*libs.Content     `json:"review_target"`
	ReviewData                []*libs.Content     `json:"review_data"`
	OutputContents            []*libs.Content     `json:"output_contents"`
	SubmittedAtUtc            time.Time           `json:"submitted_at_utc"`
	SubmittedComputer         string              `json:"submitted_computer"`
	SubmittedOS               string              `json:"submitted_os"`
	SubmittedOSVersion        string              `json:"submitted_os_version"`
	SubmittedUser             string              `json:"submitted_user"`
	ExecutedAtUtc             time.Time           `json:"executed_at_utc"`
	ExecutedComputer          string              `json:"executed_computer"`
	ExecutedOS                string              `json:"executed_os"`
	ExecutedOSVersion         string              `json:"executed_os_version"`
	ExecutedUser              string              `json:"executed_user"`
	AllFiles                  []*libs.File        `json:"all_files"`
	NumAllFiles               uint32              `json:"num_all_files"`
	SizeAllFiles              uint64              `json:"size_all_files"`
	TargetComponents          []string            `json:"target_components"`

	Duration                    *int32  `json:"duration,omitempty"`
	DurationTimeline            *string `json:"duration_timeline,omitempty"`
	ExportShotsVersions         *bool   `json:"export_shotsVersions,omitempty"`
	ExportShotsVersionsRevision *string `json:"export_shotsVersions_revision,omitempty"`
	ExportShotsVersionsPath     *string `json:"export_shotsVersions_path,omitempty"`
}

func (p *createReviewInfoParams) Entity(
	project string,
	createdBy *string,
) *entity.CreateReviewInfoParams {
	takePath := p.TakePath
	if takePath == "" && p.Path != nil {
		takePath = *p.Path
	}
	return &entity.CreateReviewInfoParams{
		Project:   project,
		CreatedBy: createdBy,

		TaskID:                    p.TaskID,
		SubtaskID:                 p.SubtaskID,
		Studio:                    p.Studio,
		ProjectPath:               p.ProjectPath,
		ReviewComments:            p.ReviewComments,
		TakePath:                  takePath,
		Root:                      p.Root,
		Groups:                    p.Groups,
		Relation:                  p.Relation,
		Phase:                     p.Phase,
		Component:                 p.Component,
		Take:                      p.Take,
		ApprovalStatus:            p.ApprovalStatus,
		ApprovalStatusUpdatedUser: p.ApprovalStatusUpdatedUser,
		WorkStatus:                p.WorkStatus,
		WorkStatusUpdatedUser:     p.WorkStatusUpdatedUser,
		ReviewTarget:              p.ReviewTarget,
		ReviewData:                p.ReviewData,
		OutputContents:            p.OutputContents,
		SubmittedAtUtc:            p.SubmittedAtUtc,
		SubmittedComputer:         p.SubmittedComputer,
		SubmittedOS:               p.SubmittedOS,
		SubmittedOSVersion:        p.SubmittedOSVersion,
		SubmittedUser:             p.SubmittedUser,
		ExecutedAtUtc:             p.ExecutedAtUtc,
		ExecutedComputer:          p.ExecutedComputer,
		ExecutedOS:                p.ExecutedOS,
		ExecutedOSVersion:         p.ExecutedOSVersion,
		ExecutedUser:              p.ExecutedUser,
		AllFiles:                  p.AllFiles,
		NumAllFiles:               p.NumAllFiles,
		SizeAllFiles:              p.SizeAllFiles,
		TargetComponents:          p.TargetComponents,

		Duration:                    p.Duration,
		DurationTimeline:            p.DurationTimeline,
		ExportShotsVersions:         p.ExportShotsVersions,
		ExportShotsVersionsRevision: p.ExportShotsVersionsRevision,
		ExportShotsVersionsPath:     p.ExportShotsVersionsPath,
	}
}

type updateReviewInfoParams struct {
	ApprovalStatus            *string `json:"approval_status,omitempty"`
	ApprovalStatusUpdatedUser *string `json:"approval_status_updated_user,omitempty"`
	WorkStatus                *string `json:"work_status,omitempty"`
	WorkStatusUpdatedUser     *string `json:"work_status_updated_user,omitempty"`
}

func (p *updateReviewInfoParams) Entity(
	project string,
	id int32,
	modifiedBy *string,
) *entity.UpdateReviewInfoParams {
	return &entity.UpdateReviewInfoParams{
		ApprovalStatus:            p.ApprovalStatus,
		ApprovalStatusUpdatedUser: p.ApprovalStatusUpdatedUser,
		WorkStatus:                p.WorkStatus,
		WorkStatusUpdatedUser:     p.WorkStatusUpdatedUser,
		Project:                   project,
		ID:                        id,
		ModifiedBy:                modifiedBy,
	}
}

func NewReviewInfo(
	uc *usecase.ReviewInfo,
) *ReviewInfo {
	return &ReviewInfo{
		uc: uc,
	}
}

type ReviewInfo struct {
	uc *usecase.ReviewInfo
}

func (h *ReviewInfo) List(c *gin.Context) {
	var p listReviewInfoParams
	if err := c.ShouldBindQuery(&p); err != nil {
		badRequest(c, err)
		return
	}
	params := p.Entity(c.Param("project"))
	entities, total, err := h.uc.List(c.Request.Context(), params)
	if err != nil {
		internalServerError(c, err)
		return
	}

	res := libs.CreateListResponse("reviews", entities, c.Request, params, total)
	c.PureJSON(http.StatusOK, res)
}

func (h *ReviewInfo) Get(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		badRequest(c, err)
		return
	}
	params := &entity.GetReviewParams{
		Project: c.Param("project"),
		ID:      int32(id),
	}
	e, err := h.uc.Get(c.Request.Context(), params)
	if err != nil {
		if errors.Is(err, entity.ErrRecordNotFound) {
			badRequest(c, fmt.Errorf("review info with ID %d not found", params.ID))
			return
		}
		internalServerError(c, err)
		return
	}
	c.PureJSON(http.StatusOK, e)
}

func (h *ReviewInfo) Post(c *gin.Context) {
	var p createReviewInfoParams
	if err := c.ShouldBind(&p); err != nil {
		badRequest(c, err)
		return
	}
	params := p.Entity(c.Param("project"), nil)
	e, err := h.uc.Create(c.Request.Context(), params)
	if err != nil {
		internalServerError(c, err)
		return
	}
	c.PureJSON(http.StatusOK, e)
}

func (h *ReviewInfo) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		badRequest(c, err)
		return
	}
	var p updateReviewInfoParams
	if err := c.ShouldBind(&p); err != nil {
		badRequest(c, err)
		return
	}
	params := p.Entity(c.Param("project"), int32(id), nil)
	e, err := h.uc.Update(c.Request.Context(), params)
	if err != nil {
		if errors.Is(err, entity.ErrRecordNotFound) {
			badRequest(c, fmt.Errorf("review info with ID %d not found", params.ID))
			return
		}
		internalServerError(c, err)
		return
	}
	c.PureJSON(http.StatusOK, e)
}

func (h *ReviewInfo) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		badRequest(c, err)
		return
	}
	params := &entity.DeleteReviewInfoParams{
		Project:    c.Param("project"),
		ID:         int32(id),
		ModifiedBy: nil,
	}
	if err := h.uc.Delete(c.Request.Context(), params); err != nil {
		if errors.Is(err, entity.ErrRecordNotFound) {
			badRequest(c, fmt.Errorf("review info with ID %d not found", params.ID))
			return
		}
		internalServerError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

type assetListParams struct {
	Studio  *string `form:"studio"`
	PerPage *int    `form:"per_page"`
	Page    *int    `form:"page"`
}

func (p *assetListParams) Entity(project string) *entity.AssetListParams {
	params := &entity.AssetListParams{
		Project: project,
		Studio:  p.Studio,
		BaseListParams: &entity.BaseListParams{
			PerPage: p.PerPage,
			Page:    p.Page,
		},
	}

	return params
}

func (h *ReviewInfo) ListAssets(c *gin.Context) {
	var p assetListParams
	if err := c.ShouldBindQuery(&p); err != nil {
		badRequest(c, err)
		return
	}
	params := p.Entity(c.Param("project"))
	entities, total, err := h.uc.ListAssets(c.Request.Context(), params)
	if err != nil {
		internalServerError(c, err)
		return
	}

	res := libs.CreateListResponse("assets", entities, c.Request, params, total)
	c.PureJSON(http.StatusOK, res)
}

func (p *listReviewInfoParams) assetReviewInfoEntity(
	project string,
	asset string,
	relation string,
) *entity.AssetReviewInfoListParams {
	params := &entity.AssetReviewInfoListParams{
		Project:  project,
		Asset:    asset,
		Relation: relation,
	}

	return params
}

func (h *ReviewInfo) ListAssetReviewInfos(c *gin.Context) {
	var p listReviewInfoParams
	if err := c.ShouldBindQuery(&p); err != nil {
		badRequest(c, err)
		return
	}

	params := p.assetReviewInfoEntity(
		c.Param("project"),
		c.Param("asset"),
		c.Param("relation"),
	)
	entities, err := h.uc.ListAssetReviewInfos(c.Request.Context(), params)
	if err != nil {
		internalServerError(c, err)
		return
	}

	res := map[string]interface{}{
		"reviews": entities,
	}
	c.PureJSON(http.StatusOK, res)
}

func (p *listReviewInfoParams) shotReviewInfoEntity(
	project string,
	group string,
	relation string,
) *entity.ShotReviewInfoListParams {
	var groups []string
	if group != "" {
		groups = strings.Split(group, "/")
	}
	params := &entity.ShotReviewInfoListParams{
		Project:  project,
		Groups:   groups,
		Relation: relation,
	}

	return params
}

func (h *ReviewInfo) ListShotReviewInfos(c *gin.Context) {
	var p listReviewInfoParams
	if err := c.ShouldBindQuery(&p); err != nil {
		badRequest(c, err)
		return
	}

	params := p.shotReviewInfoEntity(
		c.Param("project"),
		c.Query("groups"),
		c.Query("relation"),
	)
	entities, err := h.uc.ListShotReviewInfos(c.Request.Context(), params)
	if err != nil {
		internalServerError(c, err)
		return
	}

	res := map[string]interface{}{
		"reviews": entities,
	}
	c.PureJSON(http.StatusOK, res)
}

/*
* ========================================================================================
  - splitCSV – utility function
  - Splits a comma-separated string into a slice of trimmed strings.
  - Ignores empty entries.

==========================================================================================
*/
func splitCSV(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

/*
========================================================================================
  - ListAssetsPivot – handler function
  - Handles HTTP requests to list pivoted assets with filtering, sorting, and pagination.
  - Extracts parameters from the request, invokes the usecase, and returns the results as JSON.

========================================================================================
*/
func (h *ReviewInfo) ListAssetsPivot(c *gin.Context) {
	// ---- Required path param ----
	project := strings.TrimSpace(c.Param("project"))
	if project == "" {
		badRequest(c, fmt.Errorf("project is required"))
		return
	}

	// ---- Query params ----
	root := strings.TrimSpace(c.DefaultQuery("root", "assets"))
	if root == "" {
		root = "assets"
	}

	view := strings.TrimSpace(c.DefaultQuery("view", "list")) // list | grouped

	sortKey := strings.TrimSpace(c.DefaultQuery("sort", "group_1"))
	dir := strings.TrimSpace(c.DefaultQuery("dir", "asc")) // usecase will normalize

	phase := strings.TrimSpace(c.DefaultQuery("phase", "none"))
	if phase == "" {
		phase = "none"
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}

	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "15"))
	if perPage < 1 {
		perPage = 15
	}

	assetNameKey := strings.TrimSpace(c.DefaultQuery("name", ""))

	// Support both new & old query keys
	approvalRaw := c.Query("approval_status")
	if approvalRaw == "" {
		approvalRaw = c.Query("appr")
	}
	workRaw := c.Query("work_status")
	if workRaw == "" {
		workRaw = c.Query("work")
	}

	approvalStatuses := splitCSV(approvalRaw)
	workStatuses := splitCSV(workRaw)

	// ---- Context timeout ----
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// ---- NEW usecase signature: (ctx, params) -> (result, error) ----
	params := usecase.ListAssetsPivotParams{
		Project:          project,
		Root:             root,
		PreferredPhase:   phase,
		OrderKey:         sortKey,
		Direction:        dir,
		Page:             page,
		PerPage:          perPage,
		AssetNameKey:     assetNameKey,
		ApprovalStatuses: approvalStatuses,
		WorkStatuses:     workStatuses,
		View:             view,
	}

	result, err := h.uc.ListAssetsPivot(ctx, params)
	if err != nil {
		internalServerError(c, err)
		return
	}

	res := gin.H{
		"assets":    result.Assets,
		"total":     result.Total,
		"page":      result.Page,
		"per_page":  result.PerPage,
		"page_last": result.PageLast,
		"has_next":  result.HasNext,
		"has_prev":  result.HasPrev,
		"sort":      result.Sort,
		"dir":       result.Dir,
		"project":   project,
		"root":      root,
		"view":      view,
	}
	if len(result.Groups) > 0 {
		res["groups"] = result.Groups
	}

	c.PureJSON(http.StatusOK, res)
}
