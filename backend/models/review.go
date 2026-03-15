package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ProductReview is a customer review for a product (only from verified purchasers after delivery).
type ProductReview struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ProductID       primitive.ObjectID `bson:"product_id" json:"productId"`
	ProductName     string             `bson:"product_name,omitempty" json:"productName,omitempty"`          // stored at review creation for admin display
	ProductImageURL string             `bson:"product_image_url,omitempty" json:"productImageUrl,omitempty"` // first image at review creation
	UserID          primitive.ObjectID `bson:"user_id" json:"userId"`
	OrderID         primitive.ObjectID `bson:"order_id" json:"orderId"` // delivered order that contained this product
	Rating          int                `bson:"rating" json:"rating"`    // 1-5
	Comment         string             `bson:"comment" json:"comment"`
	CreatedAt       time.Time          `bson:"created_at" json:"createdAt"`
	ReadAt          *time.Time         `bson:"read_at,omitempty" json:"readAt,omitempty"` // when admin/super_admin marked as read
}
