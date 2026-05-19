/**
 * 릴레이 서재 - 자동 테스트
 * node test-full.js [single|group]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('.env', 'utf8');
const SUPABASE_URL = [...envText.matchAll(/VITE_SUPABASE_URL=([^\s&]+)/g)].at(-1)?.[1]?.trim();
const SUPABASE_KEY = [...envText.matchAll(/VITE_SUPABASE_ANON_KEY=([^\s&]+)/g)].at(-1)?.[1]?.trim();
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MODE         = process.argv[2] || 'group';
const PLAYER_COUNT = 20;
const GROUP_COUNT  = 5;
const MAX_TURNS    = 10;
const TURN_LIMIT   = 60; // 1분
const HINT         = '어느 날 교실에 이상한 문이 나타났다.';

const NAMES = ['김민준','이지은','박서준','최유나','정하준','강민서','조현우','윤서연','장지호','임나연',
               '한도윤','신예린','오시우','문지아','배준혁','안소율','류건우','권하린','허태민','남지수'];
const SENTENCES = ['그 순간 모두가 숨을 죽였다.','하늘에서 별이 하나 떨어졌다.','문을 열자 차가운 바람이 밀려왔다.',
  '갑자기 누군가 뒤에서 어깨를 잡았다.','그것은 생각보다 훨씬 크고 빛났다.','우리는 서로를 바라보며 웃음을 터트렸다.',
  '저 멀리서 이상한 소리가 들려왔다.','발밑에 무언가 반짝이는 것이 있었다.','그날 이후 모든 것이 달라지기 시작했다.',
  '아무도 예상하지 못한 일이 벌어졌다.'];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
const ok  = msg => console.log(`  ✅ ${msg}`);
const fail = msg => { console.log(`  ❌ ${msg}`); errors.push(msg); };
const log  = msg => console.log(`  ${msg}`);

async function genCode() {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const { data } = await supabase.from('rooms').select('code').eq('code', code)
      .in('status', ['waiting','playing','group_monitoring']).single();
    if (!data) return code;
  }
  throw new Error('방 코드 생성 실패');
}

async function main() {
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`🧪 테스트 조건: ${PLAYER_COUNT}명 / ${GROUP_COUNT}모둠 / 제한시간 ${TURN_LIMIT}초`);
  console.log(`${'─'.repeat(55)}\n`);

  // 1. 방 생성
  log('방 생성 중...');
  const roomCode = await genCode();
  const { error: roomErr } = await supabase.from('rooms').insert({
    code: roomCode,
    title: `[TEST] 5모둠 20명 1분제한`,
    hint: HINT,
    max_sentences: MAX_TURNS,
    teacher_password: 'test1234',
    status: 'waiting',
    player_order: [],
    player_names: {},
    turn_time_limit: TURN_LIMIT,
  });
  if (roomErr) { fail(`방 생성 실패: ${roomErr.message}`); return report(); }
  ok(`방 생성 완료 (코드: ${roomCode}, 제한시간: ${TURN_LIMIT}초)`);

  // 2. 20명 입장
  log(`${PLAYER_COUNT}명 입장 중...`);
  const players = NAMES.slice(0, PLAYER_COUNT).map(name => ({ id: crypto.randomUUID(), room_code: roomCode, name }));
  const { error: pErr } = await supabase.from('players').insert(players);
  if (pErr) { fail(`플레이어 입장 실패: ${pErr.message}`); return report(); }
  ok(`${PLAYER_COUNT}명 입장 완료`);

  // 3. 플레이어 수 검증
  const { count } = await supabase.from('players').select('*', { count:'exact', head:true }).eq('room_code', roomCode);
  if (count !== PLAYER_COUNT) fail(`플레이어 수 불일치: ${count}명`);
  else ok(`플레이어 수 확인: ${count}명`);

  // 4. 모둠 생성
  log(`\n${GROUP_COUNT}모둠 생성 중...`);
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const groups = Array.from({ length: GROUP_COUNT }, (_, i) => shuffled.filter((_, j) => j % GROUP_COUNT === i));
  const childCodes = [];
  const now = new Date().toISOString();
  const hasFirst = !!HINT.trim();

  for (let i = 0; i < GROUP_COUNT; i++) {
    const code = await genCode();
    const gPlayers = groups[i];
    const { error: gErr } = await supabase.from('rooms').insert({
      code,
      title: `[TEST] 5모둠 20명 1분제한`,
      hint: HINT,
      max_sentences: hasFirst ? MAX_TURNS + 1 : MAX_TURNS,
      teacher_password: 'test1234',
      status: 'playing',
      player_order: gPlayers.map(p => p.id),
      player_names: Object.fromEntries(gPlayers.map(p => [p.id, p.name])),
      turn_started_at: now,
      turn_time_limit: TURN_LIMIT,
    });
    if (gErr) { fail(`${i+1}모둠 방 생성 실패: ${gErr.message}`); continue; }

    await Promise.all([
      supabase.from('sentences').insert({ room_code: code, text: HINT, player_name: '선생님', order_index: 0, skipped: false }),
      ...gPlayers.map(p => supabase.from('players').update({ room_code: code }).eq('id', p.id)),
    ]);

    childCodes.push(code);
    log(`  ${i+1}모둠 (${gPlayers.length}명): ${gPlayers.map(p=>p.name).join(', ')}`);
  }

  const { error: parentErr } = await supabase.from('rooms').update({
    status: 'group_monitoring', player_order: childCodes,
  }).eq('code', roomCode);
  if (parentErr) fail(`부모 방 업데이트 실패: ${parentErr.message}`);
  else ok(`\n${GROUP_COUNT}모둠 생성 완료 (${childCodes.length}개)`);

  // 5. 각 모둠 플레이
  console.log('\n  ✍️  문장 작성 시작...');
  await Promise.all(childCodes.map(async (code, gi) => {
    const { data: gRoom } = await supabase.from('rooms').select('*').eq('code', code).single();
    const myPlayers = players.filter(p => Object.keys(gRoom?.player_names || {}).includes(p.id));
    let written = 0;

    for (let attempt = 0; attempt < 150; attempt++) {
      const { data: r } = await supabase.from('rooms').select('*').eq('code', code).single();
      if (!r || r.status === 'finished') {
        ok(`${gi+1}모둠 완성 (${written}문장)`);
        break;
      }
      const { data: s } = await supabase.from('sentences').select('*').eq('room_code', code).neq('skipped', true).order('order_index');
      const cnt = (s||[]).length;
      const hintOffset = 1;
      const playerCount = r.player_order.length;
      const currentIdx = (cnt - hintOffset) % playerCount;
      const currentId = r.player_order[Math.max(0, currentIdx)];
      const mine = myPlayers.find(p => p.id === currentId);

      if (mine) {
        const idx = cnt;
        const isLast = idx + 1 >= r.max_sentences;
        const { error: sErr } = await supabase.from('sentences').insert({
          room_code: code, text: SENTENCES[written % SENTENCES.length],
          player_name: mine.name, order_index: idx, skipped: false,
        });
        if (sErr) { fail(`${gi+1}모둠 문장 삽입 실패: ${sErr.message}`); break; }
        await supabase.from('rooms').update({
          turn_started_at: new Date().toISOString(),
          ...(isLast ? { status: 'finished' } : {}),
        }).eq('code', code);
        written++;
        process.stdout.write(`  [${gi+1}모둠] ${mine.name} (${idx+1}/${r.max_sentences})\n`);
        await sleep(80);
      } else {
        await sleep(150);
      }
    }
  }));

  // 6. 최종 검증
  console.log('\n  📊 최종 검증...');
  for (let i = 0; i < childCodes.length; i++) {
    const { data: r } = await supabase.from('rooms').select('status').eq('code', childCodes[i]).single();
    const { count: sc } = await supabase.from('sentences').select('*', { count:'exact', head:true })
      .eq('room_code', childCodes[i]).neq('skipped', true);
    if (r?.status === 'finished') ok(`${i+1}모둠: 완료 (문장 ${sc}개)`);
    else fail(`${i+1}모둠: 상태 이상 (${r?.status})`);
  }

  report();
}

function report() {
  console.log(`\n${'─'.repeat(55)}`);
  if (errors.length === 0) console.log('🎉 전체 테스트 통과 — 오류 없음');
  else { console.log(`⚠️  ${errors.length}개 오류:`); errors.forEach((e,i) => console.log(`  ${i+1}. ${e}`)); }
  console.log(`${'─'.repeat(55)}\n`);
}

main().catch(e => { fail(e.message); report(); });
