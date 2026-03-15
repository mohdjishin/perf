package handlers

import (
	"context"
	"net/http"
	"time"

	"perfume-store/database"
	"perfume-store/models"
	"perfume-store/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const returnRequestsCol = "return_requests"
const featuresCol = "features"
const featuresDocID = "features"

// getReturnDaysFromSettings returns the configured return_days_after_delivery (0 if not set).
func getReturnDaysFromSettings(ctx context.Context) int {
	if database.DB == nil {
		return 0
	}
	var doc struct {
		ReturnDays int `bson:"return_days_after_delivery"`
	}
	_ = database.DB.Collection(featuresCol).FindOne(ctx, bson.M{"_id": featuresDocID}, options.FindOne().SetProjection(bson.M{"return_days_after_delivery": 1})).Decode(&doc)
	if doc.ReturnDays < 0 {
		return 0
	}
	return doc.ReturnDays
}

// GetReturnReasons returns the list of selectable return reasons (public).
func GetReturnReasons(c *gin.Context) {
	reasons := make([]gin.H, 0, len(models.DefaultReturnReasons))
	for _, r := range models.DefaultReturnReasons {
		reasons = append(reasons, gin.H{"code": r.Code, "label": r.Label})
	}
	c.JSON(http.StatusOK, gin.H{"reasons": reasons})
}

// CreateReturnRequestRequest is the body for submitting a return request.
type CreateReturnRequestRequest struct {
	Reason      string `json:"reason"`      // code from GetReturnReasons
	ReasonOther string `json:"reasonOther"` // required when reason is "other"
}

// GetOrderReturnRequest returns the return request for an order if any (customer, own order only).
func GetOrderReturnRequest(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusOK, gin.H{"returnRequest": nil})
		return
	}
	orderIDHex := c.Param("id")
	orderID, err := primitive.ObjectIDFromHex(orderIDHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}
	userIDHex := c.GetString("user_id")
	if userIDHex == "" {
		c.JSON(http.StatusOK, gin.H{"returnRequest": nil})
		return
	}
	userID, _ := primitive.ObjectIDFromHex(userIDHex)
	ctx := context.Background()
	col := database.DB.Collection(returnRequestsCol)
	var rr models.ReturnRequest
	err = col.FindOne(ctx, bson.M{"order_id": orderID, "user_id": userID}).Decode(&rr)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"returnRequest": nil})
		return
	}
	reasonLabel := rr.Reason
	if rr.Reason == "other" && rr.ReasonOther != "" {
		reasonLabel = "Other: " + rr.ReasonOther
	} else {
		for _, r := range models.DefaultReturnReasons {
			if r.Code == rr.Reason {
				reasonLabel = r.Label
				break
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"returnRequest": gin.H{
			"id":                rr.ID.Hex(),
			"orderId":           rr.OrderID.Hex(),
			"reason":            rr.Reason,
			"reasonOther":       rr.ReasonOther,
			"reasonLabel":       reasonLabel,
			"status":            rr.Status,
			"createdAt":         rr.CreatedAt,
			"reviewedAt":        rr.ReviewedAt,
			"productReceivedAt": rr.ProductReceivedAt,
			"refundIssuedAt":    rr.RefundIssuedAt,
		},
	})
}

