package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type AuditAction string

const (
	AuditProductCreate      AuditAction = "product_create"
	AuditProductUpdate      AuditAction = "product_update"
	AuditProductDelete      AuditAction = "product_delete"
	AuditOrderStatus        AuditAction = "order_status"
	AuditOrderPlace         AuditAction = "order_place"
	AuditUserUpdate         AuditAction = "user_update"
	AuditUserPasswordReset  AuditAction = "user_password_reset"
	AuditUserPasswordChange AuditAction = "user_password_change"
	AuditUserLogin          AuditAction = "user_login"
	AuditUserLogout         AuditAction = "user_logout"
)

type AuditLog struct {
	ID         primitive.ObjectID     `bson:"_id,omitempty" json:"id"`
	ActorID    string                 `bson:"actor_id" json:"actorId"`
	ActorEmail string                 `bson:"actor_email" json:"actorEmail"`
	ActorRole  string                 `bson:"actor_role" json:"actorRole"`
	Action     AuditAction            `bson:"action" json:"action"`
	TargetID   string                 `bson:"target_id" json:"targetId"`
	TargetType string                 `bson:"target_type,omitempty" json:"targetType"`
	Summary    string                 `bson:"summary,omitempty" json:"summary"`
	Details    map[string]interface{} `bson:"details,omitempty" json:"details"`
	CreatedAt  time.Time              `bson:"created_at" json:"createdAt"`
}
