import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const COVER_GRADIENTS = [
  ['#667EEA', '#764BA2'], ['#F093FB', '#F5576C'],
  ['#4FACFE', '#00F2FE'], ['#43E97B', '#38F9D7'],
  ['#FA709A', '#FEE140'], ['#A18CD1', '#FBC2EB'],
  ['#FCCB90', '#D57EEB'], ['#96FBC4', '#F9F586'],
  ['#FBC2EB', '#A6C1EE'], ['#FDDB92', '#D1FDFF'],
];

function getCoverStyle(code) {
  const hash = code.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const [a, b] = COVER_GRADIENTS[hash % COVER_GRADIENTS.length];
  return { background: `linear-gradient(145deg, ${a}, ${b})` };
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function ClassLibrary({ classCode, className, classId, onRead, onBack }) {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isTeacher, setIsTeacher] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    load();
  }, [classCode]);

  async function load() {
    const { data } = await supabase
      .from('rooms')
      .select('code, title, player_order, player_names, created_at')
      .eq('class_id', classId)
      .eq('status', 'finished')
      .order('created_at', { ascending: false });
    setStories(data || []);
    setLoading(false);
  }

  async function handleTeacherLogin() {
    setPasswordError('');
    const { data } = await supabase
      .from('classes').select('teacher_password').eq('class_code', classCode).single();
    if (!data || data.teacher_password !== passwordInput) {
      setPasswordError('비밀번호가 틀렸어요.');
      return;
    }
    setIsTeacher(true);
    setShowPasswordInput(false);
    setPasswordInput('');
  }

  async function handleDelete(storyCode, title) {
    if (!window.confirm(`"${title}"을 서재에서 삭제할까요?`)) return;
    await supabase.from('rooms').update({ class_code: null }).eq('code', storyCode);
    setStories(prev => prev.filter(s => s.code !== storyCode));
  }

  return (
    <div className="screen library-screen">
      <div className="library-header">
        <button className="back-btn" onClick={onBack}>← 뒤로</button>
        <div className="library-title-wrap">
          <h2 className="library-title">{className}</h2>
          <p className="muted">우리 반이 함께 쓴 이야기들</p>
        </div>
        <div className="library-teacher-btn-wrap">
          {isTeacher ? (
            <button className="btn btn-ghost btn-sm" onClick={() => setIsTeacher(false)}>
              관리 종료
            </button>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPasswordInput(v => !v)}>
              👩‍🏫 교사 관리
            </button>
          )}
        </div>
      </div>

      {showPasswordInput && !isTeacher && (
        <div className="teacher-login-box">
          <p className="teacher-login-title">교사 비밀번호 확인</p>
          <div className="teacher-login-row">
            <input
              type="password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTeacherLogin()}
              placeholder="반 서재 비밀번호"
              autoFocus
            />
            <button className="btn btn-primary btn-sm" onClick={handleTeacherLogin}>확인</button>
          </div>
          {passwordError && <p className="error">{passwordError}</p>}
        </div>
      )}

      {isTeacher && (
        <div className="teacher-mode-bar">🔓 관리 모드 — 책 표지의 × 버튼으로 삭제</div>
      )}

      {loading ? (
        <div className="library-empty"><p className="muted">불러오는 중...</p></div>
      ) : stories.length === 0 ? (
        <div className="library-empty">
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📭</div>
          <p className="muted">아직 완성된 이야기가 없어요.</p>
          <p className="muted">이야기를 완성하면 여기에 쌓여요!</p>
        </div>
      ) : (
        <div className="book-grid">
          {stories.map(story => (
            <div key={story.code} className="book-card-wrap">
              <button className="book-card" onClick={() => onRead(story.code, story.title)}>
                <div className="book-cover" style={getCoverStyle(story.code)}>
                  <span className="book-cover-title">{story.title}</span>
                </div>
                <div className="book-info">
                  <p className="book-title">{story.title}</p>
                  <p className="book-meta">
                    {story.player_order?.length ?? 0}명 참여 · {formatDate(story.created_at)}
                  </p>
                </div>
              </button>
              {isTeacher && (
                <button
                  className="book-delete-btn"
                  onClick={() => handleDelete(story.code, story.title)}
                  title="서재에서 삭제"
                >×</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
