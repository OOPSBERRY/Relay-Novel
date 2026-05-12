import { QRCodeSVG } from 'qrcode.react';

export default function ProjectorMode({ roomCode, roomTitle, players, onClose }) {
  const appUrl = window.location.origin;

  return (
    <div className="projector-overlay">
      <button className="projector-close" onClick={onClose}>✕ 닫기</button>

      <div className="projector-content">
        <p className="projector-app-name">릴레이 서재</p>

        <div className="projector-main">
          <div className="projector-left">
            <p className="projector-label">방 코드</p>
            <div className="projector-code">{roomCode}</div>
            <p className="projector-title">"{roomTitle}"</p>
          </div>

          <div className="projector-divider" />

          <div className="projector-right">
            <div className="projector-qr-wrap">
              <QRCodeSVG
                value={appUrl}
                size={200}
                bgColor="#FFFFFF"
                fgColor="#1C1C2E"
                level="M"
              />
            </div>
            <p className="projector-qr-hint">QR 스캔 또는 코드 입력</p>
            <p className="projector-qr-url">{appUrl}</p>
          </div>
        </div>

        <div className="projector-students">
          <p className="projector-students-label">
            입장한 학생 <span className="projector-count">{players.length}명</span>
          </p>
          <div className="projector-student-list">
            {players.length === 0 ? (
              <span className="projector-waiting">학생들을 기다리는 중...</span>
            ) : (
              players.map(p => (
                <span key={p.id} className="projector-student-chip">{p.name}</span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
