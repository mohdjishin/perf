package handlers

import (
	"context"
	"net/http"
	"regexp"
	"strings"
	"time"

	"perfume-store/database"
	"perfume-store/models"
	"perfume-store/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type CreateProductRequest struct {
	Name            string   `json:"name"`
	NameAr          string   `json:"nameAr"`
	Description     string   `json:"description"`
	DescriptionAr   string   `json:"descriptionAr"`
	Price           float64  `json:"price"`
	ImageURL        string   `json:"imageUrl"`
	ImageURLs       []string `json:"imageUrls"`
	Category        string   `json:"category"`
	Audience        string   `json:"audience"` // "men", "women", "unisex"
	NewArrival      bool     `json:"newArrival"`
	OnSale          bool     `json:"onSale"`
	DiscountPercent int      `json:"discountPercent"`
	Stock           int      `json:"stock"`
	Notes           []string `json:"notes"`
	TopNote         string   `json:"topNote"`
	HeartNote       string   `json:"heartNote"`
	BaseNote        string   `json:"baseNote"`
	SeasonalFlag    string   `json:"seasonalFlag"`
	Rating          *int     `json:"rating"` // 0-5, optional
}

type UpdateProductRequest struct {
	Name            *string   `json:"name"`
	NameAr          *string   `json:"nameAr"`
	Description     *string   `json:"description"`
	DescriptionAr   *string   `json:"descriptionAr"`
	Price           *float64  `json:"price"`
	ImageURL        *string   `json:"imageUrl"`
	ImageURLs       *[]string `json:"imageUrls"`
	Category        *string   `json:"category"`
	Audience        *string   `json:"audience"`
	NewArrival      *bool     `json:"newArrival"`
	OnSale          *bool     `json:"onSale"`
	DiscountPercent *int      `json:"discountPercent"`
	Stock           *int      `json:"stock"`
	Notes           *[]string `json:"notes"`
	TopNote         *string   `json:"topNote"`
	HeartNote       *string   `json:"heartNote"`
	BaseNote        *string   `json:"baseNote"`
	SeasonalFlag    *string   `json:"seasonalFlag"`
	Active          *bool     `json:"active"`
	Rating          *int      `json:"rating"` // 0-5, optional
}

