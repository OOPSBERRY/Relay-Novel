import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

// ===== 서버 시계 맞추기 =====
// 기기마다 시계가 조금씩 달라서 같은 turn_started_at을 보고도 남은 시간이 다르게 계산될 수 있다.
// /api/time(서버 시각)과의 차이를 한 번 재서 모든 시간 계산에 쓴다.
let clockOffset = 0;

export async function syncClock() {
  try {
    const t0 = Date.now();
    const res = await fetch('/api/time', { cache: 'no-store' });
    const t1 = Date.now();
    const { now } = await res.json();
    if (typeof now === 'number') clockOffset = now - (t0 + t1) / 2;
  } catch {
    clockOffset = 0; // 로컬 개발 환경 등 /api/time이 없으면 기기 시계 사용
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

const sameTime = (a, b) => !!a && !!b && new Date(a).getTime() === new Date(b).getTime();

// ===== 차례 넘기기 (제출 / 패스) =====
// 여러 기기(교사, 현재 학생, 다른 학생)가 동시에 넘기려 해도 딱 한 번만 넘어가도록
// turn_started_at이 그대로일 때만 갱신되는 조건부 update로 "차례를 잡은" 쪽만 문장을 넣는다.
//
// expectedStartedAt: 호출한 화면이 보고 있던 차례의 turn_started_at
// action: { type: 'skip', force? } 또는 { type: 'submit', playerId, playerName, text }
// 반환: { ok: true } / { ok: false, reason: 'turn-changed' | 'not-expired' | 'not-playing' | 'error' }
export async function advanceTurn(roomCode, expectedStartedAt, action) {
  try {
    const { data: room } = await supabase.from('rooms').select('*').eq('code', roomCode).single();
    if (!room || room.status !== 'playing') return { ok: false, reason: 'not-playing' };
    if (!sameTime(room.turn_started_at, expectedStartedAt)) return { ok: false, reason: 'turn-changed' };

    const { data: sents } = await supabase
      .from('sentences').select('id, skipped').eq('room_code', roomCode);
    const all = sents || [];
    const { currentId, currentName } = getTurnInfo(room, all);

    if (action.type === 'submit' && currentId !== action.playerId) {
      return { ok: false, reason: 'turn-changed' };
    }
    if (action.type === 'skip' && !action.force) {
      const elapsed = (serverNow() - new Date(room.turn_started_at).getTime()) / 1000;
      if (!room.turn_time_limit || elapsed < room.turn_time_limit) return { ok: false, reason: 'not-expired' };
    }

    // 1) 차례 잡기: turn_started_at이 아직 그대로일 때만 성공
    const { data: claimed } = await supabase
      .from('rooms')
      .update({ turn_started_at: new Date(serverNow()).toISOString() })
      .eq('code', roomCode)
      .eq('status', 'playing')
      .eq('turn_started_at', room.turn_started_at)
      .select('code');
    if (!claimed || claimed.length === 0) return { ok: false, reason: 'turn-changed' };

    // 2) 문장(또는 패스) 기록
    const isSkip = action.type === 'skip';
    await supabase.from('sentences').insert({
      room_code: roomCode,
      text: isSkip ? '(패스)' : action.text,
      player_name: isSkip ? currentName : action.playerName,
      order_index: all.length,
      skipped: isSkip,
    });

    // 3) 실제 문장 수가 목표에 닿으면 종료 (패스는 문장 수에 넣지 않음)
    const realCount = all.filter(s => !s.skipped).length + (isSkip ? 0 : 1);
    if (realCount >= room.max_sentences) {
      await supabase.from('rooms').update({ status: 'finished' }).eq('code', roomCode);
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
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
