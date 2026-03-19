package handlers

import (
	"context"
	"net/http"
	"regexp"
	"strings"
	"time"

	"perfume-store/database"
	"perfume-store/logger"
	"perfume-store/models"
	"perfume-store/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type CreateUserRequest struct {
	Email     string      `json:"email" binding:"required,email"`
	Password  string      `json:"password" binding:"required,min=6"`
	FirstName string      `json:"firstName" binding:"required"`
	LastName  string      `json:"lastName" binding:"required"`
	Role      models.Role `json:"role" binding:"required"`
	Group     string      `json:"group"`
}

type UpdateUserRequest struct {
	FirstName string      `json:"firstName"`
	LastName  string      `json:"lastName"`
	Role      models.Role `json:"role"`
	Group     *string     `json:"group"`
	Active    *bool       `json:"active"`
}

type ResetPasswordRequest struct {
	NewPassword string `json:"newPassword" binding:"required,min=6"`
}

func stringVal(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func boolVal(v interface{}) bool {
	if v == nil {
		return false
	}
	if b, ok := v.(bool); ok {
		return b
	}
	return false
}

// idHex extracts the _id from a decoded BSON map as a hex string (for list response).
func idHex(raw bson.M) string {
	v := raw["_id"]
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

// userResponseFromRaw builds the same JSON shape as toUserResponse from a bson.M (avoids struct decode issues).
func userResponseFromRaw(raw bson.M) gin.H {
	return gin.H{
		"id":         idHex(raw),
		"email":      stringVal(raw["email"]),
		"firstName":  stringVal(raw["first_name"]),
		"lastName":   stringVal(raw["last_name"]),
		"role":       stringVal(raw["role"]),
		"group":      stringVal(raw["group"]),
		"active":     boolVal(raw["active"]),
		"profileUrl": stringVal(raw["profile_url"]),
	}
}

// CreateUser creates a new admin (super_admin only). Normal users self-register via /auth/register.
func CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Role != models.RoleAdmin {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only create admins here. Normal users sign up via the register page."})
		return
	}

	col := database.DB.Collection("users")
	emailRegex := bson.M{"$regex": "^" + regexp.QuoteMeta(strings.TrimSpace(req.Email)) + "$", "$options": "i"}
	count, err := col.CountDocuments(context.Background(), bson.M{"email": emailRegex})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
		return
	}

	hashed, err := utils.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	now := time.Now()
	emailLower := strings.ToLower(strings.TrimSpace(req.Email))
	user := models.User{
		ID:        primitive.NewObjectID(),
		Email:     emailLower,
		Password:  hashed,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Role:      req.Role,
		Group:     strings.TrimSpace(req.Group),
		Active:    true,
		CreatedAt: now,
		UpdatedAt: now,
	}

	_, err = col.InsertOne(context.Background(), user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	utils.Log(context.Background(), c.GetString("user_id"), c.GetString("user_email"), c.GetString("user_role"),
		models.AuditUserUpdate, user.ID.Hex(), "user", "Created user \""+user.Email+"\" as "+string(req.Role), map[string]interface{}{"action": "create", "role": req.Role})
	c.JSON(http.StatusCreated, toUserResponse(&user))
}

// ListUsers returns users (admin + super_admin). Supports search (email) and group filter.
func ListUsers(c *gin.Context) {
	col := database.DB.Collection("users")
	filter := bson.M{}

	if email := strings.TrimSpace(c.Query("email")); email != "" {
		filter["email"] = bson.M{"$regex": regexp.QuoteMeta(email), "$options": "i"}
	}
	if group := strings.TrimSpace(c.Query("group")); group != "" {
		filter["group"] = group
	}
	if role := strings.TrimSpace(c.Query("role")); role != "" {
		if role == "customer" {
			filter["role"] = bson.M{"$in": []string{"customer", "user"}}
		} else {
			filter["role"] = role
		}
	}

	page, limit := utils.GetPageLimit(c)
	if limit > 50 {
		limit = 50
	}
	skip := (page - 1) * limit

	total, _ := col.CountDocuments(context.Background(), filter)
	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64(skip)).
		SetLimit(int64(limit)).
		SetProjection(bson.M{"password": 0})
	cursor, err := col.Find(context.Background(), filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cursor.Close(context.Background())

	result := make([]gin.H, 0)
	for cursor.Next(context.Background()) {
		var raw bson.M
		if err := cursor.Decode(&raw); err != nil {
			logger.Errorf("ListUsers: decode doc: %v", err)
			continue
		}
		idStr := idHex(raw)
		if idStr == "" {
			continue
		}
		result = append(result, gin.H{
			"id":         idStr,
			"email":      stringVal(raw["email"]),
			"firstName":  stringVal(raw["first_name"]),
			"lastName":   stringVal(raw["last_name"]),
			"role":       stringVal(raw["role"]),
			"group":      stringVal(raw["group"]),
			"active":     boolVal(raw["active"]),
			"profileUrl": stringVal(raw["profile_url"]),
		})
	}
	if err := cursor.Err(); err != nil {
		logger.Errorf("ListUsers: cursor: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	totalPages := int((total + int64(limit) - 1) / int64(limit))
	if totalPages < 1 {
		totalPages = 1
	}
	c.JSON(http.StatusOK, gin.H{
		"items":      result,
		"total":      total,
		"page":       page,
		"limit":      limit,
		"totalPages": totalPages,
	})
}

// GetUser returns a single user by ID
func GetUser(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	col := database.DB.Collection("users")
	var user models.User
	err = col.FindOne(context.Background(), bson.M{"_id": id}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, toUserResponse(&user))
}

// UpdateUser updates a user (admin can update users, super_admin can update anyone including role).
// Uses existence check + bson.M so documents that don't decode into models.User still update correctly.
func UpdateUser(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	col := database.DB.Collection("users")
	// Check document exists without requiring full struct decode (avoids 404 on schema mismatch)
	var exists struct {
		ID primitive.ObjectID `bson:"_id"`
	}
	err = col.FindOne(context.Background(), bson.M{"_id": id}, options.FindOne().SetProjection(bson.M{"_id": 1})).Decode(&exists)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	callerID := c.GetString("user_id")
	callerRole := models.Role(c.GetString("user_role"))
	updates := bson.M{}

	// Prevent self-modification: current user cannot deactivate or demote themselves (and must not be able to delete themselves if DeleteUser is added).
	if id.Hex() == callerID {
		if req.Active != nil && !*req.Active {
			c.JSON(http.StatusForbidden, gin.H{"error": "Cannot deactivate your own account"})
			return
		}
		if req.Role != "" && req.Role != models.RoleSuperAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "Cannot demote your own account"})
			return
		}
	}

	if req.FirstName != "" {
		updates["first_name"] = req.FirstName
	}
	if req.LastName != "" {
		updates["last_name"] = req.LastName
	}
	if req.Group != nil {
		updates["group"] = strings.TrimSpace(*req.Group)
	}
	if req.Active != nil {
		updates["active"] = *req.Active
	}
	if req.Role != "" && callerRole == models.RoleSuperAdmin {
		updates["role"] = req.Role
	}

	if len(updates) == 0 {
		// No changes; return current user from raw doc so we don't depend on struct decode
		var raw bson.M
		if col.FindOne(context.Background(), bson.M{"_id": id}).Decode(&raw) == nil {
			c.JSON(http.StatusOK, userResponseFromRaw(raw))
			return
		}
		c.JSON(http.StatusOK, gin.H{"id": id.Hex(), "email": "", "firstName": "", "lastName": "", "role": "", "group": "", "active": false})
		return
	}

	updates["updated_at"] = bson.M{"$currentDate": true}
	_, err = col.UpdateOne(context.Background(), bson.M{"_id": id}, bson.M{"$set": updates})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var raw bson.M
	if col.FindOne(context.Background(), bson.M{"_id": id}).Decode(&raw) != nil {
		c.JSON(http.StatusOK, gin.H{"id": id.Hex(), "email": "", "firstName": "", "lastName": "", "role": "", "group": "", "active": req.Active != nil && *req.Active})
		return
	}
	summary := "Updated user \"" + stringVal(raw["email"]) + "\""
	utils.Log(context.Background(), c.GetString("user_id"), c.GetString("user_email"), c.GetString("user_role"),
		models.AuditUserUpdate, id.Hex(), "user", summary, map[string]interface{}{"updates": updates})
	c.JSON(http.StatusOK, userResponseFromRaw(raw))
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"` // Optional for Google-only users (no existing password)
	NewPassword     string `json:"newPassword" binding:"required,min=6"`
}

