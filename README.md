# Concordia Shrine 仕様書兼設計書（v0 → v1）

このリポジトリは、Concordia Shrine プロトタイプの仕様・設計をまとめています。以下をそのままコピペして、Manus への指示や README ベースとして利用できます。

---

## 0. コンセプトと世界観（濃いめ）

### 0.1 プロジェクト名とタグライン

**プロジェクト名**: Concordia Shrine  
**タグライン（仮）**:

> 「空気だけを聴き、判断の自由をそっと守る祠」

### 0.2 問題意識（守りたいもの）

* 医療現場、ゼミ、進路相談、交渉、1on1 など「対話の場」では、内容よりも**空気・沈黙・同調圧**が人の判断を縛る。
* 多くのテクノロジーは「言葉の意味」を解析し、AI がアドバイスや提案をする。
* しかしそれは、うまくいけば便利でも、失敗した瞬間に冷めるし、「またAIが口を出してくる」という**新しい圧力**にもなり得る。

Concordia Shrine が守りたいのは、

* **「はい」と言ってしまう 0.5 秒前の、まだ自由な心**
* **気まずさや沈黙のせいで飲み込まれてしまう違和感**
* **場の空気に押し流される前の「本当はこう思っている」の可能性**

であり、「誰が正しいか」「何が合意か」を決めることではない。

### 0.3 セキュリティの観点 — Human Decision Security

従来のセキュリティ：

* データ・ネットワーク・アクセス権限を守る
* 暗号・認証・監査ログで「外部からの攻撃」を防ぐ

Concordia Shrine のセキュリティ：

* **人の判断の自由**を守る
* 説得・圧力・沈黙・同調といった**内在的な脅威**に対する「余白」を提供する
* 会話の内容は一切理解しない・保存しない
* ただ**空気の揺らぎ（テンポ・沈黙・割り込み）だけを聴き、高密度の「圧」の瞬間にそっと介入する**

→ カテゴリとしては

* Human Decision Security
* Consent Integrity
* Psychosocial Security Engineering

のような新しい領域を狙う。

### 0.4 既存デバイスとの差別化（Amazon Echo 等との違い）

* Amazon Echo やスマートスピーカー：
  * 人間の言葉を**意味として理解**する
  * 質問に**答える**
  * クラウドに送って**処理・記録**する
* Concordia Shrine：
  * **意味を理解しない**（STTなし、VADのみ）
  * **質問に答えない**（対話しない）
  * **何も記録しない**（音声もテキストも保存しない）
  * ただし、会話の**テンポ・沈黙・割り込みパターン**から「空気の状態」だけを推定し、
    * 祠の光
    * 奥で鳴る風・水滴・木の軋みの音
      で**儀式的に場に介入する**

### 0.5 フェーズ構成（実装ロードマップ）

本仕様書は、以下の2段階で成立するように書く：

1. **フェーズ0：PCプロトタイプ**
   * ラズパイや物理祠なし
   * ノートPC or デスクトップのマイクで音声を拾い
   * 画面上のビジュアル（波打つアニメーション）と PC スピーカーからの自然音だけで振る舞いを可視化する

2. **フェーズ1：物理祠 + Raspberry Pi + Pico**
   * フェーズ0の**コアロジックはそのまま再利用**
   * 出力先を「画面ビジュアル → LED」「PCスピーカー → 祠内スピーカー」に差し替える
   * 物理筐体（祠）を追加し、会議室等に置ける「小さな祠」として成立させる

以降の仕様はまず **フェーズ0（PC版）** をきちんと動かし、その後 **抽象化レイヤを増やして祠へ移植**しやすい構造を意識している。

---

## 1. フェーズ0：PC プロトタイプ仕様

### 1.1 開発環境・前提

* 言語: Python 3.10+（想定）
* 対象OS: Windows / macOS / Linux のいずれか（とりあえずローカルPC）
* 入力:
  * PC に接続されたマイク（内蔵 or 外付け）
