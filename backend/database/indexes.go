package database

import (
	"context"

	"perfume-store/logger"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// EnsureIndexes creates indexes for products, orders, users, and audit_logs to improve query performance.
func EnsureIndexes(ctx context.Context) error {
	if DB == nil {
		return nil
	}

	// products: list/filter by active, category, created_at, seasonal_flag, new_arrival, on_sale
	products := DB.Collection("products")
	for _, idx := range []mongo.IndexModel{
		{Keys: bson.D{{Key: "active", Value: 1}, {Key: "created_at", Value: -1}}, Options: options.Index().SetName("active_created_at")},
		{Keys: bson.D{{Key: "category", Value: 1}}, Options: options.Index().SetName("category")},
		{Keys: bson.D{{Key: "seasonal_flag", Value: 1}}, Options: options.Index().SetName("seasonal_flag")},
		{Keys: bson.D{{Key: "new_arrival", Value: 1}}, Options: options.Index().SetName("new_arrival")},
		{Keys: bson.D{{Key: "on_sale", Value: 1}}, Options: options.Index().SetName("on_sale")},
		{Keys: bson.D{{Key: "rating", Value: -1}}, Options: options.Index().SetName("rating")},
	} {
		if _, err := products.Indexes().CreateOne(ctx, idx); err != nil {
			logger.Warnf("products index: %v", err)
		}
	}

	// orders: user_id, created_at, order_number, status
	orders := DB.Collection("orders")
	for _, idx := range []mongo.IndexModel{
		{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "created_at", Value: -1}}, Options: options.Index().SetName("user_created")},
		{Keys: bson.D{{Key: "order_number", Value: 1}}, Options: options.Index().SetName("order_number")},
		{Keys: bson.D{{Key: "status", Value: 1}}, Options: options.Index().SetName("status")},
	} {
		if _, err := orders.Indexes().CreateOne(ctx, idx); err != nil {
			logger.Warnf("orders index: %v", err)
		}
	}

	// users: email unique, role
	users := DB.Collection("users")
	if _, err := users.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true).SetName("email_unique"),
	}); err != nil {
		logger.Warnf("users email index: %v", err)
	}
	if _, err := users.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "role", Value: 1}}, Options: options.Index().SetName("role"),
	}); err != nil {
		logger.Warnf("users role index: %v", err)
	}

	// stores: active for public locator
	stores := DB.Collection("stores")
	if _, err := stores.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "active", Value: 1}, {Key: "name", Value: 1}},
		Options: options.Index().SetName("active_name"),
	}); err != nil {
		logger.Warnf("stores index: %v", err)
	}

	// product_reviews: product_id + created_at for listing (multiple reviews per user per product allowed)
	reviews := DB.Collection("product_reviews")
	_, _ = reviews.Indexes().DropOne(ctx, "product_user_unique")
	if _, err := reviews.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "product_id", Value: 1}, {Key: "created_at", Value: -1}},
		Options: options.Index().SetName("product_created"),
	}); err != nil {
		logger.Warnf("product_reviews index: %v", err)
	}

	// audit_logs: created_at, actor_id, action
	audit := DB.Collection("audit_logs")
	for _, idx := range []mongo.IndexModel{
		{Keys: bson.D{{Key: "created_at", Value: -1}}, Options: options.Index().SetName("created_at")},
		{Keys: bson.D{{Key: "actor_id", Value: 1}}, Options: options.Index().SetName("actor_id")},
		{Keys: bson.D{{Key: "action", Value: 1}}, Options: options.Index().SetName("action")},
	} {
		if _, err := audit.Indexes().CreateOne(ctx, idx); err != nil {
			logger.Warnf("audit_logs index: %v", err)
		}
	}

	logger.Info("Ensured MongoDB indexes")
	return nil
}
