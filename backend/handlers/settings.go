package handlers

import (
	"context"
	"net/http"

	"perfume-store/config"
	"perfume-store/database"
	"perfume-store/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const settingsDocID = "features"

// GetFeatureFlags returns feature flags for the home page (public). Defaults to both enabled if no doc exists.
func GetFeatureFlags(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	col := database.DB.Collection("features")
	var doc models.FeatureFlagsDoc
	err := col.FindOne(context.Background(), bson.M{"_id": settingsDocID}).Decode(&doc)

	defaultWhyItems := []models.WhySectionItem{
		{Title: "Authentic Oud", Description: "Premium agarwood sourced from the finest regions"},
		{Title: "Dubai Crafted", Description: "Hand-blended by master perfumers in the UAE"},
		{Title: "Arabian Heritage", Description: "Timeless fragrances that honour tradition"},
	}

	isSuperAdmin := false
	role, _ := c.Get("user_role")
	if r, ok := role.(string); ok && r == "super_admin" {
		isSuperAdmin = true
	}

	if err != nil {
		// No document yet: return defaults (all enabled)
		resp := gin.H{
			"new_arrival_section_enabled":     true,
			"new_arrival_shop_filter_enabled": true,
			"discounted_section_enabled":      true,
			"discounted_shop_filter_enabled":  true,
			"featured_section_enabled":        true,
			"personalization_enabled":         false,
			"seasonal_banner_enabled":         true,
			"why_section_enabled":             true,
			"why_section_title":               "Why Blue Mist Perfumes",
			"why_section_items":               defaultWhyItems,
			"i18n_enabled":                    true,
			"store_locator_enabled":           true,
			"social_enabled":                  false,
			"social_facebook":                 "", "social_facebook_enabled": true,
			"social_instagram": "", "social_instagram_enabled": true,
			"social_twitter": "", "social_twitter_enabled": true,
			"social_youtube": "", "social_youtube_enabled": true,
			"invoice_company_name": "Blue Mist Perfumes",
			"invoice_street":       "", "invoice_city": "", "invoice_state": "", "invoice_zip": "", "invoice_country": "",
			"invoice_email":              "",
			"invoice_trn":                "",
			"return_days_after_delivery": 0,
			"google_client_id":           config.AppConfig.GoogleClientID,
			"stripe_publishable_key":     config.AppConfig.StripePublishableKey,
			"signup_enabled":             true,
			"category_section_title":     "Shop by Collection",
			"category_section_label":     "Discover Your Scent",
			"hero_subtitle_en":           "Signature Egyptian Collection",
			"hero_subtitle_ar":           "مجموعة توقيع مصرية",
			"hero_title_en":              "BLUE MIST PERFUMES",
			"hero_title_ar":              "بلو ميست للعطور",
			"hero_description_en":        "Simply put, our perfume is the best. Elevate your presence with our exquisite collection of perfumes and bakhoor.",
			"hero_description_ar":        "بعبارة بسيطة، عطرنا هو الأفضل. ارفع حضورك مع مجموعتنا الراقية من العطور والبخور.",
			"hero_button_text_en":        "Explore Collection",
			"hero_button_text_ar":        "استكشف المجموعة",
			"hero_images":                []string{"/images/premium-hero.png"},
		}

		if isSuperAdmin {
			resp["telegram_bot_token"] = ""
			resp["telegram_chat_id"] = ""
		}

		c.JSON(http.StatusOK, resp)
		return
	}

	// Falls backs for existing document with empty values
	if doc.WhySectionItems == nil {
		doc.WhySectionItems = defaultWhyItems
	}
	if doc.WhySectionTitle == "" {
		doc.WhySectionTitle = "Why Blue Mist Perfumes"
	}
	if doc.CategorySectionTitle == "" {
		doc.CategorySectionTitle = "Shop by Collection"
	}
	if doc.CategorySectionLabel == "" {
		doc.CategorySectionLabel = "Discover Your Scent"
	}
	if doc.HeroSubtitleEn == "" {
		doc.HeroSubtitleEn = "Signature Egyptian Collection"
	}
	if doc.HeroSubtitleAr == "" {
		doc.HeroSubtitleAr = "مجموعة توقيع مصرية"
	}
	if doc.HeroTitleEn == "" {
		doc.HeroTitleEn = "BLUE MIST PERFUMES"
	}
	if doc.HeroTitleAr == "" {
		doc.HeroTitleAr = "بلو ميست للعطور"
	}
	if doc.HeroDescriptionEn == "" {
		doc.HeroDescriptionEn = "Simply put, our perfume is the best. Elevate your presence with our exquisite collection of perfumes and bakhoor."
	}
	if doc.HeroDescriptionAr == "" {
		doc.HeroDescriptionAr = "بعبارة بسيطة، عطرنا هو الأفضل. ارفع حضورك مع مجموعتنا الراقية من العطور والبخور."
	}
	if doc.HeroButtonTextEn == "" {
		doc.HeroButtonTextEn = "Explore Collection"
	}
	if doc.HeroButtonTextAr == "" {
		doc.HeroButtonTextAr = "استكشف المجموعة"
	}
	if len(doc.HeroImages) == 0 {
		doc.HeroImages = []string{"/images/premium-hero.png"}
	}

	i18nEnabled := true
	if doc.I18nEnabled != nil {
		i18nEnabled = *doc.I18nEnabled
	}
	storeLocatorEnabled := true
	if doc.StoreLocatorEnabled != nil {
		storeLocatorEnabled = *doc.StoreLocatorEnabled
	}
	socialEnabled := false
	if doc.SocialEnabled != nil {
		socialEnabled = *doc.SocialEnabled
	}
	signupEnabled := true
	if doc.SignupEnabled != nil {
		signupEnabled = *doc.SignupEnabled
	}
	personalizationEnabled := false
	if doc.PersonalizationEnabled != nil {
		personalizationEnabled = *doc.PersonalizationEnabled
	}
	telegramEnabled := false
	if doc.TelegramEnabled != nil {
		telegramEnabled = *doc.TelegramEnabled
	}

	resp := gin.H{
		"new_arrival_section_enabled":     doc.NewArrivalSectionEnabled,
		"new_arrival_shop_filter_enabled": doc.NewArrivalShopFilterEnabled,
		"discounted_section_enabled":      doc.DiscountedSectionEnabled,
		"discounted_shop_filter_enabled":  doc.DiscountedShopFilterEnabled,
		"featured_section_enabled":        doc.FeaturedSectionEnabled,
		"seasonal_banner_enabled":         doc.SeasonalBannerEnabled,
		"why_section_enabled":             doc.WhySectionEnabled,
		"why_section_title":               doc.WhySectionTitle,
		"why_section_items":               doc.WhySectionItems,
		"i18n_enabled":                    i18nEnabled,
		"store_locator_enabled":           storeLocatorEnabled,
		"social_enabled":                  socialEnabled,
		"social_facebook":                 doc.SocialFacebook,
		"social_facebook_enabled":         docSocialPlatformEnabled(doc.SocialFacebookEnabled),
		"social_instagram":                doc.SocialInstagram,
		"social_instagram_enabled":        docSocialPlatformEnabled(doc.SocialInstagramEnabled),
		"social_twitter":                  doc.SocialTwitter,
		"social_twitter_enabled":          docSocialPlatformEnabled(doc.SocialTwitterEnabled),
		"social_youtube":                  doc.SocialYoutube,
		"social_youtube_enabled":          docSocialPlatformEnabled(doc.SocialYoutubeEnabled),
		"invoice_company_name":            invoiceCompanyName(doc.InvoiceCompanyName),
		"invoice_street":                  doc.InvoiceStreet,
		"invoice_city":                    doc.InvoiceCity,
		"invoice_state":                   doc.InvoiceState,
		"invoice_zip":                     doc.InvoiceZip,
		"invoice_country":                 doc.InvoiceCountry,
		"invoice_phone":                   doc.InvoicePhone,
		"invoice_email":                   doc.InvoiceEmail,
		"invoice_trn":                     doc.InvoiceTRN,
		"return_days_after_delivery":      doc.ReturnDaysAfterDelivery,
		"google_client_id":                config.AppConfig.GoogleClientID,
		"stripe_publishable_key":          config.AppConfig.StripePublishableKey,
		"signup_enabled":                  signupEnabled,
		"personalization_enabled":         personalizationEnabled,
		"telegram_enabled":                telegramEnabled,
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
	}

	if isSuperAdmin {
		resp["telegram_bot_token"] = doc.TelegramBotToken
		resp["telegram_chat_id"] = doc.TelegramChatID
	}

	c.JSON(http.StatusOK, resp)
}

// UpdateFeatureFlagsRequest is the body for updating feature flags (super_admin only).
type UpdateFeatureFlagsRequest struct {
	NewArrivalSectionEnabled    *bool                    `json:"new_arrival_section_enabled"`
	NewArrivalShopFilterEnabled *bool                    `json:"new_arrival_shop_filter_enabled"`
	DiscountedSectionEnabled    *bool                    `json:"discounted_section_enabled"`
	DiscountedShopFilterEnabled *bool                    `json:"discounted_shop_filter_enabled"`
	FeaturedSectionEnabled      *bool                    `json:"featured_section_enabled"`
	PersonalizationEnabled      *bool                    `json:"personalization_enabled"`
	SeasonalBannerEnabled       *bool                    `json:"seasonal_banner_enabled"`
	WhySectionEnabled           *bool                    `json:"why_section_enabled"`
	WhySectionTitle             *string                  `json:"why_section_title"`
	WhySectionItems             *[]models.WhySectionItem `json:"why_section_items"`
	I18nEnabled                 *bool                    `json:"i18n_enabled"`
	StoreLocatorEnabled         *bool                    `json:"store_locator_enabled"`
	SocialEnabled               *bool                    `json:"social_enabled"`
	SocialFacebook              *string                  `json:"social_facebook"`
	SocialFacebookEnabled       *bool                    `json:"social_facebook_enabled"`
	SocialInstagram             *string                  `json:"social_instagram"`
	SocialInstagramEnabled      *bool                    `json:"social_instagram_enabled"`
	SocialTwitter               *string                  `json:"social_twitter"`
	SocialTwitterEnabled        *bool                    `json:"social_twitter_enabled"`
	SocialYoutube               *string                  `json:"social_youtube"`
	SocialYoutubeEnabled        *bool                    `json:"social_youtube_enabled"`
	InvoiceCompanyName          *string                  `json:"invoice_company_name"`
	InvoiceStreet               *string                  `json:"invoice_street"`
	InvoiceCity                 *string                  `json:"invoice_city"`
	InvoiceState                *string                  `json:"invoice_state"`
	InvoiceZip                  *string                  `json:"invoice_zip"`
	InvoiceCountry              *string                  `json:"invoice_country"`
	InvoicePhone                *string                  `json:"invoice_phone"`
	InvoiceEmail                *string                  `json:"invoice_email"`
	InvoiceTRN                  *string                  `json:"invoice_trn"`
	ReturnDaysAfterDelivery     *int                     `json:"return_days_after_delivery"`
	SignupEnabled               *bool                    `json:"signup_enabled"`
	TelegramEnabled             *bool                    `json:"telegram_enabled"`
	TelegramBotToken            *string                  `json:"telegram_bot_token"`
	TelegramChatID              *string                  `json:"telegram_chat_id"`
	CategorySectionTitle        *string                  `json:"category_section_title"`
	CategorySectionLabel        *string                  `json:"category_section_label"`
	HeroSubtitleEn              *string                  `json:"hero_subtitle_en"`
	HeroSubtitleAr              *string                  `json:"hero_subtitle_ar"`
	HeroTitleEn                 *string                  `json:"hero_title_en"`
	HeroTitleAr                 *string                  `json:"hero_title_ar"`
	HeroDescriptionEn           *string                  `json:"hero_description_en"`
	HeroDescriptionAr           *string                  `json:"hero_description_ar"`
	HeroButtonTextEn            *string                  `json:"hero_button_text_en"`
	HeroButtonTextAr            *string                  `json:"hero_button_text_ar"`
	HeroImages                  *[]string                `json:"hero_images"`
}

// UpdateFeatureFlags updates feature flags. Only super_admin may call this; route is protected by RequireSuperAdmin. Upserts the document in the features collection.
func UpdateFeatureFlags(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	var req UpdateFeatureFlagsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	col := database.DB.Collection("features")

	// Load existing or use defaults
	var doc models.FeatureFlagsDoc
	err := col.FindOne(context.Background(), bson.M{"_id": settingsDocID}).Decode(&doc)
	defaultWhyItems := []models.WhySectionItem{
		{Title: "Authentic Oud", Description: "Premium agarwood sourced from the finest regions"},
		{Title: "Dubai Crafted", Description: "Hand-blended by master perfumers in the UAE"},
		{Title: "Arabian Heritage", Description: "Timeless fragrances that honour tradition"},
	}
	if err != nil {
		doc = models.FeatureFlagsDoc{
			ID:                          settingsDocID,
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
			InvoiceCompanyName:          "Blue Mist Perfumes",
			SignupEnabled:               ptrBool(true),
		}
	}
	if doc.WhySectionItems == nil {
		doc.WhySectionItems = defaultWhyItems
	}
	if doc.WhySectionTitle == "" {
		doc.WhySectionTitle = "Why Blue Mist Perfumes"
	}
	if req.NewArrivalSectionEnabled != nil {
		doc.NewArrivalSectionEnabled = *req.NewArrivalSectionEnabled
	}
	if req.NewArrivalShopFilterEnabled != nil {
		doc.NewArrivalShopFilterEnabled = *req.NewArrivalShopFilterEnabled
	}
	if req.DiscountedSectionEnabled != nil {
		doc.DiscountedSectionEnabled = *req.DiscountedSectionEnabled
	}
	if req.DiscountedShopFilterEnabled != nil {
		doc.DiscountedShopFilterEnabled = *req.DiscountedShopFilterEnabled
	}
	if req.FeaturedSectionEnabled != nil {
		doc.FeaturedSectionEnabled = *req.FeaturedSectionEnabled
	}
	if req.PersonalizationEnabled != nil {
		v := *req.PersonalizationEnabled
		doc.PersonalizationEnabled = &v
	}
	if req.SeasonalBannerEnabled != nil {
		doc.SeasonalBannerEnabled = *req.SeasonalBannerEnabled
	}
	if req.WhySectionEnabled != nil {
		doc.WhySectionEnabled = *req.WhySectionEnabled
	}
	if req.WhySectionTitle != nil {
		doc.WhySectionTitle = *req.WhySectionTitle
	}
	if req.WhySectionItems != nil {
		doc.WhySectionItems = *req.WhySectionItems
	}
	if req.I18nEnabled != nil {
		v := *req.I18nEnabled
		doc.I18nEnabled = &v
	}
	if req.StoreLocatorEnabled != nil {
		v := *req.StoreLocatorEnabled
		doc.StoreLocatorEnabled = &v
	}
	if req.SocialEnabled != nil {
		v := *req.SocialEnabled
		doc.SocialEnabled = &v
	}
	if req.SocialFacebook != nil {
		doc.SocialFacebook = *req.SocialFacebook
	}
	if req.SocialInstagram != nil {
		doc.SocialInstagram = *req.SocialInstagram
	}
	if req.SocialTwitter != nil {
		doc.SocialTwitter = *req.SocialTwitter
	}
	if req.SocialYoutube != nil {
		doc.SocialYoutube = *req.SocialYoutube
	}
	if req.SocialFacebookEnabled != nil {
		v := *req.SocialFacebookEnabled
		doc.SocialFacebookEnabled = &v
	}
	if req.SocialInstagramEnabled != nil {
		v := *req.SocialInstagramEnabled
		doc.SocialInstagramEnabled = &v
	}
	if req.SocialTwitterEnabled != nil {
		v := *req.SocialTwitterEnabled
		doc.SocialTwitterEnabled = &v
	}
	if req.SocialYoutubeEnabled != nil {
		v := *req.SocialYoutubeEnabled
		doc.SocialYoutubeEnabled = &v
	}
	if req.InvoiceCompanyName != nil {
		doc.InvoiceCompanyName = *req.InvoiceCompanyName
	}
	if req.InvoiceStreet != nil {
		doc.InvoiceStreet = *req.InvoiceStreet
	}
	if req.InvoiceCity != nil {
		doc.InvoiceCity = *req.InvoiceCity
	}
	if req.InvoiceState != nil {
		doc.InvoiceState = *req.InvoiceState
	}
	if req.InvoiceZip != nil {
		doc.InvoiceZip = *req.InvoiceZip
	}
	if req.InvoiceCountry != nil {
		doc.InvoiceCountry = *req.InvoiceCountry
	}
	if req.InvoicePhone != nil {
		doc.InvoicePhone = *req.InvoicePhone
	}
	if req.InvoiceEmail != nil {
		doc.InvoiceEmail = *req.InvoiceEmail
	}
	if req.InvoiceTRN != nil {
		doc.InvoiceTRN = *req.InvoiceTRN
	}
	if req.ReturnDaysAfterDelivery != nil {
		v := *req.ReturnDaysAfterDelivery
		if v < 0 {
			v = 0
		}
		doc.ReturnDaysAfterDelivery = v
	}
	if req.SignupEnabled != nil {
		v := *req.SignupEnabled
		doc.SignupEnabled = &v
	}
	if req.TelegramEnabled != nil {
		v := *req.TelegramEnabled
		doc.TelegramEnabled = &v
	}
	if req.TelegramBotToken != nil {
		doc.TelegramBotToken = *req.TelegramBotToken
	}
	if req.TelegramChatID != nil {
		doc.TelegramChatID = *req.TelegramChatID
	}
	if req.CategorySectionTitle != nil {
		doc.CategorySectionTitle = *req.CategorySectionTitle
	}
	if req.CategorySectionLabel != nil {
		doc.CategorySectionLabel = *req.CategorySectionLabel
	}
	if req.HeroSubtitleEn != nil {
		doc.HeroSubtitleEn = *req.HeroSubtitleEn
	}
	if req.HeroSubtitleAr != nil {
		doc.HeroSubtitleAr = *req.HeroSubtitleAr
	}
	if req.HeroTitleEn != nil {
		doc.HeroTitleEn = *req.HeroTitleEn
	}
	if req.HeroTitleAr != nil {
		doc.HeroTitleAr = *req.HeroTitleAr
	}
	if req.HeroDescriptionEn != nil {
		doc.HeroDescriptionEn = *req.HeroDescriptionEn
	}
	if req.HeroDescriptionAr != nil {
		doc.HeroDescriptionAr = *req.HeroDescriptionAr
	}
	if req.HeroButtonTextEn != nil {
		doc.HeroButtonTextEn = *req.HeroButtonTextEn
	}
	if req.HeroButtonTextAr != nil {
		doc.HeroButtonTextAr = *req.HeroButtonTextAr
	}
	if req.HeroImages != nil {
		doc.HeroImages = *req.HeroImages
	}

	// Apply robust defaults for any remaining empty fields before saving
	if doc.WhySectionTitle == "" {
		doc.WhySectionTitle = "Why Blue Mist Perfumes"
	}
	if doc.CategorySectionTitle == "" {
		doc.CategorySectionTitle = "Shop by Collection"
	}
	if doc.CategorySectionLabel == "" {
		doc.CategorySectionLabel = "Discover Your Scent"
	}
	if doc.HeroSubtitleEn == "" {
		doc.HeroSubtitleEn = "Signature Egyptian Collection"
	}
	if doc.HeroSubtitleAr == "" {
		doc.HeroSubtitleAr = "مجموعة توقيع مصرية"
	}
	if doc.HeroTitleEn == "" {
		doc.HeroTitleEn = "BLUE MIST PERFUMES"
	}
	if doc.HeroTitleAr == "" {
		doc.HeroTitleAr = "بلو ميست للعطور"
	}
	if doc.HeroDescriptionEn == "" {
		doc.HeroDescriptionEn = "Simply put, our perfume is the best. Elevate your presence with our exquisite collection of perfumes and bakhoor."
	}
	if doc.HeroDescriptionAr == "" {
		doc.HeroDescriptionAr = "بعبارة بسيطة، عطرنا هو الأفضل. ارفع حضورك مع مجموعتنا الراقية من العطور والبخور."
	}
	if doc.HeroButtonTextEn == "" {
		doc.HeroButtonTextEn = "Explore Collection"
	}
	if doc.HeroButtonTextAr == "" {
		doc.HeroButtonTextAr = "استكشف المجموعة"
	}
	if len(doc.HeroImages) == 0 {
		doc.HeroImages = []string{"/images/premium-hero.png"}
	}

	opts := options.Update().SetUpsert(true)
	_, err = col.UpdateOne(context.Background(), bson.M{"_id": settingsDocID}, bson.M{"$set": doc}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"new_arrival_section_enabled":     doc.NewArrivalSectionEnabled,
		"new_arrival_shop_filter_enabled": doc.NewArrivalShopFilterEnabled,
		"discounted_section_enabled":      doc.DiscountedSectionEnabled,
		"discounted_shop_filter_enabled":  doc.DiscountedShopFilterEnabled,
		"featured_section_enabled":        doc.FeaturedSectionEnabled,
		"seasonal_banner_enabled":         doc.SeasonalBannerEnabled,
		"why_section_enabled":             doc.WhySectionEnabled,
		"why_section_title":               doc.WhySectionTitle,
		"why_section_items":               doc.WhySectionItems,
		"i18n_enabled":                    docI18nEnabled(doc.I18nEnabled),
		"store_locator_enabled":           docStoreLocatorEnabled(doc.StoreLocatorEnabled),
		"social_enabled":                  docSocialEnabled(doc.SocialEnabled),
		"social_facebook":                 doc.SocialFacebook,
		"social_facebook_enabled":         docSocialPlatformEnabled(doc.SocialFacebookEnabled),
		"social_instagram":                doc.SocialInstagram,
		"social_instagram_enabled":        docSocialPlatformEnabled(doc.SocialInstagramEnabled),
		"social_twitter":                  doc.SocialTwitter,
		"social_twitter_enabled":          docSocialPlatformEnabled(doc.SocialTwitterEnabled),
		"social_youtube":                  doc.SocialYoutube,
		"social_youtube_enabled":          docSocialPlatformEnabled(doc.SocialYoutubeEnabled),
		"invoice_company_name":            invoiceCompanyName(doc.InvoiceCompanyName),
		"invoice_street":                  doc.InvoiceStreet,
		"invoice_city":                    doc.InvoiceCity,
		"invoice_state":                   doc.InvoiceState,
		"invoice_zip":                     doc.InvoiceZip,
		"invoice_country":                 doc.InvoiceCountry,
		"invoice_phone":                   doc.InvoicePhone,
		"invoice_email":                   doc.InvoiceEmail,
		"invoice_trn":                     doc.InvoiceTRN,
		"return_days_after_delivery":      doc.ReturnDaysAfterDelivery,
		"google_client_id":                config.AppConfig.GoogleClientID,
		"stripe_publishable_key":          config.AppConfig.StripePublishableKey,
		"signup_enabled":                  docSignupEnabled(doc.SignupEnabled),
		"personalization_enabled":         docPersonalizationEnabled(doc.PersonalizationEnabled),
		"telegram_enabled":                docTelegramEnabled(doc.TelegramEnabled),
		"telegram_bot_token":              doc.TelegramBotToken,
		"telegram_chat_id":                doc.TelegramChatID,
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
	})
}

