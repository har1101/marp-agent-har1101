# 本番デプロイ問題整理

## 現状

Amplify Console での本番デプロイが失敗している。

## 根本原因

**アーキテクチャの不整合**

| 環境 | アーキテクチャ | 状態 |
|------|---------------|------|
| AgentCore Runtime | ARM64 のみ対応 | 制約 |
| Amplify Console ビルド環境 | x86_64 | 制約 |
| Dockerfile | `--platform=linux/arm64` | ARM64 指定 |

→ x86_64 環境で ARM64 イメージをネイティブビルドできない

## 発生したエラーの経緯

### 1. CDKAssetPublishError（最初のエラー）
```
[CDKAssetPublishError] CDK failed to publish assets
```
- **原因**: デフォルトビルドイメージに Docker が含まれていない
- **対応**: カスタムビルドイメージを設定 → 解決

### 2. Docker daemon not running
```
ERROR: Cannot connect to the Docker daemon at unix:///var/run/docker.sock
```
- **原因**: Docker デーモンが起動していない
- **対応**: `amplify.yml` で Docker デーモンを起動 → 解決

### 3. apt-get exit code 255（現在のエラー）
```
ERROR: failed to solve: process "/bin/sh -c apt-get update..." did not complete successfully: exit code: 255
```
- **原因**: x86_64 環境で ARM64 イメージをビルドしようとしている
- **対応**: 検討中

## 解決策の選択肢

### A. ECR 事前プッシュ方式（推奨）

ローカル（Mac ARM64）でビルドして ECR にプッシュし、CDK で参照する。

**手順**:
1. ECR リポジトリを作成
2. ローカルで ARM64 イメージをビルド
3. ECR にプッシュ
4. CDK を `fromAsset()` → `fromEcrRepository()` に変更
5. Amplify Console でビルド（Docker 不要になる）

**メリット**:
- 確実に ARM64 イメージを使用できる
- ビルド時間短縮

**デメリット**:
- エージェントコード変更時に手動で ECR プッシュが必要
- CI/CD パイプラインの追加構築が必要

### B. Docker buildx（QEMU エミュレーション）

x86_64 環境から ARM64 イメージをクロスビルドする。

**手順**:
1. `amplify.yml` で QEMU と buildx をセットアップ
2. `docker buildx build --platform linux/arm64` でビルド

**メリット**:
- 既存の `fromAsset()` を維持できる
- ワークフロー変更が少ない

**デメリット**:
- ビルドが遅い（エミュレーション）
- QEMU セットアップが複雑

### C. GitHub Actions + ECR

GitHub Actions の ARM64 ランナーでビルドして ECR にプッシュ。

**メリット**:
- ネイティブ ARM64 ビルド
- 自動化可能

**デメリット**:
- 追加の CI/CD 設定が必要
- GitHub Actions の設定コスト

## 採用する解決策

**ARM64 ビルドイメージを使用**

Amplify Console のカスタムビルドイメージを ARM64 対応のものに変更する。

```
public.ecr.aws/codebuild/amazonlinux-aarch64-standard:3.0
```

理由:
1. AgentCore Runtime が ARM64 専用なので、ビルド環境も ARM64 に統一
2. 既存の `fromAsset()` をそのまま使用可能
3. 追加のインフラ（ECR等）が不要

## 実施した変更

1. ✅ Dockerfile に `--platform=linux/arm64` を追加
2. ✅ PLAN.md のビルドイメージ記載を ARM64 に修正
3. 🔄 Amplify Console でカスタムビルドイメージを変更（手動）

## 次のアクション

1. Amplify Console → Build settings → Build image settings → Edit
2. Build image → Custom Build Image
3. イメージ名: `public.ecr.aws/codebuild/amazonlinux-aarch64-standard:3.0`
4. Save
5. 変更をコミット・プッシュして再デプロイ
