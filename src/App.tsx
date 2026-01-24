import { useState } from 'react';
import { Chat } from './components/Chat';
import { SlidePreview } from './components/SlidePreview';

type Tab = 'chat' | 'preview';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [markdown, setMarkdown] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const handleMarkdownGenerated = (newMarkdown: string) => {
    setMarkdown(newMarkdown);
    // スライド生成後、自動でプレビュータブに切り替え
    setActiveTab('preview');
  };

  const handleDownloadPdf = async () => {
    if (!markdown) return;

    setIsDownloading(true);
    try {
      // TODO: 実際のPDF生成APIを呼び出す
      // ローカル開発用のモック
      await new Promise(resolve => setTimeout(resolve, 2000));

      // モック: マークダウンをBlobとしてダウンロード
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'slide.md';
      a.click();
      URL.revokeObjectURL(url);

      alert('PDF生成機能は本番環境でのみ利用可能です。\n代わりにマークダウンファイルをダウンロードしました。');
    } catch (error) {
      console.error('Download error:', error);
      alert('ダウンロードに失敗しました');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-kag-blue text-white px-6 py-4 shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">パワポ作るマン</h1>
          {markdown && (
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="bg-white text-kag-blue px-4 py-1 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors text-sm"
            >
              {isDownloading ? '生成中...' : '📄 PDF'}
            </button>
          )}
        </div>
      </header>

      {/* タブ */}
      <div className="bg-white border-b">
        <div className="flex">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'chat'
                ? 'text-kag-blue border-b-2 border-kag-blue'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            💬 チャット
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-6 py-3 font-medium transition-colors relative ${
              activeTab === 'preview'
                ? 'text-kag-blue border-b-2 border-kag-blue'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📊 プレビュー
            {markdown && activeTab !== 'preview' && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'chat' ? (
          <Chat
            onMarkdownGenerated={handleMarkdownGenerated}
            currentMarkdown={markdown}
          />
        ) : (
          <SlidePreview
            markdown={markdown}
            onDownloadPdf={handleDownloadPdf}
            isDownloading={isDownloading}
          />
        )}
      </main>
    </div>
  );
}

export default App;
