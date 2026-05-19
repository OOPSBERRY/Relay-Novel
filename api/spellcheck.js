export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { text } = req.query;
  if (!text || text.trim().length === 0) return res.json({ result: null });

  try {
    const response = await fetch(
      `https://m.search.naver.com/p/csearch/ocontent/util/SpellerProxy?q=${encodeURIComponent(text)}&color_blindness=0`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
          'Referer': 'https://search.naver.com/search.naver?query=%EB%A7%9E%EC%B6%A4%EB%B2%95+%EA%B2%80%EC%82%AC%EA%B8%B0',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://search.naver.com',
        },
      }
    );

    if (!response.ok) return res.json({ error: true, status: response.status });
    const data = await response.json();
    return res.json(data);
  } catch (e) {
    return res.json({ error: true, message: e.message });
  }
}
