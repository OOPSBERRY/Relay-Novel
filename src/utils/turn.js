import { useEffect, useState } from 'react';
import { api } from '../api';

// ===== 서버 시계 맞추기 =====
// 차례 시작 시각(turn_started_at)은 데이터베이스 시계로 기록된다.
// 기기마다 시계가 조금씩 달라서, 데이터베이스 시각과의 차이를 한 번 재서 모든 시간 계산에 쓴다.
let clockOffset = 0;

export async function syncClock() {
  try {
    const t0 = Date.now();
    const now = await api.serverNow();
    const t1 = Date.now();
    const server = new Date(now).getTime();
    if (!Number.isNaN(server)) clockOffset = server - (t0 + t1) / 2;
  } catch {
    clockOffset = 0; // 실패하면 기기 시계 사용
  }
}

export const serverNow = () => Date.now() + clockOffset;

// ===== 차례 계산 =====
// 패스도 한 차례로 친다. (예전엔 패스를 빼고 세서, 시간 초과된 학생에게 차례가 다시 돌아갔다)
export function getTurnInfo(room, sentences) {
  const hintOffset = room?.hint?.trim() ? 1 : 0;
  const order = room?.player_order || [];
  const playerCount = order.length || 1;
  const turnsTaken = Math.max(0, sentences.length - hintOffset);
  const currentIdx = turnsTaken % playerCount;
  const currentId = order[currentIdx];
  const realCount = sentences.filter(s => !s.skipped).length;
  return {
    hintOffset,
    playerCount,
    currentIdx,
    currentId,
    currentName: (room?.player_names || {})[currentId] || '',
    progress: realCount - hintOffset,
    total: (room?.max_sentences || 0) - hintOffset,
  };
}

export function calcTimeLeft(room) {
  if (!room?.turn_time_limit || !room?.turn_started_at) return null;
  const elapsed = (serverNow() - new Date(room.turn_started_at).getTime()) / 1000;
  // 설정한 시간보다 길게 표시되는 일이 없도록 상한을 둔다
  return Math.min(room.turn_time_limit, Math.max(0, Math.ceil(room.turn_time_limit - elapsed)));
}

export function useTimeLeft(room) {
  const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft(room));
  useEffect(() => {
    setTimeLeft(calcTimeLeft(room));
    if (!room?.turn_time_limit || !room?.turn_started_at || room?.status !== 'playing') return;
    const id = setInterval(() => setTimeLeft(calcTimeLeft(room)), 500);
    return () => clearInterval(id);
  }, [room?.turn_started_at, room?.turn_time_limit, room?.status]);
  return timeLeft;
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// ===== 차례 넘기기 (제출 / 패스) =====
// 서버 함수 advance_turn이 방을 잠그고 처리하므로, 여러 기기가 동시에 넘기려 해도 한 번만 넘어간다.
//
// expectedStartedAt: 호출한 화면이 보고 있던 차례의 turn_started_at (서버에서 받은 문자열 그대로)
// action: { type: 'skip', force?, password? } 또는 { type: 'submit', playerId, text }
// 반환: { ok: true } / { ok: false, reason: 'turn-changed' | 'not-expired' | 'not-playing' | 'forbidden' | 'bad-text' | 'error' }
export async function advanceTurn(roomCode, expectedStartedAt, action) {
  // 기기 시계가 서버보다 조금 빠르면 서버는 아직 시간이 안 됐다고 본다 → 잠깐 뒤 다시 시도
  const tries = action.type === 'skip' && !action.force ? 5 : 1;
  for (let i = 0; i < tries; i++) {
    try {
      const result = await api.advanceTurn(roomCode, expectedStartedAt, action);
      if (result === 'ok') return { ok: true };
      if (result !== 'not-expired' || i === tries - 1) return { ok: false, reason: result };
    } catch {
      return { ok: false, reason: 'error' };
    }
    await wait(1500);
  }
  return { ok: false, reason: 'error' };
}

// 시간이 다 되면 delayMs 뒤에 자동으로 패스. 여러 화면이 동시에 불러도 한 번만 넘어간다.
export function useAutoSkip(roomCode, room, timeLeft, delayMs) {
  const expired = timeLeft === 0;
  const startedAt = room?.turn_started_at;
  useEffect(() => {
    if (!expired || !startedAt || room?.status !== 'playing' || delayMs == null) return;
    const id = setTimeout(() => advanceTurn(roomCode, startedAt, { type: 'skip' }), delayMs);
    return () => clearTimeout(id);
  }, [expired, startedAt, room?.status, roomCode, delayMs]);
}
