export default function Home({ onTeacher, onStudent, onLibrary }) {
  return (
    <div className="home-screen">
      <div className="home-top">
        <div className="home-logo-badge">
          <span className="home-logo-letter">ㄹ</span>
        </div>
        <h1 className="home-app-name">릴레이 서재</h1>
        <p className="home-tagline">친구들과 함께 한 문장씩<br />이어가는 우리들의 이야기</p>
      </div>

      <div className="home-bottom">
        <button className="btn btn-teacher" onClick={onTeacher}>
          <span className="home-btn-icon">👩‍🏫</span>
          <span className="home-btn-main">선생님</span>
          <span className="home-btn-sub">방 만들고 시작하기</span>
        </button>
        <button className="btn btn-student" onClick={onStudent}>
          <span className="home-btn-icon">🙋</span>
          <span className="home-btn-main">학생</span>
          <span className="home-btn-sub">방 코드로 참가하기</span>
        </button>
        <button className="btn btn-library" onClick={onLibrary}>
          <span className="home-btn-icon">📚</span>
          <span className="home-btn-main">반 서재 보기</span>
          <span className="home-btn-sub">완성된 이야기 모아보기</span>
        </button>
      </div>
    </div>
  );
}
