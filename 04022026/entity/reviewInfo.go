/* ──────────────────────────────────────────────────────────────────────────
	Module Name:
    	entity/reviewInfo.go

	Module Description:
		Entity definitions and parameter structures for review information management.

	Details:

	Update and Modification History:
	* - 29-10-2025 - SanjayK PSI - Initial creation sorting pagination implementation.
	* - 20-11-2025 - SanjayK PSI - Fixed typo in filter property names handling.

	Functions:
	* - AssetPivot: Represents pivot information for assets including work and approval statuses.
	* - LatestSubmissionRow: Represents a row containing latest submission information.
	────────────────────────────────────────────────────────────────────────── */

package entity

import (
	"encoding/json"
	"time"

	"github.com/PolygonPictures/central30-web/front/libs"
)

type Contents []*libs.Content

func (c *Contents) MarshalJSON() ([]byte, error) {
	if c == nil || len(*c) == 0 {
		return []byte("[]"), nil
	}
	var contents []*libs.Content = *c
	return json.Marshal(contents)
}

type Files []*libs.File

func (a *Files) MarshalJSON() ([]byte, error) {
	if a == nil || len(*a) == 0 {
		return []byte("[]"), nil
	}
	var files []*libs.File = *a
	return json.Marshal(files)
}

type Components []string

func (c *Components) MarshalJSON() ([]byte, error) {
	if c == nil || len(*c) == 0 {
		return []byte("[]"), nil
	}
	var components []string = *c
	return json.Marshal(components)
}

// Specification change: https://jira.ppi.co.jp/browse/POTOO-2406
// Specification change: https://jira.ppi.co.jp/browse/POTOO-2594
// Specification change: https://jira.ppi.co.jp/browse/POTOO-2666
type ReviewInfo struct {
	TaskID                     string              `json:"task_id"`
	SubtaskID                  string              `json:"subtask_id"`
	Studio                     string              `json:"studio"`
	Project                    string              `json:"project"`
	ProjectPath                string              `json:"project_path"`
	ReviewComments             []*libs.CommentInfo `json:"review_comments"`
	Path                       string              `json:"path"` // TODO: Remove the "Path" property after the tool migration is complete
	TakePath                   string              `json:"take_path"`
	Root                       string              `json:"root"`
	Groups                     []string            `json:"groups"`
	Relation                   string              `json:"relation"`
	Phase                      string              `json:"phase"`
	Component                  string              `json:"component"`
	Take                       string              `json:"take"`
	ApprovalStatus             string              `json:"approval_status"`
	ApprovalStatusUpdatedUser  string              `json:"approval_status_updated_user"`
	ApprovalStatusUpdatedAtUtc time.Time           `json:"approval_status_updated_at_utc"`
	WorkStatus                 string              `json:"work_status"`
	WorkStatusUpdatedUser      string              `json:"work_status_updated_user"`
	WorkStatusUpdatedAtUtc     time.Time           `json:"work_status_updated_at_utc"`
	ReviewTarget               Contents            `json:"review_target"`
	ReviewData                 Contents            `json:"review_data"`
	OutputContents             Contents            `json:"output_contents"`
	SubmittedAtUtc             time.Time           `json:"submitted_at_utc"`
	SubmittedComputer          string              `json:"submitted_computer"`
	SubmittedOS                string              `json:"submitted_os"`
	SubmittedOSVersion         string              `json:"submitted_os_version"`
	SubmittedUser              string              `json:"submitted_user"`
	ExecutedAtUtc              time.Time           `json:"executed_at_utc"`
	ExecutedComputer           string              `json:"executed_computer"`
	ExecutedOS                 string              `json:"executed_os"`
	ExecutedOSVersion          string              `json:"executed_os_version"`
	ExecutedUser               string              `json:"executed_user"`
	AllFiles                   Files               `json:"all_files"`
	NumAllFiles                uint32              `json:"num_all_files"`
	SizeAllFiles               uint64              `json:"size_all_files"`
	TargetComponents           Components          `json:"target_components"`

	Duration                    *int32  `json:"duration,omitempty"`
	DurationTimeline            *string `json:"duration_timeline,omitempty"`
	ExportShotsVersions         *bool   `json:"export_shots_versions,omitempty"`
	ExportShotsVersionsRevision *string `json:"export_shots_versions_revision,omitempty"`
	ExportShotsVersionsPath     *string `json:"export_shots_version_path,omitempty"`

	CreatedAtUTC  time.Time `json:"created_at_utc"`
	ModifiedAtUTC time.Time `json:"modified_at_utc"`
	Deleted       *int32    `json:"deleted,omitempty"`
	ModifiedBy    string    `json:"modified_by"`
	CreatedBy     string    `json:"created_by"`
	ID            int32     `json:"id"`
}

