// 데이터베이스에 쓰는 동작은 모두 여기 있는 서버 함수(rpc)로만 한다.
// (표는 읽기만 가능하고, 교사용 동작은 서버가 비밀번호를 확인한다 — schema_v7_security.sql)
import { supabase } from './supabase';

const MESSAGES = {
  TITLE_REQUIRED: '소설 제목을 입력해주세요.',
  PASSWORD_TOO_SHORT: '교사 비밀번호를 4자리 이상 입력해주세요.',
  BAD_SETTINGS: '설정값을 다시 확인해주세요.',
  BAD_CLASS_CODE: '반 코드는 숫자 4자리예요.',
  CLASS_NAME_REQUIRED: '처음 만드는 반 서재라면 반 이름을 입력해주세요. (이미 있는 반이라면 그 반을 만들 때 쓴 비밀번호인지 확인해주세요.)',
  NO_FREE_CODE: '빈 방 코드를 찾지 못했어요. 잠시 후 다시 시도해주세요.',
  BAD_NAME: '이름을 다시 확인해주세요.',
  ROOM_NOT_FOUND: '방을 찾을 수 없어요. 코드를 다시 확인해주세요.',
  ROOM_NOT_WAITING: '이미 시작된 방이에요.',
  DUPLICATE_NAME: '이미 같은 이름으로 들어온 친구가 있어요. 이름 뒤에 번호나 글자를 붙여 주세요. (내가 아까 들어왔다가 나간 거라면 선생님께 말해 주세요.)',
  NOT_ENOUGH_PLAYERS: '학생 수가 모자라요.',
  FORBIDDEN: '교사 비밀번호가 맞지 않아요. 처음 화면에서 다시 들어와 주세요.',
};

// 서버 오류 코드를 사람이 읽을 문장으로
export function errorMessage(error, fallback = '오류가 발생했어요. 다시 시도해주세요.') {
  const text = error?.message || '';
  const code = Object.keys(MESSAGES).find(k => text.includes(k));
  return code ? MESSAGES[code] : fallback;
}

export function isError(error, code) {
  return (error?.message || '').includes(code);
}

async function call(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

export const api = {
  serverNow: () => call('server_now'),

  verifyTeacher: (code, password) =>
    call('verify_teacher', { p_code: code, p_password: password }),

  createRoom: ({ title, hint, maxSentences, timeLimit, password, classCode, className }) =>
    call('create_room', {
      p_title: title,
      p_hint: hint,
      p_max_sentences: maxSentences,
      p_time_limit: timeLimit,
      p_password: password,
      p_class_code: classCode || null,
      p_class_name: className || null,
    }),

  joinRoom: (code, name) => call('join_room', { p_code: code, p_name: name }),

  removePlayer: (code, password, playerId) =>
    call('remove_player', { p_code: code, p_password: password, p_player_id: playerId }),

  startSingle: (code, password) => call('start_single', { p_code: code, p_password: password }),

  startGroups: (code, password, groupCount) =>
    call('start_groups', { p_code: code, p_password: password, p_group_count: groupCount }),

  endRoom: (code, password) => call('end_room', { p_code: code, p_password: password }),

  // 결과: 'ok' | 'turn-changed' | 'not-expired' | 'not-playing' | 'forbidden' | 'bad-text'
  advanceTurn: (code, expectedStartedAt, { type, playerId, text, force, password }) =>
    call('advance_turn', {
      p_code: code,
      p_expected_started_at: expectedStartedAt,
      p_type: type,
      p_player_id: playerId ?? null,
      p_text: text ?? null,
      p_force: !!force,
      p_password: password ?? null,
    }),

  openClass: (classCode, password) =>
    call('open_class', { p_class_code: classCode, p_password: password }),

  verifyClass: (classId, password) =>
    call('verify_class', { p_class_id: classId, p_password: password }),

  removeFromLibrary: (classId, password, roomCode) =>
    call('remove_from_library', { p_class_id: classId, p_password: password, p_room_code: roomCode }),
};
