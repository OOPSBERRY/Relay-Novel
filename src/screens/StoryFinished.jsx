import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function StoryFinished({ roomCode, isTeacher, onHome }) {
  const [room, setRoom] = useState(null);
  const [sentences, setSentences] = useState([]);

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

  function handlePrint() {
    window.print();
  }

  if (!room) return <div className="screen screen-center"><p className="muted">불러오는 중...</p></div>;

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="screen finished-screen">
      {/* 화면용 헤더 (인쇄 시 숨김) */}
      <div className="finished-header no-print">
        <div className="finished-confetti">🎉</div>
        <h2>소설 완성!</h2>
        <p className="muted">{sentences.length}개의 문장으로 완성된 우리들의 이야기</p>
        <div className="finished-actions">
          <button className="btn btn-print" onClick={handlePrint}>
            🖨️ PDF로 저장 / 인쇄
          </button>
          <button className="btn btn-ghost" onClick={onHome}>
            처음으로
          </button>
        </div>
      </div>

      {/* 인쇄 영역 */}
      <div className="printable">
        {/* 표지 */}
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

        {/* 본문 */}
        <div className="print-story">
          <h2 className="print-story-title">{room.title}</h2>
          <div className="print-sentences">
            {sentences.map((s) => (
              <p key={s.id} className="print-sentence">{s.text}</p>
            ))}
          </div>
        </div>

        {/* 마지막 페이지 푸터 */}
        <div className="print-footer">
          <p>이 소설은 {room.player_order.length}명의 학생이 함께 완성했습니다.</p>
          <p>{today} · 릴레이 서재</p>
        </div>
      </div>

      {/* 화면에서 미리보기 (인쇄 시 숨김) */}
      <div className="story-preview no-print">
        <h3>이야기 미리보기</h3>
        <div className="preview-text">
          {sentences.map((s) => (
            <p key={s.id}>{s.text}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