* 出力:
  * 画面上のビジュアル（1ウィンドウ）
  * スピーカーからの自然音（風・水滴・木・鈴など）

UI ライブラリ候補（どれを使うかは実装側に任せられるようにする）：

* シンプル: `pygame` でフルスクリーンまたはウィンドウ上のアニメーション
* もしくは `tkinter` / `PyQt` / `Processing.py` など

本仕様書では、**抽象的な「VisualAdapter」として設計**し、具体ライブラリは実装側に委ねる。

### 1.2 フェーズ0のユースケース

* ユーザは PC の前で会話する（2人でも1人芝居でも良い）
* アプリを起動すると：
  * 画面に**波打つような図形やオーラのようなビジュアル**が表示される
  * マイクで会話の音声を常時取得
  * 内部で VAD により speech / non-speech を判定
  * 「沈黙」「早口での独演」「割り込みっぽいパターン」が検出されると、ビジュアルと自然音が変化する

例：

* しばらく誰も話していないと、画面が柔らかく白く光り、風の音が流れる
* 一方がずっと話し続けると、画面に紫の波紋が2回脈打ち、水滴の音が鳴る
* 早口でかぶせ合うような話し方が続くと、琥珀色の波が一瞬強く走り、木の軋む音が鳴る

これにより、**「Concordia が空気に反応している」**ことを体験できる。

### 1.3 機能要件（フェーズ0）

#### F0-1: 音声入力

* PCのマイク入力から音声をストリーミングする。
* サンプルレート: 16kHz 程度
* フレーム長: 20ms〜30ms（例: 0.02秒で320サンプル@16kHz）

#### F0-2: VAD（音声活動検知）

* VAD ライブラリを用いて、各フレームごとに speech / non-speech を判定する。
  * 任意のライブラリ可（例: Silero VAD, WebRTC VAD の Python ラッパなど）
* 出力は単純な bool (`True`=話している, `False`=沈黙) とする。

#### F0-3: パターン検出（イベント化）

VAD の時系列から、以下のイベントを検出：

1. **SilenceLong**
   * `non-speech` が `silence_long_sec` 以上連続した場合。
2. **MonologueLong**
   * `speech` が `monologue_long_sec` 以上連続した場合。
3. **OverlapBurst**
   * 直近 `overlap_window_sec` の中で `speech/non-speech` の切り替えが `overlap_switch_threshold` 回以上発生した場合。
   * （実際には話者分離はしないが、「雰囲気として落ち着かない／かぶせ合っている」状態とみなす）
4. **StableCalm**
   * 上記 1〜3 が発火しておらず、適度な speech・non-speech の交互が `stable_min_duration_sec` 続いた場合。

#### F0-4: イベント → ビジュアル/サウンドマッピング

各イベントが発火した時、**ビジュアルとサウンド**を変化させる。

* SilenceLong
  * 画面：
    * 背景が白〜淡い青にゆっくりフェードし、「呼吸する」ように明滅する
  * 音：
    * 柔らかい風音（3〜5秒）
* MonologueLong
  * 画面：
    * 中央にある円や波紋が紫色で2回ドクンと脈打つアニメーション
  * 音：
    * 水滴が2回落ちる音（ぽちゃん…ぽちゃん…）
* OverlapBurst
  * 画面：
    * 琥珀色の光またはラインが一瞬強く走る（フラッシュ）
  * 音：
    * 木がギシッと軋むような低い短音
* StableCalm
  * 画面：
    * 落ち着いた青〜緑のグラデーションがゆっくり波打ち続ける
  * 音：
    * 基本的には何も鳴らさない（あるいはごく弱い環境ノイズ）

#### F0-5: クールダウン制御

* 演出が連続しすぎてうるさくならないよう、
  * 前回イベントから `cooldown_sec` 経過するまでは新しい演出を発火させない、
  * あるいは「弱い演出」だけにするなどの制御を行う。

