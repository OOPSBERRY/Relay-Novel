import { useState } from 'react';
import { supabase } from '../supabase';
import { unlockAudio } from '../utils/turnAlert';
import { api, errorMessage } from '../api';

const SESSION_KEY = 'relay_student_session';


async function findPlayerInGroups(groupCodes, name) {
  for (const childCode of groupCodes) {
    const { data: child } = await supabase
      .from('rooms').select('player_names').eq('code', childCode).single();
    const match = Object.entries(child?.player_names || {}).find(([, n]) => n === name);
    if (match) return { playerId: match[0], roomCode: childCode };
  }
  return null;
}

export default function StudentJoin({ initialCode = '', notice = '', onJoined, onBack }) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin() {
    unlockAudio();
    setError('');
    if (code.length !== 4) { setError('방 코드 4자리를 입력해주세요.'); return; }
    if (!name.trim()) { setError('이름을 입력해주세요.'); return; }

    setLoading(true);
    try {
      const { data: room, error: roomErr } = await supabase
        .from('rooms').select('*').eq('code', code).single();

      if (roomErr || !room) { setError('방을 찾을 수 없어요. 코드를 다시 확인해주세요.'); setLoading(false); return; }

      // 진행 중인 방: 이름으로 기존 플레이어 찾아서 복구
      if (room.status === 'playing') {
        const match = Object.entries(room.player_names || {}).find(([, n]) => n === name.trim());
        if (match) {
          const [playerId] = match;
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode: code, myId: playerId, myName: name.trim() }));
          onJoined(code, playerId, name.trim());
        } else {
          setError('이미 시작된 방이에요. 이름이 맞는지 확인하거나 선생님께 문의하세요.');
          setLoading(false);
        }
        return;
      }

      // 모둠 진행 중: 각 모둠 방에서 이름 검색
      if (room.status === 'group_monitoring') {
        const found = await findPlayerInGroups(room.player_order || [], name.trim());
        if (found) {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode: found.roomCode, myId: found.playerId, myName: name.trim() }));
          onJoined(found.roomCode, found.playerId, name.trim());
        } else {
          setError('이미 시작된 방이에요. 이름이 맞는지 확인하거나 선생님께 문의하세요.');
          setLoading(false);
        }
        return;
      }

      if (room.status !== 'waiting') {
        setError('입장할 수 없는 방이에요. 선생님께 문의해주세요.');
        setLoading(false);
        return;
      }

      // 대기 중인 방: 서버가 같은 이름(띄어쓰기 무시)인지 확인하고 자리를 만든다
      const playerId = await api.joinRoom(code, name.trim());

      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode: code, myId: playerId, myName: name.trim() }));
      onJoined(code, playerId, name.trim());
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <div className="screen screen-center">
      <button className="back-btn" onClick={onBack}>← 뒤로</button>

      <div className="join-hero">
        <h2>방에 참가하기</h2>
      </div>

      <div className="form">
        {notice && <p className="error">{notice}</p>}
        <label>방 코드 (4자리 숫자)</label>
        <input
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          placeholder="1234"
          className="code-input"
          inputMode="numeric"
          autoFocus={!initialCode}
        />

        <label>내 이름</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          placeholder="김민준"
          maxLength={10}
          autoFocus={!!initialCode}
        />

        {error && <p className="error">{error}</p>}

        <button className="btn btn-primary btn-large" onClick={handleJoin} disabled={loading}>
          {loading ? '참가 중...' : '참가하기'}
        </button>
      </div>
    </div>
  );
}
