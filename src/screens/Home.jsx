import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

// 한국 시간 오늘 0시를 UTC 시각 문자열로
function startOfTodayKST() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3600 * 1000).toISOString();
}

async function count(query) {
  const { count: n, error } = await query;
  if (error) throw error;
  return n || 0;
}

// 서재 판권 페이지처럼: 완성된 이야기 수 + 함께 쓴 학생 수
async function loadStats() {
  const today = startOfTodayKST();
  const stories = () => supabase.from('rooms').select('code', { count: 'exact', head: true }).eq('status', 'finished');
  const students = () => supabase.from('players').select('id', { count: 'exact', head: true });
  const [totalStories, totalStudents, todayStories, todayStudents] = await Promise.all([
    count(stories()),
    count(students()),
    count(stories().gte('created_at', today)),
    count(students().gte('joined_at', today)),
  ]);
  return { totalStories, totalStudents, todayStories, todayStudents };
}

const fmt = (n) => n.toLocaleString('ko-KR');

export default function Home({ onTeacher, onStudent, onLibrary }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let active = true;
    loadStats().then(s => { if (active) setStats(s); }).catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <div className="home-screen">
      <div className="home-top">
        <div className="home-logo-badge">
          <span className="home-logo-letter">ㄹ</span>
        </div>
        <h1 className="home-app-name">릴레이 서재</h1>
        <p className="home-tagline">친구들과 함께 한 문장씩<br />이어가는 우리들의 이야기</p>

        {stats && (
          <div className="home-stats">
            <p>
              지금까지 <strong>{fmt(stats.totalStories)}편</strong>의 이야기를{' '}
              <strong>{fmt(stats.totalStudents)}명</strong>이 함께 썼어요
            </p>
            <p className="home-stats-today">
              {stats.todayStories === 0 && stats.todayStudents === 0
                ? '오늘의 첫 이야기를 기다리고 있어요'
                : <>오늘 <strong>{fmt(stats.todayStories)}편</strong> · <strong>{fmt(stats.todayStudents)}명</strong></>}
            </p>
          </div>
        )}
      </div>

      <div className="home-bottom">
        <button className="btn btn-teacher" onClick={onTeacher}>
          <span className="home-btn-icon">一</span>
          <span className="home-btn-main">선생님</span>
          <span className="home-btn-sub">방 만들고 시작하기</span>
        </button>
        <button className="btn btn-student" onClick={onStudent}>
          <span className="home-btn-icon">二</span>
          <span className="home-btn-main">학생</span>
          <span className="home-btn-sub">방 코드로 참가하기</span>
        </button>
        <button className="btn btn-library" onClick={onLibrary}>
          <span className="home-btn-icon">三</span>
          <span className="home-btn-main">반 서재 보기</span>
          <span className="home-btn-sub">완성된 이야기 모아보기</span>
        </button>
      </div>
    </div>
  );
}
