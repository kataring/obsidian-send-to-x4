# Send to X4

ObsidianのMarkdownノートをEPUB形式に変換し、Xtenik X4電子インク端末へWiFi経由で送信するプラグインです。

## 機能

- **MarkdownからEPUBへの自動変換** - Obsidianノートを電子書籍形式に変換
- **WiFi経由でのアップロード** - X4デバイスへネットワーク経由で直接送信
- **ウォッチフォルダ** - 指定フォルダのファイルを自動検出して送信
- **自動アップロード** - デバイス接続時にキュー内容を自動送信
- **EPUB手動ダウンロード** - アップロードせずにEPUBファイルをダウンロード可能
- **複数ファームウェア対応** - 標準X4ファームウェアとCrossPointカスタムファームウェアの両方に対応

## インストール

1. Obsidianの設定 → コミュニティプラグイン → 閲覧を開く
2. 「Send to X4」を検索してインストール
3. プラグインを有効化

### 手動インストール

1. このリポジトリから最新リリースをダウンロード
2. `main.js`、`manifest.json`、`styles.css`をObsidianのプラグインフォルダ（`.obsidian/plugins/obsidian-send-to-x4/`）にコピー
3. Obsidianを再起動し、プラグインを有効化

## 使い方

### 手動送信

1. 送信したいノートを開く
2. 以下のいずれかの方法で送信:
   - コマンドパレットから「Send current note to X4」を実行
   - ファイルメニューから「Send to X4」を選択
   - 右クリックメニューから「Send to X4」を選択
   - サイドバーのリボンアイコンをクリック

### ウォッチフォルダを使用

1. Vault内に`obsidian-to-x4`フォルダを作成（または設定でカスタム名を指定）
2. 送信したいMarkdownファイルをそのフォルダに配置
3. デバイスがWiFi接続されていれば自動で送信
4. 送信完了後、ファイルは「Sent」サブフォルダに移動

### EPUBダウンロード

X4にアップロードせずにEPUBファイルをダウンロードしたい場合:
1. ノートを開く
2. コマンドパレットから「Download current note as EPUB」を実行

## メタデータ

YAML frontmatterでメタデータを指定できます:

```yaml
---
title: "記事のタイトル"
author: "@username"
date: 2025-01-31
---
```

これらのメタデータはEPUBのファイル名と内部メタデータに使用されます。

## 設定

| 項目 | 説明 | デフォルト値 |
|-----|------|------------|
| Use CrossPoint Firmware | CrossPointファームウェアを使用 | OFF |
| Target Folder | X4上のアップロード先フォルダ | `obsidian-to-x4` |
| Enable Watch Folder | ウォッチフォルダ機能の有効化 | ON |
| Watch Folder Path | 監視対象フォルダパス | `obsidian-to-x4` |
| X4 IP Address | 標準X4ファームウェアのIPアドレス | `192.168.3.3` |
| CrossPoint IP Address | CrossPointファームウェアのIPアドレス | `192.168.4.1` |

## 対応デバイス

- Xtenik X4（標準ファームウェア）
- CrossPointカスタムファームウェア搭載デバイス

## 技術仕様

- **EPUB形式**: EPUB 2.0
- **対応Obsidianバージョン**: 0.15.0以上
- **ネットワーク**: WiFi経由（HTTP）

## 開発

### ビルド

```bash
npm install
npm run build
```

### 開発モード

```bash
npm run dev
```

## ライセンス

MIT License

## 貢献

バグ報告や機能リクエストは[Issues](https://github.com/kataring/obsidian-send-to-x4/issues)へお願いします。
