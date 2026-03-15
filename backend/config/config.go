package config

import (
	"encoding/json"
	"os"
	"strings"

	"perfume-store/logger"
)

type Config struct {
	Port               string   `json:"port"`
	Host               string   `json:"host"` // bind address, e.g. "127.0.0.1" or "0.0.0.0" for LAN
	MongoURI           string   `json:"mongo_uri"`
	JWTSecret          string   `json:"jwt_secret"`
	CORSOrigin         string   `json:"cors_origin"`  // single origin (backward compatible)
	CORSOrigins        []string `json:"cors_origins"` // multiple origins when frontend on different hosts
	AppEnv             string   `json:"app_env"`      // "production" to disable dev-only behavior (e.g. sample product seeding)
	GoogleClientID     string   `json:"google_client_id"`
	GoogleClientSecret string   `json:"google_client_secret"`
}

var AppConfig *Config

func Load(configPath string) {
	// 1. Set Hardcoded Dummy Defaults
	AppConfig = &Config{
		Port:               "8080",
		Host:               "127.0.0.1",
		MongoURI:           "mongodb://localhost:27017",
		JWTSecret:          "dummy-secret-change-me",
		CORSOrigin:         "http://localhost:5173",
		AppEnv:             "development",
		GoogleClientID:     "dummy-client-id",
		GoogleClientSecret: "dummy-client-secret",
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
