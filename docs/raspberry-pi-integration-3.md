# 第3章：介入通知の実装 - 祠からの静かな警告

この章では、Webアプリケーションが「一方的」または「沈黙」のシーンを検出したときに、祠から穏やかな通知音を鳴らす仕組みを実装します。スピーカーの接続から、音声ファイルの準備、そして再生制御まで、一つ一つ丁寧に進めていきましょう。

## 3.1 スピーカーの接続

FUNLOGY Speakerを、Raspberry Pi 4に接続します。

### 必要な部品

| 部品名 | 数量 | 備考 |
| :--- | :--- | :--- |
| FUNLOGY Speaker | 1個 | USB給電、3.5mmオーディオ入力 |
| 3.5mmオーディオケーブル | 1本 | スピーカーに付属 |
| USB Type-Aケーブル | 1本 | スピーカーに付属 |

### 接続手順

1.  **USB給電の接続**
    スピーカーのUSBケーブルを、Raspberry Pi 4のUSBポート（Type-A）に接続します。これでスピーカーに電源が供給されます。

2.  **オーディオケーブルの接続**
    3.5mmオーディオケーブルの一端をスピーカーの「AUX IN」端子に、もう一端をRaspberry Pi 4の3.5mmオーディオジャック（イヤホンジャック）に接続します。

3.  **スピーカーの電源ON**
    スピーカー本体の電源ボタンを押して、電源をONにします。LEDインジケーターが点灯することを確認してください。

### 音声出力の設定

Raspberry Piのデフォルト音声出力を、3.5mmオーディオジャックに設定します。

```bash
sudo raspi-config
```

`1 System Options` -> `S2 Audio` -> `1 Headphones` を選択し、`Finish` で終了します。

または、コマンドラインから以下のコマンドで設定できます。

```bash
amixer cset numid=3 1
```

> `numid=3 1` は、3.5mmジャックを音声出力に設定するコマンドです。

## 3.2 音声ファイルの準備

介入通知に使用する音声ファイルを準備します。

### 音声ファイルの要件

- **フォーマット**: WAV形式（MP3も可能だが、WAVが推奨）
- **サンプリングレート**: 44.1kHz
- **ビット深度**: 16bit
- **チャンネル**: モノラルまたはステレオ
- **長さ**: 1-3秒程度（短く穏やかな音）

### 推奨される音声

「祠」の雰囲気に合う、神聖で穏やかな音を選びます。

- **鈴の音**（りんの音）
- **木魚の音**
- **風鈴の音**
- **シンギングボウルの音**

### 音声ファイルのダウンロード

以下のコマンドで、サンプル音声ファイルをダウンロードします。

```bash
cd /home/pi/concordia-shrine-pi
mkdir sounds
cd sounds

# フリー音源サイトから鈴の音をダウンロード（例）
wget https://freesound.org/data/previews/411/411089_5121236-lq.mp3 -O bell.mp3

# MP3をWAVに変換（ffmpegが必要）
sudo apt install -y ffmpeg
ffmpeg -i bell.mp3 -ar 44100 -ac 2 bell.wav
```

> **注意**: 上記のURLは例です。実際には、著作権フリーの音源サイト（Freesound.org、効果音ラボなど）から、適切な音声ファイルをダウンロードしてください。

### 自分で音声ファイルを用意する場合

PCで音声ファイルを用意し、SCPやUSBメモリでRaspberry Piに転送します。

**SCPでの転送例**（PCから実行）:
```bash
scp /path/to/your/bell.wav pi@<Raspberry PiのIPアドレス>:/home/pi/concordia-shrine-pi/sounds/
```

## 3.3 音声再生のテスト

pygameを使って、音声ファイルが正しく再生されるかテストします。

### テストコード

