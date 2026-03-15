package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"perfume-store/database"
	"perfume-store/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const reviewCollection = "product_reviews"

// ListProductReviews returns reviews for a product. Public. If the request is authenticated as a customer,
// includes canReview: true when the user has a delivered order containing this product and has not yet reviewed.
func ListProductReviews(c *gin.Context) {
	productIDHex := strings.TrimSpace(c.Param("id"))
	if productIDHex == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Product ID required"})
		return
	}
	productID, err := primitive.ObjectIDFromHex(productIDHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	col := database.DB.Collection(reviewCollection)
	ctx := context.Background()
	filter := bson.M{"product_id": productID}
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cur, err := col.Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load reviews"})
		return
	}
	defer cur.Close(ctx)

	var reviews []models.ProductReview
	if err := cur.All(ctx, &reviews); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load reviews"})
		return
	}

	// Build public response: do not expose user_id for privacy; show "Verified purchase"
	items := make([]gin.H, len(reviews))
	var sum int
	for i, r := range reviews {
		sum += r.Rating
		items[i] = gin.H{
			"id":        r.ID.Hex(),
			"rating":    r.Rating,
			"comment":   r.Comment,
			"createdAt": r.CreatedAt,
			"verified":  true,
		}
	}

	avg := 0.0
	if len(reviews) > 0 {
		avg = float64(sum) / float64(len(reviews))
	}

	res := gin.H{
		"items":     items,
		"total":     len(reviews),
		"average":   avg,
		"canReview": false,
	}

	// If authenticated as customer, they can submit a review if they have a delivered order with this product (multiple reviews allowed)
	userIDStr := c.GetString("user_id")
	role := c.GetString("user_role")
	if userIDStr != "" && role == string(models.RoleCustomer) {
		userID, _ := primitive.ObjectIDFromHex(userIDStr)
		res["canReview"] = HasDeliveredOrderWithProduct(ctx, userID, productID)
	}

	c.JSON(http.StatusOK, res)
}

func HasDeliveredOrderWithProduct(ctx context.Context, userID, productID primitive.ObjectID) bool {
	ordersCol := database.DB.Collection("orders")
	// Handle potential mixed types in the items array (product_id vs productId)
	filter := bson.M{
		"user_id": userID,
		"status":  models.OrderDelivered,
		"$or": []bson.M{
			{"items": bson.M{"$elemMatch": bson.M{"product_id": productID}}},
			{"items": bson.M{"$elemMatch": bson.M{"product_id": productID.Hex()}}},
		},
	}
	n, err := ordersCol.CountDocuments(ctx, filter)
	return err == nil && n > 0
}

// GetProductSnapshotFromOrders searches the user's orders for the most recent snapshot of a product.
// This is used as a fallback when a product is hard-deleted from the main products collection.
func GetProductSnapshotFromOrders(ctx context.Context, userID, productID primitive.ObjectID) (*models.Product, bool) {
	ordersCol := database.DB.Collection("orders")
	// Search any order (not just delivered) for this user containing this product
	filter := bson.M{
		"user_id": userID,
		"$or": []bson.M{
			{"items": bson.M{"$elemMatch": bson.M{"product_id": productID}}},
			{"items": bson.M{"$elemMatch": bson.M{"product_id": productID.Hex()}}},
		},
	}

	// Find the newest order first
	opts := options.FindOne().SetSort(bson.D{{Key: "created_at", Value: -1}})
	var order models.Order
	err := ordersCol.FindOne(ctx, filter, opts).Decode(&order)
	if err != nil {
		return nil, false
	}

	// Extract the item snapshot
	for _, item := range order.Items {
		if item.ProductID == productID {
			// Construct a partial Product from the snapshot
			p := &models.Product{
				ID:       item.ProductID,
				Name:     item.Name,
				Price:    item.Price,
				ImageURL: item.ImageURL,
				Active:   false, // It's a legacy snapshot
			}
			return p, true
		}
	}

	return nil, false
}

func HasAnyOrderWithProduct(ctx context.Context, userID, productID primitive.ObjectID) bool {
	ordersCol := database.DB.Collection("orders")
	// Any status except cancelled
	filter := bson.M{
		"user_id": userID,
		"status":  bson.M{"$ne": models.OrderCancelled},
		"$or": []bson.M{
			{"items": bson.M{"$elemMatch": bson.M{"product_id": productID}}},
			{"items": bson.M{"$elemMatch": bson.M{"product_id": productID.Hex()}}},
		},
	}
	n, err := ordersCol.CountDocuments(ctx, filter)
	return err == nil && n > 0
}

