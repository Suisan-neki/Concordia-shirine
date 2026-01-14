# 第1章：準備編 - すべての基本

この章では、プロジェクトを開始するための最も重要な準備作業を行います。Raspberry Piのセットアップから、必要なソフトウェアのインストール、そしてWebアプリケーションとの連携の基礎となるサーバーの準備まで、一つ一つ丁寧に進めていきましょう。

## 1.1 Raspberry Pi OSのセットアップ

すべての土台となるOSをインストールします。

### 必要なもの
- Raspberry Pi 4
- MicroSDカード（32GB以上推奨）
- SDカードリーダー
- PC（Windows, Mac, or Linux）

### 手順

1.  **Raspberry Pi Imagerのダウンロード**
    公式サイトから、お使いのPC用の「Raspberry Pi Imager」をダウンロードしてインストールします。
    > [https://www.raspberrypi.com/software/](https://www.raspberrypi.com/software/)

2.  **OSの書き込み**
    1.  SDカードリーダーにMicroSDカードを挿入し、PCに接続します。
    2.  Raspberry Pi Imagerを起動します。
    3.  **「OSを選ぶ」** をクリックし、`Raspberry Pi OS (64-bit)` を選択します。
    4.  **「ストレージを選ぶ」** をクリックし、挿入したMicroSDカードを選択します。
    5.  **「書き込む」** をクリックします。確認画面が表示されたら「はい」をクリックします。
        > **注意**: MicroSDカード内のデータはすべて消去されます。

3.  **SSHとWi-Fiの有効化（ヘッドレスセットアップ）**
    書き込みが完了したら、一度SDカードを抜き差しします。PCに `boot` という名前のドライブが表示されます。

    -   **SSHの有効化**: `boot` ドライブ直下に、`ssh` という名前の空のファイルを作成します（拡張子なし）。
    -   **Wi-Fiの設定**: `boot` ドライブ直下に `wpa_supplicant.conf` という名前のファイルを作成し、以下の内容を記述して保存します。

        ```conf
        country=JP
        ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
        update_config=1

        network={
            ssid="あなたのWi-FiのSSID"
            psk="あなたのWi-Fiのパスワード"
        }
        ```
        `"あなたのWi-FiのSSID"` と `"あなたのWi-Fiのパスワード"` を、ご自身のWi-Fi情報に書き換えてください。

4.  **Raspberry Piの起動**
    MicroSDカードをRaspberry Piに挿入し、USB-C電源を接続して起動します。初回起動には数分かかります。

## 1.2 Raspberry Piへの接続と初期設定

PCからRaspberry Piに接続し、基本的な設定を行います。

### 手順

1.  **IPアドレスの確認**
    ルーターの管理画面などにアクセスし、`raspberrypi` というホスト名で接続されているデバイスのIPアドレスを確認します。

2.  **SSH接続**
    PCのターミナル（WindowsならPowerShellやTera Term）から、以下のコマンドで接続します。

    ```bash
    ssh pi@<Raspberry PiのIPアドレス>
    ```
    初回接続時には確認メッセージが表示されるので `yes` と入力します。パスワードを求められたら、初期パスワード `raspberry` を入力します。

3.  **初期設定**
    `raspi-config` ツールを使って、以下の設定を行います。

    ```bash
    sudo raspi-config
    ```

    -   **パスワードの変更**: `1 System Options` -> `S3 Password` で、初期パスワードを変更します。
    -   **ロケールの設定**: `5 Localisation Options` -> `L1 Locale` で `ja_JP.UTF-8 UTF-8` を選択します。
    -   **タイムゾーンの設定**: `5 Localisation Options` -> `L2 Timezone` で `Asia` -> `Tokyo` を選択します。
    -   **インターフェースの有効化**: `3 Interface Options` で以下の項目を有効（Enable）にします。
        -   `I2C`
        -   `SPI`
        -   `Serial Port`

    設定が完了したら、`Finish` を選択して再起動します。

## 1.3 必要なソフトウェアのインストール

プロジェクトに必要なライブラリをインストールします。

### 手順

1.  **パッケージリストの更新とアップグレード**
    SSHで再接続後、以下のコマンドを実行してシステムを最新の状態にします。

    ```bash
    sudo apt update
    sudo apt upgrade -y
    ```

2.  **Pythonライブラリのインストール**
    LED、Webサーバー、音声再生に必要なライブラリをインストールします。

    ```bash
    sudo pip3 install rpi_ws281x adafruit-circuitpython-neopixel flask flask-cors pygame
    ```

    | ライブラリ | 用途 |
    | :--- | :--- |
    | `rpi_ws281x` | NeoPixel LEDを直接制御するための低レベルライブラリ |
    | `adafruit-circuitpython-neopixel` | `rpi_ws281x`を簡単に扱うための高レベルライブラリ |
    | `flask` | Webアプリケーションからの指示を受け取るためのWebサーバー |
    | `flask-cors` | 異なるドメインからのアクセスを許可する（CORS対応） |
    | `pygame` | 介入通知の音声を再生するため |

## 1.4 プロジェクト用ディレクトリの作成

コードを整理するために、プロジェクト用のディレクトリを作成します。

```bash
cd /home/pi
mkdir concordia-shrine-pi
cd concordia-shrine-pi
```

これ以降の作業は、すべてこの `concordia-shrine-pi` ディレクトリ内で行います。

---

**お疲れ様でした！** これで、物理的な「祠」を構築するためのすべての準備が整いました。

次の「第2章：LED照明の実装」では、いよいよ最初のハードウェアであるNeoPixel LEDを接続し、光を灯します。
