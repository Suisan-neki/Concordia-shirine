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

- **目的**: PC上で動くWeb版を完成させ、リアルタイムで「空気」を可視化し、その場での介入により場を改善する。副次的に議事録も自動生成される。
- **コンセプト**: 「空気を聴く祠」の実装として、Notion AI Meeting相当の高度な音声・映像分析機能を組み込み、より精度の高い「空気」検出と波の生成を行う。
- **主目的**: リアルタイム介入による場の改善。波による「空気」の可視化により、参加者がその場で気づいて行動を変える。
- **副次的な価値**: 自動的に議事録が生成されることで、医療現場や教育現場での課題解決に貢献。
- **守るもの**: 「はい」と言ってしまう 0.5 秒前の自由な心、気まずさで飲み込まれる違和感、場に流される前の本心。

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
- Concordia: **人の判断の自由**を守る。説得・圧力・沈黙・同調といった内在的脅威へ「余白」を提供。
- **情報学的実用性**: Notion AI Meeting相当の音声・映像分析と文字起こし機能を組み込み、より精度の高い「空気」検出を実現。内容を理解し記録することで実用的な議事録も生成される。
- **リアルタイム介入**: 場がピリピリした時、一人が責められている時、リアルタイムで「空気」を明示することで改善を促す。波の動きにより参加者がその場で気づいて行動を変える。
- **議事録の価値**: 自動的に生成される議事録により、医療現場や教育現場での課題解決に貢献。患者さんが自分のために記録を保持することも可能。
- 狙う領域: Human Decision Security / Consent Integrity / Psychosocial Security Engineering。

### 2.4 Cyber Security meets Human Security
**「サイバーセキュリティ（堅牢な聖域）」があるからこそ、「ヒューマンセキュリティ（心の解放）」が生まれる。**

- **The Sanctuary (聖域)**:
    - 認証 (Cognito) や通信暗号化 (TLS) は、単なる技術仕様ではなく、**「外部からのノイズを遮断し、聖域を守る結界」**として機能する。
    - 参加者は「ここは守られた場である」と認識することで、初めて心理的安全性（Psychological Safety）を獲得し、本心を解放できる。
- **Guardian AI (守護者)**:
    - AIは「場」を乱すもの（攻撃的な発言や、不審なネットワークアクセス）を「穢れ」として検知・浄化する役割を担う。

### 2.4 既存デバイスとの差別化

- スマートスピーカー: 言葉の意味を理解し、回答し、クラウドで処理・記録。  
- 既存の議事録ツール: 後から見返すためだけの記録。「その場でどんなアプローチを取るか」には意味を成さない。
- Concordia Shrine: 
  - **リアルタイム介入**: 波による「空気」の可視化で、その場で参加者が気づいて行動を変える。議事録は後から見返すための補助的な記録。
  - **高精度な分析**: Notion AI Meeting相当の音声・映像分析と文字起こし機能を組み込み、より精度の高い「空気」検出を実現。
  - **実用的な記録**: 自動的に議事録が生成され、医療現場や教育現場での課題解決に貢献。

---

## 3. ロードマップ (フェーズ構成)

### Web版（現在の実装フェーズ）

1. **フェーズ1: 基本機能（実装済み）**  
   - ✅ 音声入力（Web Audio API）
   - ✅ イベント検出（SilenceLong、MonologueLong、OverlapBurst、StableCalm）
   - ✅ ビジュアル演出（波の生成、イベントに基づく視覚効果）
   - ✅ 音声再生機能（Web Audio API）

2. **フェーズ2: 文字起こし機能（実装予定）**  
   - Web Speech APIによるリアルタイム文字起こし
   - 文字起こしデータからイベント検出の精度向上
   - 波の生成に文字起こしデータを活用

3. **フェーズ3: 映像統合（実装予定）**  
   - カメラ映像の取得（getUserMedia）
   - 発話者識別（顔検出 + リップシンク推定）
   - 複数話者の検出
   - マルチモーダルVAD統合（音声+映像）

4. **フェーズ4: 議事録生成（実装予定）**  
   - 「空気」イベントと文字起こしの統合データ構造
   - 議事録の自動保存（IndexedDB）
   - 議事録の要約・構造化
   - エクスポート機能

