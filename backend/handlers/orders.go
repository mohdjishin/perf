package handlers

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"perfume-store/config"
	"perfume-store/database"
	"perfume-store/logger"
	"perfume-store/models"
	"perfume-store/utils"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// formatOrderNumber returns industry-style order ID: ORD-YYYYMMDD-XXXXXX
func formatOrderNumber(id primitive.ObjectID, createdAt time.Time) string {
	suffix := strings.ToUpper(id.Hex())
	if len(suffix) > 6 {
		suffix = suffix[len(suffix)-6:]
	}
	return "ORD-" + createdAt.Format("20060102") + "-" + suffix
}

// orderDisplayNumber returns stored order_number or computes it for legacy orders
func orderDisplayNumber(o *models.Order) string {
	if o.OrderNumber != "" {
		return o.OrderNumber
	}
	return formatOrderNumber(o.ID, o.CreatedAt)
}

var hexOnly = regexp.MustCompile(`^[a-fA-F0-9]+$`)

type CreateOrderRequest struct {
	Items   []OrderItemRequest `json:"items" binding:"required"`
	Address models.Address     `json:"address" binding:"required"`
}

type OrderItemRequest struct {
	ProductID string `json:"productId" binding:"required"`
	Quantity  int    `json:"quantity" binding:"required,gt=0"`
}