#### F0-6: アプリケーション UI（最低限）

* 1つのウィンドウを開き、そこにビジュアルを表示。
* ウィンドウのタイトル等に「Concordia Shrine Prototype」と表示。
* 終了操作（ESCキー or ×ボタン）に対応。

### 1.4 非機能要件（フェーズ0）

* 音声や VAD の処理は、**人間が会話しているときに気にならないレイテンシ**（数百msレベル）で行う。
* CPU 使用率が高すぎないよう、フレーム処理はリアルタイムを維持できる範囲に留める。
* 音声データや解析結果は**ファイルとして保存しない**。
* ネットワーク通信は行わず、完全ローカルで動く。

### 1.5 ソフトウェア構成（フェーズ0）

#### 推奨ディレクトリ構成

```
concordia_pc/
  ├─ src/
  │   ├─ main.py                # エントリポイント
  │   ├─ audio/
  │   │   ├─ mic_stream.py      # マイク入力管理
  │   │   ├─ vad.py             # VADラッパ
  │   │   └─ event_detector.py  # VAD→イベント検出
  │   ├─ core/
  │   │   ├─ state_manager.py   # クールダウンや現在状態
  │   │   └─ mapping.py         # イベント→演出（抽象）
  │   ├─ output/
  │   │   ├─ visuals.py         # 画面アニメーション（VisualAdapter）
  │   │   └─ sound_player.py    # サウンド再生
  │   ├─ config/
  │   │   └─ config_loader.py   # YAML/JSON設定読み込み
  │   └─ util/
  │       └─ logging.py         # ログ（必要なら）
  ├─ sounds/
  │   ├─ wind_soft.ogg
  │   ├─ drip_single.ogg
  │   ├─ drip_double.ogg
  │   ├─ wood_creak.ogg
  │   └─ bell_low.ogg
  ├─ config.yaml
  └─ README.md
```

### 1.6 コアロジック（フェーズ0）詳細設計

#### 1.6.1 イベント定義

```python
from dataclasses import dataclass
from typing import Optional, Dict

@dataclass
class ConcordiaEvent:
    type: str         # "SilenceLong" / "MonologueLong" / "OverlapBurst" / "StableCalm"
    timestamp: float
    metadata: Dict
```

#### 1.6.2 EventDetector の仕様

入力：

* `is_speech: bool`
* `now: float`（秒）

内部状態として：

* `speech_run_length: float`（連続 speech 秒数）
* `silence_run_length: float`（連続 non-speech 秒数）
* `switch_count_recent: int`（直近 window の切り替え回数）
* `window_buffer: deque[(timestamp, is_speech)]`
* `last_label: Optional[bool]`

パラメータ（config.yaml）：

```yaml
events:
  silence_long_sec: 12.0
  monologue_long_sec: 30.0
  overlap_window_sec: 5.0
  overlap_switch_threshold: 8
  stable_min_duration_sec: 15.0
```

挙動（疑似コードイメージ）：

* speech / non-speech の連続長を更新
* ラベルが変わったら `switch_count_recent`++
* 古いレコードは `overlap_window_sec` を超えたら削除
* 各条件を満たせば `ConcordiaEvent` を `yield` する

#### 1.6.3 VisualAdapter（画面演出）

抽象インターフェイス例：

```python
class VisualAdapter:
    def update_base_state(self, is_speech: bool, now: float) -> None:
        """常時呼ばれる。呼吸アニメーションなどのベース状態更新。"""

    def trigger_effect(self, event: ConcordiaEvent) -> None:
        """イベントに応じて、色・パターン・強度などを変える。"""

    def render(self, surface) -> None:
        """フレームごとに描画処理。pygame.Surfaceなどを想定。"""
```

* `update_base_state` で「今の空気」の継続的な変化（呼吸・波打ち）を反映
* `trigger_effect` で一時的な強い変化（フラッシュ・脈動）
* `render` がウィンドウに対して実際の描画を行う

