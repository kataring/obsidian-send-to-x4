# CLAUDE.md

このファイルは Claude Code がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

**Send to X4** は、Obsidian のマークダウンノートを EPUB 形式に変換し、WiFi 経由で Xtenik X4 電子ペーパーデバイスに送信する Obsidian プラグインです。

### 主な機能

- Markdown → EPUB 2.0 変換（JSZip 使用）
- WiFi 経由での X4 デバイスへの直接アップロード
- EPUB ファイルの手動ダウンロード
- 標準 X4 ファームウェアと CrossPoint カスタムファームウェアの両方に対応
- アップロードキュー管理（pending/uploading/done/failed）
- X4 デバイスのファイルブラウザ（ツリービュー）
- YAML フロントマターからのメタデータ抽出

## プロジェクト構造

```
src/
├── main.ts                    # プラグインエントリーポイント
├── types.ts                   # 型定義
├── settings.ts                # 設定タブ UI
├── epub/
│   ├── epub-builder.ts        # EPUB 生成（JSZip）
│   └── epub-templates.ts      # EPUB XML テンプレート
├── queue/
│   └── queue-manager.ts       # キュー管理、ファイル処理
├── upload/
│   ├── uploader-interface.ts  # アップローダーインターフェース
│   ├── x4-uploader.ts         # 標準 X4 ファームウェア用
│   └── crosspoint-uploader.ts # CrossPoint ファームウェア用
├── utils/
│   ├── markdown-converter.ts  # Markdown→XHTML 変換
│   └── sanitize.ts            # HTML サニタイズ
└── views/
    ├── x4-tree-view.ts        # デバイスファイルツリー表示
    └── file-picker-modal.ts   # ファイル選択モーダル
```

## 開発コマンド

```bash
npm install     # 依存関係インストール
npm run dev     # 開発モード（ウォッチ）
npm run build   # プロダクションビルド
```

## ビルドシステム

- **バンドラー**: esbuild
- **言語**: TypeScript (ES6 ターゲット)
- **出力**: `main.js`（CommonJS 形式）

## 主要な型定義

```typescript
// src/types.ts
interface SendToX4Settings {
  useCrosspointFirmware: boolean;
  targetFolder: string;
  x4Ip: string;
  crosspointIp: string;
}

interface QueueItem {
  id: string;
  title: string;
  filePath: string;
  status: 'pending' | 'uploading' | 'done' | 'failed';
  error?: string;
}

interface ArticleData {
  title: string;
  author: string;
  date: string;
  body: string;
  url?: string;
}
```

## アーキテクチャ

### 処理フロー

```
ユーザーアクション → QueueManager.uploadFile()
  → ファイル読み込み
  → メタデータ抽出（YAML フロントマター）
  → Markdown → XHTML 変換
  → HTML サニタイズ
  → EpubBuilder.build()（ZIP 構造作成）
  → Uploader 選択（X4 or CrossPoint）
  → HTTP マルチパートでアップロード
```

### ファームウェア別エンドポイント

| ファームウェア | ファイル一覧 | アップロード | 削除 |
|---------------|-------------|-------------|------|
| 標準 X4 | GET `/list` | POST `/edit` | DELETE `/edit` |
| CrossPoint | GET `/api/files` | POST `/upload` | DELETE (未実装) |

## コマンド一覧

| コマンド ID | 説明 |
|------------|------|
| `send-current-note` | 現在のノートを X4 に送信 |
| `upload-queue` | キュー内の全アイテムをアップロード |
| `download-epub` | 現在のノートを EPUB としてダウンロード |
| `open-x4-files` | X4 ファイルブラウザを開く |

## 依存関係

- `jszip` (3.10.1): EPUB の ZIP 構造生成
- `obsidian`: Obsidian API（devDependency）
- `esbuild`: バンドラー
- `typescript`: 型チェック
