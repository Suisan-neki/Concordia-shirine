# リアルタイム文字起こし API 仕様書

## 概要
AWS Lambda と API Gateway を使用した「ほぼリアルタイム（Almost Real-time）」の文字起こしAPIです。
フロントエンドから音声を短いチャンク（3〜10秒程度）で送信することで、即座にタイムスタンプ付きの文字起こし結果を受け取ることができます。これにより、音声入力に基づいた波形アニメーション（Wave）のリアルタイム制御が可能になります。

## デプロイ済みリソース

| 項目 | 値 |
| :--- | :--- |
| **エンドポイント URL** | `https://2o259ru5i9.execute-api.ap-northeast-1.amazonaws.com/transcribe` |
| **HTTP メソッド** | `POST` |
| **使用モデル** | `faster-whisper (base)` |
| **応答速度 (目安)** | ~0.5秒 (Warm Start) / ~3.5秒 (Cold Start) |

## アーキテクチャ構成
```mermaid
graph LR
    Client[Frontend (Mic)] -->|POST /transcribe (Base64)| APIGW[API Gateway]
    APIGW -->|Event| Lambda[RealtimeTranscribeFn]
    Lambda -->|Text + Timestamps| APIGW
    APIGW -->|JSON| Client
```

## 利用方法

### 1. curl コマンドでのテスト
JSONファイルを作成し、POSTリクエスト（`audio_data` は Base64エンコードされたWAV/MP3データ）を送信します。

```bash
# テスト用ペイロード作成（無音など）
echo '{ "audio_data": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=" }' > test_payload.json

# リクエスト送信
curl -X POST https://2o259ru5i9.execute-api.ap-northeast-1.amazonaws.com/transcribe \
  -H "Content-Type: application/json" \
  -d @test_payload.json
```

**レスポンス例:**
```json
{
  "segments": [
    {
      "start": 0.0,
      "end": 2.5,
      "text": "こんにちは",
      "confidence": -0.15
    }
  ],
  "language": "ja",
  "language_probability": 0.99,
  "duration": 0.45
}
```

### 2. JavaScript (Frontend) 実装例
マイクから取得した音声BlobをBase64に変換して送信する関数です。

```javascript
async function transcribeAudio(blob) {
  // Blob を Base64 文字列に変換
  const reader = new FileReader();
  reader.readAsDataURL(blob);
  
  return new Promise((resolve, reject) => {
    reader.onloadend = async () => {
      // "data:audio/wav;base64," のプレフィックスを除去
      const base64Audio = reader.result.split(',')[1]; 
      
      try {
        const response = await fetch("https://2o259ru5i9.execute-api.ap-northeast-1.amazonaws.com/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio_data: base64Audio })
        });
        
        const data = await response.json();
        console.log("文字起こし結果:", data);
        resolve(data);
      } catch (e) {
        console.error("API エラー:", e);
        reject(e);
      }
    };
  });
}
```

## 注意事項・仕様
*   **モデル**: レスポンス速度を優先し、現在は `base` モデルを使用しています。
*   **話者分離**: リアルタイム性を損なうため、サーバー側での厳密な分離は行っていません。フロントエンド側で、返ってきた `duration`（発話時間の長さ）や、クライアントサイドでの音量レベルを組み合わせて「一方的な発話」を判定してください。
*   **課金について**: Lambdaの実行時間（100ms単位）に対してのみ課金されます。待機コストは発生しません。
