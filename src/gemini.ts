const MODEL = 'gemini-2.5-flash';

export function getApiKey(): string {
  try {
    return localStorage.getItem('travel_gemini_key') ?? '';
  } catch {
    // 無痕模式等環境可能擋 localStorage，Gemini 是選配功能，沒有 key 就當作沒設定。
    return '';
  }
}

export function saveApiKey(key: string) {
  try {
    if (key.trim()) localStorage.setItem('travel_gemini_key', key.trim());
    else localStorage.removeItem('travel_gemini_key');
  } catch (err) {
    console.warn('Failed to save API key:', err);
  }
}

export async function generatePhotoCaption(src: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('請先設定 Gemini API Key');

  // src is a data URL: "data:<mimeType>;base64,<data>"
  const match = src.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('無效的圖片格式');
  const [, mimeType, data] = match;

  let resp: Response;
  try {
    resp = await fetch(
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
        signal: AbortSignal.timeout(20000),
      }
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error('AI 說明生成逾時，請稍後再試');
    }
    throw new Error('無法連線到 AI 服務，請檢查網路連線');
  }

  if (!resp.ok) {
    // 錯誤代碼給使用者看沒問題，但避免把後端原文（可能含技術細節）整包丟出去
    throw new Error(resp.status === 429 ? 'AI 服務目前忙碌，請稍後再試' : `AI 說明生成失敗（錯誤代碼 ${resp.status}）`);
  }

  const json = await resp.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('AI 沒有回傳有效的說明文字，可能是內容審查機制擋下了這張照片');
  }
  return text.trim();
}
