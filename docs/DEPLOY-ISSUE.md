# 本番デプロイ問題整理

## 現状

Amplify Console での本番デプロイが失敗している。

## 根本原因

**アーキテクチャの制約**

| 環境 | アーキテクチャ | 備考 |
|------|---------------|------|
| AgentCore Runtime | ARM64 のみ | AWS側の制約 |
| Amplify Console ビルド環境 | x86_64 のみ | カスタムイメージもx86_64のみ |
| Dockerfile | `--platform=linux/arm64` | ARM64 指定 |

→ Amplify Console では ARM64 イメージをビルドできない

## 発生したエラーの経緯

### 1. CDKAssetPublishError
```
[CDKAssetPublishError] CDK failed to publish assets
```
- **原因**: デフォルトビルドイメージに Docker が含まれていない
- **対応**: カスタムビルドイメージ `amazonlinux-x86_64-standard:5.0` を設定
- **結果**: ✅ Docker は使えるようになった

### 2. Docker daemon not running
```
ERROR: Cannot connect to the Docker daemon at unix:///var/run/docker.sock
```
- **原因**: Docker デーモンが起動していない
- **対応**: `amplify.yml` で Docker デーモンを起動する設定を追加
- **結果**: ✅ Docker デーモンが起動するようになった

### 3. apt-get exit code 255
```
ERROR: failed to solve: process "/bin/sh -c apt-get update..." exit code: 255
```
- **原因**: x86_64 環境で ARM64 イメージ（`--platform=linux/arm64`）をビルドしようとした
- **対応**: ARM64 ビルドイメージ `amazonlinux-aarch64-standard:3.0` に変更を試行
- **結果**: ❌ 次のエラーへ

### 4. SINGLE_BUILD_CONTAINER_DEAD（現在）
```
Build container found dead before completing the build.
Build container died because it was out of memory, or the Docker image is not supported
```
- **原因**: Amplify Console は ARM64 カスタムビルドイメージをサポートしていない
- **対応**: ECR 事前プッシュ方式に切り替え

## 結論

**Amplify Console では ARM64 Docker イメージをビルドできない**

理由:
- Amplify Console のビルド環境は x86_64 のみ
- カスタムビルドイメージも x86_64 のみサポート
- ARM64 イメージ（`amazonlinux-aarch64-standard:3.0`）を指定するとコンテナが死ぬ

## 解決策: ECR 事前プッシュ方式

ローカル（Mac ARM64）で Docker イメージをビルドして ECR にプッシュし、CDK で参照する。

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  ローカル Mac    │────▶│      ECR        │────▶│  Amplify Console │
│  (ARM64 ビルド)  │push │  (イメージ保存)  │参照 │  (Docker不要)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 手順

1. ✅ ECR リポジトリ作成済み
   ```
   715841358122.dkr.ecr.us-east-1.amazonaws.com/marp-agent
   ```

2. ✅ ECR ログイン済み

3. ⬜ ローカルで Docker イメージをビルド
   ```bash
   cd amplify/agent/runtime
   docker build -t marp-agent .
   ```

4. ⬜ ECR にプッシュ
   ```bash
   docker tag marp-agent:latest 715841358122.dkr.ecr.us-east-1.amazonaws.com/marp-agent:latest
   docker push 715841358122.dkr.ecr.us-east-1.amazonaws.com/marp-agent:latest
   ```

5. ⬜ `amplify/agent/resource.ts` を修正
   - `fromAsset()` → `fromEcrRepository()` に変更

6. ⬜ `amplify.yml` から Docker 起動設定を削除（不要になる）

7. ⬜ Amplify Console のビルドイメージをデフォルトに戻す

8. ⬜ コミット・プッシュして再デプロイ

### 運用上の注意

- エージェントコード（agent.py）を変更した場合、手動で ECR に再プッシュが必要
- 将来的には GitHub Actions で自動化を検討
