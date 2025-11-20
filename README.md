# Concordia Shrine — 仕様書兼設計書 (v0 → v1)

Concordia Shrine は、対話の「空気」だけを聴き、判断の自由をそっと守るための祠プロダクト。ここでは PC 版プロトタイプ (フェーズ0) から祠デバイス (フェーズ1) までの仕様をまとめています。Manus への指示や README のベースとしてこのまま利用できます。

## 目次

1. [ドキュメントの使い方 / TL;DR](#1-ドキュメントの使い方--tldr)  
2. [コンセプトと世界観](#2-コンセプトと世界観)  
3. [ロードマップ (フェーズ構成)](#3-ロードマップ-フェーズ構成)  
4. [フェーズ0：PC プロトタイプ仕様](#4-フェーズ0pc-プロトタイプ仕様)  
5. [ソフトウェア構成 (フェーズ0)](#5-ソフトウェア構成-フェーズ0)  
6. [コアロジック詳細 (フェーズ0)](#6-コアロジック詳細-フェーズ0)  
7. [抽象化 (フェーズ0→1 共通)](#7-抽象化-フェーズ01-共通)  
8. [フェーズ1：祠 + Raspberry Pi + Pico](#8-フェーズ1祠--raspberry-pi--pico)  
9. [config.yaml サンプル](#9-configyaml-サンプル)  
10. [Manus への意図](#10-manus-への意図)

---

## 1. ドキュメントの使い方 / TL;DR

- 目的: PC 上で動くフェーズ0をまず完成させ、そのロジックをそのまま祠デバイスへ拡張できる形を示す。  
- ポリシー: 会話内容は理解しない・保存しない。VAD で空気の揺らぎだけを聴き、儀式的な光・音で介入する。  
- 守るもの: 「はい」と言ってしまう 0.5 秒前の自由な心、気まずさで飲み込まれる違和感、場に流される前の本心。  
- 使い方: 設計をそのままコピペしてチーム指示に使う。ライブラリ選定や実装詳細は任意だが、インターフェイス分離を崩さない。

---

## 2. コンセプトと世界観

### 2.1 プロジェクト名とタグライン

**プロジェクト名**: Concordia Shrine  
**タグライン（仮）**: 「空気だけを聴き、判断の自由をそっと守る祠」

### 2.2 問題意識（守りたいもの）

- 医療現場、ゼミ、進路相談、交渉、1on1 などの「対話の場」では、内容よりも **空気・沈黙・同調圧** が判断を縛る。  
- 多くのテクノロジーは「言葉の意味」を解析し助言するが、失敗すると冷め、新しい圧力にもなり得る。  
- 守りたいもの:  
  - **「はい」と言ってしまう 0.5 秒前の、まだ自由な心**  
  - **気まずさや沈黙のせいで飲み込まれてしまう違和感**  
  - **場の空気に押し流される前の「本当はこう思っている」の可能性**

### 2.3 セキュリティの観点 — Human Decision Security

- 従来: データ/ネットワーク/権限を暗号・認証・監査で守る。  
- Concordia: **人の判断の自由**を守る。説得・圧力・沈黙・同調といった内在的脅威へ「余白」を提供。内容を理解/保存せず、**テンポ・沈黙・割り込み**だけを聴き、圧が高まる瞬間に介入。  
- 狙う領域: Human Decision Security / Consent Integrity / Psychosocial Security Engineering。

### 2.4 既存デバイスとの差別化

- スマートスピーカー: 言葉の意味を理解し、回答し、クラウドで処理・記録。  
- Concordia Shrine: **意味を理解しない** (STTなし、VADのみ)、**答えない**、**記録しない**。テンポや沈黙から空気を推定し、光と自然音で儀式的に介入。

---

## 3. ロードマップ (フェーズ構成)

1. **フェーズ0：PCプロトタイプ**  
   - PC マイク入力 → VAD → イベント検出 → 画面ビジュアル + 自然音。  
2. **フェーズ1：祠 + Raspberry Pi + Pico**  
   - コアロジックはそのまま。出力先を LED / 祠内スピーカーに差し替え、物理祠として成立させる。  

まず PC 版を完成させ、抽象レイヤを活かして祠へ移植する。

---

## 4. フェーズ0：PC プロトタイプ仕様

### 4.1 開発環境・前提

- 言語: Python 3.10+（想定）  
- OS: Windows / macOS / Linux  
- 入力: PC マイク (内蔵/外付け)  
- 出力: 画面ビジュアル 1 ウィンドウ / 自然音 (風・水滴・木・鈴など)  
- UI ライブラリ例: `pygame`（推奨シンプル）、`tkinter` / `PyQt` / `Processing.py` も可。  
- 設計: 「VisualAdapter」などの抽象で束ね、ライブラリ依存を避ける。

### 4.2 ユースケース

- ユーザが PC 前で会話（2人/1人芝居どちらも可）。  
- 起動すると、波打つビジュアルが表示され、マイクを常時取得。VAD で speech/non-speech 判定。  
- 「沈黙」「長い独演」「割り込みっぽい切替多発」を検出すると、ビジュアルと自然音が変化。  
- 例:  
  - 長い沈黙 → 柔らかい白〜青の呼吸光 + 風音  
  - 一方が話し続ける → 紫の脈動 + 水滴音  
  - かぶせ合い/切替多 → 琥珀のフラッシュ + 木の軋み

### 4.3 機能要件

- **F0-1: 音声入力**  
  - マイクを 16kHz 程度でストリーミング。フレーム長 20–30ms (例: 0.02s で 320 サンプル@16kHz)  
- **F0-2: VAD**  
  - ライブラリ任意 (例: Silero VAD, WebRTC VAD ラッパ)。  
  - 出力は bool (`True`=speech, `False`=silence)。  
- **F0-3: パターン検出 (イベント化)**  
  - SilenceLong: non-speech が `silence_long_sec` 以上連続。  
  - MonologueLong: speech が `monologue_long_sec` 以上連続。  
  - OverlapBurst: 直近 `overlap_window_sec` に切替が `overlap_switch_threshold` 回以上。  
  - StableCalm: 上記が発火せず、適度な交互が `stable_min_duration_sec` 続く。  
- **F0-4: イベント→演出**  
  - SilenceLong → 白〜淡青の呼吸フェード + 柔らかい風音(3–5s)  
  - MonologueLong → 紫の二連脈動 + 水滴2回  
  - OverlapBurst → 琥珀のフラッシュ/ライン + 木の軋み  
  - StableCalm → 青〜緑グラデーションの静かな波。音は基本なし。  
- **F0-5: クールダウン**  
  - 前回イベントから `cooldown_sec` 未満は新規演出を抑制または弱化。  
- **F0-6: アプリ UI**  
  - 1 ウィンドウに描画。タイトル「Concordia Shrine Prototype」。ESC or × で終了。

### 4.4 非機能要件

- レイテンシ: 会話体験を阻害しない数百 ms 程度。  
- パフォーマンス: リアルタイム維持、CPU 負荷は控えめ。  
- プライバシ: 音声/解析結果を保存しない。  
- ネットワーク: 行わない。完全ローカル。

---

## 5. ソフトウェア構成 (フェーズ0)

推奨ディレクトリ:

```
concordia_pc/
  ├─ src/
  │   ├─ main.py                # エントリポイント
  │   ├─ audio/
  │   │   ├─ mic_stream.py      # マイク入力管理
  │   │   ├─ vad.py             # VADラッパ
  │   │   └─ event_detector.py  # VAD→イベント検出
  │   ├─ core/
  │   │   ├─ state_manager.py   # クールダウンや状態管理
  │   │   └─ mapping.py         # イベント→演出（抽象）
  │   ├─ output/
  │   │   ├─ visuals.py         # 画面アニメーション（VisualAdapter）
  │   │   └─ sound_player.py    # サウンド再生
  │   ├─ config/
  │   │   └─ config_loader.py   # YAML/JSON設定読み込み
  │   └─ util/
  │       └─ logging.py         # 任意のロギング
  ├─ sounds/
  │   ├─ wind_soft.ogg
  │   ├─ drip_single.ogg
  │   ├─ drip_double.ogg
  │   ├─ wood_creak.ogg
  │   └─ bell_low.ogg
  ├─ config.yaml
  └─ README.md
```

---

## 6. コアロジック詳細 (フェーズ0)

### 6.1 イベント定義

```python
from dataclasses import dataclass
from typing import Dict

@dataclass
class ConcordiaEvent:
    type: str         # "SilenceLong" | "MonologueLong" | "OverlapBurst" | "StableCalm"
    timestamp: float
    metadata: Dict
```

### 6.2 EventDetector

入力: `is_speech: bool`, `now: float` (秒)。  
内部状態:

- `speech_run_length`: 連続 speech 秒数  
- `silence_run_length`: 連続 non-speech 秒数  
- `switch_count_recent`: 直近 window の切り替え回数  
- `window_buffer`: `deque[(timestamp, is_speech)]`  
- `last_label: Optional[bool]`

設定例 (`config.yaml`):

```yaml
events:
  silence_long_sec: 12.0
  monologue_long_sec: 30.0
  overlap_window_sec: 5.0
  overlap_switch_threshold: 8
  stable_min_duration_sec: 15.0
```

挙動イメージ:

- speech/non-speech 連続長を更新。ラベル変化で `switch_count_recent`++。  
- `overlap_window_sec` を超えた古いサンプルは削除。  
- 条件成立で `ConcordiaEvent` を `yield`。

### 6.3 VisualAdapter（抽象）

```python
class VisualAdapter:
    def update_base_state(self, is_speech: bool, now: float) -> None:
        """常時呼ばれる。呼吸や波打ちなどベース状態を更新。"""

    def trigger_effect(self, event: ConcordiaEvent) -> None:
        """イベントに応じて色・パターン・強度を変える。"""

    def render(self, surface) -> None:
        """フレームごとに描画。pygame.Surface などを想定。"""
```

- `update_base_state`: 現在の空気をなめらかに反映。  
- `trigger_effect`: 瞬間的な強い変化（フラッシュ/脈動）。  
- `render`: 実際の描画。

### 6.4 SoundPlayer

```python
from dataclasses import dataclass

@dataclass
class SoundEffect:
    file: str     # "wind_soft.ogg" など
    volume: float # 0.0 - 1.0
```

- `play(SoundEffect)` で音再生。  
- クールダウンは内部に保持。

---

## 7. 抽象化 (フェーズ0→1 共通)

フェーズ0のロジックをそのままフェーズ1へ持っていくためのインターフェイス。

```python
class EffectOutput:
    def apply_effect(self, event: ConcordiaEvent) -> None:
        """イベントに応じた演出（光・音・ビジュアル）を発火。"""
```

- フェーズ0: EffectOutput = 画面ビジュアル + PC サウンド  
- フェーズ1: EffectOutput = LED (Pico 経由) + 祠内スピーカー  

`mapping.py` 例:

```python
def handle_event(event: ConcordiaEvent, output: EffectOutput) -> None:
    output.apply_effect(event)
```

ロジック層は出力先に依存しない。

---

## 8. フェーズ1：祠 + Raspberry Pi + Pico

※ 将来拡張用。フェーズ0のロジックをそのまま流用。

- 入力: PCマイク → USBマイク + Raspberry Pi 4（処理ロジックは同じ）。  
- 出力: 画面ビジュアル → **LED (NeoPixel)**、PCスピーカー → **祠内スピーカー**。  
- 構成:  
  - Raspberry Pi 4: フェーズ0ロジックを実行。  
  - Raspberry Pi Pico: LED アニメーション専用。  
  - 通信: Pi4 ⇔ Pico を UART over USB (JSON メッセージ)。  
- ShrineEffectOutput 例:

```python
class ShrineEffectOutput(EffectOutput):
    def __init__(self, pico_client: PicoClient, sound_player: SoundPlayer):
        self.pico_client = pico_client
        self.sound_player = sound_player

    def apply_effect(self, event: ConcordiaEvent) -> None:
        effect = map_event_to_effect(event)  # イベント→ShrineEffect
        if effect.led:
            self.pico_client.send_led_effect(effect.led)
        if effect.sound:
            self.sound_player.play(effect.sound)
```

- Pico 側 (MicroPython) はパターン名 + 色/時間を受け取り、`breath` / `double_pulse` / `flash_single` などを再生。

---

## 9. config.yaml サンプル

```yaml
audio:
  device_index: null      # OSのデフォルトマイク
  sample_rate: 16000
  frame_duration_sec: 0.02

vad:
  model_path: "models/silero_vad.onnx"   # 例
  threshold: 0.5

events:
  silence_long_sec: 12.0
  monologue_long_sec: 30.0
  overlap_window_sec: 5.0
  overlap_switch_threshold: 8
  stable_min_duration_sec: 15.0

effects:
  cooldown_sec: 10.0

visuals:
  base_color_calm: "#66ccff"
  base_color_tense: "#ffcc66"

sound:
  base_dir: "sounds"
```

---

## 10. Manus への意図

- まず **フェーズ0 (PC版)** を、マイク入力 → VAD → イベント検出 → ビジュアル + 自然音の構成で実装する。  
- ディレクトリとインターフェイス (EffectOutput / VisualAdapter / SoundPlayer / EventDetector) を守り、後から Raspberry Pi & Pico & 祠へそのまま差し替えできるようにする。  
- この README を仕様/設計のソースとし、必要に応じてコピペして指示に使う。  

以上。

---

## ブラウザ版の簡易プロトタイプ (web/)

リンク共有で動かしたい場合は、`web/` 以下の静的ファイルを配布してください。マイクアクセスは `https` か `localhost` でのみ許可されます。

### ローカルで試す
```bash
cd web
python -m http.server 8000
# あるいは: python -m http.server 8000 -d web   (リポジトリルートで実行する場合)
```
ブラウザで `http://localhost:8000/` を開き、「マイクを許可して開始」を押して話しかけると波が揺れます（音はなし）。

### リンク共有 (GitHub Pages など)
1. このリポジトリを GitHub にプッシュ。  
2. Settings → Pages で `Branch: main` / `Folder: /web` を選ぶ。  
3. 公開URLが発行されたら、そのリンクを共有。マイク許可のポップアップが出るので許可して使ってもらう。

メモ:
- ブラウザ版は簡易エネルギーVADで「喋っている/沈黙」だけを判定し、Canvasで波を描画します。  
- `https` もしくは `localhost` でないとマイク許可が出ない点に注意。

---

## Docker（Linux向け簡易手順）

Linux X11 + ALSA 前提。macOS/Windows の Docker Desktop はマイク・ウィンドウのパススルーが実質困難なので**非推奨**（その場合はネイティブ実行を推奨）。

### 簡易スクリプト（Linux）
```bash
./run_docker.sh
```
内部で `xhost +local:docker` → `docker build` → `docker run --device /dev/snd ...` を行います。

### 手動でやる場合（Linux）
```bash
docker build -t concordia-shrine .
xhost +local:docker
docker run --rm -it \
  --env DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  --device /dev/snd \
  concordia-shrine
```

メモ:
- 音はデフォルト無効（`config.yaml` の `sound.enabled: false`）なので録音だけ通れば十分。  
- PulseAudio/ALSA の設定でマイクが拾えない場合は、ホスト側の入力デバイスを確認してください。  
- macOS/Windows で Docker を使う場合は、GUI とマイクのパススルーのために XQuartz + PulseAudio ブリッジ等の大掛かりなセットアップが必要になります（推奨しません）。
