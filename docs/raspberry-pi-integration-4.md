# 第4章：Webアプリケーションとの連携 - 祠とWebの融合

この章では、Concordia Shrine Webアプリケーションと、Raspberry Piで動作する物理的な「祠」を連携させます。WebアプリケーションがリアルタイムでシーンをRaspberry Piに送信し、祠がそれに応じて光と音で反応する仕組みを構築します。

## 4.1 連携アーキテクチャの理解

WebアプリケーションとRaspberry Piの連携方法を理解しましょう。

### システム構成図

```
[PC/スマートフォン]
    ↓ マイク入力
[Concordia Shrine Webアプリ]
    ├─ 音声分析
    ├─ シーン判定（静寂/調和/一方的/沈黙）
    └─ HTTP POST → [Raspberry Pi Flask Server]
                        ├─ LED照明制御
                        └─ 介入通知
                              ↓
                        [物理的な祠]
                        ├─ NeoPixel LED
                        └─ スピーカー
```

### 通信プロトコル

WebアプリケーションからRaspberry Piへは、**HTTP POST**でシーン情報を送信します。

**エンドポイント**: `http://<Raspberry PiのIPアドレス>:5000/api/scene`

**リクエストボディ**（JSON形式）:
```json
{
  "scene": "調和"
}
```

**シーンの値**:
- `"静寂"` (silence)
- `"調和"` (harmony)
- `"一方的"` (monologue)
- `"沈黙"` (awkward)

**レスポンス**（JSON形式）:
```json
{
  "status": "success",
  "scene": "調和",
  "message": "シーンを更新しました"
}
```

## 4.2 Raspberry Pi側のFlask APIサーバーの実装

Webアプリケーションからのリクエストを受け取るAPIサーバーを実装します。

### Flaskサーバーコード

以下のコードを `/home/pi/concordia-shrine-pi/api_server.py` として保存します。

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Concordia Shrine API Server
WebアプリケーションからのシーンデータをHTTP POSTで受け取り、祠を制御する
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from shrine_controller import ShrineController
import os

# Flaskアプリケーションの初期化
app = Flask(__name__)
CORS(app)  # CORS対応（異なるドメインからのアクセスを許可）

# 祠コントローラーの初期化
SOUND_FILE = "/home/pi/concordia-shrine-pi/sounds/bell.wav"
shrine = None

def initialize_shrine():
    """祠コントローラーの初期化"""
    global shrine
    if shrine is None:
        if not os.path.exists(SOUND_FILE):
            print(f"警告: 音声ファイルが見つかりません: {SOUND_FILE}")
            print("介入通知は無効化されます")
        shrine = ShrineController(SOUND_FILE)
        shrine.start()
        print("祠コントローラーを起動しました")

