package handlers

import (
	"context"
	"net/http"

	"perfume-store/config"
	"perfume-store/database"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const settingsDocID = "features"

// WhySectionItem is one bullet in the "Why" section on the home page.
type WhySectionItem struct {
	Title       string `json:"title" bson:"title"`
	Description string `json:"description" bson:"description"`
}

// FeatureFlags is the public response for home and shop toggles (for documentation).
type FeatureFlags struct {
	NewArrivalSectionEnabled    bool             `json:"new_arrival_section_enabled"`
	NewArrivalShopFilterEnabled bool             `json:"new_arrival_shop_filter_enabled"`
	DiscountedSectionEnabled    bool             `json:"discounted_section_enabled"`
	DiscountedShopFilterEnabled bool             `json:"discounted_shop_filter_enabled"`
	FeaturedSectionEnabled      bool             `json:"featured_section_enabled"`
	SeasonalBannerEnabled       bool             `json:"seasonal_banner_enabled"`
	WhySectionEnabled           bool             `json:"why_section_enabled"`
	WhySectionTitle             string           `json:"why_section_title"`
	WhySectionItems             []WhySectionItem `json:"why_section_items"`
	I18nEnabled                 bool             `json:"i18n_enabled"`
	StoreLocatorEnabled         bool             `json:"store_locator_enabled"`
	SocialEnabled               bool             `json:"social_enabled"`
	SocialFacebook              string           `json:"social_facebook"`
	SocialFacebookEnabled       bool             `json:"social_facebook_enabled"`
	SocialInstagram             string           `json:"social_instagram"`
	SocialInstagramEnabled      bool             `json:"social_instagram_enabled"`
	SocialTwitter               string           `json:"social_twitter"`
	SocialTwitterEnabled        bool             `json:"social_twitter_enabled"`
	SocialYoutube               string           `json:"social_youtube"`
	SocialYoutubeEnabled        bool             `json:"social_youtube_enabled"`
	InvoiceCompanyName          string           `json:"invoice_company_name"`
	InvoiceStreet               string           `json:"invoice_street"`
	InvoiceCity                 string           `json:"invoice_city"`
	InvoiceState                string           `json:"invoice_state"`
	InvoiceZip                  string           `json:"invoice_zip"`
	InvoiceCountry              string           `json:"invoice_country"`
	InvoicePhone                string           `json:"invoice_phone"`
	InvoiceEmail                string           `json:"invoice_email"`
	InvoiceTRN                  string           `json:"invoice_trn"`                // Tax Registration Number for invoices
	ReturnDaysAfterDelivery     int              `json:"return_days_after_delivery"` // 0 = no returns; N = customer can return within N days after delivery
	GoogleClientID              string           `json:"google_client_id"`
	StripePublishableKey        string           `json:"stripe_publishable_key"`
	SignupEnabled               bool             `json:"signup_enabled"`
}

// featureFlagsDoc is the stored document in MongoDB.
type featureFlagsDoc struct {
	ID                          string           `bson:"_id"`
	NewArrivalSectionEnabled    bool             `bson:"new_arrival_section_enabled"`
	NewArrivalShopFilterEnabled bool             `bson:"new_arrival_shop_filter_enabled"`
	DiscountedSectionEnabled    bool             `bson:"discounted_section_enabled"`
	DiscountedShopFilterEnabled bool             `bson:"discounted_shop_filter_enabled"`
	FeaturedSectionEnabled      bool             `bson:"featured_section_enabled"`
	SeasonalBannerEnabled       bool             `bson:"seasonal_banner_enabled"`
	WhySectionEnabled           bool             `bson:"why_section_enabled"`
	WhySectionTitle             string           `bson:"why_section_title"`
	WhySectionItems             []WhySectionItem `bson:"why_section_items"`
	I18nEnabled                 *bool            `bson:"i18n_enabled,omitempty"` // nil = not set, default true
	StoreLocatorEnabled         *bool            `bson:"store_locator_enabled,omitempty"`
	SocialEnabled               *bool            `bson:"social_enabled,omitempty"`
	SocialFacebook              string           `bson:"social_facebook"`
	SocialFacebookEnabled       *bool            `bson:"social_facebook_enabled,omitempty"`
	SocialInstagram             string           `bson:"social_instagram"`
	SocialInstagramEnabled      *bool            `bson:"social_instagram_enabled,omitempty"`
	SocialTwitter               string           `bson:"social_twitter"`
	SocialTwitterEnabled        *bool            `bson:"social_twitter_enabled,omitempty"`
	SocialYoutube               string           `bson:"social_youtube"`
	SocialYoutubeEnabled        *bool            `bson:"social_youtube_enabled,omitempty"`
	InvoiceCompanyName          string           `bson:"invoice_company_name"`
	InvoiceStreet               string           `bson:"invoice_street"`
	InvoiceCity                 string           `bson:"invoice_city"`
	InvoiceState                string           `bson:"invoice_state"`
	InvoiceZip                  string           `bson:"invoice_zip"`
	InvoiceCountry              string           `bson:"invoice_country"`
	InvoicePhone                string           `bson:"invoice_phone"`
	InvoiceEmail                string           `bson:"invoice_email"`
	InvoiceTRN                  string           `bson:"invoice_trn"`
	ReturnDaysAfterDelivery     int              `bson:"return_days_after_delivery"`
	SignupEnabled               *bool            `bson:"signup_enabled,omitempty"` // nil = not set, default true
}

// GetFeatureFlags returns feature flags for the home page (public). Defaults to both enabled if no doc exists.
func GetFeatureFlags(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	col := database.DB.Collection("features")
	var doc featureFlagsDoc
	err := col.FindOne(context.Background(), bson.M{"_id": settingsDocID}).Decode(&doc)
	defaultWhyItems := []WhySectionItem{
		{Title: "Authentic Oud", Description: "Premium agarwood sourced from the finest regions"},
		{Title: "Dubai Crafted", Description: "Hand-blended by master perfumers in the UAE"},
		{Title: "Arabian Heritage", Description: "Timeless fragrances that honour tradition"},
	}
	if err != nil {
		// No document yet: return defaults (all enabled)
		c.JSON(http.StatusOK, gin.H{
			"new_arrival_section_enabled":     true,
			"new_arrival_shop_filter_enabled": true,
			"discounted_section_enabled":      true,
			"discounted_shop_filter_enabled":  true,
			"featured_section_enabled":        true,
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
		})
		return
	}
	if doc.WhySectionItems == nil {
		doc.WhySectionItems = defaultWhyItems
	}
	if doc.WhySectionTitle == "" {
		doc.WhySectionTitle = "Why Blue Mist Perfumes"
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
	})
}

