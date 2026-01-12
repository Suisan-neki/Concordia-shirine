# 第2章：LED照明の実装 - 祠に光を灯す

この章では、NeoPixel LEDテープを配線し、Webアプリケーションから受け取ったシーン情報に応じて、祠を美しく照らす仕組みを構築します。配線からテストコード、そして本番用のサーバーコードまで、一つ一つ確実に進めていきましょう。

## 2.1 部品の確認と準備

作業を始める前に、必要な部品がすべて揃っているか確認します。

### 必要な部品

| 部品名 | 数量 | 備考 |
| :--- | :--- | :--- |
| NeoPixel LED 1m 60LED（黒PCB） | 1本 | WS2812B、5V駆動 |
| 5V 3A ACアダプター（KOZUMUWAN） | 1個 | DCジャック出力 |
| WAGO 221-412（2穴端子台） | 3個 | +5V、GND、データ線用 |
| ジャンパーワイヤー（オス-オス） | 3本 | Raspberry Piとの接続用 |
| ブレッドボード | 1個 | テスト用（オプション） |

### 事前確認

1.  **NeoPixel LEDの端子確認**
    LEDテープの端には、3本の線が出ています。色分けは以下の通りです。
    -   **赤線**: +5V（電源）
    -   **白線**: GND（グランド）
    -   **緑線**: DIN（データ入力）

2.  **ACアダプターの準備**
    DCジャック出力のACアダプターは、そのままではLEDテープに接続できません。ジャックの先端を切断し、内部の線を露出させる必要があります。

    > **注意**: 必ず電源を抜いた状態で作業してください。

    -   ジャックの先端から約5cm程度の位置で、ケーブルを切断します。
    -   外側の被覆を剥き、内部の2本の線（通常は赤と黒、または赤と白）を露出させます。
    -   各線の先端1cm程度の被覆を剥きます。
    -   **極性の確認**: テスターで確認するか、一般的には以下の通りです。
        -   **赤線または中心の線**: +5V
        -   **黒線または外側の線**: GND

## 2.2 配線図と接続手順

Raspberry Pi、NeoPixel LED、外部電源を正しく接続します。

### 配線図（テキスト版）

```
[外部電源 5V 3A ACアダプター]
    +5V (赤) ──> [WAGO端子台①] ──> [LED赤線 +5V]
    GND (黒) ──> [WAGO端子台②] ──> [LED白線 GND]
                                  └──> [Raspberry Pi GND (Pin 6)]

[Raspberry Pi 4]
    GPIO18 (Pin 12) ──> [LED緑線 DIN]
    GND (Pin 6) ──> [WAGO端子台②]
```

### Raspberry Piのピン配置

Raspberry Pi 4の40ピンヘッダーは、以下のように配置されています（上から見た図）。

```
    3.3V  [ 1] [ 2]  5V
   GPIO2  [ 3] [ 4]  5V
   GPIO3  [ 5] [ 6]  GND  ← ここを使用
   GPIO4  [ 7] [ 8]  GPIO14
     GND  [ 9] [10]  GPIO15
  GPIO17  [11] [12]  GPIO18 ← ここを使用（PWM対応）
  GPIO27  [13] [14]  GND
  GPIO22  [15] [16]  GPIO23
    3.3V  [17] [18]  GPIO24
  GPIO10  [19] [20]  GND
   GPIO9  [21] [22]  GPIO25
  GPIO11  [23] [24]  GPIO8
     GND  [25] [26]  GPIO7
   ...（以下省略）
```

### 接続手順

1.  **外部電源の+5VをLEDの+5Vに接続**
    -   WAGO端子台①のレバーを上げます。
    -   外部電源の赤線（+5V）を一方の穴に挿入します。
    -   LEDテープの赤線（+5V）をもう一方の穴に挿入します。
    -   レバーを下げて固定します。

2.  **外部電源のGNDとLEDのGND、Raspberry PiのGNDを共通接続**
    -   WAGO端子台②のレバーを上げます。
    -   外部電源の黒線（GND）を挿入します。
    -   LEDテープの白線（GND）を挿入します。
    -   Raspberry PiのPin 6（GND）に接続したジャンパーワイヤーを挿入します。
    -   レバーを下げて固定します。

    > **重要**: GNDを共通接続しないと、データ信号が正しく伝わりません。

3.  **Raspberry PiのGPIO18をLEDのDINに接続**
    -   ジャンパーワイヤーの一端をRaspberry PiのPin 12（GPIO18）に接続します。
    -   もう一端をLEDテープの緑線（DIN）に直接接続するか、WAGO端子台を使って接続します。

4.  **配線の確認**
    以下のチェックリストで、配線が正しいか確認してください。

    - [ ] 外部電源の+5VがLEDの赤線に接続されている
    - [ ] 外部電源のGNDがLEDの白線とRaspberry PiのGNDに接続されている
    - [ ] Raspberry PiのGPIO18がLEDの緑線に接続されている
    - [ ] すべての接続が確実に固定されている
    - [ ] 配線がショートしていない