以下のコードを `/home/pi/concordia-shrine-pi/audio_test.py` として保存します。

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
音声再生テストプログラム
"""

import pygame
import time
import os

# 音声ファイルのパス
SOUND_FILE = "/home/pi/concordia-shrine-pi/sounds/bell.wav"

def test_audio():
    """音声再生のテスト"""
    # ファイルの存在確認
    if not os.path.exists(SOUND_FILE):
        print(f"エラー: 音声ファイルが見つかりません: {SOUND_FILE}")
        return
    
    # pygameの初期化
    pygame.mixer.init(frequency=44100, size=-16, channels=2, buffer=512)
    
    # 音声ファイルの読み込み
    try:
        sound = pygame.mixer.Sound(SOUND_FILE)
        print(f"音声ファイルを読み込みました: {SOUND_FILE}")
        print(f"音声の長さ: {sound.get_length():.2f}秒")
    except Exception as e:
        print(f"エラー: 音声ファイルの読み込みに失敗しました: {e}")
        return
    
    # 音量設定（0.0-1.0）
    sound.set_volume(0.5)
    
    # 再生テスト
    print("\n音声を3回再生します...")
    for i in range(3):
        print(f"{i+1}回目の再生")
        sound.play()
        time.sleep(sound.get_length() + 1)  # 音声の長さ + 1秒待機
    
    print("\nテスト完了")
    pygame.mixer.quit()

if __name__ == "__main__":
    try:
        test_audio()
    except KeyboardInterrupt:
        print("\n中断されました")
        pygame.mixer.quit()
```

### 実行方法

```bash
cd /home/pi/concordia-shrine-pi
python3 audio_test.py
```

スピーカーから音声が3回再生されることを確認してください。

### トラブルシューティング

| 症状 | 原因 | 対処法 |
| :--- | :--- | :--- |
| 音が出ない | 音声出力が3.5mmジャックに設定されていない | `amixer cset numid=3 1` を実行 |
| 音が出ない | スピーカーの電源が入っていない | スピーカーの電源ボタンを確認 |
| 音が出ない | スピーカーの音量が0 | スピーカーの音量ダイヤルを調整 |
| 音が出ない | オーディオケーブルが接続されていない | 3.5mmジャックとスピーカーの接続を確認 |
| 音声ファイルが見つからない | パスが間違っている | `ls /home/pi/concordia-shrine-pi/sounds/` でファイルの存在を確認 |
| 音が小さい | 音量設定が低い | コード内の`sound.set_volume(0.5)`を`0.8`などに変更 |

## 3.4 介入通知システムの実装

「一方的」または「沈黙」のシーンが検出されたときに、自動的に音声を再生する仕組みを実装します。

### 介入通知の仕様

- **トリガー条件**: シーンが「monologue」または「awkward」に変化したとき
- **通知音**: 穏やかな鈴の音を1回再生
- **クールダウン**: 通知後30秒間は、再度通知しない（連続通知を防ぐ）

### 介入通知コード

以下のコードを `/home/pi/concordia-shrine-pi/notification_system.py` として保存します。

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
介入通知システム
"""

import pygame
import time
import os
from threading import Thread, Lock

class NotificationSystem:
    def __init__(self, sound_file, cooldown_seconds=30):
        """
        介入通知システムの初期化
        
        Args:
            sound_file (str): 通知音のファイルパス
            cooldown_seconds (int): クールダウン時間（秒）
        """
        self.sound_file = sound_file
        self.cooldown_seconds = cooldown_seconds
        self.last_notification_time = 0
        self.lock = Lock()
        
        # ファイルの存在確認
        if not os.path.exists(self.sound_file):
            raise FileNotFoundError(f"音声ファイルが見つかりません: {self.sound_file}")
        
        # pygameの初期化
        pygame.mixer.init(frequency=44100, size=-16, channels=2, buffer=512)
        
        # 音声ファイルの読み込み
        self.sound = pygame.mixer.Sound(self.sound_file)
        self.sound.set_volume(0.6)  # 音量60%
        
        print(f"通知システムを初期化しました: {self.sound_file}")
    
    def notify(self, scene_name):
        """
        シーンに応じて通知を発行
        
        Args:
            scene_name (str): シーン名（"monologue" または "awkward"）
        """
        # 介入が必要なシーンかチェック
        if scene_name not in ["monologue", "awkward"]:
            return
        
        with self.lock:
            current_time = time.time()
            
            # クールダウン中かチェック
            if current_time - self.last_notification_time < self.cooldown_seconds:
                remaining = self.cooldown_seconds - (current_time - self.last_notification_time)
                print(f"通知はクールダウン中です（残り{remaining:.1f}秒）")
                return
            
            # 通知音を再生
            print(f"介入通知を発行: {scene_name}")
            self.sound.play()
            self.last_notification_time = current_time
    
    def cleanup(self):
        """リソースのクリーンアップ"""
        pygame.mixer.quit()
        print("通知システムを終了しました")

