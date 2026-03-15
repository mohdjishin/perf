package database

import (
	"context"

	"perfume-store/config"
	"perfume-store/logger"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var DB *mongo.Database
var Client *mongo.Client

func Connect() error {
	clientOpts := options.Client().ApplyURI(config.AppConfig.MongoURI)
	client, err := mongo.Connect(context.Background(), clientOpts)
	if err != nil {
		return err
	}

	if err := client.Ping(context.Background(), nil); err != nil {
		return err
	}

	Client = client
	DB = client.Database("perfume_store")
	logger.Info("Connected to MongoDB")
	return nil
}

func Disconnect() error {
	return Client.Disconnect(context.Background())
}
