# 犬も歩けば鏡に当たる

壁がぜんぶ鏡になっている迷路から、犬になって脱出するカジュアル Web ゲーム。
錯覚と方向感覚が勝負です。

## 遊び方

- あなたは犬（一人称視点）。迷路の中を **自動で前へ走りつづけます**。
- 操作は **左右だけ**。**フリック ← →** で曲がる予約をして、その向きに曲がれる角で曲がる（PC: `←` `→`）
- 行き止まりでは、角に着く前に同じ向きへ2回フリックすると後ろを向ける
- PC: `M` 地図 / `Esc` 一時停止
- 壁はすべて鏡。道が続いて見えても映りこみかもしれません。曲がり損ねて鏡に当たると「ゴン！」で**即ゲームオーバー**
- 🦴 ほねを持っていれば、鏡に当たっても1回だけセーフ（ほねを1本消費）。
- 鏡には自分の姿も映ります。
- **本物の出口は一つだけ**。ほかの「EXIT」はワープゾーン。行き止まりの突き当たりは必ずワープで、迷路のどこかへ飛ばされます。
- ワープとセーフになったゴンの回数が少ないほど ★ が増えます。全5ステージ＋クリア後の「きまぐれ迷宮」。

犬の見た目を変えたいときは `tools/render_dog.py` を編集して `python3 tools/render_dog.py` を実行してください。

## ステージ

| # | 名前 | コースと仕掛け |
| --- | --- | --- |
| 1 | はじめての鏡 | 小さな迷路で操作に慣れる |
| 2 | まっすぐ廊下 | 長い直線の先に急カーブ |
| 3 | らせん回廊 | 手作りコース。中心から外へ右回りのらせん、わき道はワープ |
| 4 | つづら折り | 手作りコース。右右・左左のリズム、近道あり |
| 5 | 鏡の大広間 | 迷路の中に広間。映りこみが倍増し、どこでも曲がれる |
| 6 | 闇の合わせ鏡 | ほぼ真っ暗。ときどきの稲妻で遠くが見える |
| 7 | 横長回廊 | くねくね曲がる細長い迷路 |
| 8 | 鏡の国 | 画面が左右反転 |
| 9 | 加速する迷宮 | 時間とともに犬が速くなる |
| 10 | 鏡の大迷宮 | 広間＋加速＋コンパスなしの集大成 |

全ステージクリアで、毎回ちがう「きまぐれ迷宮」が遊べます。
画面右上の 🐕 / 👁 ボタンで、背後視点（自分の背中と、合わせ鏡にずらりと並ぶ自分が見える）と犬目線を切り替えられます。

## Android アプリ

