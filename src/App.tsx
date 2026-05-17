import { useState, useEffect, useRef } from 'react';
import { db, type Trip, type TripDay, type Photo } from './db';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  Camera, Plus, Trash2, X, ChevronLeft, Download, Eye,
  Calendar, MapPin, Type, Layout, BookOpen,
  Loader2, ArrowUpDown,
  PenLine, Palette
} from 'lucide-react';

// --- UTILS ---
function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function createThumbnail(base64: string, maxSize = 300): Promise<string> {
  return new Promise((resolve) => {
    const img = document.createElement('img');
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(base64); // fall back to original if thumbnail creation fails
    img.src = base64;
  });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' });
}

function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
}

function groupPhotosByDay(photos: Photo[]): TripDay[] {
  const DAY_MS = 24 * 60 * 60 * 1000;
  if (photos.length === 0) return [];

  const sorted = [...photos].sort((a, b) => a.createdAt - b.createdAt);
  const days: TripDay[] = [];
  let currentDay: Photo[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].createdAt - sorted[i - 1].createdAt;
    if (gap < DAY_MS * 0.8) {
      currentDay.push(sorted[i]);
    } else {
      days.push({
        index: days.length,
        title: `第 ${days.length + 1} 天`,
        description: '',
        photoIds: currentDay.map(p => p.id),
      });
      currentDay = [sorted[i]];
    }
  }

  days.push({
    index: days.length,
    title: `第 ${days.length + 1} 天`,
    description: '',
    photoIds: currentDay.map(p => p.id),
  });

  return days;
}

// --- TEMPLATES ---
const templates = [
  {
    key: 'magazine' as const,
    name: '雜誌風',
    desc: '大膽排版、編輯感',
    preview: 'bg-neutral-900 text-white',
  },
  {
    key: 'minimal' as const,
    name: '極簡風',
    desc: '留白、優雅',
    preview: 'bg-white text-neutral-900 border',
  },
  {
    key: 'scrapbook' as const,
    name: '手帳風',
    desc: '溫暖、拼貼感',
    preview: 'bg-amber-50 text-amber-900 border-amber-200',
  },
];

