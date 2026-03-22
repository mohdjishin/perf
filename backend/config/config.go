package config

import (
	"encoding/json"
	"os"
	"strconv"
	"strings"

	"perfume-store/logger"
)

type Config struct {
	Port                 string   `json:"port"`
	Host                 string   `json:"host"` // bind address, e.g. "127.0.0.1" or "0.0.0.0" for LAN
	MongoURI             string   `json:"mongo_uri"`
	JWTSecret            string   `json:"jwt_secret"`
	CORSOrigin           string   `json:"cors_origin"`  // single origin (backward compatible)
	CORSOrigins          []string `json:"cors_origins"` // multiple origins when frontend on different hosts
	AppEnv               string   `json:"app_env"`      // "production" to disable dev-only behavior (e.g. sample product seeding)
	GoogleClientID       string   `json:"google_client_id"`
	GoogleClientSecret   string   `json:"google_client_secret"`
	StripeSecretKey      string   `json:"stripe_secret_key"`
	StripePublishableKey string   `json:"stripe_publishable_key"`
	StripeWebhookSecret  string   `json:"stripe_webhook_secret"`
	FrontendURL          string   `json:"frontend_url"`
	HomeCacheTTL         int      `json:"home_cache_ttl"` // in seconds
}

var AppConfig *Config

func Load(configPath string) {
	// 1. Set Hardcoded Dummy Defaults
	AppConfig = &Config{
		Port:                 "8080",
		Host:                 "127.0.0.1",
		MongoURI:             "mongodb://localhost:27017",
		JWTSecret:            "dummy-secret-change-me",
		CORSOrigin:           "http://localhost:5173",
		AppEnv:               "development",
		GoogleClientID:       "dummy-client-id",
		GoogleClientSecret:   "dummy-client-secret",
		StripeSecretKey:      "sk_test_dummy",
		StripePublishableKey: "pk_test_dummy",
		StripeWebhookSecret:  "whsec_dummy",
		FrontendURL:          "http://localhost:5173",
		HomeCacheTTL:         300,
	}

	// 2. Try to load from config.json (if it exists)
	if configPath == "" {
		configPath = "config.json"
	}
	if data, err := os.ReadFile(configPath); err == nil {
		var jsonConfig Config
		if err := json.Unmarshal(data, &jsonConfig); err == nil {
			// Merge JSON values if they are not empty
			if jsonConfig.Port != "" {
				AppConfig.Port = jsonConfig.Port
			}
			if jsonConfig.Host != "" {
				AppConfig.Host = jsonConfig.Host
			}
			if jsonConfig.MongoURI != "" {
				AppConfig.MongoURI = jsonConfig.MongoURI
			}
			if jsonConfig.JWTSecret != "" {
				AppConfig.JWTSecret = jsonConfig.JWTSecret
			}
			if jsonConfig.CORSOrigin != "" {
				AppConfig.CORSOrigin = jsonConfig.CORSOrigin
			}
			if len(jsonConfig.CORSOrigins) > 0 {
				AppConfig.CORSOrigins = jsonConfig.CORSOrigins
			}
			if jsonConfig.AppEnv != "" {
				AppConfig.AppEnv = jsonConfig.AppEnv
			}
			if jsonConfig.GoogleClientID != "" {
				AppConfig.GoogleClientID = jsonConfig.GoogleClientID
			}
			if jsonConfig.GoogleClientSecret != "" {
				AppConfig.GoogleClientSecret = jsonConfig.GoogleClientSecret
			}
			if jsonConfig.StripeSecretKey != "" {
				AppConfig.StripeSecretKey = jsonConfig.StripeSecretKey
			}
			if jsonConfig.StripePublishableKey != "" {
				AppConfig.StripePublishableKey = jsonConfig.StripePublishableKey
			}
			if jsonConfig.StripeWebhookSecret != "" {
				AppConfig.StripeWebhookSecret = jsonConfig.StripeWebhookSecret
			}
			if jsonConfig.FrontendURL != "" {
				AppConfig.FrontendURL = jsonConfig.FrontendURL
			}
			if jsonConfig.HomeCacheTTL > 0 {
				AppConfig.HomeCacheTTL = jsonConfig.HomeCacheTTL
			}
		}
	}

	// 3. Override with Environment Variables (Highest Priority)
	if env := os.Getenv("PORT"); env != "" {
		AppConfig.Port = env
	}
	if env := os.Getenv("HOST"); env != "" {
		AppConfig.Host = env
	}
	if env := os.Getenv("MONGO_URI"); env != "" {
		AppConfig.MongoURI = env
	}
	if env := os.Getenv("JWT_SECRET"); env != "" {
		AppConfig.JWTSecret = env
	}
	if env := os.Getenv("APP_ENV"); env != "" {
		AppConfig.AppEnv = env
	}
	if env := os.Getenv("CORS_ORIGINS"); env != "" {
		AppConfig.CORSOrigins = strings.Split(env, ",")
		for i, v := range AppConfig.CORSOrigins {
			AppConfig.CORSOrigins[i] = strings.TrimSpace(v)
		}
	} else if env := os.Getenv("CORS_ORIGIN"); env != "" {
		AppConfig.CORSOrigin = env
	}
	if env := os.Getenv("GOOGLE_CLIENT_ID"); env != "" {
		AppConfig.GoogleClientID = env
	}
	if env := os.Getenv("GOOGLE_CLIENT_SECRET"); env != "" {
		AppConfig.GoogleClientSecret = env
	}
	if env := os.Getenv("STRIPE_SECRET_KEY"); env != "" {
		AppConfig.StripeSecretKey = env
	}
	if env := os.Getenv("STRIPE_PUBLISHABLE_KEY"); env != "" {
		AppConfig.StripePublishableKey = env
	}
	if env := os.Getenv("STRIPE_WEBHOOK_SECRET"); env != "" {
		AppConfig.StripeWebhookSecret = env
	}
	if env := os.Getenv("FRONTEND_URL"); env != "" {
		AppConfig.FrontendURL = env
	}
	if env := os.Getenv("HOME_CACHE_TTL"); env != "" {
		if val, err := strconv.Atoi(env); err == nil && val > 0 {
			AppConfig.HomeCacheTTL = val
		}
	}

	// Production safety check (Optional, but good practice)
	if AppConfig.AppEnv == "production" && (AppConfig.JWTSecret == "" || AppConfig.JWTSecret == "dummy-secret-change-me") {
		logger.Infof("WARNING: Running in production with a dummy JWT secret!")
	}
}

// AllowedCORSOrigins returns the list of origins allowed for CORS. Uses cors_origins if set, else cors_origin.
func AllowedCORSOrigins() []string {
	if len(AppConfig.CORSOrigins) > 0 {
		return AppConfig.CORSOrigins
	}
	return []string{AppConfig.CORSOrigin}
}
