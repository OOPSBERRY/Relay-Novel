const BLOCKED = [
  // 욕설
  '씨발', '시발', '쉬발', '씨팔', '시팔', 'ㅅㅂ', 'ㅆㅂ', 'ㅅ발',
  '개새끼', '개새', '개쓰레기', '개놈', '개년',
  '미친놈', '미친년', '미친새끼', '미쳤냐', '미친',
  '병신', '벙신', 'ㅂㅅ', '병1신',
  '존나', '좆나', 'ㅈㄴ', '존내',
  '좆', 'ㅈ같', '좆같',
  '보지', 'ㅂㅈ',
  '자지', 'ㅈㅈ',
  '창녀', '창년', '창부',
  '썅', '쌍놈', '쌍년', '쌍욕',
  '지랄', 'ㅈㄹ',
  '개소리', '닥쳐', '꺼져',
  '뒤질', '뒈질', '뒈져', '죽어버려', '죽어라',
  '엿먹', '엿이나',
  '느그', '니애미', '니에미', '너희엄마',
  // 성적 표현
  '성기', '음경', '음부', '항문', '성교', '섹스', 'sex',
  // 영어 욕설
  'fuck', 'fuk', 'f**k', 'shit', 'sh*t', 'bitch', 'b*tch',
  'asshole', 'bastard', 'damn', 'crap', 'cock', 'dick', 'pussy',
];

export function containsProfanity(text) {
  const normalized = text.toLowerCase().replace(/\s+/g, '').replace(/[*!@#$%]/g, '');
  return BLOCKED.some(word => normalized.includes(word.toLowerCase().replace(/\s+/g, '')));
}
