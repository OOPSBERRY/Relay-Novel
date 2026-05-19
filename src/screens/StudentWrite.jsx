import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { containsProfanity } from '../utils/profanity';

export default function StudentWrite({ roomCode, myId, myName, onFinished }) {
  const [room, setRoom] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [profanityError, setProfanityError] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [spellResult, setSpellResult] = useState(null);
  const [spellChecking, setSpellChecking] = useState(false);

  const onFinishedRef = useRef(onFinished);
  useEffect(() => { onFinishedRef.current = onFinished; }, [onFinished]);
  const timerInterval = useRef(null);

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
          if (active) setSentences(prev => [...prev, s].sort((a, b) => a.order_index - b.order_index));
        }
      )
      .subscribe();

    return () => {
      active = false;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  // 타이머
  useEffect(() => {
    clearInterval(timerInterval.current);
    if (!room?.turn_time_limit || !room?.turn_started_at) { setTimeLeft(null); return; }

    function tick() {
      const elapsed = (Date.now() - new Date(room.turn_started_at).getTime()) / 1000;
      setTimeLeft(Math.max(0, Math.ceil(room.turn_time_limit - elapsed)));
    }
    tick();
    timerInterval.current = setInterval(tick, 500);
    return () => clearInterval(timerInterval.current);
  }, [room?.turn_started_at, room?.turn_time_limit]);

  function handleTextChange(e) {
    setText(e.target.value);
    setProfanityError(false);
    setSpellResult(null);
  }

  async function handleSpellCheck() {
    if (!text.trim() || spellChecking) return;
    setSpellChecking(true);
    setSpellResult(null);
    try {
      const res = await fetch(`/api/spellcheck?text=${encodeURIComponent(text.trim())}`);
      const data = await res.json();
      if (data?.error || !data?.message?.result) {
        setSpellResult({ error: true });
      } else {
        setSpellResult(data.message.result);
      }
    } catch {
      setSpellResult({ error: true });
    } finally {
      setSpellChecking(false);
    }
  }

  function handleFixOne(err) {
    setText(prev => prev.replace(err.str_before, err.str_after));
    setSpellResult(prev => prev ? { ...prev, result: (prev.result || []).filter(e => e !== err) } : null);
  }

  function handleFixAll() {
    let fixed = text;
    for (const err of spellErrors) {
      fixed = fixed.replace(err.str_before, err.str_after);
    }
    setText(fixed);
    setSpellResult(null);
  }

  // 내 차례에 시간 초과 → 3초 후 자동 패스
  useEffect(() => {
    if (!room || timeLeft === null || timeLeft > 0) return;
    const allSents = sentences.filter(s => !s.skipped);
    const hasFirst = !!(room.hint?.trim());
    const hintOffset = hasFirst ? 1 : 0;
    const playerCount = room.player_order?.length || 1;
    const currentIdx = (allSents.length - hintOffset) % playerCount;
    const currentPlayerId = room.player_order?.[Math.max(0, currentIdx)];
    if (currentPlayerId !== myId) return;

    const timer = setTimeout(async () => {
      const orderIndex = sentences.length;
      const { data: existing } = await supabase
        .from('sentences').select('id').eq('room_code', roomCode).eq('order_index', orderIndex).maybeSingle();
      if (existing) return;
      const isLast = orderIndex + 1 >= room.max_sentences;
      await supabase.from('sentences').insert({
        room_code: roomCode, text: '(패스)', player_name: myName,
        order_index: orderIndex, skipped: true,
      });
      await supabase.from('rooms').update({
        turn_started_at: new Date().toISOString(),
        ...(isLast ? { status: 'finished' } : {}),
      }).eq('code', roomCode);
    }, 3000);
    return () => clearTimeout(timer);
  }, [timeLeft, room?.turn_started_at]);

  async function handleSubmit() {
    if (!text.trim() || submitting || !room) return;
    if (containsProfanity(text)) { setProfanityError(true); return; }
    setSubmitting(true);

    const orderIndex = sentences.length;
    const isLast = orderIndex + 1 >= room.max_sentences;

    try {
      await supabase.from('sentences').insert({
        room_code: roomCode,
        text: text.trim(),
        player_name: myName,
        order_index: orderIndex,
        skipped: false,
      });
      await supabase.from('rooms').update({
        turn_started_at: new Date().toISOString(),
        ...(isLast ? { status: 'finished' } : {}),
      }).eq('code', roomCode);
      setText('');
      setSpellResult(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (!room) return <div className="screen screen-center"><p className="muted">불러오는 중...</p></div>;

  const hasFirstSentence = !!(room.hint && room.hint.trim());
  const hintOffset = hasFirstSentence ? 1 : 0;
  const playerCount = room.player_order.length || 1;
  const allSentences = sentences.filter(s => !s.skipped);
  const currentIdx = (allSentences.length - hintOffset) % playerCount;
  const currentPlayerId = room.player_order[Math.max(0, currentIdx)];
  const isMyTurn = currentPlayerId === myId;
  const currentPlayerName = room.player_names[currentPlayerId] || '';
  const recentSentences = allSentences.slice(-3);
  const progress = allSentences.length - hintOffset;
  const total = room.max_sentences - hintOffset;
  const isTimeUp = timeLeft !== null && timeLeft <= 0;
  const isWarning = timeLeft !== null && timeLeft <= 30 && timeLeft > 0;
  const spellErrors = spellResult?.result ?? [];

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
                {isCurrent && ' ✍️'}
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
              <p className="story-text">"{s.text}"</p>
              <p className="story-author">— {s.player_name}</p>
            </div>
          ))
        )}
      </div>

      {isMyTurn ? (
        <div className={`my-turn-box ${isWarning ? 'turn-warning' : ''} ${isTimeUp ? 'turn-expired' : ''}`}>
          <div className="my-turn-top">
            <div className="my-turn-badge">✍️ 내 차례예요!</div>
            {timeLeft !== null && (
              <div className={`turn-timer ${isWarning ? 'timer-warning' : ''} ${isTimeUp ? 'timer-expired' : ''}`}>
                {isTimeUp ? '⏰ 시간 초과!' : `⏱ ${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
              </div>
            )}
          </div>

          {isTimeUp ? (
            <div className="time-up-msg">⏰ 시간이 초과되었어요. 자동으로 다음 사람에게 넘어갑니다...</div>
          ) : (
            <>
              <textarea value={text} onChange={handleTextChange} placeholder="이야기를 이어가 볼까요?" maxLength={120} rows={3} autoFocus />
              <div className="spell-action-row">
                <span className="char-count">{text.length} / 120자</span>
                <button
                  className="btn-spell-check"
                  onClick={handleSpellCheck}
                  disabled={!text.trim() || spellChecking}
                >
                  {spellChecking ? '검사 중...' : '맞춤법 검사'}
                </button>
              </div>

              {spellResult !== null && (
                <div className={`spell-panel ${spellResult.error || spellErrors.length > 0 ? 'spell-has-errors' : 'spell-ok'}`}>
                  {spellResult.error ? (
                    <p className="spell-panel-msg">맞춤법 검사 중 오류가 발생했어요.</p>
                  ) : spellErrors.length === 0 ? (
                    <p className="spell-panel-msg">✅ 맞춤법 이상 없어요!</p>
                  ) : (
                    <>
                      <div className="spell-panel-header">
                        <span>총 <strong>{spellErrors.length}개</strong> 수정 제안</span>
                        <button className="btn-spell-fix-all" onClick={handleFixAll}>모두 수정</button>
                      </div>
                      {spellErrors.map((err, i) => (
                        <div key={i} className="spell-error-item">
                          <div className="spell-error-words">
                            <span className="spell-wrong">{err.str_before}</span>
                            <span className="spell-arrow">→</span>
                            <span className="spell-correct">{err.str_after}</span>
                            <span className="spell-type-badge">
                              {err.error_idx === 1 ? '맞춤법' : err.error_idx === 2 ? '띄어쓰기' : '교정'}
                            </span>
                          </div>
                          <button className="btn-spell-fix" onClick={() => handleFixOne(err)}>수정</button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

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
              {isTimeUp ? '⏰ 시간 초과!' : `⏱ ${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
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
