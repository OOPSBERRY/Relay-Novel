export default function Home({ onTeacher, onStudent }) {
  return (
    <div className="screen screen-center">
      <div className="home-hero">
        <div className="home-icon">📖</div>
        <h1 className="home-title">릴레이 소설</h1>
        <p className="home-subtitle">친구들과 함께 한 문장씩 이어가는<br />우리들의 이야기</p>
      </div>

      <div className="home-buttons">
        <button className="btn btn-teacher" onClick={onTeacher}>
          <span className="btn-icon">👩‍🏫</span>
          <span>선생님</span>
        </button>
        <button className="btn btn-student" onClick={onStudent}>
          <span className="btn-icon">🙋</span>
          <span>학생</span>
        </button>
      </div>
    </div>
  );
}
