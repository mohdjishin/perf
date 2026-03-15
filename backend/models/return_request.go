package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ReturnRequestStatus string

const (
	ReturnStatusPending  ReturnRequestStatus = "pending"
	ReturnStatusAccepted ReturnRequestStatus = "accepted"
	ReturnStatusRejected ReturnRequestStatus = "rejected"
)

// ReturnRequest is a customer request to return a delivered order. Admin must accept it; then product received and refund are tracked.
type ReturnRequest struct {
	ID                primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	OrderID           primitive.ObjectID  `bson:"order_id" json:"orderId"`
	UserID            primitive.ObjectID  `bson:"user_id" json:"userId"`
	Reason            string              `bson:"reason" json:"reason"`                                // code from predefined list
	ReasonOther       string              `bson:"reason_other,omitempty" json:"reasonOther,omitempty"` // free text when reason is "other"
	Status            ReturnRequestStatus `bson:"status" json:"status"`
	CreatedAt         time.Time           `bson:"created_at" json:"createdAt"`
	UpdatedAt         time.Time           `bson:"updated_at" json:"updatedAt"`
	ReviewedBy        string              `bson:"reviewed_by,omitempty" json:"reviewedBy,omitempty"`
	ReviewedAt        *time.Time          `bson:"reviewed_at,omitempty" json:"reviewedAt,omitempty"`
	ProductReceivedAt *time.Time          `bson:"product_received_at,omitempty" json:"productReceivedAt,omitempty"`
	RefundIssuedAt    *time.Time          `bson:"refund_issued_at,omitempty" json:"refundIssuedAt,omitempty"`
}

// DefaultReturnReasons are the selectable reasons for return (code + label for API).
var DefaultReturnReasons = []struct {
	Code  string `json:"code"`
	Label string `json:"label"`
}{
	{Code: "defective", Label: "Defective or not working"},
	{Code: "wrong_item", Label: "Wrong item received"},
	{Code: "damaged_in_shipping", Label: "Damaged in shipping"},
	{Code: "not_as_described", Label: "Not as described"},
	{Code: "changed_mind", Label: "Changed my mind"},
	{Code: "other", Label: "Other"},
}
