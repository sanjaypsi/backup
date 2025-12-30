package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"cloud.google.com/go/bigquery"
	"cloud.google.com/go/logging/logadmin"
	"github.com/PolygonPictures/central30-web/front/database"
	"github.com/PolygonPictures/central30-web/front/entity"
	"github.com/PolygonPictures/central30-web/front/license"
	"github.com/PolygonPictures/central30-web/front/project"

	"github.com/PolygonPictures/central30-web/front/delivery"
	"github.com/PolygonPictures/central30-web/front/publishlog"
	"github.com/PolygonPictures/central30-web/front/repository"
	"github.com/PolygonPictures/central30-web/front/service"
	"github.com/PolygonPictures/central30-web/front/setting"
	"github.com/PolygonPictures/central30-web/front/setting/domain"
	httpHandler "github.com/PolygonPictures/central30-web/front/setting/handler/http"
	legacyRepository "github.com/PolygonPictures/central30-web/front/setting/repository/legacy"
	settingRepository "github.com/PolygonPictures/central30-web/front/setting/repository/mysql"
	settingUsecase "github.com/PolygonPictures/central30-web/front/setting/usecase"
	"github.com/PolygonPictures/central30-web/front/usecase"
	"github.com/PolygonPictures/central30-web/front/web"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	_ "github.com/go-sql-driver/mysql"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

const (
	defaultProjectID = "ppi-gcp-pj001"
	datasetLocation  = "asia-northeast1"
	connectTimeout   = 60 * time.Second
	readTimeout      = 60 * time.Second
	writeTimeout     = 60 * time.Second
)

// Neo4jConfig holds the configuration details required to connect to a Neo4j database.
type Neo4jConfig struct {
	// URI is the connection string for the Neo4j database.
	URI string
	// Username is the username used for authentication.
	Username string
	// Password is the password used for authentication.
	Password string
}

// getDataset returns a dataset that matches the datasetID.
// If not found, a new dataset with that ID will be created.
func getDataset(client *bigquery.Client, datasetID string) (*bigquery.Dataset, error) {
	datasetRef := client.Dataset(datasetID)
	ctx, cancel := context.WithTimeout(context.Background(), connectTimeout)
	defer cancel()
	_, err := datasetRef.Metadata(ctx) // Check if the dataset exists
	if err != nil {
		if err := datasetRef.Create(ctx, &bigquery.DatasetMetadata{
			Location: datasetLocation,
		}); err != nil {
			return nil, err
		}
		metadata, err := datasetRef.Metadata(ctx)
		if err != nil {
			return nil, err
		}
		log.Printf("INFO: Dataset %q created.", metadata.FullID)
	}
	return datasetRef, nil
}

func getGCPProjectID() string {
	projectID := os.Getenv("PPI_PROJECT_ID")
	if projectID == "" {
		projectID = defaultProjectID
	}
	return projectID
}

func bqConfigs() (string, string) {
	publishLogDatasetID := os.Getenv("PPI_PUBLISH_LOG_DATASET_ID")
	return getGCPProjectID(), publishLogDatasetID
}

func mySQLConfigs() (string, string, string, string, string) {
	dbUser := os.Getenv("PPI_MYSQL_USER")
	dbPass := os.Getenv("PPI_MYSQL_PASSWORD")
	dbHost := os.Getenv("PPI_MYSQL_HOST")
	dbPort := os.Getenv("PPI_MYSQL_PORT")
	dbName := "central30"
	return dbUser, dbPass, dbHost, dbPort, dbName
}

func mongoConfigs() (string, string, string, string, string) {
	dbUser := os.Getenv("PPI_MONGODB_USER")
	dbPass := os.Getenv("PPI_MONGODB_PASSWORD")
	dbHost := os.Getenv("PPI_MONGODB_HOST")
	dbPort := os.Getenv("PPI_MONGODB_PORT")
	dbName := "central30"
	return dbUser, dbPass, dbHost, dbPort, dbName
}

// NewNeo4jConfig creates a new Neo4jConfig instance by reading the necessary configuration values
// from environment variables.
//
// Required environment variables:
//   - NEO4J_URI: the URI of the Neo4j database
//   - NEO4J_USER: the username for the Neo4j database
//   - NEO4J_PASSWORD: the password for the Neo4j database
func NewNeo4jConfig() *Neo4jConfig {
	var config Neo4jConfig
	uri := os.Getenv("NEO4J_URI")
	if uri == "" {
		return nil
	}
	config.URI = uri
	username := os.Getenv("NEO4J_USER")
	if username == "" {
		return nil
	}
	config.Username = username
	password := os.Getenv("NEO4J_PASSWORD")
	if password == "" {
		return nil
	}
	config.Password = password
	return &config
}

func openMySQLByDSN(dsn string) (*sql.DB, error) {
	val := url.Values{}
	val.Add("charset", "utf8mb4")
	val.Add("parseTime", "1")
	return sql.Open("mysql", fmt.Sprintf("%s?%s", dsn, val.Encode()))
}

func openMySQL(dbUser, dbPass, dbHost, dbPort, dbName string) (*sql.DB, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s", dbUser, dbPass, dbHost, dbPort, dbName)
	return openMySQLByDSN(dsn)
}

func openMongo(dbUser, dbPass, dbHost, dbPort, dbName string) (*mongo.Database, error) {
	val := url.Values{}
	val.Add("connect", "direct")
	if dbUser != "" {
		val.Add("authSource", dbName)
	}

	var conn string
	if dbUser != "" && dbPass != "" {
		conn += fmt.Sprintf("%s:%s@", dbUser, dbPass)
	}
	conn += fmt.Sprintf("%s:%s", dbHost, dbPort)

	url := fmt.Sprintf("mongodb://%s/?%s", conn, val.Encode())
	client, err := mongo.NewClient(options.Client().ApplyURI(url))
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), connectTimeout)
	defer cancel()
	err = client.Connect(ctx)
	if err != nil {
		return nil, err
	}

	return client.Database(dbName), nil
}

func openBigQuery(projectID string) (*bigquery.Client, error) {
	ctx := context.Background()
	return bigquery.NewClient(ctx, projectID)
}

func openCloudLogging(projectID string) (*logadmin.Client, error) {
	ctx := context.Background()
	return logadmin.NewClient(ctx, projectID)
}

func methodNotAllowedHandler(c *gin.Context) {
	c.AbortWithStatus(http.StatusMethodNotAllowed)
}

// newNeo4jDriverWithContext initializes and returns a new Neo4j driver with a context. If it can
// get the Neo4j configuration, it will try to establish a connection to the Neo4j database,
// otherwise it will return nil. However, if it fails to connect to the database, it will log
// an error and exit the program.
func newNeo4jDriverWithContext(ctx context.Context) *neo4j.DriverWithContext {
	neo4jConfig := NewNeo4jConfig()
	if neo4jConfig == nil {
		log.Println(
			"No environment variables were provided to authenticate with Neo4j. " +
				"Skip registering DataDependency API.",
		)
		return nil
	}

	authToken := neo4j.BasicAuth(neo4jConfig.Username, neo4jConfig.Password, "")
	neo4jDriver, err := neo4j.NewDriverWithContext(neo4jConfig.URI, authToken)
	if err != nil {
		log.Fatalf("Failed to create Neo4j driver: %v", err)
	}
	err = neo4jDriver.VerifyConnectivity(ctx)
	if err != nil {
		log.Fatalf("Neo4j verification failed: %v", err)
	}

	log.Println("Neo4j connection established.")
	return &neo4jDriver
}

