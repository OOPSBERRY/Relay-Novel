import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { getTurnInfo, useTimeLeft, advanceTurn } from '../utils/turn';

export default function TeacherMonitor({ roomCode, onFinished, onBack }) {
  const [room, setRoom] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [ending, setEnding] = useState(false);
  const [autoSkipCount, setAutoSkipCount] = useState(null);
  const skipping = useRef(false);
  const onFinishedRef = useRef(onFinished);
  useEffect(() => { onFinishedRef.current = onFinished; }, [onFinished]);

  useEffect(() => {
    let active = true;

    async function fetchAll() {
      const { data: r } = await supabase.from('rooms').select('*').eq('code', roomCode).single();
      if (!active) return;
      if (r) {
        setRoom(r);
        if (r.status === 'finished') { onFinishedRef.current(); return; }
      }
      const { data: s } = await supabase.from('sentences').select('*').eq('room_code', roomCode).order('order_index');
      if (active) setSentences(s || []);
    }

    fetchAll();
    const poll = setInterval(fetchAll, 2000);

    const channel = supabase.channel('teacher-monitor-' + roomCode)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` },
        ({ new: r }) => {
          if (!active) return;
          setRoom(r);
          if (r.status === 'finished') onFinishedRef.current();
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sentences', filter: `room_code=eq.${roomCode}` },
        ({ new: s }) => {
          if (active) setSentences(prev => prev.some(p => p.id === s.id) ? prev : [...prev, s].sort((a, b) => a.order_index - b.order_index));
        }
      )
      .subscribe();

    return () => {
      active = false;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  const timeLeft = useTimeLeft(room);
  const turnInfo = room ? getTurnInfo(room, sentences) : null;

  // 시간 초과 → 3초 카운트다운 후 자동 패스 (학생 화면과 동시에 시도해도 한 번만 넘어감)
  const expired = timeLeft === 0 && room?.status === 'playing';
  useEffect(() => {
    if (!expired) { setAutoSkipCount(null); return; }
    let count = 3;
    setAutoSkipCount(count);
    const id = setInterval(() => {
      count -= 1;
      setAutoSkipCount(Math.max(0, count));
      if (count <= 0) {
        clearInterval(id);
        handleSkip();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expired, room?.turn_started_at]);

  async function handleForceEnd() {
    if (!window.confirm('소설을 지금 끝낼까요?')) return;
    setEnding(true);
    await supabase.from('rooms').update({ status: 'finished' }).eq('code', roomCode);
  }

  async function handleSkip({ force = false } = {}) {
    if (!room || skipping.current) return;
    skipping.current = true;
    setAutoSkipCount(null);
    await advanceTurn(roomCode, room.turn_started_at, { type: 'skip', force });
    skipping.current = false;
  }

  // 자리를 비운 학생 등: 시간과 상관없이 교사가 차례를 넘긴다
  function handleManualSkip() {
    const name = room ? getTurnInfo(room, sentences).currentName : '';
    if (!window.confirm(`${name} 학생의 차례를 패스하고 다음 사람으로 넘길까요?`)) return;
    handleSkip({ force: true });
  }

  if (!room) return <div className="screen screen-center"><p className="muted">불러오는 중...</p></div>;

  const { currentIdx, currentName, progress, total } = turnInfo;
  const isTimeUp = timeLeft !== null && timeLeft <= 0;
  const isWarning = timeLeft !== null && timeLeft <= 30 && timeLeft > 0;

  return (
    <div className="screen monitor-screen">
      <div className="monitor-header">
        <div>
          <h2 className="monitor-title">{room.title}</h2>
          <div className="monitor-codes">
            <span className="muted">방 코드: <strong>{roomCode}</strong></span>
            {room.class_code && (
              <span className="class-code-bar">
                <span className="class-code-bar-label">반 서재 코드</span>
                <span className="class-code-bar-value">{room.class_code}</span>
              </span>
            )}
          </div>
        </div>
        <div className="monitor-actions">
          {isTimeUp ? (
            <div className="auto-skip-wrap">
              {autoSkipCount !== null && (
                <span className="auto-skip-count">{autoSkipCount}초 후 자동 패스</span>
              )}
              <button className="btn btn-primary btn-sm" onClick={() => handleSkip()}>
                지금 넘기기
              </button>
            </div>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={handleManualSkip}>
              차례 넘기기
            </button>
          )}
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
          <div className="progress-row">
            <p className="progress-text">
              <strong>{progress}</strong> / {total} 문장
              {currentName && <span className="current-writer"> · 지금 <strong>{currentName}</strong></span>}
            </p>
            {timeLeft !== null && (
              <div className={`monitor-timer ${isWarning ? 'timer-warning' : ''} ${isTimeUp ? 'timer-expired' : ''}`}>
                {isTimeUp
                  ? `${currentName} 시간 초과`
                  : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
              </div>
            )}
          </div>
        </div>

        <div className="card story-card">
          <h3 className="card-title">지금까지의 이야기</h3>
          {progress === 0 ? (
            <p className="muted">아직 작성된 문장이 없어요...</p>
          ) : (
            <div className="sentence-list">
              {sentences.map((s, i) => (
                <div key={s.id} className={`sentence-row ${s.skipped ? 'sentence-skipped' : ''} ${i === sentences.length - 1 ? 'sentence-latest' : ''}`}>
                  <span className="sentence-num">{i + 1}</span>
                  <span className="sentence-body">{s.skipped ? '(패스)' : s.text}</span>
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
              const writeCount = sentences.filter(s => s.player_name === room.player_names[id] && !s.skipped).length;
              return (
                <div key={id} className={`order-item ${isCurrent ? 'order-current' : ''} ${isCurrent && isTimeUp ? 'order-expired' : ''}`}>
                  <span className="order-num">{i + 1}</span>
                  <span className="order-name">{room.player_names[id]}</span>
                  <span className="order-count">{writeCount}문장</span>
                  {isCurrent && <span className="order-badge">{isTimeUp ? '시간 초과' : '쓰는 중'}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
