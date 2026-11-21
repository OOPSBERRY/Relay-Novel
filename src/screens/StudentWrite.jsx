import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { containsProfanity } from '../utils/profanity';
import { getTurnInfo, useTimeLeft, useAutoSkip, advanceTurn } from '../utils/turn';
import { notifyMyTurn, unlockAudio } from '../utils/turnAlert';

export default function StudentWrite({ roomCode, myId, myName, onFinished }) {
  const [room, setRoom] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [profanityError, setProfanityError] = useState(false);
  const [turnMissed, setTurnMissed] = useState(false);
  const [submitError, setSubmitError] = useState(false);

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

    const channel = supabase.channel('student-write-' + roomCode)
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

  function handleTextChange(e) {
    setText(e.target.value);
    setProfanityError(false);
    setTurnMissed(false);
    setSubmitError(false);
  }

  // 시간 초과 → 자동 패스. 내 차례면 3초 뒤, 다른 학생 화면은 혹시 몰라 6초 뒤 대신 넘겨준다.
  // (여러 화면이 동시에 시도해도 advanceTurn이 한 번만 넘김)
  const turnInfo = room ? getTurnInfo(room, sentences) : null;
  useAutoSkip(roomCode, room, timeLeft, turnInfo ? (turnInfo.currentId === myId ? 3000 : 6000) : null);

  // 내 차례가 되면 알림 (진동 + 소리), 내 차례인 동안 탭 제목도 바꿔 둔다
  const myTurnNow = !!turnInfo && room?.status === 'playing' && turnInfo.currentId === myId;
  const wasMyTurn = useRef(false);
  useEffect(() => {
    if (myTurnNow && !wasMyTurn.current) notifyMyTurn();
    wasMyTurn.current = myTurnNow;
  }, [myTurnNow]);
  useEffect(() => {
    if (!myTurnNow) return;
    const original = document.title;
    let on = true;
    document.title = '✍️ 내 차례예요! · 릴레이 서재';
    // 다른 탭을 보고 있어도 눈에 띄도록 제목을 깜빡인다
    const id = setInterval(() => {
      on = !on;
      document.title = on ? '✍️ 내 차례예요! · 릴레이 서재' : original;
    }, 1000);
    return () => { clearInterval(id); document.title = original; };
  }, [myTurnNow]);
  // 화면을 한 번이라도 누르면 소리 알림을 쓸 수 있게 깨워 둔다
  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    return () => window.removeEventListener('pointerdown', unlockAudio);
  }, []);

  async function handleSubmit() {
    if (!text.trim() || submitting || !room) return;
    if (containsProfanity(text)) { setProfanityError(true); return; }
    setSubmitting(true);
    setTurnMissed(false);
    try {
      const result = await advanceTurn(roomCode, room.turn_started_at, {
        type: 'submit', playerId: myId, playerName: myName, text: text.trim(),
      });
      if (result.ok) {
        setText('');
      } else if (result.reason === 'turn-changed' || result.reason === 'not-playing') {
        setTurnMissed(true);
      } else {
        setSubmitError(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!room) return <div className="screen screen-center"><p className="muted">불러오는 중...</p></div>;

  const { playerCount, currentIdx, currentId: currentPlayerId, currentName: currentPlayerName, progress, total } = turnInfo;
  const isMyTurn = currentPlayerId === myId;
  const recentSentences = sentences.filter(s => !s.skipped).slice(-3);
  const isTimeUp = timeLeft !== null && timeLeft <= 0;
  const isWarning = timeLeft !== null && timeLeft <= 30 && timeLeft > 0;

  return (
    <div className="screen write-screen">
      <div className="write-header">
        <h2 className="write-title">{room.title}</h2>
        <div className="write-progress">
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: `${(progress / total) * 100}%` }} />
          </div>
          <span className="progress-text">{progress} / {total}</span>
        </div>
        <div className="my-group-row">
          {room.player_order.map((id, i) => {
            const name = room.player_names[id];
            const isMe = id === myId;
            const isCurrent = i === currentIdx;
            return (
              <span key={id} className={`my-group-chip ${isMe ? 'my-group-me' : ''} ${isCurrent ? 'my-group-current' : ''}`}>
                {isMe ? '나' : name}
              </span>
            );
          })}
        </div>
      </div>

      <div className="recent-story">
        {recentSentences.length === 0 ? (
          <p className="empty-story">첫 번째 문장을 기다리고 있어요...</p>
        ) : (
          recentSentences.map((s, i) => (
            <div key={s.id} className={`story-sentence ${i === recentSentences.length - 1 ? 'story-sentence-latest' : ''}`}>
              <p className="story-text">{s.text}</p>
              <p className="story-author">— {s.player_name}</p>
            </div>
          ))
        )}
      </div>

      {isMyTurn ? (
        <div className={`my-turn-box ${isWarning ? 'turn-warning' : ''} ${isTimeUp ? 'turn-expired' : ''}`}>
          <div className="my-turn-top">
            <div className="my-turn-badge">내 차례예요</div>
            {timeLeft !== null && (
              <div className={`turn-timer ${isWarning ? 'timer-warning' : ''} ${isTimeUp ? 'timer-expired' : ''}`}>
                {isTimeUp ? '시간 초과' : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
              </div>
            )}
          </div>

          {isTimeUp ? (
            <div className="time-up-msg">시간이 다 되었어요. 곧 다음 사람에게 넘어갑니다.</div>
          ) : (
            <>
              <textarea value={text} onChange={handleTextChange} placeholder="이야기를 이어가 볼까요?" maxLength={120} rows={3} autoFocus />
              <span className="char-count">{text.length} / 120자</span>

              {submitError && <p className="error">제출하지 못했어요. 다시 눌러 주세요.</p>}
              {turnMissed && <p className="error">시간이 지나 차례가 넘어갔어요. 쓴 글은 그대로 남아 있어요.</p>}
              {profanityError && <p className="error">부적절한 표현이 포함되어 있어요. 다시 작성해주세요.</p>}

              <button className="btn btn-primary btn-large" onClick={handleSubmit} disabled={!text.trim() || submitting}>
                {submitting ? '제출 중...' : '제출하기'}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="waiting-turn-box">
          <div className="waiting-name-badge">{currentPlayerName}</div>
          <p>님이 쓰고 있어요...</p>
          {timeLeft !== null && (
            <div className={`turn-timer ${isWarning ? 'timer-warning' : ''} ${isTimeUp ? 'timer-expired' : ''}`}>
              {isTimeUp ? '시간 초과' : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
            </div>
          )}
          <div className="waiting-dots"><span /><span /><span /></div>
          {(() => {
            const myIdx = room.player_order.indexOf(myId);
            const gap = (myIdx - currentIdx + playerCount) % playerCount;
            if (gap === 0) return null;
            return (
              <p className="waiting-turn-hint">
                내 차례까지 <strong>{gap}명</strong> 남았어요
              </p>
            );
          })()}
        </div>
      )}
    </div>
  );
}