// CreateReturnRequest creates a return request for a delivered order (customer). Reason must be selected; admin must accept later.
func CreateReturnRequest(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	orderIDHex := c.Param("id")
	orderID, err := primitive.ObjectIDFromHex(orderIDHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}
	userIDHex := c.GetString("user_id")
	userID, _ := primitive.ObjectIDFromHex(userIDHex)
	if userIDHex == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req CreateReturnRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reason required"})
		return
	}
	reason := req.Reason
	validReason := false
	for _, r := range models.DefaultReturnReasons {
		if r.Code == reason {
			validReason = true
			break
		}
	}
	if !validReason {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid reason"})
		return
	}
	if reason == "other" && len(req.ReasonOther) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide a reason when selecting Other"})
		return
	}

	ctx := context.Background()
	ordersCol := database.DB.Collection("orders")
	var order models.Order
	if err := ordersCol.FindOne(ctx, bson.M{"_id": orderID}).Decode(&order); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}
	if order.UserID != userID {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}
	if order.Status != models.OrderDelivered {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only delivered orders can be returned"})
		return
	}
	var deliveredAt time.Time
	if order.DeliveredAt != nil {
		deliveredAt = *order.DeliveredAt
	} else {
		deliveredAt = order.UpdatedAt
	}
	daysAllowed := getReturnDaysFromSettings(ctx)
	if daysAllowed <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Returns are not allowed"})
		return
	}
	deadline := deliveredAt.AddDate(0, 0, daysAllowed)
	if time.Now().After(deadline) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Return window has expired"})
		return
	}

	rrCol := database.DB.Collection(returnRequestsCol)
	var existing models.ReturnRequest
	err = rrCol.FindOne(ctx, bson.M{"order_id": orderID}).Decode(&existing)
	if err == nil && existing.Status == models.ReturnStatusPending {
		c.JSON(http.StatusConflict, gin.H{"error": "A return request for this order is already pending"})
		return
	}

	now := time.Now()
	rr := models.ReturnRequest{
		OrderID:     orderID,
		UserID:      userID,
		Reason:      reason,
		ReasonOther: req.ReasonOther,
		Status:      models.ReturnStatusPending,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	res, err := rrCol.InsertOne(ctx, rr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit return request"})
		return
	}
	rr.ID = res.InsertedID.(primitive.ObjectID)

	utils.Log(ctx, userIDHex, c.GetString("user_email"), c.GetString("user_role"),
		"return_request_create", rr.ID.Hex(), "return_request", "Return request submitted", map[string]interface{}{
			"orderId": orderIDHex,
			"reason":  reason,
		})

	c.JSON(http.StatusCreated, gin.H{
		"id":          rr.ID.Hex(),
		"orderId":     rr.OrderID.Hex(),
		"reason":      rr.Reason,
		"reasonOther": rr.ReasonOther,
		"status":      rr.Status,
		"createdAt":   rr.CreatedAt,
	})
}

