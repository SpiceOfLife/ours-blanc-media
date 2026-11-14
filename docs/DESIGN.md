# ours blanc Gear — 詳細設計書

AI がリサーチ → 構成 → 執筆 → アイキャッチ生成 → 品質審査 → 公開 → 日次の成果測定と改善（PDCA）までを自動で回す、DTM・音楽機材のアフィリエイトメディア。

| 項目 | 決定内容 |
|---|---|
| URL | `https://gear.ours-blanc.app`（ours-blanc.app のサブドメイン） |
| ジャンル | DTM・音楽機材（8カテゴリ） |
| CMS / 配信 | Astro 静的サイト → GitHub (`SpiceOfLife/ours-blanc-media`) → Cloudflare Pages |
| 公開方式 | 品質ゲート（ルール審査 + AI 編集長審査）合格記事のみ自動公開。不合格は `drafts/` に理由付きで保存 |
| 収益源 | Google AdSense（自動広告）、楽天アフィリエイト（楽天ウェブサービス API）、Amazon アソシエイト（タグ付き検索リンク → Creators API） |
| デザイン | `ours-blanc-design`（Apple HIG ベースの共通デザインシステム）の `ob-design.css` を使用 |
| 日次運用 | GitHub Actions（05:17 JST）+ Claude の定期タスク（07:40 JST に成果報告） |

---

## 1. 全体アーキテクチャ

```
            ┌──────────── GitHub Actions: daily.yml (05:17 JST) ─────────────┐
            │                                                                 │
 Check ───▶ │ metrics.mjs  GSC / Cloudflare Web Analytics / AdSense / 手入力CSV │
 Act   ───▶ │ pdca.mjs     Claude が分析 → strategy.json / topics.json を更新   │
 Plan  ───▶ │ plan.mjs     スコア順にトピック選定（カテゴリ分散）+ リライト枠      │
 Do    ───▶ │ research.mjs Claude + Web検索 → 楽天APIで価格・画像・リンク付与     │
            │ write.mjs    Claude が本文・FAQ・製品評価を執筆                    │
            │ eyecatch.mjs SVG→PNG で OG/アイキャッチ生成                        │
            │ qa.mjs       ルール審査 + リンク死活 + AI編集長スコア → 合否        │
            │              不合格 → 指摘を反映して1回だけ書き直し → 再審査        │
            │ report.mjs   reports/daily/YYYY-MM-DD.md を出力                   │
            │ git push ──▶ Cloudflare Pages が自動ビルド・公開                    │
            └─────────────────────────────────────────────────────────────────┘
                                        │
            Claude 定期タスク (07:40 JST) ─┴─▶ レポートを読み、要点と ToDo を Yu さんに通知
```

ディレクトリ:

| パス | 内容 |
|---|---|
| `config/site.json` | サイト情報・運営者プロフィール・パイプライン上限値（記事数、予算、合格点） |
| `config/categories.json` | 8カテゴリ（色・アイコン） |
| `config/topics.json` | トピック待ち行列（PDCA が追加・優先度調整） |
| `config/strategy.json` | 記事数/日、カテゴリ・検索意図の重み、リライト候補、改善履歴 |
| `config/experience.json` | Yu さんの所有機材と感想メモ（一次体験として書いてよい範囲） |
| `pipeline/` | 自動化スクリプト一式（Node 22、依存は `@anthropic-ai/sdk` と `sharp` のみ） |
| `src/` | Astro サイト（レイアウト、コンポーネント、ページ、記事 Markdown） |
| `public/eyecatch/` | 生成されたアイキャッチ |
| `.data/`（非公開リポジトリ `ours-blanc-media-data`） | `reports/daily/` 日次レポート・`drafts/` 不合格記事・`manual/` 成果CSV・`strategy-history.json` 改善履歴。コード側を公開しても収益データは非公開 |

## 2. コンテンツ生成パイプライン

### 2.1 Plan — トピック選定
スコア = `priority × カテゴリ重み × 検索意図重み ÷ (1 + 0.15 × そのカテゴリの既存記事数)`。
上位から**カテゴリが重複しないように** N 本（既定 2 本、1〜3 本の範囲で PDCA が調整）。別枠でリライト 1 本。

