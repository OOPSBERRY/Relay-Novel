import { useState } from 'react';
import { supabase } from '../supabase';

export default function ClassSetup({ onEnter, onBack }) {
  const [classCode, setClassCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleEnter() {
    setError('');
    if (classCode.length !== 4) { setError('반 코드 4자리를 입력해주세요.'); return; }
    if (password.length < 4) { setError('비밀번호를 4자리 이상 입력해주세요.'); return; }

    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('classes')
        .select('id, name')
        .eq('class_code', classCode)
        .eq('teacher_password', password)
        .single();

      if (err || !data) {
        setError('반 서재를 찾을 수 없어요. 코드와 비밀번호를 다시 확인해주세요.');
        setLoading(false);
        return;
      }
      onEnter(classCode, data.name, data.id);
    } catch {
      setError('오류가 발생했어요. 다시 시도해주세요.');
      setLoading(false);
    }
  }

  return (
    <div className="screen screen-center">
      <button className="back-btn" onClick={onBack}>← 뒤로</button>

      <div className="join-hero">
        <div className="home-icon">📚</div>
        <h2>반 서재 보기</h2>
        <p className="muted">선생님에게 반 코드와 비밀번호를 받아 입력하세요</p>
      </div>

      <div className="form">
        <label>반 코드 (4자리 숫자)</label>
        <input
          value={classCode}
          onChange={e => setClassCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={e => e.key === 'Enter' && handleEnter()}
          placeholder="1234"
          className="code-input"
          inputMode="numeric"
          autoFocus
        />

        <label>반 서재 비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value.slice(0, 20))}
          onKeyDown={e => e.key === 'Enter' && handleEnter()}
          placeholder="선생님이 알려준 반 서재 비밀번호"
        />

        {error && <p className="error">{error}</p>}

        <button className="btn btn-primary btn-large" onClick={handleEnter} disabled={loading}>
          {loading ? '찾는 중...' : '서재 열기'}
        </button>
      </div>
    </div>
  );
}
