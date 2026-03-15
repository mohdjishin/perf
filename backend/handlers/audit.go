package handlers

import (
	"context"
	"net/http"
	"strings"

	"perfume-store/database"
	"perfume-store/models"
	"perfume-store/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// enrichOrderNumber adds order_number to audit log details from orders collection when missing
func enrichOrderNumber(ctx context.Context, logs []models.AuditLog) {
	ordersCol := database.DB.Collection("orders")
	auditCol := database.DB.Collection("audit_logs")

	for i := range logs {
		if logs[i].Action != models.AuditOrderPlace && logs[i].Action != models.AuditOrderStatus {
			continue
		}
		d := logs[i].Details
		if d == nil {
			d = make(map[string]interface{})
			logs[i].Details = d
		}
		if s, _ := d["orderNumber"].(string); s != "" && strings.HasPrefix(s, "ORD-") {
			continue // already has valid order number
		}
		targetID := logs[i].TargetID
		if targetID == "" {
			continue
		}
		oid, err := primitive.ObjectIDFromHex(targetID)
		if err != nil {
			continue
		}
		var order struct {
			OrderNumber string `bson:"order_number"`
		}
		if err := ordersCol.FindOne(ctx, bson.M{"_id": oid}).Decode(&order); err != nil {
			continue
		}
		if order.OrderNumber != "" {
			d["orderNumber"] = order.OrderNumber
			// Persist to DB so future reads don't need lookup
			auditCol.UpdateOne(ctx, bson.M{"_id": logs[i].ID}, bson.M{"$set": bson.M{"details.orderNumber": order.OrderNumber}})
		}
	}
}

// ListAuditLogs returns audit log entries (super_admin only). Optional ?actor_id= filters by actor.
func ListAuditLogs(c *gin.Context) {
	col := database.DB.Collection("audit_logs")
	filter := bson.M{}

	if actorID := c.Query("actor_id"); actorID != "" {
		filter["actor_id"] = actorID
	}
	if actorRole := c.Query("actor_role"); actorRole != "" {
		if actorRole == "admin" {
			filter["actor_role"] = bson.M{"$in": []string{"admin", "super_admin"}}
		} else if actorRole == "customer" {
			filter["actor_role"] = bson.M{"$in": []string{"customer", "user"}}
		} else {
			filter["actor_role"] = actorRole
		}
	}

	page, limit := utils.GetPageLimit(c)
	if limit > 50 {
		limit = 50
	}
	skip := (page - 1) * limit

	total, _ := col.CountDocuments(context.Background(), filter)
	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64(skip)).
		SetLimit(int64(limit))
	cursor, err := col.Find(context.Background(), filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cursor.Close(context.Background())

	var logs []models.AuditLog
	if err := cursor.All(context.Background(), &logs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Infer actor_role for old logs that don't have it (fix: admin actions marked as user)
	for i := range logs {
		if logs[i].ActorRole == "" {
			if logs[i].Action == models.AuditOrderPlace {
				logs[i].ActorRole = "customer"
			} else {
				logs[i].ActorRole = "admin"
			}
		}
	}

	// Enrich order_number from orders collection for order_place/order_status (DB-level consistency)
	enrichOrderNumber(context.Background(), logs)

	totalPages := int((total + int64(limit) - 1) / int64(limit))
	if totalPages < 1 {
		totalPages = 1
	}
	c.JSON(http.StatusOK, gin.H{
		"items":      logs,
		"total":      total,
		"page":       page,
		"limit":      limit,
		"totalPages": totalPages,
	})
}