// ListOrders returns orders (user: own orders; admin: all). Supports ?order_id= for search.
func ListOrders(c *gin.Context) {
	col := database.DB.Collection("orders")
	filter := bson.M{}
	role := c.GetString("user_role")
	userID := c.GetString("user_id")

	if role == string(models.RoleCustomer) {
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		uid, err := primitive.ObjectIDFromHex(userID)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user"})
			return
		}
		filter["user_id"] = uid
	}

	// Filter by fulfillment status (pending, paid, shipped, delivered, cancelled)
	if status := strings.TrimSpace(strings.ToLower(c.Query("status"))); status != "" {
		valid := map[string]bool{
			string(models.OrderPending): true, string(models.OrderPaid): true,
			string(models.OrderShipped): true, string(models.OrderDelivered): true,
			string(models.OrderCancelled): true,
		}
		if valid[status] {
			filter["status"] = status
		}
	}

	// Filter by payment status (paid, unpaid)
	var paymentOr bson.M
	if paymentStatus := strings.TrimSpace(strings.ToLower(c.Query("payment_status"))); paymentStatus != "" {
		if paymentStatus == string(models.PaymentPaid) {
			filter["payment_status"] = string(models.PaymentPaid)
		} else if paymentStatus == string(models.PaymentUnpaid) {
			paymentOr = bson.M{
				"$or": []bson.M{
					{"payment_status": string(models.PaymentUnpaid)},
					{"payment_status": bson.M{"$exists": false}},
				},
			}
		}
	}

	// Filter by order ID: ORD-YYYYMMDD-XXXXXX, full 24-char hex, or partial hex
	var orderIDCond bson.M
	if raw := strings.TrimSpace(c.Query("order_id")); raw != "" {
		upper := strings.ToUpper(raw)
		if strings.HasPrefix(upper, "ORD-") {
			parts := strings.Split(upper, "-")
			suffix := ""
			if len(parts) >= 3 && hexOnly.MatchString(parts[len(parts)-1]) {
				suffix = strings.ToLower(parts[len(parts)-1])
			}
			if suffix != "" && len(suffix) >= 6 {
				orderIDCond = bson.M{
					"$or": []bson.M{
						{"order_number": upper},
						{"$and": []bson.M{
							{"order_number": bson.M{"$exists": false}},
							{"$expr": bson.M{
								"$regexMatch": bson.M{
									"input":   bson.M{"$toString": bson.M{"$toLower": bson.M{"$toString": "$_id"}}},
									"regex":   suffix,
									"options": "",
								},
							}},
						}},
					},
				}
			} else {
				orderIDCond = bson.M{"order_number": upper}
			}
		} else if hexOnly.MatchString(raw) {
			if len(raw) == 24 {
				if oid, err := primitive.ObjectIDFromHex(raw); err == nil {
					orderIDCond = bson.M{"_id": oid}
				}
			} else if len(raw) >= 6 {
				hexLower := strings.ToLower(raw)
				orderIDCond = bson.M{
					"$or": []bson.M{
						{"order_number": bson.M{"$regex": raw + "$", "$options": "i"}},
						{"$expr": bson.M{
							"$regexMatch": bson.M{
								"input":   bson.M{"$toString": bson.M{"$toLower": bson.M{"$toString": "$_id"}}},
								"regex":   hexLower,
								"options": "",
							},
						}},
					},
				}
			}
		}
	}

	// Combine payment and order_id conditions with $and if both present
	if paymentOr != nil && orderIDCond != nil {
		filter["$and"] = []bson.M{paymentOr, orderIDCond}
	} else if paymentOr != nil {
		filter["$or"] = paymentOr["$or"].([]bson.M)
	} else if orderIDCond != nil {
		for k, v := range orderIDCond {
			filter[k] = v
		}
	}

	page, limit := utils.GetPageLimit(c)
	if limit > 50 {
		limit = 50
	}
	skip := (page - 1) * limit

	// list=1: minimal projection for list view (exclude items, shipping_history, address)
	listMode := c.Query("list") == "1"
	proj := bson.M{"updated_at": 0}
	if listMode {
		proj["items"] = 0
		proj["shipping_history"] = 0
		proj["address"] = 0
	}

	total, _ := col.CountDocuments(context.Background(), filter)
	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64(skip)).
		SetLimit(int64(limit)).
		SetProjection(proj)
	cursor, err := col.Find(context.Background(), filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cursor.Close(context.Background())

	var orders []models.Order
	if err := cursor.All(context.Background(), &orders); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// For customer: fetch return request status for delivered orders
	returnRequestByOrder := make(map[string]gin.H)
	if role == string(models.RoleCustomer) && userID != "" {
		var deliveredIDs []primitive.ObjectID
		for _, o := range orders {
			if o.Status == models.OrderDelivered {
				deliveredIDs = append(deliveredIDs, o.ID)
			}
		}
		if len(deliveredIDs) > 0 {
			uid, _ := primitive.ObjectIDFromHex(userID)
			rrCol := database.DB.Collection("return_requests")
			cur, err := rrCol.Find(context.Background(), bson.M{"order_id": bson.M{"$in": deliveredIDs}, "user_id": uid}, options.Find().SetProjection(bson.M{"order_id": 1, "status": 1, "created_at": 1, "reviewed_at": 1, "product_received_at": 1, "refund_issued_at": 1}))
			if err == nil {
				for cur.Next(context.Background()) {
					var rr struct {
						OrderID           primitive.ObjectID `bson:"order_id"`
						Status            string             `bson:"status"`
						CreatedAt         time.Time          `bson:"created_at"`
						ReviewedAt        *time.Time         `bson:"reviewed_at"`
						ProductReceivedAt *time.Time         `bson:"product_received_at"`
						RefundIssuedAt    *time.Time         `bson:"refund_issued_at"`
					}
					if cur.Decode(&rr) == nil {
						h := gin.H{"status": rr.Status, "createdAt": rr.CreatedAt.Format(time.RFC3339)}
						if rr.ReviewedAt != nil {
							h["reviewedAt"] = rr.ReviewedAt.Format(time.RFC3339)
						}
						if rr.ProductReceivedAt != nil {
							h["productReceivedAt"] = rr.ProductReceivedAt.Format(time.RFC3339)
						}
						if rr.RefundIssuedAt != nil {
							h["refundIssuedAt"] = rr.RefundIssuedAt.Format(time.RFC3339)
						}
						returnRequestByOrder[rr.OrderID.Hex()] = h
					}
				}
				cur.Close(context.Background())
			}
		}
	}

	// For admin: fetch user info (email, name) for each order
	userMap := make(map[string]gin.H)
	if role == string(models.RoleAdmin) || role == string(models.RoleSuperAdmin) {
		ids := make([]primitive.ObjectID, 0, len(orders))
		seen := make(map[string]bool)
		for _, o := range orders {
			hex := o.UserID.Hex()
			if !seen[hex] {
				seen[hex] = true
				ids = append(ids, o.UserID)
			}
		}
		if len(ids) > 0 {
			usersCol := database.DB.Collection("users")
			proj := options.Find().SetProjection(bson.M{"_id": 1, "email": 1, "first_name": 1, "last_name": 1})
			uc, err := usersCol.Find(context.Background(), bson.M{"_id": bson.M{"$in": ids}}, proj)
			if err == nil && uc != nil {
				for uc.Next(context.Background()) {
					var u struct {
						ID        primitive.ObjectID `bson:"_id"`
						Email     string             `bson:"email"`
						FirstName string             `bson:"first_name"`
						LastName  string             `bson:"last_name"`
					}
					if uc.Decode(&u) == nil {
						userMap[u.ID.Hex()] = gin.H{
							"email":     u.Email,
							"firstName": u.FirstName,
							"lastName":  u.LastName,
						}
					}
				}
				uc.Close(context.Background())
			}
		}
	}

	items := make([]gin.H, len(orders))
	for i, o := range orders {
		paymentStatus := o.PaymentStatus
		if paymentStatus == "" {
			if o.Status == models.OrderPaid {
				paymentStatus = models.PaymentPaid
			} else {
				paymentStatus = models.PaymentUnpaid
			}
		}
		item := gin.H{
			"id":            o.ID.Hex(),
			"orderNumber":   orderDisplayNumber(&o),
			"subtotal":      o.Subtotal,
			"fee":           o.Fee,
			"feeBreakdown":  o.FeeBreakdown,
			"total":         o.Total,
			"status":        o.Status,
			"paymentStatus": paymentStatus,
			"createdAt":     o.CreatedAt,
			"deliveredAt":   o.DeliveredAt,
		}
		if role == string(models.RoleAdmin) || role == string(models.RoleSuperAdmin) {
			item["paymentIntentId"] = o.PaymentIntentID
			item["checkoutSessionId"] = o.CheckoutSessionID
		}
		if !listMode {
			// Serialize items with explicit productId hex so frontend always gets a string (e.g. for Review links)
			lineItems := make([]gin.H, len(o.Items))
			for k, it := range o.Items {
				lineItems[k] = gin.H{
					"productId": it.ProductID.Hex(),
					"name":      it.Name,
					"price":     it.Price,
					"quantity":  it.Quantity,
					"imageUrl":  it.ImageURL,
				}
			}
			item["items"] = lineItems
			item["shippingHistory"] = o.ShippingHistory
			item["address"] = o.Address
		}
		if u := userMap[o.UserID.Hex()]; u != nil {
			item["customer"] = u
		}
		if rr := returnRequestByOrder[o.ID.Hex()]; rr != nil {
			item["returnRequest"] = rr
		}
		items[i] = item
	}

	totalPages := int((total + int64(limit) - 1) / int64(limit))
	if totalPages < 1 {
		totalPages = 1
	}
	c.JSON(http.StatusOK, gin.H{
		"items":      items,
		"total":      total,
		"page":       page,
		"limit":      limit,
		"totalPages": totalPages,
	})
}