@app.route('/api/scene', methods=['POST'])
def update_scene():
    """
    シーン更新エンドポイント
    
    リクエストボディ（JSON）:
    {
        "scene": "調和"  // "静寂", "調和", "一方的", "沈黙"
    }
    
    レスポンス（JSON）:
    {
        "status": "success",
        "scene": "調和",
        "message": "シーンを更新しました"
    }
    """
    try:
        # リクエストボディからシーン情報を取得
        data = request.get_json()
        
        if not data or 'scene' not in data:
            return jsonify({
                'status': 'error',
                'message': 'シーン情報が含まれていません'
            }), 400
        
        scene_jp = data['scene']
        
        # 日本語シーン名を英語に変換
        scene_map = {
            '静寂': 'silence',
            '調和': 'harmony',
            '一方的': 'monologue',
            '沈黙': 'awkward'
        }
        
        scene_en = scene_map.get(scene_jp)
        
        if scene_en is None:
            return jsonify({
                'status': 'error',
                'message': f'未知のシーン: {scene_jp}'
            }), 400
        
        # 祠コントローラーにシーンを設定
        shrine.set_scene(scene_en)
        
        return jsonify({
            'status': 'success',
            'scene': scene_jp,
            'message': 'シーンを更新しました'
        }), 200
        
    except Exception as e:
        print(f"エラー: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/status', methods=['GET'])
def get_status():
    """
    ステータス確認エンドポイント
    
    レスポンス（JSON）:
    {
        "status": "running",
        "current_scene": "調和"
    }
    """
    scene_map_reverse = {
        'silence': '静寂',
        'harmony': '調和',
        'monologue': '一方的',
        'awkward': '沈黙'
    }
    
    current_scene_en = shrine.current_scene if shrine else 'silence'
    current_scene_jp = scene_map_reverse.get(current_scene_en, '静寂')
    
    return jsonify({
        'status': 'running',
        'current_scene': current_scene_jp
    }), 200

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    ヘルスチェックエンドポイント
    """
    return jsonify({
        'status': 'ok'
    }), 200

def cleanup():
    """クリーンアップ処理"""
    global shrine
    if shrine:
        shrine.stop()
        print("祠コントローラーを停止しました")

if __name__ == '__main__':
    try:
        # 祠コントローラーの初期化
        initialize_shrine()
        
        # Flaskサーバーの起動
        print("Concordia Shrine API Serverを起動します")
        print("エンドポイント:")
        print("  POST /api/scene  - シーン更新")
        print("  GET  /api/status - ステータス確認")
        print("  GET  /api/health - ヘルスチェック")
        print()
        
        # 0.0.0.0でバインドすることで、外部からのアクセスを許可
        app.run(host='0.0.0.0', port=5000, debug=False)
        
    except KeyboardInterrupt:
        print("\n中断されました")
    finally:
        cleanup()
```

### サーバーの起動

```bash
cd /home/pi/concordia-shrine-pi
sudo python3 api_server.py
```

> **注意**: LED制御には`sudo`が必要です。

サーバーが起動すると、以下のメッセージが表示されます。

```
祠コントローラーを起動しました
Concordia Shrine API Serverを起動します
エンドポイント:
  POST /api/scene  - シーン更新
  GET  /api/status - ステータス確認
  GET  /api/health - ヘルスチェック

 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5000
 * Running on http://192.168.x.x:5000
```

### APIのテスト

別のターミナルから、`curl`コマンドでAPIをテストします。

```bash
# ヘルスチェック
curl http://localhost:5000/api/health

# ステータス確認
curl http://localhost:5000/api/status

# シーン更新（調和）
curl -X POST http://localhost:5000/api/scene \
  -H "Content-Type: application/json" \
  -d '{"scene": "調和"}'

# シーン更新（一方的）
curl -X POST http://localhost:5000/api/scene \
  -H "Content-Type: application/json" \
  -d '{"scene": "一方的"}'
```

LEDの色が変化し、「一方的」のシーンでは通知音が鳴ることを確認してください。

## 4.3 Webアプリケーション側の修正

Concordia Shrine Webアプリケーションに、Raspberry Piへシーンを送信する機能を追加します。

### 設定ファイルの作成

Raspberry PiのIPアドレスを設定ファイルに記載します。

`/home/ubuntu/Concordia-shirine/client/src/config/shrine.ts` を作成します。

```typescript
/**
 * 物理的な祠（Raspberry Pi）の設定
 */

export const SHRINE_CONFIG = {
  // Raspberry PiのIPアドレスとポート
  apiUrl: 'http://192.168.1.100:5000',  // ← あなたのRaspberry PiのIPアドレスに変更
  
  // シーン送信の設定
  enabled: true,  // 物理的な祠との連携を有効化
  debounceMs: 1000,  // シーン変更後、1秒間は連続送信しない
};
```

> **重要**: `apiUrl` の `192.168.1.100` を、あなたのRaspberry Piの実際のIPアドレスに変更してください。

### シーン送信関数の作成

`/home/ubuntu/Concordia-shirine/client/src/lib/shrineApi.ts` を作成します。

```typescript
/**
 * 物理的な祠（Raspberry Pi）との通信
 */

import { SHRINE_CONFIG } from '@/config/shrine';
import type { SceneType } from './waveEngine';

/**
 * Raspberry Piにシーン情報を送信
 */
export async function sendSceneToShrine(scene: SceneType): Promise<void> {
  if (!SHRINE_CONFIG.enabled) {
    console.log('[Shrine] 物理的な祠との連携は無効化されています');
    return;
  }

  try {
    const response = await fetch(`${SHRINE_CONFIG.apiUrl}/api/scene`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scene }),
      // タイムアウト設定（5秒）
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('[Shrine] シーンを送信しました:', data);
  } catch (error) {
    // エラーが発生しても、Webアプリケーション側の動作は継続
    console.error('[Shrine] シーンの送信に失敗しました:', error);
  }
}

/**
 * Raspberry Piのステータスを確認
 */
export async function checkShrineStatus(): Promise<boolean> {
  if (!SHRINE_CONFIG.enabled) {
    return false;
  }

  try {
    const response = await fetch(`${SHRINE_CONFIG.apiUrl}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });

    return response.ok;
  } catch (error) {
    console.error('[Shrine] ステータス確認に失敗しました:', error);
    return false;
  }
}
```

### WaveEngineへの統合

`/home/ubuntu/Concordia-shirine/client/src/lib/waveEngine.ts` の `setScene` メソッドを修正します。

既存のコードを探し、以下のように修正します。

```typescript
import { sendSceneToShrine } from './shrineApi';

// ... 既存のコード ...

setScene(scene: SceneType): void {
  if (this.currentScene === scene) return;
  
  this.currentScene = scene;
  this.currentParams = SCENE_WAVE_PARAMS[scene];
  
  console.log(`[WaveEngine] シーン変更: ${scene}`);
  
  // 物理的な祠にシーンを送信
  sendSceneToShrine(scene).catch(console.error);
}
```

### デバウンス処理の追加（オプション）

シーンが頻繁に変化する場合、Raspberry Piへの送信を制限するため、デバウンス処理を追加します。

`/home/ubuntu/Concordia-shirine/client/src/lib/shrineApi.ts` を以下のように修正します。

```typescript
import { SHRINE_CONFIG } from '@/config/shrine';
import type { SceneType } from './waveEngine';

// デバウンス用の変数
let lastSentScene: SceneType | null = null;
let lastSentTime = 0;

/**
 * Raspberry Piにシーン情報を送信（デバウンス付き）
 */
export async function sendSceneToShrine(scene: SceneType): Promise<void> {
  if (!SHRINE_CONFIG.enabled) {
    console.log('[Shrine] 物理的な祠との連携は無効化されています');
    return;
  }

  const now = Date.now();
  
  // デバウンス: 同じシーンを短時間に連続送信しない
  if (
    lastSentScene === scene &&
    now - lastSentTime < SHRINE_CONFIG.debounceMs
  ) {
    console.log('[Shrine] デバウンス中のため送信をスキップ:', scene);
    return;
  }

  try {
    const response = await fetch(`${SHRINE_CONFIG.apiUrl}/api/scene`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scene }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('[Shrine] シーンを送信しました:', data);
    
    // デバウンス情報を更新
    lastSentScene = scene;
    lastSentTime = now;
  } catch (error) {
    console.error('[Shrine] シーンの送信に失敗しました:', error);
  }
}

// ... 既存のcheckShrineStatus関数 ...
```

## 4.4 動作確認とテスト

WebアプリケーションとRaspberry Piが正しく連携しているか確認します。

### 準備

1.  **Raspberry Pi側**: APIサーバーを起動
    ```bash
    cd /home/pi/concordia-shrine-pi
    sudo python3 api_server.py
    ```

2.  **PC側**: Webアプリケーションを起動
    ```bash
    cd /home/ubuntu/Concordia-shirine
    pnpm dev
    ```

### テスト手順

1.  **Webアプリケーションにアクセス**
    ブラウザで `http://localhost:5173/` を開きます。

2.  **マイクの許可**
    ブラウザがマイクへのアクセスを求めたら、「許可」をクリックします。

3.  **録音開始**
    「録音開始」ボタンをクリックします。

4.  **シーンの変化を観察**
    -   **静寂**: 誰も話していないとき → 祠が淡い青色に光る
    -   **調和**: 穏やかに会話しているとき → 祠が翡翠色に光る
    -   **一方的**: 一人が長く話し続けるとき → 祠が朱色に光り、通知音が鳴る
    -   **沈黙**: 気まずい沈黙が続くとき → 祠が深紫色に光り、通知音が鳴る

5.  **ブラウザのコンソールを確認**
    開発者ツール（F12）を開き、コンソールに以下のようなログが表示されることを確認します。
    ```
    [WaveEngine] シーン変更: 調和
    [Shrine] シーンを送信しました: {status: "success", scene: "調和", message: "シーンを更新しました"}
    ```

6.  **Raspberry Piのコンソールを確認**
    Raspberry Pi側のターミナルに、以下のようなログが表示されることを確認します。
    ```
    シーン変更: silence -> harmony
    127.0.0.1 - - [13/Jan/2026 10:30:45] "POST /api/scene HTTP/1.1" 200 -
    ```

### トラブルシューティング

| 症状 | 原因 | 対処法 |
| :--- | :--- | :--- |
| 祠が反応しない | APIサーバーが起動していない | Raspberry Pi側で`sudo python3 api_server.py`を実行 |
| 祠が反応しない | IPアドレスが間違っている | `shrine.ts`の`apiUrl`を確認 |
| 祠が反応しない | ファイアウォールでブロックされている | Raspberry Piのファイアウォール設定を確認 |
| CORSエラー | CORS設定が不足 | `api_server.py`に`CORS(app)`が含まれているか確認 |
| タイムアウトエラー | ネットワークが遅い | `shrineApi.ts`のタイムアウト時間を延長 |
| コンソールにエラーが表示される | Webアプリケーションの修正ミス | エラーメッセージを確認し、コードを見直す |

## 4.5 自動起動の設定

Raspberry Piの起動時に、APIサーバーが自動的に起動するように設定します。

### systemdサービスの作成

`/etc/systemd/system/concordia-shrine.service` を作成します。

```bash
sudo nano /etc/systemd/system/concordia-shrine.service
```

以下の内容を記述します。

```ini
[Unit]
Description=Concordia Shrine API Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/concordia-shrine-pi
ExecStart=/usr/bin/python3 /home/pi/concordia-shrine-pi/api_server.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### サービスの有効化と起動

```bash
# サービスをリロード
sudo systemctl daemon-reload

# サービスを有効化（起動時に自動起動）
sudo systemctl enable concordia-shrine.service

# サービスを起動
sudo systemctl start concordia-shrine.service

# ステータス確認
sudo systemctl status concordia-shrine.service
```

### サービスの管理コマンド

```bash
# サービスの停止
sudo systemctl stop concordia-shrine.service

# サービスの再起動
sudo systemctl restart concordia-shrine.service

# ログの確認
sudo journalctl -u concordia-shrine.service -f
```

---

**お疲れ様でした！** これで、Webアプリケーションと物理的な「祠」が完全に連携し、リアルタイムで会議の「空気」を表現できるようになりました。

次の「第5章：フェーズ2の準備」では、水面振動の実装に向けた準備を行います。
