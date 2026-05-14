import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { supabase } from '../supabase';
import ReadAloudMode from './ReadAloudMode';

export default function StoryFinished({ roomCode, isTeacher, onHome }) {
  const [room, setRoom] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [readAloud, setReadAloud] = useState(false);

  useEffect(() => {
    confetti({ particleCount: 80, spread: 70, origin: { x: 0.2, y: 0.6 }, colors: ['#8B4FE8', '#FFE033', '#F093FB', '#4FACFE', '#43E97B'] });
    setTimeout(() => confetti({ particleCount: 80, spread: 70, origin: { x: 0.8, y: 0.6 }, colors: ['#8B4FE8', '#FFE033', '#F093FB', '#4FACFE', '#43E97B'] }), 300);
    setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { x: 0.5, y: 0.4 }, colors: ['#8B4FE8', '#FFE033', '#F093FB'] }), 700);
  }, []);

  useEffect(() => {
    async function load() {
      const { data: r } = await supabase.from('rooms').select('*').eq('code', roomCode).single();
      if (r) setRoom(r);
      const { data: s } = await supabase
        .from('sentences').select('*').eq('room_code', roomCode).eq('skipped', false).order('order_index');
      setSentences(s || []);
    }
    load();
  }, [roomCode]);

  function handlePrint() { window.print(); }

  if (!room) return <div className="screen screen-center"><p className="muted">불러오는 중...</p></div>;

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      {readAloud && (
        <ReadAloudMode sentences={sentences} title={room.title} onClose={() => setReadAloud(false)} />
      )}

      <div className="screen finished-screen">
        <div className="finished-header no-print">
          <div className="finished-confetti">🎉</div>
          <h2>소설 완성!</h2>
          <p className="muted">{sentences.length}개의 문장으로 완성된 우리들의 이야기</p>
          <div className="finished-actions">
            {isTeacher && (
              <button className="btn btn-readaloud" onClick={() => setReadAloud(true)}>
                📖 낭독 모드
              </button>
            )}
            <button className="btn btn-print" onClick={handlePrint}>
              🖨️ PDF로 저장 / 인쇄
            </button>
            <button className="btn btn-ghost" onClick={onHome}>
              처음으로
            </button>
          </div>
        </div>

        <div className="printable">
          <div className="print-cover">
            <div className="cover-book-icon">📖</div>
            <h1 className="cover-title">{room.title}</h1>
            <div className="cover-divider">— — —</div>
            <p className="cover-subtitle">우리가 함께 만든 릴레이 서재</p>
            <div className="cover-authors">
              {room.player_order.map(id => (
                <span key={id} className="cover-author">{room.player_names[id]}</span>
              ))}
            </div>
            <p className="cover-date">{today}</p>
          </div>
          <div className="print-story">
            <h2 className="print-story-title">{room.title}</h2>
            <div className="print-sentences">
              {sentences.map(s => <p key={s.id} className="print-sentence">{s.text}</p>)}
            </div>
          </div>
          <div className="print-footer">
            <p>이 소설은 {room.player_order.length}명의 학생이 함께 완성했습니다.</p>
            <p>{today} · 릴레이 서재</p>
          </div>
        </div>

        <div className="story-preview no-print">
          <h3>이야기 미리보기</h3>
          <div className="preview-text">
            {sentences.map(s => <p key={s.id}>{s.text}</p>)}
          </div>
        </div>
      </div>
    </>
  );
}
