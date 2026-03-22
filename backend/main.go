package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"perfume-store/config"
	"perfume-store/database"
	"perfume-store/handlers"
	"perfume-store/logger"
	"perfume-store/middleware"
	"perfume-store/models"
	"perfume-store/routes"
	"perfume-store/utils"

	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func main() {
	config.Load("")
	utils.InitStripe()
	if err := database.Connect(); err != nil {
		logger.Fatalf("MongoDB connection failed: %v", err)
	}
	defer database.Disconnect()
	_ = database.EnsureIndexes(context.Background())

	seedSuperAdmin()
	if config.AppConfig.AppEnv != "production" {
		seedSampleProducts()
	}
	seedCategories()
	seedSeasonalSaleBanner()
	seedStoreLocations()
	seedFeatureFlags()
	handlers.SyncGlobalSettings()
	backfillOrderNumbers()
	backfillAuditOrderNumbers()
	migrateUserRoleToCustomer()

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.RequestLogger())
	r.Use(middleware.ErrorLogger())
	r.Use(corsMiddleware())
	r.Static("/uploads", "./uploads")
	routes.Setup(r)

	addr := config.AppConfig.Host + ":" + config.AppConfig.Port
	go func() {
		if err := r.Run(addr); err != nil {
			logger.Fatalf("Server failed: %v", err)
		}
	}()

	logger.Infof("Server running on http://%s", addr)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("Shutting down...")
}

