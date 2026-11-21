import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import ProjectorMode from './ProjectorMode';
import { api, errorMessage } from '../api';

export default function TeacherWait({ roomCode, teacherPassword, onStarted, onGroupStarted, onBack }) {
  const [players, setPlayers] = useState([]);
  const [roomData, setRoomData] = useState(null);
  const [starting, setStarting] = useState(false);
  const [projector, setProjector] = useState(false);
  const [groupCount, setGroupCount] = useState(4);
  const [startMode, setStartMode] = useState('single');
  const onStartedRef = useRef(onStarted);
  const onGroupStartedRef = useRef(onGroupStarted);
  useEffect(() => { onStartedRef.current = onStarted; }, [onStarted]);
  useEffect(() => { onGroupStartedRef.current = onGroupStarted; }, [onGroupStarted]);

  useEffect(() => {
    let active = true;

    async function fetchAll() {
      const { data: room } = await supabase.from('rooms').select('*').eq('code', roomCode).single();
      if (!active) return;
      if (room) {
        setRoomData(room);
        if (room.status === 'playing') { onStartedRef.current(); return; }
        if (room.status === 'group_monitoring') {
          onGroupStartedRef.current(room.player_order || []);
          return;
        }
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
          if (room.status === 'group_monitoring') {
            onGroupStartedRef.current(room.player_order || []);
          }
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'players', filter: `room_code=eq.${roomCode}` },
        ({ new: player }) => {
          if (active) setPlayers(prev => prev.some(p => p.id === player.id) ? prev : [...prev, player]);
        }
      )
      .subscribe();

    return () => {
      active = false;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  // 이름을 잘못 입력한 학생 등을 대기실에서 내보내기
  async function handleRemovePlayer(player) {
    if (starting) return;
    if (!window.confirm(`'${player.name}' 학생을 내보낼까요?\n학생 화면은 입장 화면으로 돌아갑니다.`)) return;
    setPlayers(prev => prev.filter(p => p.id !== player.id));
    try {
      await api.removePlayer(roomCode, teacherPassword, player.id);
    } catch (err) {
      alert(errorMessage(err, '내보내지 못했어요. 다시 시도해주세요.'));
      setPlayers(prev => prev.some(p => p.id === player.id) ? prev : [...prev, player]);
    }
  }

  // 순서 섞기, 첫 문장 넣기, 시작 시각 기록은 서버 함수가 한 번에 처리한다
  async function handleStart() {
    if (players.length < 2 || starting) return;
    setStarting(true);
    try {
      await api.startSingle(roomCode, teacherPassword);
    } catch (err) {
      alert(errorMessage(err, '시작하지 못했어요. 다시 시도해주세요.'));
      setStarting(false);
    }
  }

  async function handleGroupStart() {
    if (players.length < effectiveGroupCount * 2 || starting) return;
    setStarting(true);
    try {
      await api.startGroups(roomCode, teacherPassword, effectiveGroupCount);
    } catch (err) {
      alert(errorMessage(err, '모둠을 만들지 못했어요. 다시 시도해주세요.'));
      setStarting(false);
    }
  }

  const maxGroups = Math.min(6, Math.floor(players.length / 2));
  const effectiveGroupCount = Math.min(groupCount, maxGroups);
  const playersPerGroup = players.length > 0 ? Math.ceil(players.length / effectiveGroupCount) : 0;

  return (
    <>
      <div className="screen">
        <button className="back-btn" onClick={onBack}>← 처음으로</button>

        <div className="room-code-display">
          <p className="room-code-label">학생들에게 이 코드를 알려주세요</p>
          <div className="room-code-big">{roomCode}</div>
          <p className="room-code-hint">학생: 앱 열기 → 학생 → 코드 입력</p>
        </div>

        <button className="btn btn-projector" onClick={() => setProjector(true)}>
          <span>QR 코드 크게 띄우기</span> <span className="btn-sub">학생들에게 보여주세요 →</span>
        </button>

        {roomData && (
          <div className="card">
            <p>{roomData.title}</p>
            {roomData.hint && <p className="muted">첫 문장: {roomData.hint}</p>}
            <p className="muted">최대 {roomData.max_sentences}턴</p>
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
                  <button
                    className="player-remove"
                    onClick={() => handleRemovePlayer(p)}
                    disabled={starting}
                    aria-label={`${p.name} 내보내기`}
                    title="내보내기"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card start-mode-card">
          <div className="start-mode-tabs">
            <button
              className={`start-mode-tab ${startMode === 'single' ? 'active' : ''}`}
              onClick={() => setStartMode('single')}
            >
              전체 한 팀
            </button>
            <button
              className={`start-mode-tab ${startMode === 'group' ? 'active' : ''}`}
              onClick={() => setStartMode('group')}
            >
              모둠별
            </button>
          </div>
          <p className="start-mode-desc">
            {startMode === 'single'
              ? '모든 학생이 한 팀으로 이야기 한 편을 완성합니다.'
              : '학생들을 모둠으로 나눠 동시에 각자의 이야기를 씁니다.'}
          </p>

          {startMode === 'single' ? (
            <button
              className="btn btn-primary btn-large"
              onClick={handleStart}
              disabled={players.length < 2 || starting}
            >
              {players.length < 2 ? '학생이 2명 이상 필요해요' : starting ? '시작 중...' : `${players.length}명으로 시작하기`}
            </button>
          ) : (
            <>
              <div className="group-count-row">
                <span className="group-count-label">모둠 수</span>
                <div className="group-count-btns">
                  {[2, 3, 4, 5, 6].map(n => (
                    <button
                      key={n}
                      className={`group-count-btn ${groupCount === n ? 'active' : ''}`}
                      onClick={() => setGroupCount(n)}
                      disabled={n > maxGroups}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              {players.length >= effectiveGroupCount * 2 && (
                <p className="group-preview">
                  {effectiveGroupCount}모둠 × 약 {playersPerGroup}명
                </p>
              )}
              <button
                className="btn btn-primary btn-large"
                onClick={handleGroupStart}
                disabled={players.length < effectiveGroupCount * 2 || starting}
              >
                {starting ? '모둠 생성 중...' :
                  players.length < effectiveGroupCount * 2
                    ? `모둠당 최소 2명 필요해요`
                    : `${effectiveGroupCount}개 모둠으로 시작하기`}
              </button>
            </>
          )}
        </div>
      </div>

      {projector && (
        <ProjectorMode
          roomCode={roomCode}
          roomTitle={roomData?.title || ''}
          players={players}
          onRemovePlayer={handleRemovePlayer}
          onClose={() => setProjector(false)}
        />
      )}
    </>
  );
}
