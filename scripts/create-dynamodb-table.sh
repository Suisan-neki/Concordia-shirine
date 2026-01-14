#!/bin/bash

# DynamoDBテーブル作成スクリプト
# AWS CLIを使用してConcordia Shrineの全テーブルを作成します

set -e

ENVIRONMENT="${1:-dev}"
REGION="${AWS_REGION:-ap-northeast-1}"
PREFIX="concordia"

function ensure_table() {
  local name="$1"
  shift

  if aws dynamodb describe-table --table-name "$name" --region "$REGION" --no-cli-pager >/dev/null 2>&1; then
    echo "✅ Table already exists: $name"
    return
  fi

  echo "Creating DynamoDB table: $name in region: $REGION"
  aws dynamodb create-table --table-name "$name" "$@" --region "$REGION" --no-cli-pager
  echo "✅ Table created: $name"
}

USERS_TABLE="${PREFIX}-users-${ENVIRONMENT}"
SECURITY_LOGS_TABLE="${PREFIX}-securityAuditLogs-${ENVIRONMENT}"
INTERVIEWS_TABLE="${PREFIX}-interviews-${ENVIRONMENT}"
SESSIONS_TABLE="${PREFIX}-sessions-${ENVIRONMENT}"
SESSION_LOGS_TABLE="${PREFIX}-sessionLogs-${ENVIRONMENT}"
INTERVENTION_SETTINGS_TABLE="${PREFIX}-interventionSettings-${ENVIRONMENT}"

ensure_table "$USERS_TABLE" \
  --attribute-definitions AttributeName=openId,AttributeType=S AttributeName=id,AttributeType=N \
  --key-schema AttributeName=openId,KeyType=HASH \
  --global-secondary-indexes '[{"IndexName":"id-index","KeySchema":[{"AttributeName":"id","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}]' \
  --billing-mode PAY_PER_REQUEST

ensure_table "$SECURITY_LOGS_TABLE" \
  --attribute-definitions AttributeName=logId,AttributeType=S AttributeName=timestamp,AttributeType=N \
  --key-schema AttributeName=logId,KeyType=HASH AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

ensure_table "$INTERVIEWS_TABLE" \
  --attribute-definitions AttributeName=interview_id,AttributeType=S AttributeName=segment,AttributeType=S AttributeName=created_at,AttributeType=S \
  --key-schema AttributeName=interview_id,KeyType=HASH \
  --global-secondary-indexes '[{"IndexName":"segment-index","KeySchema":[{"AttributeName":"segment","KeyType":"HASH"},{"AttributeName":"created_at","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]' \
  --billing-mode PAY_PER_REQUEST

ensure_table "$SESSIONS_TABLE" \
  --attribute-definitions AttributeName=sessionId,AttributeType=S AttributeName=userId,AttributeType=N AttributeName=startTime,AttributeType=N AttributeName=id,AttributeType=N \
  --key-schema AttributeName=sessionId,KeyType=HASH \
  --global-secondary-indexes '[{"IndexName":"userId-startTime-index","KeySchema":[{"AttributeName":"userId","KeyType":"HASH"},{"AttributeName":"startTime","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}},{"IndexName":"id-index","KeySchema":[{"AttributeName":"id","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}]' \
  --billing-mode PAY_PER_REQUEST

ensure_table "$SESSION_LOGS_TABLE" \
  --attribute-definitions AttributeName=sessionId,AttributeType=N AttributeName=logKey,AttributeType=S \
  --key-schema AttributeName=sessionId,KeyType=HASH AttributeName=logKey,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

ensure_table "$INTERVENTION_SETTINGS_TABLE" \
  --attribute-definitions AttributeName=userId,AttributeType=N \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

echo ""
echo "✅ DynamoDB tables are ready."
echo "Region: $REGION"
echo "Environment: $ENVIRONMENT"
echo ""
echo "You can verify tables in AWS Console:"
echo "https://console.aws.amazon.com/dynamodbv2/home?region=$REGION#tables"
