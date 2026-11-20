# XREAL AURA Explorer

**Live Demo (Cloudflare Pages):** https://xreal-aura-explorer.pages.dev/

**XREAL AURA（Android XR）** の主要ハードウェア・空間体験機能を、実機の Chrome（PWA + WebXR）で体感・発見するためのインタラクティブ体験アプリです。  
WebXR 非対応ブラウザ（PC・スマートフォン）でも 3D プレビューとして動作します。

## 主な機能・体験モジュール

1. **光学・ディスプレイ（Optics）** — Micro-OLED の発色・コントラスト・純黒透過（シースルー）や視野角・可読性を確認
2. **空間 6DoF・ハンドトラッキング（Spatial & Hand）** — WebXR `immersive-ar` での 6DoF 空間配置・ハンド操作を体感
3. **環境認識（Environment）** — 平面・空間アンカー・奥行き表現などの環境認識体験
4. **空間オーディオ（Spatial Audio）** — Web Audio API による 3D 音像定位・音源移動の聴き比べ
5. **オーナーズガイド（Guide）** — XREAL AURA の必須8機能（5段階電子調光 / Gemini AI / Compute Puck / Home Space / 指紋認証 / DP-in / Bluetooth / WebXR起動Tips）を「試した！」チェックリスト＆進捗バーで管理（`localStorage` 自動保存）

### OLED 透過モード（シースルー透過モード）

ヘッダー右上の **「OLED透過モード」** を ON にすると、画面背景やカード背景が純黒（`#000000`）になります。  
XREAL AURA の Micro-OLED では黒ピクセルが発光しないため、背景が光学的に透過し、UI や 3D オブジェクトだけが現実空間に浮かぶように表示されます。

---

## ローカル起動方法

Node.js 18+ 環境で以下を実行します。

```bash
npm install
npm run dev
```

開発サーバーが `http://localhost:5173`（および LAN IP）で起動します。

ビルド・本番プレビュー：

```bash
npm run build
npm run preview
```

---

## XREAL AURA の Chrome で WebXR を開く方法（HTTPS / Secure Context）

WebXR（`navigator.xr` / `immersive-ar`）および Service Worker（PWA）は、ブラウザのセキュリティ要件により **HTTPS** または **`localhost`**（Secure Context）でのみ有効になります。  
LAN の生 IP（例: `http://192.168.x.x:5173`）では WebXR が無効になるため、以下のいずれかの方法でアクセスしてください。

### 方法 1：USB 接続＋ `adb reverse`（最も手軽・おすすめ）

Compute Puck / XREAL AURA を PC と USB 接続し、USB デバッグを有効にした状態で以下を実行します。

```bash
adb reverse tcp:5173 tcp:5173
```

その後、XREAL AURA 側の Chrome で **`http://localhost:5173`** を開くと、`localhost` は Secure Context 扱いとなるため、そのまま WebXR と PWA がフル動作します。

### 方法 2：Tailscale Serve（同一 Tailnet で簡単 HTTPS）

PC と XREAL AURA の両方に Tailscale を導入している場合：

```bash
tailscale serve https / http://127.0.0.1:5173
```

表示された `https://<machine-name>.<tailnet>.ts.net` を XREAL AURA の Chrome で開きます。

### 方法 3：Cloudflare Tunnel / ngrok（一時的な公開 HTTPS URL）

- **Cloudflare Tunnel（アカウント不要）**

  ```bash
  cloudflared tunnel --url http://localhost:5173
  ```
- **ngrok**

  ```bash
  ngrok http 5173
  ```

発行された `https://...` URL を XREAL AURA の Chrome で開きます。

### 方法 4：`mkcert` でローカル HTTPS 証明書を使う

同一 Wi-Fi 内で完全ローカル HTTPS にしたい場合は、`mkcert` で証明書を発行して Vite の `server.https` に設定し、ルート CA をデバイスへインストールします。

---

## 実機で快適に体験するための Tips

- **PWA としてインストール**: Chrome メニューから「ホーム画面に追加」を実行すると、アドレスバーのないスタンドアロン画面で広く表示できます。
- **権限の許可**: WebXR セッション開始時に表示される「AR / 没入型ビュー」の権限ダイアログを許可してください。
- **調光との組み合わせ**: 明るい環境ではテンプルの 5段階電子調光を中〜強にし、現実と重ねたいときは弱＋「OLED透過モード ON」がおすすめです。
