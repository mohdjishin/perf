package routes

import (
	"time"

	"perfume-store/handlers"
	"perfume-store/middleware"
	"perfume-store/models"

	"github.com/gin-gonic/gin"
)

// Setup configures all API routes
func Setup(r *gin.Engine) {
	r.GET("/ping", handlers.Ping)
	r.GET("/health", handlers.Health)

	api := r.Group("/api")
	{
		api.GET("/health", handlers.Health)
		authRateLimit := middleware.RateLimit(middleware.RateLimitConfig{Requests: 10, Window: time.Minute})
		api.POST("/auth/login", authRateLimit, handlers.Login)
		api.POST("/auth/register", authRateLimit, handlers.Register)
		api.POST("/auth/google", authRateLimit, handlers.GoogleAuth)

		api.GET("/products", middleware.OptionalAuth(), handlers.ListProducts)
		api.GET("/products/seasonal-flags", handlers.ListSeasonalFlags)
		api.GET("/products/:id", middleware.OptionalAuth(), handlers.GetProduct)
		api.GET("/products/:id/reviews", middleware.OptionalAuth(), handlers.ListProductReviews)
		api.GET("/categories", handlers.ListCategories)
		api.GET("/home", middleware.OptionalAuth(), handlers.GetHomePayload)
		api.GET("/settings/features", middleware.OptionalAuth(), handlers.GetFeatureFlags)
		api.GET("/banners/seasonal-sale", handlers.GetSeasonalSaleBanner)
		api.GET("/stores", handlers.ListStores)
		api.GET("/return-reasons", handlers.GetReturnReasons)
		api.POST("/stripe/webhook", handlers.StripeWebhook)

		auth := api.Group("")
		auth.Use(middleware.Auth())
		{
			auth.GET("/auth/me", handlers.Me)
			auth.POST("/auth/logout", handlers.Logout)
			auth.PUT("/auth/password", handlers.ChangePassword)

			auth.GET("/orders", handlers.ListOrders)
			auth.GET("/orders/fee-estimate", handlers.GetOrderFeeEstimate)
			auth.GET("/orders/:id/return", handlers.GetOrderReturnRequest)
			auth.POST("/orders/:id/return", handlers.CreateReturnRequest)
			auth.GET("/orders/:id", handlers.GetOrder)
			auth.POST("/orders", handlers.CreateOrder)
			auth.GET("/stripe/session-status", handlers.GetCheckoutSessionStatus)
		}

		// Admin + super_admin: add/edit/delete products (make inactive), orders, categories
		adminGroup := api.Group("")
		adminGroup.Use(middleware.Auth(), middleware.RequireAdmin())
		{
			adminGroup.POST("/products", handlers.CreateProduct)
			adminGroup.PUT("/products/:id", handlers.UpdateProduct)
			adminGroup.DELETE("/products/:id", handlers.DeleteProduct)
			adminGroup.POST("/upload", handlers.UploadImage)
			adminGroup.GET("/uploads", handlers.ListUploads)
			adminGroup.DELETE("/uploads/:filename", handlers.DeleteUpload)
			adminGroup.PUT("/orders/:id/status", handlers.UpdateOrderStatus)
			adminGroup.POST("/categories", handlers.CreateCategory)
			adminGroup.PUT("/categories/:id", handlers.UpdateCategory)
			adminGroup.DELETE("/categories/by-name/:name", handlers.DeleteCategoryByName)
			adminGroup.DELETE("/categories/:id", handlers.DeleteCategory)
			adminGroup.DELETE("/reviews/:id", handlers.DeleteReview)
			adminGroup.GET("/admin/stats", handlers.AdminStats)
			adminGroup.GET("/admin/product-check", handlers.ProductCheck)
			adminGroup.GET("/admin/reviews", handlers.ListAdminReviews)
			adminGroup.PATCH("/admin/reviews/:id/read", handlers.MarkReviewRead)
			adminGroup.GET("/admin/return-requests", handlers.ListReturnRequests)
			adminGroup.PATCH("/admin/return-requests/:id", handlers.UpdateReturnRequest)
		}

		// User only: saved addresses, reverse geocode (not admin/super_admin)
		userOnly := api.Group("")
		userOnly.Use(middleware.Auth(), middleware.RequireRole(models.RoleCustomer))
		{
			userOnly.GET("/addresses", handlers.ListAddresses)
			userOnly.POST("/addresses", handlers.CreateAddress)
			userOnly.POST("/products/:id/reviews", handlers.CreateReview)
			userOnly.PUT("/addresses/:id", handlers.UpdateAddress)
			userOnly.DELETE("/addresses/:id", handlers.DeleteAddress)
			userOnly.GET("/geocode/reverse", handlers.ReverseGeocode)
		}

		// Super Admin only: users, audit, feature flags
		superAdmin := api.Group("")
		superAdmin.Use(middleware.Auth(), middleware.RequireSuperAdmin())
		{
			superAdmin.GET("/users", handlers.ListUsers)
			superAdmin.POST("/users", handlers.CreateUser)
			superAdmin.GET("/users/:id", handlers.GetUser)
			superAdmin.PUT("/users/:id", handlers.UpdateUser)
			superAdmin.PUT("/users/:id/password", handlers.AdminResetUserPassword)
			superAdmin.GET("/audit", handlers.ListAuditLogs)
			superAdmin.GET("/analytics/sales", handlers.GetSalesAnalytics)
			superAdmin.GET("/settings/order-fee", handlers.GetOrderFeeConfig)
			superAdmin.PUT("/settings/order-fee", handlers.UpdateOrderFeeConfig)
			superAdmin.PUT("/settings/features", handlers.UpdateFeatureFlags)
			superAdmin.PUT("/banners/seasonal-sale", handlers.UpdateSeasonalSaleBanner)
			superAdmin.GET("/stores/admin", handlers.ListStoresAdmin)
			superAdmin.POST("/stores", handlers.CreateStore)
			superAdmin.PUT("/stores/:id", handlers.UpdateStore)
			superAdmin.DELETE("/stores/:id", handlers.DeleteStore)
		}
	}
}
