import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import ProjectorMode from './ProjectorMode';

async function generateUniqueRoomCode() {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const { data } = await supabase
      .from('rooms').select('code').eq('code', code)
      .in('status', ['waiting', 'playing', 'group_monitoring']).single();
    if (!data) return code;
  }
  throw new Error('빈 방 코드를 찾지 못했어요. 잠시 후 다시 시도해주세요.');
}

export default function TeacherWait({ roomCode, onStarted, onGroupStarted, onBack }) {
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
    const now = new Date().toISOString();
    const hasFirst = !!(roomData.hint && roomData.hint.trim());

    if (hasFirst) {
      await supabase.from('sentences').insert({
        room_code: roomCode,
        text: roomData.hint.trim(),
        player_name: '선생님',
        order_index: 0,
        skipped: false,
      });
    }

    await supabase.from('rooms').update({
      status: 'playing',
      player_order: playerOrder,
      player_names: playerNames,
      turn_started_at: now,
      ...(hasFirst ? { max_sentences: roomData.max_sentences + 1 } : {}),
    }).eq('code', roomCode);
  }

  async function handleGroupStart() {
    if (players.length < groupCount * 2 || starting) return;
    setStarting(true);

    try {
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      const groups = Array.from({ length: groupCount }, (_, i) =>
        shuffled.filter((_, j) => j % groupCount === i)
      );

      const now = new Date().toISOString();
      const hasFirst = !!(roomData.hint && roomData.hint.trim());

      // 모둠 코드 미리 생성 (순서 보장 필요)
      const childCodes = [];
      for (let i = 0; i < groupCount; i++) {
        childCodes.push(await generateUniqueRoomCode());
      }

      // 모둠 방 생성 + 플레이어 이동 병렬 처리
      await Promise.all(childCodes.map(async (code, i) => {
        const groupPlayers = groups[i];
        const playerOrder = groupPlayers.map(p => p.id);
        const playerNames = Object.fromEntries(groupPlayers.map(p => [p.id, p.name]));

        await supabase.from('rooms').insert({
          code,
          title: roomData.title,
          hint: roomData.hint,
          max_sentences: hasFirst ? roomData.max_sentences + 1 : roomData.max_sentences,
          teacher_password: roomData.teacher_password,
          turn_time_limit: roomData.turn_time_limit,
          class_code: roomData.class_code,
          class_id: roomData.class_id,
          status: 'playing',
          player_order: playerOrder,
          player_names: playerNames,
          turn_started_at: now,
        });

        // 첫 문장 삽입 + 플레이어 이동 병렬
        await Promise.all([
          hasFirst ? supabase.from('sentences').insert({
            room_code: code,
            text: roomData.hint.trim(),
            player_name: '선생님',
            order_index: 0,
            skipped: false,
          }) : Promise.resolve(),
          ...groupPlayers.map(p =>
            supabase.from('players').update({ room_code: code }).eq('id', p.id)
          ),
        ]);
      }));

      await supabase.from('rooms').update({
        status: 'group_monitoring',
        player_order: childCodes,
      }).eq('code', roomCode);
    } catch (err) {
      alert(err.message);
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
          QR 코드 + 방 코드 <span className="btn-sub">(학생들에게 보여주세요.)</span>
        </button>

        {roomData && (
          <div className="card">
            <p>📚 <strong>{roomData.title}</strong></p>
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
          onClose={() => setProjector(false)}
        />
      )}
    </>
  );
}
