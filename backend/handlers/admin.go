package handlers

import (
	"context"
	"net/http"
	"strings"

	"perfume-store/database"
	"perfume-store/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// AdminStats returns counts for admin dashboard: pending orders (not yet shipped/delivered/cancelled) and unread reviews.
func AdminStats(c *gin.Context) {
	ctx := context.Background()

	// Orders with status pending or paid (not yet shipped/delivered/cancelled)
	ordersCol := database.DB.Collection("orders")
	pendingFilter := bson.M{"status": bson.M{"$in": []string{string(models.OrderPending), string(models.OrderPaid)}}}
	pendingOrdersCount, err1 := ordersCol.CountDocuments(ctx, pendingFilter)
	if err1 != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count orders"})
		return
	}

	// Reviews without read_at set
	reviewsCol := database.DB.Collection("product_reviews")
	unreadFilter := bson.M{"$or": []bson.M{
		{"read_at": bson.M{"$exists": false}},
		{"read_at": nil},
	}}
	unreadReviewsCount, err2 := reviewsCol.CountDocuments(ctx, unreadFilter)
	if err2 != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count reviews"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"pendingOrdersCount": pendingOrdersCount,
		"unreadReviewsCount": unreadReviewsCount,
	})
}

// ProductCheck returns whether a product exists by ID and its name/image (admin debug).
func ProductCheck(c *gin.Context) {
	rawID := strings.TrimSpace(c.Query("id"))
	if rawID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id query required"})
		return
	}
	ctx := context.Background()
	productsCol := database.DB.Collection("products")
	var dest struct {
		Name      string   `bson:"name"`
		NameAr    string   `bson:"name_ar"`
		ImageURL  string   `bson:"image_url"`
		ImageURLs []string `bson:"image_urls"`
	}
	// Try ObjectID first, then string _id
	id, err := primitive.ObjectIDFromHex(rawID)
	if err == nil {
		err = productsCol.FindOne(ctx, bson.M{"_id": id}).Decode(&dest)
	}
	if err == mongo.ErrNoDocuments {
		_ = productsCol.FindOne(ctx, bson.M{"_id": rawID}).Decode(&dest)
	}
	name := dest.Name
	if name == "" {
		name = dest.NameAr
	}
	imageURL := ""
	if len(dest.ImageURLs) > 0 {
		imageURL = dest.ImageURLs[0]
	}
	if imageURL == "" {
		imageURL = dest.ImageURL
	}
	found := name != "" || imageURL != ""
	c.JSON(http.StatusOK, gin.H{
		"found":     found,
		"productId": rawID,
		"name":      name,
		"imageUrl":  imageURL,
	})
}