func docSocialEnabled(p *bool) bool {
	if p == nil {
		return false
	}
	return *p
}

// docSocialPlatformEnabled: nil = not set, default true (show icon if URL present).
func docSocialPlatformEnabled(p *bool) bool {
	if p == nil {
		return true
	}
	return *p
}

func ptrBool(b bool) *bool { return &b }

func docI18nEnabled(p *bool) bool {
	if p == nil {
		return true
	}
	return *p
}

func docStoreLocatorEnabled(p *bool) bool {
	if p == nil {
		return true
	}
	return *p
}

func invoiceCompanyName(s string) string {
	if s == "" {
		return "Blue Mist Perfumes"
	}
	return s
}

func docSignupEnabled(p *bool) bool {
	if p == nil {
		return true
	}
	return *p
}

// IsSignupEnabled reads the signup_enabled feature flag from the database.
// Returns true (default) if the doc doesn't exist or the field isn't set.
func IsSignupEnabled() bool {
	if database.DB == nil {
		return true
	}
	col := database.DB.Collection("features")
	var doc struct {
		SignupEnabled *bool `bson:"signup_enabled"`
	}
	err := col.FindOne(context.Background(), bson.M{"_id": settingsDocID}).Decode(&doc)
	if err != nil || doc.SignupEnabled == nil {
		return true
	}
	return *doc.SignupEnabled
}

func docTelegramEnabled(p *bool) bool {
	if p == nil {
		return false
	}
	return *p
}

func docPersonalizationEnabled(p *bool) bool {
	if p == nil {
		return false
	}
	return *p
}