func corsMiddleware() gin.HandlerFunc {
	allowedList := config.AllowedCORSOrigins()
	allowedSet := make(map[string]bool)
	for _, o := range allowedList {
		allowedSet[o] = true
	}
	// Dev convenience: always allow localhost Vite origins
	allowedSet["http://localhost:5173"] = true
	allowedSet["http://localhost:5174"] = true
	allowedSet["http://127.0.0.1:5173"] = true
	allowedSet["http://127.0.0.1:5174"] = true
	defaultOrigin := "http://localhost:5173"
	if len(allowedList) > 0 {
		defaultOrigin = allowedList[0]
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && allowedSet[origin] {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			if origin != "" {
				logger.Infof("CORS rejected origin: %q (allowed: %v)", origin, allowedList)
			}
			c.Writer.Header().Set("Access-Control-Allow-Origin", defaultOrigin)
		}
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

func seedSuperAdmin() {
	col := database.DB.Collection("users")
	count, err := col.CountDocuments(context.Background(), bson.M{"role": models.RoleSuperAdmin})
	if err != nil || count > 0 {
		return
	}

	hashed, _ := utils.HashPassword("superadmin123")
	now := time.Now()
	user := models.User{
		ID:        primitive.NewObjectID(),
		Email:     "superadmin@perfume.store",
		Password:  hashed,
		FirstName: "Super",
		LastName:  "Admin",
		Role:      models.RoleSuperAdmin,
		Active:    true,
		CreatedAt: now,
		UpdatedAt: now,
	}
	_, _ = col.InsertOne(context.Background(), user)
	logger.Info("Seeded super admin: superadmin@perfume.store / superadmin123")
}

func seedSampleProducts() {
	col := database.DB.Collection("products")
	count, _ := col.CountDocuments(context.Background(), bson.M{})
	if count > 0 {
		return // Collection already has products, skip seeding to avoid invalidating frontend IDs
	}
	now := time.Now()
	samples := []models.Product{
		{ID: primitive.NewObjectID(), Name: "Dubai Oud", Description: "Authentic Arabian oud, rich and woody. A signature of UAE luxury. Sourced from premium agarwood and blended with saffron.", Price: 349.00, ImageURL: "https://images.pexels.com/photos/29805437/pexels-photo-29805437.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop", Category: "Oud", Audience: "men", NewArrival: true, OnSale: false, Stock: 50, Notes: []string{"Oud", "Agarwood", "Saffron"}, SeasonalFlag: "", Active: true, CreatedAt: now, UpdatedAt: now},
		{ID: primitive.NewObjectID(), Name: "Emirates Rose", Description: "Taif rose meets Arabian musk. Elegant and timeless. A delicate balance of floral and woody notes.", Price: 279.00, ImageURL: "https://images.pexels.com/photos/755992/pexels-photo-755992.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop", Category: "Bakhoor", Audience: "women", NewArrival: false, OnSale: true, DiscountPercent: 15, Stock: 40, Notes: []string{"Rose", "Musk", "Oud"}, SeasonalFlag: "", Active: true, CreatedAt: now, UpdatedAt: now},
		{ID: primitive.NewObjectID(), Name: "Arabian Nights Attar", Description: "Pure attar oil with oud and jasmine. Long-lasting, oil-based fragrance for special occasions.", Price: 199.00, ImageURL: "https://images.pexels.com/photos/8516275/pexels-photo-8516275.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop", Category: "Attar", Audience: "men", NewArrival: false, OnSale: true, DiscountPercent: 10, Stock: 60, Notes: []string{"Attar", "Jasmine", "Oud"}, SeasonalFlag: "", Active: true, CreatedAt: now, UpdatedAt: now},
		{ID: primitive.NewObjectID(), Name: "Abu Dhabi Amber", Description: "Warm oriental amber with hints of frankincense. Crafted in the UAE for the discerning collector.", Price: 429.00, ImageURL: "https://images.pexels.com/photos/965990/pexels-photo-965990.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop", Category: "Oriental", Audience: "unisex", NewArrival: true, OnSale: false, Stock: 30, Notes: []string{"Amber", "Frankincense", "Sandalwood"}, SeasonalFlag: "", Active: true, CreatedAt: now, UpdatedAt: now},
		{ID: primitive.NewObjectID(), Name: "Black Oud", Description: "Dark, intense oud with leather and tobacco. For the bold.", Price: 449.00, ImageURL: "https://images.pexels.com/photos/7270663/pexels-photo-7270663.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop", Category: "Oud", Audience: "men", NewArrival: false, OnSale: true, DiscountPercent: 18, Stock: 28, Notes: []string{"Oud", "Leather", "Tobacco"}, SeasonalFlag: "", Active: true, CreatedAt: now, UpdatedAt: now},
		{ID: primitive.NewObjectID(), Name: "Golden Saffron Bakhoor", Description: "Luxurious bakhoor with saffron, oud, and a touch of honey.", Price: 229.00, ImageURL: "https://images.pexels.com/photos/9957575/pexels-photo-9957575.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop", Category: "Bakhoor", Audience: "unisex", NewArrival: true, OnSale: false, Stock: 42, Notes: []string{"Saffron", "Oud", "Bakhoor"}, SeasonalFlag: "christmas", Active: true, CreatedAt: now, UpdatedAt: now},
		{ID: primitive.NewObjectID(), Name: "Layali Bakhoor", Description: "Night-inspired bakhoor with jasmine, oud, and musk. Romantic and rich.", Price: 179.00, ImageURL: "https://images.pexels.com/photos/1961791/pexels-photo-1961791.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop", Category: "Bakhoor", Audience: "women", NewArrival: false, OnSale: false, Stock: 52, Notes: []string{"Jasmine", "Oud", "Musk"}, SeasonalFlag: "", Active: true, CreatedAt: now, UpdatedAt: now},
		{ID: primitive.NewObjectID(), Name: "Oriental Dream", Description: "Vanilla, tonka, and a hint of oud. Smooth and comforting.", Price: 269.00, ImageURL: "https://images.pexels.com/photos/7270671/pexels-photo-7270671.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop", Category: "Oriental", Audience: "women", NewArrival: true, OnSale: false, Stock: 44, Notes: []string{"Vanilla", "Tonka", "Oud"}, SeasonalFlag: "", Active: true, CreatedAt: now, UpdatedAt: now},
		{ID: primitive.NewObjectID(), Name: "Spiced Oud", Description: "Oud warmed with cinnamon, clove, and nutmeg. Winter favourite.", Price: 329.00, ImageURL: "https://images.pexels.com/photos/755992/pexels-photo-755992.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop", Category: "Oriental", Audience: "men", NewArrival: true, OnSale: false, Stock: 39, Notes: []string{"Oud", "Cinnamon", "Clove"}, SeasonalFlag: "christmas", Active: true, CreatedAt: now, UpdatedAt: now},
		{ID: primitive.NewObjectID(), Name: "Vetiver Attar", Description: "Earthy vetiver attar. Grounding and sophisticated.", Price: 189.00, ImageURL: "https://images.pexels.com/photos/965990/pexels-photo-965990.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop", Category: "Attar", Audience: "men", NewArrival: false, OnSale: false, Stock: 47, Notes: []string{"Vetiver", "Attar"}, SeasonalFlag: "", Active: true, CreatedAt: now, UpdatedAt: now},
		{ID: primitive.NewObjectID(), Name: "Silk Oud", Description: "Silky-smooth oud with tonka and almond. Soft and refined.", Price: 369.00, ImageURL: "https://images.pexels.com/photos/1190829/pexels-photo-1190829.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop", Category: "Oud", Audience: "women", NewArrival: false, OnSale: false, Stock: 28, Notes: []string{"Oud", "Tonka", "Almond"}, SeasonalFlag: "", Active: true, CreatedAt: now, UpdatedAt: now},
		{ID: primitive.NewObjectID(), Name: "Oud Noir", Description: "Dark, mysterious oud. Midnight in a bottle.", Price: 489.00, ImageURL: "https://images.pexels.com/photos/1961791/pexels-photo-1961791.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop", Category: "Oriental", Audience: "men", NewArrival: true, OnSale: false, Stock: 17, Notes: []string{"Oud", "Dark", "Mysterious"}, SeasonalFlag: "", Active: true, CreatedAt: now, UpdatedAt: now},
		{ID: primitive.NewObjectID(), Name: "Henna Attar", Description: "Henna flower attar. Earthy, floral, and traditional.", Price: 149.00, ImageURL: "https://images.pexels.com/photos/29805437/pexels-photo-29805437.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop", Category: "Attar", Audience: "women", NewArrival: false, OnSale: true, DiscountPercent: 18, Stock: 61, Notes: []string{"Henna", "Attar", "Floral"}, SeasonalFlag: "", Active: true, CreatedAt: now, UpdatedAt: now},
		{ID: primitive.NewObjectID(), Name: "Emirati Gold Oud", Description: "Our flagship oud. The finest agarwood, aged and blended in Dubai. The ultimate luxury.", Price: 799.00, ImageURL: "https://images.pexels.com/photos/755992/pexels-photo-755992.jpeg?auto=compress&cs=tinysrgb&w=400&h=500&fit=crop", Category: "Oud", Audience: "unisex", NewArrival: true, OnSale: false, Stock: 10, Notes: []string{"Oud", "Agarwood", "Luxury"}, SeasonalFlag: "ramadan", Active: true, CreatedAt: now, UpdatedAt: now},
	}
	for _, p := range samples {
		_, _ = col.InsertOne(context.Background(), p)
	}
	logger.Info("Seeded sample products (replaced existing)")
}

func backfillOrderNumbers() {
	col := database.DB.Collection("orders")
	opts := options.Find().SetProjection(bson.M{"_id": 1, "created_at": 1})
	cursor, err := col.Find(context.Background(), bson.M{"order_number": bson.M{"$exists": false}}, opts)
	if err != nil || cursor == nil {
		return
	}
	defer cursor.Close(context.Background())
	updated := 0
	for cursor.Next(context.Background()) {
		var doc struct {
			ID        primitive.ObjectID `bson:"_id"`
			CreatedAt time.Time          `bson:"created_at"`
		}
		if cursor.Decode(&doc) != nil {
			continue
		}
		suffix := strings.ToUpper(doc.ID.Hex())
		if len(suffix) > 6 {
			suffix = suffix[len(suffix)-6:]
		}
		orderNum := "ORD-" + doc.CreatedAt.Format("20060102") + "-" + suffix
		_, err := col.UpdateOne(context.Background(), bson.M{"_id": doc.ID}, bson.M{"$set": bson.M{"order_number": orderNum}})
		if err == nil {
			updated++
		}
	}
	if updated > 0 {
		logger.Infof("Backfilled order_number for %d existing orders", updated)
	}
}

func backfillAuditOrderNumbers() {
	auditCol := database.DB.Collection("audit_logs")
	ordersCol := database.DB.Collection("orders")
	filter := bson.M{
		"action":    bson.M{"$in": []string{"order_place", "order_status"}},
		"target_id": bson.M{"$exists": true, "$ne": ""},
	}
	opts := options.Find().SetProjection(bson.M{"_id": 1, "target_id": 1, "details.orderNumber": 1})
	cursor, err := auditCol.Find(context.Background(), filter, opts)
	if err != nil || cursor == nil {
		return
	}
	defer cursor.Close(context.Background())
	updated := 0
	for cursor.Next(context.Background()) {
		var doc struct {
			ID       primitive.ObjectID `bson:"_id"`
			TargetID string             `bson:"target_id"`
			Details  *struct {
				OrderNumber string `bson:"orderNumber"`
			} `bson:"details"`
		}
		if cursor.Decode(&doc) != nil || doc.TargetID == "" {
			continue
		}
		if doc.Details != nil && strings.HasPrefix(doc.Details.OrderNumber, "ORD-") {
			continue // already has valid order number
		}
		oid, err := primitive.ObjectIDFromHex(doc.TargetID)
		if err != nil {
			continue
		}
		var order struct {
			OrderNumber string `bson:"order_number"`
		}
		if ordersCol.FindOne(context.Background(), bson.M{"_id": oid}).Decode(&order) != nil || order.OrderNumber == "" {
			continue
		}
		_, err = auditCol.UpdateOne(context.Background(), bson.M{"_id": doc.ID}, bson.M{"$set": bson.M{"details.orderNumber": order.OrderNumber}})
		if err == nil {
			updated++
		}
	}
	if updated > 0 {
		logger.Infof("Backfilled orderNumber for %d audit logs", updated)
	}
}

func migrateUserRoleToCustomer() {
	col := database.DB.Collection("users")
	res, err := col.UpdateMany(context.Background(), bson.M{"role": "user"}, bson.M{"$set": bson.M{"role": "customer"}})
	if err != nil {
		return
	}
	if res.ModifiedCount > 0 {
		logger.Infof("Migrated %d users from role 'user' to 'customer'", res.ModifiedCount)
	}
}

func seedCategories() {
	col := database.DB.Collection("categories")
	count, _ := col.CountDocuments(context.Background(), bson.M{})
	if count > 0 {
		return
	}
	cats := []bson.M{
		{"_id": primitive.NewObjectID(), "name": "Oud"},
		{"_id": primitive.NewObjectID(), "name": "Bakhoor"},
		{"_id": primitive.NewObjectID(), "name": "Oriental"},
		{"_id": primitive.NewObjectID(), "name": "Attar"},
	}
	for _, c := range cats {
		_, _ = col.InsertOne(context.Background(), c)
	}
	logger.Info("Seeded categories")
}

func seedSeasonalSaleBanner() {
	col := database.DB.Collection("banners")
	count, err := col.CountDocuments(context.Background(), bson.M{"_id": "seasonal_sale"})
	if err != nil || count > 0 {
		return
	}
	doc := bson.M{
		"_id":           "seasonal_sale",
		"enabled":       false,
		"headline":      "Seasonal Sale",
		"subheadline":   "Up to 30% off selected oud & bakhoor",
		"cta_text":      "Shop the sale",
		"start_date":    "",
		"end_date":      "",
		"image_url":     "https://images.pexels.com/photos/724635/pexels-photo-724635.jpeg?auto=compress&cs=tinysrgb&w=1600",
		"theme":         "dark",
		"show_on":       "both",
		"cta_new_tab":   false,
		"dismissible":   false,
		"seasonal_flag": "christmas",
	}
	_, _ = col.InsertOne(context.Background(), doc)
	logger.Info("Seeded seasonal sale banner (disabled by default)")
}

func seedStoreLocations() {
	col := database.DB.Collection("stores")
	count, err := col.CountDocuments(context.Background(), bson.M{})
	if err != nil || count > 0 {
		return
	}
	stores := []models.StoreLocation{
		{
			ID:      primitive.NewObjectID(),
			Name:    "Blue Mist — Dubai Mall",
			Street:  "The Dubai Mall, Ground Floor",
			City:    "Dubai",
			State:   "Dubai",
			Zip:     "",
			Country: "UAE",
			Lat:     25.1972,
			Lng:     55.2744,
			Phone:   "+971 4 339 9000",
			Hours:   "Sun–Wed 10am–10pm, Thu–Sat 10am–12am",
			Active:  true,
		},
		{
			ID:      primitive.NewObjectID(),
			Name:    "Blue Mist — Mall of the Emirates",
			Street:  "Mall of the Emirates, Level 1",
			City:    "Dubai",
			State:   "Dubai",
			Zip:     "",
			Country: "UAE",
			Lat:     25.1193,
			Lng:     55.1971,
			Phone:   "+971 4 409 9000",
			Hours:   "Daily 10am–10pm",
			Active:  true,
		},
		{
			ID:      primitive.NewObjectID(),
			Name:    "Blue Mist — Yas Mall",
			Street:  "Yas Mall, Abu Dhabi",
			City:    "Abu Dhabi",
			State:   "Abu Dhabi",
			Zip:     "",
			Country: "UAE",
			Lat:     24.4884,
			Lng:     54.6100,
			Phone:   "+971 2 565 1000",
			Hours:   "Daily 10am–10pm",
			Active:  true,
		},
	}
	for _, s := range stores {
		_, _ = col.InsertOne(context.Background(), s)
	}
	logger.Info("Seeded store locations (3 shops)")
}
func seedFeatureFlags() {
	col := database.DB.Collection("features")
	count, err := col.CountDocuments(context.Background(), bson.M{"_id": "features"})
	if err != nil || count > 0 {
		return
	}

	defaultWhyItems := []models.WhySectionItem{
		{Title: "Authentic Oud", Description: "Premium agarwood sourced from the finest regions"},
		{Title: "Dubai Crafted", Description: "Hand-blended by master perfumers in the UAE"},
		{Title: "Arabian Heritage", Description: "Timeless fragrances that honour tradition"},
	}

	doc := models.FeatureFlagsDoc{
		ID:                          "features",
		NewArrivalSectionEnabled:    true,
		NewArrivalShopFilterEnabled: true,
		DiscountedSectionEnabled:    true,
		DiscountedShopFilterEnabled: true,
		FeaturedSectionEnabled:      true,
		SeasonalBannerEnabled:       true,
		WhySectionEnabled:           true,
		WhySectionTitle:             "Why Blue Mist Perfumes",
		WhySectionItems:             defaultWhyItems,
		I18nEnabled:                 ptrBool(true),
		StoreLocatorEnabled:         ptrBool(true),
		SocialEnabled:               ptrBool(false),
		PersonalizationEnabled:      ptrBool(false),
		InvoiceCompanyName:          "Blue Mist Perfumes",
		SignupEnabled:               ptrBool(true),
		CategorySectionTitle:        "Shop by Collection",
		CategorySectionLabel:        "Discover Your Scent",
		CategorySectionEnabled:      ptrBool(true),
		MarqueeSectionEnabled:       ptrBool(true),
		MarqueeItemsEn:              []string{"Long Lasting", "Premium Quality", "Cruelty Free"},
		MarqueeItemsAr:              []string{"يدوم طويلاً", "جودة ممتازة", "خالٍ من القسوة"},
		HeroSubtitleEn:              "Signature Egyptian Collection",
		HeroSubtitleAr:              "مجموعة توقيع مصرية",
		HeroTitleEn:                 "BLUE MIST PERFUMES",
		HeroTitleAr:                 "بلو ميست للعطور",
		HeroDescriptionEn:           "Simply put, our perfume is the best. Elevate your presence with our exquisite collection of perfumes and bakhoor.",
		HeroDescriptionAr:           "بعبارة بسيطة، عطرنا هو الأفضل. ارفع حضورك مع مجموعتنا الراقية من العطور والبخور.",
		HeroButtonTextEn:            "Explore Collection",
		HeroButtonTextAr:            "استكشف المجموعة",
		HeroImages:                  []string{"/images/premium-hero.png"},
	}

	_, _ = col.InsertOne(context.Background(), doc)
	logger.Info("Seeded default feature flags")
}

func ptrBool(b bool) *bool { return &b }
