# ours blanc Gear 立ち上げ手順書

所要時間の目安：合計 2〜3 時間（審査待ちを除く）。**①〜④で記事の自動生成・公開が始まります**。⑤以降は収益化・計測で、揃った順に日次レポートへ自動で反映されます。

設定値の置き場所：GitHub → `SpiceOfLife/ours-blanc-media` → Settings → Secrets and variables → Actions
（**Secrets** = 秘密情報、**Variables** = 秘密でない値）

---

## ① Cloudflare でサイトを公開（✅ 2026-11-14 完了：Workers 静的アセットとして GitHub 連携済み、gear.ours-blanc.app 接続済み。残りは 4・5 の Web Analytics のみ）
1. Cloudflare ダッシュボード → Workers & Pages → Create → Pages → Connect to Git → `SpiceOfLife/ours-blanc-media`
2. ビルド設定：Framework preset **Astro** / Build command `npm run build` / Output `dist` / 環境変数 `NODE_VERSION=22`
3. デプロイ後 → Custom domains → `gear.ours-blanc.app` を追加（ours-blanc.app は Cloudflare 管理なので DNS は自動）
4. 同プロジェクト → Metrics → **Web Analytics を有効化**（Cookie 不要の計測）。表示される **site tag** と **token** を控える
5. Pages → Settings → Environment variables（Production）に `PUBLIC_CF_BEACON_TOKEN` = 上の token

## ② Anthropic API キー（5分）
1. https://console.anthropic.com → API Keys → Create Key（名前 `ours-blanc-media`）
2. Billing で上限（例：月 $60）を設定
3. GitHub **Secret** `ANTHROPIC_API_KEY`

任意の Variables：`CLAUDE_MODEL`（既定 `claude-sonnet-5-5`）、`DAILY_BUDGET_USD`（既定 3）

## ③ 楽天アフィリエイト＋楽天ウェブサービス（15分）
1. 楽天アフィリエイトに登録（楽天会員でログイン）
2. https://webservice.rakuten.co.jp → アプリ ID 発行。**アプリ URL / 許可する Referer に `https://gear.ours-blanc.app/` を登録**（2026 年の新 API は Referer チェック必須）
3. 表示される **アプリケーション ID・アクセスキー・アフィリエイト ID** を GitHub **Secrets** へ：`RAKUTEN_APP_ID` / `RAKUTEN_ACCESS_KEY` / `RAKUTEN_AFFILIATE_ID`

## ③-2 非公開データリポジトリへの書き込みトークン（5分）
コード用リポジトリは公開、レポート・下書き・成果CSVは非公開の `SpiceOfLife/ours-blanc-media-data` に保存します。
1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token
2. Repository access：**Only select repositories** → `ours-blanc-media-data` のみ / Permissions：**Contents: Read and write** / 有効期限：1年
3. `ours-blanc-media` の **Secret** `DATA_REPO_TOKEN` に貼り付け

## ④ 初回実行（5分）
1. GitHub → Actions → **Daily PDCA** → Run workflow（まず `dry_run` にチェックして動作確認 → 次にチェックなしで本番）
2. 以後は毎朝 05:17 に自動実行。記事は品質チェック合格分だけが公開され、非公開リポジトリ `ours-blanc-media-data` の `reports/daily/latest.md` にレポートが出ます
3. `config/experience.json` の `notes` に、所有機材の感想を一言ずつ書いておくと記事に一次情報として使われます（**ここが記事の独自性の源泉**です）

## ⑤ Amazon アソシエイト（記事 10 本以上になってから）
1. https://affiliate.amazon.co.jp で申請（サイト URL：`https://gear.ours-blanc.app`）
2. トラッキング ID（例 `oursblanc-22`）を GitHub **Secret** `AMAZON_ASSOCIATE_TAG`
3. 承認から 180 日以内に 3 件の売上が必要。達成後は Creators API の認証情報を取得すれば価格・画像の自動取得に対応できます（拡張予定）

## ⑥ Google Search Console（20分）
1. Search Console に `ours-blanc.app` のドメインプロパティがあることを確認（無ければ追加）。サイトマップ `https://gear.ours-blanc.app/sitemap-index.xml` を送信
2. Google Cloud Console → 新規プロジェクト → 「Google Search Console API」を有効化 → IAM → サービスアカウント作成 → キー（JSON）をダウンロード
3. Search Console → 設定 → ユーザーと権限 → サービスアカウントのメールを **制限付き** で追加
4. GitHub **Secret** `GOOGLE_SERVICE_ACCOUNT_JSON` = JSON の中身（そのまま貼り付け可）
5. **Variable** `GSC_SITE_URL` = `sc-domain:ours-blanc.app`

## ⑦ Cloudflare 計測 API（5分）
1. Cloudflare → My Profile → API Tokens → Create Token → 権限 **Account › Account Analytics › Read**
2. **Secret** `CF_API_TOKEN`、**Variables** `CF_ACCOUNT_ID`（ダッシュボード右側の Account ID）、`CF_SITE_TAG`（①-4 の site tag）

## ⑧ Google AdSense（記事 20〜30 本・公開 2〜4 週間後が目安）
1. AdSense に `ours-blanc.app` を登録（サブドメインはルートドメインで審査）
2. **ads.txt をルートに設置**：`ours-blanc-sites` リポジトリのルート公開ディレクトリに `ads.txt`（AdSense に表示される 1 行）を追加。gear 側の `/ads.txt` は自動生成済み
3. Pages の環境変数に `PUBLIC_ADSENSE_CLIENT` = `ca-pub-XXXXXXXXXXXXXXXX` → 再デプロイで自動広告が有効に
4. AdSense →「プライバシーとメッセージ」→ 欧州規制のメッセージ（Google 認定 CMP）を有効化
5. 収益をレポートに載せる（任意）：Google Cloud で「AdSense Management API」を有効化 → OAuth クライアント（ウェブ）作成 → OAuth Playground（スコープ `https://www.googleapis.com/auth/adsense.readonly`）でリフレッシュトークン取得 → **Secrets** `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` / `GOOGLE_OAUTH_REFRESH_TOKEN`、**Variable** `ADSENSE_ACCOUNT` = `accounts/pub-XXXXXXXXXXXXXXXX`

## ⑨ アフィリエイト成果の手入力（週 1 回・5分）
楽天・Amazon は成果レポート API が無いため、管理画面の日別成果を 非公開リポジトリ `ours-blanc-media-data` の `manual/YYYY-MM.csv` に追記：
```
date,program,clicks,orders,revenue_jpy
2026-11-20,rakuten,12,1,380
2026-11-20,amazon,8,0,0
```

---

## 毎日の流れ
| 時刻 (JST) | 内容 |
|---|---|
| 05:17 | GitHub Actions：前日の数値収集 → 改善策を戦略に反映 → 記事作成・審査・公開 → レポート |
| 05:30頃 | Cloudflare Pages が自動デプロイ |
| 07:40 | Claude の定期タスクがレポートを読み、要点・改善内容・Yu さんの ToDo を通知 |

差し戻し記事は非公開リポジトリの `drafts/` に理由付きで残ります。手直しして `src/content/posts/` に移せば次のデプロイで公開されます。
