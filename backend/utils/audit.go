package utils

import (
	"context"
	"time"

	"perfume-store/database"
	"perfume-store/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Log records an audit entry with actor role for grouping
func Log(ctx context.Context, actorID, actorEmail, actorRole string, action models.AuditAction, targetID, targetType, summary string, details map[string]interface{}) {
	if database.DB == nil {
		return
	}
	entry := models.AuditLog{
		ID:         primitive.NewObjectID(),
		ActorID:    actorID,
		ActorEmail: actorEmail,
		ActorRole:  actorRole,
		Action:     action,
		TargetID:   targetID,
		TargetType: targetType,
		Summary:    summary,
		Details:    details,
		CreatedAt:  time.Now(),
	}
	_, _ = database.DB.Collection("audit_logs").InsertOne(ctx, entry)
}
