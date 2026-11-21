// 내 차례가 됐을 때 알림: 진동 + 짧은 소리 + 탭 제목 바꾸기
let audioCtx = null;

// 브라우저는 사용자가 한 번 화면을 눌러야 소리를 허락한다.
// 입장 버튼 등을 누를 때 미리 깨워 두면 이후 알림 소리가 난다.
export function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* 소리를 못 내는 기기는 무시 */ }
}

function playChime() {
  try {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const now = audioCtx.currentTime;
    // 두 음짜리 부드러운 종소리 (도 → 솔)
    [[523.25, 0], [783.99, 0.16]].forEach(([freq, delay]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.25, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.6);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.65);
    });
  } catch { /* 무시 */ }
}

export function notifyMyTurn() {
  try { navigator.vibrate?.([180, 90, 180]); } catch { /* 무시 */ }
  playChime();
}
