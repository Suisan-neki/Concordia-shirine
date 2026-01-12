#!/bin/bash

# DynamoDBテーブル作成スクリプト
# AWS CLIを使用してusersテーブルを作成します

set -e

TABLE_NAME="concordia-users-dev"
REGION="ap-northeast-1"

echo "Creating DynamoDB table: $TABLE_NAME in region: $REGION"

aws dynamodb create-table \
  --table-name "$TABLE_NAME" \
  --attribute-definitions AttributeName=openId,AttributeType=S \
  --key-schema AttributeName=openId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" \
  --no-cli-pager

echo ""
echo "✅ Table created successfully!"
echo ""
echo "Table name: $TABLE_NAME"
echo "Region: $REGION"
echo ""
echo "You can verify the table in AWS Console:"
echo "https://console.aws.amazon.com/dynamodbv2/home?region=$REGION#tables"

