package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Role string

const (
	RoleSuperAdmin Role = "super_admin"
	RoleAdmin      Role = "admin"
	RoleCustomer   Role = "customer"
)

type User struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Email      string             `bson:"email" json:"email"`
	Password   string             `bson:"password" json:"-"`
	FirstName  string             `bson:"first_name" json:"firstName"`
	LastName   string             `bson:"last_name" json:"lastName"`
	Role       Role               `bson:"role" json:"role"`
	Group      string             `bson:"group,omitempty" json:"group"`
	Active     bool               `bson:"active" json:"active"`
	CreatedAt  time.Time          `bson:"created_at" json:"createdAt"`
	UpdatedAt  time.Time          `bson:"updated_at" json:"updatedAt"`
	ProfileURL string             `bson:"profile_url" json:"profileUrl"`
}

type UserResponse struct {
	ID         string    `json:"id"`
	Email      string    `json:"email"`
	FirstName  string    `json:"firstName"`
	LastName   string    `json:"lastName"`
	Role       string    `json:"role"`
	ProfileURL string    `json:"profileUrl"`
	CreatedAt  time.Time `json:"createdAt"`
}
