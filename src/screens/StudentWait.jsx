import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

export default function StudentWait({ roomCode, myId, myName, onStarted }) {
  const [roomTitle, setRoomTitle] = useState('');
  const [playerCount, setPlayerCount] = useState(0);
  const onStartedRef = useRef(onStarted);
  useEffect(() => { onStartedRef.current = onStarted; }, [onStarted]);

  useEffect(() => {
    let active = true;

    async function check() {
      const { data: room } = await supabase
        .from('rooms').select('status, title').eq('code', roomCode).single();
      if (!active) return;
      if (room?.title) setRoomTitle(room.title);
      if (room?.status === 'playing') {
        onStartedRef.current(roomCode);
      } else if (room?.status === 'group_monitoring') {
        await findAndJoinGroupRoom();
      }

      const { count } = await supabase
        .from('players').select('*', { count: 'exact', head: true }).eq('room_code', roomCode);
      if (active) setPlayerCount(count || 0);
    }

    async function findAndJoinGroupRoom() {
      const { data } = await supabase
        .from('players').select('room_code').eq('id', myId).single();
      if (!active) return;
      if (data?.room_code && data.room_code !== roomCode) {
        onStartedRef.current(data.room_code);
      }
    }

    check();
    const poll = setInterval(check, 2000);

    const channel = supabase.channel('student-wait-' + roomCode)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` },
        async ({ new: r }) => {
          if (!active) return;
          if (r.status === 'playing') {
            onStartedRef.current(roomCode);
          } else if (r.status === 'group_monitoring') {
            await findAndJoinGroupRoom();
          }
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'players', filter: `room_code=eq.${roomCode}` },
        () => { if (active) setPlayerCount(prev => prev + 1); }
      )
      .subscribe();

    return () => {
      active = false;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [roomCode, myId]);

  return (
    <div className="screen screen-center">
      <div className="wait-content">
        <div className="wait-icon">⏳</div>
        {roomTitle && <p className="wait-story-title">📖 {roomTitle}</p>}
        <h2>선생님을 기다리고 있어요</h2>
        <p className="wait-name">{myName} 님, 잘 오셨어요!</p>
        <div className="wait-player-count">
          <span className="wait-player-dot" />
          현재 <strong>{playerCount}명</strong> 참가 중
        </div>
        <p className="muted">선생님이 시작 버튼을 누르면 소설이 시작됩니다.</p>
        <div className="room-code-small">방 코드: <strong>{roomCode}</strong></div>
      </div>
    </div>
  );
}
