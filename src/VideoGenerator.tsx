import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Loader2, Phone, Type, User } from "lucide-react";

interface VideoGeneratorProps {
  onBack: () => void;
}

type CaptureVideo = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

const FPS = 30;
const OVERLAY_DURATION_SECONDS = 5;
const OVERLAY_ANIMATION_SECONDS = 0.5;

const pickMp4MimeType = () => {
  const options = [
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    'video/mp4;codecs="avc1.424028,mp4a.40.2"',
    "video/mp4;codecs=h264,aac",
    "video/mp4",
  ];

  return options.find((type) => MediaRecorder.isTypeSupported(type)) || "";
};

const pickWebmMimeType = () => {
  const options = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=h264,opus",
    "video/webm",
  ];

  return options.find((type) => MediaRecorder.isTypeSupported(type)) || "";
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

export default function VideoGenerator({ onBack }: VideoGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationRef = useRef<number | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [headline, setHeadline] = useState("Fale comigo");
  const [templates, setTemplates] = useState<string[]>([]);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [renderProgress, setRenderProgress] = useState<number | null>(null);
  const [exportFormat, setExportFormat] = useState<"mp4" | "webm" | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const currentTemplate = templates[selectedTemplateIndex] || "composicao-2.mp4";
  const currentVideoUrl = `/templates/${encodeURIComponent(currentTemplate)}`;

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth || !video.videoHeight) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
    const drawWidth = video.videoWidth * scale;
    const drawHeight = video.videoHeight * scale;
    const drawX = (width - drawWidth) / 2;
    const drawY = (height - drawHeight) / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);

    const duration = video.duration || 0;
    const overlayStart = Math.max(0, duration - OVERLAY_DURATION_SECONDS);
    const overlayElapsed = duration ? video.currentTime - overlayStart : OVERLAY_DURATION_SECONDS;
    const overlayProgress = clamp(overlayElapsed / OVERLAY_ANIMATION_SECONDS, 0, 1);
    const overlayOpacity = duration && video.currentTime < overlayStart ? 0 : easeOutCubic(overlayProgress);
    const overlayOffsetY = (1 - overlayOpacity) * height * 0.035;

    if (overlayOpacity <= 0) return;

    ctx.save();
    ctx.globalAlpha = overlayOpacity;
    ctx.translate(0, overlayOffsetY);

    const gradient = ctx.createLinearGradient(0, height * 0.46, 0, height);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.52, "rgba(0,0,0,0.22)");
    gradient.addColorStop(1, "rgba(0,0,0,0.78)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const badgeWidth = Math.min(width * 0.49, 350);
    const badgeHeight = Math.max(36, height * 0.034);
    const badgeY = height * 0.735;

    ctx.fillStyle = "#e11d48";
    ctx.fillRect(centerX - badgeWidth / 2, badgeY, badgeWidth, badgeHeight);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `300 ${Math.max(13, Math.floor(width * 0.021))}px Montserrat, Arial, sans-serif`;
    ctx.letterSpacing = "3px";
    ctx.fillText((headline.trim() || "Fale comigo").toUpperCase(), centerX, badgeY + badgeHeight / 2);

    const nameText = (name.trim() || "SEU NOME").toUpperCase();
    const phoneText = phone.trim() || "(XX) 99999-9999";

    ctx.letterSpacing = "1px";
    ctx.font = `300 ${Math.max(16, Math.floor(width * 0.026))}px Montserrat, Arial, sans-serif`;
    ctx.fillText(nameText, centerX, badgeY + badgeHeight + height * 0.045);

    ctx.letterSpacing = "0px";
    ctx.font = `700 ${Math.max(24, Math.floor(width * 0.046))}px Montserrat, Arial, sans-serif`;
    ctx.fillText(phoneText, centerX, badgeY + badgeHeight + height * 0.094);
    ctx.restore();
  }, [headline, name, phone]);

  const startPreviewLoop = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    const tick = () => {
      drawFrame();
      animationRef.current = requestAnimationFrame(tick);
    };

    tick();
  }, [drawFrame]);

  useEffect(() => {
    fetch("/templates.json")
      .then((res) => res.json())
      .then((data) => {
        if (data.templates?.length) {
          setTemplates(data.templates);
        } else {
          setTemplates(["composicao-2.mp4"]);
        }
      })
      .catch(() => setTemplates(["composicao-2.mp4"]));
  }, []);

  useEffect(() => {
    drawFrame();
  }, [drawFrame]);

  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleVideoLoaded = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    setVideoReady(true);
    setVideoError(null);
    drawFrame();

    video.muted = true;
    video.loop = true;
    await video.play().catch(() => undefined);
    startPreviewLoop();
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 11) val = val.slice(0, 11);

    let formatted = val;
    if (val.length > 2) {
      formatted = `(${val.slice(0, 2)}) ${val.slice(2)}`;
    }
    if (val.length > 7) {
      formatted = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
    }
    setPhone(formatted);
  };

  const getAudioTracks = (video: CaptureVideo) => {
    const mediaStream = video.captureStream?.() || video.mozCaptureStream?.();
    return mediaStream?.getAudioTracks() || [];
  };

  const downloadBlob = (blob: Blob, format: "mp4" | "webm") => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (name.trim() || "video").replace(/\s+/g, "-").toLowerCase();
    link.href = url;
    link.download = `video-${safeName}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownload = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current as CaptureVideo | null;
    if (!canvas || !video || !videoReady) return;

    if (!("MediaRecorder" in window) || !canvas.captureStream) {
      alert("Este navegador nao suporta gravacao local de video.");
      return;
    }

    const mp4MimeType = pickMp4MimeType();
    const webmMimeType = pickWebmMimeType();
    const format = mp4MimeType ? "mp4" : "webm";
    const mimeType = mp4MimeType || webmMimeType;

    if (!mimeType) {
      alert("Este navegador nao suporta exportacao local de video.");
      return;
    }

    setIsGenerating(true);
    setRenderProgress(0);
    setExportFormat(format);
    setVideoError(null);

    const previousMuted = video.muted;
    const previousLoop = video.loop;
    const previousVolume = video.volume;

    try {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      video.pause();
      video.loop = false;
      video.muted = false;
      video.volume = 0;
      video.currentTime = 0;

      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
      });

      const canvasStream = canvas.captureStream(FPS);
      const stream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...getAudioTracks(video),
      ]);

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });

      const recordDone = new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => reject(new Error("Falha ao gravar o video localmente."));
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      const drawWhileRecording = () => {
        drawFrame();
        const duration = video.duration || 1;
        setRenderProgress(clamp(Math.round((video.currentTime / duration) * 100), 0, 100));

        if (!video.ended && !video.paused) {
          animationRef.current = requestAnimationFrame(drawWhileRecording);
        }
      };

      video.onended = () => {
        drawFrame();
        setRenderProgress(100);
        if (recorder.state !== "inactive") recorder.stop();
      };

      recorder.start(250);
      await video.play();
      drawWhileRecording();

      const blob = await recordDone;
      stream.getTracks().forEach((track) => track.stop());
      downloadBlob(blob, format);
    } catch (error) {
      console.error(error);
      alert("Houve um erro ao exportar o video localmente. Tente novamente.");
    } finally {
      video.onended = null;
      video.pause();
      video.loop = previousLoop;
      video.muted = previousMuted;
      video.volume = previousVolume;
      video.currentTime = 0;
      await video.play().catch(() => undefined);
      startPreviewLoop();
      setIsGenerating(false);
      setExportFormat(null);
      setTimeout(() => setRenderProgress(null), 1200);
    }
  };

  return (
    <div className="video-layout">
      <div className="noise-overlay" />

      <header className="gallery-header">
        <div className="gallery-header-left">
          <button className="mobile-back-btn" onClick={onBack} aria-label="Voltar para home">
            <ArrowLeft size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="gallery-header-info">
          <span className="gallery-count">Gerador local de video</span>
        </div>
      </header>

      <div className="video-body">
        <aside className="video-controls-card">
          <div className="left-glow" />

          <button className="back-to-home-btn" onClick={onBack} aria-label="Voltar para home">
            <ArrowLeft size={16} strokeWidth={1.5} />
            <span>Voltar</span>
          </button>

          <div className="block-divider" />

          <div className="selected-art-wrap">
            <span className="field-label">Modelo selecionado</span>
            <div className="video-template-nav">
              <button
                className="nav-arrow video-template-arrow"
                onClick={() => setSelectedTemplateIndex((prev) => (prev > 0 ? prev - 1 : templates.length - 1))}
                disabled={templates.length <= 1 || isGenerating}
                aria-label="Modelo anterior"
              >
                <ChevronLeft size={18} strokeWidth={1.5} />
              </button>
              <span className="video-template-count">
                {String(selectedTemplateIndex + 1).padStart(2, "0")} / {String(templates.length || 1).padStart(2, "0")}
              </span>
              <button
                className="nav-arrow video-template-arrow"
                onClick={() => setSelectedTemplateIndex((prev) => (prev < templates.length - 1 ? prev + 1 : 0))}
                disabled={templates.length <= 1 || isGenerating}
                aria-label="Proximo modelo"
              >
                <ChevronRight size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <div className="block-divider" />

          <div className="fields-group">
            <div className="field-wrapper">
              <label className="field-label" htmlFor="video-headline">
                <Type size={9} strokeWidth={2} />
                Frase principal
              </label>
              <input
                id="video-headline"
                className="field-input"
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value.slice(0, 32))}
                placeholder="Ex: Fale comigo"
                autoComplete="off"
              />
            </div>

            <div className="field-wrapper">
              <label className="field-label" htmlFor="video-name">
                <User size={9} strokeWidth={2} />
                Nome do Consultor
              </label>
              <input
                id="video-name"
                className="field-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Maria Silva"
                autoComplete="off"
              />
            </div>

            <div className="field-wrapper">
              <label className="field-label" htmlFor="video-phone">
                <Phone size={9} strokeWidth={2} />
                WhatsApp
              </label>
              <input
                id="video-phone"
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

          <div className="download-area">
            <button
              className="download-btn"
              onClick={handleDownload}
              disabled={isGenerating || !name.trim() || !phone.trim() || !videoReady}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={15} strokeWidth={2} className="spin-icon" />
                  Exportando... {renderProgress !== null ? `${renderProgress}%` : ""}
                </>
              ) : (
                <>
                  <Download size={15} strokeWidth={2} />
                  Baixar Video
                </>
              )}
            </button>
            <span className="export-hint">
              {isGenerating
                ? `Gerando ${exportFormat?.toUpperCase() || "video"} no seu navegador`
                : "Tenta MP4 primeiro; se nao suportar, baixa WebM"}
            </span>
            {renderProgress !== null && (
              <div className="video-progress-track">
                <div className="video-progress-bar" style={{ width: `${renderProgress}%` }} />
              </div>
            )}
          </div>
        </aside>

        <main className="video-preview-panel">
          <div className="watermark" aria-hidden="true">LUCI</div>
          <div className="vignette" />

          <div className="video-player-shell">
            {videoError && <div className="video-warning">{videoError}</div>}
            {!videoReady && !videoError && (
              <div className="video-loading">
                <Loader2 size={28} strokeWidth={1.5} className="spin-icon" />
                <span>Carregando video...</span>
              </div>
            )}
            <canvas ref={canvasRef} className="video-canvas" width={720} height={1280} />
            <video
              ref={videoRef}
              src={currentVideoUrl}
              className="video-source"
              playsInline
              crossOrigin="anonymous"
              onLoadedData={handleVideoLoaded}
              onError={() => {
                setVideoReady(false);
                setVideoError("Nao foi possivel carregar este modelo de video.");
              }}
            />
          </div>

          <div className="canvas-footer">
            <span className="banner-count">Modelo {String(selectedTemplateIndex + 1).padStart(2, "0")}</span>
          </div>
        </main>
      </div>
    </div>
  );
}
