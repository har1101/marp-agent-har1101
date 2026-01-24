# ナレッジベース

開発中に得られた知見・調査結果をここに蓄積していく。

---

## 使用ライブラリ・SDK

**方針**: すべて最新版を使用する

### フロントエンド
- React
- TypeScript
- Vite
- Tailwind CSS v4（ゼロコンフィグ、@theme でカスタムカラー定義）

### AWS Amplify
- @aws-amplify/backend
- @aws-amplify/ui-react

### エージェント・インフラ
- strands-agents（Python >=3.10）
- bedrock-agentcore（AgentCore SDK）
- @marp-team/marp-cli
- @aws-cdk/aws-bedrock-agentcore-alpha

---

## Python環境管理（uv）

### 概要
- Rustで書かれた高速なPythonパッケージマネージャー
- pip/venv/pyenvの代替

### 基本コマンド
```bash
# プロジェクト初期化
uv init --no-workspace

# 依存追加
uv add strands-agents bedrock-agentcore

# スクリプト実行
uv run python script.py
```

### AWS CLI login 認証を使う場合
```bash
uv add 'botocore[crt]'
```
※ `aws login` で認証した場合、botocore[crt] が必要

---

## Bedrock AgentCore SDK（Python）

### 基本構造
```python
from bedrock_agentcore import BedrockAgentCoreApp
from strands import Agent

app = BedrockAgentCoreApp()
agent = Agent(model="us.anthropic.claude-sonnet-4-5-20250929-v1:0")

@app.entrypoint
async def invoke(payload):
    prompt = payload.get("prompt", "")
    stream = agent.stream_async(prompt)
    async for event in stream:
        yield event

if __name__ == "__main__":
    app.run()  # ポート8080でリッスン
```

### 必要な依存関係（requirements.txt）
```
bedrock-agentcore
strands-agents
```
※ fastapi/uvicorn は不要（SDKに内包）

### エンドポイント
- `POST /invocations` - エージェント実行
- `GET /ping` - ヘルスチェック

---

## Strands Agents

### 基本情報
- AWS が提供する AI エージェントフレームワーク
- Python で実装
- Bedrock モデルと統合

### Agent作成
```python
from strands import Agent

agent = Agent(
    model="us.anthropic.claude-sonnet-4-5-20250929-v1:0",
    system_prompt="あなたはアシスタントです",
)
```

### ストリーミング
```python
async for event in agent.stream_async(prompt):
    if "data" in event:
        print(event["data"], end="", flush=True)
```

### イベントタイプ
- `data`: テキストチャンク
- `current_tool_use`: ツール使用情報
- `result`: 最終結果

---

## AgentCore Runtime CDK（TypeScript）

### パッケージ
```bash
npm install @aws-cdk/aws-bedrock-agentcore-alpha
```

### Runtime定義
```typescript
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import * as path from 'path';

// ローカルDockerイメージからビルド（ARM64必須）
const artifact = agentcore.AgentRuntimeArtifact.fromAsset(
  path.join(__dirname, 'agent/runtime')
);

const runtime = new agentcore.Runtime(stack, 'MarpAgent', {
  runtimeName: 'marp-agent',
  agentRuntimeArtifact: artifact,
});

// エンドポイント作成（必須）
const endpoint = runtime.addEndpoint('marp-agent-endpoint');
```

### Runtimeクラスのプロパティ
| プロパティ | 説明 |
|-----------|------|
| `agentRuntimeArn` | Runtime ARN |
| `agentRuntimeId` | Runtime ID |
| `agentRuntimeName` | Runtime名 |
| `role` | IAMロール |

※ `runtimeArn` や `invokeUrl` は存在しない（alpha版の注意点）

### RuntimeEndpointクラスのプロパティ
| プロパティ | 説明 |
|-----------|------|
| `agentRuntimeEndpointArn` | Endpoint ARN |
| `endpointName` | Endpoint名 |
| `agentRuntimeArn` | 親RuntimeのARN |

### Cognito認証統合
```typescript
authorizerConfiguration: agentcore.RuntimeAuthorizerConfiguration.usingCognito(
  userPool,
  [userPoolClient]
)
```

### Bedrockモデル権限付与
```typescript
runtime.addToRolePolicy(new iam.PolicyStatement({
  actions: [
    'bedrock:InvokeModel',
    'bedrock:InvokeModelWithResponseStream',
  ],
  resources: ['arn:aws:bedrock:*::foundation-model/*'],  // 全モデル
}));
```