5. **フェーズ5: 将来的な拡張**  
   - Notion API連携（Notion AI Meetingとの統合が可能になった場合）
   - ローカルのWhisperモデルによるオフライン文字起こし
   - その他の高度な機能

### 祠デバイス版（将来のフェーズ）

- **フェーズ1：祠 + Raspberry Pi + Pico**  
  - Web版のコアロジックをそのまま流用
  - 出力先を LED / 祠内スピーカーに差し替え、物理祠として成立させる

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

## Web版プロトタイプ (web/) - メイン実装

Web版は現在のメイン実装です。ブラウザ上で動作し、リアルタイムで「空気」を可視化し、議事録も自動生成します。

### 実装済み機能

- ✅ **イベント検出システム**: Python版と同等のロジックをJavaScriptで実装
  - `SilenceLong`: 長い沈黙の検出（デフォルト12秒以上）
  - `MonologueLong`: 一方的な発話の検出（デフォルト30秒以上）
  - `OverlapBurst`: かぶせ合いの検出（5秒間に8回以上の切替）
  - `StableCalm`: 調和の検出（適度な交互が15秒続く）
- ✅ **クールダウン機能**: 前回イベントから10秒以内は新規演出を抑制
- ✅ **ビジュアル演出**: 各イベントタイプに対応する視覚効果
  - SilenceLong → 白〜淡青の呼吸フェード
  - MonologueLong → 紫の二連脈動
  - OverlapBurst → 琥珀のフラッシュ/ライン
  - StableCalm → 青〜緑グラデーションの静かな波
- ✅ **音声再生機能**: Web Audio APIを使用した自然音の再生
- ✅ **設定値管理**: `config.yaml`相当の設定をJavaScriptオブジェクトで管理

### 実装予定機能

- 🔄 **文字起こし機能**: Web Speech APIによるリアルタイム文字起こし
- 🔄 **映像統合**: カメラ映像の取得と発話者識別
- 🔄 **議事録生成**: 文字起こしとイベント情報の統合保存

### ローカルで試す

```bash
cd web
python -m http.server 8000
# あるいは: python -m http.server 8000 -d web   (リポジトリルートで実行する場合)
```
ブラウザで `http://localhost:8000/` を開き、「マイクを許可して開始」を押して話しかけると波が揺れ、イベントが検出されると視覚・聴覚効果が発動します。

### リンク共有 (GitHub Pages など)

1. このリポジトリを GitHub にプッシュ。  
2. Settings → Pages で `Branch: main` / `Folder: /web` を選ぶ。  
3. 公開URLが発行されたら、そのリンクを共有。マイク許可のポップアップが出るので許可して使ってもらう。

### 技術スタック

- **音声取得**: Web Audio API (`getUserMedia`, `AudioContext`, `AnalyserNode`)
- **イベント検出**: JavaScript実装（Python版のEventDetectorと同等ロジック）
- **ビジュアル**: HTML5 Canvas API
- **音声再生**: Web Audio API (`AudioBuffer`, `AudioBufferSourceNode`)
- **文字起こし（予定）**: Web Speech API（ブラウザ標準、無料）
- **映像分析（予定）**: MediaPipe / TensorFlow.js（顔検出、リップシンク推定）
- **データ保存（予定）**: IndexedDB（議事録の保存）

### 注意事項

- `https` もしくは `localhost` でないとマイク許可が出ません
- カメラアクセスも同様に `https` または `localhost` が必要です（実装予定）
- 音声ファイル（`sounds/`ディレクトリ）は後で追加可能です（ファイルがなくても動作します）

---

## デモ用説明文

### プロジェクト概要

**Concordia Shrine（コンコルディア・シュライン）** は、会話の「空気」だけを聴き、判断の自由を守るためのプロトタイプです。

医療現場、ゼミ、進路相談、交渉、1on1などの対話の場では、会話の内容よりも**空気・沈黙・同調圧**が判断を縛ることがあります。このプロジェクトは、会話の内容を理解せず、**テンポ・沈黙・話し方のパターン**だけを分析し、場の雰囲気を可視化します。

### 特徴

