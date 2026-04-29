import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { containsProfanity } from '../utils/profanity';

export default function StudentWrite({ roomCode, myId, myName, onFinished }) {
  const [room, setRoom] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [profanityError, setProfanityError] = useState(false);

  const [spellResult, setSpellResult] = useState(null);
  const [spellChecking, setSpellChecking] = useState(false);
  const spellTimer = useRef(null);

  useEffect(() => {
    async function init() {
      const { data: r } = await supabase.from('rooms').select('*').eq('code', roomCode).single();
      if (r) { setRoom(r); if (r.status === 'finished') { onFinished(); return; } }
      const { data: s } = await supabase.from('sentences').select('*').eq('room_code', roomCode).order('order_index');
      setSentences(s || []);
    }
    init();

    const channel = supabase.channel('student-write-' + roomCode)
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

  function handleTextChange(e) {
    const val = e.target.value;
    setText(val);
    setProfanityError(false);
    setSpellResult(null);

    clearTimeout(spellTimer.current);
    if (val.trim().length > 2) {
      setSpellChecking(true);
      spellTimer.current = setTimeout(() => checkSpelling(val), 1500);
    } else {
      setSpellChecking(false);
    }
  }

  async function checkSpelling(val) {
    try {
      const res = await fetch(`/api/spellcheck?text=${encodeURIComponent(val)}`);
      const data = await res.json();
      const result = data?.message?.result;
      setSpellResult(result ?? null);
    } catch {
      setSpellResult(null);
    } finally {
      setSpellChecking(false);
    }
  }

  async function handleSubmit() {
    if (!text.trim() || submitting || !room) return;

    if (containsProfanity(text)) {
      setProfanityError(true);
      return;
    }

    setSubmitting(true);
    const orderIndex = sentences.length;
    const isLast = orderIndex + 1 >= room.max_sentences;

    try {
      await supabase.from('sentences').insert({
        room_code: roomCode,
        text: text.trim(),
        player_name: myName,
        order_index: orderIndex,
      });
      if (isLast) {
        await supabase.from('rooms').update({ status: 'finished' }).eq('code', roomCode);
      }
      setText('');
      setSpellResult(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (!room) return <div className="screen screen-center"><p className="muted">불러오는 중...</p></div>;

  const playerCount = room.player_order.length || 1;
  const currentIdx = sentences.length % playerCount;
  const currentPlayerId = room.player_order[currentIdx];
  const isMyTurn = currentPlayerId === myId;
  const currentPlayerName = room.player_names[currentPlayerId] || '';
  const recentSentences = sentences.slice(-3);
  const progress = sentences.length;
  const total = room.max_sentences;

  const spellErrors = spellResult?.result ?? [];
  const hasSpellErrors = spellErrors.length > 0;

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
      </div>

      {room.hint && progress === 0 && (
        <div className="hint-box">💡 글감: <em>{room.hint}</em></div>
      )}

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
        <div className="my-turn-box">
          <div className="my-turn-badge">✍️ 내 차례예요!</div>

          <textarea
            value={text}
            onChange={handleTextChange}
            placeholder="이야기를 이어가 볼까요?"
            maxLength={200}
            rows={3}
            autoFocus
          />
          <div className="char-count">{text.length} / 200자</div>

          {/* 맞춤법 검사 결과 */}
          {spellChecking && (
            <div className="spell-checking">맞춤법 확인 중...</div>
          )}
          {!spellChecking && spellResult !== null && (
            <div className={`spell-result ${hasSpellErrors ? 'spell-has-errors' : 'spell-ok'}`}>
              {hasSpellErrors ? (
                <>
                  <p className="spell-title">📝 맞춤법 확인</p>
                  {spellErrors.map((err, i) => (
                    <div key={i} className="spell-error-row">
                      <span className="spell-wrong">"{err.str_before}"</span>
                      <span className="spell-arrow"> → </span>
                      <span className="spell-correct">"{err.str_after}"</span>
                    </div>
                  ))}
                </>
              ) : (
                <p>✅ 맞춤법 이상 없어요!</p>
              )}
            </div>
          )}

          {profanityError && (
            <p className="error">부적절한 표현이 포함되어 있어요. 다시 작성해주세요.</p>
          )}

          <button
            className="btn btn-primary btn-large"
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
          >
            {submitting ? '제출 중...' : '제출하기'}
          </button>
        </div>
      ) : (
        <div className="waiting-turn-box">
          <div className="waiting-name-badge">{currentPlayerName}</div>
          <p>님이 쓰고 있어요...</p>
          <div className="waiting-dots">
            <span /><span /><span />
          </div>
        </div>
      )}
    </div>
  );
}
