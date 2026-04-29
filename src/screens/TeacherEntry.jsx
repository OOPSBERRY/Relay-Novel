import { useState } from 'react';
import { supabase } from '../supabase';

async function generateUniqueRoomCode() {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const { data } = await supabase
      .from('rooms').select('code').eq('code', code)
      .in('status', ['waiting', 'playing']).single();
    if (!data) return code;
  }
  throw new Error('빈 방 코드를 찾지 못했어요. 잠시 후 다시 시도해주세요.');
}

export default function TeacherEntry({ onCreated, onRejoined, onBack }) {
  const [tab, setTab] = useState('create');

  const [title, setTitle] = useState('');
  const [hint, setHint] = useState('');
  const [maxSentences, setMaxSentences] = useState(20);
  const [password, setPassword] = useState('');

  // 반 서재 연결
  const [classCode, setClassCode] = useState('');
  const [classPassword, setClassPassword] = useState('');
  const [className, setClassName] = useState('');
  const [classStatus, setClassStatus] = useState(null); // null | 'new' | 'exists'

  const [rejoinCode, setRejoinCode] = useState('');
  const [rejoinPassword, setRejoinPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function checkClassCode(code) {
    if (code.length !== 4) { setClassStatus(null); return; }
    const { data } = await supabase.from('classes').select('name').eq('class_code', code).single();
    if (data) {
      setClassName(data.name);
      setClassStatus('exists');
    } else {
      setClassName('');
      setClassStatus('new');
    }
  }

  async function handleCreate() {
    setError('');
    if (!title.trim()) { setError('소설 제목을 입력해주세요.'); return; }
    if (password.length < 4) { setError('교사 비밀번호를 4자리 이상 입력해주세요.'); return; }

    if (classCode.length === 4) {
      if (classPassword.length < 4) { setError('반 서재 비밀번호를 4자리 이상 입력해주세요.'); return; }
      if (classStatus === 'new' && !className.trim()) { setError('새 반 서재 이름을 입력해주세요.'); return; }
      if (classStatus === 'exists') {
        const { data } = await supabase.from('classes').select('teacher_password').eq('class_code', classCode).single();
        if (!data || data.teacher_password !== classPassword) { setError('반 서재 비밀번호가 틀렸어요.'); return; }
      }
    }

    setLoading(true);
    try {
      if (classCode.length === 4 && classStatus === 'new') {
        await supabase.from('classes').insert({
          class_code: classCode,
          name: className.trim(),
          teacher_password: classPassword,
        });
      }

      const code = await generateUniqueRoomCode();
      const { error: err } = await supabase.from('rooms').insert({
        code,
        title: title.trim(),
        hint: hint.trim(),
        max_sentences: Number(maxSentences),
        teacher_password: password,
        status: 'waiting',
        player_order: [],
        player_names: {},
        class_code: classCode.length === 4 ? classCode : null,
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
    if (rejoinPassword.length < 4) { setError('비밀번호를 4자리 이상 입력해주세요.'); return; }

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
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 우리 반의 대모험" maxLength={50} />

          <label>글감 / 힌트 <span className="label-opt">(선택)</span></label>
          <input value={hint} onChange={e => setHint(e.target.value)} placeholder="예: 어느 날 교실에 로봇이 나타났어요" maxLength={100} />

          <label>최대 문장 수</label>
          <select value={maxSentences} onChange={e => setMaxSentences(e.target.value)}>
            {[10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n}문장</option>)}
          </select>

          <label>교사 비밀번호 *</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value.slice(0, 20))} placeholder="예: abc123" />
          <p className="input-hint">숫자+글자 조합 가능 · 4자리 이상 · 방 재접속 시 필요</p>

          {/* 반 서재 연결 */}
          <div className="class-link-section">
            <p className="class-link-label">📚 반 서재 연결 <span className="label-opt">(선택)</span></p>
            <p className="input-hint">완성된 이야기를 반 서재에 자동으로 저장합니다</p>

            <label>반 코드 (4자리)</label>
            <input
              value={classCode}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                setClassCode(v);
                checkClassCode(v);
              }}
              placeholder="없으면 비워두세요"
              inputMode="numeric"
            />

            {classStatus === 'new' && (
              <>
                <div className="class-status-badge new">✨ 새 반 서재를 만듭니다</div>
                <label>반 서재 이름 *</label>
                <input value={className} onChange={e => setClassName(e.target.value)} placeholder="예: 3학년 2반" maxLength={20} />
              </>
            )}
            {classStatus === 'exists' && (
              <div className="class-status-badge exists">✅ "{className}" 서재에 연결됩니다</div>
            )}

            {classCode.length === 4 && (
              <>
                <label>반 서재 비밀번호 *</label>
                <input type="password" value={classPassword} onChange={e => setClassPassword(e.target.value.slice(0, 20))} placeholder="예: abc123" />
              </>
            )}
          </div>

          {error && <p className="error">{error}</p>}

          <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? '생성 중...' : '방 만들기'}
          </button>
        </div>
      ) : (
        <div className="form">
          <label>방 코드 (4자리)</label>
          <input value={rejoinCode} onChange={e => setRejoinCode(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" inputMode="numeric" className="code-input" />

          <label>교사 비밀번호</label>
          <input type="password" value={rejoinPassword} onChange={e => setRejoinPassword(e.target.value.slice(0, 20))} placeholder="예: abc123" />

          {error && <p className="error">{error}</p>}

          <button className="btn btn-primary" onClick={handleRejoin} disabled={loading}>
            {loading ? '접속 중...' : '방 접속'}
          </button>
        </div>
      )}
    </div>
  );
}
