/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Player } from "@remotion/player";
import { staticFile } from "remotion";
import { getVideoMetadata } from "@remotion/media-utils";
import { CampaignVideo } from "./remotion/CampaignVideo";
import { Download, Heart, Play, Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";

export default function App() {
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
          // If current template is no longer in the list, fallback to index 0
          setSelectedTemplateIndex(prev => prev >= data.templates.length ? 0 : prev);
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
    setVideoMeta(null); // Show loading state
    getVideoMetadata(staticFile(`templates/${currentTemplate}`))
      .then((meta) => {
        setVideoMeta(meta);
        setVideoError(null);
      })
      .catch((err) => {
        console.error("Error loading video metadata:", err);
        // Fallback for dummy/empty files or loading errors
        setVideoMeta({ durationInSeconds: 15, fps: 30, width: 720, height: 1280 });
        setVideoError("Aviso: Formato de vídeo não suportado. Por favor, grave seu vídeo base no formato MP4 padrão (Codec H.264).");
      });
  }, [currentTemplate]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ""); // remove non-digits
    if (val.length > 11) {
      val = val.slice(0, 11);
    }
    // format as (XX) XXXXX-XXXX
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
        throw new Error(errorData?.details || errorData?.error || "Falha ao iniciar renderização");
      }

      const startData = await response.json();
      
      // Start progress polling
      const progressInterval = setInterval(async () => {
        try {
          const progressParams = new URLSearchParams({ id: renderId });
          if (startData.awsRenderId) {
            progressParams.set("renderId", startData.awsRenderId);
          }
          if (startData.bucketName) {
            progressParams.set("bucketName", startData.bucketName);
          }

          const res = await fetch(`/api/render/progress?${progressParams.toString()}`);
          if (res.ok) {
            const data = await res.json();
            if (data.error) {
              clearInterval(progressInterval);
              setIsGenerating(false);
              setRenderProgress(null);
              alert("Erro na geração: " + data.error);
            } else {
              const currentPercent = Math.floor(data.percent * 100);
              setRenderProgress(currentPercent);
              
              if (currentPercent > 5) {
                hasStarted = true;
              }

              if (currentPercent === lastProgress && !data.complete) {
                stuckTime += 1000;
              } else {
                lastProgress = currentPercent;
                stuckTime = 0;
              }

              // Se não começar (passou de 5%) em 45 segundos, lance erro
              if (!hasStarted && stuckTime > 45000) {
                clearInterval(progressInterval);
                setIsGenerating(false);
                setRenderProgress(null);
                alert("O servidor demorou muito para iniciar a renderização. Tente novamente.");
              }

              // Se travar num percentual específico (mesmo depois de começar) por 60 segundos
              if (hasStarted && stuckTime > 60000) {
                clearInterval(progressInterval);
                setIsGenerating(false);
                setRenderProgress(null);
                alert("A renderização parece ter travado. Tente novamente.");
              }

              if (data.complete) {
                clearInterval(progressInterval);
                
                // Trigger download safely
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
            }
          }
        } catch (e) {
          // ignore network error while polling
        }
      }, 1000);

    } catch (error) {
      console.error(error);
      alert("Houve um erro ao gerar o vídeo. Tente novamente.");
      setIsGenerating(false);
      setRenderProgress(null);
    }
  };

  return (
    <div className="min-h-screen bg-rose-50 font-sans text-rose-950 selection:bg-rose-200">
      <header className="bg-white shadow-sm border-b border-rose-100 py-6">
        <div className="max-w-5xl mx-auto px-6 flex items-center gap-3 text-rose-600">
          <Heart className="w-8 h-8 fill-rose-500 text-rose-500" />
          <h1 className="text-2xl font-bold tracking-tight">Gerador de Campanha - Dia dos Namorados</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 flex flex-col md:flex-row justify-center gap-12 items-start">
        {/* Left Column: Video Preview */}
        <div className="flex flex-col gap-6 w-full max-w-[320px] shrink-0">
          <div className="bg-white p-4 rounded-3xl shadow-xl shadow-rose-100/50 border border-rose-100 overflow-hidden">
            <div className="flex items-center justify-between mb-4 px-2">
              <button 
                onClick={() => setSelectedTemplateIndex(prev => (prev > 0 ? prev - 1 : templates.length - 1))}
                className="p-2 rounded-full hover:bg-rose-100 active:scale-95 transition-all text-rose-600 disabled:opacity-50"
                disabled={templates.length <= 1}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium text-rose-800">
                Modelo {selectedTemplateIndex + 1} de {templates.length || 1}
              </span>
              <button 
                onClick={() => setSelectedTemplateIndex(prev => (prev < templates.length - 1 ? prev + 1 : 0))}
                className="p-2 rounded-full hover:bg-rose-100 active:scale-95 transition-all text-rose-600 disabled:opacity-50"
                disabled={templates.length <= 1}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            <div className="aspect-[9/16] bg-black rounded-2xl overflow-hidden relative flex flex-col items-center justify-center">
              {videoError && (
                <div className="absolute top-0 inset-x-0 z-50 bg-amber-500/90 text-white text-xs p-2 text-center">
                  {videoError}
                </div>
              )}
              
              {!videoMeta ? (
                <div className="text-white flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
                  <span>Carregando vídeo...</span>
                </div>
              ) : (
                <Player
                  key={currentTemplate} // force remount when template changes
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
          </div>
        </div>

        {/* Right Column: Controls */}
        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-rose-100/50 border border-rose-100 sticky top-12 w-full max-w-[400px]">
          <h2 className="text-xl font-bold mb-6">Seus Dados</h2>
          
          <div className="space-y-4 mb-8">
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="text-sm font-medium text-rose-800">
                Seu Nome Completo
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-rose-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition-all placeholder:text-rose-300"
                placeholder="Seu nome aqui"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="phone" className="text-sm font-medium text-rose-800">
                Seu Celular / WhatsApp
              </label>
              <input
                id="phone"
                type="text"
                value={phone}
                onChange={handlePhoneChange}
                className="w-full px-4 py-3 rounded-xl border border-rose-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition-all placeholder:text-rose-300"
                placeholder="(XX) XXXXX-XXXX"
              />
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={isGenerating || !name.trim() || !phone.trim()}
            className="w-full flex flex-col items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-bold py-4 px-6 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-rose-600/30 relative overflow-hidden"
          >
            {isGenerating ? (
              <div className="flex flex-col items-center w-full z-10">
                <div className="flex flex-col items-center gap-1 mb-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Gerando Vídeo... {renderProgress !== null ? `${renderProgress}%` : ''}</span>
                  </div>
                  {renderProgress !== null && (
                    <span className="text-rose-100 text-sm font-medium">
                      {renderProgress < 5 
                        ? "Enviando informações..." 
                        : renderProgress <= 30 
                          ? "Gerando vídeo..." 
                          : renderProgress <= 80 
                            ? "Convertendo vídeo..." 
                            : "Preparando download..."}
                    </span>
                  )}
                </div>
                {renderProgress !== null && (
                  <div className="w-full h-2 bg-rose-800/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white transition-all duration-300 ease-out"
                      style={{ width: `${renderProgress}%` }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                <span>Gerar Vídeo com IA</span>
              </div>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
