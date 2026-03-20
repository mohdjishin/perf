#!/bin/bash
set -e

BASE_URL="http://localhost:8080"
echo "--- Starting E2E Audit ---"

# 1. Public Access
echo "C1: Public Products"
curl -s -f "$BASE_URL/api/products" > /dev/null
echo "C2: Public Categories"
curl -s -f "$BASE_URL/api/categories" > /dev/null
echo "C3: Public Home"
curl -s -f "$BASE_URL/api/home" > /dev/null

# 2. Login SuperAdmin
echo "C4: SuperAdmin Login"
LOGIN_RES=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "superadmin@perfume.store", "password": "superadmin123"}')

TOKEN=$(echo $LOGIN_RES | grep -oP '"token":"\K[^"]+')

if [ -z "$TOKEN" ]; then
  echo "FAILED: Token not found in login response"
  exit 1
fi

# 3. SuperAdmin - Get Me (Auth Check)
echo "C5: Auth Me (SuperAdmin)"
curl -s -f -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/auth/me" > /dev/null

# 4. SuperAdmin - Update Category (Edge Case: previously reported 401)
echo "C6: Update Category (SuperAdmin)"
curl -s -f -X PUT "$BASE_URL/api/categories/69bc5c93031c0bb17d0d6e19" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Attar (Verified)"}' > /dev/null

# 5. SuperAdmin - Get Users
echo "C7: List Users"
curl -s -f -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/users" > /dev/null

# 6. Customer Simulation - Register (New User)
echo "C8: Customer Register"
RAND=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 8)
REG_RES=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"cust_$RAND@test.com\", \"password\": \"password123\", \"firstName\": \"Test\", \"lastName\": \"Customer\"}")
  
C_TOKEN=$(echo $REG_RES | grep -oP '"token":"\K[^"]+')

# 8. Get a valid Product ID
echo "C8.1: Get Product ID"
PROD_ID=$(curl -s "$BASE_URL/api/products" | grep -oP '"id":"\K[0-9a-f]{24}"' | head -n 1 | tr -d '"')
if [ -z "$PROD_ID" ]; then
  echo "FAILED: Could not find a valid product ID"
  exit 1
fi
echo "Using Product ID: $PROD_ID"

# 7. Customer - RBAC Test (Should fail to update categories)
echo "C9: RBAC Guard (Expecting 403)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE_URL/api/categories/69bc5c93031c0bb17d0d6e19" \
  -H "Authorization: Bearer $C_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Hacked"}')

if [ "$STATUS" != "403" ]; then
  echo "FAILED: RBAC RBAC failed. Expected 403, got $STATUS"
  exit 1
fi

# 8. Customer - Create Order (Checkout Initiation)
echo "C10: Create Order (Checkout)"
ORDER_RES=$(curl -s -X POST "$BASE_URL/api/orders" \
  -H "Authorization: Bearer $C_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"items\": [{\"productId\": \"$PROD_ID\", \"quantity\": 1}],
    \"address\": {\"street\": \"Test St\", \"city\": \"Dubai\", \"state\": \"Dubai\", \"zip\": \"00000\", \"country\": \"UAE\"}
  }")

if [[ "$ORDER_RES" == *"error"* ]]; then
  echo "FAILED: Order creation error: $ORDER_RES"
  exit 1
fi

SESSION_URL=$(echo $ORDER_RES | grep -oP '"checkoutUrl":"\K[^"]+')
if [ -z "$SESSION_URL" ]; then
  echo "FAILED: Checkout URL not created. Response: $ORDER_RES"
  exit 1
fi

echo "--- E2E Audit Completed Successfully ---"