type ListReviewInfoParams struct {
	Project       string     `binding:"min=1,max=30,alphanum,lowercase,startsnotwithdigit"`
	Studio        *string    `binding:"omitempty,min=1,max=30,alphanum,lowercase,startsnotwithdigit"`
	TaskID        *string    `binding:"omitempty,uuid"`
	SubtaskID     *string    `binding:"omitempty,uuid"`
	Root          *string    `binding:"omitempty,min=1,max=30"`
	Group         []string   `binding:"max=5,dive,max=100"`
	Relation      []string   `binding:"omitempty,dive,max=100"`
	Phase         []string   `binding:"omitempty,dive,max=100"`
	Component     *string    `binding:"omitempty,min=1,max=100"`
	Take          *string    `binding:"omitempty,len=30"`
	ModifiedSince *time.Time ``
	*BaseListParams
}

func (ListReviewInfoParams) DefaultPerPage() int {
	return 50
}

type GetReviewParams struct {
	Project string `binding:"min=1,max=30,alphanum,lowercase,startsnotwithdigit"`
	ID      int32  `binding:"required"`
}

type CreateReviewInfoParams struct {
	Project   string  `binding:"min=1,max=30,alphanum,lowercase,startsnotwithdigit"`
	CreatedBy *string `binding:"omitempty,min=1,max=100"`

	TaskID                    string              `binding:"uuid"`
	SubtaskID                 string              `binding:"uuid"`
	Studio                    string              `binding:"min=1,max=30,alphanum,lowercase,startsnotwithdigit"`
	ProjectPath               string              ``
	ReviewComments            []*libs.CommentInfo `binding:"required"`
	TakePath                  string              `binding:"required"`
	Root                      string              `binding:"min=1"`
	Groups                    []string            `binding:"min=1,max=5,dive,max=100"`
	Relation                  string              `binding:"min=1"`
	Phase                     string              `binding:"min=1"`
	Component                 string              `binding:"min=1"`
	Take                      string              `binding:"len=30"`
	ApprovalStatus            string              `binding:"min=1"`
	ApprovalStatusUpdatedUser string              `binding:"min=1"`
	WorkStatus                string              `binding:"min=1"`
	WorkStatusUpdatedUser     string              `binding:"min=1"`
	ReviewTarget              []*libs.Content     `binding:"required"`
	ReviewData                []*libs.Content     `binding:"required"`
	OutputContents            []*libs.Content     ``
	SubmittedAtUtc            time.Time           `binding:"required"`
	SubmittedComputer         string              `binding:"min=1,max=30"`
	SubmittedOS               string              `binding:"len=3"`
	SubmittedOSVersion        string              `binding:"min=1,max=1000"`
	SubmittedUser             string              `binding:"min=1,max=100"`
	ExecutedAtUtc             time.Time           `binding:"required"`
	ExecutedComputer          string              `binding:"min=1,max=30"`
	ExecutedOS                string              `binding:"len=3"`
	ExecutedOSVersion         string              `binding:"min=1,max=1000"`
	ExecutedUser              string              `binding:"min=1,max=100"`
	AllFiles                  []*libs.File        ``
	NumAllFiles               uint32              ``
	SizeAllFiles              uint64              ``
	TargetComponents          []string            ``

	Duration                    *int32
	DurationTimeline            *string
	ExportShotsVersions         *bool
	ExportShotsVersionsRevision *string
	ExportShotsVersionsPath     *string
}

type UpdateReviewInfoParams struct {
	ApprovalStatus            *string ``
	ApprovalStatusUpdatedUser *string `binding:"omitempty,min=1,max=100"`
	WorkStatus                *string ``
	WorkStatusUpdatedUser     *string `binding:"omitempty,min=1,max=100"`
	Project                   string  `binding:"min=1,max=30,alphanum,lowercase,startsnotwithdigit"`
	ID                        int32   `binding:"required"`
	ModifiedBy                *string `binding:"omitempty,min=1,max=100"`
}

type DeleteReviewInfoParams struct {
	Project    string  `binding:"min=1,max=30,alphanum,lowercase,startsnotwithdigit"`
	ID         int32   `binding:"required"`
	ModifiedBy *string `binding:"omitempty,min=1,max=100"`
}

type Asset struct {
	Name     string `json:"name"`
	Relation string `json:"relation"`
}

type AssetListParams struct {
	Project string  `binding:"min=1,max=30,alphanum,lowercase,startsnotwithdigit"`
	Studio  *string `binding:"omitempty,min=1,max=30,alphanum,lowercase,startsnotwithdigit"`
	*BaseListParams
}

type AssetReviewInfoListParams struct {
	Project  string  `binding:"min=1,max=30,alphanum,lowercase,startsnotwithdigit"`
	Studio   *string `binding:"omitempty,min=1,max=30,alphanum,lowercase,startsnotwithdigit"`
	Asset    string  `binding:"omitempty,min=1,alphanumunderscore,startsnotwithdigit"`
	Relation string  `binding:"min=1,max=100,startsnotwithdot"`
}

type ShotReviewInfoListParams struct {
	Project  string   `binding:"min=1,max=30,alphanum,lowercase,startsnotwithdigit"`
	Studio   *string  `binding:"omitempty,min=1,max=30,alphanum,lowercase,startsnotwithdigit"`
	Groups   []string `binding:"min=1,max=5,dive,max=100"`
	Relation string   `binding:"min=1,max=100,startsnotwithdot"`
}
