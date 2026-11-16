# Multi-stage Docker build for Blue Mist Go Backend
FROM golang:alpine AS builder

WORKDIR /app

# Download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code and compile static binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o perfume-server .

# Production minimal runtime image
FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy compiled binary from builder
COPY --from=builder /app/perfume-server .

# Create uploads directory for image uploads
RUN mkdir -p uploads

EXPOSE 8080

ENV HOST=0.0.0.0
ENV PORT=8080
ENV APP_ENV=production

CMD ["./perfume-server"]
