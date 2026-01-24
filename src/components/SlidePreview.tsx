import { useMemo } from 'react';
import Marp from '@marp-team/marp-core';

interface SlidePreviewProps {
  markdown: string;
  onDownloadPdf: () => void;
  isDownloading: boolean;
}

export function SlidePreview({ markdown, onDownloadPdf, isDownloading }: SlidePreviewProps) {
  const slides = useMemo(() => {
    if (!markdown) return [];

    try {
      const marp = new Marp();
      const { html, css } = marp.render(markdown);

      // HTMLからスライドを抽出
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const sections = doc.querySelectorAll('section');

      return Array.from(sections).map((section, index) => ({
        index,
        html: section.outerHTML,
        css,
      }));
    } catch (error) {
      console.error('Marp render error:', error);
      return [];
    }
  }, [markdown]);

  if (!markdown) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <p className="text-lg">スライドがありません</p>
          <p className="text-sm mt-2">チャットでスライドを生成してください</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="flex justify-between items-center p-4 border-b">
        <span className="text-sm text-gray-600">
          {slides.length} スライド
        </span>
        <button
          onClick={onDownloadPdf}
          disabled={isDownloading || slides.length === 0}
          className="bg-kag-blue text-white px-4 py-2 rounded-lg hover:bg-kag-blue-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isDownloading ? (
            <>
              <span className="animate-spin">⏳</span>
              生成中...
            </>
          ) : (
            <>
              📄 PDFダウンロード
            </>
          )}
        </button>
      </div>

      {/* スライド一覧 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {slides.map((slide) => (
            <div
              key={slide.index}
              className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="bg-gray-100 px-3 py-1 text-xs text-gray-600 border-b">
                スライド {slide.index + 1}
              </div>
              <div className="aspect-video bg-white p-2">
                <div
                  className="w-full h-full overflow-hidden"
                  style={{ transform: 'scale(0.5)', transformOrigin: 'top left' }}
                >
                  <style>{slide.css}</style>
                  <div
                    dangerouslySetInnerHTML={{ __html: slide.html }}
                    className="marp-slide"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