### 2.2 Research
- Claude（`claude-sonnet-5-5`、環境変数で変更可）+ サーバー側 Web 検索（最大 8 回）で、メーカー公式・スペック表・大手販売店を調査。
- 出力: 想定読者、検索意図の分解、選び方の基準（出典付き）、比較製品 3〜6 点（スペック・長所短所）、FAQ、独自の切り口、出典一覧。
- **楽天 Ichiba Item Search API（2026 年版 `openapi.rakuten.co.jp`、applicationId + accessKey + Referer 必須）**で製品ごとに価格・画像・レビュー平均/件数・アフィリエイト URL を付与。製品名トークンの一致率 60% 以上の出品のみ採用（アクセサリ等の誤マッチ防止）。
- Amazon: PA-API 5 は 2026 年に廃止され Creators API に移行。Creators API は売上実績が必要なため、当面はアソシエイトタグ付きの検索結果リンク。

### 2.3 Write
- 文体・構成ルール（結論先出し、H2 4〜7 個、表は 1 つまで、価格の具体額は本文に書かない＝カード側で取得日付き表示）。
- **事実はリサーチ結果のみ使用**、`experience.json` に無い製品の一次体験は書かない。
- 既存記事タイトルを渡して重複を避け、内部リンク候補にする。

### 2.4 Eyecatch
テキスト + カテゴリアイコンから 1200×630 の PNG を生成（日本語の禁則・バランス改行対応）。他社の製品写真は使わないため画像の権利リスクがない。記事の OG 画像を兼ねる。

### 2.5 QA（品質ゲート）
| 種別 | チェック | 結果 |
|---|---|---|
| ルール | 本文 3,500 字以上 / H2 3 個以上 / description 60 字以上 | 不足でブロック |
| ルール | PR フラグ（ステマ規制） | 無ければブロック |
| ルール | 出典 3 件以上・URL 形式・死活確認 | 不足・リンク切れ多数でブロック |
| ルール | 最上級・断定表現（最強/絶対/No.1 など＝景表法の優良誤認リスク） | ブロック |
| ルール | 一次体験表現（使ってみた等）が所有機材メモ外 | ブロック |
| ルール | 既存記事との類似度（文字 3-gram Jaccard ≥ 0.55）/ 同一キーワード | ブロック（新規ではなくリライトで対応） |
| AI 審査 | 有用性・正確性・独自性・読みやすさ・コンプライアンス 各 20 点 | 80 点未満 or `blocking` でブロック |

不合格時は指摘を渡して 1 回だけ書き直し → 再審査。それでも不合格なら `drafts/` に保存し、トピックは `rejected`（理由付き）。

### 2.6 コストと上限
- 1 日の API 予算 `dailyBudgetUSD`（既定 $3）。85% に達したら残りは翌日へ繰り越し、書き直しは 70% 未満のときのみ。
- 目安: 1 記事 = 調査 1 回 + 執筆 1〜2 回 + 審査 1〜2 回 ≈ $0.4〜1.0。2 本/日で月 $25〜60 程度。

## 3. 日次 PDCA

| フェーズ | 内容 | 実装 |
|---|---|---|
| Check | 前日の PV・訪問（Cloudflare Web Analytics）、検索表示/クリック/CTR/順位・クエリ（Search Console）、AdSense 収益/RPM、アフィリエイト成果（CSV） | `metrics.mjs` |
| Act | Claude が数値を所見化 → 記事数/日、カテゴリ重み（±0.3/日まで）、新規トピック（3 件/日まで）、リライト候補を提案。決定的ルールも併用: 掲載順位 8〜20 位で表示 30 回以上 → リライト、表示 100 回以上で CTR 1% 未満 → タイトル改善。同じ記事は 14 日以内に再リライトしない | `pdca.mjs` |
| Plan | 更新後の戦略でその日の記事を選定 | `plan.mjs` |
| Do | 生成・審査・公開 | `run-daily.mjs` |
| Report | `reports/daily/YYYY-MM-DD.md`（サマリー表、Check、Act、Plan、Do、記事別トップ5、運営者 ToDo、費用） | `report.mjs` |

変更はすべて `config/*.json` の git 差分として残るので、いつ何を変えて結果がどうなったかを後から検証できる。

### KPI と目標（立ち上げ期）
| 期間 | 目標 |
|---|---|
| 〜1 か月 | 品質ゲート合格記事 30 本、Search Console インデックス 80% 以上、AdSense 申請 |
| 〜3 か月 | 検索表示 1,000 回/日、クリック 30/日、アフィリエイト初成約、Amazon 3 件販売 → Creators API 有効化 |
| 〜6 か月 | PV 500/日、月間収益 ¥10,000、主要 KW 20 個で 10 位以内 |