// registerDataDepHandlers registers all the HTTP route handlers related to data dependency
// management.
func registerDataDepHandlers(router *gin.RouterGroup, dataDepUsecase *usecase.DataDepUsecase) {
	dataDepHandler := delivery.NewDataDepHandler(dataDepUsecase)

	router.GET("/projects/:project/roots", dataDepHandler.ListRoots)
	router.GET("/projects/:project/roots/:root", dataDepHandler.GetRoot)
	router.GET("/projects/:project/roots/:root/groups", dataDepHandler.ListGroups)
	router.GET("/projects/:project/roots/:root/groups/:group", dataDepHandler.GetGroup)
	router.GET(
		"/projects/:project/roots/:root/groups/:group/relations",
		dataDepHandler.ListRelations,
	)
	router.GET(
		"/projects/:project/roots/:root/groups/:group/relations/:relation",
		dataDepHandler.GetRelation,
	)
	router.GET(
		"/projects/:project/roots/:root/groups/:group/relations/:relation/phases",
		dataDepHandler.ListPhaseDirectories,
	)
	router.GET(
		"/projects/:project/roots/:root/groups/:group/relations/:relation/phases/:phase",
		dataDepHandler.GetPhaseDirectory,
	)
	router.GET(
		"/projects/:project/roots/:root/groups/:group/relations/:relation/phases/:phase"+
			"/components",
		dataDepHandler.ListComponentDirectories,
	)
	router.GET(
		"/projects/:project/roots/:root/groups/:group/relations/:relation/phases/:phase"+
			"/components/:component",
		dataDepHandler.GetComponentDirectory,
	)
	router.GET(
		"/projects/:project/roots/:root/groups/:group/relations/:relation/phases/:phase"+
			"/components/:component/revisions",
		dataDepHandler.ListRevisions,
	)
	router.GET(
		"/projects/:project/roots/:root/groups/:group/relations/:relation/phases/:phase"+
			"/components/:component/revisions/:revision",
		dataDepHandler.GetRevision,
	)
	router.GET(
		"/projects/:project/roots/:root/groups/:group/relations/:relation/phases/:phase"+
			"/components/:component/revisions/:revision/contents",
		dataDepHandler.ListContents,
	)
	router.GET(
		"/projects/:project/roots/:root/groups/:group/relations/:relation/phases/:phase"+
			"/components/:component/revisions/:revision/contents/:content",
		dataDepHandler.GetContent,
	)
	router.GET(
		"/projects/:project/roots/:root/groups/:group/relations/:relation/phases/:phase"+
			"/components/:component/revisions/:revision/contents/:content/files",
		dataDepHandler.ListContentFiles,
	)
	router.GET(
		"/projects/:project/roots/:root/groups/:group/relations/:relation/phases/:phase"+
			"/components/:component/revisions/:revision/contents/:content/dependencies",
		dataDepHandler.ListContentDependencies,
	)
	router.GET(
		"/projects/:project/roots/:root/groups/:group/relations/:relation/phases/:phase"+
			"/components/:component/revisions/:revision/contents/:content/dependents",
		dataDepHandler.ListContentDependents,
	)
	router.PUT(
		"/projects/:project/roots/:root/groups/:group/relations/:relation/phases/:phase"+
			"/components/:component/revisions/:revision/contents/:content",
		dataDepHandler.AddDependencies,
	)
}

// -------------------------------------------------------
// DEFAULTS & ALLOWED VALUES
// -------------------------------------------------------

var defaultRoot = "assets"
var defaultPerPage = 15

var allowedPhases = map[string]struct{}{
	"mdl":  {},
	"rig":  {},
	"bld":  {},
	"dsn":  {},
	"ldv":  {},
	"none": {},
}

// -------------------------------------------------------
// INT PARSING HELPERS
// -------------------------------------------------------

func mustAtoi(s string) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return n
}

func clampPerPage(n int) int {
	if n <= 0 {
		return defaultPerPage
	}
	if n > 200 {
		return 200
	}
	return n
}

// -------------------------------------------------------
// SORT NORMALIZATION
// -------------------------------------------------------

func normalizeDir(dir string) string {
	switch strings.ToUpper(strings.TrimSpace(dir)) {
	case "DESC":
		return "DESC"
	default:
		return "ASC"
	}
}

// Maps frontend sort keys → backend order keys
func normalizeSortKey(key string) string {
	key = strings.TrimSpace(strings.ToLower(key))

	switch key {
	case "group_1", "group1", "name":
		return "group1_only"

	case "relation":
		return "relation_only"

	case "group_rel":
		return "group_rel_submitted"

	case "submitted", "submitted_at", "submitted_at_utc":
		return "submitted_at_utc"

	case "mdl_work":
		return "mdl_work"
	case "rig_work":
		return "rig_work"
	case "bld_work":
		return "bld_work"
	case "dsn_work":
		return "dsn_work"
	case "ldv_work":
		return "ldv_work"

	case "mdl_appr":
		return "mdl_appr"
	case "rig_appr":
		return "rig_appr"
	case "bld_appr":
		return "bld_appr"
	case "dsn_appr":
		return "dsn_appr"
	case "ldv_appr":
		return "ldv_appr"

	case "mdl_submitted":
		return "mdl_submitted"
	case "rig_submitted":
		return "rig_submitted"
	case "bld_submitted":
		return "bld_submitted"
	case "dsn_submitted":
		return "dsn_submitted"
	case "ldv_submitted":
		return "ldv_submitted"

	default:
		return "group1_only"
	}
}

// -------------------------------------------------------
// FILTER PARSING
// -------------------------------------------------------

func parseStatusParam(c *gin.Context, key string) []string {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return nil
	}

	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))

	for _, p := range parts {
		p = strings.ToLower(strings.TrimSpace(p))
		if p != "" {
			out = append(out, p)
		}
	}

	if len(out) == 0 {
		return nil
	}

	return out
}

// -------------------------------------------------------
// PAGINATION LINK HEADER (RFC 5988)
// -------------------------------------------------------

func paginationLinks(baseURL string, page, perPage, total int) string {
	if total <= 0 {
		return ""
	}

	lastPage := int(math.Ceil(float64(total) / float64(perPage)))
	if lastPage < 1 {
		lastPage = 1
	}

	var links []string

	if page > 1 {
		links = append(links,
			fmt.Sprintf(`<%s?page=1&per_page=%d>; rel="first"`, baseURL, perPage),
			fmt.Sprintf(`<%s?page=%d&per_page=%d>; rel="prev"`, baseURL, page-1, perPage),
		)
	}

	if page < lastPage {
		links = append(links,
			fmt.Sprintf(`<%s?page=%d&per_page=%d>; rel="next"`, baseURL, page+1, perPage),
			fmt.Sprintf(`<%s?page=%d&per_page=%d>; rel="last"`, baseURL, lastPage, perPage),
		)
	}

	return strings.Join(links, ", ")
}

