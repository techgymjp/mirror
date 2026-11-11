# Google Play ストア掲載情報

Play Console の「ストアの掲載情報」に貼り付けて使います。既定の言語を日本語にし、「翻訳を管理」から英語（en-US）を追加してください。
英語版は `listing-en.txt` にもまとめています（貼り付け用）。

- パッケージ名: `jp.techgym.mirror`
- カテゴリ: ゲーム ＞ パズル
- タグ（Play Console の候補から最大 5 つ）: 迷路 / カジュアル / オフライン / シングルプレイヤー / 3D など、候補にあるものを選ぶ
- プライバシーポリシー: 日本語 https://techgym.jp/privacy-policy/ ・英語 https://techgym.jp/privacy-policy-en/

## ASO（検索で見つけてもらうため）の方針

- 検索されやすい語を、**アプリ名 → 簡単な説明 → 詳しい説明の冒頭**の順に入れる（この順に検索での重みが大きい）
  - 日本語: 迷路、脱出、鏡、ゲーム、柴犬（犬）、錯覚、3D、カジュアル、パズル、脳トレ、暇つぶし、オフライン、片手
  - 英語: maze, escape, mirror, dog / Shiba Inu, optical illusion, puzzle, brain teaser, casual, offline, one-touch, 3D
- 詳しい説明の最初の 2 行（「もっと見る」を押す前に見える部分）に、何のゲームかと主な語をまとめる
- 同じ語を不自然にくり返さない（キーワードの詰め込みはポリシー違反で、検索順位も下がる）
- 「無料」「No.1」「最高」「人気」など、Google Play のメタデータのポリシーで避けるべき語は使わない
- アプリ名はストアの表示名。ホーム画面の名前（「犬も鏡に」「Mirror Dog」）とは別

## 画像（`docs/store/`、`node tools/store-shots.js` で撮り直せる）

| 画像 | ファイル | サイズ |
| --- | --- | --- |
| アプリのアイコン | `icon-512.png` | 512 × 512 |
| フィーチャーグラフィック | `feature-graphic.png`（日本語）/ `feature-graphic-en.png`（英語） | 1024 × 500 |
| スマートフォンのスクリーンショット | `ja-1-title.png` 〜 `ja-6-clear.png` / `en-1-title.png` 〜 `en-6-clear.png` | 1080 × 1920（縦） |

スクリーンショットの並び（最初の 2〜3 枚がいちばん見られるので、ゲームの面白さが伝わる順にしている）

1. `2-mirrors` 合わせ鏡にずらりと並ぶ自分（このゲームならではの画）
2. `4-bonk` 鏡にゴン！
3. `3-warp` 本物の EXIT とワープの扉、ほね
4. `5-dark` 闇の合わせ鏡（稲妻）
5. `1-title` 10 ステージ
6. `6-clear` 脱出成功 ★★★

---

## 日本語

**アプリ名**（30 文字以内・22 文字）

```
犬も歩けば鏡に当たる - 鏡の迷路脱出ゲーム
```

**簡単な説明**（80 文字以内・52 文字）

```
壁がぜんぶ鏡の3D迷路から柴犬で脱出！錯覚にだまされず、左右フリックだけで出口を探すカジュアル迷路ゲーム
```

**詳しい説明**

```
壁がぜんぶ鏡でできた3Dの迷路から、柴犬になって脱出する迷路ゲームです。
左右にフリックするだけの片手操作。錯覚と方向感覚が試される、すきま時間にぴったりのカジュアルゲームです。

まっすぐ続いて見える道は、本物の通路？ それとも鏡の映りこみ？
合わせ鏡の奥には、どこまでも続く廊下と、ずらりと並ぶ「自分」。向こうから犬が走ってきたら…それはあなた自身です。

■ 遊び方
・柴犬は自動で前へ走りつづけます
・左右にフリックして、次の角で曲がる向きを予約。早めのフリックでも大丈夫
・曲がり忘れて鏡にぶつかると「ゴン！」でゲームオーバー
・本物の出口は一つだけ。ほかの「EXIT」はワープの扉で、迷路のどこかへ飛ばされます
・行き止まりに落ちている「ほね」を持っていれば、1 回だけぶつかってもセーフ
・ワープとゴンが少ないほど ★ が増えます

■ 全10ステージ
・らせん回廊：中心から外へ、ぐるぐる右回り
・つづら折り：右・右・左・左のリズムで駆け抜ける
・鏡の大広間：映りこみが何倍にもなる広い部屋
・闇の合わせ鏡：ほぼ真っ暗。稲妻が光る一瞬だけ先が見える
・鏡の国：画面が左右反転。見た目と逆にフリック
・加速する迷宮：時間がたつほど速くなる
ほかにも、ステージごとに迷路の形と仕掛けが変わります。全部クリアすると、毎回ちがう「きまぐれ迷宮」も遊べます。

■ 特徴
・鏡が何重にも映りこむ、不思議な3D迷路
・3Dで描いた柴犬。鏡の中の自分の姿も、向きに合わせて変わります
・背後からの視点と、犬の目線を切り替え
・ログイン不要、オフラインでも遊べます
・日本語・英語に対応

■ こんな人におすすめ
・迷路ゲームや脱出ゲーム、パズルが好き
・錯覚やだまし絵にだまされるのが好き
・方向感覚に自信がある（または、ない）
・脳トレや暇つぶしに、短い時間で遊べるゲームを探している
・犬、柴犬が好き
```

**リリースノート（初回）**

```
<ja-JP>
はじめてのリリースです。壁がぜんぶ鏡の迷路から、柴犬になって脱出しよう！
</ja-JP>
<en-US>
First release. Escape a maze where every wall is a mirror — as a Shiba Inu!
</en-US>
```

---

## English (en-US)

**App name** (max 30 characters / 28)

```
Mirror Maze Dog: Maze Escape
```

**Short description** (max 80 characters / 75)

```
Escape a 3D mirror maze as a Shiba! A one-touch optical illusion maze game.
```

**Full description**

```
Escape a 3D maze where every wall is a mirror — as a running Shiba Inu.
Just flick left or right. A one-touch maze game that tests your sense of direction and fools your eyes with optical illusions.

Is that a real corridor ahead, or only a reflection?
Facing mirrors show endless hallways and a long row of dogs. If one comes running toward you… that's you.

■ HOW TO PLAY
• Your dog keeps running forward on its own
• Flick left or right to set your next turn. Flicking early is fine
• Miss a turn and BONK into a mirror: game over
• There is only one real exit. Every other EXIT is a warp door that sends you somewhere else
• Grab a bone from a dead end and you survive one bump
• Fewer warps and bumps earn more ★

■ 10 STAGES
• Spiral Corridor: round and round to the right, from the center out
• Switchbacks: right, right, left, left
• Hall of Mirrors: open halls that multiply the reflections
• Mirrors in the Dark: almost pitch black, lit only by lightning
• Mirror World: the screen is flipped, so flick the opposite way
• Speeding Maze: your dog gets faster and faster
Every stage has its own layout and twist. Clear them all to unlock a new random maze every time.

■ FEATURES
• A mind-bending 3D mirror maze full of reflections
• A 3D Shiba Inu whose reflections turn with every move
• Switch between a behind-the-dog view and the dog's own eyes
• No login needed. Plays offline
• English and Japanese

■ GREAT FOR
• Fans of maze games, escape games and puzzles
• Anyone who loves optical illusions and brain teasers
• People who trust their sense of direction (or don't!)
• Quick, casual play in your spare time
• Dog lovers and Shiba Inu fans
```