// ChangePassword allows user to change their own password
func ChangePassword(c *gin.Context) {
	userID := c.GetString("user_id")
	id, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	col := database.DB.Collection("users")
	var user models.User
	err = col.FindOne(context.Background(), bson.M{"_id": id}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if user.Password != "" {
		// Existing password user: must verify current password
		if !utils.CheckPassword(req.CurrentPassword, user.Password) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Current password is incorrect"})
			return
		}
	}
	// Google-only users (no password) can set a new password without currentPassword

	hashed, err := utils.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	_, err = col.UpdateOne(context.Background(), bson.M{"_id": id}, bson.M{"$set": bson.M{"password": hashed}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	utils.Log(context.Background(), c.GetString("user_id"), c.GetString("user_email"), c.GetString("user_role"),
		models.AuditUserPasswordChange, id.Hex(), "user", "Changed password", nil)
	c.JSON(http.StatusOK, gin.H{"message": "Password updated"})
}

// AdminResetUserPassword allows admin/super_admin to reset any user's password
func AdminResetUserPassword(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	col := database.DB.Collection("users")
	var user models.User
	err = col.FindOne(context.Background(), bson.M{"_id": id}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	hashed, err := utils.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	_, err = col.UpdateOne(context.Background(), bson.M{"_id": id}, bson.M{"$set": bson.M{"password": hashed}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	utils.Log(context.Background(), c.GetString("user_id"), c.GetString("user_email"), c.GetString("user_role"),
		models.AuditUserPasswordReset, id.Hex(), "user", "Reset password for \""+user.Email+"\"", nil)
	c.JSON(http.StatusOK, gin.H{"message": "Password reset successfully"})
}
