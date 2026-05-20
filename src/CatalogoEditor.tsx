import { useState } from 'react';
import type React from 'react';
import { Download, AlertCircle, CheckCircle2, Phone, User, MapPin, ArrowLeft } from 'lucide-react';
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb } from 'pdf-lib';

interface CatalogoEditorProps {
  onBack: () => void;
}

export default function CatalogoEditor({ onBack }: CatalogoEditorProps) {
  const [nome, setNome] = useState('');
  const [localidade, setLocalidade] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleBack = () => {
    onBack();
  };

  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = '';
    if (v.length <= 2) formatted = v ? '(' + v : '';
    else if (v.length <= 6) formatted = '(' + v.slice(0, 2) + ') ' + v.slice(2);
    else formatted = '(' + v.slice(0, 2) + ') ' + v.slice(2, 7) + '-' + v.slice(7);
    setWhatsapp(formatted);
  };

  const processPdf = async () => {
    if (!whatsapp || !nome) {
      setResultMessage({
        type: 'error',
        text: 'Preencha os campos obrigatórios (Nome e WhatsApp) antes de gerar.',
      });
      return;
    }

    setIsProcessing(true);
    setResultMessage(null);

    try {
      const response = await fetch('/catalogo.pdf');
      if (!response.ok) {
        throw new Error('Não foi possível carregar o catálogo base. Verifique se o arquivo "catalogo.pdf" existe na pasta public.');
      }

      const arrayBuffer = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const goldColor = rgb(0.77, 0.63, 0.35);
      const darkColor = rgb(0.04, 0.04, 0.04);

      let cleanWhatsapp = whatsapp.replace(/\D/g, '');
      if (cleanWhatsapp.length <= 11 && !cleanWhatsapp.startsWith('55')) {
        cleanWhatsapp = `55${cleanWhatsapp}`;
      }

      // Add "FAZER PEDIDO" button on all pages except the last
      for (let i = 0; i < pages.length - 1; i++) {
        const page = pages[i];
        const { width } = page.getSize();

        const smallBtnWidth = 180;
        const smallBtnHeight = 32;
        const smallBtnX = width / 2 - smallBtnWidth / 2;
        const smallBtnY = 25;

        page.drawRectangle({
          x: smallBtnX,
          y: smallBtnY,
          width: smallBtnWidth,
          height: smallBtnHeight,
          color: darkColor,
          borderColor: goldColor,
          borderWidth: 0.5,
        });

        const smallBtnText = "F A Z E R   P E D I D O";
        const smallBtnTextWidth = fontRegular.widthOfTextAtSize(smallBtnText, 7);
        page.drawText(smallBtnText, {
          x: width / 2 - smallBtnTextWidth / 2,
          y: smallBtnY + 12,
          size: 7,
          font: fontRegular,
          color: goldColor,
        });

        const linkAnnotation = pdfDoc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [smallBtnX, smallBtnY, smallBtnX + smallBtnWidth, smallBtnY + smallBtnHeight],
          Border: [0, 0, 0],
          A: {
            Type: 'Action',
            S: 'URI',
            URI: PDFString.of(`https://wa.me/${cleanWhatsapp}`),
          },
        });

        const pageLinkRef = pdfDoc.context.register(linkAnnotation);
        let pageAnnots = page.node.Annots();
        if (!pageAnnots) {
          page.node.set(PDFName.of('Annots'), pdfDoc.context.obj([]));
          pageAnnots = page.node.Annots();
        }
        pageAnnots!.push(pageLinkRef);
      }

      // Last page: consultant info + main WhatsApp button
      const lastPage = pages[pages.length - 1];
      const { width: lastWidth } = lastPage.getSize();

      const nameText = `CONSULTOR(A): ${nome.toUpperCase()}`.split('').join(' ');
      const localText = localidade.toUpperCase().split('').join(' ');

      const fontSize = 9;
      const fontRegSize = 7;

      const nameWidth = fontRegular.widthOfTextAtSize(nameText, fontSize);
      const localWidth = fontRegular.widthOfTextAtSize(localText, fontRegSize);

      lastPage.drawText(nameText, {
        x: lastWidth / 2 - nameWidth / 2,
        y: 110,
        size: fontSize,
        font: fontRegular,
        color: goldColor,
      });

      if (localText) {
        lastPage.drawText(localText, {
          x: lastWidth / 2 - localWidth / 2,
          y: 95,
          size: fontRegSize,
          font: fontRegular,
          color: rgb(0.5, 0.5, 0.5),
        });
      }

      const btnWidth = 260;
      const btnHeight = 40;
      const btnX = lastWidth / 2 - btnWidth / 2;
      const btnY = 30;

      lastPage.drawRectangle({
        x: btnX,
        y: btnY,
        width: btnWidth,
        height: btnHeight,
        color: darkColor,
        borderColor: goldColor,
        borderWidth: 0.5,
      });

      const btnText = "F A L E   C O M I G O   N O   W H A T S A P P";
      const btnTextWidth = fontRegular.widthOfTextAtSize(btnText, 8);
      lastPage.drawText(btnText, {
        x: lastWidth / 2 - btnTextWidth / 2,
        y: btnY + 16,
        size: 8,
        font: fontRegular,
        color: goldColor,
      });

      const lastPageLinkAnnotation = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [btnX, btnY, btnX + btnWidth, btnY + btnHeight],
        Border: [0, 0, 0],
        A: {
          Type: 'Action',
          S: 'URI',
          URI: PDFString.of(`https://wa.me/${cleanWhatsapp}`),
        },
      });

      const lastPageLinkRef = pdfDoc.context.register(lastPageLinkAnnotation);
      let lastPageAnnots = lastPage.node.Annots();
      if (!lastPageAnnots) {
        lastPage.node.set(PDFName.of('Annots'), pdfDoc.context.obj([]));
        lastPageAnnots = lastPage.node.Annots();
      }
      lastPageAnnots!.push(lastPageLinkRef);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Catalogo_${nome.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setResultMessage({
        type: 'success',
        text: 'Sucesso! O catálogo personalizado foi gerado e baixado.',
      });

    } catch (error: any) {
      console.error(error);
      setResultMessage({
        type: 'error',
        text: error.message || 'Erro ao processar o PDF.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="catalogo-layout">
      <div className="noise-overlay" />

      {/* Header */}
      <header className="gallery-header">
        <div className="gallery-header-left">
          <button className="mobile-back-btn" onClick={handleBack} aria-label="Voltar para home">
            <ArrowLeft size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="gallery-header-info">
          <span className="gallery-count">Gerador de Catálogo</span>
        </div>
      </header>

      {/* Body */}
      <div className="catalogo-body">
        <div className="catalogo-card">
          <div className="left-glow" />

          <div className="catalogo-card-header">
            <h2 className="catalogo-card-title">Personalize seu Catálogo</h2>
            <p className="catalogo-card-desc">
              Preencha seus dados para gerar um catálogo PDF personalizado com botões de WhatsApp clicáveis.
            </p>
          </div>

          <div className="block-divider" />

          {/* Fields */}
          <div className="fields-group">
            <div className="field-wrapper">
              <label className="field-label" htmlFor="cat-name">
                <User size={9} strokeWidth={2} />
                Nome do Consultor
              </label>
              <input
                id="cat-name"
                className="field-input"
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Maria Silva"
                maxLength={40}
                autoComplete="off"
              />
            </div>

            <div className="field-wrapper">
              <label className="field-label" htmlFor="cat-whatsapp">
                <Phone size={9} strokeWidth={2} />
                WhatsApp
              </label>
              <input
                id="cat-whatsapp"
                className="field-input"
                type="text"
                value={whatsapp}
                onChange={handleWhatsappChange}
                placeholder="(XX) 99999-9999"
                autoComplete="off"
              />
            </div>

            <div className="field-wrapper">
              <label className="field-label" htmlFor="cat-city">
                <MapPin size={9} strokeWidth={2} />
                Cidade e Estado
              </label>
              <input
                id="cat-city"
                className="field-input"
                type="text"
                value={localidade}
                onChange={e => setLocalidade(e.target.value)}
                placeholder="Ex: Camboriú - SC"
                maxLength={50}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="block-divider" />

          {/* Status Message */}
          {resultMessage && (
            <div className={`catalogo-message ${resultMessage.type === 'success' ? 'catalogo-message--success' : 'catalogo-message--error'}`}>
              {resultMessage.type === 'success'
                ? <CheckCircle2 size={14} strokeWidth={1.5} />
                : <AlertCircle size={14} strokeWidth={1.5} />
              }
              <span>{resultMessage.text}</span>
            </div>
          )}

          {/* Download */}
          <div className="download-area">
            <button
              className="download-btn"
              onClick={processPdf}
              disabled={!whatsapp || !nome || isProcessing}
            >
              <Download size={15} strokeWidth={2} />
              {isProcessing ? 'Processando...' : 'Gerar Catálogo'}
            </button>
            <span className="export-hint">PDF interativo com botões de WhatsApp</span>
          </div>
        </div>
      </div>
    </div>
  );
}
