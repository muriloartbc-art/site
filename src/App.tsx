import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Download, User, Phone, Sparkles, ArrowLeft, Check, ChevronRight, Image as ImageIcon, BookOpen, Film } from 'lucide-react';
import { BANNER_SRC } from './constants';
import CatalogoEditor from './CatalogoEditor';
import TopMenu from './TopMenu';
import VideoGenerator from './VideoGenerator';
import './index.css';

// Load all banner images eagerly
const bannerModules = import.meta.glob('./banners/*.{png,jpg,jpeg}', { eager: true });
const loadedBanners = Object.values(bannerModules).map((mod: any) => mod.default);

type View = 'landing' | 'gallery' | 'editor' | 'catalogo' | 'video';

export default function App() {
  const [banners, setBanners]             = useState<string[]>([]);
  const [currentBannerIdx, setIdx]        = useState(0);
  const [name, setName]                   = useState('');
  const [phone, setPhone]                 = useState('');
  const canvasRef                         = useRef<HTMLCanvasElement>(null);
  const [imgElement, setImgElement]       = useState<HTMLImageElement | null>(null);
  const [whatsappIcon, setWhatsappIcon]   = useState<HTMLImageElement | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [view, setView]                   = useState<View>('landing');

  // Limpar dados quando navegação muda
  useEffect(() => {
    if (view !== 'editor') {
      setName('');
      setPhone('');
      localStorage.removeItem('appName');
      localStorage.removeItem('appPhone');
      localStorage.removeItem('appBannerIdx');
      setIdx(0);
    }
  }, [view]);

  // Thumbnails: pre-load Image objects for all banners
  const [thumbEls, setThumbEls] = useState<Record<number, HTMLImageElement>>({});

  useEffect(() => {
    setBanners(loadedBanners.length > 0 ? loadedBanners : [BANNER_SRC]);
  }, []);

  // Pre-load all thumbnails once banners are set
  useEffect(() => {
    if (!banners.length) return;
    banners.forEach((src, i) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setThumbEls(prev => ({ ...prev, [i]: img }));
      img.src = src;
    });
  }, [banners]);

  useEffect(() => {
    const icon = new Image();
    icon.crossOrigin = 'anonymous';
    icon.onload = () => setWhatsappIcon(icon);
    icon.src = '/whatsapp-svgrepo-com.svg';
  }, []);

  // Load selected banner for editor canvas
  useEffect(() => {
    if (!banners.length) { setImgElement(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImgElement(img);
    img.onerror = () => {
      if (banners[currentBannerIdx] !== BANNER_SRC) {
        const fb = new Image(); fb.crossOrigin = 'anonymous';
        fb.onload = () => setImgElement(fb); fb.src = BANNER_SRC;
      } else setImgElement(null);
    };
    img.src = banners[currentBannerIdx];
  }, [banners, currentBannerIdx]);

  useEffect(() => {
    if (view !== 'editor') return;
    document.fonts ? document.fonts.ready.then(drawCanvas) : drawCanvas();
  }, [name, phone, imgElement, view, whatsappIcon]);

  const drawCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const W = 1080, H = 1920;
    ctx.clearRect(0, 0, W, H);
    if (!imgElement) { ctx.fillStyle = '#f2f2f2'; ctx.fillRect(0,0,W,H); return; }
    ctx.drawImage(imgElement, 0, 0, W, H);

    const drawName  = name.trim().toUpperCase()  || 'SEU NOME';
    const drawPhone = phone.trim().toUpperCase() || '(XX) 99999-9999';
    const textX = 100, boxCY = 1670, maxW = 980 - textX;
    const nameLetterSpacing = 1.2;
    const whatsappIconSize = 44;
    const whatsappIconSpacing = 10;

    const measureTextWidth = (text: string) => {
      const metrics = ctx.measureText(text);
      return metrics.width + Math.max(0, text.length - 1) * nameLetterSpacing;
    };

    const drawTextWithSpacing = (text: string, x: number, y: number, spacing: number) => {
      let currentX = x;
      for (const char of text) {
        ctx.fillText(char, currentX, y);
        currentX += ctx.measureText(char).width + spacing;
      }
    };

    const drawWhatsappIcon = (x: number, y: number, size: number) => {
      if (!whatsappIcon) return;
      const iconY = y - size * 0.8;
      ctx.drawImage(whatsappIcon, x, iconY, size, size);
    };

    let ns = 28;
    ctx.save(); ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    ctx.font=`300 ${ns}px 'Montserrat',Arial,sans-serif`;
    while (measureTextWidth(drawName) > maxW && ns > 16) {
      ns--; ctx.font=`300 ${ns}px 'Montserrat',Arial,sans-serif`;
    }
    ctx.fillStyle='#ffffff';
    drawTextWithSpacing(drawName, textX, boxCY - 18, nameLetterSpacing);
    ctx.restore();

    let ps = 40;
    ctx.save(); ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    ctx.font=`700 ${ps}px 'Gotham', 'Montserrat',Arial,sans-serif`;
    while (ctx.measureText(drawPhone).width > maxW - whatsappIconSize - whatsappIconSpacing && ps > 18) {
      ps--; ctx.font=`700 ${ps}px 'Gotham', 'Montserrat',Arial,sans-serif`;
    }
    ctx.fillStyle='#ffffff';
    drawWhatsappIcon(textX, boxCY + 30, whatsappIconSize);
    ctx.fillText(drawPhone, textX + whatsappIconSize + whatsappIconSpacing, boxCY + 30);
    ctx.restore();
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value.slice(0, 20));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g,'').slice(0,11);
    if (v.length<=2)      e.target.value = v ? '('+v : '';
    else if (v.length<=6) e.target.value = '('+v.slice(0,2)+') '+v.slice(2);
    else                  e.target.value = '('+v.slice(0,2)+') '+v.slice(2,7)+'-'+v.slice(7);
    setPhone(e.target.value);
  };

  const downloadBanner = () => {
    const canvas = canvasRef.current; if (!canvas||!imgElement) return;
    setIsDownloading(true);
    setTimeout(() => {
      const fname = (name.trim()||'banner').replace(/\s+/g,'-').toLowerCase();
      const a = document.createElement('a');
      a.download=`banner-${fname}.png`; a.href=canvas.toDataURL('image/png');
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setIsDownloading(false);
    }, 150);
  };

  const selectBanner = (i: number) => {
    setIdx(i);
    setView('editor');
  };

  // ─── LANDING ──────────────────────────────────────
  if (view === 'landing') {
    return (
      <>
        <TopMenu currentView={view} onNavigate={(v) => setView(v)} />
        <div className="landing-layout">
          <div className="noise-overlay" />
          <div className="landing-content">

          <div className="landing-badge">
            <Sparkles size={14} />
            <span>Coleção Exclusiva</span>
          </div>
          <h1 className="landing-title">
            Campanha <br />
            <span className="text-accent">Dia dos Namorados</span>
          </h1>
          <p className="landing-desc">
            Personalize materiais de divulgação com seus dados e impulsione suas vendas nesta data especial.
          </p>

          <div className="landing-options">
            <button className="option-card" onClick={() => setView('gallery')}>
              <div className="option-icon-wrap">
                <ImageIcon size={28} strokeWidth={1.5} />
              </div>
              <h3 className="option-title">Criar Banners</h3>
              <p className="option-desc">Personalize artes para redes sociais com seu nome e telefone</p>
              <span className="option-cta">
                Começar
                <ChevronRight size={14} />
              </span>
            </button>

            <button className="option-card" onClick={() => setView('catalogo')}>
              <div className="option-icon-wrap">
                <BookOpen size={28} strokeWidth={1.5} />
              </div>
              <h3 className="option-title">Criar Catálogo</h3>
              <p className="option-desc">Gere um catálogo PDF interativo com botões de WhatsApp</p>
              <span className="option-cta">
                Começar
                <ChevronRight size={14} />
              </span>
            </button>

            <button className="option-card" onClick={() => setView('video')}>
              <div className="option-icon-wrap">
                <Film size={28} strokeWidth={1.5} />
              </div>
              <h3 className="option-title">Criar Vídeo</h3>
              <p className="option-desc">Gere vídeos personalizados com seu nome e WhatsApp</p>
              <span className="option-cta">
                Começar
                <ChevronRight size={14} />
              </span>
            </button>
          </div>
        </div>
        </div>
      </>
    );
  }

  // ─── VIDEO ─────────────────────────────────────────
  if (view === 'video') {
    return (
      <>
        <TopMenu currentView={view} onNavigate={(v) => setView(v)} />
        <VideoGenerator onBack={() => setView('landing')} />
      </>
    );
  }

  // ─── CATÁLOGO ──────────────────────────────────────
  if (view === 'catalogo') {
    return (
      <>
        <TopMenu currentView={view} onNavigate={(v) => setView(v)} />
        <CatalogoEditor onBack={() => setView('landing')} />
      </>
    );
  }

  // ─── GALLERY ──────────────────────────────────────
  if (view === 'gallery') {
    return (
      <>
        <TopMenu currentView={view} onNavigate={(v) => setView(v)} />
        <div className="gallery-layout">
        <div className="noise-overlay" />

        <header className="gallery-header">
          <div className="gallery-header-left">
            <button className="mobile-back-btn" onClick={() => setView('landing')} aria-label="Voltar para home">
              <ArrowLeft size={18} strokeWidth={1.5} />
            </button>
          </div>
          <div className="gallery-header-info">
            <span className="gallery-count">{banners.length} artes disponíveis</span>
          </div>
        </header>

        <div className="gallery-body">
          <div className="gallery-headline">
            <h2 className="gallery-title">Escolha a sua arte</h2>
            <p className="gallery-subtitle">Clique em uma miniatura para personalizar e baixar</p>
          </div>

          <div className="gallery-grid">
            {banners.map((src, i) => (
              <button
                key={i}
                className="thumb-card"
                onClick={() => selectBanner(i)}
                aria-label={`Arte ${i + 1}`}
              >
                <div className="thumb-img-wrap">
                  <img
                    src={src}
                    alt={`Arte ${i + 1}`}
                    className="thumb-img"
                    loading="lazy"
                  />
                  <div className="thumb-overlay">
                    <span className="thumb-cta">Personalizar</span>
                  </div>
                </div>
                <span className="thumb-label">Arte {String(i + 1).padStart(2, '0')}</span>
              </button>
            ))}
          </div>
        </div>
        </div>
      </>
    );
  }

  // ─── EDITOR ───────────────────────────────────────
  return (
    <>
      <TopMenu currentView={view} onNavigate={(v) => setView(v)} />
      <div className="root-layout">
      <div className="noise-overlay" />

      {/* ─── MOBILE HEADER ───────────────────────── */}
      <header className="mobile-header">
        <button className="mobile-back-btn" onClick={() => setView('gallery')} aria-label="Voltar">
          <ArrowLeft size={18} strokeWidth={1.5} />
        </button>
      </header>

      {/* ─── WRAPPER PRINCIPAL ───────────────────── */}
      <div className="page-wrapper">

        {/* ══ BLOCO ESQUERDO — Controles ══ */}
        <aside className="left-block">
          <div className="left-glow" />

          {/* Botão voltar para home */}
          <button className="back-to-home-btn" onClick={() => setView('landing')} aria-label="Voltar para home">
            <ArrowLeft size={16} strokeWidth={1.5} />
            <span>Voltar</span>
          </button>

          <div className="block-divider" />

          {/* Arte selecionada + trocar */}
          <div className="selected-art-wrap">
            <span className="field-label" style={{ marginBottom: '10px' }}>
              <Check size={9} strokeWidth={2.5} />
              Arte selecionada
            </span>
            <div className="selected-thumb-row">
              <img
                src={banners[currentBannerIdx]}
                alt="Arte selecionada"
                className="selected-thumb"
              />
              <button className="change-art-btn" onClick={() => setView('gallery')}>
                <ArrowLeft size={12} strokeWidth={2} />
                Trocar arte
              </button>
            </div>
          </div>

          <div className="block-divider" />

          {/* Campos */}
          <div className="fields-group">
            <div className="field-wrapper">
              <label className="field-label" htmlFor="name-input">
                <User size={9} strokeWidth={2} />
                Nome do Consultor
              </label>
              <input
                id="name-input"
                className="field-input"
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="Ex: Maria Silva"
                maxLength={20}
                autoComplete="off"
              />
            </div>

            <div className="field-wrapper">
              <label className="field-label" htmlFor="phone-input">
                <Phone size={9} strokeWidth={2} />
                WhatsApp
              </label>
              <input
                id="phone-input"
                className="field-input"
                type="text"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(XX) 99999-9999"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="block-divider" />

          {/* Download */}
          <div className="download-area">
            <button
              className="download-btn"
              onClick={downloadBanner}
              disabled={!imgElement || isDownloading}
            >
              <Download size={15} strokeWidth={2} />
              {isDownloading ? 'Processando...' : 'Baixar Arte'}
            </button>
            <span className="export-hint">PNG · 1080 × 1920 px</span>
          </div>
        </aside>

        {/* ══ BLOCO DIREITO — Preview ══ */}
        <main className="right-block">
          <div className="watermark" aria-hidden="true">LUCI</div>
          <div className="vignette" />

          <div className="canvas-row">
            <div className="canvas-wrap">
              <canvas
                ref={canvasRef}
                width={1080}
                height={1920}
                className="canvas-el"
              />
            </div>
          </div>

          <div className="canvas-footer">
            <span className="banner-count">
              Arte {String(currentBannerIdx + 1).padStart(2, '0')} / {String(banners.length).padStart(2, '0')}
            </span>
          </div>
        </main>
      </div>

      {/* ─── MOBILE BOTTOM PANEL ─────────────────── */}
      <div className="mobile-panel">
        <div className="mobile-fields">
          <div className="field-wrapper">
            <label className="field-label" htmlFor="m-name">
              <User size={9} strokeWidth={2} />
              Nome
            </label>
            <input
              id="m-name"
              className="field-input"
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="Ex: Maria Silva"
              maxLength={20}
              autoComplete="off"
            />
          </div>
          <div className="field-wrapper">
            <label className="field-label" htmlFor="m-phone">
              <Phone size={9} strokeWidth={2} />
              WhatsApp
            </label>
            <input
              id="m-phone"
              className="field-input"
              type="text"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(XX) 99999-9999"
              autoComplete="off"
            />
          </div>
        </div>

        <button
          className="download-btn mobile-download"
          onClick={downloadBanner}
          disabled={!imgElement || isDownloading}
        >
          <Download size={15} strokeWidth={2} />
          {isDownloading ? 'Processando...' : 'Baixar Arte'}
        </button>
      </div>
      </div>
    </>
  );
}
