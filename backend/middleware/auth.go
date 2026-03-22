package middleware

import (
	"net/http"
	"strings"

	"perfume-store/database"
	"perfume-store/logger"
	"perfume-store/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// OptionalAuth parses the JWT if present and sets user claims in context; never aborts.
// Used by GET /products and GET /products/:id so those routes stay public (no 401) but can
// tailor response by role: admin/super_admin see all products including inactive; others see active only.
func OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.Next()
			return
		}
		claims, err := utils.ParseToken(parts[1])
		if err != nil {
			c.Next()
			return
		}

		// Security: verify user is still Active in database if they claim to be logged in
		uid, errOid := primitive.ObjectIDFromHex(claims.UserID)
		if errOid == nil {
			col := database.DB.Collection("users")
			var user struct {
				Active bool `bson:"active"`
			}
			if err := col.FindOne(c.Request.Context(), bson.M{"_id": uid}, options.FindOne().SetProjection(bson.M{"active": 1})).Decode(&user); err == nil {
				if user.Active {
					c.Set("claims", claims)
					c.Set("user_id", claims.UserID)
					c.Set("user_email", claims.Email)
					c.Set("user_role", string(claims.Role))
				} else {
					logger.Warnf("OptionalAuth: deactivated user attempted access: email=%s id=%s", claims.Email, claims.UserID)
				}
			}
		}

		c.Next()
	}
}

// Auth extracts and validates JWT from Authorization header, sets user claims in context
func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format"})
			c.Abort()
			return
		}

		claims, err := utils.ParseToken(parts[1])
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// Security: verify user is still Active in database
		uid, errOid := primitive.ObjectIDFromHex(claims.UserID)
		if errOid != nil {
			logger.Warnf("Auth check failed (invalid ID hex): email=%s id=%s err=%v", claims.Email, claims.UserID, errOid)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user identification"})
			c.Abort()
			return
		}

		col := database.DB.Collection("users")
		var user struct {
			Active bool `bson:"active"`
		}
		if err := col.FindOne(c.Request.Context(), bson.M{"_id": uid}, options.FindOne().SetProjection(bson.M{"active": 1})).Decode(&user); err != nil {
			logger.Warnf("Auth check failed (user not found): email=%s id=%s err=%v", claims.Email, claims.UserID, err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User account no longer valid"})
			c.Abort()
			return
		}
		if !user.Active {
			logger.Warnf("Auth check failed (deactivated): email=%s id=%s", claims.Email, claims.UserID)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Account deactivated"})
			c.Abort()
			return
		}

		c.Set("claims", claims)
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("user_role", string(claims.Role))
		c.Next()
	}
}
