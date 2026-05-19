/**
 * 릴레이 서재 - 다인원 테스트 스크립트
 * 사용법: node test-players.js <방코드> [인원수=20]
 * 예시:  node test-players.js 1234 20
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// .env에서 Supabase 정보 읽기
const envText = readFileSync('.env', 'utf8');
const urlMatches = [...envText.matchAll(/VITE_SUPABASE_URL=([^\s&]+)/g)];
const keyMatches = [...envText.matchAll(/VITE_SUPABASE_ANON_KEY=([^\s&]+)/g)];
const env = {
  url: urlMatches.at(-1)?.[1]?.trim(),
  key: keyMatches.at(-1)?.[1]?.trim(),
};

if (!env.url || !env.key) {
  console.error('.env에서 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 찾을 수 없어요.');
  process.exit(1);
}

const supabase = createClient(env.url, env.key);

const NAMES = [
  '김민준', '이지은', '박서준', '최유나', '정하준',
  '강민서', '조현우', '윤서연', '장지호', '임나연',
  '한도윤', '신예린', '오시우', '문지아', '배준혁',
  '안소율', '류건우', '권하린', '허태민', '남지수',
  '송가은', '전준서', '황다은', '노태현', '백서아',
];

const SENTENCES = [
  '그 순간 모두가 숨을 죽였다.',
  '하늘에서 별이 하나 떨어졌다.',
  '문을 열자 차가운 바람이 밀려왔다.',
  '갑자기 누군가 뒤에서 어깨를 잡았다.',
  '그것은 생각보다 훨씬 크고 빛났다.',
  '우리는 서로를 바라보며 웃음을 터트렸다.',
  '저 멀리서 이상한 소리가 들려왔다.',
  '발밑에 무언가 반짝이는 것이 있었다.',
  '그날 이후 모든 것이 달라지기 시작했다.',
  '아무도 예상하지 못한 일이 벌어졌다.',
  '시계가 딱 멈추는 순간이었다.',
  '창문 너머로 낯선 그림자가 지나갔다.',
  '그 편지에는 단 한 줄만 적혀 있었다.',
  '갑자기 불이 꺼지며 방이 어두워졌다.',
  '작은 상자 안에는 뜻밖의 선물이 들어 있었다.',
  '그 말을 듣자마자 모두가 자리에서 일어났다.',
  '오래된 지도가 손 안에서 빛을 발하기 시작했다.',
  '그것은 단순한 우연이 아니었다.',
  '두 눈을 감았다 뜨자 풍경이 완전히 바뀌어 있었다.',
  '조용히 발걸음을 옮겼지만 바닥이 삐걱거렸다.',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function joinPlayers(roomCode, count) {
  const players = [];
  console.log(`\n📥 ${count}명 입장 중...`);

  for (let i = 0; i < count; i++) {
    const id = crypto.randomUUID();
    const name = NAMES[i % NAMES.length] + (i >= NAMES.length ? (Math.floor(i / NAMES.length) + 1) : '');
    const { error } = await supabase.from('players').insert({ id, room_code: roomCode, name });
    if (error) {
      console.error(`  ✗ ${name} 실패: ${error.message}`);
      continue;
    }
    players.push({ id, name });
    process.stdout.write(`  ✓ ${name}  `);
    if ((i + 1) % 5 === 0) process.stdout.write('\n');
    await sleep(80);
  }
  console.log(`\n\n✅ ${players.length}명 입장 완료. 선생님 화면에서 시작 버튼을 눌러주세요!\n`);
  return players;
}

async function waitForStatus(roomCode, ...statuses) {
  while (true) {
    const { data } = await supabase.from('rooms').select('status, player_order, player_names, max_sentences, hint').eq('code', roomCode).single();
    if (data && statuses.includes(data.status)) return data;
    await sleep(1000);
  }
}

async function playRoom(roomCode, players, label = '') {
  const prefix = label ? `[${label}] ` : '';
  console.log(`${prefix}▶ 게임 시작 감지!`);

  while (true) {
    const { data: room } = await supabase.from('rooms').select('status, player_order, player_names, max_sentences').eq('code', roomCode).single();
    if (!room || room.status === 'finished') {
      console.log(`${prefix}🏁 완료!`);
      break;
    }

    const { data: sentences } = await supabase
      .from('sentences').select('id, order_index').eq('room_code', roomCode).eq('skipped', false);
    const count = (sentences || []).length;
    const playerCount = room.player_order.length;
    const currentIdx = count % playerCount;
    const currentId = room.player_order[currentIdx];

    const myPlayer = players.find(p => p.id === currentId);
    if (myPlayer) {
      const sentence = SENTENCES[count % SENTENCES.length];
      const orderIndex = (sentences || []).length;
      const isLast = orderIndex + 1 >= room.max_sentences;

      await supabase.from('sentences').insert({
        room_code: roomCode,
        text: sentence,
        player_name: myPlayer.name,
        order_index: orderIndex,
        skipped: false,
      });
      await supabase.from('rooms').update({
        turn_started_at: new Date().toISOString(),
        ...(isLast ? { status: 'finished' } : {}),
      }).eq('code', roomCode);

      console.log(`${prefix}✍️  ${myPlayer.name}: "${sentence}" (${orderIndex + 1}/${room.max_sentences})`);
      await sleep(300);
    } else {
      await sleep(500);
    }
  }
}

async function main() {
  const roomCode = process.argv[2];
  const count = Number(process.argv[3] || 20);

  if (!roomCode || roomCode.length !== 4) {
    console.log('사용법: node test-players.js <방코드4자리> [인원수]');
    console.log('예시:   node test-players.js 1234 20');
    process.exit(1);
  }

  // 방 존재 확인
  const { data: room } = await supabase.from('rooms').select('status, title').eq('code', roomCode).single();
  if (!room) { console.error('방을 찾을 수 없어요.'); process.exit(1); }
  if (room.status !== 'waiting') { console.error(`방이 이미 "${room.status}" 상태예요.`); process.exit(1); }

  console.log(`\n🎮 "${room.title}" (방 코드: ${roomCode})`);

  const players = await joinPlayers(roomCode, count);

  // 시작 대기
  const started = await waitForStatus(roomCode, 'playing', 'group_monitoring');

  if (started.status === 'playing') {
    // 전체 한 팀 모드
    await playRoom(roomCode, players);

  } else if (started.status === 'group_monitoring') {
    // 모둠 모드: player_order에 그룹 방 코드들이 들어있음
    const groupCodes = started.player_order || [];
    console.log(`\n👥 ${groupCodes.length}개 모둠으로 나뉘었어요: ${groupCodes.join(', ')}\n`);

    // 각 모둠별로 내 플레이어 찾아서 병렬 진행
    const groupPromises = groupCodes.map(async (gCode, i) => {
      const { data: gRoom } = await supabase.from('rooms').select('player_names, player_order').eq('code', gCode).single();
      if (!gRoom) return;
      const myPlayers = players.filter(p => Object.keys(gRoom.player_names || {}).includes(p.id));
      if (myPlayers.length === 0) return;
      console.log(`${i+1}모둠 (${gCode}): ${myPlayers.map(p=>p.name).join(', ')}`);
      await playRoom(gCode, myPlayers, `${i+1}모둠`);
    });

    await Promise.all(groupPromises);
    console.log('\n🎉 모든 모둠 완료!');
  }
}

main().catch(console.error);
node test-players.js 9155 20