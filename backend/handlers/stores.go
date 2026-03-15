package handlers

import (
	"context"
	"net/http"

	"perfume-store/database"
	"perfume-store/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ListStores returns all active store locations for the shop locator (public).
func ListStores(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	col := database.DB.Collection("stores")
	opts := options.Find().SetSort(bson.D{{Key: "name", Value: 1}})
	cursor, err := col.Find(context.Background(), bson.M{"active": true}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cursor.Close(context.Background())
	var stores []models.StoreLocation
	if err := cursor.All(context.Background(), &stores); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if stores == nil {
		stores = []models.StoreLocation{}
	}
	c.JSON(http.StatusOK, gin.H{"stores": stores})
}

// ListStoresAdmin returns all store locations for super admin (including inactive).
func ListStoresAdmin(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	col := database.DB.Collection("stores")
	opts := options.Find().SetSort(bson.D{{Key: "name", Value: 1}})
	cursor, err := col.Find(context.Background(), bson.M{}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cursor.Close(context.Background())
	var stores []models.StoreLocation
	if err := cursor.All(context.Background(), &stores); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if stores == nil {
		stores = []models.StoreLocation{}
	}
	c.JSON(http.StatusOK, gin.H{"stores": stores})
}

// CreateStoreRequest is the body for creating a store location.
type CreateStoreRequest struct {
	Name    string  `json:"name" binding:"required"`
	Street  string  `json:"street"`
	City    string  `json:"city"`
	State   string  `json:"state"`
	Zip     string  `json:"zip"`
	Country string  `json:"country"`
	Lat     float64 `json:"lat" binding:"required"`
	Lng     float64 `json:"lng" binding:"required"`
	Phone   string  `json:"phone"`
	Hours   string  `json:"hours"`
	Active  *bool   `json:"active"`
}

// CreateStore creates a new store location (super_admin only).
func CreateStore(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	var req CreateStoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	active := true
	if req.Active != nil {
		active = *req.Active
	}
	store := models.StoreLocation{
		ID:      primitive.NewObjectID(),
		Name:    req.Name,
		Street:  req.Street,
		City:    req.City,
		State:   req.State,
		Zip:     req.Zip,
		Country: req.Country,
		Lat:     req.Lat,
		Lng:     req.Lng,
		Phone:   req.Phone,
		Hours:   req.Hours,
		Active:  active,
	}
	col := database.DB.Collection("stores")
	if _, err := col.InsertOne(context.Background(), store); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"store": store})
}

// UpdateStoreRequest is the body for updating a store (all optional except id in path).
type UpdateStoreRequest struct {
	Name    *string  `json:"name"`
	Street  *string  `json:"street"`
	City    *string  `json:"city"`
	State   *string  `json:"state"`
	Zip     *string  `json:"zip"`
	Country *string  `json:"country"`
	Lat     *float64 `json:"lat"`
	Lng     *float64 `json:"lng"`
	Phone   *string  `json:"phone"`
	Hours   *string  `json:"hours"`
	Active  *bool    `json:"active"`
}

// UpdateStore updates a store location (super_admin only).
func UpdateStore(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	idStr := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req UpdateStoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	updates := bson.M{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Street != nil {
		updates["street"] = *req.Street
	}
	if req.City != nil {
		updates["city"] = *req.City
	}
	if req.State != nil {
		updates["state"] = *req.State
	}
	if req.Zip != nil {
		updates["zip"] = *req.Zip
	}
	if req.Country != nil {
		updates["country"] = *req.Country
	}
	if req.Lat != nil {
		updates["lat"] = *req.Lat
	}
	if req.Lng != nil {
		updates["lng"] = *req.Lng
	}
	if req.Phone != nil {
		updates["phone"] = *req.Phone
	}
	if req.Hours != nil {
		updates["hours"] = *req.Hours
	}
	if req.Active != nil {
		updates["active"] = *req.Active
	}
	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}
	col := database.DB.Collection("stores")
	res, err := col.UpdateOne(context.Background(), bson.M{"_id": oid}, bson.M{"$set": updates})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "store not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// DeleteStore removes a store location (super_admin only).
func DeleteStore(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	idStr := c.Param("id")
	oid, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	col := database.DB.Collection("stores")
	res, err := col.DeleteOne(context.Background(), bson.M{"_id": oid})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if res.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "store not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
