package handlers

import (
	"context"
	"net/http"
	"strconv"

	"perfume-store/database"
	"perfume-store/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const orderFeeConfigID = "config"
const orderFeeConfigCol = "order_fee_config"

// OrderFeeItem is one configurable line: shipping, tax, discount, etc. Super_admin defines a slice of these.
type OrderFeeItem struct {
	Label              string  `json:"label" bson:"label"`
	Kind               string  `json:"kind" bson:"kind"`              // "charge" or "discount"
	ChargeType         string  `json:"chargeType" bson:"charge_type"` // "fixed" or "percent"
	Value              float64 `json:"value" bson:"value"`
	ThresholdAmount    float64 `json:"thresholdAmount,omitempty" bson:"threshold_amount,omitempty"`
	ThresholdCondition string  `json:"thresholdCondition,omitempty" bson:"threshold_condition,omitempty"` // always, less_than, less_than_or_equal, equal, greater_than, greater_than_or_equal
}

// OrderFeeConfig holds multiple fee/discount options. Super_admin only.
type OrderFeeConfig struct {
	Enabled bool           `json:"enabled" bson:"enabled"`
	Items   []OrderFeeItem `json:"items" bson:"items"`
}

// appliesThreshold returns true when the subtotal satisfies the condition (less than, less or equal, equal, greater than, greater or equal, or always).
func appliesThreshold(subtotal, threshold float64, condition string, epsilon float64) bool {
	switch condition {
	case "less_than":
		return subtotal < threshold
	case "less_than_or_equal":
		return subtotal <= threshold+epsilon
	case "equal":
		diff := subtotal - threshold
		if diff < 0 {
			diff = -diff
		}
		return diff < epsilon
	case "greater_than":
		return subtotal > threshold
	case "greater_than_or_equal":
		return subtotal >= threshold-epsilon
	case "always", "":
		return true
	default:
		return true
	}
}

// ComputeOrderFee returns net fee, total, and per-line breakdown for a given subtotal using the stored config.
func ComputeOrderFee(subtotal float64) (fee float64, total float64, breakdown []models.FeeBreakdownLine) {
	breakdown = nil
	if database.DB == nil {
		return 0, subtotal, breakdown
	}
	col := database.DB.Collection(orderFeeConfigCol)
	var cfg OrderFeeConfig
	err := col.FindOne(context.Background(), bson.M{"_id": orderFeeConfigID}, options.FindOne().SetProjection(bson.M{"enabled": 1, "items": 1})).Decode(&cfg)
	if err != nil || !cfg.Enabled || subtotal <= 0 {
		return 0, subtotal, breakdown
	}
	const epsilon = 0.001 // for "equal" float comparison
	var net float64
	for _, it := range cfg.Items {
		if !appliesThreshold(subtotal, it.ThresholdAmount, it.ThresholdCondition, epsilon) {
			continue
		}
		var amount float64
		switch it.ChargeType {
		case "percent":
			amount = subtotal * (it.Value / 100)
		case "fixed":
			amount = it.Value
		default:
			amount = 0
		}
		if it.Kind == "discount" {
			amount = -amount
			if amount > 0 {
				amount = 0
			}
		} else {
			if amount < 0 {
				amount = 0
			}
		}
		if amount != 0 {
			label := it.Label
			if label == "" {
				label = "Fee"
			}
			breakdown = append(breakdown, models.FeeBreakdownLine{Label: label, Amount: amount})
			net += amount
		}
	}
	total = subtotal + net
	return net, total, breakdown
}

// GetOrderFeeEstimate returns estimated fee, total, and breakdown for a subtotal (customer auth). Used at checkout.
func GetOrderFeeEstimate(c *gin.Context) {
	raw := c.Query("subtotal")
	if raw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "subtotal query required"})
		return
	}
	subtotal, err := strconv.ParseFloat(raw, 64)
	if err != nil || subtotal < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "subtotal must be a non-negative number"})
		return
	}
	fee, total, breakdown := ComputeOrderFee(subtotal)
	resp := gin.H{
		"subtotal":  subtotal,
		"fee":       fee,
		"total":     total,
		"breakdown": breakdown,
	}
	c.JSON(http.StatusOK, resp)
}

// GetOrderFeeConfig returns the order fee config (items slice). Super_admin only.
func GetOrderFeeConfig(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	col := database.DB.Collection(orderFeeConfigCol)
	var cfg OrderFeeConfig
	err := col.FindOne(context.Background(), bson.M{"_id": orderFeeConfigID}).Decode(&cfg)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"enabled": false,
			"items":   []OrderFeeItem{},
		})
		return
	}
	if cfg.Items == nil {
		cfg.Items = []OrderFeeItem{}
	}
	c.JSON(http.StatusOK, gin.H{
		"enabled": cfg.Enabled,
		"items":   cfg.Items,
	})
}

// UpdateOrderFeeConfigRequest is the body for updating order fee config.
type UpdateOrderFeeConfigRequest struct {
	Enabled *bool           `json:"enabled"`
	Items   *[]OrderFeeItem `json:"items"`
}

// UpdateOrderFeeConfig updates the order fee config. Super_admin only.
func UpdateOrderFeeConfig(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}
	var req UpdateOrderFeeConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	col := database.DB.Collection(orderFeeConfigCol)
	ctx := context.Background()
	var cfg OrderFeeConfig
	_ = col.FindOne(ctx, bson.M{"_id": orderFeeConfigID}).Decode(&cfg)
	updates := bson.M{}
	if req.Enabled != nil {
		cfg.Enabled = *req.Enabled
		updates["enabled"] = *req.Enabled
	}
	if req.Items != nil {
		items := *req.Items
		for i := range items {
			if items[i].ChargeType != "percent" && items[i].ChargeType != "fixed" {
				items[i].ChargeType = "fixed"
			}
			if items[i].Kind != "discount" {
				items[i].Kind = "charge"
			}
			if items[i].Value < 0 {
				items[i].Value = 0
			}
			if items[i].ThresholdAmount < 0 {
				items[i].ThresholdAmount = 0
			}
			switch items[i].ThresholdCondition {
			case "less_than", "less_than_or_equal", "equal", "greater_than", "greater_than_or_equal":
				// keep as-is
			case "above":
				items[i].ThresholdCondition = "greater_than"
			case "below":
				items[i].ThresholdCondition = "less_than"
			default:
				items[i].ThresholdCondition = "always"
			}
		}
		cfg.Items = items
		updates["items"] = items
	}
	if len(updates) == 0 {
		if cfg.Items == nil {
			cfg.Items = []OrderFeeItem{}
		}
		c.JSON(http.StatusOK, gin.H{"enabled": cfg.Enabled, "items": cfg.Items})
		return
	}
	_, err := col.UpdateOne(ctx, bson.M{"_id": orderFeeConfigID}, bson.M{"$set": updates}, options.Update().SetUpsert(true))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if cfg.Items == nil {
		cfg.Items = []OrderFeeItem{}
	}
	c.JSON(http.StatusOK, gin.H{"enabled": cfg.Enabled, "items": cfg.Items})
}
