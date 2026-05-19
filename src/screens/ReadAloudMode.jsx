import { useState } from 'react';

export default function ReadAloudMode({ sentences, title, onClose }) {
  const [current, setCurrent] = useState(0);
  const isDone = current >= sentences.length;

  function handleNext() {
    if (!isDone) setCurrent(prev => prev + 1);
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') handleNext();
  }

  return (
    <div className="readaloud-overlay" tabIndex={0} onKeyDown={handleKeyDown} autoFocus>
      <div className="readaloud-header">
        <p className="readaloud-title">{title}</p>
        <div className="readaloud-progress">{current} / {sentences.length}</div>
        <button className="projector-close" onClick={onClose}>✕ 닫기</button>
      </div>

      <div className="readaloud-body">
        {current === 0 ? (
          <p className="readaloud-hint">버튼을 눌러 이야기를 시작하세요</p>
        ) : (
          <div className="readaloud-sentences">
            {sentences.slice(0, current).map((s, i) => (
              <div
                key={s.id}
                className={`readaloud-sentence ${i === current - 1 ? 'readaloud-sentence-new' : 'readaloud-sentence-old'}`}
              >
                <p className="readaloud-text">{s.text}</p>
                <p className="readaloud-author">— {s.player_name}</p>
              </div>
            ))}
          </div>
        )}
        {isDone && <div className="readaloud-done">🎉 끝!</div>}
      </div>

      <div className="readaloud-footer">
        {!isDone ? (
          <button className="btn readaloud-next-btn" onClick={handleNext}>
            {current === 0 ? '▶ 시작' : '다음 ▶'}
          </button>
        ) : (
          <button className="btn readaloud-next-btn" onClick={onClose}>닫기</button>
        )}
        <p className="readaloud-key-hint">키보드 스페이스바 / → 로도 넘길 수 있어요</p>
      </div>
    </div>
  );
}
