package handlers

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

const maxUploadSize = 5 << 20 // 5MB
const uploadDir = "uploads"

var allowedTypes = map[string]bool{
	"image/jpeg": true,
	"image/jpg":  true,
	"image/png":  true,
	"image/gif":  true,
	"image/webp": true,
}

// magic bytes (prefix) for allowed image types
var magicSignatures = map[string][]byte{
	"image/jpeg": {0xFF, 0xD8, 0xFF},
	"image/jpg":  {0xFF, 0xD8, 0xFF},
	"image/png":  {0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A},
	"image/gif":  []byte("GIF87a"),
	"image/webp": nil, // set in init: RIFF....WEBP
}

func init() {
	webpSig := make([]byte, 12)
	copy(webpSig, "RIFF")
	copy(webpSig[8:], "WEBP")
	magicSignatures["image/webp"] = webpSig
}

// UploadImage handles image file upload (admin only). Validates Content-Type and file magic bytes before saving.
func UploadImage(c *gin.Context) {
	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No image file provided"})
		return
	}

	if file.Size > maxUploadSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File too large (max 5MB)"})
		return
	}

	contentType := file.Header.Get("Content-Type")
	if !allowedTypes[contentType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type. Use JPEG, PNG, GIF, or WebP"})
		return
	}

	// Validate magic bytes
	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Could not read file"})
		return
	}
	defer src.Close()
	header := make([]byte, 12)
	n, _ := io.ReadAtLeast(src, header, 12)
	header = header[:n]
	if !validateMagicBytes(contentType, header) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File content does not match declared type. Use a valid JPEG, PNG, GIF, or WebP image."})
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" {
		ext = ".jpg"
	}
	filename := fmt.Sprintf("%s%s", randomID(), ext)

	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	dest := filepath.Join(uploadDir, filename)
	destFile, err := os.Create(dest)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}
	_, _ = destFile.Write(header)
	_, _ = io.Copy(destFile, src)
	if err := destFile.Close(); err != nil {
		os.Remove(dest)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Return path - frontend will use with same origin (proxy /uploads to backend)
	url := "/uploads/" + filename
	c.JSON(http.StatusOK, gin.H{"url": url})
}

func validateMagicBytes(contentType string, header []byte) bool {
	sig := magicSignatures[contentType]
	if sig == nil {
		return false
	}
	if contentType == "image/gif" {
		return bytes.HasPrefix(header, []byte("GIF87a")) || bytes.HasPrefix(header, []byte("GIF89a"))
	}
	if len(header) < len(sig) {
		return false
	}
	return bytes.HasPrefix(header, sig)
}

func randomID() string {
	b := make([]byte, 12)
	rand.Read(b)
	return hex.EncodeToString(b)
}
