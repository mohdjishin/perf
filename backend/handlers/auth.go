package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"

	"perfume-store/config"
	"perfume-store/database"
	"perfume-store/logger"
	"perfume-store/models"
	"perfume-store/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type GoogleAuthRequest struct {
	Code string `json:"code" binding:"required"`
}

type RegisterRequest struct {
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=6"`
	FirstName string `json:"firstName" binding:"required"`
	LastName  string `json:"lastName" binding:"required"`
}

// Login authenticates user and returns JWT
func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	col := database.DB.Collection("users")
	var user models.User
	emailRegex := bson.M{"$regex": "^" + regexp.QuoteMeta(strings.TrimSpace(req.Email)) + "$", "$options": "i"}
	opts := options.FindOne().SetProjection(bson.M{"updated_at": 0})
	err := col.FindOne(context.Background(), bson.M{"email": emailRegex}, opts).Decode(&user)
	if err != nil {
		logger.Warnf("Login failed: user not found (email=%s)", req.Email)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	if !user.Active {
		logger.Warnf("Login failed: account deactivated (email=%s)", req.Email)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Account is deactivated"})
		return
	}

	if !utils.CheckPassword(req.Password, user.Password) {
		logger.Warnf("Login failed: invalid password (email=%s)", req.Email)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	token, err := utils.GenerateToken(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	logger.Infof("Logged in: %s (role=%s)", user.Email, user.Role)
	utils.Log(context.Background(), user.ID.Hex(), user.Email, string(user.Role),
		models.AuditUserLogin, user.ID.Hex(), "user", "Logged in", nil)

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  toUserResponse(&user),
	})
}

// Register creates a new user account
func Register(c *gin.Context) {
	if !IsSignupEnabled() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Registration is currently disabled"})
		return
	}

	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
		Role:      models.RoleCustomer,
		Active:    true,
		CreatedAt: now,
		UpdatedAt: now,
	}

	_, err = col.InsertOne(context.Background(), user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	token, err := utils.GenerateToken(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"token": token,
		"user":  toUserResponse(&user),
	})
}

// GoogleAuth handles Google OAuth login/register (Authorization Code Flow)
func GoogleAuth(c *gin.Context) {
	var req GoogleAuthRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	conf := &oauth2.Config{
		ClientID:     config.AppConfig.GoogleClientID,
		ClientSecret: config.AppConfig.GoogleClientSecret,
		RedirectURL:  "postmessage", // Matches the frontend's redirect URI for auth-code flow
		Scopes:       []string{"https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"},
		Endpoint:     google.Endpoint,
	}

	// Exchange the authorization code for a token
	tok, err := conf.Exchange(context.Background(), req.Code)
	if err != nil {
		logger.Warnf("Google OAuth code exchange failed: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Failed to exchange authorization code"})
		return
	}

	// Create an HTTP client using the token
	client := conf.Client(context.Background(), tok)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v3/userinfo")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user info"})
		return
	}
	defer resp.Body.Close()

	var googleUser struct {
		Email     string `json:"email"`
		FirstName string `json:"given_name"`
		LastName  string `json:"family_name"`
		Picture   string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&googleUser); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode user info"})
		return
	}

	col := database.DB.Collection("users")
	var user models.User
	err = col.FindOne(context.Background(), bson.M{"email": strings.ToLower(googleUser.Email)}).Decode(&user)
	if err != nil {
		// Create new user
		now := time.Now()
		user = models.User{
			ID:         primitive.NewObjectID(),
			Email:      strings.ToLower(googleUser.Email),
			FirstName:  googleUser.FirstName,
			LastName:   googleUser.LastName,
			Role:       models.RoleCustomer,
			Active:     true,
			CreatedAt:  now,
			UpdatedAt:  now,
			ProfileURL: googleUser.Picture,
		}
		_, err = col.InsertOne(context.Background(), user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
			return
		}
		logger.Infof("Created new user via Google OAuth (Auth Code Flow): %s", googleUser.Email)
	}

	token, err := utils.GenerateToken(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  toUserResponse(&user),
	})
}

// Logout logs the logout event (client should clear token after calling)
func Logout(c *gin.Context) {
	userID := c.GetString("user_id")
	userEmail := c.GetString("user_email")
	userRole := c.GetString("user_role")
	logger.Infof("Logged out: %s", userEmail)
	utils.Log(context.Background(), userID, userEmail, userRole,
		models.AuditUserLogout, userID, "user", "Logged out", nil)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out"})
}

// Me returns the current authenticated user
func Me(c *gin.Context) {
	userID := c.GetString("user_id")
	id, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user"})
		return
	}
	col := database.DB.Collection("users")
	var user models.User
	err = col.FindOne(context.Background(), bson.M{"_id": id}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": toUserResponse(&user)})
}

func toUserResponse(u *models.User) gin.H {
	return gin.H{
		"id":          u.ID.Hex(),
		"email":       u.Email,
		"firstName":   u.FirstName,
		"lastName":    u.LastName,
		"role":        string(u.Role),
		"group":       u.Group,
		"active":      u.Active,
		"profileUrl":  u.ProfileURL,
		"hasPassword": u.Password != "",
	}
}
