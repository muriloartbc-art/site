import React, { useCallback, useEffect, useState } from "react";
import { Player } from "@remotion/player";
import { getVideoMetadata } from "@remotion/media-utils";
import { staticFile } from "remotion";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Loader2, Phone, User } from "lucide-react";
import { CampaignVideo } from "./remotion/CampaignVideo";

interface VideoGeneratorProps {
  onBack: () => void;
}

export default function VideoGenerator({ onBack }: VideoGeneratorProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [renderProgress, setRenderProgress] = useState<number | null>(null);
  const [videoMeta, setVideoMeta] = useState<any>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<string[]>([]);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);

  const fetchTemplates = useCallback(() => {
    fetch("/templates.json")
      .then((res) => res.json())
      .then((data) => {
        if (data.templates && data.templates.length > 0) {
          setTemplates(data.templates);
          setSelectedTemplateIndex((prev) => (prev >= data.templates.length ? 0 : prev));
        } else {
          setTemplates(["composicao-2.mp4"]);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch templates:", err);
        setTemplates(["composicao-2.mp4"]);
      });
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const currentTemplate = templates[selectedTemplateIndex] || "composicao-2.mp4";

  useEffect(() => {
    if (!currentTemplate) return;
    setVideoMeta(null);
    getVideoMetadata(staticFile(`templates/${currentTemplate}`))
      .then((meta) => {
        setVideoMeta(meta);
        setVideoError(null);
      })
      .catch((err) => {
        console.error("Error loading video metadata:", err);
        setVideoMeta({ durationInSeconds: 15, fps: 30, width: 720, height: 1280 });
        setVideoError("Aviso: formato de video nao suportado. Grave o video base em MP4 padrao (Codec H.264).");
      });
  }, [currentTemplate]);

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

  const handleDownload = async () => {
    setIsGenerating(true);
    setRenderProgress(0);
    const renderId = Math.random().toString(36).substring(7);

    let stuckTime = 0;
    let lastProgress = 0;
    let hasStarted = false;

    try {
      const response = await fetch("/api/render/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, renderId, templateFilename: currentTemplate }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.details || errorData?.error || "Falha ao iniciar renderizacao");
      }

      const startData = await response.json();
      const progressInterval = setInterval(async () => {
        try {
          const progressParams = new URLSearchParams({ id: renderId });
          if (startData.awsRenderId) progressParams.set("renderId", startData.awsRenderId);
          if (startData.bucketName) progressParams.set("bucketName", startData.bucketName);

          const res = await fetch(`/api/render/progress?${progressParams.toString()}`);
          if (!res.ok) return;

          const data = await res.json();
          if (data.error) {
            clearInterval(progressInterval);
            setIsGenerating(false);
            setRenderProgress(null);
            alert("Erro na geracao: " + data.error);
            return;
          }

          const currentPercent = Math.floor(data.percent * 100);
          setRenderProgress(currentPercent);

          if (currentPercent > 5) hasStarted = true;

          if (currentPercent === lastProgress && !data.complete) {
            stuckTime += 1000;
          } else {
            lastProgress = currentPercent;
            stuckTime = 0;
          }

          if (!hasStarted && stuckTime > 45000) {
            clearInterval(progressInterval);
            setIsGenerating(false);
            setRenderProgress(null);
            alert("O servidor demorou muito para iniciar a renderizacao. Tente novamente.");
          }

          if (hasStarted && stuckTime > 60000) {
            clearInterval(progressInterval);
            setIsGenerating(false);
            setRenderProgress(null);
            alert("A renderizacao parece ter travado. Tente novamente.");
          }

          if (data.complete) {
            clearInterval(progressInterval);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = data.outUrl || `/api/render/download?id=${renderId}`;
            a.download = `Campanha_Namorados_${name.replace(/\s+/g, "_")}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            setIsGenerating(false);
            setTimeout(() => setRenderProgress(null), 2000);
          }
        } catch {
          // Keep polling through transient network failures.
        }
      }, 1000);
    } catch (error) {
      console.error(error);
      alert("Houve um erro ao gerar o video. Tente novamente.");
      setIsGenerating(false);
      setRenderProgress(null);
    }
  };

  const progressLabel =
    renderProgress === null
      ? ""
      : renderProgress < 5
        ? "Enviando informacoes..."
        : renderProgress <= 30
          ? "Gerando video..."
          : renderProgress <= 80
            ? "Convertendo video..."
            : "Preparando download...";

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
          <span className="gallery-count">Gerador de Video</span>
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
                disabled={templates.length <= 1}
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
                disabled={templates.length <= 1}
                aria-label="Proximo modelo"
              >
                <ChevronRight size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <div className="block-divider" />

          <div className="fields-group">
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
              disabled={isGenerating || !name.trim() || !phone.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={15} strokeWidth={2} className="spin-icon" />
                  Gerando... {renderProgress !== null ? `${renderProgress}%` : ""}
                </>
              ) : (
                <>
                  <Download size={15} strokeWidth={2} />
                  Gerar Video
                </>
              )}
            </button>
            <span className="export-hint">{isGenerating ? progressLabel : "MP4 personalizado para redes sociais"}</span>
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

            {!videoMeta ? (
              <div className="video-loading">
                <Loader2 size={28} strokeWidth={1.5} className="spin-icon" />
                <span>Carregando video...</span>
              </div>
            ) : (
              <Player
                key={currentTemplate}
                acknowledgeRemotionLicense
                component={CampaignVideo}
                durationInFrames={Math.floor((videoMeta?.durationInSeconds || 15) * 30)}
                fps={30}
                compositionWidth={videoMeta?.width || 1080}
                compositionHeight={videoMeta?.height || 1920}
                style={{ width: "100%", height: "100%" }}
                controls
                allowFullscreen={false}
                inputProps={{ name: "SEU NOME AQUI", phone: "(XX) XXXXX-XXXX", templateFilename: currentTemplate }}
              />
            )}
          </div>

          <div className="canvas-footer">
            <span className="banner-count">Modelo {String(selectedTemplateIndex + 1).padStart(2, "0")}</span>
          </div>
        </main>
      </div>
    </div>
  );
}
