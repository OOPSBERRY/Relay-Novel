import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import ReadAloudMode from './ReadAloudMode';
import ProjectorMode from './ProjectorMode';
import { getTurnInfo, useTimeLeft, useAutoSkip, advanceTurn } from '../utils/turn';
import { api } from '../api';

function GroupCard({ groupIndex, roomCode, teacherPassword, onReadAloud, onViewStory }) {
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
        .eq('room_code', roomCode)
        .order('order_index');
      if (active) setSentences(s || []);
    }

    fetchData();
    const poll = setInterval(fetchData, 1500);

    const channel = supabase.channel(`group-card-${roomCode}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` },
        ({ new: r }) => { if (active) setRoom(r); }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sentences', filter: `room_code=eq.${roomCode}` },
        ({ new: s }) => {
          if (active)
            setSentences(prev => prev.some(p => p.id === s.id) ? prev : [...prev, s].sort((a, b) => a.order_index - b.order_index));
        }
      )
      .subscribe();

    return () => {
      active = false;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  // 모둠 화면에서도 시간 초과 시 자동 패스 (학생 화면이 꺼져 있어도 진행되도록)
  const timeLeft = useTimeLeft(room);
  useAutoSkip(roomCode, room, timeLeft, 3000);

  if (!room) {
    return (
      <div className="group-card group-card-loading">
        <p className="muted">{groupIndex}모둠 불러오는 중...</p>
      </div>
    );
  }

  const isFinished = room.status === 'finished';
  const { currentIdx, currentName, progress, total } = getTurnInfo(room, sentences);
  const pct = Math.min(100, Math.round((progress / total) * 100));
  const players = (room.player_order || []).map(id => (room.player_names || {})[id]);
  const recentSentences = sentences.filter(s => !s.skipped).slice(-3);

  return (
    <div className={`group-card ${isFinished ? 'group-card-finished' : ''}`}>
      <div className="group-card-header">
        <span className="group-card-num">{groupIndex}모둠</span>
        {isFinished && <span className="group-card-done-badge">완료</span>}
      </div>

      <div className="group-card-players">
        {players.map((name, i) => (
          <span key={i} className={`group-player-chip ${!isFinished && i === currentIdx ? 'group-player-active' : ''}`}>
            {name}
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
            낭독 모드
          </button>
          <button className="btn btn-print btn-sm" onClick={() => onViewStory(roomCode)}>
            인쇄 / 저장
          </button>
        </div>
      ) : (
        <div className="group-current-row">
          <p className="group-current-writer">
            {currentName ? `${currentName} 쓰는 중` : '대기 중'}
            {timeLeft !== null && (
              <span className={`turn-timer ${timeLeft <= 30 && timeLeft > 0 ? 'timer-warning' : ''} ${timeLeft === 0 ? 'timer-expired' : ''}`}>
                {timeLeft === 0 ? '시간 초과' : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
              </span>
            )}
          </p>
          <div className="group-card-buttons">
            {currentName && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (!window.confirm(`${groupIndex}모둠 ${currentName} 학생의 차례를 패스하고 다음 사람으로 넘길까요?`)) return;
                  advanceTurn(roomCode, room.turn_started_at, { type: 'skip', force: true, password: teacherPassword });
                }}
              >
                차례 넘기기
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                if (!window.confirm(`${groupIndex}모둠 이야기를 여기서 완성할까요?\n완성하면 더 이상 이어 쓸 수 없어요.`)) return;
                try {
                  await api.endRoom(roomCode, teacherPassword);
                } catch {
                  alert('이야기를 완성하지 못했어요. 다시 시도해주세요.');
                }
              }}
            >
              이야기 완성
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeacherGroupMonitor({ parentRoomCode, teacherPassword, groupRoomCodes, onViewStory, onBack }) {
  const [endingAll, setEndingAll] = useState(false);
  const [readAloud, setReadAloud] = useState(null); // { title, sentences }
  const [projector, setProjector] = useState(false);
  const [parentTitle, setParentTitle] = useState('');

  useEffect(() => {
    supabase.from('rooms').select('title').eq('code', parentRoomCode).single()
      .then(({ data }) => setParentTitle(data?.title || ''));
  }, [parentRoomCode]);

  async function handleReadAloud(roomCode, title) {
    const { data: s } = await supabase
      .from('sentences').select('*').eq('room_code', roomCode).eq('skipped', false).order('order_index');
    setReadAloud({ title, sentences: s || [] });
  }

  async function handleEndAll() {
    if (!window.confirm('모든 모둠의 소설을 지금 끝낼까요?')) return;
    setEndingAll(true);
    try {
      await Promise.all(groupRoomCodes.map(code => api.endRoom(code, teacherPassword)));
    } catch {
      alert('일부 모둠을 끝내지 못했어요. 다시 시도해주세요.');
    }
    setEndingAll(false);
  }

  return (
    <>
      {projector && (
        <ProjectorMode roomCode={parentRoomCode} roomTitle={parentTitle} onClose={() => setProjector(false)} />
      )}

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
            <button className="btn btn-ghost btn-sm" onClick={() => setProjector(true)}>
              QR 다시 띄우기
            </button>
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
              teacherPassword={teacherPassword}
              onReadAloud={handleReadAloud}
              onViewStory={onViewStory}
            />
          ))}
        </div>
      </div>
    </>
  );
}
