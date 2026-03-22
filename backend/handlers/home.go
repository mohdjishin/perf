package handlers

import (
	"context"
	"net/http"
	"sync"
	"time"

	"perfume-store/config"
	"perfume-store/database"

	"perfume-store/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const settingsDocIDForHome = "features"

var (
	GlobalHomeCacheEnabled bool = true
	globalSettingsMu       sync.RWMutex
)

// SyncGlobalSettings updates the global settings from the database.
func SyncGlobalSettings() {
	if database.DB == nil {
		return
	}
	col := database.DB.Collection("features")
	var doc struct {
		HomeCacheEnabled *bool `bson:"home_cache_enabled"`
	}
	err := col.FindOne(context.Background(), bson.M{"_id": settingsDocIDForHome}).Decode(&doc)
	enabled := true
	if err == nil && doc.HomeCacheEnabled != nil {
		enabled = *doc.HomeCacheEnabled
	}

	globalSettingsMu.Lock()
	GlobalHomeCacheEnabled = enabled
	globalSettingsMu.Unlock()
}

type WhyItem struct {
	Title       string `bson:"title" json:"title"`
	Description string `bson:"description" json:"description"`
}

type HomeData struct {
	Features    gin.H   `json:"features"`
	Products    []gin.H `json:"products,omitempty"`
	NewArrivals []gin.H `json:"new_arrivals,omitempty"`
	Discounted  []gin.H `json:"discounted,omitempty"`
	Categories  []gin.H `json:"categories,omitempty"`
	Banner      gin.H   `json:"banner,omitempty"`
}

var HomeCache = utils.NewMemoryCache[HomeData]()

// GetHomePayload returns features plus featured products, new arrivals, and discounted products.
// It uses an in-memory cache with configurable TTL and singleflight protection to prevent stampedes.
func GetHomePayload(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	activeOnly := true
	if c.Query("admin") == "true" {
		activeOnly = false
	}

	// 0. Cache Selection
	cacheKey := "home_data_public"
	if !activeOnly {
		cacheKey = "home_data_admin"
	}

	globalSettingsMu.RLock()
	cacheEnabled := GlobalHomeCacheEnabled
	globalSettingsMu.RUnlock()

	ttl := time.Duration(config.AppConfig.HomeCacheTTL) * time.Second

	var payload HomeData
	var err error

	if cacheEnabled && ttl > 0 {
		payload, err = HomeCache.GetOrSet(cacheKey, ttl, func() (HomeData, error) {
			return fetchHomeDataFromDB(c, activeOnly)
		})
	} else {
		payload, err = fetchHomeDataFromDB(c, activeOnly)
	}

	if err != nil {
		if err == context.Canceled {
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, payload)
}

// fetchHomeDataFromDB is the core logic that fetches all enabled sections for the home page.
func fetchHomeDataFromDB(c *gin.Context, activeOnly bool) (HomeData, error) {
	// 1. Fetch Features first - we need them to decide what else to fetch
	features := getFeaturesPayload(c)
	if features == nil {
		return HomeData{}, context.Canceled
	}

	isEnabled := func(key string) bool {
		if val, ok := features[key]; ok {
			if b, ok := val.(bool); ok {
				return b
			}
		}
		return false
	}

	ctx := c.Request.Context()
	col := database.DB.Collection("products")
	baseFilter := bson.M{}
	if activeOnly {
		baseFilter["active"] = true
	}

	var featured, newArrivals, discounted []gin.H
	var homeCategories []gin.H
	var banner gin.H
	var wg sync.WaitGroup

	// 2. Conditionally fetch based on features
	if isEnabled("featured_section_enabled") {
		wg.Add(1)
		go func() {
			defer wg.Done()
			cursor, err := col.Find(ctx, baseFilter, options.Find().SetLimit(6).SetSort(bson.D{{Key: "rating", Value: -1}}).SetProjection(bson.M{"updated_at": 0}))
			if err == nil {
				featured = decodeProductsToItems(cursor)
				cursor.Close(ctx)
			}
		}()
	}

	if isEnabled("new_arrival_section_enabled") {
		wg.Add(1)
		go func() {
			defer wg.Done()
			naFilter := bson.M{}
			for k, v := range baseFilter {
				naFilter[k] = v
			}
			naFilter["new_arrival"] = true
			cursor, err := col.Find(ctx, naFilter, options.Find().SetLimit(4).SetSort(bson.D{{Key: "created_at", Value: -1}}).SetProjection(bson.M{"updated_at": 0}))
			if err == nil {
				newArrivals = decodeProductsToItems(cursor)
				cursor.Close(ctx)
			}
		}()
	}

	if isEnabled("discounted_section_enabled") {
		wg.Add(1)
		go func() {
			defer wg.Done()
			saleFilter := bson.M{}
			for k, v := range baseFilter {
				saleFilter[k] = v
			}
			saleFilter["on_sale"] = true
			cursor, err := col.Find(ctx, saleFilter, options.Find().SetLimit(4).SetSort(bson.D{{Key: "discount_percent", Value: -1}}).SetProjection(bson.M{"updated_at": 0}))
			if err == nil {
				discounted = decodeProductsToItems(cursor)
				cursor.Close(ctx)
			}
		}()
	}

	if isEnabled("category_section_enabled") {
		wg.Add(1)
		go func() {
			defer wg.Done()
			catCol := database.DB.Collection("categories")
			cursor, err := catCol.Find(ctx, bson.M{}, options.Find().SetLimit(10))
			if err == nil {
				var cats []struct {
					ID       primitive.ObjectID `bson:"_id"`
					Name     string             `bson:"name"`
					ImageURL string             `bson:"image_url"`
				}
				if cursor.All(ctx, &cats) == nil {
					homeCategories = make([]gin.H, len(cats))
					for i, cat := range cats {
						homeCategories[i] = gin.H{
							"id":       cat.ID.Hex(),
							"name":     cat.Name,
							"imageUrl": cat.ImageURL,
						}
					}
				}
				cursor.Close(ctx)
			}
		}()
	}

	if isEnabled("seasonal_banner_enabled") {
		banner = getSeasonalBannerPayload(ctx)
	}

	wg.Wait()

	return HomeData{
		Features:    features,
		Products:    featured,
		NewArrivals: newArrivals,
		Discounted:  discounted,
		Categories:  homeCategories,
		Banner:      banner,
	}, nil
}

func getFeaturesPayload(c *gin.Context) gin.H {
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
		WhySectionItems             []WhyItem `bson:"why_section_items"`
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
		CategorySectionTitle        string    `bson:"category_section_title"`
		CategorySectionLabel        string    `bson:"category_section_label"`
		HeroSubtitleEn              string    `bson:"hero_subtitle_en"`
		HeroSubtitleAr              string    `bson:"hero_subtitle_ar"`
		HeroTitleEn                 string    `bson:"hero_title_en"`
		HeroTitleAr                 string    `bson:"hero_title_ar"`
		HeroDescriptionEn           string    `bson:"hero_description_en"`
		HeroDescriptionAr           string    `bson:"hero_description_ar"`
		HeroButtonTextEn            string    `bson:"hero_button_text_en"`
		HeroButtonTextAr            string    `bson:"hero_button_text_ar"`
		HeroImages                  []string  `bson:"hero_images"`
		CategorySectionEnabled      *bool     `bson:"category_section_enabled,omitempty"`
		MarqueeSectionEnabled       *bool     `bson:"marquee_section_enabled,omitempty"`
		MarqueeItemsEn              []string  `bson:"marquee_items_en"`
		MarqueeItemsAr              []string  `bson:"marquee_items_ar"`
		HomeCacheEnabled            *bool     `bson:"home_cache_enabled,omitempty"`
	}
	defaultWhy := []WhyItem{
		{Title: "Authentic Oud", Description: "Premium agarwood sourced from the finest regions"},
		{Title: "Dubai Crafted", Description: "Hand-blended by master perfumers in the UAE"},
		{Title: "Arabian Heritage", Description: "Timeless fragrances that honour tradition"},
	}
	err := col.FindOne(context.Background(), bson.M{"_id": settingsDocIDForHome}).Decode(&doc)
	if err != nil {
		return gin.H{
			"new_arrival_section_enabled": true, "new_arrival_shop_filter_enabled": true,
			"discounted_section_enabled": true, "discounted_shop_filter_enabled": true,
			"featured_section_enabled": true, "seasonal_banner_enabled": true,
			"why_section_enabled": true, "why_section_title": "Why Blue Mist Perfumes",
			"why_section_items": defaultWhy,
			"i18n_enabled":      true,
			"social_enabled":    false,
			"social_facebook":   "", "social_facebook_enabled": true,
			"social_instagram": "", "social_instagram_enabled": true,
			"social_twitter": "", "social_twitter_enabled": true,
			"social_youtube": "", "social_youtube_enabled": true,
			"category_section_title":   "Shop by Collection",
			"category_section_label":   "Discover Your Scent",
			"hero_subtitle_en":         "Signature Egyptian Collection",
			"hero_subtitle_ar":         "مجموعة توقيع مصرية",
			"hero_title_en":            "BLUE MIST PERFUMES",
			"hero_title_ar":            "بلو ميست للعطور",
			"hero_description_en":      "Simply put, our perfume is the best. Elevate your presence with our exquisite collection of perfumes and bakhoor.",
			"hero_description_ar":      "بعبارة بسيطة، عطرنا هو الأفضل. ارفع حضورك مع مجموعتنا الراقية من العطور والبخور.",
			"hero_button_text_en":      "Explore Collection",
			"hero_button_text_ar":      "استكشف المجموعة",
			"hero_images":              []string{"/images/premium-hero.png"},
			"category_section_enabled": true,
			"marquee_section_enabled":  true,
			"marquee_items_en":         []string{"Long Lasting", "Premium Quality", "Cruelty Free"},
			"marquee_items_ar":         []string{"يدوم طويلاً", "جودة ممتازة", "خالٍ من القسوة"},
			"home_cache_enabled":       true,
		}
	}
	if doc.WhySectionItems == nil {
		doc.WhySectionItems = defaultWhy
	}
	if doc.WhySectionTitle == "" {
		doc.WhySectionTitle = "Why Blue Mist Perfumes"
	}

	i18nEn := true
	if doc.I18nEnabled != nil {
		i18nEn = *doc.I18nEnabled
	}
	socialEn := false
	if doc.SocialEnabled != nil {
		socialEn = *doc.SocialEnabled
	}
	socialPlatformEnabled := func(p *bool) bool {
		if p == nil {
			return true
		}
		return *p
	}
	categorySectionEnabled := true
	if doc.CategorySectionEnabled != nil {
		categorySectionEnabled = *doc.CategorySectionEnabled
	}
	marqueeSectionEnabled := true
	if doc.MarqueeSectionEnabled != nil {
		marqueeSectionEnabled = *doc.MarqueeSectionEnabled
	}
	homeCacheEnabled := true
	if doc.HomeCacheEnabled != nil {
		homeCacheEnabled = *doc.HomeCacheEnabled
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
		"why_section_items":               doc.WhySectionItems,
		"i18n_enabled":                    i18nEn,
		"social_enabled":                  socialEn,
		"social_facebook":                 doc.SocialFacebook,
		"social_facebook_enabled":         socialPlatformEnabled(doc.SocialFacebookEnabled),
		"social_instagram":                doc.SocialInstagram,
		"social_instagram_enabled":        socialPlatformEnabled(doc.SocialInstagramEnabled),
		"social_twitter":                  doc.SocialTwitter,
		"social_twitter_enabled":          socialPlatformEnabled(doc.SocialTwitterEnabled),
		"social_youtube":                  doc.SocialYoutube,
		"social_youtube_enabled":          socialPlatformEnabled(doc.SocialYoutubeEnabled),
		"category_section_title":          doc.CategorySectionTitle,
		"category_section_label":          doc.CategorySectionLabel,
		"hero_subtitle_en":                doc.HeroSubtitleEn,
		"hero_subtitle_ar":                doc.HeroSubtitleAr,
		"hero_title_en":                   doc.HeroTitleEn,
		"hero_title_ar":                   doc.HeroTitleAr,
		"hero_description_en":             doc.HeroDescriptionEn,
		"hero_description_ar":             doc.HeroDescriptionAr,
		"hero_button_text_en":             doc.HeroButtonTextEn,
		"hero_button_text_ar":             doc.HeroButtonTextAr,
		"hero_images":                     doc.HeroImages,
		"category_section_enabled":        categorySectionEnabled,
		"marquee_section_enabled":         marqueeSectionEnabled,
		"marquee_items_en":                docMarqueeItemsEn(doc.MarqueeItemsEn),
		"marquee_items_ar":                docMarqueeItemsAr(doc.MarqueeItemsAr),
		"home_cache_enabled":              homeCacheEnabled,
	}
}

func docMarqueeItemsEn(s []string) []string {
	if len(s) == 0 {
		return []string{"Long Lasting", "Premium Quality", "Cruelty Free"}
	}
	return s
}

func docMarqueeItemsAr(s []string) []string {
	if len(s) == 0 {
		return []string{"يدوم طويلاً", "جودة ممتازة", "خالٍ من القسوة"}
	}
	return s
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
