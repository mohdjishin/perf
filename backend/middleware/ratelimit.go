package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimitConfig configures per-IP rate limiting.
type RateLimitConfig struct {
	Requests int           // max requests per window
	Window   time.Duration // time window
}

type rateLimitEntry struct {
	count  int
	expiry time.Time
}

// RateLimit returns a middleware that limits requests per client IP.
// Uses an in-memory store; suitable for single-instance deployment.
func RateLimit(cfg RateLimitConfig) gin.HandlerFunc {
	mu := sync.Mutex{}
	store := make(map[string]*rateLimitEntry)
	go func() {
		tick := time.NewTicker(cfg.Window)
		defer tick.Stop()
		for range tick.C {
			mu.Lock()
			now := time.Now()
			for k, v := range store {
				if now.After(v.expiry) {
					delete(store, k)
				}
			}
			mu.Unlock()
		}
	}()
	return func(c *gin.Context) {
		ip := c.ClientIP()
		mu.Lock()
		entry, ok := store[ip]
		now := time.Now()
		if !ok || now.After(entry.expiry) {
			entry = &rateLimitEntry{count: 1, expiry: now.Add(cfg.Window)}
			store[ip] = entry
		} else {
			entry.count++
			if entry.count > cfg.Requests {
				mu.Unlock()
				c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests. Try again later."})
				return
			}
		}
		mu.Unlock()
		c.Next()
	}
}
