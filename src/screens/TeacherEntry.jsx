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

export default function TeacherEntry({ onCreated, onBack }) {
  const [title, setTitle] = useState('');
  const [hint, setHint] = useState('');
  const [maxSentences, setMaxSentences] = useState(20);
  const [turnTimeLimit, setTurnTimeLimit] = useState(0);
  const [password, setPassword] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(true);

  const [classCode, setClassCode] = useState('');
  const [className, setClassName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    setError('');
    if (!title.trim()) { setError('소설 제목을 입력해주세요.'); return; }
    if (password.length < 4) { setError('교사 비밀번호를 4자리 이상 입력해주세요.'); return; }

    let classId = null;

    if (classCode.length === 4) {
      const { data: existing } = await supabase
        .from('classes').select('id')
        .eq('class_code', classCode)
        .eq('teacher_password', password)
        .single();

      if (existing) {
        classId = existing.id;
      } else {
        if (!className.trim()) { setError('처음 만드는 반 서재라면 반 이름을 입력해주세요.'); return; }
        const { data: newClass, error: classErr } = await supabase
          .from('classes')
          .insert({ class_code: classCode, name: className.trim(), teacher_password: password })
          .select('id').single();
        if (classErr) { setError('반 서재 생성에 실패했어요. 다시 시도해주세요.'); return; }
        classId = newClass.id;
      }
    }

    setLoading(true);
    try {
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
        turn_time_limit: turnTimeLimit > 0 ? turnTimeLimit : null,
        class_code: classCode.length === 4 ? classCode : null,
        class_id: classId,
      });
      if (err) throw err;
      onCreated(code, password);
    } catch {
      setError('방을 만드는 데 실패했습니다. 다시 시도해주세요.');
      setLoading(false);
    }
  }

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← 뒤로</button>

      <div className="form">
        <label>소설 제목 *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 우리 반의 대모험" maxLength={50} autoFocus />

        <label>교사 비밀번호 *</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value.slice(0, 20))} placeholder="4자리 이상 (재접속 시 필요)" />

        <button
          type="button"
          className="advanced-toggle"
          onClick={() => setShowAdvanced(v => !v)}
        >
          {showAdvanced ? '▲ 상세 설정 접기' : '▼ 상세 설정 (첫 문장 · 턴 수 · 시간 제한 · 반 서재)'}
        </button>

        {showAdvanced && (
          <div className="advanced-section">
            <label>첫 문장 <span className="label-opt">(선택)</span></label>
            <input value={hint} onChange={e => setHint(e.target.value)} placeholder="예: 어느 날 교실에 로봇이 나타났어요." maxLength={100} />
            <p className="input-hint">입력하면 이야기 첫 문장으로 고정됩니다</p>

            <label>최대 턴 수</label>
            <select value={maxSentences} onChange={e => setMaxSentences(e.target.value)}>
              {[10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n}턴</option>)}
            </select>

            <label>1인당 제한 시간</label>
            <select value={turnTimeLimit} onChange={e => setTurnTimeLimit(Number(e.target.value))}>
              <option value={0}>제한 없음</option>
              <option value={60}>1분</option>
              <option value={120}>2분</option>
              <option value={180}>3분</option>
              <option value={300}>5분</option>
            </select>

            <div className="class-link-section">
              <p className="class-link-label">📚 반 서재 연결 <span className="label-opt">(선택)</span></p>
              <p className="input-hint">완성된 이야기를 반 서재에 자동 저장합니다 · 반 서재 비밀번호는 위의 교사 비밀번호와 동일합니다</p>

              <label>반 코드 (4자리 숫자)</label>
              <input
                value={classCode}
                onChange={e => setClassCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="없으면 비워두세요"
                inputMode="numeric"
              />

              {classCode.length === 4 && (
                <>
                  <label>반 이름 <span className="label-opt">(처음 만들 때만)</span></label>
                  <input value={className} onChange={e => setClassName(e.target.value)} placeholder="예: 3학년 2반 (기존 서재면 비워도 됩니다)" maxLength={20} />
                </>
              )}
            </div>
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
          {loading ? '생성 중...' : '방 만들기'}
        </button>
      </div>
    </div>
  );
}
