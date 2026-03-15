package handlers

import (
	"context"
	"net/http"
	"time"

	"perfume-store/database"
	"perfume-store/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// SalesDataPoint is one bucket (day/month/year) of sales for charts.
type SalesDataPoint struct {
	Period     string  `json:"period" bson:"period"`
	Total      float64 `json:"total" bson:"total"`
	OrderCount int     `json:"orderCount" bson:"orderCount"`
}

// TopProductRow is one product's aggregated sales for reports.
type TopProductRow struct {
	ProductID   string  `json:"productId" bson:"productId"`
	ProductName string  `json:"productName" bson:"productName"`
	Quantity    int     `json:"quantity" bson:"quantity"`
	Revenue     float64 `json:"revenue" bson:"revenue"`
}

// GetSalesAnalytics returns sales over time (daily/monthly/yearly) and top products. Super_admin only.
func GetSalesAnalytics(c *gin.Context) {
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return
	}

	period := c.DefaultQuery("period", "month")
	topLimit := 10
	if n := c.Query("top"); n != "" {
		if v, ok := parseIntPositive(n); ok && v <= 50 {
			topLimit = v
		}
	}

	col := database.DB.Collection("orders")
	ctx := context.Background()

	now := time.Now().UTC()
	var start time.Time
	var dateFormat string
	switch period {
	case "day":
		start = now.AddDate(0, 0, -30)
		dateFormat = "%Y-%m-%d"
	case "year":
		start = now.AddDate(-5, 0, 0)
		dateFormat = "%Y"
	default:
		period = "month"
		start = now.AddDate(0, -12, 0)
		dateFormat = "%Y-%m"
	}

	// Revenue and sales report: only orders that are paid (payment_status=paid, or legacy status=paid)
	matchPaid := bson.M{"$or": []bson.M{
		{"payment_status": string(models.PaymentPaid)},
		{"$and": []bson.M{
			{"payment_status": bson.M{"$exists": false}},
			{"status": string(models.OrderPaid)},
		}},
	}}
	matchNotCancelled := bson.M{"status": bson.M{"$ne": string(models.OrderCancelled)}}
	matchRevenue := bson.M{"$and": []bson.M{matchNotCancelled, matchPaid}}
	matchDate := bson.M{"created_at": bson.M{"$gte": start}}

	// Exclude orders that have been refunded (accepted return with refund_issued_at) so sales report is accurate.
	lookupRefunded := bson.D{{Key: "$lookup", Value: bson.M{
		"from": "return_requests",
		"let":  bson.M{"oid": "$_id"},
		"pipeline": []bson.M{
			{"$match": bson.M{
				"$expr":            bson.M{"$eq": []interface{}{"$order_id", "$$oid"}},
				"status":           string(models.ReturnStatusAccepted),
				"refund_issued_at": bson.M{"$exists": true, "$ne": nil},
			}},
		},
		"as": "refunded",
	}}}
	matchNotRefunded := bson.D{{Key: "$match", Value: bson.M{"refunded": bson.M{"$size": 0}}}}

	groupID := bson.M{
		"period": bson.M{"$dateToString": bson.M{"date": "$created_at", "format": dateFormat}},
	}
	pipe := mongo.Pipeline{
		{{Key: "$match", Value: matchRevenue}},
		{{Key: "$match", Value: matchDate}},
		lookupRefunded,
		matchNotRefunded,
		{{Key: "$group", Value: bson.M{
			"_id":        groupID,
			"total":      bson.M{"$sum": "$total"},
			"orderCount": bson.M{"$sum": 1},
		}}},
		{{Key: "$sort", Value: bson.M{"_id.period": 1}}},
		{{Key: "$project", Value: bson.M{
			"_id":        0,
			"period":     "$_id.period",
			"total":      1,
			"orderCount": 1,
		}}},
	}
	cursor, err := col.Aggregate(ctx, pipe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer cursor.Close(ctx)

	var salesOverTime []SalesDataPoint
	if err := cursor.All(ctx, &salesOverTime); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Fill missing periods with zero so the chart shows a complete timeline (e.g. all 12 months).
	salesOverTime = fillSalesPeriods(salesOverTime, start, now, period)

	topPipe := mongo.Pipeline{
		{{Key: "$match", Value: matchRevenue}},
		{{Key: "$match", Value: matchDate}},
		lookupRefunded,
		matchNotRefunded,
		{{Key: "$unwind", Value: "$items"}},
		{{Key: "$group", Value: bson.M{
			"_id":      bson.M{"productId": "$items.product_id", "name": "$items.name"},
			"quantity": bson.M{"$sum": "$items.quantity"},
			"revenue":  bson.M{"$sum": bson.M{"$multiply": []interface{}{"$items.price", "$items.quantity"}}},
		}}},
		{{Key: "$sort", Value: bson.M{"revenue": -1}}},
		{{Key: "$limit", Value: topLimit}},
		{{Key: "$project", Value: bson.M{
			"_id":         0,
			"productId":   bson.M{"$toString": "$_id.productId"},
			"productName": "$_id.name",
			"quantity":    1,
			"revenue":     1,
		}}},
	}
	topCursor, err := col.Aggregate(ctx, topPipe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer topCursor.Close(ctx)

	var topProducts []TopProductRow
	if err := topCursor.All(ctx, &topProducts); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	countPipe := mongo.Pipeline{
		{{Key: "$match", Value: matchRevenue}},
		{{Key: "$match", Value: matchDate}},
		lookupRefunded,
		matchNotRefunded,
		{{Key: "$group", Value: bson.M{
			"_id":          nil,
			"totalRevenue": bson.M{"$sum": "$total"},
			"orderCount":   bson.M{"$sum": 1},
		}}},
	}
	countCursor, err := col.Aggregate(ctx, countPipe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer countCursor.Close(ctx)

	var summary struct {
		TotalRevenue float64 `bson:"totalRevenue"`
		OrderCount   int     `bson:"orderCount"`
	}
	if countCursor.Next(ctx) {
		_ = countCursor.Decode(&summary)
	}

	c.JSON(http.StatusOK, gin.H{
		"period":        period,
		"from":          start.Format(time.RFC3339),
		"to":            now.Format(time.RFC3339),
		"salesOverTime": salesOverTime,
		"topProducts":   topProducts,
		"summary": gin.H{
			"totalRevenue": summary.TotalRevenue,
			"orderCount":   summary.OrderCount,
		},
	})
}

// fillSalesPeriods returns a complete timeline from start to now, filling missing periods with zero.
// Period strings must match MongoDB $dateToString (e.g. "2006-01-02", "2006-01", "2006").
func fillSalesPeriods(actual []SalesDataPoint, start, now time.Time, period string) []SalesDataPoint {
	byPeriod := make(map[string]SalesDataPoint)
	for _, p := range actual {
		byPeriod[p.Period] = p
	}
	var periods []string
	switch period {
	case "day":
		sd := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
		ed := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
		for d := sd; !d.After(ed); d = d.AddDate(0, 0, 1) {
			periods = append(periods, d.Format("2006-01-02"))
		}
	case "year":
		sy := time.Date(start.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
		ey := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
		for d := sy; !d.After(ey); d = d.AddDate(1, 0, 0) {
			periods = append(periods, d.Format("2006"))
		}
	default: // month
		sm := time.Date(start.Year(), start.Month(), 1, 0, 0, 0, 0, time.UTC)
		em := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		for d := sm; !d.After(em); d = d.AddDate(0, 1, 0) {
			periods = append(periods, d.Format("2006-01"))
		}
	}
	out := make([]SalesDataPoint, 0, len(periods))
	for _, p := range periods {
		if v, ok := byPeriod[p]; ok {
			out = append(out, v)
		} else {
			out = append(out, SalesDataPoint{Period: p, Total: 0, OrderCount: 0})
		}
	}
	return out
}

func parseIntPositive(s string) (int, bool) {
	var n int
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, false
		}
		n = n*10 + int(c-'0')
	}
	return n, n > 0
}
