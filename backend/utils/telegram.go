package utils

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"perfume-store/database"
	"perfume-store/logger"
	"perfume-store/models"

	"go.mongodb.org/mongo-driver/bson"
)

type TelegramConfig struct {
	Enabled bool
	Token   string
	ChatID  string
}

// GetTelegramConfig retrieves the telegram bot settings from DB.
func GetTelegramConfig() TelegramConfig {
	if database.DB == nil {
		return TelegramConfig{Enabled: false}
	}
	col := database.DB.Collection("features")
	var doc models.FeatureFlagsDoc
	err := col.FindOne(context.Background(), bson.M{"_id": "features"}).Decode(&doc)
	if err != nil {
		return TelegramConfig{Enabled: false}
	}

	enabled := false
	if doc.TelegramEnabled != nil {
		enabled = *doc.TelegramEnabled
	}

	return TelegramConfig{
		Enabled: enabled,
		Token:   doc.TelegramBotToken,
		ChatID:  doc.TelegramChatID,
	}
}

type TelegramPayload struct {
	ChatID    string `json:"chat_id"`
	Text      string `json:"text"`
	ParseMode string `json:"parse_mode,omitempty"`
}

// SendTelegramMessage sends a message to the configured Telegram chat in a separate goroutine.
func SendTelegramMessage(text string) {
	tg := GetTelegramConfig()

	if !tg.Enabled || tg.Token == "" || tg.ChatID == "" {
		fmt.Println("-------------------------ffffffffffffffff")
		return
	}

	token := tg.Token
	chatID := tg.ChatID

	go func() {
		url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)
		payload := TelegramPayload{
			ChatID:    chatID,
			Text:      text,
			ParseMode: "HTML", // Using HTML for easier formatting of emojis and bold text
		}

		jsonPayload, err := json.Marshal(payload)
		if err != nil {
			logger.Errorf("Telegram: Failed to marshal payload: %v", err)
			return
		}

		resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonPayload))
		if err != nil {
			logger.Errorf("Telegram: Failed to send message: %v", err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			logger.Errorf("Telegram: API returned status %d", resp.StatusCode)
		} else {
			snippet := text
			if len(snippet) > 60 {
				snippet = snippet[:60] + "..."
			}
			logger.Infof("Telegram: Notification sent successfully: %s", snippet)
		}
	}()
}