- **リアルタイム介入**: 波による「空気」の可視化で、その場で参加者が気づいて行動を変える。議事録は後から見返すための補助的な記録。
- **高精度な分析**: Notion AI Meeting相当の音声・映像分析と文字起こし機能を組み込み（実装予定）、より精度の高い「空気」検出を実現。
- **実用的な記録**: 自動的に議事録が生成され、医療現場や教育現場での課題解決に貢献。
- **直感的な可視化**: 会話の状態を「波」の動きとしてリアルタイムに表現。イベント検出時には視覚・聴覚効果で注意を引く。

### 使い方

1. **マイクモード**: 「マイクを許可して開始」ボタンを押し、マイクへのアクセスを許可します。実際の会話に応じて波が動きます。
2. **デモモード**: 「デモモード」ボタンを押すと、4つのシーン（静寂・調和・一方的・沈黙）を手動で切り替えて確認できます。

### 4つのシーン

- **静寂**: 声と静けさが、ゆっくり行き来しています。中間的な波の大きさ。
- **調和**: 声の出入りが頻繁で、波が穏やかになっています。小さく穏やかな波。
- **一方的**: ひとつの方向からの声が、長く続いています。波が荒れています。大きく激しい波。
- **沈黙**: 静かな時間が、長めに続いています。波が荒れています。大きく重い波。

### 技術的な仕組み

#### 音声の解析（現在の実装）
- マイクから取得した音声の**RMS（音声の強さ）**を計算（Web Audio API）
- 過去15秒間の平均エネルギーから「波の大きさ」を算出
- 音声/無音の切り替え回数や連続時間から、イベントを検出
- **イベント検出ロジック**: Python版のEventDetectorと同等のロジックをJavaScriptで実装
  - 連続発話/沈黙の長さを追跡
  - 一定時間内の切替回数をカウント
  - 条件が満たされるとイベントを発火

#### 文字起こし（実装予定）
- **Web Speech API**: ブラウザ標準API、完全無料
- リアルタイムで文字起こしを実行
- 文字起こしデータからイベント検出の精度を向上
- 将来的にOpenAI Whisper APIへの切り替えも可能（設定で切り替え）

#### 映像分析（実装予定）
- **MediaPipe / TensorFlow.js**: 顔検出とリップシンク推定
- 発話者識別: 誰が話しているかを検出
- 複数話者の検出: 2人以上の会話パターン分析
- マルチモーダルVAD: 音声+映像を統合して精度向上

#### イベント検出と波の生成
- **4つのイベントタイプ**:
  - `SilenceLong`: 長い沈黙 → 白〜淡青の呼吸フェード + 風音
  - `MonologueLong`: 一方的な発話 → 紫の二連脈動 + 水滴音
  - `OverlapBurst`: かぶせ合い → 琥珀のフラッシュ/ライン + 木の軋み
  - `StableCalm`: 調和 → 青〜緑グラデーションの静かな波（音なし）
- イベント発生時は波の動きを大きく・色を強くして注意を引く
- クールダウン機能で過剰なトリガーを防止

#### 波の生成と描画
- 複数のsin波を重ね合わせて波の形状を生成
- メイン波・サブ波・ノイズを組み合わせて自然な動きを表現
- シーン（イベント）に応じて振幅・速度・周波数を調整
  - **調和（StableCalm）**: 小さく穏やか（振幅0.7倍、速度0.5倍）
  - **一方的（MonologueLong）**: 大きく速く（振幅1.8倍、速度2.2倍）
  - **沈黙（SilenceLong）**: 大きく重く（振幅1.5倍、速度1.2倍）
- HTML5 Canvas APIで波の輪郭を描画
- グラデーションで色付け（イベントに応じて色も変化）
- 波頭に白い線を追加して立体感を表現
- 約60fpsでリアルタイムに再描画

### よくある質問

**Q: リアルタイム介入とは？**  
A: 議事録は「後から見返す」ためだけのものではなく、その場で「空気」を可視化することで参加者が気づいて行動を変えることを目指しています。波の動きが「空気」を明示し、場がピリピリした時や一人が責められている時にリアルタイムで改善を促します。

**Q: 議事録は自動生成されるの？**  
A: はい（実装予定）。文字起こしとイベント情報を統合して、自動的に議事録が生成・保存されます。医療現場や教育現場での課題解決に貢献し、患者さんが自分のために記録を保持することも可能です。