// UpdateFeatureFlagsRequest is the body for updating feature flags (super_admin only).
type UpdateFeatureFlagsRequest struct {
	NewArrivalSectionEnabled    *bool             `json:"new_arrival_section_enabled"`
	NewArrivalShopFilterEnabled *bool             `json:"new_arrival_shop_filter_enabled"`
	DiscountedSectionEnabled    *bool             `json:"discounted_section_enabled"`
	DiscountedShopFilterEnabled *bool             `json:"discounted_shop_filter_enabled"`
	FeaturedSectionEnabled      *bool             `json:"featured_section_enabled"`
	SeasonalBannerEnabled       *bool             `json:"seasonal_banner_enabled"`
	WhySectionEnabled           *bool             `json:"why_section_enabled"`
	WhySectionTitle             *string           `json:"why_section_title"`
	WhySectionItems             *[]WhySectionItem `json:"why_section_items"`
	I18nEnabled                 *bool             `json:"i18n_enabled"`
	StoreLocatorEnabled         *bool             `json:"store_locator_enabled"`
	SocialEnabled               *bool             `json:"social_enabled"`
	SocialFacebook              *string           `json:"social_facebook"`
	SocialFacebookEnabled       *bool             `json:"social_facebook_enabled"`
	SocialInstagram             *string           `json:"social_instagram"`
	SocialInstagramEnabled      *bool             `json:"social_instagram_enabled"`
	SocialTwitter               *string           `json:"social_twitter"`
	SocialTwitterEnabled        *bool             `json:"social_twitter_enabled"`
	SocialYoutube               *string           `json:"social_youtube"`
	SocialYoutubeEnabled        *bool             `json:"social_youtube_enabled"`
	InvoiceCompanyName          *string           `json:"invoice_company_name"`
	InvoiceStreet               *string           `json:"invoice_street"`
	InvoiceCity                 *string           `json:"invoice_city"`
	InvoiceState                *string           `json:"invoice_state"`
	InvoiceZip                  *string           `json:"invoice_zip"`
	InvoiceCountry              *string           `json:"invoice_country"`
	InvoicePhone                *string           `json:"invoice_phone"`
	InvoiceEmail                *string           `json:"invoice_email"`
	InvoiceTRN                  *string           `json:"invoice_trn"`
	ReturnDaysAfterDelivery     *int              `json:"return_days_after_delivery"`
	SignupEnabled               *bool             `json:"signup_enabled"`
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
	var doc featureFlagsDoc
	err := col.FindOne(context.Background(), bson.M{"_id": settingsDocID}).Decode(&doc)
	defaultWhyItems := []WhySectionItem{
		{Title: "Authentic Oud", Description: "Premium agarwood sourced from the finest regions"},
		{Title: "Dubai Crafted", Description: "Hand-blended by master perfumers in the UAE"},
		{Title: "Arabian Heritage", Description: "Timeless fragrances that honour tradition"},
	}
	if err != nil {
		doc = featureFlagsDoc{
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
