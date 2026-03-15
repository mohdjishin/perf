package handlers

import (
	"context"
	"net/http"
	"sync"

	"perfume-store/database"
	"perfume-store/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const settingsDocIDForHome = "features"

// GetHomePayload returns features plus featured products (6), new arrivals (4), and discounted (4) in one response for the home page.
func GetHomePayload(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	role := c.GetString("user_role")
	activeOnly := role != string(models.RoleAdmin) && role != string(models.RoleSuperAdmin)

	// 1. Features
	features := getFeaturesPayload(c)
	if features == nil {
		return
	}

	// 2. Product lists (featured 6, new arrivals 4, discounted 4) — run in parallel for lower latency
	col := database.DB.Collection("products")
	baseFilter := bson.M{}
	if activeOnly {
		baseFilter["active"] = true
	}
	proj := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetProjection(bson.M{"updated_at": 0})
	ctx := context.Background()

	var featured, newArrivals, discounted []gin.H
	var wg sync.WaitGroup
	wg.Add(3)

	go func() {
		defer wg.Done()
		cursor, err := col.Find(ctx, baseFilter, proj.SetLimit(6))
		if err == nil {
			featured = decodeProductsToItems(cursor)
			cursor.Close(ctx)
		}
	}()
	go func() {
		defer wg.Done()
		f := bson.M{}
		for k, v := range baseFilter {
			f[k] = v
		}
		f["new_arrival"] = true
		cursor, err := col.Find(ctx, f, proj.SetLimit(4))
		if err == nil {
			newArrivals = decodeProductsToItems(cursor)
			cursor.Close(ctx)
		}
	}()
	go func() {
		defer wg.Done()
		f := bson.M{}
		for k, v := range baseFilter {
			f[k] = v
		}
		f["on_sale"] = true
		cursor, err := col.Find(ctx, f, proj.SetLimit(4))
		if err == nil {
			discounted = decodeProductsToItems(cursor)
			cursor.Close(ctx)
		}
	}()
	wg.Wait()

	// Include banner so Home can show it without a second request
	c.JSON(http.StatusOK, gin.H{
		"features":     features,
		"products":     featured,
		"new_arrivals": newArrivals,
		"discounted":   discounted,
		"banner":       getSeasonalBannerPayload(ctx),
	})
}

func getFeaturesPayload(c *gin.Context) gin.H {
	type whyItem struct {
		Title       string `bson:"title"`
		Description string `bson:"description"`
	}
	col := database.DB.Collection("features")
	var doc struct {
		NewArrivalSectionEnabled    bool      `bson:"new_arrival_section_enabled"`
		NewArrivalShopFilterEnabled bool      `bson:"new_arrival_shop_filter_enabled"`
		DiscountedSectionEnabled    bool      `bson:"discounted_section_enabled"`
		DiscountedShopFilterEnabled bool      `bson:"discounted_shop_filter_enabled"`
		FeaturedSectionEnabled      bool      `bson:"featured_section_enabled"`
		SeasonalBannerEnabled       bool      `bson:"seasonal_banner_enabled"`
		WhySectionEnabled           bool      `bson:"why_section_enabled"`
		WhySectionTitle             string    `bson:"why_section_title"`
		WhySectionItems             []whyItem `bson:"why_section_items"`
		I18nEnabled                 *bool     `bson:"i18n_enabled,omitempty"`
		SocialEnabled               *bool     `bson:"social_enabled,omitempty"`
		SocialFacebook              string    `bson:"social_facebook"`
		SocialFacebookEnabled       *bool     `bson:"social_facebook_enabled,omitempty"`
		SocialInstagram             string    `bson:"social_instagram"`
		SocialInstagramEnabled      *bool     `bson:"social_instagram_enabled,omitempty"`
		SocialTwitter               string    `bson:"social_twitter"`
		SocialTwitterEnabled        *bool     `bson:"social_twitter_enabled,omitempty"`
		SocialYoutube               string    `bson:"social_youtube"`
		SocialYoutubeEnabled        *bool     `bson:"social_youtube_enabled,omitempty"`
	}
	defaultWhy := []whyItem{
		{Title: "Authentic Oud", Description: "Premium agarwood sourced from the finest regions"},
		{Title: "Dubai Crafted", Description: "Hand-blended by master perfumers in the UAE"},
		{Title: "Arabian Heritage", Description: "Timeless fragrances that honour tradition"},
	}
	err := col.FindOne(context.Background(), bson.M{"_id": settingsDocIDForHome}).Decode(&doc)
	if err != nil {
		defaultWhyItems := make([]gin.H, len(defaultWhy))
		for i, it := range defaultWhy {
			defaultWhyItems[i] = gin.H{"title": it.Title, "description": it.Description}
		}
		return gin.H{
			"new_arrival_section_enabled": true, "new_arrival_shop_filter_enabled": true,
			"discounted_section_enabled": true, "discounted_shop_filter_enabled": true,
			"featured_section_enabled": true, "seasonal_banner_enabled": true,
			"why_section_enabled": true, "why_section_title": "Why Blue Mist Perfumes",
			"why_section_items": defaultWhyItems,
			"i18n_enabled":      true,
			"social_enabled":    false,
			"social_facebook":   "", "social_facebook_enabled": true,
			"social_instagram": "", "social_instagram_enabled": true,
			"social_twitter": "", "social_twitter_enabled": true,
			"social_youtube": "", "social_youtube_enabled": true,
		}
	}
	if doc.WhySectionItems == nil {
		doc.WhySectionItems = defaultWhy
	}
	if doc.WhySectionTitle == "" {
		doc.WhySectionTitle = "Why Blue Mist Perfumes"
	}
	// Serialize why items with lowercase keys so frontend gets "title" and "description"
	whyItems := make([]gin.H, len(doc.WhySectionItems))
	for i, it := range doc.WhySectionItems {
		whyItems[i] = gin.H{"title": it.Title, "description": it.Description}
	}
	i18nEnabled := true
	if doc.I18nEnabled != nil {
		i18nEnabled = *doc.I18nEnabled
	}
	socialEnabled := false
	if doc.SocialEnabled != nil {
		socialEnabled = *doc.SocialEnabled
	}
	socialPlatformEnabled := func(p *bool) bool {
		if p == nil {
			return true
		}
		return *p
	}
	return gin.H{
		"new_arrival_section_enabled":     doc.NewArrivalSectionEnabled,
		"new_arrival_shop_filter_enabled": doc.NewArrivalShopFilterEnabled,
		"discounted_section_enabled":      doc.DiscountedSectionEnabled,
		"discounted_shop_filter_enabled":  doc.DiscountedShopFilterEnabled,
		"featured_section_enabled":        doc.FeaturedSectionEnabled,
		"seasonal_banner_enabled":         doc.SeasonalBannerEnabled,
		"why_section_enabled":             doc.WhySectionEnabled,
		"why_section_title":               doc.WhySectionTitle,
		"why_section_items":               whyItems,
		"i18n_enabled":                    i18nEnabled,
		"social_enabled":                  socialEnabled,
		"social_facebook":                 doc.SocialFacebook,
		"social_facebook_enabled":         socialPlatformEnabled(doc.SocialFacebookEnabled),
		"social_instagram":                doc.SocialInstagram,
		"social_instagram_enabled":        socialPlatformEnabled(doc.SocialInstagramEnabled),
		"social_twitter":                  doc.SocialTwitter,
		"social_twitter_enabled":          socialPlatformEnabled(doc.SocialTwitterEnabled),
		"social_youtube":                  doc.SocialYoutube,
		"social_youtube_enabled":          socialPlatformEnabled(doc.SocialYoutubeEnabled),
	}
}

func decodeProductsToItems(cursor *mongo.Cursor) []gin.H {
	var products []struct {
		ID              primitive.ObjectID `bson:"_id"`
		Name            string             `bson:"name"`
		NameAr          string             `bson:"name_ar"`
		Description     string             `bson:"description"`
		DescriptionAr   string             `bson:"description_ar"`
		Price           float64            `bson:"price"`
		ImageURL        string             `bson:"image_url"`
		Category        string             `bson:"category"`
		Audience        string             `bson:"audience"`
		NewArrival      bool               `bson:"new_arrival"`
		OnSale          bool               `bson:"on_sale"`
		DiscountPercent int                `bson:"discount_percent"`
		Stock           int                `bson:"stock"`
		SeasonalFlag    string             `bson:"seasonal_flag"`
		Active          bool               `bson:"active"`
	}
	if cursor == nil || cursor.All(context.Background(), &products) != nil {
		return nil
	}
	items := make([]gin.H, len(products))
	for i, p := range products {
		items[i] = gin.H{
			"id": p.ID.Hex(), "name": p.Name, "nameAr": p.NameAr, "description": p.Description, "descriptionAr": p.DescriptionAr,
			"price": p.Price, "imageUrl": p.ImageURL, "category": p.Category,
			"audience": p.Audience, "newArrival": p.NewArrival, "onSale": p.OnSale,
			"discountPercent": p.DiscountPercent, "stock": p.Stock,
			"seasonalFlag": p.SeasonalFlag, "active": p.Active,
		}
	}
	return items
}