[Capacitor](https://capacitorjs.com/) でゲームのファイルをアプリに同梱し、Android アプリにしています（オフラインで遊べます）。
構成は techgymjp/jet-fighter の `docs/ANDROID_PORTING.md`、techgymjp/jackal と同じです。

- パッケージ名: `jp.techgym.mirror`
- 縦画面（`sensorPortrait`）・全画面・プレイ中は画面を消さない
- 戻るボタン: プレイ中は一時停止（ポーズ中なら再開）、あそびかたではタイトルへ、タイトル・結果画面ではアプリを終了
- 別アプリに切り替えると自動で一時停止して音を止める
- シェアは Android の共有メニュー（クリア・ゲームオーバーの結果画面）
- 広告（AdMob）
  - バナー: タイトル・あそびかた・ポーズ・結果画面の下中央（プレイ中は出さない）
  - 全画面広告（インタースティシャル）: ステージを始める、タイトルへ戻る（あそびかた・ポーズ・結果画面から）、ポーズからの再開、結果画面の「もう一度」「次のステージへ」のたびに毎回
  - リワード広告（チート）: 鏡にぶつかってゲームオーバーになったら「広告を見て、つづきから」（1 ステージ 3 回まで。ぶつかった様子を見届けられるよう 2.2 秒後に出し、6 秒で自動的に結果画面へ）。
    見終わると、ぶつかった場所で止まった状態から再開。使ったことは結果画面とシェア文に「やり直し N 回」と出る
  - EU など同意が必要な地域ではタイトル画面に「広告の設定」
  - 本番の広告ユニット ID は `js/ads.js`（空の種類は本番ビルドで出さない）、AdMob のアプリ ID は `android/app/src/main/res/values/strings.xml`
- タイトル画面にバージョン（ビルド番号）とプライバシーポリシーへのリンク
- 日本語・英語に対応（端末の言語で自動選択、タイトル画面で切り替え。文言は `js/i18n.js`）
- アイコンと起動画面: `python3 tools/render_icon.py` で `appicon/` に元画像を作り、`npx @capacitor/assets generate --android --assetPath appicon` で生成

ビルドは GitHub Actions（`.github/workflows/android.yml`）で行います。

1. `npm ci` → `npm run build:app`（`www/` に Web ファイルをコピーし、Web 版だけの部分（撮影・テスト用の `window.__game`、PC のキー操作の説明）を取り除き、`ads-config.js` と `build-info.js` を生成）→ `npx cap sync android` → `./gradlew assembleDebug`
2. 既定ブランチなら、Release `android-latest` の `mirror.apk` を差し替え（動作確認用・テスト広告）
   - リリース画面: `https://github.com/techgymjp/mirror/releases/tag/android-latest`（QR コード: `docs/apk-qr.png`）
   - APK 直接: `https://github.com/techgymjp/mirror/releases/latest/download/mirror.apk`
3. GitHub Secrets（`ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD`）があれば、本番広告で署名付き AAB を作り、Artifact `mirror-release-aab` に上げる（Google Play 用）

<img src="docs/apk-qr.png" width="180" alt="Android 版（動作確認用）のリリース画面の QR コード">

ストアの掲載文（ASO を意識した日英）と画像: `docs/store/listing.md`（画像は `node tools/store-shots.js` で撮り直せる）

## ライセンス

著作権はテックジム株式会社に帰属します（All rights reserved）。許可なく複製・改変・再配布すること、Web サイトやアプリ（Google Play など）として公開・販売すること、名前・アイコン・画像を使うことを禁止します。
テックジムの受講生が学習目的で複製・改変することは許可しますが、アプリストアでの公開・広告の掲載・販売などの商用利用は禁止です。詳しくは `LICENSE` を見てください。

## 起動

Web 版のタイトル画面には、Google Play の Android アプリ版へのリンクがあります（アプリ版のビルドでは取り除く）。Web 版はビルド不要。`index.html` をブラウザで開くだけで遊べます（ローカルファイルでも動きます）。GitHub Pages でもそのまま公開しています。

```bash
python3 -m http.server 8000
```

## 構成

| ファイル | 内容 |
| --- | --- |
| `js/maze.js` | シード付き迷路生成（出口・ワープ扉・ほねの配置） |
| `js/renderer.js` | 鏡を反射するレイキャスター。反射を「折り返した空間を直進する」変換で扱い、鏡の奥の自分・扉・ほねも描画 |
| `js/sprites.js` | 柴犬・ほねのスプライトシートの読み込み、扉テクスチャの生成 |
| `assets/bone.png` | くるくる回るほね（12コマ）。`tools/render_bone.py` で生成 |
| `assets/dog.png` | 柴犬スプライト（16方向 × 立ち＋速歩き4コマ）。`tools/render_dog.py` で生成 |
| `tools/simulate.js` | 腕前（上級・中級・初級）ごとの仮想プレイヤーで全ステージを走らせ、クリア率などのばらつきを確かめるシミュレーター。`node tools/simulate.js 2000 [--causes] [--now] [--bones=1] [--speed=0.85] [--tuned]` |
| `tools/render_dog.py` | 柴犬の3Dモデル（SDF）をレイマーチングで描画してスプライトシートを書き出すスクリプト（numpy, Pillow） |
| `js/audio.js` | WebAudio の効果音と、サイバー空間風の自動生成 BGM（タイトル／プレイで変化） |
| `js/game.js` | 自動走行・フリック入力・ステージ進行・HUD・セーブ（localStorage） |

ステージ設定は `js/game.js` の `STAGES`（手作りコースは `COURSES`）で調整できます（迷路サイズ、ループ数、広間の数、直線・くねくねの癖、加速・暗闇・左右反転の仕掛け、鏡の色味の強さ `tint`、走る速さ `speed`、コンパス有無、ワープ扉の見分けやすさ `warpHint`）。
