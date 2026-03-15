package middleware

import (
	"net/http"

	"perfume-store/models"

	"github.com/gin-gonic/gin"
)

// RequireRole restricts access to users with one of the given roles
func RequireRole(roles ...models.Role) gin.HandlerFunc {
	roleSet := make(map[models.Role]bool)
	for _, r := range roles {
		roleSet[r] = true
	}
	return func(c *gin.Context) {
		roleVal, exists := c.Get("user_role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}
		roleStr, _ := roleVal.(string)
		role := models.Role(roleStr)
		if !roleSet[role] {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: insufficient permissions"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// RequireAdmin allows admin and super_admin
func RequireAdmin() gin.HandlerFunc {
	return RequireRole(models.RoleAdmin, models.RoleSuperAdmin)
}

// RequireSuperAdmin allows only super_admin (user management)
func RequireSuperAdmin() gin.HandlerFunc {
	return RequireRole(models.RoleSuperAdmin)
}

// RequireAdminOnly allows admin only (products, orders) - NOT super_admin
func RequireAdminOnly() gin.HandlerFunc {
	return RequireRole(models.RoleAdmin)
}
