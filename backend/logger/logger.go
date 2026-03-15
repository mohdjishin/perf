package logger

import (
	"fmt"
	"os"

	"github.com/rs/zerolog"
)

var log zerolog.Logger

func init() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log = zerolog.New(zerolog.ConsoleWriter{
		Out:        os.Stdout,
		TimeFormat: "15:04:05",
		NoColor:    false,
	}).With().Timestamp().Logger()
}

// Info logs an info message
func Info(msg string) {
	log.Info().Msg(msg)
}

// Infof logs a formatted info message
func Infof(format string, args ...interface{}) {
	log.Info().Msg(fmt.Sprintf(format, args...))
}

// Warn logs a warning message
func Warn(msg string) {
	log.Warn().Msg(msg)
}

// Warnf logs a formatted warning message
func Warnf(format string, args ...interface{}) {
	log.Warn().Msg(fmt.Sprintf(format, args...))
}

// Error logs an error message
func Error(msg string) {
	log.Error().Msg(msg)
}

// Errorf logs a formatted error message
func Errorf(format string, args ...interface{}) {
	log.Error().Msg(fmt.Sprintf(format, args...))
}

// Fatal logs a fatal message and exits
func Fatal(msg string) {
	log.Fatal().Msg(msg)
}

// Fatalf logs a formatted fatal message and exits
func Fatalf(format string, args ...interface{}) {
	log.Fatal().Msg(fmt.Sprintf(format, args...))
}

// Request logs an HTTP request with method, path, status, duration, client IP
func Request(method, path, clientIP string, status int, durationMs int64) {
	ev := log.Info()
	if status >= 500 {
		ev = log.Error()
	} else if status >= 400 {
		ev = log.Warn()
	}
	ev.Str("method", method).
		Str("path", path).
		Str("ip", clientIP).
		Int("status", status).
		Int64("ms", durationMs).
		Msg("request")
}