type CreateReviewRequest struct {
	Rating  int    `json:"rating" binding:"required,min=1,max=5"`
	Comment string `json:"comment"`
}

// CreateReview creates a product review. Customer only; must have a delivered order containing this product.
func CreateReview(c *gin.Context) {
	productIDHex := strings.TrimSpace(c.Param("id"))
	if productIDHex == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Product ID required"})
		return
	}
	productID, err := primitive.ObjectIDFromHex(productIDHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user"})
		return
	}

	var req CreateReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Rating 1-5 required"})
		return
	}
	if req.Rating < 1 || req.Rating > 5 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Rating must be between 1 and 5"})
		return
	}

	ctx := context.Background()

	// Must have delivered order with this product
	ordersCol := database.DB.Collection("orders")
	var order models.Order
	err = ordersCol.FindOne(ctx, bson.M{
		"user_id": userID,
		"status":  models.OrderDelivered,
		"items":   bson.M{"$elemMatch": bson.M{"product_id": productID}},
	}).Decode(&order)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusForbidden, gin.H{"error": "You can only review products you have received (delivered orders)"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify order"})
		return
	}

	// Fetch product name and image to store on review (for admin display even if product is later removed)
	productsCol := database.DB.Collection("products")
	var prod struct {
		Name      string   `bson:"name"`
		NameAr    string   `bson:"name_ar"`
		ImageURL  string   `bson:"image_url"`
		ImageURLs []string `bson:"image_urls"`
	}
	_ = productsCol.FindOne(ctx, bson.M{"_id": productID}).Decode(&prod)
	productName := prod.Name
	if productName == "" {
		productName = prod.NameAr
	}
	productImageURL := ""
	if len(prod.ImageURLs) > 0 {
		productImageURL = prod.ImageURLs[0]
	}
	if productImageURL == "" {
		productImageURL = prod.ImageURL
	}

	// Allow multiple reviews per user per product (customer can add another comment anytime they have a delivered order)
	reviewCol := database.DB.Collection(reviewCollection)
	now := time.Now()
	review := models.ProductReview{
		ID:              primitive.NewObjectID(),
		ProductID:       productID,
		ProductName:     productName,
		ProductImageURL: productImageURL,
		UserID:          userID,
		OrderID:         order.ID,
		Rating:          req.Rating,
		Comment:         strings.TrimSpace(req.Comment),
		CreatedAt:       now,
	}
	_, err = reviewCol.InsertOne(ctx, review)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save review"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":        review.ID.Hex(),
		"rating":    review.Rating,
		"comment":   review.Comment,
		"createdAt": review.CreatedAt,
		"verified":  true,
	})
}