#### 1.6.4 SoundPlayer（サウンド）

* `play(SoundEffect)` を呼ばれると適切な音を再生。
* クールダウン制御は内部に持つ。

```python
from dataclasses import dataclass

@dataclass
class SoundEffect:
    file: str     # "wind_soft.ogg" など
    volume: float # 0.0 - 1.0
```

---

## 2. コアロジック抽象化（フェーズ0→1共通部分）

フェーズ0で実装したロジックは、そのままフェーズ1（祠デバイス）に持っていきたい。

そのために以下を**インターフェイスとして抽象化**しておく：

### 2.1 EffectOutput 抽象インターフェイス

```python
class EffectOutput:
    def apply_effect(self, event: ConcordiaEvent) -> None:
        """イベントに応じた演出（光・音・ビジュアル）を発火させる"""
```

フェーズ0：

* `EffectOutput` の実装 = 画面ビジュアル＋PCサウンド

フェーズ1：

* `EffectOutput` の実装 = LED（Pico経由）＋祠内スピーカー

`mapping.py` では

```python
def handle_event(event: ConcordiaEvent, output: EffectOutput) -> None:
    output.apply_effect(event)
```

のような形にし、**ロジック層は出力先に依存しない**ようにしておく。

---

## 3. フェーズ1：祠 + Raspberry Pi + Pico への拡張設計

※ここは将来拡張用。今すぐ書くコードの対象はフェーズ0だが、移植を見越しておく。

### 3.1 追加・変更点

* **入力**: PCマイク → USBマイク + Raspberry Pi 4（ロジックは同じ）
* **出力**:
  * 画面ビジュアル → **LED（NeoPixel）** に置換
  * PCスピーカー → **祠内スピーカー** に変更
* **構成**:
  * Raspberry Pi 4：フェーズ0の `concordia_pc` ロジックを実行
  * Raspberry Pi Pico：LEDアニメーション専用
  * Pi4 ⇔ Pico 間の通信：シリアル(UART over USB)

### 3.2 EffectOutput 実装（Shrine版）

フェーズ1では、`EffectOutput` を以下のように実装する：

```python
class ShrineEffectOutput(EffectOutput):
    def __init__(self, pico_client: PicoClient, sound_player: SoundPlayer):
        self.pico_client = pico_client
        self.sound_player = sound_player

    def apply_effect(self, event: ConcordiaEvent) -> None:
        effect = map_event_to_effect(event)  # イベント→ ShrineEffect
        if effect.led:
            self.pico_client.send_led_effect(effect.led)
        if effect.sound:
            self.sound_player.play(effect.sound)
```

### 3.3 LED 側の設計（概要）

* Pico 側は MicroPython で動作
* Pi4 側からの JSON メッセージを受け取り、パターン名と色・時間に応じて LED をアニメーションさせる
* パターン例：
  * `breath`（呼吸）
  * `double_pulse`（二連パルス）
  * `flash_single`（単発フラッシュ）

（詳細は前の回答をベースにすればよいので、ここでは省略）

---

## 4. config.yaml（フェーズ0想定サンプル）

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
  # ビジュアル側で参照しても良い（色やスピードのプリセットなど）
  base_color_calm: "#66ccff"
  base_color_tense: "#ffcc66"

sound:
  base_dir: "sounds"
```

---

## 5. まとめ（Manus向けの意図）

* まずは **フェーズ0（PC版）** として、マイク入力 → VAD → イベント検出 → 画面アニメーション＋自然音の構成を Python で実装する。
* ディレクトリ構成とクラス設計は上記を基本とし、**EffectOutput / VisualAdapter / SoundPlayer / EventDetector** をそれぞれ分けておくことで、後から Raspberry Pi & Pico & 祠 に拡張しやすいようにする。

以上を「設計兼仕様書」として扱い、このままコード生成のベースにしてよい。
