package models

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// UserAddress is a saved shipping address for a user
type UserAddress struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID    primitive.ObjectID `bson:"user_id" json:"userId"`
	Label     string             `bson:"label" json:"label"` // e.g. "Home", "Office"
	Street    string             `bson:"street" json:"street"`
	City      string             `bson:"city" json:"city"`
	State     string             `bson:"state" json:"state"`
	Zip       string             `bson:"zip" json:"zip"`
	Country   string             `bson:"country" json:"country"`
	Phone     string             `bson:"phone,omitempty" json:"phone,omitempty"`
	IsDefault bool               `bson:"is_default" json:"isDefault"`
}

// ToOrderAddress converts UserAddress to the Address format used in orders
func (a *UserAddress) ToOrderAddress() Address {
	return Address{
		Street:  a.Street,
		City:    a.City,
		State:   a.State,
		Zip:     a.Zip,
		Country: a.Country,
	}
}
