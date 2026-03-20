package models

// WhySectionItem is one bullet in the "Why" section on the home page.
type WhySectionItem struct {
	Title       string `json:"title" bson:"title"`
	Description string `json:"description" bson:"description"`
}

// FeatureFlags is the public response for home and shop toggles.
type FeatureFlags struct {
	NewArrivalSectionEnabled    bool             `json:"new_arrival_section_enabled"`
	NewArrivalShopFilterEnabled bool             `json:"new_arrival_shop_filter_enabled"`
	DiscountedSectionEnabled    bool             `json:"discounted_section_enabled"`
	DiscountedShopFilterEnabled bool             `json:"discounted_shop_filter_enabled"`
	FeaturedSectionEnabled      bool             `json:"featured_section_enabled"`
	PersonalizationEnabled      bool             `json:"personalization_enabled"`
	SeasonalBannerEnabled       bool             `json:"seasonal_banner_enabled"`
	WhySectionEnabled           bool             `json:"why_section_enabled"`
	WhySectionTitle             string           `json:"why_section_title"`
	WhySectionItems             []WhySectionItem `json:"why_section_items"`
	CategorySectionTitle        string           `json:"category_section_title"`
	CategorySectionLabel        string           `json:"category_section_label"`
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
	InvoiceTRN                  string           `json:"invoice_trn"`
	ReturnDaysAfterDelivery     int              `json:"return_days_after_delivery"`
	GoogleClientID              string           `json:"google_client_id"`
	StripePublishableKey        string           `json:"stripe_publishable_key"`
	SignupEnabled               bool             `json:"signup_enabled"`
	TelegramEnabled             bool             `json:"telegram_enabled"`
	TelegramBotToken            string           `json:"telegram_bot_token"`
	TelegramChatID              string           `json:"telegram_chat_id"`
	HeroSubtitleEn              string           `json:"hero_subtitle_en"`
	HeroSubtitleAr              string           `json:"hero_subtitle_ar"`
	HeroTitleEn                 string           `json:"hero_title_en"`
	HeroTitleAr                 string           `json:"hero_title_ar"`
	HeroDescriptionEn           string           `json:"hero_description_en"`
	HeroDescriptionAr           string           `json:"hero_description_ar"`
	HeroButtonTextEn            string           `json:"hero_button_text_en"`
	HeroButtonTextAr            string           `json:"hero_button_text_ar"`
	HeroImages                  []string         `json:"hero_images"`
	CategorySectionEnabled      bool             `json:"category_section_enabled"`
	MarqueeSectionEnabled       bool             `json:"marquee_section_enabled"`
	MarqueeItemsEn              []string         `json:"marquee_items_en"`
	MarqueeItemsAr              []string         `json:"marquee_items_ar"`
}

// FeatureFlagsDoc is the stored document in MongoDB.
type FeatureFlagsDoc struct {
	ID                          string           `bson:"_id"`
	NewArrivalSectionEnabled    bool             `bson:"new_arrival_section_enabled"`
	NewArrivalShopFilterEnabled bool             `bson:"new_arrival_shop_filter_enabled"`
	DiscountedSectionEnabled    bool             `bson:"discounted_section_enabled"`
	DiscountedShopFilterEnabled bool             `bson:"discounted_shop_filter_enabled"`
	FeaturedSectionEnabled      bool             `bson:"featured_section_enabled"`
	PersonalizationEnabled      *bool            `bson:"personalization_enabled,omitempty"`
	SeasonalBannerEnabled       bool             `bson:"seasonal_banner_enabled"`
	WhySectionEnabled           bool             `bson:"why_section_enabled"`
	WhySectionTitle             string           `bson:"why_section_title"`
	WhySectionItems             []WhySectionItem `bson:"why_section_items"`
	CategorySectionTitle        string           `bson:"category_section_title"`
	CategorySectionLabel        string           `bson:"category_section_label"`
	I18nEnabled                 *bool            `bson:"i18n_enabled,omitempty"`
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
	SignupEnabled               *bool            `bson:"signup_enabled,omitempty"`
	TelegramEnabled             *bool            `bson:"telegram_enabled,omitempty"`
	TelegramBotToken            string           `bson:"telegram_bot_token"`
	TelegramChatID              string           `bson:"telegram_chat_id"`
	HeroSubtitleEn              string           `bson:"hero_subtitle_en"`
	HeroSubtitleAr              string           `bson:"hero_subtitle_ar"`
	HeroTitleEn                 string           `bson:"hero_title_en"`
	HeroTitleAr                 string           `bson:"hero_title_ar"`
	HeroDescriptionEn           string           `bson:"hero_description_en"`
	HeroDescriptionAr           string           `bson:"hero_description_ar"`
	HeroButtonTextEn            string           `bson:"hero_button_text_en"`
	HeroButtonTextAr            string           `bson:"hero_button_text_ar"`
	HeroImages                  []string         `bson:"hero_images"`
	CategorySectionEnabled      *bool            `bson:"category_section_enabled,omitempty"`
	MarqueeSectionEnabled       *bool            `bson:"marquee_section_enabled,omitempty"`
	MarqueeItemsEn              []string         `bson:"marquee_items_en"`
	MarqueeItemsAr              []string         `bson:"marquee_items_ar"`
}
