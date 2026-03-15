package middleware

import (
	"time"

	"perfume-store/logger"

	"github.com/gin-gonic/gin"
)

// RequestLogger logs every HTTP request with method, path, status, duration, and client IP
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method
		clientIP := c.ClientIP()

		c.Next()

		status := c.Writer.Status()
		duration := time.Since(start).Milliseconds()
		logger.Request(method, path, clientIP, status, duration)
	}
}
