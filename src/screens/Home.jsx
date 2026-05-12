import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function Home({ onTeacher, onStudent, onLibrary }) {
  const [showQR, setShowQR] = useState(false);
  const appUrl = window.location.origin;

  return (
    <div className="home-screen">
      <div className="home-top">
        <button className="qr-btn" onClick={() => setShowQR(true)} title="QR 코드 보기">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
            <rect x="19" y="14" width="2" height="2"/><rect x="14" y="19" width="2" height="2"/>
            <rect x="18" y="19" width="3" height="2"/><rect x="19" y="17" width="2" height="1"/>
          </svg>
        </button>

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

      {showQR && (
        <div className="qr-overlay" onClick={() => setShowQR(false)}>
          <div className="qr-modal" onClick={e => e.stopPropagation()}>
            <button className="qr-close" onClick={() => setShowQR(false)}>×</button>
            <p className="qr-title">릴레이 서재</p>
            <p className="qr-sub">QR 코드를 스캔해서 접속하세요</p>
            <div className="qr-code-wrap">
              <QRCodeSVG
                value={appUrl}
                size={220}
                bgColor="#FFFFFF"
                fgColor="#6D28D9"
                level="M"
              />
            </div>
            <p className="qr-url">{appUrl}</p>
          </div>
        </div>
      )}
    </div>
  );
}
