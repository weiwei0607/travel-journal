const MODEL = 'gemini-2.5-flash';

export function getApiKey(): string {
  return localStorage.getItem('travel_gemini_key') ?? '';
}

export function saveApiKey(key: string) {
  if (key.trim()) localStorage.setItem('travel_gemini_key', key.trim());
  else localStorage.removeItem('travel_gemini_key');
}

export async function generatePhotoCaption(src: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('請先設定 Gemini API Key');

  // src is a data URL: "data:<mimeType>;base64,<data>"
  const match = src.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('無效的圖片格式');
  const [, mimeType, data] = match;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType, data } },
            { text: '這是一張旅遊照片。請用繁體中文寫一句簡短生動的說明（15-25字以內），描述照片的主題或情境。只輸出說明文字，不要加任何標點符號以外的內容。' },
          ]
        }],
      }),
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `API 錯誤 ${resp.status}`);
  }

  const json = await resp.json() as { candidates: { content: { parts: { text: string }[] } }[] };
  return json.candidates[0].content.parts[0].text.trim();
}
