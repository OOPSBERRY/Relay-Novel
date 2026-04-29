import { useEffect } from 'react';
import { supabase } from '../supabase';

export default function StudentWait({ roomCode, myName, onStarted }) {
  useEffect(() => {
    async function checkStatus() {
      const { data: room } = await supabase.from('rooms').select('status').eq('code', roomCode).single();
      if (room?.status === 'playing') { onStarted(); return; }
    }
    checkStatus();

    const channel = supabase.channel('student-wait-' + roomCode)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` },
        ({ new: room }) => { if (room.status === 'playing') onStarted(); }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [roomCode, onStarted]);

  return (
    <div className="screen screen-center">
      <div className="wait-content">
        <div className="wait-icon">⏳</div>
        <h2>선생님을 기다리고 있어요</h2>
        <p className="wait-name">{myName} 님, 잘 오셨어요!</p>
        <p className="muted">선생님이 시작 버튼을 누르면 소설이 시작됩니다.</p>
        <div className="room-code-small">방 코드: <strong>{roomCode}</strong></div>
      </div>
    </div>
  );
}
