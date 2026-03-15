package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// nominatimReverseResponse is the structure returned by Nominatim reverse geocoding API
type nominatimReverseResponse struct {
	Address     map[string]interface{} `json:"address"`
	DisplayName string                 `json:"display_name"`
}

// ReverseGeocode proxies to Nominatim and returns normalized address fields for checkout/profile forms
func ReverseGeocode(c *gin.Context) {
	lat := strings.TrimSpace(c.Query("lat"))
	lon := strings.TrimSpace(c.Query("lon"))
	if lat == "" || lon == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "lat and lon are required"})
		return
	}
	if _, err := strconv.ParseFloat(lat, 64); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid lat"})
		return
	}
	if _, err := strconv.ParseFloat(lon, 64); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid lon"})
		return
	}

	url := "https://nominatim.openstreetmap.org/reverse?lat=" + lat + "&lon=" + lon + "&format=json"
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build request"})
		return
	}
	req.Header.Set("User-Agent", "BlueMistPerfumes/1.0 (contact@example.com)")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not reach geocoding service"})
		return
	}
	defer resp.Body.Close()

	var data nominatimReverseResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid response from geocoding service"})
		return
	}

	street := getStr(data.Address, "house_number", "road", "street", "pedestrian", "path", "footway")
	if street == "" {
		parts := []string{}
		for _, k := range []string{"house_number", "road", "street", "pedestrian"} {
			if v := getStrOne(data.Address, k); v != "" {
				parts = append(parts, v)
			}
		}
		street = strings.TrimSpace(strings.Join(parts, " "))
	}
	city := getStrOne(data.Address, "city", "town", "village", "municipality", "county", "locality", "hamlet", "suburb", "neighbourhood", "state_district")
	state := getStrOne(data.Address, "state", "region")
	zip := getStrOne(data.Address, "postcode")
	country := getStrOne(data.Address, "country")

	if street == "" && data.DisplayName != "" {
		parts := strings.Split(data.DisplayName, ",")
		if len(parts) > 0 {
			street = strings.TrimSpace(parts[0])
		}
	}
	if city == "" && data.DisplayName != "" {
		parts := strings.Split(data.DisplayName, ",")
		if len(parts) >= 2 {
			city = strings.TrimSpace(parts[len(parts)-3])
		}
	}
	if country == "" && data.DisplayName != "" {
		parts := strings.Split(data.DisplayName, ",")
		if len(parts) >= 1 {
			country = strings.TrimSpace(parts[len(parts)-1])
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"street":  street,
		"city":    city,
		"state":   state,
		"zip":     zip,
		"country": country,
	})
}

func getStrOne(m map[string]interface{}, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				return strings.TrimSpace(s)
			}
		}
	}
	return ""
}

func getStr(m map[string]interface{}, keys ...string) string {
	var parts []string
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				parts = append(parts, strings.TrimSpace(s))
			}
		}
	}
	return strings.TrimSpace(strings.Join(parts, " "))
}
