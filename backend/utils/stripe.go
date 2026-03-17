package utils

import (
	"perfume-store/config"

	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/checkout/session"
)

// InitStripe sets the Stripe secret key from config.
func InitStripe() {
	stripe.Key = config.AppConfig.StripeSecretKey
}

// CheckoutLineItem represents a single line item for the Stripe Checkout Session.
type CheckoutLineItem struct {
	Name     string
	ImageURL string
	PriceFil int64 // unit price in fils (lowest AED unit, equivalent to cents)
	Quantity int64
}

// CreateCheckoutSession creates a Stripe Checkout Session with the given line items.
// The user is redirected to the Stripe-hosted page for payment. Supports Card, GPay, Apple Pay automatically.
func CreateCheckoutSession(orderID, userID, customerEmail string, items []CheckoutLineItem, successURL, cancelURL string) (*stripe.CheckoutSession, error) {
	lineItems := make([]*stripe.CheckoutSessionLineItemParams, len(items))
	for i, item := range items {
		li := &stripe.CheckoutSessionLineItemParams{
			PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
				Currency:   stripe.String(string(stripe.CurrencyAED)),
				UnitAmount: stripe.Int64(item.PriceFil),
				ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
					Name: stripe.String(item.Name),
				},
			},
			Quantity: stripe.Int64(item.Quantity),
		}
		// Add product image if available
		if item.ImageURL != "" {
			li.PriceData.ProductData.Images = []*string{stripe.String(item.ImageURL)}
		}
		lineItems[i] = li
	}

	params := &stripe.CheckoutSessionParams{
		Mode:       stripe.String(string(stripe.CheckoutSessionModePayment)),
		LineItems:  lineItems,
		SuccessURL: stripe.String(successURL),
		CancelURL:  stripe.String(cancelURL),
	}

	// Set customer email for receipt
	if customerEmail != "" {
		params.CustomerEmail = stripe.String(customerEmail)
	}

	// Store order_id and user_id in metadata for webhook
	params.AddMetadata("order_id", orderID)
	params.AddMetadata("user_id", userID)
	params.AddMetadata("customer_email", customerEmail)

	return session.New(params)
}

// GetCheckoutSession retrieves a Checkout Session by ID.
func GetCheckoutSession(sessionID string) (*stripe.CheckoutSession, error) {
	params := &stripe.CheckoutSessionParams{}
	params.AddExpand("payment_intent")
	return session.Get(sessionID, params)
}
