import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const COVER_GRADIENTS = [
  ['#667EEA', '#764BA2'], ['#F093FB', '#F5576C'],
  ['#4FACFE', '#00F2FE'], ['#43E97B', '#38F9D7'],
  ['#FA709A', '#FEE140'], ['#A18CD1', '#FBC2EB'],
  ['#FCCB90', '#D57EEB'], ['#96FBC4', '#F9F586'],
  ['#FBC2EB', '#A6C1EE'], ['#FDDB92', '#D1FDFF'],
];

function getCoverStyle(code) {
  const hash = code.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const [a, b] = COVER_GRADIENTS[hash % COVER_GRADIENTS.length];
  return { background: `linear-gradient(145deg, ${a}, ${b})` };
}

export default function StoryReader({ roomCode, onBack }) {
  const [room, setRoom] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: r }, { data: s }] = await Promise.all([
        supabase.from('rooms').select('*').eq('code', roomCode).single(),
        supabase.from('sentences').select('*').eq('room_code', roomCode).order('order_index'),
      ]);
      if (r) setRoom(r);
      setSentences(s || []);
      setLoading(false);
    }
    load();
  }, [roomCode]);

  function handlePrint() { window.print(); }

  if (loading) return <div className="screen screen-center"><p className="muted">불러오는 중...</p></div>;
  if (!room) return <div className="screen screen-center"><p className="error">이야기를 찾을 수 없어요.</p></div>;

  const today = new Date(room.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="screen reader-screen">
      {/* 화면용 */}
      <div className="no-print">
        <div className="reader-hero" style={getCoverStyle(roomCode)}>
          <button className="reader-back-btn" onClick={onBack}>← 서재로</button>
          <div className="reader-hero-content">
            <h1 className="reader-title">{room.title}</h1>
            <p className="reader-date">{today}</p>
            <div className="reader-authors">
              {room.player_order?.map(id => (
                <span key={id} className="reader-author-chip">{room.player_names[id]}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="reader-body">
          {sentences.map((s, i) => (
            <p key={s.id} className="reader-sentence">{s.text}</p>
          ))}
        </div>

        <div className="reader-footer-bar no-print">
          <button className="btn btn-print" onClick={handlePrint}>🖨️ 인쇄 / PDF</button>
        </div>
      </div>

      {/* 인쇄 영역 */}
      <div className="printable">
        <div className="print-cover">
          <div className="cover-book-icon">📖</div>
          <h1 className="cover-title">{room.title}</h1>
          <div className="cover-divider">— — —</div>
          <p className="cover-subtitle">우리가 함께 만든 릴레이 서재</p>
          <div className="cover-authors">
            {room.player_order?.map(id => (
              <span key={id} className="cover-author">{room.player_names[id]}</span>
            ))}
          </div>
          <p className="cover-date">{today}</p>
        </div>
        <div className="print-story">
          <h2 className="print-story-title">{room.title}</h2>
          <div className="print-sentences">
            {sentences.map(s => (
              <p key={s.id} className="print-sentence">{s.text}</p>
            ))}
          </div>
        </div>
        <div className="print-footer">
          <p>{today} · 릴레이 서재</p>
        </div>
      </div>
    </div>
  );
}