## 4. デザイン（Apple HIG Patterns の適用）

共通デザインシステム `ours-blanc-design/web/ob-design.css`（セマンティックカラー、ライト/ダーク自動、SF/ヒラギノ系フォント、Dynamic Type 相当のテキストスタイル、44pt ヒット領域）をそのまま使用し、サイト固有の層を `src/styles/gear.css` に追加。

| HIG パターン / 原則 | 適用箇所 |
|---|---|
| ナビゲーション（Split View / Tab Bar） | 幅 1024px 以上はサイドバー（iPad/Mac の Split View）、未満は下部タブバー（ホーム・カテゴリ・検索・設定の 4 タブ） |
| Large Title | ルート画面は Large Title、記事は Title 1 |
| Inset grouped list | カテゴリ一覧、運営者情報、検索結果、サイドバー |
| Searching | 検索フィールド + スコープ（カテゴリのセグメント）+ 候補キーワード + 一致箇所ハイライト + 件数の読み上げ（aria-live） |
| Charting data | 製品の価格比較バーチャート。1 チャート 1 メッセージ、単位と取得日を明記、スクリーンリーダー用の要約 |
| Ratings and reviews | 編集部スコアとユーザーレビュー（出典・件数付き）を分けて表示。偽のレビュー構造化データは出さない |
| Offering help | 目次、FAQ（展開式）、PR の説明 |
| Modality / Settings | 表示設定はシート（「完了」で閉じる・Esc/背景タップでも閉じる）。外観：自動/ライト/ダーク |
| Loading | 静的配信で待ち時間をほぼゼロに。画像の縦横比と広告枠の高さを予約してレイアウトシフトを防止 |
| Feedback | タップ時の縮小アニメーション、空状態（記事なし・検索 0 件）に次の行動を提示 |
| Accessibility | スキップリンク、ランドマーク、`prefers-reduced-motion`、コントラスト、44px ターゲット |

## 5. SEO・収益化・法令対応

- 構造化データ: WebSite + SearchAction、Article、BreadcrumbList、FAQPage、Person（運営者）。
- sitemap、robots、canonical、OG/Twitter カード、検索ページは noindex。
- **E-E-A-T**: 運営者ページに実名・経歴・所有機材・編集方針・連絡先を掲載。記事末に著者カードと AI 活用の明示。
- **Google のスパムポリシー（大量生成コンテンツの不正使用）対策**: 1 日最大 3 本、類似記事の禁止、出典必須、独自の切り口の要求、AI 編集長審査、既存記事のリライト優先。
- **ステマ規制（景品表示法、2023 年 10 月施行）**: 全記事冒頭に PR 表記、広告・PR 表記ページ。
- **Amazon アソシエイト**: 「Amazon のアソシエイトとして…」の定型文をフッターに常時表示。
- **楽天ウェブサービス**: API データを使った記事に「Supported by Rakuten Developers」クレジット。リクエストは 1 秒 1 回以下。
- **AdSense**: プライバシーポリシー（Cookie・広告設定の案内）、`ads.txt`（サブドメインのため**ルート ours-blanc.app にも設置が必要**）、自動広告 + 予約枠。EEA/英国向けには AdSense の「プライバシーとメッセージ」で Google 認定 CMP を有効化。
- 価格は「取得日時点・税込目安」と明記し、`rel="sponsored"` を付与。

## 6. セキュリティ・運用

- 秘密情報はすべて GitHub Actions Secrets（リポジトリはプライベート）。サイトに出る値は `PUBLIC_*` のみ（Cloudflare Pages の環境変数）。
- `DRY_RUN=1` で API を呼ばずに全工程を検証（記事は `_dry-` 付き下書きとして生成され、git には入らない）。
- `npm test` で QA ルール・改行・JSON 抽出などの単体テスト 12 件。
- 失敗時: トピックは `queued` に戻り、エラー内容はレポートに記載。

## 7. 今後の拡張

1. Amazon Creators API 連携（3 件販売後）で価格・画像を Amazon からも取得
2. Cloudflare Pages Functions の `/go/<id>` リダイレクトでアフィリエイトリンクのクリックを計測
3. 「この記事は役に立ちましたか？」フィードバック（HIG Feedback）
4. Yu さんの実機レビュー記事（実演動画・音源埋め込み）と、自作アプリ（ours-blanc.app）への導線
5. 英語版（`/en/`）— 海外向け DTM 需要と Amazon.com アソシエイト
