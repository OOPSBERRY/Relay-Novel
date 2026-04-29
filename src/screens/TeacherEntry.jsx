import { useState } from 'react';
import { supabase } from '../supabase';

function generateRoomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export default function TeacherEntry({ onCreated, onRejoined, onBack }) {
  const [tab, setTab] = useState('create');

  const [title, setTitle] = useState('');
  const [hint, setHint] = useState('');
  const [maxSentences, setMaxSentences] = useState(20);
  const [password, setPassword] = useState('');

  const [rejoinCode, setRejoinCode] = useState('');
  const [rejoinPassword, setRejoinPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    setError('');
    if (!title.trim()) { setError('소설 제목을 입력해주세요.'); return; }
    if (password.length !== 4) { setError('교사 비밀번호를 4자리 숫자로 입력해주세요.'); return; }

    setLoading(true);
    try {
      const code = generateRoomCode();
      const { error: err } = await supabase.from('rooms').insert({
        code,
        title: title.trim(),
        hint: hint.trim(),
        max_sentences: Number(maxSentences),
        teacher_password: password,
        status: 'waiting',
        player_order: [],
        player_names: {},
      });
      if (err) throw err;
      onCreated(code);
    } catch {
      setError('방을 만드는 데 실패했습니다. 다시 시도해주세요.');
      setLoading(false);
    }
  }

  async function handleRejoin() {
    setError('');
    if (rejoinCode.length !== 4) { setError('방 코드 4자리를 입력해주세요.'); return; }
    if (rejoinPassword.length !== 4) { setError('비밀번호 4자리를 입력해주세요.'); return; }

    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('rooms').select('status, teacher_password').eq('code', rejoinCode).single();
      if (err || !data) { setError('방을 찾을 수 없어요.'); setLoading(false); return; }
      if (data.teacher_password !== rejoinPassword) { setError('비밀번호가 틀렸어요.'); setLoading(false); return; }
      onRejoined(rejoinCode, data.status);
    } catch {
      setError('오류가 발생했어요. 다시 시도해주세요.');
      setLoading(false);
    }
  }

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← 뒤로</button>

      <div className="tab-bar">
        <button className={`tab ${tab === 'create' ? 'active' : ''}`} onClick={() => { setTab('create'); setError(''); }}>
          새 방 만들기
        </button>
        <button className={`tab ${tab === 'rejoin' ? 'active' : ''}`} onClick={() => { setTab('rejoin'); setError(''); }}>
          기존 방 접속
        </button>
      </div>

      {tab === 'create' ? (
        <div className="form">
          <label>소설 제목 *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="예: 우리 반의 대모험"
            maxLength={50}
          />

          <label>글감 / 힌트 <span className="label-opt">(선택)</span></label>
          <input
            value={hint}
            onChange={e => setHint(e.target.value)}
            placeholder="예: 어느 날 교실에 로봇이 나타났어요"
            maxLength={100}
          />

          <label>최대 문장 수</label>
          <select value={maxSentences} onChange={e => setMaxSentences(e.target.value)}>
            {[10, 15, 20, 25, 30].map(n => (
              <option key={n} value={n}>{n}문장</option>
            ))}
          </select>

          <label>교사 비밀번호 (4자리 숫자) *</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="1234"
            inputMode="numeric"
          />
          <p className="input-hint">나중에 방에 다시 접속할 때 필요합니다</p>

          {error && <p className="error">{error}</p>}

          <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? '생성 중...' : '방 만들기'}
          </button>
        </div>
      ) : (
        <div className="form">
          <label>방 코드 (4자리)</label>
          <input
            value={rejoinCode}
            onChange={e => setRejoinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="1234"
            inputMode="numeric"
            className="code-input"
          />

          <label>교사 비밀번호</label>
          <input
            type="password"
            value={rejoinPassword}
            onChange={e => setRejoinPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="1234"
            inputMode="numeric"
          />

          {error && <p className="error">{error}</p>}

          <button className="btn btn-primary" onClick={handleRejoin} disabled={loading}>
            {loading ? '접속 중...' : '방 접속'}
          </button>
        </div>
      )}
    </div>
  );
}
