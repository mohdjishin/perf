package middleware

import (
	"perfume-store/logger"

	"github.com/gin-gonic/gin"
)

// ErrorLogger logs 5xx responses and panics
func ErrorLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
		if c.Writer.Status() >= 500 {
			logger.Errorf("%s %s -> %d", c.Request.Method, c.Request.URL.Path, c.Writer.Status())
		}
	}
}