## 2.3 テストコードの作成と実行

配線が完了したら、LEDが正しく動作するかテストします。

### テストコード

以下のコードを `/home/pi/concordia-shrine-pi/led_test.py` として保存します。

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NeoPixel LED テストプログラム
"""

import time
import board
import neopixel

# LED設定
LED_COUNT = 60          # LEDの数
LED_PIN = board.D18     # GPIO18（Pin 12）
LED_BRIGHTNESS = 0.2    # 明るさ（0.0-1.0）

# NeoPixelオブジェクトの初期化
pixels = neopixel.NeoPixel(
    LED_PIN,
    LED_COUNT,
    brightness=LED_BRIGHTNESS,
    auto_write=False,
    pixel_order=neopixel.GRB
)

def test_all_red():
    """すべてのLEDを赤色に点灯"""
    print("テスト1: すべて赤色に点灯")
    pixels.fill((255, 0, 0))
    pixels.show()
    time.sleep(3)

def test_all_green():
    """すべてのLEDを緑色に点灯"""
    print("テスト2: すべて緑色に点灯")
    pixels.fill((0, 255, 0))
    pixels.show()
    time.sleep(3)

def test_all_blue():
    """すべてのLEDを青色に点灯"""
    print("テスト3: すべて青色に点灯")
    pixels.fill((0, 0, 255))
    pixels.show()
    time.sleep(3)

def test_rainbow():
    """虹色のグラデーション"""
    print("テスト4: 虹色のグラデーション")
    for i in range(LED_COUNT):
        hue = i / LED_COUNT
        r = int((1 - abs(hue * 6 - 3) / 3) * 255)
        g = int((1 - abs(hue * 6 - 2) / 2) * 255)
        b = int((1 - abs(hue * 6 - 4) / 2) * 255)
        pixels[i] = (r, g, b)
    pixels.show()
    time.sleep(3)

def test_off():
    """すべてのLEDを消灯"""
    print("テスト5: すべて消灯")
    pixels.fill((0, 0, 0))
    pixels.show()

if __name__ == "__main__":
    try:
        print("NeoPixel LEDテストを開始します")
        print(f"LED数: {LED_COUNT}")
        print(f"明るさ: {LED_BRIGHTNESS * 100}%")
        print()
        
        test_all_red()
        test_all_green()
        test_all_blue()
        test_rainbow()
        test_off()
        
        print("\nテスト完了！")
        
    except KeyboardInterrupt:
        print("\n中断されました")
    finally:
        pixels.fill((0, 0, 0))
        pixels.show()
        print("LEDを消灯しました")
```

### 実行方法

1.  **ファイルの作成**
    ```bash
    cd /home/pi/concordia-shrine-pi
    nano led_test.py
    ```
    上記のコードをコピー＆ペーストし、`Ctrl+O`で保存、`Ctrl+X`で終了します。

2.  **実行権限の付与**
    ```bash
    chmod +x led_test.py
    ```

3.  **テストの実行**
    ```bash
    sudo python3 led_test.py
    ```

    > **注意**: NeoPixel LEDの制御には、`sudo`（管理者権限）が必要です。

### 期待される動作

テストが正常に実行されると、以下の順序でLEDが点灯します。

1.  **すべて赤色**（3秒間）
2.  **すべて緑色**（3秒間）
3.  **すべて青色**（3秒間）
4.  **虹色のグラデーション**（3秒間）
5.  **消灯**

### トラブルシューティング

| 症状 | 原因 | 対処法 |
| :--- | :--- | :--- |
| LEDが全く点灯しない | 電源が供給されていない | 外部電源が接続され、コンセントに挿さっているか確認 |
| LEDが全く点灯しない | GNDが共通接続されていない | WAGO端子台②に、外部電源GND、LED GND、Raspberry Pi GNDの3本が接続されているか確認 |
| LEDが全く点灯しない | データ線が接続されていない | GPIO18とLEDの緑線が接続されているか確認 |
| 一部のLEDしか点灯しない | LEDテープの途中で断線 | LEDテープを交換するか、点灯する部分のみ使用 |
| 色がおかしい | ピクセルオーダーが間違っている | コード内の`pixel_order=neopixel.GRB`を`neopixel.RGB`に変更して再実行 |
| エラー: `Can't open /dev/mem` | 管理者権限がない | `sudo python3 led_test.py`で実行 |

## 2.4 シーン別照明パターンの実装

Webアプリケーションから受け取ったシーン情報に応じて、LEDの色と明るさを変化させる仕組みを実装します。

### シーン定義

Concordia Shrineでは、以下の4つのシーンが定義されています。

| シーン | 意味 | LED色 | 明るさ | 呼吸パターン |
| :--- | :--- | :--- | :--- | :--- |
| **静寂** (silence) | 誰も話していない | 淡い青 `#4A90E2` | 10% | ゆっくり（4秒周期） |
| **調和** (harmony) | 穏やかな会話 | 翡翠色 `#2ECC71` | 20% | 穏やか（3秒周期） |
| **一方的** (monologue) | 一方的な発言 | 朱色 `#E74C3C` | 40% | 速い（1.5秒周期） |
| **沈黙** (awkward) | 気まずい沈黙 | 深紫 `#9B59B6` | 15% | 不規則 |

### 照明制御コード

以下のコードを `/home/pi/concordia-shrine-pi/led_controller.py` として保存します。

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NeoPixel LED シーン別照明制御
"""

