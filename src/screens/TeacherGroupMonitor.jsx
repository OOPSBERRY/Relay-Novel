import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import ReadAloudMode from './ReadAloudMode';

function GroupCard({ groupIndex, roomCode, onReadAloud, onViewStory }) {
  const [room, setRoom] = useState(null);
  const [sentences, setSentences] = useState([]);

  useEffect(() => {
    let active = true;

    async function fetchData() {
      const { data: r } = await supabase.from('rooms').select('*').eq('code', roomCode).single();
      if (!active) return;
      if (r) setRoom(r);

      const { data: s } = await supabase
        .from('sentences').select('*')
        .eq('room_code', roomCode).eq('skipped', false)
        .order('order_index');
      if (active) setSentences(s || []);
    }

    fetchData();
    const poll = setInterval(fetchData, 3000);

    const channel = supabase.channel(`group-card-${roomCode}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` },
        ({ new: r }) => { if (active) setRoom(r); }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sentences', filter: `room_code=eq.${roomCode}` },
        ({ new: s }) => {
          if (active && !s.skipped)
            setSentences(prev => [...prev, s].sort((a, b) => a.order_index - b.order_index));
        }
      )
      .subscribe();

    return () => {
      active = false;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  if (!room) {
    return (
      <div className="group-card group-card-loading">
        <p className="muted">{groupIndex}모둠 불러오는 중...</p>
      </div>
    );
  }

  const isFinished = room.status === 'finished';
  const hasFirstSentence = !!(room.hint && room.hint.trim());
  const hintOffset = hasFirstSentence ? 1 : 0;
  const playerCount = (room.player_order || []).length;
  const sentenceCount = sentences.length;
  const currentIdx = (sentenceCount - hintOffset) % (playerCount || 1);
  const currentId = (room.player_order || [])[Math.max(0, currentIdx)];
  const currentName = currentId ? (room.player_names || {})[currentId] : '';
  const progress = sentenceCount - hintOffset;
  const total = room.max_sentences - hintOffset;
  const pct = Math.min(100, Math.round((progress / total) * 100));
  const players = Object.values(room.player_names || {});
  const recentSentences = sentences.slice(-3);

  return (
    <div className={`group-card ${isFinished ? 'group-card-finished' : ''}`}>
      <div className="group-card-header">
        <span className="group-card-num">{groupIndex}모둠</span>
        {isFinished && <span className="group-card-done-badge">완료 ✅</span>}
      </div>

      <div className="group-card-players">
        {players.map((name, i) => (
          <span key={i} className={`group-player-chip ${!isFinished && i === currentIdx ? 'group-player-active' : ''}`}>
            {name}
            {!isFinished && i === currentIdx && ' ✍️'}
          </span>
        ))}
      </div>

      <div className="group-progress-wrap">
        <div className="group-progress-bar">
          <div className="group-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="group-progress-text">{progress} / {total}</span>
      </div>

      {recentSentences.length > 0 && (
        <div className="group-sentences">
          {recentSentences.map((s, i) => (
            <div key={s.id} className={`group-sentence-row ${i === recentSentences.length - 1 ? 'group-sentence-latest' : ''}`}>
              <span className="group-sentence-author">{s.player_name}</span>
              <span className="group-sentence-text">{s.text}</span>
            </div>
          ))}
        </div>
      )}

      {isFinished ? (
        <div className="group-card-actions">
          <button className="btn btn-readaloud btn-sm" onClick={() => onReadAloud(roomCode, room.title)}>
            📖 낭독 모드
          </button>
          <button className="btn btn-print btn-sm" onClick={() => onViewStory(roomCode)}>
            🖨️ 인쇄 / 저장
          </button>
        </div>
      ) : (
        <p className="group-current-writer">
          {currentName ? `✍️ ${currentName} 쓰는 중` : '대기 중'}
        </p>
      )}
    </div>
  );
}

export default function TeacherGroupMonitor({ parentRoomCode, groupRoomCodes, onViewStory, onBack }) {
  const [endingAll, setEndingAll] = useState(false);
  const [readAloud, setReadAloud] = useState(null); // { title, sentences }

  async function handleReadAloud(roomCode, title) {
    const { data: s } = await supabase
      .from('sentences').select('*').eq('room_code', roomCode).eq('skipped', false).order('order_index');
    setReadAloud({ title, sentences: s || [] });
  }

  async function handleEndAll() {
    if (!window.confirm('모든 모둠의 소설을 지금 끝낼까요?')) return;
    setEndingAll(true);
    for (const code of groupRoomCodes) {
      await supabase.from('rooms').update({ status: 'finished' }).eq('code', code).neq('status', 'finished');
    }
    setEndingAll(false);
  }

  return (
    <>
      {readAloud && (
        <ReadAloudMode
          sentences={readAloud.sentences}
          title={readAloud.title}
          onClose={() => setReadAloud(null)}
        />
      )}

      <div className="screen group-monitor-screen">
        <div className="monitor-header">
          <div>
            <h2 className="monitor-title">모둠 릴레이 소설</h2>
            <p className="muted">{groupRoomCodes.length}개 모둠 동시 진행 중</p>
          </div>
          <div className="monitor-actions">
            <button className="btn btn-danger btn-sm" onClick={handleEndAll} disabled={endingAll}>
              모두 끝내기
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onBack}>처음으로</button>
          </div>
        </div>

        <div className="group-grid">
          {groupRoomCodes.map((code, i) => (
            <GroupCard
              key={code}
              groupIndex={i + 1}
              roomCode={code}
              onReadAloud={handleReadAloud}
              onViewStory={onViewStory}
            />
          ))}
        </div>
      </div>
    </>
  );
}
