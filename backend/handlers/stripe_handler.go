package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"perfume-store/config"
	"perfume-store/database"
	"perfume-store/logger"
	"perfume-store/models"
	"perfume-store/utils"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/webhook"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// StripeWebhook handles events from Stripe.
func StripeWebhook(c *gin.Context) {
	logger.Infof("Stripe webhook: Received request from %s", c.ClientIP())
	// Stripe recommend a limit of 512KB for webhook payloads
	const MaxBodyBytes = int64(524288)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxBodyBytes)
	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.Errorf("Stripe webhook: Error reading request body: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Error reading request body"})
		return
	}

	sigHeader := c.GetHeader("Stripe-Signature")
	event, err := webhook.ConstructEventWithOptions(payload, sigHeader, config.AppConfig.StripeWebhookSecret, webhook.ConstructEventOptions{
		IgnoreAPIVersionMismatch: true,
	})
	if err != nil {
		logger.Errorf("Stripe webhook: Signature verification failed: %v", err)
		// Troubleshooting: log the first few chars of the expected secret (don't log the full secret)
		secret := config.AppConfig.StripeWebhookSecret
		if len(secret) > 8 {
			logger.Errorf("Stripe webhook: Using secret starting with %s...", secret[:8])
		} else {
			logger.Errorf("Stripe webhook: Secret is too short or empty")
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid signature"})
		return
	}

	logger.Infof("Stripe webhook: Received event type %s", event.Type)

	// Handle the event
	switch event.Type {
	case "checkout.session.completed":
		var sess stripe.CheckoutSession
		if err := json.Unmarshal(event.Data.Raw, &sess); err != nil {
			logger.Errorf("Stripe webhook: Error unmarshaling session: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Error unmarshaling session"})
			return
		}

		// Extract payment intent ID from raw JSON if it's a string (SDK struct might miss it)
		var piID string
		var raw map[string]interface{}
		if json.Unmarshal(event.Data.Raw, &raw) == nil {
			if pi, ok := raw["payment_intent"].(string); ok {
				piID = pi
			}
		}

		processSuccessfulPayment(c.Request.Context(), &sess, "webhook", piID)
	default:
		logger.Infof("Stripe webhook: Ignoring unhandled event type %s", event.Type)
	}

	c.Status(http.StatusOK)
}

func processSuccessfulPayment(ctx context.Context, sess *stripe.CheckoutSession, source string, manualPI string) {
	orderID, ok := sess.Metadata["order_id"]
	if !ok {
		logger.Errorf("Stripe %s: checkout session missing order_id metadata", source)
		return
	}

	oid, err := primitive.ObjectIDFromHex(orderID)
	if err != nil {
		logger.Errorf("Stripe %s: invalid order_id in metadata: %v", source, orderID)
		return
	}

	// Only process if payment was successful
	if sess.PaymentStatus != stripe.CheckoutSessionPaymentStatusPaid {
		logger.Infof("Stripe %s: session with payment_status=%s, skipping order %v", source, sess.PaymentStatus, orderID)
		return
	}

	col := database.DB.Collection("orders")
	now := time.Now()
	paymentIntentID := manualPI
	if paymentIntentID == "" {
		if sess.PaymentIntent != nil {
			paymentIntentID = sess.PaymentIntent.ID
		} else if sess.Metadata["payment_intent_id"] != "" {
			paymentIntentID = sess.Metadata["payment_intent_id"]
		}
	}

	if paymentIntentID == "" {
		logger.Warnf("Stripe %s: Could not find PaymentIntent ID in session %s", source, sess.ID)
	}

	// Fetch current order to check for duplicate history and existing status
	var currentOrder models.Order
	err = col.FindOne(ctx, bson.M{"_id": oid}).Decode(&currentOrder)
	if err == nil {
		// If already paid, don't add duplicate history
		if currentOrder.PaymentStatus == models.PaymentPaid && currentOrder.PaymentIntentID == paymentIntentID {
			return
		}
	}

	update := bson.M{
		"$set": bson.M{
			"payment_status":    models.PaymentPaid,
			"payment_intent_id": paymentIntentID,
			"updated_at":        now,
		},
		"$push": bson.M{
			"shipping_history": models.ShippingHistoryEntry{
				Message:   "Payment confirmed via Stripe (" + source + ").",
				CreatedAt: now,
				UpdatedBy: "system (stripe)",
			},
		},
	}

	_, err = col.UpdateOne(ctx, bson.M{"_id": oid}, update)
	if err != nil {
		logger.Errorf("Stripe %s: failed to update order %v: %v", source, orderID, err)
		return
	}

	logger.Infof("Stripe %s: order %v (%s) successfully marked as paid. PaymentIntent: %s", source, orderID, currentOrder.OrderNumber, paymentIntentID)

	// Telegram Notification
	var itemsSummary strings.Builder
	for _, it := range currentOrder.Items {
		itemsSummary.WriteString(fmt.Sprintf("\n• %s x %d — <i>%.2f AED</i>", it.Name, it.Quantity, it.Price*float64(it.Quantity)))
	}

	addr := currentOrder.Address
	addressStr := fmt.Sprintf("%s, %s, %s, %s", addr.Street, addr.City, addr.Zip, addr.Country)

	msg := fmt.Sprintf("✅ <b>Payment Confirmed!</b>\n"+
		"Order Number: <code>%s</code>\n"+
		"Total: <b>%.2f AED</b>\n"+
		"Stripe Session: <code>%s</code>\n\n"+
		"<b>Items:</b>%s\n\n"+
		"<b>Delivery Address:</b>\n<i>%s</i>",
		currentOrder.OrderNumber, currentOrder.Total, sess.ID, itemsSummary.String(), addressStr)

	utils.SendTelegramMessage(msg)

	// Log audit
	utils.Log(ctx, sess.Metadata["user_id"], sess.Metadata["customer_email"], "customer",
		models.AuditOrderStatus, orderID, "order", "Payment confirmed via Stripe", map[string]interface{}{
			"checkoutSessionId": sess.ID,
			"paymentIntentId":   paymentIntentID,
		})
}

// GetCheckoutSessionStatus returns the status of a Stripe Checkout Session.
// Used by the frontend success page to verify payment.
func GetCheckoutSessionStatus(c *gin.Context) {
	sessionID := c.Query("session_id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
		return
	}

	sess, err := utils.GetCheckoutSession(sessionID)
	if err != nil {
		logger.Errorf("GetCheckoutSessionStatus: failed to retrieve session %v: %v", sessionID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve checkout session"})
		return
	}

	// Fallback/Immediate Update: If paid, ensure DB is updated now in case webhook is slow/failed
	if sess.PaymentStatus == stripe.CheckoutSessionPaymentStatusPaid {
		processSuccessfulPayment(c.Request.Context(), sess, "status_check", "")
	}

	paymentIntentID := ""
	if sess.PaymentIntent != nil {
		paymentIntentID = sess.PaymentIntent.ID
	}

	c.JSON(http.StatusOK, gin.H{
		"status":          string(sess.Status),
		"paymentStatus":   string(sess.PaymentStatus),
		"customerEmail":   sess.CustomerDetails.Email,
		"orderID":         sess.Metadata["order_id"],
		"paymentIntentId": paymentIntentID,
	})
}
