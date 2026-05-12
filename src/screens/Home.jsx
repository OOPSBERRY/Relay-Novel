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
          👩‍🏫 선생님
        </button>
        <button className="btn btn-student" onClick={onStudent}>
          🙋 학생
        </button>
        <button className="btn btn-library" onClick={onLibrary}>
          📚 반 서재 보기
        </button>
      </div>
    </div>
  );
}
