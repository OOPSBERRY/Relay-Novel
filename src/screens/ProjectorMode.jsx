import { QRCodeSVG } from 'qrcode.react';

// players를 넘기면 대기실(입장한 학생 목록), 넘기지 않으면 진행 중(다시 들어오기 안내)
export default function ProjectorMode({ roomCode, roomTitle, players, onRemovePlayer, onClose }) {
  const appUrl = window.location.origin;
  const joinUrl = `${appUrl}/?code=${roomCode}`;

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
                value={joinUrl}
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

        {players ? (
          <div className="projector-students">
            <p className="projector-students-label">
              입장한 학생 <span className="projector-count">{players.length}명</span>
            </p>
            <div className="projector-student-list">
              {players.length === 0 ? (
                <span className="projector-waiting">학생들을 기다리는 중...</span>
              ) : (
                players.map(p => (
                  <span key={p.id} className="projector-student-chip">
                    {p.name}
                    {onRemovePlayer && (
                      <button
                        className="projector-student-remove"
                        onClick={() => onRemovePlayer(p)}
                        aria-label={`${p.name} 내보내기`}
                        title="내보내기"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>
          </div>
        ) : (
          // 이야기 진행 중: 튕겨 나간 학생 다시 들어오기 안내
          <div className="projector-students">
            <p className="projector-rejoin">
              화면이 꺼졌거나 튕겨 나갔다면<br />
              QR을 찍거나 방 코드를 넣고, <span className="projector-count">처음과 같은 이름</span>으로 들어오세요.<br />
              내 자리로 돌아갑니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
