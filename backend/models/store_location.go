package models

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// StoreLocation is a physical shop/store that appears in the shop locator.
type StoreLocation struct {
	ID      primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name    string             `bson:"name" json:"name"`
	Street  string             `bson:"street" json:"street"`
	City    string             `bson:"city" json:"city"`
	State   string             `bson:"state" json:"state"`
	Zip     string             `bson:"zip" json:"zip"`
	Country string             `bson:"country" json:"country"`
	Lat     float64            `bson:"lat" json:"lat"`
	Lng     float64            `bson:"lng" json:"lng"`
	Phone   string             `bson:"phone,omitempty" json:"phone,omitempty"`
	Hours   string             `bson:"hours,omitempty" json:"hours,omitempty"` // e.g. "Mon–Sat 10am–8pm"
	Active  bool               `bson:"active" json:"active"`
}
