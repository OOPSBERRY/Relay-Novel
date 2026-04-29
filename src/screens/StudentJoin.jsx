import { useState } from 'react';
import { supabase } from '../supabase';

export default function StudentJoin({ onJoined, onBack }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin() {
    setError('');
    if (code.length !== 4) { setError('방 코드 4자리를 입력해주세요.'); return; }
    if (!name.trim()) { setError('이름을 입력해주세요.'); return; }

    setLoading(true);
    try {
      const { data: room, error: roomErr } = await supabase
        .from('rooms').select('status').eq('code', code).single();

      if (roomErr || !room) { setError('방을 찾을 수 없어요. 코드를 다시 확인해주세요.'); setLoading(false); return; }
      if (room.status !== 'waiting') { setError('이미 시작된 방이에요. 선생님께 문의해주세요.'); setLoading(false); return; }

      const playerId = crypto.randomUUID();
      const { error: insertErr } = await supabase.from('players').insert({
        id: playerId,
        room_code: code,
        name: name.trim(),
      });
      if (insertErr) throw insertErr;

      sessionStorage.setItem(`player_${code}`, JSON.stringify({ id: playerId, name: name.trim() }));
      onJoined(code, playerId, name.trim());
    } catch {
      setError('오류가 발생했어요. 다시 시도해주세요.');
      setLoading(false);
    }
  }

  return (
    <div className="screen screen-center">
      <button className="back-btn" onClick={onBack}>← 뒤로</button>

      <div className="join-hero">
        <div className="home-icon">🚀</div>
        <h2>방에 참가하기</h2>
      </div>

      <div className="form">
        <label>방 코드 (4자리 숫자)</label>
        <input
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          placeholder="1234"
          className="code-input"
          inputMode="numeric"
          autoFocus
        />

        <label>내 이름</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          placeholder="김민준"
          maxLength={10}
        />

        {error && <p className="error">{error}</p>}

        <button className="btn btn-primary btn-large" onClick={handleJoin} disabled={loading}>
          {loading ? '참가 중...' : '참가하기'}
        </button>
      </div>
    </div>
  );
}