// ListReturnRequests returns all return requests for admin (with order and customer info).
func ListReturnRequests(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	ctx := context.Background()
	rrCol := database.DB.Collection(returnRequestsCol)
	statusFilter := c.Query("status")
	filter := bson.M{}
	if statusFilter != "" {
		filter["status"] = statusFilter
	}
	opts := options.Find().SetSort(bson.M{"created_at": -1})
	cur, err := rrCol.Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cur.Close(ctx)
	var list []models.ReturnRequest
	if err := cur.All(ctx, &list); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ordersCol := database.DB.Collection("orders")
	usersCol := database.DB.Collection("users")
	items := make([]gin.H, 0, len(list))
	for _, rr := range list {
		var order models.Order
		_ = ordersCol.FindOne(ctx, bson.M{"_id": rr.OrderID}, options.FindOne().SetProjection(bson.M{"order_number": 1, "user_id": 1, "total": 1, "status": 1, "delivered_at": 1})).Decode(&order)
		var user struct {
			Email     string `bson:"email"`
			FirstName string `bson:"first_name"`
			LastName  string `bson:"last_name"`
		}
		_ = usersCol.FindOne(ctx, bson.M{"_id": rr.UserID}, options.FindOne().SetProjection(bson.M{"email": 1, "first_name": 1, "last_name": 1})).Decode(&user)
		reasonLabel := rr.Reason
		if rr.Reason == "other" && rr.ReasonOther != "" {
			reasonLabel = "Other: " + rr.ReasonOther
		} else {
			for _, r := range models.DefaultReturnReasons {
				if r.Code == rr.Reason {
					reasonLabel = r.Label
					break
				}
			}
		}
		items = append(items, gin.H{
			"id":                rr.ID.Hex(),
			"orderId":           rr.OrderID.Hex(),
			"orderNumber":       order.OrderNumber,
			"userId":            rr.UserID.Hex(),
			"customer":          gin.H{"email": user.Email, "firstName": user.FirstName, "lastName": user.LastName},
			"reason":            rr.Reason,
			"reasonOther":       rr.ReasonOther,
			"reasonLabel":       reasonLabel,
			"status":            rr.Status,
			"createdAt":         rr.CreatedAt,
			"reviewedAt":        rr.ReviewedAt,
			"reviewedBy":        rr.ReviewedBy,
			"productReceivedAt": rr.ProductReceivedAt,
			"refundIssuedAt":    rr.RefundIssuedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// UpdateReturnRequestRequest is the body for admin to accept/reject and to track product received / refund issued.
type UpdateReturnRequestRequest struct {
	Status          string `json:"status"`           // "accepted" or "rejected" (for pending only)
	ProductReceived *bool  `json:"product_received"` // set true to mark product received back
	RefundIssued    *bool  `json:"refund_issued"`    // set true to mark refund paid back
}

// UpdateReturnRequest lets admin accept/reject a return request, and track product received / refund issued.
func UpdateReturnRequest(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid return request ID"})
		return
	}
	var req UpdateReturnRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}

	ctx := context.Background()
	col := database.DB.Collection(returnRequestsCol)
	var rr models.ReturnRequest
	if err := col.FindOne(ctx, bson.M{"_id": id}).Decode(&rr); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Return request not found"})
		return
	}

	adminEmail := c.GetString("user_email")
	now := time.Now()
	updates := bson.M{"updated_at": now}

	// Accept or reject (only when currently pending)
	if req.Status != "" {
		var newStatus models.ReturnRequestStatus
		switch req.Status {
		case "accepted":
			newStatus = models.ReturnStatusAccepted
		case "rejected":
			newStatus = models.ReturnStatusRejected
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "status must be accepted or rejected"})
			return
		}
		if rr.Status != models.ReturnStatusPending {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Return request already reviewed"})
			return
		}
		updates["status"] = newStatus
		updates["reviewed_by"] = adminEmail
		updates["reviewed_at"] = now
		rr.Status = newStatus
		rr.ReviewedAt = &now
		rr.ReviewedBy = adminEmail
	}

	// Track product received back (for accepted returns only)
	if req.ProductReceived != nil && *req.ProductReceived && rr.ProductReceivedAt == nil {
		if rr.Status != models.ReturnStatusAccepted {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Accept the return first before marking product received"})
			return
		}
		updates["product_received_at"] = now
		rr.ProductReceivedAt = &now
	}
	// Track refund issued (for accepted returns only)
	if req.RefundIssued != nil && *req.RefundIssued && rr.RefundIssuedAt == nil {
		if rr.Status != models.ReturnStatusAccepted {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Accept the return first before marking refund issued"})
			return
		}
		updates["refund_issued_at"] = now
		rr.RefundIssuedAt = &now
	}

	rr.UpdatedAt = now
	if _, err := col.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": updates}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if req.Status != "" {
		utils.Log(ctx, c.GetString("user_id"), adminEmail, c.GetString("user_role"),
			"return_request_review", id.Hex(), "return_request", "Return request "+req.Status, map[string]interface{}{
				"orderId": rr.OrderID.Hex(),
			})
	}

	c.JSON(http.StatusOK, gin.H{
		"id":                rr.ID.Hex(),
		"orderId":           rr.OrderID.Hex(),
		"reason":            rr.Reason,
		"reasonOther":       rr.ReasonOther,
		"status":            rr.Status,
		"reviewedAt":        rr.ReviewedAt,
		"reviewedBy":        rr.ReviewedBy,
		"productReceivedAt": rr.ProductReceivedAt,
		"refundIssuedAt":    rr.RefundIssuedAt,
	})
}