// --- MAIN APP ---
function App() {
  const [view, setView] = useState<'list' | 'editor' | 'preview'>('list');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const pdfRef = useRef<HTMLDivElement | null>(null);

  // Load trips
  useEffect(() => {
    loadTrips();
  }, []);

  async function loadTrips() {
    const all = await db.trips.toArray();
    setTrips(all.sort((a, b) => b.updatedAt - a.updatedAt));
  }

  async function loadPhotosForTrip(trip: Trip) {
    const allPhotos = await db.photos.toArray();
    const tripPhotos = allPhotos.filter(p => trip.photoIds.includes(p.id));
    setPhotos(tripPhotos);
  }

  // Create new trip
  const createTrip = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    const uploaded: Photo[] = [];
    for (const file of Array.from(files).filter(f => f.type.startsWith('image/'))) {
      const base64 = await fileToBase64(file);
      const thumbnail = await createThumbnail(base64);
      // Try to get date from file lastModified
      const photo: Photo = {
        id: generateId(),
        fileName: file.name,
        src: base64,
        thumbnail,
        createdAt: file.lastModified || Date.now(),
      };
      await db.photos.add(photo);
      uploaded.push(photo);
    }

    const days = groupPhotosByDay(uploaded);
    const startDate = Math.min(...uploaded.map(p => p.createdAt));
    const endDate = Math.max(...uploaded.map(p => p.createdAt));

    const trip: Trip = {
      id: generateId(),
      title: `我的旅程 ${formatShortDate(startDate)}`,
      subtitle: `${uploaded.length} 張照片 · ${days.length} 天`,
      coverPhotoId: uploaded[0]?.id,
      startDate,
      endDate,
      days,
      photoIds: uploaded.map(p => p.id),
      template: 'magazine',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.trips.add(trip);
    setPhotos(uploaded);
    setActiveTrip(trip);
    setView('editor');
    setUploading(false);
    await loadTrips();
  };

  // Update trip
  const updateTrip = async (changes: Partial<Trip>) => {
    if (!activeTrip) return;
    const updated = { ...activeTrip, ...changes, updatedAt: Date.now() };
    await db.trips.update(activeTrip.id, updated);
    setActiveTrip(updated);
    await loadTrips();
  };

  const updateDay = (dayIndex: number, changes: Partial<TripDay>) => {
    if (!activeTrip) return;
    const newDays = activeTrip.days.map((d, i) =>
      i === dayIndex ? { ...d, ...changes } : d
    );
    updateTrip({ days: newDays });
  };

  const deleteTrip = async (id: string) => {
    if (!confirm('確定刪除這個旅程？')) return;
    const trip = await db.trips.get(id);
    if (trip) {
      await db.photos.bulkDelete(trip.photoIds);
      await db.trips.delete(id);
    }
    await loadTrips();
    if (activeTrip?.id === id) {
      setActiveTrip(null);
      setView('list');
    }
  };

  const movePhoto = (dayIndex: number, from: number, to: number) => {
    if (!activeTrip) return;
    const day = activeTrip.days[dayIndex];
    const ids = [...day.photoIds];
    const [removed] = ids.splice(from, 1);
    ids.splice(to, 0, removed);
    updateDay(dayIndex, { photoIds: ids });
  };

  const updatePhotoCaption = async (photoId: string, caption: string) => {
    await db.photos.update(photoId, { caption });
    setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, caption } : p));
  };

  // PDF Export
  const exportPdf = async () => {
    if (!pdfRef.current || !activeTrip) return;
    setGeneratingPdf(true);
    try {
      const pages = pdfRef.current.querySelectorAll('.pdf-page');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        const canvas = await html2canvas(pages[i] as HTMLElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          width: 794, // 210mm at 96dpi
          height: 1123, // 297mm at 96dpi
        });
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
      }

      pdf.save(`${activeTrip.title.replace(/\s+/g, '_')}_旅遊紀錄.pdf`);
    } catch (e) {
      console.error('PDF export failed:', e);
      alert('PDF 匙出失敗，請再試一次');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Open trip editor
  const openEditor = async (trip: Trip) => {
    setActiveTrip(trip);
    await loadPhotosForTrip(trip);
    setView('editor');
  };

  // Open preview
  const openPreview = async (trip: Trip) => {
    setActiveTrip(trip);
    await loadPhotosForTrip(trip);
    setView('preview');
  };

  // --- RENDER PDF PAGES ---
  const renderPdfPages = () => {
    if (!activeTrip) return null;
    const tpl = activeTrip.template;

    // Cover page
    const coverPhoto = photos.find(p => p.id === activeTrip.coverPhotoId);

    return (
      <div className="space-y-8">
        {/* Cover */}
        <div className={`pdf-page pdf-page-${tpl}`}>
          {tpl === 'magazine' && (
            <div className="h-full flex flex-col">
              {coverPhoto ? (
                <div className="flex-1 relative overflow-hidden rounded-lg">
                  <img src={coverPhoto.src} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-12 left-10 right-10">
                    <p className="text-white/60 text-sm tracking-widest uppercase mb-3">
                      {activeTrip.startDate ? formatDate(activeTrip.startDate) : ''}
                    </p>
                    <h1 className="font-serif text-6xl font-bold text-white leading-tight">{activeTrip.title}</h1>
                    {activeTrip.location && (
                      <p className="text-white/70 text-lg mt-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> {activeTrip.location}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-neutral-900 text-white">
                  <h1 className="font-serif text-5xl font-bold">{activeTrip.title}</h1>
                  <p className="text-white/50 mt-4 text-lg">{activeTrip.subtitle}</p>
                </div>
              )}
            </div>
          )}

          {tpl === 'minimal' && (
            <div className="h-full flex flex-col items-center justify-center text-center px-16">
              <p className="text-neutral-400 text-sm tracking-[0.3em] uppercase mb-8">
                {activeTrip.startDate ? formatDate(activeTrip.startDate) : 'TRAVEL JOURNAL'}
              </p>
              <h1 className="font-serif text-5xl font-bold text-neutral-900 leading-tight">{activeTrip.title}</h1>
              <div className="w-16 h-px bg-neutral-300 my-8" />
              {activeTrip.location && (
                <p className="text-neutral-500 text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> {activeTrip.location}
                </p>
              )}
              <p className="text-neutral-400 text-sm mt-3">{activeTrip.subtitle}</p>
            </div>
          )}

          {tpl === 'scrapbook' && (
            <div className="h-full relative">
              <div className="absolute top-8 left-8 right-8">
                <div className="inline-block bg-amber-200 text-amber-900 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider">
                  {activeTrip.startDate ? formatShortDate(activeTrip.startDate) : 'MY TRIP'}
                </div>
              </div>
              <div className="h-full flex flex-col items-center justify-center px-12">
                {coverPhoto && (
                  <div className="w-64 h-64 rounded-2xl overflow-hidden shadow-xl rotate-[-3deg] mb-8 border-4 border-white">
                    <img src={coverPhoto.src} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <h1 className="font-serif text-4xl font-bold text-amber-900 text-center">{activeTrip.title}</h1>
                {activeTrip.location && (
                  <p className="text-amber-700 mt-3 flex items-center gap-1.5 text-sm">
                    <MapPin className="w-3.5 h-3.5" /> {activeTrip.location}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Day pages */}
        {activeTrip.days.map((day, di) => {
          const dayPhotos = day.photoIds.map(id => photos.find(p => p.id === id)).filter(Boolean) as Photo[];

          return (
            <div key={day.index} className={`pdf-page pdf-page-${tpl}`}>
              {tpl === 'magazine' && (
                <div className="h-full flex flex-col">
                  {/* Day header */}
                  <div className="mb-6">
                    <p className="text-neutral-400 text-xs tracking-widest uppercase">Day {di + 1}</p>
                    <h2 className="font-serif text-3xl font-bold text-neutral-900 mt-1">{day.title}</h2>
                    {day.description && (
                      <p className="text-neutral-500 text-sm mt-2 leading-relaxed">{day.description}</p>
                    )}
                  </div>

                  {/* Photo grid - editorial style */}
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    {dayPhotos.map((photo, pi) => (
                      <div
                        key={photo.id}
                        className={`relative overflow-hidden rounded-lg ${
                          pi === 0 ? 'col-span-2 aspect-[16/9]' : 'aspect-square'
                        }`}
                      >
                        <img src={photo.src} alt="" className="w-full h-full object-cover" />
                        {photo.caption && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                            <p className="text-white text-xs font-medium">{photo.caption}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tpl === 'minimal' && (
                <div className="h-full">
                  <div className="flex items-baseline gap-4 mb-8">
                    <span className="text-5xl font-serif font-bold text-neutral-200">{String(di + 1).padStart(2, '0')}</span>
                    <div>
                      <h2 className="text-xl font-semibold text-neutral-900">{day.title}</h2>
                      {day.description && <p className="text-neutral-500 text-sm mt-1">{day.description}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {dayPhotos.map((photo, pi) => (
                      <div
                        key={photo.id}
                        className={`overflow-hidden rounded-lg ${
                          pi === 0 ? 'col-span-2 row-span-2 aspect-square' : 'aspect-square'
                        }`}
                      >
                        <img src={photo.src} alt="" className="w-full h-full object-cover" />
                        {photo.caption && (
                          <div className="absolute bottom-0 left-0 right-0 bg-white/90 p-2 border-t border-neutral-200">
                            <p className="text-neutral-600 text-[10px] font-medium text-center">{photo.caption}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tpl === 'scrapbook' && (
                <div className="h-full relative">
                  <div className="absolute top-0 left-0 w-full h-2 bg-amber-200" />
                  <div className="pt-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-amber-800 font-bold text-sm">
                        {di + 1}
                      </div>
                      <div>
                        <h2 className="font-serif text-xl font-bold text-amber-900">{day.title}</h2>
                        {day.description && <p className="text-amber-700 text-xs mt-0.5">{day.description}</p>}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {dayPhotos.map((photo, pi) => (
                        <div
                          key={photo.id}
                          className={`relative ${
                            pi % 2 === 0 ? 'rotate-[-1deg]' : 'rotate-[1deg]'
                          }`}
                        >
                          <div className="bg-white p-2.5 rounded-lg shadow-md">
                            <img src={photo.src} alt="" className="w-full rounded-md" />
                            {photo.caption && (
                              <p className="text-xs text-amber-800 mt-2 text-center font-serif italic">{photo.caption}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* End page */}
        <div className={`pdf-page pdf-page-${tpl}`}>
          {tpl === 'magazine' && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-px bg-neutral-300 mb-8" />
              <p className="font-serif text-2xl text-neutral-400 italic">The End</p>
              <p className="text-neutral-300 text-sm mt-4">{activeTrip.title}</p>
            </div>
          )}
          {tpl === 'minimal' && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <p className="font-serif text-3xl text-neutral-300">fin.</p>
            </div>
          )}
          {tpl === 'scrapbook' && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-amber-200 flex items-center justify-center mb-4">
                <Heart className="w-8 h-8 text-amber-700" />
              </div>
              <p className="font-serif text-xl text-amber-800">旅程結束，回憶永存</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Need Heart icon for scrapbook end page
  const Heart = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== 'list' && (
              <button
                onClick={() => setView('list')}
                className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Travel Journal</h1>
              <p className="text-[11px] text-slate-400">
                {view === 'list' ? `${trips.length} 個旅程` : activeTrip?.title}
              </p>
            </div>
          </div>
          {view === 'preview' && activeTrip && (
            <button
              onClick={exportPdf}
              disabled={generatingPdf}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600 disabled:opacity-50 transition-colors"
            >
              {generatingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {generatingPdf ? '匙出中...' : '匙出 PDF'}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-6 pb-24">
        {/* ========== LIST VIEW ========== */}
        {view === 'list' && (
          <div className="space-y-6">
            {/* Upload area */}
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); createTrip(e.dataTransfer.files); }}
              className={`flex flex-col items-center justify-center w-full h-48 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                dragOver ? 'border-sky-400 bg-sky-950/30' : 'border-slate-700 bg-slate-900 hover:border-slate-600'
              }`}
            >
              {uploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 text-sky-400 animate-spin mb-2" />
                  <span className="text-sm text-sky-300 font-medium">正在上傳照片...</span>
                </div>
              ) : (
                <>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${dragOver ? 'bg-sky-900/50' : 'bg-slate-800'}`}>
                    <Plus className={`w-7 h-7 ${dragOver ? 'text-sky-400' : 'text-slate-400'}`} />
                  </div>
                  <span className="text-sm text-slate-300 font-medium">新增旅遊紀錄</span>
                  <span className="text-[11px] text-slate-500 mt-1">拖曳或點擊上傳照片，自動按天分組</span>
                </>
              )}
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => createTrip(e.target.files)} />
            </label>

            {/* Trips */}
            {trips.length > 0 ? (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-slate-300">我的旅程</h2>
                {trips.map(trip => {
                  const cover = trip.photoIds[0];
                  return (
                    <div key={trip.id} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden group">
                      <div className="relative h-44">
                        {cover && (
                          <img src={photos.find(p => p.id === cover)?.src || ''} alt="" className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4">
                          <h3 className="text-white font-bold text-lg">{trip.title}</h3>
                          <p className="text-slate-400 text-xs mt-1">{trip.subtitle}</p>
                          <div className="flex items-center gap-3 mt-2">
                            {trip.startDate && (
                              <span className="text-slate-400 text-[11px] flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatShortDate(trip.startDate)}
                              </span>
                            )}
                            <span className="text-slate-500 text-[11px] flex items-center gap-1">
                              <Layout className="w-3 h-3" />
                              {templates.find(t => t.key === trip.template)?.name}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 flex gap-2">
                        <button
                          onClick={() => openEditor(trip)}
                          className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <PenLine className="w-3.5 h-3.5" />
                          編輯
                        </button>
                        <button
                          onClick={() => openPreview(trip)}
                          className="flex-1 py-2.5 rounded-xl bg-sky-500/10 text-sky-400 text-xs font-semibold hover:bg-sky-500/20 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          預覽
                        </button>
                        <button
                          onClick={() => deleteTrip(trip.id)}
                          className="px-3 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">還沒有旅程</p>
                <p className="text-xs mt-1">上傳旅遊照片開始製作紀錄</p>
              </div>
            )}
          </div>
        )}

        {/* ========== EDITOR VIEW ========== */}
        {view === 'editor' && activeTrip && (
          <div className="space-y-6">
            {/* Trip Info */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Type className="w-4 h-4" />
                旅程資訊
              </h2>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">標題</label>
                <input
                  type="text"
                  value={activeTrip.title}
                  onChange={e => updateTrip({ title: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">副標題</label>
                <input
                  type="text"
                  value={activeTrip.subtitle}
                  onChange={e => updateTrip({ subtitle: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">地點</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={activeTrip.location || ''}
                    onChange={e => updateTrip({ location: e.target.value })}
                    placeholder="例如：京都、台南..."
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Template selector */}
              <div>
                <label className="text-xs text-slate-500 mb-2 block flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5" />
                  排版模板
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {templates.map(t => (
                    <button
                      key={t.key}
                      onClick={() => updateTrip({ template: t.key })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        activeTrip.template === t.key
                          ? 'border-sky-500 bg-sky-500/10'
                          : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className={`w-full h-12 rounded-lg mb-2 ${t.preview}`} />
                      <p className="text-xs font-semibold text-slate-200">{t.name}</p>
                      <p className="text-[10px] text-slate-500">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Days */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                每日紀錄
              </h2>

              {activeTrip.days.map((day, di) => {
                const dayPhotos = day.photoIds.map(id => photos.find(p => p.id === id)).filter(Boolean) as Photo[];
                const isEditing = editingDay === di;

                return (
                  <div key={di} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                    {/* Day header */}
                    <button
                      onClick={() => setEditingDay(isEditing ? null : di)}
                      className="w-full px-5 py-4 flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-xs font-bold">
                          {di + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-200">{day.title}</p>
                          <p className="text-[11px] text-slate-500">{dayPhotos.length} 張照片</p>
                        </div>
                      </div>
                      {isEditing ? <X className="w-4 h-4 text-slate-400" /> : <PenLine className="w-4 h-4 text-slate-500" />}
                    </button>

                    {/* Day editor */}
                    {isEditing && (
                      <div className="px-5 pb-5 space-y-3 border-t border-slate-800 pt-4">
                        <input
                          type="text"
                          value={day.title}
                          onChange={e => updateDay(di, { title: e.target.value })}
                          className="w-full h-9 px-3 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-sky-500"
                          placeholder="這一天的標題..."
                        />
                        <textarea
                          value={day.description}
                          onChange={e => updateDay(di, { description: e.target.value })}
                          className="w-full h-20 p-3 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm resize-none focus:outline-none focus:border-sky-500"
                          placeholder="寫下這一天的回憶..."
                        />
                      </div>
                    )}

                    {/* Photo grid */}
                    <div className="px-5 pb-5 space-y-3">
                      <div className="grid grid-cols-4 gap-2">
                        {dayPhotos.map((photo, pi) => (
                          <div key={photo.id} className="relative aspect-square group">
                            <img src={photo.thumbnail} alt="" className="w-full h-full object-cover rounded-xl" />
                            {isEditing && (
                              <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex gap-1">
                                  {pi > 0 && (
                                    <button
                                      onClick={() => movePhoto(di, pi, pi - 1)}
                                      className="w-6 h-6 rounded bg-white/20 flex items-center justify-center text-white"
                                    >
                                      <ArrowUpDown className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {isEditing && dayPhotos.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500 font-medium">照片註解</p>
                          {dayPhotos.map(photo => (
                            <div key={photo.id} className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                                <img src={photo.thumbnail} alt="" className="w-full h-full object-cover" />
                              </div>
                              <input
                                type="text"
                                value={photo.caption || ''}
                                onChange={e => updatePhotoCaption(photo.id, e.target.value)}
                                placeholder="為這張照片加上註解..."
                                className="flex-1 h-8 px-3 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-sky-500"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Preview button */}
            <button
              onClick={() => setView('preview')}
              className="w-full py-3.5 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              預覽並匙出 PDF
            </button>
          </div>
        )}

        {/* ========== PREVIEW VIEW ========== */}
        {view === 'preview' && activeTrip && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">PDF 預覽</h2>
                <p className="text-xs text-slate-500">以下為 {templates.find(t => t.key === activeTrip.template)?.name} 模板</p>
              </div>
              <button
                onClick={exportPdf}
                disabled={generatingPdf}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600 disabled:opacity-50 transition-colors"
              >
                {generatingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {generatingPdf ? '匙出中...' : '匙出 PDF'}
              </button>
            </div>

            {/* PDF Preview Container */}
            <div className="bg-slate-800 rounded-2xl p-4 overflow-x-auto">
              <div ref={pdfRef} className="min-w-[210mm]">
                {renderPdfPages()}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
