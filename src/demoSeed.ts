import { db, type Photo, type Trip } from './db';

// 示範資料：讓訪客不用上傳自己的照片，也能看到排版好的成品長什麼樣。
// 圖片是內嵌 SVG，不打任何外部請求。

const img = (c1: string, c2: string, title: string, sub: string, shape: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="440" viewBox="0 0 640 440">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>` +
      `<rect width="640" height="440" fill="url(#g)"/>${shape}` +
      `<rect x="0" y="344" width="640" height="96" fill="#000000" opacity="0.24"/>` +
      `<text x="32" y="386" font-family="system-ui,sans-serif" font-size="21" font-weight="600" fill="#FFFFFF">${title}</text>` +
      `<text x="32" y="414" font-family="system-ui,sans-serif" font-size="14" fill="#FFFFFF" opacity="0.82">${sub}</text>` +
      `</svg>`
  );

const sun = `<circle cx="512" cy="96" r="46" fill="#FFFFFF" opacity="0.22"/>`;
const hills = `<path d="M0 300 L150 196 L268 288 L372 222 L520 316 L640 250 L640 440 L0 440 Z" fill="#000000" opacity="0.18"/>`;
const waves =
  `<path d="M0 296 Q80 274 160 296 T320 296 T480 296 T640 296 L640 440 L0 440 Z" fill="#FFFFFF" opacity="0.12"/>` +
  `<path d="M0 328 Q80 306 160 328 T320 328 T480 328 T640 328 L640 440 L0 440 Z" fill="#FFFFFF" opacity="0.10"/>`;
const city =
  `<rect x="72" y="204" width="56" height="140" fill="#000000" opacity="0.20"/>` +
  `<rect x="150" y="164" width="44" height="180" fill="#000000" opacity="0.24"/>` +
  `<rect x="214" y="232" width="70" height="112" fill="#000000" opacity="0.18"/>` +
  `<rect x="308" y="140" width="52" height="204" fill="#000000" opacity="0.26"/>` +
  `<rect x="384" y="212" width="62" height="132" fill="#000000" opacity="0.20"/>`;

const now = Date.now();
const day = 86400000;

const p = (id: string, fileName: string, src: string, dayIndex: number, caption: string, ago: number): Photo => ({
  id, fileName, src, thumbnail: src, dayIndex, caption, createdAt: now - ago * day,
});

const photos: Photo[] = [
  p('tj-1', 'DSC_0112.JPG', img('#8FB4C9', '#E3CDA6', '殘波岬', '風大到講話要用喊的', sun + waves), 0, '第一站就直接去海邊，行李都還沒放。', 47),
  p('tj-2', 'DSC_0138.JPG', img('#DDB893', '#8A6A4F', '古宇利大橋', '整條路都是海', hills), 0, '騎車過橋那段，兩邊都是水。', 47),
  p('tj-3', 'DSC_0204.JPG', img('#C9A88F', '#6E5847', '國際通的巷子', '找了四十分鐘的那家店', city), 1, '導航一直把我們帶到後門。最後是聞到味道找到的。', 46),
  p('tj-4', 'DSC_0233.JPG', img('#A8C4A2', '#4F6B52', '備瀨福木林道', '樹縫裡的光', hills), 1, '整條路只有我們，安靜到會想放慢腳步。', 46),
  p('tj-5', 'DSC_0301.JPG', img('#6E7FA8', '#2C3350', '回程班機', '最後一晚的雲', sun), 2, '起飛前那十分鐘，決定明年還要再來。', 45),
];

const trips: Trip[] = [
  {
    id: 'tj-trip-1',
    title: '沖繩三天',
    subtitle: '慢慢走的那一次',
    coverPhotoId: 'tj-1',
    startDate: now - 47 * day,
    endDate: now - 45 * day,
    location: '沖繩',
    template: 'magazine',
    photoIds: ['tj-1', 'tj-2', 'tj-3', 'tj-4', 'tj-5'],
    days: [
      { index: 0, title: '第一天 · 直接往海邊', description: '落地就往北開，行李是回飯店前最後才放的。', photoIds: ['tj-1', 'tj-2'] },
      { index: 1, title: '第二天 · 市區與林道', description: '上午在國際通繞路，下午躲進備瀨的樹蔭裡。', photoIds: ['tj-3', 'tj-4'] },
      { index: 2, title: '第三天 · 回程', description: '沒有安排行程，只在機場看雲。', photoIds: ['tj-5'] },
    ],
    createdAt: now - 45 * day,
    updatedAt: now - 44 * day,
  },
];

export const DEMO_FLAG = 'travel_journal_demo_loaded';

export async function loadDemoData() {
  await db.transaction('rw', db.photos, db.trips, async () => {
    for (const ph of photos) await db.photos.put(ph);
    for (const t of trips) await db.trips.put(t);
  });
  localStorage.setItem(DEMO_FLAG, '1');
}
