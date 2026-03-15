package utils

import (
	"strconv"

	"github.com/gin-gonic/gin"
)

const defaultPage = 1
const defaultLimit = 12
const maxLimit = 100

// GetPageLimit parses page and limit from query params with sensible defaults
func GetPageLimit(c *gin.Context) (page, limit int) {
	page = defaultPage
	limit = defaultLimit
	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			if v > maxLimit {
				v = maxLimit
			}
			limit = v
		}
	}
	return page, limit
}
