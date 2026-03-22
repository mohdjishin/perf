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

	"github.com/gin-gonic/gin"
)

const maxUploadSize = 5 << 20 // 5MB
const uploadDir = "uploads"

// UploadImage handles image file upload (admin only). Validates file magic bytes before saving.
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

	// Read magic bytes
	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Could not read file"})
		return
	}
	defer src.Close()

	header := make([]byte, 12)
	n, _ := io.ReadAtLeast(src, header, 12)
	header = header[:n]

	// Detect true content type and extension
	mime, ext := detectType(header)
	if mime == "" {
		fmt.Printf("Upload rejected: Unknown magic bytes for file '%s'. Header: %X\n", file.Filename, header)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file content. Use a valid JPEG, PNG, GIF, or WebP image."})
		return
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
	_, _ = destFile.Write(header) // Write the bytes we already read
	_, _ = io.Copy(destFile, src) // Copy the rest
	if err := destFile.Close(); err != nil {
		os.Remove(dest)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Return path - frontend will use with same origin (proxy /uploads to backend)
	url := "/uploads/" + filename
	c.JSON(http.StatusOK, gin.H{"url": url, "filename": filename})
}

// ListUploads returns a list of all files in the uploads directory (admin only)
func ListUploads(c *gin.Context) {
	files, err := os.ReadDir(uploadDir)
	if err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusOK, []string{})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read upload directory"})
		return
	}

	var filenames []string
	for _, f := range files {
		if !f.IsDir() {
			filenames = append(filenames, f.Name())
		}
	}
	c.JSON(http.StatusOK, filenames)
}

// DeleteUpload deletes a specific file from the uploads directory (admin only)
func DeleteUpload(c *gin.Context) {
	filename := c.Param("filename")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Filename is required"})
		return
	}

	// Prevent path traversal
	filename = filepath.Base(filename)
	path := filepath.Join(uploadDir, filename)

	if _, err := os.Stat(path); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	if err := os.Remove(path); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "File deleted successfully"})
}

func detectType(header []byte) (mime, ext string) {
	if bytes.HasPrefix(header, []byte{0xFF, 0xD8, 0xFF}) {
		return "image/jpeg", ".jpg"
	}
	if bytes.HasPrefix(header, []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}) {
		return "image/png", ".png"
	}
	if bytes.HasPrefix(header, []byte("GIF87a")) || bytes.HasPrefix(header, []byte("GIF89a")) {
		return "image/gif", ".gif"
	}
	if len(header) >= 12 && bytes.Equal(header[0:4], []byte("RIFF")) && bytes.Equal(header[8:12], []byte("WEBP")) {
		return "image/webp", ".webp"
	}
	return "", ""
}

func randomID() string {
	b := make([]byte, 12)
	rand.Read(b)
	return hex.EncodeToString(b)
}
