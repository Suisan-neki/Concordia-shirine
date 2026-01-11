# Concordia Shrine v2 - Technical Specification

## System Architecture (Serverless & Event-Driven)

```mermaid
graph TD
    Client[Client (React/Vite)] -->|HTTPS| CloudFront[CloudFront (CDN)]
    CloudFront -->|Security Headers| WAF[AWS WAF]
    WAF -->|API Requests| APIGW[API Gateway]
    APIGW -->|tRPC| Lambda[AWS Lambda (Node.js/Python)]
    Lambda -->|Analysis| OpenAI[OpenAI API (Realtime/GPT-4o)]
    Lambda -->|Persistance| DB[(Database / S3)]
```

完全なサーバーレス構成により、高い可用性とスケーラビリティを実現しています。
インフラ管理コストを最小限に抑えつつ、エンタープライズグレードのセキュリティを提供します。

### AI & Analysis (Multimedia Processing)

- **Perlin Noise**: リアルタイムの波形生成
- **OpenAI Whisper**: 高精度な音声認識
- **GPT-4o**: 文脈分析とセッションスコアリング

リアルタイムの音声波形分析 (Web Audio API) と、LLMによる文脈分析を融合。「空気」という抽象的な概念を、数学的なモデルを通じて可視化しています。

---

## Tech Stack

### Frontend
- **Framework**: React 19
- **Language**: TypeScript 5.x
- **Build Tool**: Vite 6.x
- **Styling**: Tailwind CSS 4
- **Animation**: Framer Motion
- **UI Components**: Radix UI

### Backend
- **API Framework**: tRPC (Type-safe API)
- **Compute**: AWS Lambda (Adapter)
- **Runtime**: Node.js / Python
- **AI**: OpenAI API
- **ORM**: Drizzle ORM

### Infrastructure (IaC)
- **Provisioning**: AWS CDK
- **Auth**: Amazon Cognito
- **CDN**: CloudFront
- **Storage**: S3
- **Gateway**: API Gateway

---

## Security Implementation

### Domain Segregation
フロントエンド (`d123.cloudfront.net`) とバックエンド (API Gateway) のドメインを物理的に分離し、クロスサイトスクリプティング (XSS) のリスクを構造的に低減しています。

### Least Privilege (最小権限の原則)
AWS Lambda 関数には、そのタスクを実行するために必要最小限の IAM 権限のみを付与しています。

### Type Safety
tRPC を採用することで、フロントエンドからバックエンドまで完全な型安全性を確保。不正なデータ構造の混入をコンパイルレベルで排除します。

### Constructor Safety
ドメイン駆動設計 (DDD) に基づき、`SessionEntity` などのドメインモデルは「常に正しい状態」でのみインスタンス化できるよう設計（バリデータの強制）。