**Q: 会話の内容は理解するの？**  
A: 文字起こし機能（実装予定）により会話内容を記録しますが、これは議事録生成のためです。「空気」の検出は主に音声の強さと時間パターン、映像分析により行われます。

**Q: データは保存されるの？**  
A: 議事録はIndexedDBに保存されます（実装予定）。ユーザーが自由に削除・エクスポートできます。音声データは必要に応じて保存されますが、常にユーザーの管理下にあります。

**Q: 文字起こしは何を使うの？**  
A: まずはWeb Speech API（ブラウザ標準、無料）を使用します。将来的にOpenAI Whisper APIへの切り替えも可能です（設定で切り替え）。

**Q: 映像分析はするの？**  
A: はい（実装予定）。発話者識別とリップシンク推定により、音声のみでは難しい発話検出の精度を向上させます。すべてブラウザ内で処理され、外部に送信されません。

**Q: Notion AI Meetingと連携するの？**  
A: 将来的にNotion AI MeetingのAPIが公開されれば連携を検討します。現在はNotion AI Meeting相当の機能をConcordia Shrine内に実装する方針です。

**Q: どんな技術を使っているの？**  
A: Web Audio API（音声取得・再生）、Web Speech API（文字起こし、予定）、Canvas API（描画）、MediaPipe/TensorFlow.js（映像分析、予定）、IndexedDB（データ保存、予定）など、標準的なWeb技術を使用しています。

### デモ時のポイント

1. **プライバシーを強調**: 「会話の内容は理解していない」「データは保存しない」ことを明確に伝える
2. **コンセプトを説明**: 「空気だけを聴く」というコンセプトを説明し、従来の音声認識技術との違いを示す
3. **視覚的な説明**: デモモードで各シーンの違いを見せながら、波の動きが会話の状態を反映していることを示す
4. **技術的な興味への対応**: 技術的な質問には簡潔に答え、必要に応じて詳細を説明する

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

---

## 今後の拡張可能性

### 音声分析の高度化（内容理解なし）
- **発話者識別・話者数推定**: 音声特徴（フォルマント、ピッチ）で話者を区別し、「一方的」判定の精度向上
- **音声パラメータ分析**: エネルギーの変動パターン、話速、同時発話の検出
- **音声の方向性**: マイクアレイで話者の位置推定（フェーズ1で有効）

### イベント検出の拡張
- **新しいイベントタイプ**: InterruptionDetected（割り込み検出）、HesitationPattern（ためらいパターン）、PressureBuild（圧力の蓄積）、Recovery（回復パターン）
- **時系列パターン認識**: 過去のパターンから「空気の悪化」を予測、コンテキストに応じた閾値調整

### 出力・演出の拡張
- **ビジュアル**: 3D表現（WebGL）、AR/VR対応、複数画面連携
- **音響**: 空間音響（3Dオーディオ）、プロシージャルな自然音生成
- **物理デバイス**: LED制御の高度化、触覚フィードバック、香りデバイス連携

### マルチモーダル分析
- **映像分析**: 表情・姿勢・視線の分析（プライバシー配慮必須）
- **環境センサー**: 温度・湿度・照度による場の雰囲気補助
- **生体情報**: ウェアラブルからの心拍・ストレス指標（オプトイン）

### パーソナライゼーション・適応
- **ユーザー設定**: イベント検出の感度調整、演出カスタマイズ
- **場のタイプ別設定**: 会議・1on1・医療現場などに応じた介入パターン
- **学習モード**: ユーザーの反応から最適な介入タイミングを学習

### プライバシー・セキュリティ強化
- **エッジAI**: オフラインで動作する軽量モデル
- **監査・透明性**: イベントのみを記録（音声データなし）、検出内容の説明表示

### 分散・協調
- **マルチデバイス連携**: 複数祠の連携、スマホを補助センサーとして使用
- **クラウド連携（オプション）**: 匿名化された統計データの共有、モデル更新

### ブラウザ版の拡張
- **Web Audio API**: より高度な音声分析
- **WebAssembly**: 高性能なVADモデルの実行
- **PWA対応**: オフライン動作、アプリとしてインストール可能