import time
import math
import board
import neopixel
from threading import Thread, Event

# LED設定
LED_COUNT = 60
LED_PIN = board.D18
MAX_BRIGHTNESS = 0.3  # 最大明るさを30%に制限（ピカピカしすぎ防止）

# シーン定義
SCENES = {
    "silence": {
        "color": (74, 144, 226),      # 淡い青 #4A90E2
        "brightness": 0.1,
        "breath_period": 4.0,
        "breath_type": "slow"
    },
    "harmony": {
        "color": (46, 204, 113),      # 翡翠色 #2ECC71
        "brightness": 0.2,
        "breath_period": 3.0,
        "breath_type": "smooth"
    },
    "monologue": {
        "color": (231, 76, 60),       # 朱色 #E74C3C
        "brightness": 0.4,
        "breath_period": 1.5,
        "breath_type": "fast"
    },
    "awkward": {
        "color": (155, 89, 182),      # 深紫 #9B59B6
        "brightness": 0.15,
        "breath_period": 2.5,
        "breath_type": "irregular"
    }
}

class LEDController:
    def __init__(self):
        self.pixels = neopixel.NeoPixel(
            LED_PIN,
            LED_COUNT,
            brightness=MAX_BRIGHTNESS,
            auto_write=False,
            pixel_order=neopixel.GRB
        )
        self.current_scene = "silence"
        self.running = False
        self.stop_event = Event()
        self.thread = None
        
    def start(self):
        """照明制御を開始"""
        if not self.running:
            self.running = True
            self.stop_event.clear()
            self.thread = Thread(target=self._breathing_loop, daemon=True)
            self.thread.start()
            print("LED制御を開始しました")
    
    def stop(self):
        """照明制御を停止"""
        if self.running:
            self.running = False
            self.stop_event.set()
            if self.thread:
                self.thread.join()
            self.pixels.fill((0, 0, 0))
            self.pixels.show()
            print("LED制御を停止しました")
    
    def set_scene(self, scene_name):
        """シーンを変更"""
        if scene_name in SCENES:
            self.current_scene = scene_name
            print(f"シーンを変更: {scene_name}")
        else:
            print(f"警告: 未知のシーン '{scene_name}'")
    
    def _breathing_loop(self):
        """呼吸パターンのメインループ"""
        while self.running:
            scene = SCENES[self.current_scene]
            base_color = scene["color"]
            base_brightness = scene["brightness"]
            period = scene["breath_period"]
            breath_type = scene["breath_type"]
            
            # 1周期分の呼吸パターン
            steps = 60
            for step in range(steps):
                if self.stop_event.is_set():
                    break
                
                # 呼吸パターンの計算
                t = step / steps
                if breath_type == "slow":
                    # ゆっくりとした呼吸
                    intensity = 0.5 + 0.5 * math.sin(2 * math.pi * t - math.pi / 2)
                elif breath_type == "smooth":
                    # 滑らかな呼吸
                    intensity = 0.6 + 0.4 * math.sin(2 * math.pi * t - math.pi / 2)
                elif breath_type == "fast":
                    # 速い呼吸
                    intensity = 0.7 + 0.3 * math.sin(4 * math.pi * t - math.pi / 2)
                elif breath_type == "irregular":
                    # 不規則な呼吸
                    intensity = 0.5 + 0.3 * math.sin(2 * math.pi * t) + 0.2 * math.sin(5 * math.pi * t)
                else:
                    intensity = 1.0
                
                # 明るさを適用
                brightness = base_brightness * intensity
                color = tuple(int(c * brightness) for c in base_color)
                
                # LEDに反映
                self.pixels.fill(color)
                self.pixels.show()
                
                # 待機
                time.sleep(period / steps)

# テスト用メイン関数
if __name__ == "__main__":
    controller = LEDController()
    
    try:
        controller.start()
        
        print("\nシーンのテストを開始します")
        print("各シーンを10秒間表示します\n")
        
        for scene_name in ["silence", "harmony", "monologue", "awkward"]:
            print(f"シーン: {scene_name}")
            controller.set_scene(scene_name)
            time.sleep(10)
        
        print("\nテスト完了")
        
    except KeyboardInterrupt:
        print("\n中断されました")
    finally:
        controller.stop()
```

### 実行方法

```bash
cd /home/pi/concordia-shrine-pi
sudo python3 led_controller.py
```

各シーンが10秒間ずつ表示され、呼吸パターンで明るさが変化することを確認してください。

---

**お疲れ様でした！** これで、Webアプリケーションのシーンに応じて、祠が美しく光るようになりました。

次の「第3章：介入通知の実装」では、音声による通知機能を追加します。