# テスト用メイン関数
if __name__ == "__main__":
    SOUND_FILE = "/home/pi/concordia-shrine-pi/sounds/bell.wav"
    
    try:
        notifier = NotificationSystem(SOUND_FILE, cooldown_seconds=5)
        
        print("\n介入通知のテストを開始します")
        print("5秒のクールダウンで、3回通知を試みます\n")
        
        # テスト1: monologue（通知される）
        print("テスト1: monologue")
        notifier.notify("monologue")
        time.sleep(2)
        
        # テスト2: monologue（クールダウン中なので通知されない）
        print("\nテスト2: monologue（クールダウン中）")
        notifier.notify("monologue")
        time.sleep(4)
        
        # テスト3: awkward（クールダウン終了後なので通知される）
        print("\nテスト3: awkward（クールダウン終了）")
        notifier.notify("awkward")
        time.sleep(2)
        
        # テスト4: harmony（介入不要なので通知されない）
        print("\nテスト4: harmony（介入不要）")
        notifier.notify("harmony")
        
        print("\nテスト完了")
        
    except FileNotFoundError as e:
        print(f"エラー: {e}")
    except KeyboardInterrupt:
        print("\n中断されました")
    finally:
        notifier.cleanup()
```

### 実行方法

```bash
cd /home/pi/concordia-shrine-pi
python3 notification_system.py
```

以下の動作を確認してください。

1.  **テスト1**: 「monologue」で通知音が鳴る
2.  **テスト2**: クールダウン中なので通知音が鳴らない
3.  **テスト3**: クールダウン終了後、「awkward」で通知音が鳴る
4.  **テスト4**: 「harmony」は介入不要なので通知音が鳴らない

## 3.5 LED照明と介入通知の統合

第2章で作成したLED照明制御と、この章で作成した介入通知システムを統合します。

### 統合コード

以下のコードを `/home/pi/concordia-shrine-pi/shrine_controller.py` として保存します。

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
祠コントローラー（LED照明 + 介入通知）
"""

import time
from led_controller import LEDController
from notification_system import NotificationSystem

class ShrineController:
    def __init__(self, sound_file):
        """
        祠コントローラーの初期化
        
        Args:
            sound_file (str): 通知音のファイルパス
        """
        self.led = LEDController()
        self.notifier = NotificationSystem(sound_file, cooldown_seconds=30)
        self.current_scene = "silence"
        
        print("祠コントローラーを初期化しました")
    
    def start(self):
        """祠の制御を開始"""
        self.led.start()
        print("祠の制御を開始しました")
    
    def stop(self):
        """祠の制御を停止"""
        self.led.stop()
        self.notifier.cleanup()
        print("祠の制御を停止しました")
    
    def set_scene(self, scene_name):
        """
        シーンを変更
        
        Args:
            scene_name (str): シーン名
        """
        if scene_name != self.current_scene:
            print(f"シーン変更: {self.current_scene} -> {scene_name}")
            
            # LED照明を変更
            self.led.set_scene(scene_name)
            
            # 介入通知を発行
            self.notifier.notify(scene_name)
            
            self.current_scene = scene_name

# テスト用メイン関数
if __name__ == "__main__":
    SOUND_FILE = "/home/pi/concordia-shrine-pi/sounds/bell.wav"
    
    try:
        shrine = ShrineController(SOUND_FILE)
        shrine.start()
        
        print("\n祠コントローラーのテストを開始します")
        print("各シーンを15秒間表示します\n")
        
        # シーンの遷移をテスト
        test_scenes = [
            "silence",
            "harmony",
            "monologue",  # 介入通知が鳴る
            "harmony",
            "awkward",    # 介入通知が鳴る（クールダウン中なら鳴らない）
            "silence"
        ]
        
        for scene in test_scenes:
            print(f"\n=== シーン: {scene} ===")
            shrine.set_scene(scene)
            time.sleep(15)
        
        print("\nテスト完了")
        
    except FileNotFoundError as e:
        print(f"エラー: {e}")
    except KeyboardInterrupt:
        print("\n中断されました")
    finally:
        shrine.stop()
```

### 実行方法

```bash
cd /home/pi/concordia-shrine-pi
sudo python3 shrine_controller.py
```

> **注意**: LED制御には`sudo`が必要です。

以下の動作を確認してください。

1.  各シーンでLEDの色と呼吸パターンが変化する
2.  「monologue」と「awkward」のシーンで通知音が鳴る
3.  クールダウン時間（30秒）内は、連続して通知音が鳴らない

---

**お疲れ様でした！** これで、祠が光と音で会議の「空気」を表現し、必要に応じて穏やかに介入するようになりました。

次の「第4章：Webアプリケーションとの連携」では、Concordia Shrine Webアプリケーションからの指示を受け取り、リアルタイムで祠を制御する仕組みを構築します。