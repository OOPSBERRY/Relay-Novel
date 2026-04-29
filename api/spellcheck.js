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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://search.naver.com/',
          'Accept': 'application/json, text/javascript, */*',
        },
      }
    );

    if (!response.ok) throw new Error('spell check api error');
    const data = await response.json();
    return res.json(data);
  } catch {
    return res.json({ error: true });
  }
}
