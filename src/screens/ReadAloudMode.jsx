import { useState, useEffect, useRef } from 'react';

function speak(text, voice, onEnd) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ko-KR';
  utter.rate = 0.9;
  if (voice) utter.voice = voice;
  if (onEnd) utter.onend = onEnd;
  synth.speak(utter);
}

export default function ReadAloudMode({ sentences, title, onClose }) {
  const [current, setCurrent] = useState(0);
  const [ttsOn, setTtsOn] = useState(true);
  const [voices, setVoices] = useState([]);
  const [voiceIdx, setVoiceIdx] = useState(0);
  const isDone = current >= sentences.length;
  const speakingRef = useRef(false);

  useEffect(() => {
    function loadVoices() {
      const ko = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('ko'));
      setVoices(ko);
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.cancel(); };
  }, []);

  useEffect(() => {
    if (!ttsOn || current === 0 || isDone) return;
    const s = sentences[current - 1];
    if (s) speak(s.text, voices[voiceIdx], () => { speakingRef.current = false; });
  }, [current]);

  function handleNext() {
    if (isDone) return;
    window.speechSynthesis.cancel();
    setCurrent(prev => prev + 1);
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') handleNext();
  }

  function toggleTts() {
    if (ttsOn) window.speechSynthesis.cancel();
    setTtsOn(v => !v);
  }

  return (
    <div className="readaloud-overlay" tabIndex={0} onKeyDown={handleKeyDown} autoFocus>
      <div className="readaloud-header">
        <p className="readaloud-title">{title}</p>
        <div className="readaloud-progress">{current} / {sentences.length}</div>
        <div className="readaloud-header-right">
          {voices.length > 1 && (
            <select
              className="readaloud-voice-select"
              value={voiceIdx}
              onChange={e => setVoiceIdx(Number(e.target.value))}
            >
              {voices.map((v, i) => (
                <option key={i} value={i}>{v.name}</option>
              ))}
            </select>
          )}
          <button className="readaloud-tts-btn" onClick={toggleTts} title={ttsOn ? '음성 끄기' : '음성 켜기'}>
            {ttsOn ? '🔊' : '🔇'}
          </button>
          <button className="projector-close" onClick={onClose}>✕ 닫기</button>
        </div>
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