func main() {
	ctx := context.Background()

	projectID, publishLogDatasetID := bqConfigs()
	client, err := openBigQuery(projectID)
	if err != nil {
		log.Fatal(err)
	}

	cloudLoggingClient, err := openCloudLogging(getGCPProjectID())
	if err != nil {
		log.Fatal(err)
	}
	defer cloudLoggingClient.Close()

	dbUser, dbPass, dbHost, dbPort, dbName := mySQLConfigs()
	myDB, err := openMySQL(dbUser, dbPass, dbHost, dbPort, dbName)
	if err != nil {
		log.Fatal(err)
	}

	gormDB, err := gorm.Open(
		mysql.Open(
			fmt.Sprintf(
				"%s:%s@(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
				dbUser,
				dbPass,
				dbHost,
				dbPort,
				dbName,
			),
		),
		&gorm.Config{
			SkipDefaultTransaction: true,
			NamingStrategy: schema.NamingStrategy{
				TablePrefix:   "t_",
				SingularTable: true,
			},
			DisableForeignKeyConstraintWhenMigrating: true,
		},
	)
	if err != nil {
		log.Fatal(err)
	}

	dbUser, dbPass, dbHost, dbPort, dbName = mongoConfigs()
	mongoDB, err := openMongo(dbUser, dbPass, dbHost, dbPort, dbName)
	if err != nil {
		log.Fatal(err)
	}

	binding.Validator = new(defaultValidator)
	router := gin.New()
	router.UseRawPath = true

	// Recovery middleware recovers from any panics and writes a 500 if there was one.
	router.Use(gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		if err, ok := recovered.(string); ok {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"message": err})
			return
		}
		c.AbortWithStatus(http.StatusInternalServerError)
	}))

	router.Use(gin.Logger())

	// https://github.com/gin-gonic/gin/issues/1044
	localFile := static.LocalFile("../client/build", false)
	router.Use(static.Serve("/", localFile))
	router.Use(static.Serve("/admin", localFile))
	router.Use(static.Serve("/admin/pipeline-setting", localFile))
	router.Use(static.Serve("/admin/new-pipeline-setting", localFile))
	router.Use(static.Serve("/admin/new-pipeline-setting/property", localFile))
	router.Use(static.Serve("/admin/new-pipeline-setting/value", localFile))
	router.Use(static.Serve("/admin/pipeline-parameter", localFile))
	router.Use(static.Serve("/admin/pipeline-parameter/parameter", localFile))
	router.Use(static.Serve("/admin/pipeline-parameter/location", localFile))
	router.Use(static.Serve("/admin/pipeline-parameter/value", localFile))
	router.Use(static.Serve("/project", localFile))
	router.Use(static.Serve("/project/datasync", localFile))
	router.Use(static.Serve("/project/datasyncclient", localFile))
	router.Use(static.Serve("/project/reviews", localFile))
	router.Use(static.Serve("/project/settings", localFile))
	router.Use(static.Serve("/project/revisions", localFile))
	router.Use(static.Serve("/project/settings/directory", localFile))
	router.Use(static.Serve("/project/settings/group-category", localFile))
	router.Use(static.Serve("/project/settings/publish-notification", localFile))
	router.Use(static.Serve("/login", localFile))

	// https://jira.ppi.co.jp/browse/POTOO-1402
	healthCheck := func(c *gin.Context) {
		if err := myDB.Ping(); err != nil {
			c.Status(http.StatusInternalServerError)
			log.Printf("ERROR: Could not connect to MySQL database %s. %s", dbName, err.Error())
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), connectTimeout)
		defer cancel()
		if err := mongoDB.Client().Ping(ctx, readpref.Primary()); err != nil {
			c.Status(http.StatusInternalServerError)
			log.Printf("ERROR: Could not connect to MongoDB database %s. %s", dbName, err.Error())
			return
		}

		c.String(http.StatusOK, "ok")
	}
	router.GET("/health", healthCheck)
	router.GET("/ready", healthCheck)

	apiRouter := router.Group("/api")
	{
		myRepo := database.NewMySQLRepository(myDB)
		mongoRepo := database.NewMongoRepository(mongoDB)
		cs := service.NewCentralService(myRepo, mongoRepo)
		neo4jDriver := newNeo4jDriverWithContext(ctx)
		if neo4jDriver != nil {
			defer (*neo4jDriver).Close(ctx)
		}

		// MARK: Repositories

		projectStudioMapRepository, err := repository.NewProjectStudioMap(gormDB)
		if err != nil {
			log.Fatalln(err)
		}
		projectInfoRepository, err := repository.NewProjectInfo(
			gormDB,
			projectStudioMapRepository,
		)
		if err != nil {
			log.Fatalln(err)
		}
		var dataDepRepo *repository.DataDepRepository
		if neo4jDriver != nil {
			dataDepRepo = repository.NewDataDepRepository(*neo4jDriver, gormDB)
		}

		// MARK: Usecases (Services)

		dataDepUsecase := usecase.NewDataDepUsecase(
			dataDepRepo, projectInfoRepository, readTimeout, writeTimeout,
		)

		// MARK: HTTP Deliveries (Handlers)

		handler := web.NewHandler(cs, dataDepRepo)

		// Studio Repository

		studioInfoRepository, err := repository.NewStudioInfo(gormDB)
		if err != nil {
			log.Fatalln(err)
		}

		// PipelineSetting Repository

		pipelineSettingRepository, err := repository.NewPipelineSetting(gormDB)
		if err != nil {
			log.Fatal(err)
		}

		// PipelineParameterRepository

		pipelineParameterRepository, err := repository.NewPipelineParameter(gormDB)
		if err != nil {
			log.Fatal(err)
		}

		handler.SetRepositoryParams(pipelineParameterRepository, readTimeout, writeTimeout)

		// Authentication API

		authRepository, err :=
			repository.NewAuth(gormDB, projectStudioMapRepository, studioInfoRepository)
		if err != nil {
			log.Fatalln(err)
		}
		authUsecase := usecase.NewAuth(authRepository, readTimeout, writeTimeout)
		authDelivery := delivery.NewAuth(authUsecase)
		router.Use(authDelivery.ParseQueryToken)
		apiRouter.Use(authDelivery.ParseHeaderToken)
		apiRouter.Use(authDelivery.CheckAccessPermission)
		apiRouter.Use(authDelivery.CreateNewToken)
		apiRouter.GET("/auth/parser")
		apiRouter.POST("/auth/login", authDelivery.Login)

		// Notification Middleware

		notificationRepository, err := repository.NewNotification(gormDB, pipelineSettingRepository)
		if err != nil {
			log.Fatalln(err)
		}
		notificationUsecase := usecase.NewNotification(
			notificationRepository,
			readTimeout,
			writeTimeout,
		)
		notificationDelivery := delivery.NewNotification(notificationUsecase)
		apiRouter.Use(notificationDelivery.SendNotification)

		// License API

		apiRouter.POST("/licenses", license.PostLicense)

		// Project API

		projectInfoUsecase := usecase.NewProjectInfo(
			projectInfoRepository,
			readTimeout,
			writeTimeout,
		)
		projectInfoDelivery := delivery.NewProjectInfo(projectInfoUsecase)
		apiRouter.GET("/projects", projectInfoDelivery.List)
		apiRouter.GET("/projects/:project", projectInfoDelivery.Get)
		apiRouter.POST("/projects", projectInfoDelivery.Post)
		apiRouter.DELETE("/projects/:project", projectInfoDelivery.Delete)

		// Studio API

		studioInfoUsecase := usecase.NewStudioInfo(
			studioInfoRepository,
			projectInfoRepository,
			readTimeout,
			writeTimeout,
		)
		studioInfoDelivery := delivery.NewStudioInfo(studioInfoUsecase)
		apiRouter.GET("/studios", studioInfoDelivery.List)
		apiRouter.GET("/studios/:studio", studioInfoDelivery.Get)
		apiRouter.POST("/studios", studioInfoDelivery.Post)
		apiRouter.PATCH("/studios/:studio", studioInfoDelivery.Patch)
		apiRouter.DELETE("/studios/:studio", studioInfoDelivery.Delete)

		// DataSyncClient API
		dataSyncClientRepository := repository.NewDataSyncClient(
			repository.ConnectedCloudLoggingFinder{Client: cloudLoggingClient},
			getGCPProjectID(),
		)
		dataSyncClientUseCase := usecase.NewDataSyncClient(dataSyncClientRepository, readTimeout)
		dataSyncClientDelivery := delivery.NewDataSyncClient(dataSyncClientUseCase)
		apiRouter.GET("/projects/:project/studios/:studio/dataSyncClient/status", dataSyncClientDelivery.GetStatus)

		// Dierctory API

		groupDirectoryRepository, err := repository.NewGroupDirectory(gormDB)
		if err != nil {
			log.Fatalln(err)
		}
		directoryRepository, err := repository.NewDirectory(gormDB, groupDirectoryRepository)
		if err != nil {
			log.Fatalln(err)
		}
		directoryDeletionInfoRepository, err := repository.NewDirectoryDeletionInfo(gormDB)
		if err != nil {
			log.Fatalln(err)
		}
		directoryReadTimeout := 60 * 5 * time.Second
		directoryUsecase := usecase.NewDirectory(
			directoryRepository,
			projectInfoRepository,
			studioInfoRepository,
			directoryDeletionInfoRepository,
			pipelineSettingRepository,
			directoryReadTimeout,
			writeTimeout,
		)
		directoryDelivery := delivery.NewDirectory(directoryUsecase)
		apiRouter.GET("/projects/:project/directories", directoryDelivery.List)
		apiRouter.GET("/projects/:project/directories/*path", func(c *gin.Context) {
			if c.Param("path") == "/" {
				directoryDelivery.List(c)
			} else {
				directoryDelivery.Get(c)
			}
		})
		apiRouter.POST("/projects/:project/directories", directoryDelivery.Post)
		apiRouter.POST("/projects/:project/directories/upload", directoryDelivery.PostValidate)
		apiRouter.DELETE("/projects/:project/directories/*path", directoryDelivery.Delete)
		studioDirectoryDelivery := delivery.NewStudioDirectory(directoryUsecase)
		apiRouter.DELETE(
			"/projects/:project/studios/:studio/directories/*path",
			studioDirectoryDelivery.Delete,
		)

		// Review API

		reviewInfoRepository, err := repository.NewReviewInfo(gormDB)
		if err != nil {
			log.Fatalln(err)
		}
		reviewInfoUsecase := usecase.NewReviewInfo(
			reviewInfoRepository,
			projectInfoRepository,
			studioInfoRepository,
			mongoRepo,
			readTimeout,
			writeTimeout,
		)
		reviewInfoDelivery := delivery.NewReviewInfo(
			reviewInfoUsecase,
		)
		apiRouter.GET("/projects/:project/reviews", reviewInfoDelivery.List)
		apiRouter.GET("/projects/:project/reviews/:id", reviewInfoDelivery.Get)
		apiRouter.POST("/projects/:project/reviews", reviewInfoDelivery.Post)
		apiRouter.PATCH("/projects/:project/reviews/:id", reviewInfoDelivery.Update)
		apiRouter.DELETE("/projects/:project/reviews/:id", reviewInfoDelivery.Delete)
		apiRouter.GET("/projects/:project/reviews/assets", reviewInfoDelivery.ListAssets)
		apiRouter.GET(
			"/projects/:project/assets/:asset/relations/:relation/reviewInfos",
			reviewInfoDelivery.ListAssetReviewInfos,
		)
		// Assets Pivot API - returns latest review info per asset
		// apiRouter.GET("/projects/:project/reviews/assets/pivot", reviewInfoDelivery.ListAssetsPivot) // Add by PSI

		// Shots ReviewInfo API
		apiRouter.GET("/projects/:project/shots/reviewInfos", reviewInfoDelivery.ListShotReviewInfos)

		/* ========================================================
		   Assets Pivot API (Expanded Implementation)
			router.GET("/api/projects/:project/reviews/assets/pivot", func(c *gin.Context) {

		======================================================= */
		apiRouter.GET("/projects/:project/reviews/assets/pivot", func(c *gin.Context) {
			// router.GET("/api/projects/:project/reviews/assets/pivot", func(c *gin.Context) {

			project := strings.TrimSpace(c.Param("project"))
			if project == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "project is required in the path"})
				return
			}

			root := c.DefaultQuery("root", defaultRoot)

			// ---- Phase Validation ----
			phaseParam := strings.TrimSpace(c.Query("phase"))
			if phaseParam != "" {
				lp := strings.ToLower(phaseParam)
				if lp != "none" {
					if _, ok := allowedPhases[lp]; !ok {
						c.JSON(http.StatusBadRequest, gin.H{
							"error":          "invalid phase",
							"allowed_phases": []string{"mdl", "rig", "bld", "dsn", "ldv", "none"},
						})
						return
					}
				}
			}

			// ---- Pagination ----
			page := mustAtoi(c.DefaultQuery("page", "1"))
			page = int(math.Max(float64(page), 1))
			perPage := clampPerPage(mustAtoi(c.DefaultQuery("per_page", fmt.Sprint(defaultPerPage))))
			limit := perPage
			offset := (page - 1) * perPage

			// ---- Sorting ----
			sortParam := c.DefaultQuery("sort", "group_1")
			dirParam := c.DefaultQuery("dir", "ASC")
			orderKey := normalizeSortKey(sortParam)
			dir := normalizeDir(dirParam)

			// ---- View Mode ----
			viewParam := strings.ToLower(strings.TrimSpace(c.DefaultQuery("view", "list")))
			isGroupedView := viewParam == "group" || viewParam == "grouped" || viewParam == "category"

			// ---- Filters ----
			assetNameKey := strings.TrimSpace(c.Query("name"))
			approvalStatuses := parseStatusParam(c, "approval_status")
			workStatuses := parseStatusParam(c, "work_status")

			// ---- Preferred Phase Logic ----
			preferredPhase := phaseParam
			if orderKey == "group1_only" || orderKey == "relation_only" || orderKey == "group_rel_submitted" {
				preferredPhase = "none"
			}
			if preferredPhase == "" {
				preferredPhase = "none"
			}

			ctx, cancel := context.WithTimeout(c.Request.Context(), 7*time.Second)
			defer cancel()

			// ---------------------------------------------------------------
			// CASE 1: LIST VIEW - keep current DB pagination behavior
			// ---------------------------------------------------------------
			if !isGroupedView {
				assets, total, err := reviewInfoRepository.ListAssetsPivot(
					ctx,
					project, root,
					preferredPhase,
					orderKey,
					dir,
					limit, offset,
					assetNameKey,
					approvalStatuses,
					workStatuses,
				)
				if err != nil {
					log.Printf("[pivot-submissions] query error for project %q: %v", project, err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
					return
				}

				c.Header("Cache-Control", "public, max-age=15")
				baseURL := fmt.Sprintf("/api/projects/%s/reviews/assets/pivot", project)
				if links := paginationLinks(baseURL, page, perPage, int(total)); links != "" {
					c.Header("Link", links)
				}

				resp := gin.H{
					"assets":    assets,
					"total":     total,
					"page":      page,
					"per_page":  perPage,
					"sort":      sortParam,
					"dir":       strings.ToLower(dir),
					"project":   project,
					"root":      root,
					"has_next":  offset+limit < int(total),
					"has_prev":  page > 1,
					"page_last": (int(total) + perPage - 1) / perPage,
					"view":      viewParam,
				}
				if phaseParam != "" {
					resp["phase"] = phaseParam
				}
				if assetNameKey != "" {
					resp["name"] = assetNameKey
				}
				if len(approvalStatuses) > 0 {
					resp["approval_status"] = approvalStatuses
				}
				if len(workStatuses) > 0 {
					resp["work_status"] = workStatuses
				}

				c.IndentedJSON(http.StatusOK, resp)
				return
			}

			// ---------------------------------------------------------------
			// CASE 2: GROUPED VIEW - group first, then paginate
			// ---------------------------------------------------------------

			// 1) Fetch ALL matching assets (no pagination here).
			//    We still let the repo compute "total" for us.
			//    Use a very large limit and offset=0,
			//    or create a dedicated "ListAllAssetsPivot" if you prefer.
			allLimit := 1000000
			assetsAll, total, err := reviewInfoRepository.ListAssetsPivot(
				ctx,
				project, root,
				preferredPhase,
				"group1_only", // base: stable order by name
				"ASC",
				allLimit, 0,
				assetNameKey,
				approvalStatuses,
				workStatuses,
			)
			if err != nil {
				log.Printf("[pivot-submissions] query error (group view) for project %q: %v", project, err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
				return
			}

			// 2) Group ALL assets by top_group_node
			dirUpper := strings.ToUpper(dir)
			if dirUpper != "ASC" && dirUpper != "DESC" {
				dirUpper = "ASC"
			}
			groupedAll := repository.GroupAndSortByTopNode(
				assetsAll,
				repository.SortDirection(dirUpper),
			)

			// 3) Flatten groups in that order → flat slice in group order
			flat := make([]repository.AssetPivot, 0, len(assetsAll))
			for _, g := range groupedAll {
				flat = append(flat, g.Items...)
			}

			// 4) Apply pagination on the flat, grouped-ordered slice
			totalAssets := len(flat)
			start := offset
			if start > totalAssets {
				start = totalAssets
			}
			end := start + limit
			if end > totalAssets {
				end = totalAssets
			}
			pageSlice := flat[start:end]

			// 5) Re-group only the current page slice
			pageGroups := repository.GroupAndSortByTopNode(
				pageSlice,
				repository.SortDirection(dirUpper),
			)

			// ---- Headers ----
			c.Header("Cache-Control", "public, max-age=15")
			baseURL := fmt.Sprintf("/api/projects/%s/reviews/assets/pivot", project)
			if links := paginationLinks(baseURL, page, perPage, int(total)); links != "" {
				c.Header("Link", links)
			}

			// ---- Response ----
			resp := gin.H{
				"assets":    pageSlice, // optional: keep flat slice for debugging / UI
				"groups":    pageGroups,
				"total":     total, // total number of matching assets
				"page":      page,
				"per_page":  perPage,
				"sort":      sortParam,
				"dir":       strings.ToLower(dir),
				"project":   project,
				"root":      root,
				"has_next":  offset+limit < int(totalAssets),
				"has_prev":  page > 1,
				"page_last": (int(totalAssets) + perPage - 1) / perPage,
				"view":      viewParam,
			}

			if phaseParam != "" {
				resp["phase"] = phaseParam
			}
			if assetNameKey != "" {
				resp["name"] = assetNameKey
			}
			if len(approvalStatuses) > 0 {
				resp["approval_status"] = approvalStatuses
			}
			if len(workStatuses) > 0 {
				resp["work_status"] = workStatuses
			}

			c.IndentedJSON(http.StatusOK, resp)
		})

		/* ========================================================
		   Additional APIs
		======================================================= */

		// Review Status Log API
		reviewStatusLogRepository, err := repository.NewReviewStatusLog(gormDB)
		if err != nil {
			log.Fatalln(err)
		}
		reviewStatusLogUsecase := usecase.NewReviewStatusLog(
			reviewStatusLogRepository,
			projectInfoRepository,
			studioInfoRepository,
			readTimeout,
			writeTimeout,
		)
		pipelineSettingUsecase := usecase.NewPipelineSetting(
			pipelineSettingRepository,
			projectInfoRepository,
			studioInfoRepository,
			readTimeout,
			writeTimeout,
		)
		reviewStatusLogDelivery := delivery.NewReviewStatusLog(
			reviewStatusLogUsecase,
			reviewInfoUsecase,
			pipelineSettingUsecase,
		)

		apiRouter.GET("/projects/:project/reviewStatusLogs", reviewStatusLogDelivery.List)
		apiRouter.GET("/projects/:project/reviewStatusLogs/:id", reviewStatusLogDelivery.Get)
		apiRouter.POST("/projects/:project/reviewStatusLogs", reviewStatusLogDelivery.Post)
		apiRouter.POST("/projects/:project/reviewStatusLogs2", reviewStatusLogDelivery.Post2)

		// Review Thumbnail API

		reviewThumbnailRepository := repository.NewReviewThumbnail(cs)
		reviewThumbnailUsecase := usecase.NewReviewThumbnail(reviewThumbnailRepository)
		reviewThumbnailDelivery := delivery.NewReviewThumbnail(reviewThumbnailUsecase)
		apiRouter.GET(
			"/projects/:project/assets/:asset/relations/:relation/reviewthumbnail",
			reviewThumbnailDelivery.GetAssetThumbnail,
		)
		apiRouter.GET(
			"/projects/:project/shots/reviewthumbnail",
			reviewThumbnailDelivery.GetShotThumbnail,
		)

		// Collection API
		// - Comment API
		// - PublishOperationInfo (PublishInfo) API
		attachmentRepository := repository.NewCommentAttachment(cs)
		attachmentUsecase := usecase.NewCommentAttachment(
			attachmentRepository,
			readTimeout,
			writeTimeout,
		)
		attachmentDelivery := delivery.NewCommentAttachment(attachmentUsecase)

		apiRouter.GET("/projects/:project/collections/:collection/documents", handler.GetDocuments)
		apiRouter.GET("/projects/:project/collections/:collection/documents/:id", handler.GetDocument)
		apiRouter.GET(
			"/projects/:project/collections/:collection/documents/:id/attachments/:attachment_id",
			func(c *gin.Context) {
				if c.Param("collection") == "comment" {
					attachmentDelivery.Get(c)
				} else {
					c.AbortWithStatus(http.StatusNotFound)
				}
			},
		)
		apiRouter.POST("/projects/:project/collections/:collection/documents", handler.CreateDocument)
		apiRouter.POST(
			"/projects/:project/collections/:collection/documents/:id/attachments",
			func(c *gin.Context) {
				if c.Param("collection") == "comment" {
					attachmentDelivery.Post(c)
				} else {
					c.AbortWithStatus(http.StatusNotFound)
				}
			},
		)
		apiRouter.PATCH("/projects/:project/collections/:collection/documents/:id", handler.PatchDocument)
		apiRouter.DELETE("/projects/:project/collections/:collection/documents/:id", handler.DeleteDocument)

		// PublishOperationInfo
		publishOperationInfoRepository := repository.NewPublishOperationInfo(mongoDB)
		publishOperationInfoUsecase := usecase.NewPublishOperationInfo(
			publishOperationInfoRepository,
			readTimeout,
		)
		publishOperationInfoDelivery := delivery.NewPublishOperationInfo(publishOperationInfoUsecase)
		apiRouter.GET("/projects/:project/latestAssetsOperationInfos", publishOperationInfoDelivery.ListLatestAssetDocuments)
		apiRouter.GET("/projects/:project/latestShotsOperationInfos", publishOperationInfoDelivery.ListLatestShotDocuments)
		apiRouter.GET("/projects/:project/publishOperationInfo/shots", publishOperationInfoDelivery.ListShots)

		// PublishLog API

		projectRepository := project.NewRepository(myDB)
		projectService := project.NewService(projectRepository)

		dataset, err := getDataset(client, publishLogDatasetID)
		if err != nil {
			log.Fatal(err)
		}
		publishLogRepository := publishlog.NewRepository(client, dataset)
		publishLogService := publishlog.NewService(publishLogRepository)
		publishLogHandler := publishlog.NewHandler(publishLogService, projectService)
		apiRouter.GET("/projects/:project/publishLogs", publishLogHandler.Get)
		apiRouter.GET("/projects/:project/publishLogs/:id", publishLogHandler.GetByID)
		apiRouter.POST("/projects/:project/publishLogs", publishLogHandler.Post)

		// PublishTransactionInfo API

		publishTransactionInfoRepository, err := repository.NewPublishTransactionInfo(gormDB)
		if err != nil {
			log.Fatal(err)
		}
		publishTransactionInfoUsecase := usecase.NewPublishTransactionInfo(
			publishTransactionInfoRepository,
			projectInfoRepository,
			studioInfoRepository,
			pipelineSettingRepository,
			mongoRepo,
			readTimeout,
			writeTimeout,
		)
		publishTransactionInfoDelivery := delivery.NewPublishTransactionInfo(
			publishTransactionInfoUsecase,
		)
		apiRouter.GET("/projects/:project/publishTransactionInfos", publishTransactionInfoDelivery.List)
		apiRouter.POST(
			"/projects/:project/publishTransactionInfos",
			publishTransactionInfoDelivery.Post,
		)
		apiRouter.GET(
			"/projects/:project/publishTransactionInfos/:logID",
			publishTransactionInfoDelivery.Get,
		)
		apiRouter.PATCH("/projects/:project/publishTransactionInfos/:logID", methodNotAllowedHandler)
		apiRouter.DELETE("/projects/:project/publishTransactionInfos/:logID", methodNotAllowedHandler)

		// PipelineParameter API

		pipelineParameterRouter := apiRouter.Group("/pipelineParameter")
		{
			pipelineParameterUsecase := usecase.NewPipelineParameter(
				pipelineParameterRepository,
				projectInfoRepository,
				studioInfoRepository,
				readTimeout,
				writeTimeout,
			)
			pipelineParameterDelivery := delivery.NewPipelineParameter(pipelineParameterUsecase)

			// Parameter

			pipelineParameterRouter.GET(
				"/parameters", pipelineParameterDelivery.ListParameters,
			)
			pipelineParameterRouter.GET(
				"/parameters/:parameter", pipelineParameterDelivery.GetParameter,
			)
			pipelineParameterRouter.POST(
				"/parameters", pipelineParameterDelivery.PostParameter,
			)
			pipelineParameterRouter.DELETE(
				"/parameters/:parameter", pipelineParameterDelivery.DeleteParameter,
			)

			// Location

			pipelineParameterRouter.GET(
				"/projects/:project/locations", pipelineParameterDelivery.ListLocations,
			)
			pipelineParameterRouter.GET(
				"/projects/:project/locations/:id", pipelineParameterDelivery.GetLocation,
			)
			pipelineParameterRouter.POST(
				"/projects/:project/locations", pipelineParameterDelivery.PostLocation,
			)
			pipelineParameterRouter.DELETE(
				"/projects/:project/locations/:id", pipelineParameterDelivery.DeleteLocation,
			)

			// Value

			pipelineParameterRouter.GET(
				"/values", pipelineParameterDelivery.ListValues,
			)
			pipelineParameterRouter.GET(
				"/values/:id", pipelineParameterDelivery.GetValue,
			)
			pipelineParameterRouter.POST(
				"/values", pipelineParameterDelivery.PostValue,
			)
			pipelineParameterRouter.PATCH(
				"/values/:id", pipelineParameterDelivery.PatchValue,
			)
			pipelineParameterRouter.PUT(
				"/values", pipelineParameterDelivery.PutValue,
			)
			pipelineParameterRouter.DELETE(
				"/values/:id", pipelineParameterDelivery.DeleteValue,
			)

			// TODO: pipelineParameterRouter.GET("/composite/values/*location", ...)
		}

		// GroupCategory API

		groupCategoryRepository, err := repository.NewGroupCategory(gormDB)
		if err != nil {
			log.Fatal(err)
		}
		groupCategoryUsecase := usecase.NewGroupCategory(
			groupCategoryRepository,
			projectInfoRepository,
			readTimeout,
			writeTimeout,
		)
		groupCategoryDelivery := delivery.NewGroupCategory(groupCategoryUsecase)
		apiRouter.GET(
			"/projects/:project/groupCategories", groupCategoryDelivery.List,
		)
		apiRouter.GET(
			"/projects/:project/groupCategories/:id", groupCategoryDelivery.Get,
		)
		apiRouter.POST(
			"/projects/:project/groupCategories", groupCategoryDelivery.Post,
		)
		apiRouter.PATCH(
			"/projects/:project/groupCategories/:id", groupCategoryDelivery.Patch,
		)
		apiRouter.DELETE(
			"/projects/:project/groupCategories/:id", groupCategoryDelivery.Delete,
		)

		// OfficialRevision API
		officialRevisionRepository, err := repository.NewOfficialRevision(gormDB)
		if err != nil {
			log.Fatal(err)
		}
		officialRevisionUsecase := usecase.NewOfficialRevision(
			officialRevisionRepository,
			projectInfoRepository,
			mongoRepo,
			readTimeout,
			writeTimeout,
		)
		officialRevisionDelivery := delivery.NewOfficialRevision(officialRevisionUsecase)
		apiRouter.GET("/projects/:project/officialRevisions", officialRevisionDelivery.List)
		apiRouter.PUT("/projects/:project/officialRevisions", officialRevisionDelivery.Put)

		apiRouter.GET(
			"/projects/:project/publishedRevisions",
			officialRevisionDelivery.ListComposite,
		)

		// PipelineSetting API (Config / Preference / Environment)

		pipelineSettingRouter := apiRouter.Group("/pipelineSetting")
		{
			pipelineSettingUsecase := usecase.NewPipelineSetting(
				pipelineSettingRepository,
				projectInfoRepository,
				studioInfoRepository,
				readTimeout,
				writeTimeout,
			)
			pipelineSettingDelivery := delivery.NewPipelineSetting(pipelineSettingUsecase)

			// Config Property

			pipelineSettingRouter.GET(
				"/:group/sections/:section/properties",
				func(c *gin.Context) {
					if c.Param("group") == entity.Config.String() {
						pipelineSettingDelivery.ListProperties(c)
					} else {
						c.AbortWithStatus(http.StatusNotFound)
					}
				},
			)
			pipelineSettingRouter.GET(
				"/:group/sections/:section/properties/*key",
				func(c *gin.Context) {
					if c.Param("group") == entity.Config.String() {
						if c.Param("key") == "/" {
							pipelineSettingDelivery.ListProperties(c)
						} else {
							pipelineSettingDelivery.GetProperty(c)
						}
					} else {
						c.AbortWithStatus(http.StatusNotFound)
					}
				},
			)
			pipelineSettingRouter.POST(
				"/:group/sections/:section/properties",
				func(c *gin.Context) {
					if c.Param("group") == entity.Config.String() {
						pipelineSettingDelivery.PostProperty(c)
					} else {
						c.AbortWithStatus(http.StatusNotFound)
					}
				},
			)
			pipelineSettingRouter.PATCH(
				"/:group/sections/:section/properties/*key",
				func(c *gin.Context) {
					if c.Param("group") == entity.Config.String() {
						pipelineSettingDelivery.PatchProperty(c)
					} else {
						c.AbortWithStatus(http.StatusNotFound)
					}
				},
			)
			pipelineSettingRouter.DELETE(
				"/:group/sections/:section/properties/*key",
				func(c *gin.Context) {
					if c.Param("group") == entity.Config.String() {
						pipelineSettingDelivery.DeleteProperty(c)
					} else {
						c.AbortWithStatus(http.StatusNotFound)
					}
				},
			)

			// Preference/Environment Property
			preference := entity.Preference.String()
			environment := entity.Environment.String()

			pipelineSettingRouter.GET(
				"/:group/properties",
				func(c *gin.Context) {
					group := c.Param("group")
					if group == preference {
						pipelineSettingDelivery.ListProperties(c)
					} else if group == environment {
						pipelineSettingDelivery.ListEnvironmentProperties(c)
					} else {
						c.AbortWithStatus(http.StatusNotFound)
					}
				},
			)
			pipelineSettingRouter.GET(
				"/:group/properties/*key",
				func(c *gin.Context) {
					group := c.Param("group")
					if group == preference {
						if c.Param("key") == "/" {
							pipelineSettingDelivery.ListProperties(c)
						} else {
							pipelineSettingDelivery.GetProperty(c)
						}
					} else if group == environment {
						if c.Param("key") == "/" {
							pipelineSettingDelivery.ListEnvironmentProperties(c)
						} else {
							pipelineSettingDelivery.GetEnvironmentProperty(c)
						}
					} else {
						c.AbortWithStatus(http.StatusNotFound)
					}
				},
			)
			pipelineSettingRouter.POST(
				"/:group/properties",
				func(c *gin.Context) {
					group := c.Param("group")
					if group == preference {
						pipelineSettingDelivery.PostProperty(c)
					} else if group == environment {
						pipelineSettingDelivery.PostEnvironmentProperty(c)
					} else {
						c.AbortWithStatus(http.StatusNotFound)
					}
				},
			)
			pipelineSettingRouter.PATCH(
				"/:group/properties/*key",
				func(c *gin.Context) {
					group := c.Param("group")
					if group == preference {
						pipelineSettingDelivery.PatchProperty(c)
					} else if group == environment {
						pipelineSettingDelivery.PatchEnvironmentProperty(c)
					} else {
						c.AbortWithStatus(http.StatusNotFound)
					}
				},
			)
			pipelineSettingRouter.DELETE(
				"/:group/properties/*key",
				func(c *gin.Context) {
					group := c.Param("group")
					if group == preference {
						pipelineSettingDelivery.DeleteProperty(c)
					} else if group == environment {
						pipelineSettingDelivery.DeleteEnvironmentProperty(c)
					} else {
						c.AbortWithStatus(http.StatusNotFound)
					}
				},
			)

			// Value

			pipelineSettingValueGetHandler := func(c *gin.Context) {
				if c.Param("key") == "/" {
					pipelineSettingDelivery.ListValues(c)
				} else {
					pipelineSettingDelivery.GetValue(c)
				}
			}

			// Common Value

			pipelineSettingRouter.GET(
				"/environment/commons/:common/values",
				pipelineSettingDelivery.ListEnvironmentValues,
			)
			pipelineSettingRouter.GET(
				"/:group/commons/:common/values",
				pipelineSettingDelivery.ListValues,
			)
			pipelineSettingRouter.GET(
				"/environment/commons/:common/values/:id",
				pipelineSettingDelivery.GetEnvironmentValue,
			)
			pipelineSettingRouter.GET(
				"/:group/commons/:common/values/*key",
				pipelineSettingValueGetHandler,
			)
			pipelineSettingRouter.POST(
				"/environment/commons/:common/values",
				pipelineSettingDelivery.PostEnvironmentValue,
			)
			pipelineSettingRouter.POST(
				"/:group/commons/:common/values",
				pipelineSettingDelivery.PostValue,
			)
			pipelineSettingRouter.PATCH(
				"/environment/commons/:common/values/:id",
				pipelineSettingDelivery.PatchEnvironmentValue,
			)
			pipelineSettingRouter.PATCH(
				"/:group/commons/:common/values/*key",
				pipelineSettingDelivery.PatchValue,
			)
			pipelineSettingRouter.DELETE(
				"/environment/commons/:common/values/:id",
				pipelineSettingDelivery.DeleteEnvironmentValue,
			)
			pipelineSettingRouter.DELETE(
				"/:group/commons/:common/values/*key",
				pipelineSettingDelivery.DeleteValue,
			)

			// Studio Value

			pipelineSettingRouter.GET(
				"/environment/studios/:studio/values",
				pipelineSettingDelivery.ListEnvironmentValues,
			)
			pipelineSettingRouter.GET(
				"/:group/studios/:studio/values",
				pipelineSettingDelivery.ListValues,
			)
			pipelineSettingRouter.GET(
				"/environment/studios/:studio/values/:id",
				pipelineSettingDelivery.GetEnvironmentValue,
			)
			pipelineSettingRouter.GET(
				"/:group/studios/:studio/values/*key",
				pipelineSettingValueGetHandler,
			)
			pipelineSettingRouter.POST(
				"/environment/studios/:studio/values",
				pipelineSettingDelivery.PostEnvironmentValue,
			)
			pipelineSettingRouter.POST(
				"/:group/studios/:studio/values",
				pipelineSettingDelivery.PostValue,
			)
			pipelineSettingRouter.PATCH(
				"/environment/studios/:studio/values/:id",
				pipelineSettingDelivery.PatchEnvironmentValue,
			)
			pipelineSettingRouter.PATCH(
				"/:group/studios/:studio/values/*key",
				pipelineSettingDelivery.PatchValue,
			)
			pipelineSettingRouter.DELETE(
				"/environment/studios/:studio/values/:id",
				pipelineSettingDelivery.DeleteEnvironmentValue,
			)
			pipelineSettingRouter.DELETE(
				"/:group/studios/:studio/values/*key",
				pipelineSettingDelivery.DeleteValue,
			)

			// Project Value

			pipelineSettingRouter.GET(
				"/environment/projects/:project/values",
				pipelineSettingDelivery.ListEnvironmentValues,
			)
			pipelineSettingRouter.GET(
				"/:group/projects/:project/values",
				pipelineSettingDelivery.ListValues,
			)
			pipelineSettingRouter.GET(
				"/environment/projects/:project/values/:id",
				pipelineSettingDelivery.GetEnvironmentValue,
			)
			pipelineSettingRouter.GET(
				"/:group/projects/:project/values/*key",
				pipelineSettingValueGetHandler,
			)
			pipelineSettingRouter.POST(
				"/environment/projects/:project/values",
				pipelineSettingDelivery.PostEnvironmentValue,
			)
			pipelineSettingRouter.POST(
				"/:group/projects/:project/values",
				pipelineSettingDelivery.PostValue,
			)
			pipelineSettingRouter.PATCH(
				"/environment/projects/:project/values/:id",
				pipelineSettingDelivery.PatchEnvironmentValue,
			)
			pipelineSettingRouter.PATCH(
				"/:group/projects/:project/values/*key",
				pipelineSettingDelivery.PatchValue,
			)
			pipelineSettingRouter.DELETE(
				"/environment/projects/:project/values/:id",
				pipelineSettingDelivery.DeleteEnvironmentValue,
			)
			pipelineSettingRouter.DELETE(
				"/:group/projects/:project/values/*key",
				pipelineSettingDelivery.DeleteValue,
			)

			// Composite Value

			pipelineSettingRouter.GET(
				"/:group/composite/values/*key",
				func(c *gin.Context) {
					// currently Environment is ignored
					// https://ppi-jp.backlog.com/view/RND-1473#comment-410804011
					if c.Param("group") == entity.Preference.String() {
						pipelineSettingDelivery.GetCompositeValue(c)
					} else {
						c.AbortWithStatus(http.StatusNotFound)
					}
				},
			)
		}

		// Legacy PipelineSettings API (Readonly)

		settingRouter0 := apiRouter.Group("/setting")
		{
			db0 := myDB
			connection0 := os.Getenv("PPI_DEV_LEGACY_DB") // DB for local development environment
			if connection0 != "" {
				var err error
				db0, err = openMySQLByDSN(connection0)
				if err != nil {
					log.Fatal(err)
				}
				err = db0.Ping()
				if err != nil {
					log.Fatal(err)
				}
				defer db0.Close()
			}

			repo0 := legacyRepository.NewRepository(db0)
			uc0 := settingUsecase.NewSettingUsecase(repo0, readTimeout, writeTimeout)
			deliver0 := httpHandler.NewSettingDelivery(uc0)

			settingRouter0.GET("/groups", setting.GetGroups)
			settingRouter0.GET("/types", setting.GetTypes)

			settingRouter0.GET("/config/definitions", deliver0.HandleGetDefinitions(domain.Config))
			settingRouter0.GET("/environment/definitions", deliver0.HandleGetDefinitions(domain.Environment))
			settingRouter0.GET("/preference/definitions", deliver0.HandleGetDefinitions(domain.Preference))

			settingRouter0.GET("/config/schemas", deliver0.HandleGetSchemas(domain.Config))
			settingRouter0.GET("/environment/schemas", deliver0.HandleGetSchemas(domain.Environment))
			settingRouter0.GET("/preference/schemas", deliver0.HandleGetSchemas(domain.Preference))

			settingRouter0.GET("/config/values", deliver0.HandleGetValues(domain.Config))
			settingRouter0.GET("/environment/values", deliver0.HandleGetValues(domain.Environment))
			settingRouter0.GET("/preference/values", deliver0.HandleGetValues(domain.Preference))
		}

		// New PipelineSetting API

		settingRouter := apiRouter.Group("/setting/rc1")
		{
			myRepo := settingRepository.NewRepository(myDB)
			uc := settingUsecase.NewSettingUsecase(myRepo, readTimeout, writeTimeout)
			deliver := httpHandler.NewSettingDelivery(uc)

			settingRouter.GET("/groups", setting.GetGroups)
			settingRouter.GET("/types", setting.GetTypes)
			settingRouter.GET("/sections", setting.GetSections)
			settingRouter.GET("/entries", setting.GetEntries)

			settingRouter.GET("/config/definitions", deliver.HandleGetDefinitions(domain.Config))
			settingRouter.GET("/config/definitions/:id", deliver.HandleGetDefinitionByID(domain.Config))
			settingRouter.POST("/config/definitions", deliver.HandlePostDefinition(domain.Config))
			settingRouter.PATCH("/config/definitions/:id", deliver.HandlePatchDefinition(domain.Config))
			settingRouter.DELETE("/config/definitions/:id", deliver.HandleDeleteDefinition(domain.Config))

			settingRouter.GET("/environment/definitions", deliver.HandleGetDefinitions(domain.Environment))
			settingRouter.GET("/environment/definitions/:id", deliver.HandleGetDefinitionByID(domain.Environment))
			settingRouter.POST("/environment/definitions", deliver.HandlePostDefinition(domain.Environment))
			settingRouter.PATCH("/environment/definitions/:id", deliver.HandlePatchDefinition(domain.Environment))
			settingRouter.DELETE("/environment/definitions/:id", deliver.HandleDeleteDefinition(domain.Environment))

			settingRouter.GET("/preference/definitions", deliver.HandleGetDefinitions(domain.Preference))
			settingRouter.GET("/preference/definitions/:id", deliver.HandleGetDefinitionByID(domain.Preference))
			settingRouter.POST("/preference/definitions", deliver.HandlePostDefinition(domain.Preference))
			settingRouter.PATCH("/preference/definitions/:id", deliver.HandlePatchDefinition(domain.Preference))
			settingRouter.DELETE("/preference/definitions/:id", deliver.HandleDeleteDefinition(domain.Preference))

			settingRouter.GET("/config/schemas", deliver.HandleGetSchemas(domain.Config))
			settingRouter.GET("/config/schemas/:id", deliver.HandleGetSchemaByID(domain.Config))
			settingRouter.POST("/config/schemas", deliver.HandlePostSchema(domain.Config))
			settingRouter.PATCH("/config/schemas/:id", deliver.HandlePatchSchema(domain.Config))
			settingRouter.DELETE("/config/schemas/:id", deliver.HandleDeleteSchema(domain.Config))

			settingRouter.GET("/environment/schemas", deliver.HandleGetSchemas(domain.Environment))
			settingRouter.GET("/environment/schemas/:id", deliver.HandleGetSchemaByID(domain.Environment))
			settingRouter.POST("/environment/schemas", deliver.HandlePostSchema(domain.Environment))
			settingRouter.PATCH("/environment/schemas/:id", deliver.HandlePatchSchema(domain.Environment))
			settingRouter.DELETE("/environment/schemas/:id", deliver.HandleDeleteSchema(domain.Environment))

			settingRouter.GET("/preference/schemas", deliver.HandleGetSchemas(domain.Preference))
			settingRouter.GET("/preference/schemas/:id", deliver.HandleGetSchemaByID(domain.Preference))
			settingRouter.POST("/preference/schemas", deliver.HandlePostSchema(domain.Preference))
			settingRouter.PATCH("/preference/schemas/:id", deliver.HandlePatchSchema(domain.Preference))
			settingRouter.DELETE("/preference/schemas/:id", deliver.HandleDeleteSchema(domain.Preference))

			settingRouter.GET("/config/values", deliver.HandleGetValues(domain.Config))
			settingRouter.GET("/config/values/:id", deliver.HandleGetValueByID(domain.Config))
			settingRouter.POST("/config/values", deliver.HandlePostValue(domain.Config))
			settingRouter.PATCH("/config/values/:id", deliver.HandlePatchValue(domain.Config))
			settingRouter.DELETE("/config/values/:id", deliver.HandleDeleteValue(domain.Config))

			settingRouter.GET("/environment/values", deliver.HandleGetValues(domain.Environment))
			settingRouter.GET("/environment/values/:id", deliver.HandleGetValueByID(domain.Environment))
			settingRouter.POST("/environment/values", deliver.HandlePostValue(domain.Environment))
			settingRouter.PATCH("/environment/values/:id", deliver.HandlePatchValue(domain.Environment))
			settingRouter.DELETE("/environment/values/:id", deliver.HandleDeleteValue(domain.Environment))

			settingRouter.GET("/preference/values", deliver.HandleGetValues(domain.Preference))
			settingRouter.GET("/preference/values/:id", deliver.HandleGetValueByID(domain.Preference))
			settingRouter.POST("/preference/values", deliver.HandlePostValue(domain.Preference))
			settingRouter.PATCH("/preference/values/:id", deliver.HandlePatchValue(domain.Preference))
			settingRouter.DELETE("/preference/values/:id", deliver.HandleDeleteValue(domain.Preference))
		}

		// DataDependency API
		//
		// Note: The DataDependency API is only available when the Neo4j authentication
		//       environment variables are provided.

		if dataDepRepo != nil {
			registerDataDepHandlers(apiRouter, dataDepUsecase)
		}

		// Generate CSV API
		generateCsvTimeout := 60 * 15 * time.Second
		generateCsvRepository := repository.NewGenerateCsv(gormDB)
		generateCsvUsecase := usecase.NewGenerateCsv(
			generateCsvRepository,
			reviewInfoRepository,
			groupCategoryRepository,
			publishOperationInfoRepository,
			mongoRepo,
			generateCsvTimeout,
		)
		generateCsvDelivery := delivery.NewGenerateCsv(generateCsvUsecase)
		apiRouter.GET("/projects/:project/assets/generateCsv", generateCsvDelivery.GenerateAssetsCsv)
	}

	s := &http.Server{
		Addr:           ":4000",
		Handler:        router,
		ReadTimeout:    readTimeout,
		WriteTimeout:   writeTimeout,
		MaxHeaderBytes: 1 << 20,
	}

	if err := s.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