// GetOrder returns a single order from the DB only. No product lookup; amounts are stored at placement and must not be recalculated.
func GetOrder(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	col := database.DB.Collection("orders")
	var order models.Order
	err = col.FindOne(context.Background(), bson.M{"_id": id}).Decode(&order)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	role := c.GetString("user_role")
	userID := c.GetString("user_id")
	if role == string(models.RoleCustomer) && order.UserID.Hex() != userID {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	paymentStatus := order.PaymentStatus
	if paymentStatus == "" {
		if order.Status == models.OrderPaid {
			paymentStatus = models.PaymentPaid
		} else {
			paymentStatus = models.PaymentUnpaid
		}
	}
	lineItems := make([]gin.H, len(order.Items))
	for k, it := range order.Items {
		lineItems[k] = gin.H{
			"productId": it.ProductID.Hex(),
			"name":      it.Name,
			"price":     it.Price,
			"quantity":  it.Quantity,
			"imageUrl":  it.ImageURL,
		}
	}
	resp := gin.H{
		"id":              order.ID.Hex(),
		"orderNumber":     orderDisplayNumber(&order),
		"items":           lineItems,
		"subtotal":        order.Subtotal,
		"fee":             order.Fee,
		"feeBreakdown":    order.FeeBreakdown,
		"total":           order.Total,
		"status":          order.Status,
		"paymentStatus":   paymentStatus,
		"shippingHistory": order.ShippingHistory,
		"createdAt":       order.CreatedAt,
		"deliveredAt":     order.DeliveredAt,
		"address":         order.Address,
	}
	if role == string(models.RoleAdmin) || role == string(models.RoleSuperAdmin) {
		resp["paymentIntentId"] = order.PaymentIntentID
		resp["checkoutSessionId"] = order.CheckoutSessionID
	}
	// For admin: include user info
	if role == string(models.RoleAdmin) || role == string(models.RoleSuperAdmin) {
		usersCol := database.DB.Collection("users")
		var u struct {
			Email     string `bson:"email"`
			FirstName string `bson:"first_name"`
			LastName  string `bson:"last_name"`
		}
		if usersCol.FindOne(context.Background(), bson.M{"_id": order.UserID}, options.FindOne().SetProjection(bson.M{"email": 1, "first_name": 1, "last_name": 1})).Decode(&u) == nil {
			resp["customer"] = gin.H{"email": u.Email, "firstName": u.FirstName, "lastName": u.LastName}
		}
	}
	c.JSON(http.StatusOK, resp)
}

// CreateOrder creates a new order (customers only) and decrements product stock.
func CreateOrder(c *gin.Context) {
	role := c.GetString("user_role")
	if role == string(models.RoleAdmin) || role == string(models.RoleSuperAdmin) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admins cannot place orders. Use a customer account to purchase."})
		return
	}

	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "At least one item is required"})
		return
	}
	// Merge duplicate product IDs (same product requested multiple times)
	merged := make(map[string]int)
	for _, it := range req.Items {
		merged[it.ProductID] += it.Quantity
	}
	req.Items = nil
	for pid, qty := range merged {
		req.Items = append(req.Items, OrderItemRequest{ProductID: pid, Quantity: qty})
	}
	if strings.TrimSpace(req.Address.Street) == "" || strings.TrimSpace(req.Address.City) == "" ||
		strings.TrimSpace(req.Address.Zip) == "" || strings.TrimSpace(req.Address.Country) == "" ||
		strings.TrimSpace(req.Address.Phone) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Address must include street, city, zip, country, and phone number"})
		return
	}

	userID, _ := primitive.ObjectIDFromHex(c.GetString("user_id"))
	productsCol := database.DB.Collection("products")
	ordersCol := database.DB.Collection("orders")
	ctx := context.Background()

	// Pre-validate product IDs and quantities (no DB yet)
	for _, it := range req.Items {
		if it.Quantity > 99 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Maximum quantity per product is 99"})
			return
		}
		if _, err := primitive.ObjectIDFromHex(it.ProductID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID: " + it.ProductID})
			return
		}
	}

	var items []models.OrderItem
	var subtotal float64
	proj := options.FindOne().SetProjection(bson.M{"_id": 1, "name": 1, "price": 1, "image_url": 1, "stock": 1, "active": 1})

	for _, it := range req.Items {
		pid, _ := primitive.ObjectIDFromHex(it.ProductID)
		var product models.Product
		// First check if it exists at all
		err := productsCol.FindOne(ctx, bson.M{"_id": pid}, proj).Decode(&product)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"error": "Product no longer exists in our catalog. Please remove it from your cart."})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error checking product: " + err.Error()})
			return
		}

		if !product.Active {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Product '" + product.Name + "' is currently unavailable. Please remove it from your cart."})
			return
		}

		if product.Stock < it.Quantity {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Insufficient stock for %s. Only %d left.", product.Name, product.Stock)})
			return
		}
		// Snapshot product price and name at order placement; existing orders must never be recalculated from current product prices.
		itemSub := product.Price * float64(it.Quantity)
		subtotal += itemSub
		items = append(items, models.OrderItem{
			ProductID: product.ID,
			Name:      product.Name,
			Price:     product.Price,
			Quantity:  it.Quantity,
			ImageURL:  product.ImageURL,
		})
	}

	fee, orderTotal, feeBreakdown := ComputeOrderFee(subtotal)
	if feeBreakdown == nil {
		feeBreakdown = []models.FeeBreakdownLine{}
	}
	now := time.Now()
	orderID := primitive.NewObjectID()
	order := models.Order{
		ID:            orderID,
		OrderNumber:   formatOrderNumber(orderID, now),
		UserID:        userID,
		Items:         items,
		Subtotal:      subtotal,
		Fee:           fee,
		FeeBreakdown:  feeBreakdown, // always stored at placement; never recalculated
		Total:         orderTotal,
		Status:        models.OrderPending,
		PaymentStatus: models.PaymentUnpaid,
		Address:       req.Address,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if _, err := ordersCol.InsertOne(ctx, order); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Order failed: " + err.Error()})
		return
	}
	for _, it := range req.Items {
		pid, _ := primitive.ObjectIDFromHex(it.ProductID)
		// Atomic decrement: only if stock is still sufficient
		res, err := productsCol.UpdateOne(ctx,
			bson.M{"_id": pid, "stock": bson.M{"$gte": it.Quantity}},
			bson.M{"$inc": bson.M{"stock": -it.Quantity}},
		)
		if err != nil || res.ModifiedCount == 0 {
			logger.Errorf("CRITICAL: Failed to decrement stock for product %s in order %s (insufficient stock or DB error): %v", it.ProductID, order.ID.Hex(), err)
			// Mark order as cancelled
			_, _ = ordersCol.UpdateOne(ctx, bson.M{"_id": order.ID}, bson.M{"$set": bson.M{"status": models.OrderCancelled, "updated_at": time.Now()}})
			c.JSON(http.StatusBadRequest, gin.H{"error": "Some items are out of stock. Please check your cart."})
			return
		}
	}

	utils.Log(ctx, c.GetString("user_id"), c.GetString("user_email"), c.GetString("user_role"),
		models.AuditOrderPlace, order.ID.Hex(), "order", "Placed order", map[string]interface{}{
			"orderNumber": order.OrderNumber,
			"total":       order.Total,
		})

	// Telegram Notification
	var itemsSummary strings.Builder
	for _, it := range order.Items {
		itemsSummary.WriteString(fmt.Sprintf("\n• %s x %d — <i>%.2f AED</i>", it.Name, it.Quantity, it.Price*float64(it.Quantity)))
	}
	addr := order.Address
	addressStr := fmt.Sprintf("%s, %s, %s, %s, %s", addr.Street, addr.City, addr.State, addr.Zip, addr.Country)

	msg := fmt.Sprintf("📦 <b>New Order Placed!</b>\n"+
		"Order Number: <code>%s</code>\n"+
		"Total: <b>%.2f AED</b>\n"+
		"Customer: %s\n\n"+
		"<b>Items:</b>%s\n\n"+
		"<b>Delivery Address:</b>\n<i>%s</i>",
		order.OrderNumber, order.Total, c.GetString("user_email"), itemsSummary.String(), addressStr)

	utils.SendTelegramMessage(msg)
	resp := gin.H{
		"id":              order.ID.Hex(),
		"orderNumber":     order.OrderNumber,
		"items":           order.Items,
		"subtotal":        order.Subtotal,
		"fee":             order.Fee,
		"feeBreakdown":    order.FeeBreakdown,
		"total":           order.Total,
		"status":          order.Status,
		"paymentStatus":   order.PaymentStatus,
		"shippingHistory": order.ShippingHistory,
		"createdAt":       order.CreatedAt,
		"address":         order.Address,
	}

	// Build Stripe Checkout Session line items from order items + fees
	frontendURL := strings.TrimSuffix(config.AppConfig.FrontendURL, "/")
	successURL := frontendURL + "/checkout/success?session_id={CHECKOUT_SESSION_ID}"
	cancelURL := frontendURL + "/checkout?cancelled=true"

	logger.Infof("Order %v: Generated Stripe SuccessURL: %s", order.ID.Hex(), successURL)

	checkoutItems := make([]utils.CheckoutLineItem, len(items))
	for i, it := range items {
		checkoutItems[i] = utils.CheckoutLineItem{
			Name:     it.Name,
			ImageURL: it.ImageURL,
			PriceFil: int64(it.Price * 100), // AED → fils
			Quantity: int64(it.Quantity),
		}
	}

	// Add fee as a separate line item if applicable
	if fee != 0 {
		feeName := "Shipping & Fees"
		if len(feeBreakdown) > 0 {
			feeName = ""
			for j, fb := range feeBreakdown {
				if j > 0 {
					feeName += " + "
				}
				feeName += fb.Label
			}
		}
		checkoutItems = append(checkoutItems, utils.CheckoutLineItem{
			Name:     feeName,
			PriceFil: int64(fee * 100),
			Quantity: 1,
		})
	}

	sess, err := utils.CreateCheckoutSession(
		order.ID.Hex(),
		c.GetString("user_id"),
		c.GetString("user_email"),
		checkoutItems,
		successURL,
		cancelURL,
	)
	if err != nil {
		logger.Errorf("Failed to create Stripe checkout session: %v", err)
		// Order created but Stripe session failed — still return order info
	} else {
		resp["checkoutUrl"] = sess.URL
		// Store session ID in order
		ordersCol.UpdateOne(ctx, bson.M{"_id": order.ID}, bson.M{"$set": bson.M{"checkout_session_id": sess.ID}})
	}

	c.JSON(http.StatusCreated, resp)
}