// DeleteReview removes a review. Admin or super_admin only.
func DeleteReview(c *gin.Context) {
	reviewIDHex := strings.TrimSpace(c.Param("id"))
	if reviewIDHex == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Review ID required"})
		return
	}
	reviewID, err := primitive.ObjectIDFromHex(reviewIDHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid review ID"})
		return
	}

	col := database.DB.Collection(reviewCollection)
	ctx := context.Background()
	res, err := col.DeleteOne(ctx, bson.M{"_id": reviewID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete review"})
		return
	}
	if res.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Review not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// productIDFromRaw extracts a 24-char hex product ID from BSON (ObjectID or string) for consistent links.
func productIDFromRaw(v interface{}) string {
	if v == nil {
		return ""
	}
	switch x := v.(type) {
	case primitive.ObjectID:
		return x.Hex()
	case string:
		s := strings.TrimSpace(x)
		if len(s) == 24 && primitive.IsValidObjectID(s) {
			return s
		}
		return s
	}
	return ""
}

// ListAdminReviews returns all reviews for admin/super_admin. Supports ?unread_only=1. Newest first.
// Product IDs are normalized so links to /product/:id work for both admin and customer.
func ListAdminReviews(c *gin.Context) {
	col := database.DB.Collection(reviewCollection)
	ctx := context.Background()
	filter := bson.M{}
	if c.Query("unread_only") == "1" {
		filter["$or"] = []bson.M{{"read_at": bson.M{"$exists": false}}, {"read_at": nil}}
	}
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(500)
	cur, err := col.Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load reviews"})
		return
	}
	defer cur.Close(ctx)
	productsCol := database.DB.Collection("products")
	items := make([]gin.H, 0)
	for cur.Next(ctx) {
		var raw bson.M
		if err := cur.Decode(&raw); err != nil {
			continue
		}
		reviewID, _ := raw["_id"].(primitive.ObjectID)
		if reviewID.IsZero() {
			if idStr, ok := raw["_id"].(string); ok && len(idStr) == 24 {
				reviewID, _ = primitive.ObjectIDFromHex(idStr)
			}
		}
		productIDStr := productIDFromRaw(raw["product_id"])
		productIDStr = strings.TrimSpace(strings.ToLower(productIDStr))
		if productIDStr == "" || len(productIDStr) != 24 {
			productIDStr = ""
		} else if !primitive.IsValidObjectID(productIDStr) {
			productIDStr = "" // invalid hex (e.g. typo) — link would 404 anyway
		}
		if productIDStr == "" {
			productIDStr = "000000000000000000000000" // so frontend always has a 24-char id
		}
		name := strings.TrimSpace(stringOr(raw["product_name"], ""))
		imageURL := strings.TrimSpace(stringOr(raw["product_image_url"], ""))
		if name == "" || imageURL == "" {
			var dest struct {
				Name      string   `bson:"name"`
				NameAr    string   `bson:"name_ar"`
				ImageURL  string   `bson:"image_url"`
				ImageURLs []string `bson:"image_urls"`
			}
			oid, _ := primitive.ObjectIDFromHex(productIDStr)
			errDecode := productsCol.FindOne(ctx, bson.M{"_id": oid}).Decode(&dest)
			if errDecode == mongo.ErrNoDocuments {
				_ = productsCol.FindOne(ctx, bson.M{"_id": productIDStr}).Decode(&dest)
			}
			if name == "" {
				if dest.Name != "" {
					name = dest.Name
				} else if dest.NameAr != "" {
					name = dest.NameAr
				} else {
					name = productIDStr
				}
			}
			if imageURL == "" {
				if len(dest.ImageURLs) > 0 {
					imageURL = dest.ImageURLs[0]
				} else if dest.ImageURL != "" {
					imageURL = dest.ImageURL
				}
			}
			if (name != "" && name != productIDStr) || imageURL != "" {
				_, _ = col.UpdateOne(ctx, bson.M{"_id": reviewID}, bson.M{
					"$set": bson.M{"product_name": name, "product_image_url": imageURL},
				})
			}
		}
		items = append(items, gin.H{
			"id":           reviewID.Hex(),
			"productId":    productIDStr,
			"productName":  name,
			"productImage": imageURL,
			"userId":       reviewDocIDHex(raw["user_id"]),
			"rating":       intOr(raw["rating"], 0),
			"comment":      stringOr(raw["comment"], ""),
			"createdAt":    raw["created_at"],
			"readAt":       raw["read_at"],
		})
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": len(items)})
}

func stringOr(v interface{}, def string) string {
	if v == nil {
		return def
	}
	s, ok := v.(string)
	if !ok {
		return def
	}
	return s
}

func intOr(v interface{}, def int) int {
	if v == nil {
		return def
	}
	switch x := v.(type) {
	case int:
		return x
	case int32:
		return int(x)
	case int64:
		return int(x)
	}
	return def
}

func reviewDocIDHex(v interface{}) string {
	if v == nil {
		return ""
	}
	if oid, ok := v.(primitive.ObjectID); ok {
		return oid.Hex()
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// MarkReviewRead sets read_at to now for a review. Admin or super_admin only.
func MarkReviewRead(c *gin.Context) {
	reviewIDHex := strings.TrimSpace(c.Param("id"))
	if reviewIDHex == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Review ID required"})
		return
	}
	reviewID, err := primitive.ObjectIDFromHex(reviewIDHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid review ID"})
		return
	}
	col := database.DB.Collection(reviewCollection)
	now := time.Now()
	res, err := col.UpdateOne(context.Background(), bson.M{"_id": reviewID}, bson.M{"$set": bson.M{"read_at": now}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update review"})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Review not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "readAt": now})
}
