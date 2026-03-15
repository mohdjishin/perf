package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type OrderStatus string

const (
	OrderPending   OrderStatus = "pending"
	OrderPaid      OrderStatus = "paid"
	OrderShipped   OrderStatus = "shipped"
	OrderDelivered OrderStatus = "delivered"
	OrderCancelled OrderStatus = "cancelled"
)

type PaymentStatus string

const (
	PaymentUnpaid PaymentStatus = "unpaid"
	PaymentPaid   PaymentStatus = "paid"
)

// OrderItem is a snapshot at order placement. Price and name must not be updated from the product catalog later.
type OrderItem struct {
	ProductID primitive.ObjectID `bson:"product_id" json:"productId"`
	Name      string             `bson:"name" json:"name"`
	Price     float64            `bson:"price" json:"price"` // price at time of order; do not recalculate from product
	Quantity  int                `bson:"quantity" json:"quantity"`
	ImageURL  string             `bson:"image_url" json:"imageUrl"`
}

// FeeBreakdownLine is one line in the order fee breakdown (e.g. Shipping, Tax, Discount).
type FeeBreakdownLine struct {
	Label  string  `bson:"label" json:"label"`
	Amount float64 `bson:"amount" json:"amount"` // positive = charge, negative = discount
}

// ShippingHistoryEntry is a single update in the shipping timeline
type ShippingHistoryEntry struct {
	Message   string    `bson:"message" json:"message"`
	CreatedAt time.Time `bson:"created_at" json:"createdAt"`
	UpdatedBy string    `bson:"updated_by,omitempty" json:"updatedBy,omitempty"`
}

type Order struct {
	ID              primitive.ObjectID     `bson:"_id,omitempty" json:"id"`
	OrderNumber     string                 `bson:"order_number" json:"orderNumber"`
	UserID          primitive.ObjectID     `bson:"user_id" json:"userId"`
	Items           []OrderItem            `bson:"items" json:"items"`
	Subtotal        float64                `bson:"subtotal,omitempty" json:"subtotal,omitempty"`          // stored at placement; do not recalculate
	Fee             float64                `bson:"fee,omitempty" json:"fee,omitempty"`                    // net of all fee/discount lines at placement
	FeeBreakdown    []FeeBreakdownLine     `bson:"fee_breakdown,omitempty" json:"feeBreakdown,omitempty"` // stored at placement
	Total           float64                `bson:"total" json:"total"`                                    // stored at placement; do not recalculate
	Status          OrderStatus            `bson:"status" json:"status"`
	PaymentStatus   PaymentStatus          `bson:"payment_status,omitempty" json:"paymentStatus,omitempty"`
	ShippingHistory []ShippingHistoryEntry `bson:"shipping_history,omitempty" json:"shippingHistory,omitempty"`
	Address         Address                `bson:"address" json:"address"`
	DeliveredAt     *time.Time             `bson:"delivered_at,omitempty" json:"deliveredAt,omitempty"` // set when status becomes delivered (for return window)
	CreatedAt       time.Time              `bson:"created_at" json:"createdAt"`
	UpdatedAt       time.Time              `bson:"updated_at" json:"updatedAt"`
}

type Address struct {
	Street  string `bson:"street" json:"street"`
	City    string `bson:"city" json:"city"`
	State   string `bson:"state" json:"state"`
	Zip     string `bson:"zip" json:"zip"`
	Country string `bson:"country" json:"country"`
}
