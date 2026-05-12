import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

export default function TeacherWait({ roomCode, onStarted, onBack }) {
  const [players, setPlayers] = useState([]);
  const [roomData, setRoomData] = useState(null);
  const [starting, setStarting] = useState(false);
  const onStartedRef = useRef(onStarted);
  useEffect(() => { onStartedRef.current = onStarted; }, [onStarted]);

  useEffect(() => {
    let active = true;

    async function fetchAll() {
      const { data: room } = await supabase.from('rooms').select('*').eq('code', roomCode).single();
      if (!active) return;
      if (room) {
        setRoomData(room);
        if (room.status === 'playing') { onStartedRef.current(); return; }
      }
      const { data: pList } = await supabase.from('players').select('*').eq('room_code', roomCode);
      if (active) setPlayers(pList || []);
    }

    fetchAll();
    const poll = setInterval(fetchAll, 2000);

    const channel = supabase.channel('teacher-wait-' + roomCode)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` },
        ({ new: room }) => {
          if (!active) return;
          setRoomData(room);
          if (room.status === 'playing') onStartedRef.current();
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'players', filter: `room_code=eq.${roomCode}` },
        ({ new: player }) => { if (active) setPlayers(prev => [...prev, player]); }
      )
      .subscribe();

    return () => {
      active = false;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  async function handleStart() {
    if (players.length < 2 || starting) return;
    setStarting(true);

    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const playerOrder = shuffled.map(p => p.id);
    const playerNames = Object.fromEntries(shuffled.map(p => [p.id, p.name]));

    await supabase.from('rooms').update({
      status: 'playing',
      player_order: playerOrder,
      player_names: playerNames,
      turn_started_at: new Date().toISOString(),
    }).eq('code', roomCode);
  }

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← 처음으로</button>

      <div className="room-code-display">
        <p className="room-code-label">방 코드</p>
        <div className="room-code-big">{roomCode}</div>
        <p className="room-code-hint">칠판에 적어주거나 학생들에게 알려주세요</p>
      </div>

      {roomData && (
        <div className="card">
          <p>📚 <strong>{roomData.title}</strong></p>
          {roomData.hint && <p className="muted">글감: {roomData.hint}</p>}
          <p className="muted">최대 {roomData.max_sentences}문장</p>
          {roomData.class_code && (
            <div className="class-code-bar">
              <span className="class-code-bar-label">반 서재 코드</span>
              <span className="class-code-bar-value">{roomData.class_code}</span>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3 className="card-title">참가한 학생 ({players.length}명)</h3>
        {players.length === 0 ? (
          <p className="muted">아직 아무도 들어오지 않았어요...</p>
        ) : (
          <ul className="player-list">
            {players.map(p => (
              <li key={p.id} className="player-item">
                <span className="player-dot" />
                {p.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        className="btn btn-primary btn-large"
        onClick={handleStart}
        disabled={players.length < 2 || starting}
      >
        {players.length < 2 ? '학생이 2명 이상 필요해요' : starting ? '시작 중...' : `${players.length}명으로 시작하기`}
      </button>
    </div>
  );
}
