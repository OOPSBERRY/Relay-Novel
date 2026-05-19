export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { text } = req.query;
  if (!text || text.trim().length === 0) return res.json({ result: null });

  try {
    // 부산대 한국어 맞춤법/문법 검사기
    const params = new URLSearchParams({ text1: text.trim() });
    const response = await fetch('https://speller.cs.pusan.ac.kr/results', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://speller.cs.pusan.ac.kr/',
      },
      body: params.toString(),
    });

    if (!response.ok) throw new Error(`status ${response.status}`);
    const data = await response.json();

    // 부산대 응답 → 기존 네이버 형식으로 변환
    const errors = (data?.errInfo || []).map(e => ({
      str_before: e.orgStr,
      str_after: e.candWord?.split('|')[0] || e.orgStr,
      error_idx: 1,
      info_msg: e.help || '',
    }));

    return res.json({
      message: {
        result: {
          errata_count: errors.length,
          result: errors,
        }
      }
    });
  } catch (e) {
    return res.json({ error: true, message: e.message });
  }
}
