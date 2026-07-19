# ✈️ Travel Journal — 旅行日誌

> 把旅途回憶變成一本可匯出的精美日誌

**Demo**: https://travel-journal-k5ajw7s93-vernessa0607-7160s-projects.vercel.app

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript" />
  <img src="https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite" />
  <img src="https://img.shields.io/badge/Tailwind-4.x-06B6D4?logo=tailwindcss" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" />
</p>

---

## ✨ 功能

- **📸 照片上傳** — 支援多張照片上傳，自動生成縮圖
- **🗓️ 按日分組** — 照片自動按拍攝日期分組，形成每日行程
- **📝 行程編輯** — 為每一天添加標題、地點、文字記錄
- **📄 PDF 匯出** — 一鍵生成精美 PDF 旅行日誌（使用 html2canvas + jsPDF）
- **🤖 AI 照片說明** — 使用 Gemini Vision 自動為照片生成繁中說明（需自備 API Key）
- **💾 離線儲存** — Dexie IndexedDB 本地儲存，資料不流失
- **📱 響應式設計** — 手機、平板、桌面都適用

---

## 🛠️ 技術棧

| 層 | 技術 |
|----|------|
| **框架** | React 19 + Vite |
| **語言** | TypeScript |
| **樣式** | Tailwind CSS v4 |
| **本地儲存** | Dexie (IndexedDB) |
| **PDF 生成** | html2canvas + jsPDF |
| **圖示** | Lucide React |

---

## 🚀 快速開始

```bash
cd travel-journal
npm install
npm run dev
```

開啟瀏覽器訪問 `http://localhost:5173`

### 建構

```bash
npm run build
```

輸出至 `dist/` 目錄。

---

## 📁 專案結構

```
travel-journal/
├── src/
│   ├── App.tsx           # 主應用
│   ├── db.ts             # Dexie 資料庫定義
│   └── ...
├── index.html
└── package.json
```

---

## 📝 License

MIT License © 2026
