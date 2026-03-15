package repository

import (
	"context"

	"github.com/PolygonPictures/central30-web/front/entity"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type PublishOperationInfo struct {
	db *mongo.Database
}

func NewPublishOperationInfo(db *mongo.Database) *PublishOperationInfo {
	return &PublishOperationInfo{
		db: db,
	}
}

func (poi *PublishOperationInfo) ListLatestAssetDocuments(
	ctx context.Context,
	param *entity.LatestAssetComponentParams,
) (documents []*entity.LatestComponentDocuments, err error) {

	// Add debug log to check the input parameters
	col := poi.db.Collection("pc_publishOperationInfo")

	// Project, Asset, Relation, Componentでフィルタリング
	matchStage := bson.D{
		{"$match", bson.D{
			{"_central.project", param.Project},
			{"root", "assets"},
			{"groups.0", param.Asset},
			{"relation", param.Relation},
			{"component", bson.D{{"$in", param.Component}}},
		}},
	}

	// id, groups, submitted_at_utc, phase, component フィールドのみ取得
	projectStage := bson.D{
		{"$project", bson.D{
			{"id", 1},
			{"groups", 1},
			{"submitted_at_utc", 1},
			{"phase", 1},
			{"component", 1},
			{"_id", 0},
		}},
	}

	// submitted_at_utcで降順にソート
	sortStage := bson.D{
		{"$sort", bson.D{
			// -1 は降順を意味
			{"submitted_at_utc", -1},
		}},
	}

	// component ごとに最新のドキュメントを取得
	groupStage := bson.D{
		{"$group", bson.D{
			{"_id", "$component"},
			{"latest_document", bson.D{{"$first", "$$ROOT"}}},
		}},
	}

	pipeline := mongo.Pipeline{matchStage, projectStage, sortStage, groupStage}
	cursor, err := col.Aggregate(ctx, pipeline)
	if err != nil {
		return
	}
	defer cursor.Close(ctx)

	if err = cursor.All(ctx, &documents); err != nil {
		return
	}
	if documents == nil {
		documents = []*entity.LatestComponentDocuments{}
	}
	return
}

// ListShots retrieves a list of shot documents based on the provided parameters.
func (poi *PublishOperationInfo) ListShots(
	ctx context.Context,
	params *entity.ShotListParams,
) (documents []*entity.ShotDocument, total int64, err error) {

	col := poi.db.Collection("pc_publishOperationInfo")

	// Build the aggregation pipeline
	pipeline := mongo.Pipeline{}

	// Match stage with filters
	matchStage := bson.D{
		{"$match", bson.D{
			{"_central.project", params.Project},
			{"root", "shots"},
		}},
	}

	// Add search filter if provided
	if params.Search != nil && *params.Search != "" {
		search := *params.Search
		searchCondition := bson.D{
			{"$or", bson.A{
				bson.D{{"groups.0", bson.D{{"$regex", search}, {"$options", "i"}}}},
				bson.D{{"groups.1", bson.D{{"$regex", search}, {"$options", "i"}}}},
				bson.D{{"groups.2", bson.D{{"$regex", search}, {"$options", "i"}}}},
			}},
		}
		// Merge with existing match stage
		matchStage[0].Value = append(matchStage[0].Value.(bson.D), searchCondition...)
	}

	pipeline = append(pipeline, matchStage)

	// You might need to unwind phases if status is per phase
	// pipeline = append(pipeline, bson.D{{"$unwind", "$phases"}})

	// Add approval status filter
	if len(params.ApprovalStatus) > 0 {
		pipeline = append(pipeline, bson.D{
			{"$match", bson.D{
				{"approval_status", bson.D{{"$in", params.ApprovalStatus}}},
			}},
		})
	}

	// Add work status filter
	if len(params.WorkStatus) > 0 {
		pipeline = append(pipeline, bson.D{
			{"$match", bson.D{
				{"work_status", bson.D{{"$in", params.WorkStatus}}},
			}},
		})
	}

	// Group back if you unwound
	// pipeline = append(pipeline, bson.D{
	//     {"$group", bson.D{
	//         {"_id", "$_id"},
	//         {"groups", bson.D{{"$first", "$groups"}}},
	//         {"relation", bson.D{{"$first", "$relation"}}},
	//         // ... other fields
	//     }},
	// })

	// Group unique shots
	pipeline = append(pipeline, bson.D{
		{"$group", bson.D{
			{"_id", bson.D{
				{"groups", "$groups"},
				{"relation", "$relation"},
			}},
		}},
	})

	// Sort
	pipeline = append(pipeline, bson.D{
		{"$sort", bson.D{
			{"_id.groups", 1},
		}},
	})

	// Pagination with facet
	offset := (params.GetPage() - 1) * params.GetPerPage()
	pipeline = append(pipeline, bson.D{
		{"$facet", bson.D{
			{"total", bson.A{
				bson.D{{"$count", "totalCount"}},
			}},
			{"documents", bson.A{
				bson.D{{"$skip", offset}},
				bson.D{{"$limit", params.PerPage}},
				bson.D{{"$project", bson.D{
					{"_id", 0},
					{"groups", "$_id.groups"},
					{"relation", "$_id.relation"},
				}}},
			}},
		}},
	})

	cursor, err := col.Aggregate(ctx, pipeline)
	if err != nil {
		return
	}
	defer cursor.Close(ctx)

	var result struct {
		Total []struct {
			TotalCount int64 `bson:"totalCount"`
		} `bson:"total"`
		Documents []*entity.ShotDocument `bson:"documents"`
	}

	if cursor.Next(ctx) {
		if err = cursor.Decode(&result); err != nil {
			return
		}
	}

	if len(result.Total) > 0 {
		total = result.Total[0].TotalCount
	}

	documents = result.Documents
	return
}

// 以下はHTTPハンドラー用のコード
func (poi *PublishOperationInfo) ListLatestShotDocuments(
	ctx context.Context,
	param *entity.LatestShotComponentParams,
) (documents []*entity.LatestComponentDocuments, err error) {
	col := poi.db.Collection("pc_publishOperationInfo")

	// Project, Asset, Relation, Componentでフィルタリング
	matchStage := bson.D{
		{"$match", bson.D{
			{"_central.project", param.Project},
			{"root", "shots"},
			{"groups.0", param.Group1},
			{"groups.1", param.Group2},
			{"groups.2", param.Group3},
			{"relation", param.Relation},
			{"component", bson.D{{"$in", param.Component}}},
		}},
	}

	// id, groups, submitted_at_utc, phase, component フィールドのみ取得
	projectStage := bson.D{
		{"$project", bson.D{
			{"id", 1},
			{"groups", 1},
			{"submitted_at_utc", 1},
			{"phase", 1},
			{"component", 1},
			{"_id", 0},
		}},
	}

	// submitted_at_utcで降順にソート
	sortStage := bson.D{
		{"$sort", bson.D{
			// -1 は降順を意味
			{"submitted_at_utc", -1},
		}},
	}

	// component ごとに最新のドキュメントを取得
	groupStage := bson.D{
		{"$group", bson.D{
			{"_id", "$component"},
			{"latest_document", bson.D{{"$first", "$$ROOT"}}},
		}},
	}

	pipeline := mongo.Pipeline{matchStage, projectStage, sortStage, groupStage}
	cursor, err := col.Aggregate(ctx, pipeline)
	if err != nil {
		return
	}
	defer cursor.Close(ctx)

	if err = cursor.All(ctx, &documents); err != nil {
		return
	}
	if documents == nil {
		documents = []*entity.LatestComponentDocuments{}
	}
	return
}
