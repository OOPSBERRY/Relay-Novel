// 기기 간 시계 차이를 맞추기 위한 서버 시각
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ now: Date.now() });
}
