package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Product struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name            string             `bson:"name" json:"name"`
	NameAr          string             `bson:"name_ar" json:"nameAr"`
	Description     string             `bson:"description" json:"description"`
	DescriptionAr   string             `bson:"description_ar" json:"descriptionAr"`
	Price           float64            `bson:"price" json:"price"`
	ImageURL        string             `bson:"image_url" json:"imageUrl"`
	ImageURLs       []string           `bson:"image_urls,omitempty" json:"imageUrls,omitempty"`
	Category        string             `bson:"category" json:"category"`
	Audience        string             `bson:"audience" json:"audience"`                // "men", "women", "unisex", or ""
	NewArrival      bool               `bson:"new_arrival" json:"newArrival"`           // highlighted as new
	OnSale          bool               `bson:"on_sale" json:"onSale"`                   // discounted
	DiscountPercent int                `bson:"discount_percent" json:"discountPercent"` // e.g. 20 for "20% off"
	Stock           int                `bson:"stock" json:"stock"`
	Notes           []string           `bson:"notes" json:"notes"`
	TopNote         string             `bson:"top_note" json:"topNote"`
	HeartNote       string             `bson:"heart_note" json:"heartNote"`
	BaseNote        string             `bson:"base_note" json:"baseNote"`
	SeasonalFlag    string             `bson:"seasonal_flag" json:"seasonalFlag"` // e.g. "christmas" — filter via ?seasonal=
	Active          bool               `bson:"active" json:"active"`
	Rating          int                `bson:"rating" json:"rating"` // 0 = not set, 1-5 = admin star rating
	CreatedAt       time.Time          `bson:"created_at" json:"createdAt"`
	UpdatedAt       time.Time          `bson:"updated_at" json:"updatedAt"`
}