type UpdateOrderStatusRequest struct {
	Status          *models.OrderStatus   `json:"status"`
	PaymentStatus   *models.PaymentStatus `json:"paymentStatus"`
	ShippingMessage string                `json:"shippingMessage"`
}

// UpdateOrderStatus updates order fulfillment status and/or payment status (admin only). Payment can be marked paid on delivery.
func UpdateOrderStatus(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	var req UpdateOrderStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Status == nil && req.PaymentStatus == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Provide status and/or paymentStatus"})
		return
	}

	validStatus := map[models.OrderStatus]bool{
		models.OrderPending: true, models.OrderPaid: true,
		models.OrderShipped: true, models.OrderDelivered: true, models.OrderCancelled: true,
	}
	validPayment := map[models.PaymentStatus]bool{
		models.PaymentUnpaid: true, models.PaymentPaid: true,
	}
	if req.Status != nil && !validStatus[*req.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
		return
	}
	if req.PaymentStatus != nil && !validPayment[*req.PaymentStatus] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid paymentStatus"})
		return
	}

	col := database.DB.Collection("orders")
	ctx := context.Background()
	now := time.Now()
	adminEmail := c.GetString("user_email")
	setDoc := bson.M{"updated_at": now}
	if req.PaymentStatus != nil {
		setDoc["payment_status"] = *req.PaymentStatus
	}
	if req.Status != nil {
		setDoc["status"] = *req.Status
		if *req.Status == models.OrderDelivered {
			setDoc["delivered_at"] = now
		}
		msg := req.ShippingMessage
		if msg == "" {
			msg = "Status changed to " + string(*req.Status)
		}
		entry := models.ShippingHistoryEntry{
			Message:   msg,
			CreatedAt: now,
			UpdatedBy: adminEmail,
		}
		updates := bson.M{"$set": setDoc, "$push": bson.M{"shipping_history": entry}}
		res, err := col.UpdateOne(ctx, bson.M{"_id": id}, updates)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if res.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
			return
		}
	} else {
		res, err := col.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": setDoc})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if res.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
			return
		}
	}

	var order models.Order
	if err := col.FindOne(ctx, bson.M{"_id": id}).Decode(&order); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}
	paymentStatus := order.PaymentStatus
	if paymentStatus == "" {
		if order.Status == models.OrderPaid {
			paymentStatus = models.PaymentPaid
		} else {
			paymentStatus = models.PaymentUnpaid
		}
	}

	utils.Log(ctx, c.GetString("user_id"), c.GetString("user_email"), c.GetString("user_role"),
		models.AuditOrderStatus, id.Hex(), "order", "Updated order", map[string]interface{}{
			"orderNumber":   orderDisplayNumber(&order),
			"status":        order.Status,
			"paymentStatus": paymentStatus,
		})
	resp := gin.H{
		"id":              order.ID.Hex(),
		"orderNumber":     orderDisplayNumber(&order),
		"items":           order.Items,
		"subtotal":        order.Subtotal,
		"fee":             order.Fee,
		"feeBreakdown":    order.FeeBreakdown,
		"total":           order.Total,
		"status":          order.Status,
		"paymentStatus":   paymentStatus,
		"shippingHistory": order.ShippingHistory,
		"createdAt":       order.CreatedAt,
		"deliveredAt":     order.DeliveredAt,
		"address":         order.Address,
	}
	c.JSON(http.StatusOK, resp)
}
