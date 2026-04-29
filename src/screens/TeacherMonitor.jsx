import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function TeacherMonitor({ roomCode, onFinished, onBack }) {
  const [room, setRoom] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: r } = await supabase.from('rooms').select('*').eq('code', roomCode).single();
      if (r) { setRoom(r); if (r.status === 'finished') { onFinished(); return; } }
      const { data: s } = await supabase.from('sentences').select('*').eq('room_code', roomCode).order('order_index');
      setSentences(s || []);
    }
    init();

    const channel = supabase.channel('teacher-monitor-' + roomCode)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` },
        ({ new: r }) => { setRoom(r); if (r.status === 'finished') onFinished(); }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sentences', filter: `room_code=eq.${roomCode}` },
        ({ new: s }) => setSentences(prev => [...prev, s].sort((a, b) => a.order_index - b.order_index))
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [roomCode, onFinished]);

  async function handleForceEnd() {
    if (!window.confirm('소설을 지금 끝낼까요?')) return;
    setEnding(true);
    await supabase.from('rooms').update({ status: 'finished' }).eq('code', roomCode);
  }

  if (!room) return <div className="screen screen-center"><p className="muted">불러오는 중...</p></div>;

  const playerCount = room.player_order.length || 1;
  const currentIdx = sentences.length % playerCount;
  const currentId = room.player_order[currentIdx];
  const currentName = room.player_names[currentId] || '';
  const progress = sentences.length;
  const total = room.max_sentences;

  return (
    <div className="screen monitor-screen">
      <div className="monitor-header">
        <div>
          <h2 className="monitor-title">{room.title}</h2>
          <p className="muted">방 코드: {roomCode}</p>
        </div>
        <div className="monitor-actions">
          <button className="btn btn-danger btn-sm" onClick={handleForceEnd} disabled={ending}>
            이야기 끝내기
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>처음으로</button>
        </div>
      </div>

      <div className="monitor-grid">
        <div className="card progress-card">
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: `${(progress / total) * 100}%` }} />
          </div>
          <p className="progress-text">
            <strong>{progress}</strong> / {total} 문장
            {currentName && (
              <span className="current-writer"> · 지금 쓰는 중: <strong>{currentName}</strong> ✍️</span>
            )}
          </p>
        </div>

        <div className="card story-card">
          <h3 className="card-title">지금까지의 이야기</h3>
          {progress === 0 ? (
            <p className="muted">아직 작성된 문장이 없어요...</p>
          ) : (
            <div className="sentence-list">
              {sentences.map((s, i) => (
                <div key={s.id} className={`sentence-row ${i === progress - 1 ? 'sentence-latest' : ''}`}>
                  <span className="sentence-num">{i + 1}</span>
                  <span className="sentence-body">{s.text}</span>
                  <span className="sentence-who">{s.player_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card order-card">
          <h3 className="card-title">순서</h3>
          <div className="order-list">
            {room.player_order.map((id, i) => {
              const isCurrent = i === currentIdx;
              const writeCount = sentences.filter(s => s.player_name === room.player_names[id]).length;
              return (
                <div key={id} className={`order-item ${isCurrent ? 'order-current' : ''}`}>
                  <span className="order-num">{i + 1}</span>
                  <span className="order-name">{room.player_names[id]}</span>
                  <span className="order-count">{writeCount}문장</span>
                  {isCurrent && <span className="order-badge">✍️</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
