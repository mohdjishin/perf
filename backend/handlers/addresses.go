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
)

// ListAddresses returns the current user's saved addresses
func ListAddresses(c *gin.Context) {
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
	col := database.DB.Collection("user_addresses")
	cursor, err := col.Find(context.Background(), bson.M{"user_id": userID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cursor.Close(context.Background())

	var addrs []models.UserAddress
	if err := cursor.All(context.Background(), &addrs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if addrs == nil {
		addrs = []models.UserAddress{}
	}
	c.JSON(http.StatusOK, gin.H{"addresses": addrs})
}

type CreateAddressRequest struct {
	Label          string `json:"label"`
	Street         string `json:"street" binding:"required"`
	City           string `json:"city" binding:"required"`
	State          string `json:"state"`
	Zip            string `json:"zip" binding:"required"`
	Country        string `json:"country" binding:"required"`
	Phone          string `json:"phone"`
	SecondaryPhone string `json:"secondaryPhone"`
	IsDefault      bool   `json:"isDefault"`
}

// CreateAddress adds a new address for the current user
func CreateAddress(c *gin.Context) {
	var req CreateAddressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(req.Street) == "" || strings.TrimSpace(req.City) == "" ||
		strings.TrimSpace(req.Zip) == "" || strings.TrimSpace(req.Country) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Street, city, zip, and country are required"})
		return
	}

	userID, _ := primitive.ObjectIDFromHex(c.GetString("user_id"))
	col := database.DB.Collection("user_addresses")

	if req.IsDefault {
		_, _ = col.UpdateMany(context.Background(), bson.M{"user_id": userID}, bson.M{"$set": bson.M{"is_default": false}})
	}

	addr := models.UserAddress{
		ID:             primitive.NewObjectID(),
		UserID:         userID,
		Label:          req.Label,
		Street:         req.Street,
		City:           req.City,
		State:          req.State,
		Zip:            req.Zip,
		Country:        req.Country,
		Phone:          req.Phone,
		SecondaryPhone: req.SecondaryPhone,
		IsDefault:      req.IsDefault,
	}
	_, err := col.InsertOne(context.Background(), addr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, addr)
}

type UpdateAddressRequest struct {
	Label          *string `json:"label"`
	Street         *string `json:"street"`
	City           *string `json:"city"`
	State          *string `json:"state"`
	Zip            *string `json:"zip"`
	Country        *string `json:"country"`
	Phone          *string `json:"phone"`
	SecondaryPhone *string `json:"secondaryPhone"`
	IsDefault      *bool   `json:"isDefault"`
}

// UpdateAddress updates an address belonging to the current user
func UpdateAddress(c *gin.Context) {
	idStr := c.Param("id")
	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid address ID"})
		return
	}

	var req UpdateAddressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := primitive.ObjectIDFromHex(c.GetString("user_id"))
	col := database.DB.Collection("user_addresses")

	filter := bson.M{"_id": id, "user_id": userID}
	update := bson.M{}
	if req.Label != nil {
		update["label"] = *req.Label
	}
	if req.Street != nil {
		if strings.TrimSpace(*req.Street) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Street cannot be empty"})
			return
		}
		update["street"] = *req.Street
	}
	if req.City != nil {
		if strings.TrimSpace(*req.City) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "City cannot be empty"})
			return
		}
		update["city"] = *req.City
	}
	if req.State != nil {
		update["state"] = *req.State
	}
	if req.Zip != nil {
		if strings.TrimSpace(*req.Zip) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Zip cannot be empty"})
			return
		}
		update["zip"] = *req.Zip
	}
	if req.Country != nil {
		if strings.TrimSpace(*req.Country) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Country cannot be empty"})
			return
		}
		update["country"] = *req.Country
	}
	if req.Phone != nil {
		update["phone"] = *req.Phone
	}
	if req.SecondaryPhone != nil {
		update["secondary_phone"] = *req.SecondaryPhone
	}
	if req.IsDefault != nil && *req.IsDefault {
		_, _ = col.UpdateMany(context.Background(), bson.M{"user_id": userID}, bson.M{"$set": bson.M{"is_default": false}})
		update["is_default"] = true
	}

	if len(update) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	res, err := col.UpdateOne(context.Background(), filter, bson.M{"$set": update})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if res.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Address not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// DeleteAddress removes an address belonging to the current user
func DeleteAddress(c *gin.Context) {
	idStr := c.Param("id")
	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid address ID"})
		return
	}

	userID, _ := primitive.ObjectIDFromHex(c.GetString("user_id"))
	col := database.DB.Collection("user_addresses")
	res, err := col.DeleteOne(context.Background(), bson.M{"_id": id, "user_id": userID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if res.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Address not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
