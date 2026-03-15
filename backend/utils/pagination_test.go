package utils

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestGetPageLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		query    string
		wantPage int
		wantLim  int
	}{
		{"", 1, 12},
		{"?page=2", 2, 12},
		{"?limit=5", 1, 5},
		{"?page=3&limit=25", 3, 25},
		{"?page=0&limit=0", 1, 12},
		{"?page=-1", 1, 12},
		{"?limit=200", 1, 100},
		{"?page=abc&limit=xyz", 1, 12},
	}
	for _, tt := range tests {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/foo"+tt.query, nil)
		page, limit := GetPageLimit(c)
		if page != tt.wantPage || limit != tt.wantLim {
			t.Errorf("GetPageLimit(%q) = %d, %d; want %d, %d", tt.query, page, limit, tt.wantPage, tt.wantLim)
		}
	}
}