// ListProducts returns products (public: active only; admin: all)
func ListProducts(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	col := database.DB.Collection("products")
	filter := bson.M{}
	role := c.GetString("user_role")

	// Admin and super_admin see all products (including inactive); customers see active only
	if role != string(models.RoleAdmin) && role != string(models.RoleSuperAdmin) {
		filter["active"] = true
	}

	category := c.Query("category")
	if category != "" {
		filter["category"] = category
	}
	audience := strings.TrimSpace(strings.ToLower(c.Query("audience")))
	if audience != "" && (audience == "men" || audience == "women" || audience == "unisex") {
		filter["audience"] = audience
	}
	if c.Query("new_arrival") == "1" {
		filter["new_arrival"] = true
	}
	if c.Query("on_sale") == "1" {
		filter["on_sale"] = true
	}
	if seasonal := strings.TrimSpace(c.Query("seasonal")); seasonal != "" {
		filter["seasonal_flag"] = seasonal
	}
	search := strings.TrimSpace(c.Query("search"))
	if search != "" {
		// Escape regex metacharacters to avoid ReDoS and unintended pattern matching
		escaped := regexp.QuoteMeta(search)
		filter["$or"] = []bson.M{
			{"name": bson.M{"$regex": escaped, "$options": "i"}},
			{"description": bson.M{"$regex": escaped, "$options": "i"}},
			{"notes": bson.M{"$regex": escaped, "$options": "i"}},
		}
	}
	page, limit := utils.GetPageLimit(c)
	skip := (page - 1) * limit

	sortBy := strings.TrimSpace(strings.ToLower(c.Query("sort")))
	sortDoc := bson.D{{Key: "created_at", Value: -1}}
	if sortBy == "price_asc" {
		sortDoc = bson.D{{Key: "price", Value: 1}}
	} else if sortBy == "price_desc" {
		sortDoc = bson.D{{Key: "price", Value: -1}}
	} else if sortBy == "rating_desc" {
		sortDoc = bson.D{{Key: "rating", Value: -1}}
	} else if sortBy == "rating_asc" {
		sortDoc = bson.D{{Key: "rating", Value: 1}}
	}

	total, _ := col.CountDocuments(context.Background(), filter)
	opts := options.Find().
		SetSort(sortDoc).
		SetSkip(int64(skip)).
		SetLimit(int64(limit)).
		SetProjection(bson.M{"updated_at": 0})
	cursor, err := col.Find(context.Background(), filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cursor.Close(context.Background())

	var products []models.Product
	if err := cursor.All(context.Background(), &products); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Slim response: include notes for admin edit form; exclude createdAt (not used in list UI)
	items := make([]gin.H, len(products))
	for i, p := range products {
		imgUrl := p.ImageURL
		if len(p.ImageURLs) > 0 {
			imgUrl = p.ImageURLs[0]
		}
		items[i] = gin.H{
			"id":              p.ID.Hex(),
			"name":            p.Name,
			"nameAr":          p.NameAr,
			"description":     p.Description,
			"descriptionAr":   p.DescriptionAr,
			"price":           p.Price,
			"imageUrl":        imgUrl,
			"imageUrls":       p.ImageURLs,
			"category":        p.Category,
			"audience":        p.Audience,
			"newArrival":      p.NewArrival,
			"onSale":          p.OnSale,
			"discountPercent": p.DiscountPercent,
			"stock":           p.Stock,
			"seasonalFlag":    p.SeasonalFlag,
			"active":          p.Active,
			"notes":           p.Notes,
			"topNote":         p.TopNote,
			"heartNote":       p.HeartNote,
			"baseNote":        p.BaseNote,
			"rating":          p.Rating,
		}
	}

	totalPages := int((total + int64(limit) - 1) / int64(limit))
	if totalPages < 1 {
		totalPages = 1
	}
	c.JSON(http.StatusOK, gin.H{
		"items":      items,
		"total":      total,
		"page":       page,
		"limit":      limit,
		"totalPages": totalPages,
	})
}

// ListSeasonalFlags returns distinct non-empty seasonal_flag values from products (for banner dropdown/suggestions).
func ListSeasonalFlags(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	col := database.DB.Collection("products")
	cursor, err := col.Aggregate(context.Background(), []bson.M{
		{"$match": bson.M{"seasonal_flag": bson.M{"$exists": true, "$ne": ""}}},
		{"$group": bson.M{"_id": "$seasonal_flag"}},
		{"$sort": bson.M{"_id": 1}},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cursor.Close(context.Background())
	var flags []string
	for cursor.Next(context.Background()) {
		var doc struct {
			ID string `bson:"_id"`
		}
		if cursor.Decode(&doc) == nil && strings.TrimSpace(doc.ID) != "" {
			flags = append(flags, strings.TrimSpace(doc.ID))
		}
	}
	if flags == nil {
		flags = []string{}
	}
	c.JSON(http.StatusOK, gin.H{"flags": flags})
}

// GetProduct returns a single product
func GetProduct(c *gin.Context) {
	rawID := strings.TrimSpace(c.Param("id"))
	if rawID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Product ID required"})
		return
	}
	id, err := primitive.ObjectIDFromHex(rawID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	col := database.DB.Collection("products")
	ctx := context.Background()
	var product models.Product

	// Role check for visibility
	role := c.GetString("user_role")
	userIDStr := c.GetString("user_id")

	err = col.FindOne(ctx, bson.M{"_id": id}).Decode(&product)
	if err == mongo.ErrNoDocuments {
		// Try _id as string (legacy compatibility)
		err = col.FindOne(ctx, bson.M{"_id": rawID}).Decode(&product)
	}

	if err != nil {
		// Fallback: Check if the user has this product in any of their orders (snapshot fallback)
		if role == string(models.RoleCustomer) && userIDStr != "" {
			userID, errU := primitive.ObjectIDFromHex(userIDStr)
			if errU == nil {
				if snapshot, found := GetProductSnapshotFromOrders(ctx, userID, id); found {
					c.JSON(http.StatusOK, snapshot)
					return
				}
			}
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	// Inactive products visible to admins, or customers who have ordered it
	if !product.Active && role != string(models.RoleAdmin) && role != string(models.RoleSuperAdmin) {
		if role == string(models.RoleCustomer) && userIDStr != "" {
			userID, errU := primitive.ObjectIDFromHex(userIDStr)
			if errU == nil && HasAnyOrderWithProduct(ctx, userID, id) {
				c.JSON(http.StatusOK, product)
				return
			}
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	c.JSON(http.StatusOK, product)
}

// CreateProduct creates a new product (admin only)
func CreateProduct(c *gin.Context) {
	var req CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validation: English name and description are mandatory
	if strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Product name (English) is required"})
		return
	}
	if strings.TrimSpace(req.Description) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Description (English) is required"})
		return
	}
	if req.Price <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Price must be greater than 0"})
		return
	}
	if req.Stock < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stock cannot be negative"})
		return
	}
	if req.OnSale && (req.DiscountPercent < 0 || req.DiscountPercent > 100) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Discount percent must be between 0 and 100"})
		return
	}

	now := time.Now()
	imgURL := req.ImageURL
	imgURLs := req.ImageURLs
	if len(imgURLs) > 0 {
		imgURL = imgURLs[0]
	} else if imgURL != "" {
		imgURLs = []string{imgURL}
	}
	product := models.Product{
		ID:              primitive.NewObjectID(),
		Name:            strings.TrimSpace(req.Name),
		NameAr:          strings.TrimSpace(req.NameAr),
		Description:     strings.TrimSpace(req.Description),
		DescriptionAr:   strings.TrimSpace(req.DescriptionAr),
		Price:           req.Price,
		ImageURL:        imgURL,
		ImageURLs:       imgURLs,
		Category:        req.Category,
		Audience:        strings.ToLower(strings.TrimSpace(req.Audience)),
		NewArrival:      req.NewArrival,
		OnSale:          req.OnSale,
		DiscountPercent: req.DiscountPercent,
		Stock:           req.Stock,
		Notes:           req.Notes,
		TopNote:         strings.TrimSpace(req.TopNote),
		HeartNote:       strings.TrimSpace(req.HeartNote),
		BaseNote:        strings.TrimSpace(req.BaseNote),
		SeasonalFlag:    strings.TrimSpace(req.SeasonalFlag),
		Active:          true,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	rating := 0
	if req.Rating != nil && *req.Rating >= 1 && *req.Rating <= 5 {
		rating = *req.Rating
	}
	product.Rating = rating
	if product.Audience != "men" && product.Audience != "women" && product.Audience != "unisex" {
		product.Audience = ""
	}
	col := database.DB.Collection("products")
	_, err := col.InsertOne(context.Background(), product)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	HomeCache.Clear() // Invalidate home cache

	details := map[string]interface{}{
		"request": map[string]interface{}{
			"name":        req.Name,
			"description": req.Description,
			"price":       req.Price,
			"imageUrl":    req.ImageURL,
			"category":    req.Category,
			"stock":       req.Stock,
			"notes":       req.Notes,
		},
		"response": map[string]interface{}{
			"id":          product.ID.Hex(),
			"name":        product.Name,
			"description": product.Description,
			"price":       product.Price,
			"imageUrl":    product.ImageURL,
			"category":    product.Category,
			"stock":       product.Stock,
			"notes":       product.Notes,
			"active":      product.Active,
			"createdAt":   product.CreatedAt,
			"updatedAt":   product.UpdatedAt,
		},
	}
	utils.Log(context.Background(), c.GetString("user_id"), c.GetString("user_email"), c.GetString("user_role"),
		models.AuditProductCreate, product.ID.Hex(), "product", "Created product \""+product.Name+"\"", details)
	c.JSON(http.StatusCreated, product)
}

// UpdateProduct updates a product (admin only)
func UpdateProduct(c *gin.Context) {
	idStr := strings.TrimSpace(c.Param("id"))
	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	var req UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validation when fields are provided
	if req.Name != nil && strings.TrimSpace(*req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Product name (English) is required"})
		return
	}
	if req.Description != nil && strings.TrimSpace(*req.Description) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Description (English) is required"})
		return
	}
	if req.Price != nil && *req.Price <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Price must be greater than 0"})
		return
	}
	if req.Stock != nil && *req.Stock < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stock cannot be negative"})
		return
	}
	if req.DiscountPercent != nil && (*req.DiscountPercent < 0 || *req.DiscountPercent > 100) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Discount percent must be between 0 and 100"})
		return
	}
	if req.Rating != nil && (*req.Rating < 0 || *req.Rating > 5) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Rating must be between 0 and 5"})
		return
	}

	updates := bson.M{}
	if req.Name != nil {
		updates["name"] = strings.TrimSpace(*req.Name)
	}
	if req.NameAr != nil {
		updates["name_ar"] = strings.TrimSpace(*req.NameAr)
	}
	if req.Description != nil {
		updates["description"] = strings.TrimSpace(*req.Description)
	}
	if req.DescriptionAr != nil {
		updates["description_ar"] = strings.TrimSpace(*req.DescriptionAr)
	}
	if req.Price != nil {
		updates["price"] = *req.Price
	}
	if req.ImageURL != nil {
		updates["image_url"] = *req.ImageURL
	}
	if req.ImageURLs != nil {
		urls := *req.ImageURLs
		updates["image_urls"] = urls
		if len(urls) > 0 {
			updates["image_url"] = urls[0]
		}
	}
	if req.Category != nil {
		updates["category"] = *req.Category
	}
	if req.Audience != nil {
		a := strings.ToLower(strings.TrimSpace(*req.Audience))
		if a != "men" && a != "women" && a != "unisex" {
			a = ""
		}
		updates["audience"] = a
	}
	if req.NewArrival != nil {
		updates["new_arrival"] = *req.NewArrival
	}
	if req.OnSale != nil {
		updates["on_sale"] = *req.OnSale
	}
	if req.DiscountPercent != nil {
		updates["discount_percent"] = *req.DiscountPercent
	}
	if req.Stock != nil {
		updates["stock"] = *req.Stock
	}
	if req.Notes != nil {
		updates["notes"] = *req.Notes
	}
	if req.TopNote != nil {
		updates["top_note"] = strings.TrimSpace(*req.TopNote)
	}
	if req.HeartNote != nil {
		updates["heart_note"] = strings.TrimSpace(*req.HeartNote)
	}
	if req.BaseNote != nil {
		updates["base_note"] = strings.TrimSpace(*req.BaseNote)
	}
	if req.SeasonalFlag != nil {
		updates["seasonal_flag"] = strings.TrimSpace(*req.SeasonalFlag)
	}
	if req.Active != nil {
		updates["active"] = *req.Active
	}
	if req.Rating != nil {
		updates["rating"] = *req.Rating
	}
	if len(updates) == 0 {
		col := database.DB.Collection("products")
		var product models.Product
		col.FindOne(context.Background(), bson.M{"_id": id}).Decode(&product)
		c.JSON(http.StatusOK, product)
		return
	}

	updates["updated_at"] = time.Now()
	col := database.DB.Collection("products")
	res, err := col.UpdateOne(context.Background(), bson.M{"_id": id}, bson.M{"$set": updates})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	HomeCache.Clear() // Invalidate home cache
	if res.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	var product models.Product
	if err := col.FindOne(context.Background(), bson.M{"_id": id}).Decode(&product); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}
	summary := "Updated product"
	if product.Name != "" {
		summary = "Updated product \"" + product.Name + "\""
	}
	utils.Log(context.Background(), c.GetString("user_id"), c.GetString("user_email"), c.GetString("user_role"),
		models.AuditProductUpdate, id.Hex(), "product", summary, map[string]interface{}{"updates": updates})
	c.JSON(http.StatusOK, product)
}

// DeleteProduct soft-deletes by setting active=false (admin only)
func DeleteProduct(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	col := database.DB.Collection("products")
	res, err := col.UpdateOne(context.Background(), bson.M{"_id": id}, bson.M{"$set": bson.M{"active": false}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	HomeCache.Clear() // Invalidate home cache
	if res.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}
	var product models.Product
	col.FindOne(context.Background(), bson.M{"_id": id}).Decode(&product)
	summary := "Deleted product"
	if product.Name != "" {
		summary = "Deleted product \"" + product.Name + "\""
	}
	utils.Log(context.Background(), c.GetString("user_id"), c.GetString("user_email"), c.GetString("user_role"),
		models.AuditProductDelete, id.Hex(), "product", summary, nil)
	c.JSON(http.StatusOK, gin.H{"message": "Product deleted"})
}
