package handlers

import (
	"context"
	"net/http"
	"net/url"
	"sort"
	"sync"

	"perfume-store/database"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Category struct {
	ID       string `bson:"_id,omitempty" json:"id"`
	Name     string `bson:"name" json:"name"`
	ImageURL string `bson:"image_url,omitempty" json:"imageUrl"`
}

type CreateCategoryRequest struct {
	Name     string `json:"name" binding:"required"`
	ImageURL string `json:"imageUrl"`
}

// DeleteCategoryRequest is the body for deleting a category; products using it are moved to this category.
type DeleteCategoryRequest struct {
	MoveProductsTo string `json:"moveProductsTo"`
}

// ListCategories returns all categories (public for shop filter; admin for management).
// Merges categories collection with distinct category values from products. Runs both queries in parallel.
func ListCategories(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	ctx := context.Background()
	var result []gin.H
	var productNames []string
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		col := database.DB.Collection("categories")
		opts := options.Find().SetSort(bson.D{{Key: "name", Value: 1}}).SetProjection(bson.M{"_id": 1, "name": 1})
		cursor, err := col.Find(ctx, bson.M{}, opts)
		if err != nil {
			return
		}
		defer cursor.Close(ctx)
		var cats []struct {
			ID       primitive.ObjectID `bson:"_id"`
			Name     string             `bson:"name"`
			ImageURL string             `bson:"image_url"`
		}
		if cursor.All(ctx, &cats) != nil {
			return
		}
		seen := make(map[string]bool)
		result = make([]gin.H, 0, len(cats))
		for _, cat := range cats {
			if cat.Name != "" && !seen[cat.Name] {
				seen[cat.Name] = true
				result = append(result, gin.H{
					"id":       cat.ID.Hex(),
					"name":     cat.Name,
					"imageUrl": cat.ImageURL,
				})
			}
		}
	}()

	go func() {
		defer wg.Done()
		productsCol := database.DB.Collection("products")
		pipe := []bson.M{
			{"$match": bson.M{"active": true, "category": bson.M{"$exists": true, "$ne": ""}}},
			{"$group": bson.M{"_id": "$category"}},
		}
		pipeCursor, err := productsCol.Aggregate(ctx, pipe)
		if err != nil {
			return
		}
		defer pipeCursor.Close(ctx)
		var grp []struct {
			ID string `bson:"_id"`
		}
		if pipeCursor.All(ctx, &grp) == nil {
			productNames = make([]string, 0, len(grp))
			for _, g := range grp {
				if g.ID != "" {
					productNames = append(productNames, g.ID)
				}
			}
		}
	}()

	wg.Wait()

	seen := make(map[string]bool)
	for _, r := range result {
		if n, ok := r["name"].(string); ok {
			seen[n] = true
		}
	}
	for _, name := range productNames {
		if !seen[name] {
			seen[name] = true
			result = append(result, gin.H{"id": "", "name": name})
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i]["name"].(string) < result[j]["name"].(string)
	})
	c.JSON(http.StatusOK, result)
}

// CreateCategory creates a new category (admin/super_admin)
func CreateCategory(c *gin.Context) {
	var req CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	col := database.DB.Collection("categories")
	count, err := col.CountDocuments(context.Background(), bson.M{"name": req.Name})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Category already exists"})
		return
	}

	doc := bson.M{
		"_id":       primitive.NewObjectID(),
		"name":      req.Name,
		"image_url": req.ImageURL,
	}
	_, err = col.InsertOne(context.Background(), doc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create category"})
		return
	}

	HomeCache.Clear() // Invalidate home cache

	c.JSON(http.StatusCreated, gin.H{
		"id":       doc["_id"].(primitive.ObjectID).Hex(),
		"name":     req.Name,
		"imageUrl": req.ImageURL,
	})
}

// UpdateCategory updates an existing category (admin/super_admin)
func UpdateCategory(c *gin.Context) {
	id := c.Param("id")
	var req CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category id"})
		return
	}

	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	col := database.DB.Collection("categories")

	// Get original category name before update
	var oldCat Category
	if err := col.FindOne(context.Background(), bson.M{"_id": oid}).Decode(&oldCat); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "category not found"})
		return
	}

	update := bson.M{
		"$set": bson.M{
			"name":      req.Name,
			"image_url": req.ImageURL,
		},
	}

	_, err = col.UpdateOne(context.Background(), bson.M{"_id": oid}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update category"})
		return
	}

	HomeCache.Clear() // Invalidate home cache

	// If name changed, update products that use this category name
	if oldCat.Name != req.Name {
		productsCol := database.DB.Collection("products")
		_, _ = productsCol.UpdateMany(context.Background(), bson.M{"category": oldCat.Name}, bson.M{"$set": bson.M{"category": req.Name}})
	}

	c.JSON(http.StatusOK, gin.H{
		"id":       id,
		"name":     req.Name,
		"imageUrl": req.ImageURL,
	})
}

func deleteCategoryByName(ctx context.Context, categoryName, moveTo string) (needMove bool, hadCategoryDoc bool, err error) {
	if database.DB == nil {
		return false, false, nil
	}
	productsCol := database.DB.Collection("products")
	categoriesCol := database.DB.Collection("categories")
	productFilter := bson.M{"category": categoryName}
	count, err := productsCol.CountDocuments(ctx, productFilter)
	if err != nil {
		return false, false, err
	}
	if count > 0 {
		if moveTo == "" {
			return true, false, nil
		}
		_, err = productsCol.UpdateMany(ctx, productFilter, bson.M{"$set": bson.M{"category": moveTo}})
		if err != nil {
			return false, false, err
		}
	}
	delRes, err := categoriesCol.DeleteOne(ctx, bson.M{"name": categoryName})
	if err != nil {
		return false, false, err
	}
	return false, delRes.DeletedCount > 0, nil
}

func DeleteCategory(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "category id required"})
		return
	}
	var req DeleteCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	categoriesCol := database.DB.Collection("categories")
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category id"})
		return
	}
	var cat struct {
		Name string `bson:"name"`
	}
	if err := categoriesCol.FindOne(context.Background(), bson.M{"_id": oid}).Decode(&cat); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "category not found"})
		return
	}
	needMove, _, err := deleteCategoryByName(context.Background(), cat.Name, req.MoveProductsTo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if needMove {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Products use this category; specify moveProductsTo to move them to another category"})
		return
	}
	HomeCache.Clear() // Invalidate home cache
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func DeleteCategoryByName(c *gin.Context) {
	nameEnc := c.Param("name")
	if nameEnc == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "category name required"})
		return
	}
	name, _ := url.PathUnescape(nameEnc)
	if name == "" {
		name = nameEnc
	}
	var req DeleteCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	needMove, _, err := deleteCategoryByName(context.Background(), name, req.MoveProductsTo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if needMove {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Products use this category; specify moveProductsTo to move them to another category"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
