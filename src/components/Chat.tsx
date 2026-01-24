import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface ChatProps {
  onMarkdownGenerated: (markdown: string) => void;
  currentMarkdown: string;
}

export function Chat({ onMarkdownGenerated, currentMarkdown }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setStatus('考え中...');

    // アシスタントメッセージを追加（ストリーミング用）
    setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

    try {
      // TODO: 実際のエージェント呼び出しに置き換え
      // ローカル開発用のモック
      await mockAgentCall(userMessage, currentMarkdown, (chunk, type) => {
        if (type === 'text') {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === 'assistant') {
              lastMessage.content += chunk;
            }
            return newMessages;
          });
        } else if (type === 'status') {
          setStatus(chunk);
        } else if (type === 'markdown') {
          onMarkdownGenerated(chunk);
          setStatus('');
        }
      });

      // ストリーミング完了
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.role === 'assistant') {
          lastMessage.isStreaming = false;
        }
        return newMessages;
      });
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.role === 'assistant') {
          lastMessage.content = 'エラーが発生しました。もう一度お試しください。';
          lastMessage.isStreaming = false;
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
      setStatus('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <p className="text-lg">スライドを作成しましょう</p>
            <p className="text-sm mt-2">例: 「AWS入門の5枚スライドを作って」</p>
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-kag-blue text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {message.content}
                {message.isStreaming && <span className="animate-pulse">▌</span>}
              </pre>
            </div>
          </div>
        ))}
        {status && (
          <div className="flex justify-start">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-yellow-800 text-sm">
              ⏳ {status}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力フォーム */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="スライドの指示を入力..."
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-kag-blue"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-kag-blue text-white px-6 py-2 rounded-lg hover:bg-kag-blue-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            送信
          </button>
        </div>
      </form>
    </div>
  );
}

// モックのエージェント呼び出し（ローカル開発用）
async function mockAgentCall(
  prompt: string,
  _currentMarkdown: string,
  onChunk: (chunk: string, type: 'text' | 'status' | 'markdown') => void
) {
  // 思考過程をストリーミング
  const thinkingText = `${prompt}についてスライドを作成しますね。\n\n構成を考えています...`;
  for (const char of thinkingText) {
    onChunk(char, 'text');
    await sleep(20);
  }

  onChunk('スライドを生成しています...', 'status');
  await sleep(1000);

  // サンプルマークダウンを生成
  const sampleMarkdown = `---
marp: true
theme: gaia
size: 16:9
paginate: true
---

# ${prompt}

サンプルスライド

---

# スライド 2

- ポイント 1
- ポイント 2
- ポイント 3

---

# まとめ

ご清聴ありがとうございました
`;

  onChunk(sampleMarkdown, 'markdown');
  onChunk('\n\nスライドを生成しました！プレビュータブで確認できます。', 'text');
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
