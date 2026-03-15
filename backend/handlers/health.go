package handlers

import (
	"context"
	"net/http"

	"perfume-store/database"

	"github.com/gin-gonic/gin"
)

// Ping returns 200 if the server is up (no DB check)
func Ping(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// Health checks MongoDB connectivity and returns status
func Health(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "unhealthy",
			"error":   "database client not initialized",
			"message": "MongoDB connection failed",
		})
		return
	}
	if err := database.Client.Ping(context.Background(), nil); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "unhealthy",
			"error":   err.Error(),
			"message": "MongoDB connection failed",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status":   "healthy",
		"database": "connected",
	})
}
