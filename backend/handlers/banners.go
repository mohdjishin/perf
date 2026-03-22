package handlers

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"time"

	"perfume-store/database"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const seasonalSaleDocID = "seasonal_sale"

// seasonalSaleDoc is the stored document in the banners collection.
type seasonalSaleDoc struct {
	ID           string `bson:"_id"`
	Enabled      bool   `bson:"enabled"`
	Headline     string `bson:"headline"`
	Subheadline  string `bson:"subheadline"`
	CTAText      string `bson:"cta_text"`
	StartDate    string `bson:"start_date"`
	EndDate      string `bson:"end_date"`
	ImageURL     string `bson:"image_url"`
	Theme        string `bson:"theme"`         // "light" | "dark"
	ShowOn       string `bson:"show_on"`       // "both" | "home" | "shop"
	CTANewTab    bool   `bson:"cta_new_tab"`   // open CTA link in new tab
	Dismissible  bool   `bson:"dismissible"`   // visitors can close banner; hidden for 24h after dismiss
	SeasonalFlag string `bson:"seasonal_flag"` // e.g. "christmas" — CTA links to /shop?seasonal=<flag>
}

// getSeasonalBannerPayload returns the seasonal banner config (for /banners/seasonal-sale and for embedding in /home). Caller handles DB nil.
func getSeasonalBannerPayload(ctx context.Context) gin.H {
	if database.DB == nil {
		return gin.H{"active": false}
	}
	col := database.DB.Collection("banners")
	var doc seasonalSaleDoc
	if col.FindOne(ctx, bson.M{"_id": seasonalSaleDocID}).Decode(&doc) != nil {
		return gin.H{"active": false}
	}
	active := doc.Enabled
	if active && (doc.StartDate != "" || doc.EndDate != "") {
		now := time.Now().UTC().Format("2006-01-02")
		if doc.StartDate != "" && now < doc.StartDate {
			active = false
		}
		if doc.EndDate != "" && now > doc.EndDate {
			active = false
		}
	}
	featuresCol := database.DB.Collection("features")
	var featuresDoc struct {
		SeasonalBannerEnabled bool `bson:"seasonal_banner_enabled"`
	}
	if featuresCol.FindOne(ctx, bson.M{"_id": "features"}).Decode(&featuresDoc) == nil && !featuresDoc.SeasonalBannerEnabled {
		active = false
	}
	resp := gin.H{
		"active":        active,
		"enabled":       doc.Enabled,
		"headline":      doc.Headline,
		"subheadline":   doc.Subheadline,
		"cta_text":      doc.CTAText,
		"start_date":    doc.StartDate,
		"end_date":      doc.EndDate,
		"image_url":     doc.ImageURL,
		"theme":         doc.Theme,
		"show_on":       doc.ShowOn,
		"cta_new_tab":   doc.CTANewTab,
		"dismissible":   doc.Dismissible,
		"seasonal_flag": doc.SeasonalFlag,
	}
	if doc.Theme == "" {
		resp["theme"] = "dark"
	}
	if doc.ShowOn == "" {
		resp["show_on"] = "both"
	}
	ctaURL := "/shop"
	if doc.SeasonalFlag != "" {
		ctaURL = "/shop?seasonal=" + url.QueryEscape(doc.SeasonalFlag)
	}
	resp["cta_url"] = ctaURL
	return resp
}

// GetSeasonalSaleBanner returns the seasonal sale banner config (public). active is true only when enabled and within date range.
func GetSeasonalSaleBanner(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	c.JSON(http.StatusOK, getSeasonalBannerPayload(c.Request.Context()))
}

// UpdateSeasonalSaleRequest is the body for updating the seasonal sale banner (super_admin only).
type UpdateSeasonalSaleRequest struct {
	Enabled      *bool   `json:"enabled"`
	Headline     *string `json:"headline"`
	Subheadline  *string `json:"subheadline"`
	CTAText      *string `json:"cta_text"`
	StartDate    *string `json:"start_date"`
	EndDate      *string `json:"end_date"`
	ImageURL     *string `json:"image_url"`
	Theme        *string `json:"theme"`
	ShowOn       *string `json:"show_on"`       // "both" | "home" | "shop"
	CTANewTab    *bool   `json:"cta_new_tab"`   // open CTA in new tab
	Dismissible  *bool   `json:"dismissible"`   // allow visitors to close banner
	SeasonalFlag *string `json:"seasonal_flag"` // e.g. "christmas" — CTA becomes /shop?seasonal=<flag>
}

// UpdateSeasonalSaleBanner updates the seasonal sale banner (super_admin only).
func UpdateSeasonalSaleBanner(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	var req UpdateSeasonalSaleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	col := database.DB.Collection("banners")
	var doc seasonalSaleDoc
	err := col.FindOne(context.Background(), bson.M{"_id": seasonalSaleDocID}).Decode(&doc)
	if err != nil {
		doc = seasonalSaleDoc{ID: seasonalSaleDocID, Theme: "dark", ShowOn: "both"}
	}
	if req.Enabled != nil {
		doc.Enabled = *req.Enabled
	}
	if req.Headline != nil {
		doc.Headline = *req.Headline
	}
	if req.Subheadline != nil {
		doc.Subheadline = *req.Subheadline
	}
	if req.CTAText != nil {
		doc.CTAText = *req.CTAText
	}
	if req.StartDate != nil {
		doc.StartDate = *req.StartDate
	}
	if req.EndDate != nil {
		doc.EndDate = *req.EndDate
	}
	if req.ImageURL != nil {
		doc.ImageURL = *req.ImageURL
	}
	if req.Theme != nil {
		t := *req.Theme
		if t != "light" && t != "dark" {
			t = "dark"
		}
		doc.Theme = t
	}
	if req.ShowOn != nil {
		s := *req.ShowOn
		if s != "home" && s != "shop" {
			s = "both"
		}
		doc.ShowOn = s
	}
	if req.CTANewTab != nil {
		doc.CTANewTab = *req.CTANewTab
	}
	if req.Dismissible != nil {
		doc.Dismissible = *req.Dismissible
	}
	if req.SeasonalFlag != nil {
		doc.SeasonalFlag = strings.TrimSpace(*req.SeasonalFlag)
	}
	opts := options.Update().SetUpsert(true)
	_, err = col.UpdateOne(context.Background(), bson.M{"_id": seasonalSaleDocID}, bson.M{"$set": doc}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	HomeCache.Clear() // Invalidate home cache
	active := doc.Enabled
	if active && (doc.StartDate != "" || doc.EndDate != "") {
		now := time.Now().UTC().Format("2006-01-02")
		if doc.StartDate != "" && now < doc.StartDate {
			active = false
		}
		if doc.EndDate != "" && now > doc.EndDate {
			active = false
		}
	}
	ctaURL := "/shop"
	if doc.SeasonalFlag != "" {
		ctaURL = "/shop?seasonal=" + url.QueryEscape(doc.SeasonalFlag)
	}
	c.JSON(http.StatusOK, gin.H{
		"active":        active,
		"enabled":       doc.Enabled,
		"headline":      doc.Headline,
		"subheadline":   doc.Subheadline,
		"cta_text":      doc.CTAText,
		"cta_url":       ctaURL,
		"start_date":    doc.StartDate,
		"end_date":      doc.EndDate,
		"image_url":     doc.ImageURL,
		"theme":         doc.Theme,
		"show_on":       doc.ShowOn,
		"cta_new_tab":   doc.CTANewTab,
		"dismissible":   doc.Dismissible,
		"seasonal_flag": doc.SeasonalFlag,
	})
}