### Amplify Gen2との統合
```typescript
// amplify/backend.ts
const backend = defineBackend({ auth });
const stack = backend.createStack('AgentCoreStack');

// Amplifyの認証リソースを参照
const userPool = backend.auth.resources.userPool;
const userPoolClient = backend.auth.resources.userPoolClient;
```

---

## CDK Hotswap × AgentCore Runtime

### 概要
- 2025/1/24、CDK hotswap が Bedrock AgentCore Runtime に対応
- k.goto さん（@365_step_tech）による実装・調査

### 参考リンク
- [CDK Hotswap × AgentCore Runtime](https://go-to-k.hatenablog.com/entry/cdk-hotswap-bedrock-agentcore-runtime)

### 対応状況（2025/1/24時点）

| 項目 | 状況 |
|------|------|
| CDK hotswap | AgentCore Runtime 対応済み（v1.14.0〜） |
| Amplify toolkit-lib | まだ対応バージョン（1.14.0）に未更新 |
| ECRソースのバグ | AWS SDK（smithy/core）のリグレッション。近々自動修正見込み |
| Amplify Console | Docker build 未サポート |

### Amplify との組み合わせ

#### sandbox 環境
- `AgentRuntimeArtifact.fromAsset` でローカルビルド可能
- Mac ARM64 でビルドできるなら `deploy-time-build` は不要
- Amplify の toolkit-lib 更新後は hotswap も使える

#### 本番環境（Amplify Console）
- Docker build 未サポートのため工夫が必要
- 選択肢：
  1. GitHub Actions で ECR プッシュ → CDK で ECR 参照
  2. sandbox と main でビルド方法を分岐
  3. Amplify Console の Docker 対応を待つ

---

## Marp CLI

### 基本情報
- Markdown からスライドを生成するツール
- PDF / HTML / PPTX 出力対応
- 公式: https://marp.app/

### Docker内での設定
```dockerfile
RUN apt-get update && apt-get install -y chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
```

### Marp フロントマター
```yaml
---
marp: true
theme: gaia
size: 16:9
paginate: true
---
```

---

## Tailwind CSS v4

### Vite統合
```typescript
// vite.config.ts
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

### カスタムカラー定義
```css
/* src/index.css */
@import "tailwindcss";

@theme {
  --color-kag-blue: #0e0d6a;
}
```

### 使用方法
```jsx
<h1 className="text-kag-blue">タイトル</h1>
```

---

## Marp Core（フロントエンド用）

### インストール
```bash
npm install @marp-team/marp-core
```

### ブラウザでのレンダリング
```typescript
import Marp from '@marp-team/marp-core';

const marp = new Marp();
const { html, css } = marp.render(markdown);

// HTMLからスライドを抽出
const parser = new DOMParser();
const doc = parser.parseFromString(html, 'text/html');
const sections = doc.querySelectorAll('section');
```

### スライドプレビュー表示
- 各スライドは `<section>` タグで区切られる
- CSSも一緒に適用する必要あり
- サムネイル表示には `transform: scale(0.5)` などでスケールダウン

---

## フロントエンド構成

### コンポーネント構成
```
src/
├── App.tsx              # メイン（タブ切り替え、状態管理）
├── components/
│   ├── Chat.tsx         # チャットUI（ストリーミング対応）
│   └── SlidePreview.tsx # スライドプレビュー
└── hooks/               # カスタムフック（今後追加）
```

### 状態管理
- `markdown`: 生成されたMarpマークダウン
- `activeTab`: 現在のタブ（chat / preview）
- `isDownloading`: PDF生成中フラグ

### ストリーミングUI実装パターン
```typescript
// メッセージを逐次更新
setMessages(prev => {
  const newMessages = [...prev];
  const lastMessage = newMessages[newMessages.length - 1];
  lastMessage.content += chunk;
  return newMessages;
});
```

---

## 参考リンク

- [Marp公式](https://marp.app/)
- [Marp Core](https://github.com/marp-team/marp-core)
- [Strands Agents](https://strandsagents.com/)
- [Amplify Gen2](https://docs.amplify.aws/gen2/)
- [AgentCore CDK](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-bedrock-agentcore-alpha-readme.html)
- [uv](https://docs.astral.sh/uv/)
