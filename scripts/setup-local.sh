#!/usr/bin/env bash
# Creates the DynamoDB table in LocalStack. Run once after `npm run local:up`.
set -euo pipefail

ENDPOINT="http://localhost:4566"
TABLE="reservations"
REGION="us-east-1"

echo "Waiting for LocalStack DynamoDB to be ready..."
until aws dynamodb list-tables --endpoint-url "$ENDPOINT" --region "$REGION" &>/dev/null; do
  sleep 1
done

if aws dynamodb describe-table \
     --endpoint-url "$ENDPOINT" \
     --region "$REGION" \
     --table-name "$TABLE" &>/dev/null; then
  echo "Table '$TABLE' already exists — skipping."
else
  aws dynamodb create-table \
    --endpoint-url "$ENDPOINT" \
    --region "$REGION" \
    --table-name "$TABLE" \
    --attribute-definitions AttributeName=id,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST
  echo "Table '$TABLE' created."
fi
