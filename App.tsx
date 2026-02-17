
import React, { useState } from 'react';
import { AppStage, MatchAnalysis, SelectedPlayerInfo, InitialMatchData, TechnicalPhase } from './types';
import { analyzeFullMatch, getInitialMatchLineups } from './services/geminiService';
import { 
  Trophy, 
  Activity, 
  Upload, 
  Play, 
  AlertCircle, 
  Zap,
  BarChart3,
  Search,
  Film,
  Timer,
  FileText,
  Link,
  ExternalLink,
  ChevronRight,
  Download,
  CheckCircle2,
  FileDown, 
  Star,
  Users,
  ShieldAlert,
  ArrowRightLeft,
  Video, 
  Layout,
  Cpu,
  RefreshCw,
  Target,
  Sword,
  ShieldCheck,
  ZapIcon,
  Flag,
  Crosshair,
  Dribbble,
  HandMetal,
  Hammer,
  FileCheck2,
  ScrollText, 
  TrendingUp,
  BrainCircuit,
  Lightbulb,
  ArrowLeft,
  ArrowRight,
  Shield,
  Notebook as NotebookIcon,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldQuestion,
  Info,
  Layers,
  UserCheck,
  User,
  SquareCheckBig,
  Square,
  BadgeCent, 
  CircleX, 
  Sparkles 
} from 'lucide-react';
// No es necesario importar jsPDF ni jspdf-autotable aquí, se cargan globalmente en index.html
// import { jsPDF } from 'jspdf'; 
// (window as any).jsPDF = jsPDF; // Workaround anterior, ya no necesario
// import 'jspdf-autotable'; 

const App: React.FC = () => {
  const [stage, setStage] = useState<AppStage>('upload');
  const [videoFile1, setVideoFile1] = useState<File | null>(null);
  const [videoFile2, setVideoFile2] = useState<File | null>(null);
  const [actaFile, setActaFile] = useState<File | null>(null);
  
  const [targetTeam, setTargetTeam] = useState<'local' | 'visitante'>('local');
  const [side1, setSide1] = useState<'izquierda' | 'derecha'>('izquierda');
  const [side2, setSide2] = useState<'izquierda' | 'derecha'>('derecha');

  const [initialMatchData, setInitialMatchData] = useState<InitialMatchData | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<SelectedPlayerInfo[]>([]);
  
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (type: 'v1' | 'v2' | 'acta') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'v1') setVideoFile1(file);
      else if (type === 'v2') setVideoFile2(file);
      else setActaFile(file);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const extractFrame = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(15, video.duration / 3);
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        resolve(dataUrl.split(',')[1]);
        URL.revokeObjectURL(video.src);
      };
      video.onerror = () => resolve("");
    });
  };

  const getInitialMatchInfoAndProceed = async () => {
    setError(null);
    if (!videoFile1 || !videoFile2 || !actaFile) {
      setError("Faltan archivos obligatorios para la auditoría técnica.");
      return;
    }

    setLoading(true);
    setStage('analyzing'); // Temporarily show analyzing stage for initial data fetch

    try {
      const actaData = await fileToBase64(actaFile!);
      const initialData = await getInitialMatchLineups({ mimeType: 'application/pdf', data: actaData });
      setInitialMatchData(initialData);
      setStage('playerSelection'); // Move to player selection stage
    } catch (err: any) {
      console.error("Error al obtener datos iniciales del acta:", err);
      setError(err.message || "Error crítico al procesar el acta.");
      setStage('selection'); // Go back to selection if initial data fails
    } finally {
      setLoading(false);
    }
  };

  const startFullAnalysis = async () => {
    setError(null);
    setLoading(true);
    setStage('analyzing');
    
    try {
      const v1Data = await extractFrame(videoFile1!);
      const v2Data = await extractFrame(videoFile2!);
      const actaData = await fileToBase64(actaFile!);

      if (!v1Data || !v2Data) {
        throw new Error("No se pudieron extraer imágenes de los videos.");
      }

      const result = await analyzeFullMatch({ 
        targetTeam,
        side1,
        side2,
        videoParts: [
          { mimeType: 'image/jpeg', data: v1Data },
          { mimeType: 'image/jpeg', data: v2Data }
        ],
        actaPart: { mimeType: 'application/pdf', data: actaData }
      }, selectedPlayers); // Pass selected players to the analysis

      setAnalysis(result);
      setStage('report');
    } catch (err: any) {
      console.error("Error en startFullAnalysis:", err);
      setError(err.message || "Error crítico en el proceso de análisis.");
      setStage('playerSelection'); // Go back to player selection if full analysis fails
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerSelection = (player: SelectedPlayerInfo) => {
    setSelectedPlayers(prev => {
      const isSelected = prev.some(p => p.dorsal === player.dorsal && p.name === player.name);
      if (isSelected) {
        return prev.filter(p => p.dorsal !== player.dorsal || p.name !== player.name);
      } else {
        return [...prev, player];
      }
    });
  };

  const statLabels: Record<string, string> = {
    goals: "Goles",
    assists: "Asistencias",
    possession: "Posesión (%)",
    shots: "Disparos",
    shotsOnTarget: "A Puerta",
    saves: "Paradas",
    passAccuracy: "Acierto Pases (%)",
    fouls: "Faltas",
    corners: "Córners"
  };

  const renderStatRow = (label: string, key: string, suffix: string = '') => {
    if (!analysis || !analysis.stats || !(analysis.stats as any)[key]) return null;
    const statsObj = (analysis.stats as any)[key];
    const valA = statsObj.teamA ?? 0;
    const valB = statsObj.teamB ?? 0;
    const total = valA + valB || 1;
    const percA = (valA / total) * 100;

    return (
      <div key={key} className="space-y-3">
        <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-widest text-slate-500">
          <span>{label}</span>
          <div className="flex gap-4">
            <span className="text-emerald-500 font-black">{valA}{suffix}</span>
            <span className="text-slate-800">/</span>
            <span className="text-cyan-500 font-black">{valB}{suffix}</span>
          </div>
        </div>
        <div className="h-2 bg-slate-950 rounded-full flex overflow-hidden border border-slate-900">
          <div className="bg-emerald-500 h-full transition-all duration-700" style={{ width: `${percA}%` }} />
          <div className="bg-cyan-500 h-full transition-all duration-700" style={{ width: `${100 - percA}%` }} />
        </div>
      </div>
    );
  };

  const exportToPDF = () => { 
    console.log("exportToPDF: Función de exportación de PDF llamada.");
    console.log("exportToPDF: Current analysis data:", analysis);

    if (!analysis) {
      console.error("exportToPDF: No analysis data available to export.");
      alert("No hay datos de análisis disponibles para exportar.");
      return;
    }
    try {
      console.log("exportToPDF: Intentando instanciar jsPDF...");
      console.log('exportToPDF: Type of window.jsPDF:', typeof (window as any).jsPDF); // Changed to window.jsPDF

      // Verificación explícita de que window.jsPDF es un constructor
      if (typeof (window as any).jsPDF !== 'function') { // Changed to window.jsPDF
        throw new Error(
          "La librería jsPDF no se ha cargado correctamente como un constructor. " +
          "Por favor, verifica los scripts de jspdf en index.html y la consola del navegador " +
          "para errores de carga de la librería. (window.jsPDF es de tipo: " + // Changed to window.jsPDF
          typeof (window as any).jsPDF + ")" // Changed to window.jsPDF
        );
      }
      
      // Se instancia jsPDF usando la variable global disponible en `window.jsPDF`
      const doc = new ((window as any).jsPDF)(); // Changed to window.jsPDF
      console.log("exportToPDF: jsPDF instanciado correctamente.");
      const primaryColor = [16, 185, 129]; // Emerald-500
      const darkColor = [15, 23, 42]; // Slate-900 equivalent for text
      const greyTextColor = [71, 85, 105]; // Slate-500 equivalent for normal text in PDF

      const targetTeamName = analysis.targetTeamSide === 'local' ? (analysis.teamA.name || 'Equipo Local') : (analysis.teamB.name || 'Equipo Visitante');
      console.log("exportToPDF: Target team name:", targetTeamName);

      // --- Portada ---
      doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.rect(0, 0, 210, 50, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text('SCOUTVISION PRO - DOSSIER TÁCTICO', 105, 25, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`AUDITORÍA INTEGRAL DE RENDIMIENTO: ${targetTeamName}`, 105, 38, { align: 'center' });
      console.log("exportToPDF: Portada generada.");

      // --- Marcador ---
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFontSize(16);
      doc.text(`${analysis.teamA.name || 'Equipo A'} ${analysis.score.teamA} - ${analysis.score.teamB} ${analysis.teamB.name || 'Equipo B'}`, 105, 65, { align: 'center' });
      console.log("exportToPDF: Marcador añadido.");

      // --- Tabla Stats ---
      const statsData = Object.keys(statLabels).map(key => {
        const statsObj = (analysis.stats as any)?.[key] || { teamA: 0, teamB: 0 };
        const valA = statsObj.teamA ?? 0;
        const valB = statsObj.teamB ?? 0;
        const suffix = (key === 'possession' || key === 'passAccuracy') ? '%' : '';
        return [statLabels[key], `${valA}${suffix}`, `${valB}${suffix}`]; // Ensure values are strings for autoTable
      });
      console.log("exportToPDF: statsData preparada:", statsData);

      let currentY = 75; // Initial Y for the stats table
      // `autoTable` ahora debería estar disponible en el objeto `doc`
      (doc as any).autoTable({
        startY: currentY, 
        head: [['Parámetro', 'Local', 'Visitante']],
        body: statsData,
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] }, // Set text color to white for readability on colored head
        styles: { fontSize: 8, halign: 'center' },
      });
      
      // Update currentY after autoTable, providing a safe fallback if autoTable didn't return a finalY (shouldn't happen with valid data)
      currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 15 : 150; 
      if (isNaN(currentY)) { 
          console.error("exportToPDF: currentY calculated as NaN after autoTable. Resetting to 150.");
          currentY = 150; 
      }
      console.log("exportToPDF: Tabla de estadísticas añadida. currentY:", currentY);

      // --- Informe Táctico Colectivo ---
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text('ANÁLISIS TÁCTICO COLECTIVO', 10, currentY); // Left-aligned title
      console.log("exportToPDF: Iniciando sección de análisis táctico colectivo.");

      const addTechnicalPhaseToPdf = (title: string, phase: TechnicalPhase | undefined, yPos: number, pageBreakThreshold: number = 260) => {
          if (!phase) {
              console.warn(`exportToPDF: Fase técnica '${title}' no disponible.`);
              return yPos; // Skip if phase is undefined
          }

          if (yPos > pageBreakThreshold) {
              doc.addPage();
              yPos = 20;
          }
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text(title, 10, yPos);
          yPos += 6; 
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(greyTextColor[0], greyTextColor[1], greyTextColor[2]); 
          const splitDesc = doc.splitTextToSize(phase.description || 'Descripción no disponible.', 180); // Fallback for description
          doc.text(splitDesc, 10, yPos);
          yPos += (splitDesc.length * doc.getLineHeight()) + 4; 

          if (phase.keyAspects && phase.keyAspects.length > 0) {
              if (yPos > pageBreakThreshold - 20) { 
                  doc.addPage();
                  yPos = 20;
              }
              doc.setFontSize(10);
              doc.setFont("helvetica", "bold");
              doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]); 
              doc.text('Puntos Clave:', 10, yPos);
              yPos += 5; 
              doc.setFontSize(9);
              doc.setFont("helvetica", "normal");
              doc.setTextColor(greyTextColor[0], greyTextColor[1], greyTextColor[2]); 
              phase.keyAspects.forEach(aspect => {
                  const splitAspect = doc.splitTextToSize(`• ${aspect}`, 180);
                  doc.text(splitAspect, 10, yPos);
                  yPos += (splitAspect.length * doc.getLineHeight());
              });
              yPos += 6; 
          }
          return yPos;
      };

      currentY = addTechnicalPhaseToPdf('Fase Ofensiva:', analysis.technicalReport?.offensivePhase, currentY + 10);
      currentY = addTechnicalPhaseToPdf('Fase Defensiva:', analysis.technicalReport?.defensivePhase, currentY); 
      currentY = addTechnicalPhaseToPdf('Transiciones (Ataque-Defensa / Defensa-Ataque):', analysis.technicalReport?.transitions, currentY);
      currentY = addTechnicalPhaseToPdf('Estrategia y Balón Parado:', analysis.technicalReport?.setPieces, currentY);
      console.log("exportToPDF: Fases técnicas añadidas. currentY:", currentY);
      
      // --- Conclusiones Tácticas Clave (Separado) ---
      if (currentY > 260) { doc.addPage(); currentY = 20; }
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]); // Primary color for key conclusions
      doc.text('CONCLUSIONES TÁCTICAS CLAVE', 10, currentY);
      currentY += 8;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      const splitSummary = doc.splitTextToSize(analysis.tacticalSummary || 'Resumen no disponible.', 180); // Fallback for summary
      doc.text(splitSummary, 10, currentY);
      currentY += (splitSummary.length * doc.getLineHeight()) + 10;
      console.log("exportToPDF: Resumen táctico añadido. currentY:", currentY);


      // --- Scouting Individual por Zonas ---
      doc.addPage();
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]); // Dark color for main title
      doc.text('INFORME DE RENDIMIENTO POR ZONAS', 10, 20);
      console.log("exportToPDF: Iniciando sección de informe de rendimiento individual por zonas.");
      
      const zones = [
        { id: 'defensiva', label: 'Zona Defensiva (Bloque Defensivo)' }, 
        { id: 'media', label: 'Zona de Construcción (Bloque de Construcción)' }, 
        { id: 'ofensiva', label: 'Zona Ofensiva (Bloque Ofensivo)' } 
      ];

      currentY = 30;
      const PAGE_BREAK_THRESHOLD_PLAYER = 255; 

      zones.forEach(zone => {
        const players = analysis.keyPerformers?.filter(p => p.zone === zone.id) || []; // Ensure players array is not null
        if (players.length > 0) {
          // Calculate estimated height for the zone title + first player to decide on page break
          let estimatedFirstPlayerBlockHeight = 0;
          const p = players[0]; // Assume at least one player if players.length > 0
          const individualAnalysisText = p.individualAnalysis || 'Análisis no disponible.';
          const strengths = p.improvementFeedback?.strengths || [];
          const weaknesses = p.improvementFeedback?.weaknesses || [];
          const improvementAdvice = p.improvementFeedback?.improvementAdvice || [];

          estimatedFirstPlayerBlockHeight =
              7 + // Space after zone title
              15 + // Player Name and Dorsal + padding for title (11pt + 7pt margin)
              (doc.splitTextToSize(`"${individualAnalysisText}"`, 180).length * doc.getLineHeight()) + 4 + // Individual analysis + margin
              (p.improvementFeedback ? (
                  4 + // MEJORA DE RENDIMIENTO title + margin
                  (strengths.length > 0 ? (doc.getLineHeight() + (strengths.length * doc.getLineHeight()) + 3) : 0) + // Strengths section + margin
                  (weaknesses.length > 0 ? (doc.getLineHeight() + (weaknesses.length * doc.getLineHeight()) + 3) : 0) + // Weaknesses section + margin
                  (improvementAdvice.length > 0 ? (doc.getLineHeight() + (improvementAdvice.length * doc.getLineHeight())) : 0) // Advice section
              ) : 0) +
              8; // Space after player's full section

          const zoneTitleLineHeight = doc.getLineHeight(12); // Line height for 12pt font
          const zoneTitleSpacing = 7; // Space after zone title
          const totalZoneHeaderAndFirstPlayerHeight = zoneTitleLineHeight + zoneTitleSpacing + estimatedFirstPlayerBlockHeight;

          // If currentY for the zone title + first player block would push beyond the threshold
          if (currentY + totalZoneHeaderAndFirstPlayerHeight > PAGE_BREAK_THRESHOLD_PLAYER) {
            doc.addPage();
            currentY = 20;
          }

          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.text(zone.label, 10, currentY);
          currentY += 7; // Espaciado reducido después del título de zona
          
          players.forEach(p => {
              const individualAnalysisText = p.individualAnalysis || 'Análisis no disponible.';
              const strengths = p.improvementFeedback?.strengths || [];
              const weaknesses = p.improvementFeedback?.weaknesses || [];
              const improvementAdvice = p.improvementFeedback?.improvementAdvice || [];

              // Estimate height needed for this player's info (re-calculating for precision per player)
              const playerInfoHeight = 
                  7 + // Player Name and Dorsal + padding (11pt + 7pt margin)
                  (doc.splitTextToSize(`"${individualAnalysisText}"`, 180).length * doc.getLineHeight()) + 4 + // Individual analysis + margin
                  (p.improvementFeedback ? (
                      4 + // MEJORA DE RENDIMIENTO title + margin
                      (strengths.length > 0 ? (doc.getLineHeight() + (strengths.length * doc.getLineHeight()) + 3) : 0) + // Strengths section + margin
                      (weaknesses.length > 0 ? (doc.getLineHeight() + (weaknesses.length * doc.getLineHeight()) + 3) : 0) + // Weaknesses section + margin
                      (improvementAdvice.length > 0 ? (doc.getLineHeight() + (improvementAdvice.length * doc.getLineHeight())) : 0) // Advice section
                  ) : 0) +
                  8; // Space after player's full section

              if (currentY + playerInfoHeight > PAGE_BREAK_THRESHOLD_PLAYER) {
                  doc.addPage();
                  currentY = 20; 
              }

              // Player Name and Dorsal
              doc.setFontSize(11);
              doc.setFont("helvetica", "bold");
              doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
              doc.text(`#${p.dorsal} ${p.player}`, 10, currentY);
              currentY += 7; // Espaciado reducido después del nombre del jugador

              // Individual Analysis
              doc.setFontSize(9);
              doc.setFont("helvetica", "normal"); 
              doc.setTextColor(greyTextColor[0], greyTextColor[1], greyTextColor[2]);
              const individualAnalysisLines = doc.splitTextToSize(`"${individualAnalysisText}"`, 180);
              doc.text(individualAnalysisLines, 10, currentY);
              currentY += (individualAnalysisLines.length * doc.getLineHeight()) + 4; // Espaciado reducido

              // Improvement Feedback
              if (p.improvementFeedback) {
                  doc.setFontSize(9);
                  doc.setFont("helvetica", "bold");
                  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
                  doc.text('MEJORA DE RENDIMIENTO', 10, currentY);
                  currentY += 4; // Espaciado reducido
                  
                  // Puntos Fuertes
                  if (strengths.length > 0) {
                      doc.setFontSize(9); 
                      doc.setFont("helvetica", "bold");
                      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
                      doc.text('Fortalezas:', 15, currentY);
                      currentY += doc.getLineHeight();
                      doc.setFont("helvetica", "normal");
                      doc.setTextColor(greyTextColor[0], greyTextColor[1], greyTextColor[2]);
                      strengths.forEach(s => {
                          const strengthItemLines = doc.splitTextToSize(`• ${s}`, 175);
                          doc.text(strengthItemLines, 20, currentY);
                          currentY += (strengthItemLines.length * doc.getLineHeight());
                      });
                      currentY += 3; // Espaciado reducido
                  }

                  // Áreas de Mejora
                  if (weaknesses.length > 0) {
                      doc.setFontSize(9); 
                      doc.setFont("helvetica", "bold");
                      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
                      doc.text('Debilidades:', 15, currentY);
                      currentY += doc.getLineHeight();
                      doc.setFont("helvetica", "normal");
                      doc.setTextColor(greyTextColor[0], greyTextColor[1], greyTextColor[2]);
                      weaknesses.forEach(w => {
                          const weaknessItemLines = doc.splitTextToSize(`• ${w}`, 175);
                          doc.text(weaknessItemLines, 20, currentY);
                          currentY += (weaknessItemLines.length * doc.getLineHeight());
                      });
                      currentY += 3; // Espaciado reducido
                  }

                  // Consejos
                  if (improvementAdvice.length > 0) {
                      doc.setFontSize(9); 
                      doc.setFont("helvetica", "bold");
                      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
                      doc.text('Consejos:', 15, currentY);
                      currentY += doc.getLineHeight();
                      doc.setFont("helvetica", "normal");
                      doc.setTextColor(greyTextColor[0], greyTextColor[1], greyTextColor[2]);
                      improvementAdvice.forEach(a => {
                          const adviceItemLines = doc.splitTextToSize(`• ${a}`, 175);
                          doc.text(adviceItemLines, 20, currentY);
                          currentY += (adviceItemLines.length * doc.getLineHeight());
                      });
                  }
              }
              currentY += 8; // Espaciado reducido después de un jugador completo
          });
        } else {
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(greyTextColor[0], greyTextColor[1], greyTextColor[2]);
          doc.text('Sin registros destacados en esta zona.', 10, currentY);
          currentY += 8; // Espaciado reducido
        }
        currentY += 12; // Espaciado reducido después de una zona completa
      });
      console.log("exportToPDF: Análisis individual de jugadores añadido. currentY:", currentY);

      console.log("exportToPDF: Preparando el documento PDF para la descarga...");
      const pdfBlob = doc.output('blob'); // Generate PDF as a Blob
      const blobUrl = URL.createObjectURL(pdfBlob); // Create a URL for the Blob

      const link = document.createElement('a'); // Create a temporary anchor element
      link.href = blobUrl;
      link.download = `Dossier_Táctico_${targetTeamName}.pdf`; // Set the download filename
      document.body.appendChild(link); // Append the link to the document body
      link.click(); // Programmatically click the link to trigger download
      
      // Añadir un pequeño retraso antes de limpiar para asegurar que la descarga se inicie
      setTimeout(() => {
        document.body.removeChild(link); // Remove the link from the document
        URL.revokeObjectURL(blobUrl); // Revoke the Blob URL to free up memory
        console.log("exportToPDF: Limpieza de recursos completada tras intento de descarga.");
      }, 250); // Aumentado el retraso a 250ms

      console.log("exportToPDF: Operación de descarga de PDF iniciada.");
      alert("¡Dossier Táctico generado con éxito!"); // Final success alert
    } catch (e) {
      console.error("exportToPDF: Error durante la generación del PDF:", e);
      alert(`Error al generar el PDF. Por favor, revisa la consola del navegador para más detalles: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const targetTeamName = analysis ? (analysis.targetTeamSide === 'local' ? (analysis.teamA?.name || 'Local') : (analysis.teamB?.name || 'Visitante')) : '';
  
  // Combine lineup and subs for player selection
  const allAvailablePlayers = initialMatchData 
    ? (targetTeam === 'local' 
        ? [...initialMatchData.teamA.lineup, ...initialMatchData.teamA.subs] 
        : [...initialMatchData.teamB.lineup, ...initialMatchData.teamB.subs]
      )
    : [];
  
  // Deduplicate players if they appear in both lineup and subs (e.g., if a starter is also listed in a broader subs list)
  const uniqueAllAvailablePlayers = Array.from(new Map(
    allAvailablePlayers.map(player => [`${player.dorsal}-${player.name}`, player])
  ).values());

  const renderPlayerCard = (p: SelectedPlayerInfo, isSelected: boolean, onSelect: (player: SelectedPlayerInfo) => void) => (
    <button
      key={`${p.dorsal}-${p.name}`}
      onClick={() => onSelect(p)}
      className={`relative bg-slate-950/50 p-6 rounded-[2rem] border-2 transition-all text-left
                  ${isSelected ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'border-slate-800 hover:border-slate-700'}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-emerald-500 font-black text-lg border border-slate-800 shadow-inner">
          #{p.dorsal}
        </div>
        {isSelected ? (
          <SquareCheckBig className="w-6 h-6 text-emerald-500" />
        ) : (
          <Square className="w-6 h-6 text-slate-700" />
        )}
      </div>
      <h5 className="text-sm font-black uppercase italic tracking-tighter text-slate-100">{p.name}</h5>
      <p className="text-[10px] text-slate-500 mt-1">Dorsal: {p.dorsal}</p>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-[#020617] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Cpu className="w-8 h-8 text-emerald-500" />
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter">ScoutVision <span className="text-emerald-500">PRO</span></h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Auditoría Táctica UEFA PRO</p>
            </div>
          </div>
          {analysis && (
            <button onClick={exportToPDF} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2">
               <FileDown className="w-4 h-4" /> Exportar Dossier Táctico
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        {stage === 'upload' && (
          <div className="max-w-5xl mx-auto py-12">
             <div className="text-center mb-16">
                <h2 className="text-5xl font-black mb-4 uppercase italic text-emerald-500">Match Intelligence</h2>
                <p className="text-slate-500 font-bold uppercase text-xs tracking-[0.3em]">IA de Video Scouting Técnico y Análisis de Alta Precisión</p>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { id: 'v1', label: '1er Tiempo (Video)', file: videoFile1, IconComponent: Video },
                  { id: 'v2', label: '2do Tiempo (Video)', file: videoFile2, IconComponent: Video },
                  { id: 'acta', label: 'Acta Oficial (PDF)', file: actaFile, IconComponent: ScrollText, accept: '.pdf' }
                ].map((item) => (
                  <div key={item.id} className={`bg-slate-900/30 border-2 border-dashed rounded-[2.5rem] p-10 text-center transition-all ${ item.file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-800 hover:border-slate-700'}`}>
                     <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 bg-slate-800 border border-slate-700">
                        {/* Renderiza el componente del icono directamente, pasando el className */}
                        <item.IconComponent className={"w-10 h-10 " + (item.file ? "text-emerald-400" : "text-slate-600")} />
                     </div>
                     <h3 className="text-xl font-black mb-1 uppercase italic tracking-tighter">{item.label}</h3>
                     <p className="text-[10px] text-slate-500 font-black uppercase mb-8 truncate px-4">{item.file ? item.file.name : 'Archivo pendiente'}</p>
                     <label className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-black py-4 px-8 rounded-2xl cursor-pointer text-[10px] uppercase border border-slate-700 inline-block transition-all shadow-xl">
                        Cargar Fuente
                        <input type="file" className="hidden" accept={item.accept || 'video/*'} onChange={handleFileUpload(item.id as any)} />
                     </label>
                  </div>
                ))}
             </div>
             <div className="mt-16 text-center">
                <button 
                  onClick={() => setStage('selection')} // Proceed to selection first
                  disabled={!videoFile1 || !videoFile2 || !actaFile} 
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black py-6 px-24 rounded-3xl transition-all uppercase tracking-tighter text-lg shadow-2xl shadow-emerald-500/20 active:scale-95"
                >
                  Continuar a Táctica
                </button>
             </div>
          </div>
        )}

        {stage === 'selection' && (
          <div className="max-w-4xl mx-auto py-12">
             <div className="bg-slate-900/40 rounded-[3rem] border border-slate-800 p-12 shadow-2xl backdrop-blur-md">
                <h3 className="text-3xl font-black uppercase italic mb-12 flex items-center gap-4">
                  <Layout className="w-8 h-8 text-emerald-500" /> Parámetros de Scouting
                </h3>
                
                <div className="space-y-12">
                   <div>
                      <label className="text-[11px] font-black uppercase text-slate-500 tracking-[0.3em] mb-6 block text-center">Seleccionar Equipo a Auditar</label>
                      <div className="grid grid-cols-2 gap-6">
                         {[
                           { id: 'local', label: 'Equipo Local', sub: '(Izquierda Acta)' },
                           { id: 'visitante', label: 'Equipo Visitante', sub: '(Derecha Acta)' }
                         ].map(t => (
                           <button 
                             key={t.id}
                             onClick={() => setTargetTeam(t.id as any)}
                             className={`p-10 rounded-[2.5rem] border-2 transition-all flex flex-col items-center ${targetTeam === t.id ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'border-slate-800 bg-slate-950 hover:border-slate-700'}`}
                           >
                              <Shield className={`w-10 h-10 mb-4 ${targetTeam === t.id ? 'text-emerald-500' : 'text-slate-700'}`} />
                              <div className="text-xl font-black uppercase italic tracking-tighter">{t.label}</div>
                              <div className="text-[10px] font-black text-slate-500 uppercase mt-2">{t.sub}</div>
                           </button>
                         ))}
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-12 border-t border-slate-800 pt-12">
                      <div>
                         <label className="text-[11px] font-black uppercase text-slate-500 tracking-[0.3em] mb-6 block">Defensa Objetivo 1T</label>
                         <div className="flex gap-4">
                            {[
                              { id: 'izquierda', icon: <ArrowLeft /> },
                              { id: 'derecha', icon: <ArrowRight /> }
                            ].map(side => (
                              <button 
                                key={side.id}
                                onClick={() => setSide1(side.id as any)}
                                className={`flex-1 p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${side1 === side.id ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-slate-800 text-slate-600'}`}
                              >
                                 {side.icon}
                                 <span className="text-[10px] font-black uppercase">{side.id}</span>
                              </button>
                            ))}
                         </div>
                      </div>
                      <div>
                         <label className="text-[11px] font-black uppercase text-slate-500 tracking-[0.3em] mb-6 block">Defensa Objetivo 2T</label>
                         <div className="flex gap-4">
                            {[
                              { id: 'izquierda', icon: <ArrowLeft /> },
                              { id: 'derecha', icon: <ArrowRight /> }
                            ].map(side => (
                              <button 
                                key={side.id}
                                onClick={() => setSide2(side.id as any)}
                                className={`flex-1 p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${side2 === side.id ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-slate-800 text-slate-600'}`}
                              >
                                 {side.icon}
                                 <span className="text-[10px] font-black uppercase">{side.id}</span>
                              </button>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>

                <div className="mt-16 text-center">
                  {error && <div className="mb-6 text-red-500 text-xs font-black uppercase bg-red-500/10 p-4 rounded-xl border border-red-500/20">{error}</div>}
                  <button onClick={getInitialMatchInfoAndProceed} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-6 px-28 rounded-3xl transition-all uppercase text-lg shadow-2xl shadow-emerald-500/20 active:scale-95">
                    Confirmar Parámetros
                  </button>
                </div>
             </div>
          </div>
        )}

        {stage === 'playerSelection' && initialMatchData && (
          <div className="max-w-5xl mx-auto py-12">
            <div className="bg-slate-900/40 rounded-[3rem] border border-slate-800 p-12 shadow-2xl backdrop-blur-md">
              <h3 className="text-3xl font-black uppercase italic mb-12 flex items-center gap-4">
                <UserCheck className="w-8 h-8 text-emerald-500" /> Selección de Jugadores Clave
              </h3>
              
              <div className="grid grid-cols-1 gap-12"> {/* Reverted to single column */}
                  {/* Sección para Jugadores Clave (Análisis Individual) */}
                  <div>
                      <p className="text-slate-400 mb-8 text-[11px] font-black uppercase tracking-wider text-center">
                        Selecciona los jugadores de tu equipo que deseas para un análisis de scouting personalizado.
                      </p>
                      <div className="text-center mb-8">
                        <span className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-5 py-2 rounded-xl text-sm font-black uppercase border border-emerald-500/20">
                          <User className="w-4 h-4" /> {selectedPlayers.length} jugadores seleccionados
                        </span>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 custom-scrollbar max-h-[50vh] overflow-y-auto pr-2"> {/* Adjusted grid */}
                        {uniqueAllAvailablePlayers.length > 0 ? (
                          uniqueAllAvailablePlayers.map(player => (
                            renderPlayerCard(
                              player,
                              selectedPlayers.some(p => p.dorsal === player.dorsal && p.name === player.name),
                              handlePlayerSelection
                            )
                          ))
                        ) : (
                          <div className="col-span-full py-12 text-center text-slate-500 text-sm italic">
                            No se encontró la alineación ni los suplentes del equipo {targetTeam === 'local' ? initialMatchData.teamA.name : initialMatchData.teamB.name}.
                          </div>
                        )}
                      </div>
                  </div>
              </div>

              <div className="mt-16 text-center">
                {error && <div className="mb-6 text-red-500 text-xs font-black uppercase bg-red-500/10 p-4 rounded-xl border border-red-500/20">{error}</div>}
                <button 
                  onClick={startFullAnalysis} 
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black py-6 px-28 rounded-3xl transition-all uppercase text-lg shadow-2xl shadow-emerald-500/20 active:scale-95"
                >
                  Iniciar Análisis Completo
                </button>
              </div>
            </div>
          </div>
        )}

        {stage === 'analyzing' && (
           <div className="max-w-2xl mx-auto py-32 text-center">
              <div className="w-44 h-44 mx-auto mb-16 border-[12px] border-slate-800 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_50px_rgba(16,185,129,0.1)]" />
              <h2 className="text-4xl font-black mb-8 italic uppercase tracking-tighter text-emerald-500">Auditoría Magistral</h2>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.5em] mb-12 italic">Generando Dossier de Rendimiento UEFA PRO</p>
              <div className="space-y-4 text-left max-w-sm mx-auto">
                 {[
                   'Segmentando zonas del campo...', 
                   `Analizando bloque defensivo del ${targetTeam}...`, 
                   'Evaluando transición en zona media...',
                   'Auditando impacto en zona ofensiva...'
                 ].map((t, i) => (
                    <div key={i} className="flex items-center gap-4 text-[11px] font-black uppercase text-slate-400 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 transition-all">
                       <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse" /> {t}
                    </div>
                 ))}
              </div>
           </div>
        )}

        {stage === 'report' && analysis && (
          <div className="space-y-12 pb-20 animate-in fade-in duration-700">
            {/* Marcador Principal */}
            <div className="bg-slate-900/60 rounded-[4rem] p-12 border border-slate-800 flex items-center justify-between shadow-2xl relative overflow-hidden backdrop-blur-xl">
               <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
               <div className="text-center flex-1">
                  <span className="text-[11px] font-black uppercase text-emerald-500 mb-2 block tracking-widest">{analysis.teamA.initialFormation || '4-3-3'}</span>
                  <h3 className="text-3xl font-black uppercase italic tracking-tighter">{analysis.teamA.name}</h3>
               </div>
               <div className="flex items-center gap-12 px-12 text-center">
                  <div className="flex flex-col">
                    <span className="text-8xl font-black italic tracking-tighter text-slate-100">{analysis.score.teamA}</span>
                  </div>
                  <div className="w-px h-24 bg-slate-800" />
                  <div className="flex flex-col">
                    <span className="text-8xl font-black italic tracking-tighter text-slate-100">{analysis.score.teamB}</span>
                  </div>
               </div>
               <div className="text-center flex-1">
                  <span className="text-[11px] font-black uppercase text-cyan-500 mb-2 block tracking-widest">{analysis.teamB.initialFormation || '4-3-3'}</span>
                  <h3 className="text-3xl font-black uppercase italic tracking-tighter">{analysis.teamB.name}</h3>
               </div>
            </div>

            {/* INFORME TÁCTICO COLECTIVO (UI) */}
            <div className="bg-slate-900/40 rounded-[3rem] border border-slate-800 p-12 shadow-xl">
                <div className="flex items-center justify-between mb-12">
                   <h4 className="text-xs font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-4">
                       <NotebookIcon className="w-6 h-6 text-emerald-500" /> Informe Táctico Colectivo
                   </h4>
                   <div className="bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-emerald-500/20 tracking-widest">
                      Análisis Estratégico
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   {/* Fase Ofensiva */}
                   <div className="bg-slate-950/40 p-8 rounded-[2.5rem] border border-slate-800 space-y-4">
                      <div className="flex items-center gap-4 text-emerald-500">
                         <ArrowUpRight className="w-6 h-6" />
                         <h5 className="font-black uppercase tracking-widest text-xs italic">Fase Ofensiva</h5>
                      </div>
                      <p className="text-[12px] text-slate-400 leading-relaxed italic">{analysis.technicalReport.offensivePhase?.description}</p>
                      {analysis.technicalReport.offensivePhase?.keyAspects && analysis.technicalReport.offensivePhase.keyAspects.length > 0 && (
                          <ul className="list-disc list-inside text-[11px] text-slate-500 space-y-1 pl-4 border-l border-slate-800 py-1">
                              {analysis.technicalReport.offensivePhase.keyAspects.map((aspect, idx) => (
                                  <li key={idx}>{aspect}</li>
                              ))}
                          </ul>
                      )}
                   </div>
                   {/* Fase Defensiva */}
                   <div className="bg-slate-950/40 p-8 rounded-[2.5rem] border border-slate-800 space-y-4">
                      <div className="flex items-center gap-4 text-cyan-500">
                         <ShieldCheck className="w-6 h-6" />
                         <h5 className="font-black uppercase tracking-widest text-xs italic">Fase Defensiva</h5>
                      </div>
                      <p className="text-[12px] text-slate-400 leading-relaxed italic">{analysis.technicalReport.defensivePhase?.description}</p>
                      {analysis.technicalReport.defensivePhase?.keyAspects && analysis.technicalReport.defensivePhase.keyAspects.length > 0 && (
                          <ul className="list-disc list-inside text-[11px] text-slate-500 space-y-1 pl-4 border-l border-slate-800 py-1">
                              {analysis.technicalReport.defensivePhase.keyAspects.map((aspect, idx) => (
                                  <li key={idx}>{aspect}</li>
                              ))}
                          </ul>
                      )}
                   </div>
                   {/* Transiciones */}
                   <div className="bg-slate-950/40 p-8 rounded-[2.5rem] border border-slate-800 space-y-4">
                      <div className="flex items-center gap-4 text-amber-500">
                         <ArrowRightLeft className="w-6 h-6" />
                         <h5 className="font-black uppercase tracking-widest text-xs italic">Transiciones</h5>
                      </div>
                      <p className="text-[12px] text-slate-400 leading-relaxed italic">{analysis.technicalReport.transitions?.description}</p>
                      {analysis.technicalReport.transitions?.keyAspects && analysis.technicalReport.transitions.keyAspects.length > 0 && (
                          <ul className="list-disc list-inside text-[11px] text-slate-500 space-y-1 pl-4 border-l border-slate-800 py-1">
                              {analysis.technicalReport.transitions.keyAspects.map((aspect, idx) => (
                                  <li key={idx}>{aspect}</li>
                              ))}
                          </ul>
                      )}
                   </div>
                   {/* Balón Parado */}
                   <div className="bg-slate-950/40 p-8 rounded-[2.5rem] border border-slate-800 space-y-4">
                      <div className="flex items-center gap-4 text-rose-500">
                         <Flag className="w-6 h-6" />
                         <h5 className="font-black uppercase tracking-widest text-xs italic">Balón Parado</h5>
                      </div>
                      <p className="text-[12px] text-slate-400 leading-relaxed italic">{analysis.technicalReport.setPieces?.description}</p>
                      {analysis.technicalReport.setPieces?.keyAspects && analysis.technicalReport.setPieces.keyAspects.length > 0 && (
                          <ul className="list-disc list-inside text-[11px] text-slate-500 space-y-1 pl-4 border-l border-slate-800 py-1">
                              {analysis.technicalReport.setPieces.keyAspects.map((aspect, idx) => (
                                  <li key={idx}>{aspect}</li>
                              ))}
                          </ul>
                      )}
                   </div>
                </div>
                {/* Conclusiones Tácticas Clave (UI) */}
                <div className="mt-16 bg-slate-950/40 p-8 rounded-[2.5rem] border border-emerald-500/20 space-y-4 shadow-xl">
                   <div className="flex items-center gap-4 text-emerald-500">
                      <Lightbulb className="w-6 h-6" />
                      <h5 className="font-black uppercase tracking-widest text-xs italic">Conclusiones Tácticas Clave</h5>
                   </div>
                   <p className="text-[12px] text-slate-300 leading-relaxed italic border-l-2 border-slate-800 pl-4 py-1">
                      "{analysis.tacticalSummary}"
                   </p>
                </div>
            </div>

            {/* INFORME INDIVIDUAL POR ZONAS (UI) */}
            <div className="bg-slate-900/40 rounded-[3rem] border border-slate-800 p-12 shadow-xl">
                <div className="flex items-center justify-between mb-12">
                   <h4 className="text-xs font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-4">
                       <Layers className="w-6 h-6 text-emerald-500" /> Auditoría Individual por Zonas: {targetTeamName}
                   </h4>
                   <div className="bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-emerald-500/20 tracking-widest">
                      Análisis Equilibrado
                   </div>
                </div>

                <div className="space-y-16">
                   {/* Zona Defensiva */}
                   <div>
                      <div className="flex items-center gap-3 mb-8 border-b border-slate-800 pb-4">
                         <ShieldCheck className="w-5 h-5 text-cyan-500" />
                         <h5 className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-500">Bloque Defensivo (Defensas / Portería)</h5>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                         {(analysis.keyPerformers || []).filter(p => p.zone === 'defensiva').map(p => (
                            <div key={`${p.dorsal}-${p.player}`} className="bg-slate-950/50 p-6 rounded-[2rem] border border-slate-800 relative group hover:border-emerald-500/40 transition-all flex flex-col shadow-lg">
                               <div className="flex items-center justify-between mb-4">
                                 <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-emerald-500 font-black text-lg border border-slate-800 shadow-inner">
                                   #{p.dorsal}
                                 </div>
                                 <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter bg-cyan-500/10 text-cyan-400 border border-cyan-500/20`}>
                                   {p.zone}
                                 </div>
                               </div>
                               <h5 className="text-sm font-black uppercase italic tracking-tighter text-slate-100 mb-3">{p.player}</h5>
                               <p className="text-[11px] text-slate-400 leading-relaxed italic border-l-2 border-slate-800 pl-4 py-1 flex-1">
                                 "{p.individualAnalysis}"
                               </p>
                               {/* Puntos de Mejora */}
                               {p.improvementFeedback && (
                                  <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-left">
                                      <h6 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-2"><Sparkles className="w-3 h-3 text-emerald-400"/> Mejora de Rendimiento</h6>
                                      {(p.improvementFeedback.strengths || []).length > 0 && (
                                        <div>
                                          <p className="text-[10px] font-bold text-emerald-300 flex items-center gap-1"><BadgeCent className="w-3 h-3"/> Fortalezas:</p>
                                          <ul className="list-disc list-inside text-[10px] text-slate-400 pl-3">
                                            {(p.improvementFeedback.strengths || []).map((item, idx) => <li key={idx}>{item}</li>)}
                                          </ul>
                                        </div>
                                      )}
                                      {(p.improvementFeedback.weaknesses || []).length > 0 && (
                                        <div>
                                          <p className="text-[10px] font-bold text-red-300 flex items-center gap-1"><CircleX className="w-3 h-3"/> Debilidades:</p>
                                          <ul className="list-disc list-inside text-[10px] text-slate-400 pl-3">
                                            {(p.improvementFeedback.weaknesses || []).map((item, idx) => <li key={idx}>{item}</li>)}
                                          </ul>
                                        </div>
                                      )}
                                      {(p.improvementFeedback.improvementAdvice || []).length > 0 && (
                                        <div>
                                          <p className="text-[10px] font-bold text-amber-300 flex items-center gap-1"><Lightbulb className="w-3 h-3"/> Consejos:</p>
                                          <ul className="list-disc list-inside text-[10px] text-slate-400 pl-3">
                                            {(p.improvementFeedback.improvementAdvice || []).map((item, idx) => <li key={idx}>{item}</li>)}
                                          </ul>
                                        </div>
                                      )}
                                  </div>
                               )}
                             </div>
                         ))}
                         {(analysis.keyPerformers || []).filter(p => p.zone === 'defensiva').length === 0 && (
                           <div className="col-span-full py-8 text-center bg-slate-900/40 rounded-3xl border border-slate-800/50 italic text-slate-600 text-[10px] uppercase font-bold tracking-widest">Sin registros destacados en esta zona</div>
                         )}
                      </div>
                   </div>

                   {/* Zona Media */}
                   <div>
                      <div className="flex items-center gap-3 mb-8 border-b border-slate-800 pb-4">
                         <ArrowRightLeft className="w-5 h-5 text-amber-500" />
                         <h5 className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-500">Zona de Construcción (Bloque de Construcción)</h5>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                         {(analysis.keyPerformers || []).filter(p => p.zone === 'media').map(p => (
                           <div key={`${p.dorsal}-${p.player}`} className="bg-slate-950/50 p-6 rounded-[2rem] border border-slate-800 relative group hover:border-emerald-500/40 transition-all flex flex-col shadow-lg">
                               <div className="flex items-center justify-between mb-4">
                                 <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-emerald-500 font-black text-lg border border-slate-800 shadow-inner">
                                   #{p.dorsal}
                                 </div>
                                 <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter bg-amber-500/10 text-amber-400 border border-amber-500/20`}>
                                   {p.zone}
                                 </div>
                               </div>
                               <h5 className="text-sm font-black uppercase italic tracking-tighter text-slate-100 mb-3">{p.player}</h5>
                               <p className="text-[11px] text-slate-400 leading-relaxed italic border-l-2 border-slate-800 pl-4 py-1 flex-1">
                                 "{p.individualAnalysis}"
                               </p>
                               {/* Puntos de Mejora */}
                               {p.improvementFeedback && (
                                  <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-left">
                                      <h6 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-2"><Sparkles className="w-3 h-3 text-emerald-400"/> Mejora de Rendimiento</h6>
                                      {(p.improvementFeedback.strengths || []).length > 0 && (
                                        <div>
                                          <p className="text-[10px] font-bold text-emerald-300 flex items-center gap-1"><BadgeCent className="w-3 h-3"/> Fortalezas:</p>
                                          <ul className="list-disc list-inside text-[10px] text-slate-400 pl-3">
                                            {(p.improvementFeedback.strengths || []).map((item, idx) => <li key={idx}>{item}</li>)}
                                          </ul>
                                        </div>
                                      )}
                                      {(p.improvementFeedback.weaknesses || []).length > 0 && (
                                        <div>
                                          <p className="text-[10px] font-bold text-red-300 flex items-center gap-1"><CircleX className="w-3 h-3"/> Debilidades:</p>
                                          <ul className="list-disc list-inside text-[10px] text-slate-400 pl-3">
                                            {(p.improvementFeedback.weaknesses || []).map((item, idx) => <li key={idx}>{item}</li>)}
                                          </ul>
                                        </div>
                                      )}
                                      {(p.improvementFeedback.improvementAdvice || []).length > 0 && (
                                        <div>
                                          <p className="text-[10px] font-bold text-amber-300 flex items-center gap-1"><Lightbulb className="w-3 h-3"/> Consejos:</p>
                                          <ul className="list-disc list-inside text-[10px] text-slate-400 pl-3">
                                            {(p.improvementFeedback.improvementAdvice || []).map((item, idx) => <li key={idx}>{item}</li>)}
                                          </ul>
                                        </div>
                                      )}
                                  </div>
                               )}
                             </div>
                         ))}
                         {(analysis.keyPerformers || []).filter(p => p.zone === 'media').length === 0 && (
                           <div className="col-span-full py-8 text-center bg-slate-900/40 rounded-3xl border border-slate-800/50 italic text-slate-600 text-[10px] uppercase font-bold tracking-widest">Sin registros destacados en esta zona</div>
                         )}
                      </div>
                   </div>

                   {/* Zona Ofensiva */}
                   <div>
                      <div className="flex items-center gap-3 mb-8 border-b border-slate-800 pb-4">
                         <Sword className="w-5 h-5 text-rose-500" />
                         <h5 className="text-[11px] font-black uppercase tracking-[0.3em] text-rose-500">Zona Ofensiva (Bloque Ofensivo)</h5>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                         {(analysis.keyPerformers || []).filter(p => p.zone === 'ofensiva').map(p => (
                           <div key={`${p.dorsal}-${p.player}`} className="bg-slate-950/50 p-6 rounded-[2rem] border border-slate-800 relative group hover:border-emerald-500/40 transition-all flex flex-col shadow-lg">
                               <div className="flex items-center justify-between mb-4">
                                 <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-emerald-500 font-black text-lg border border-slate-800 shadow-inner">
                                   #{p.dorsal}
                                 </div>
                                 <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter bg-rose-500/10 text-rose-400 border border-rose-500/20`}>
                                   {p.zone}
                                 </div>
                               </div>
                               <h5 className="text-sm font-black uppercase italic tracking-tighter text-slate-100 mb-3">{p.player}</h5>
                               <p className="text-[11px] text-slate-400 leading-relaxed italic border-l-2 border-slate-800 pl-4 py-1 flex-1">
                                 "{p.individualAnalysis}"
                               </p>
                               {/* Puntos de Mejora */}
                               {p.improvementFeedback && (
                                  <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-left">
                                      <h6 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-2"><Sparkles className="w-3 h-3 text-emerald-400"/> Mejora de Rendimiento</h6>
                                      {(p.improvementFeedback.strengths || []).length > 0 && (
                                        <div>
                                          <p className="text-[10px] font-bold text-emerald-300 flex items-center gap-1"><BadgeCent className="w-3 h-3"/> Fortalezas:</p>
                                          <ul className="list-disc list-inside text-[10px] text-slate-400 pl-3">
                                            {(p.improvementFeedback.strengths || []).map((item, idx) => <li key={idx}>{item}</li>)}
                                          </ul>
                                        </div>
                                      )}
                                      {(p.improvementFeedback.weaknesses || []).length > 0 && (
                                        <div>
                                          <p className="text-[10px] font-bold text-red-300 flex items-center gap-1"><CircleX className="w-3 h-3"/> Debilidades:</p>
                                          <ul className="list-disc list-inside text-[10px] text-slate-400 pl-3">
                                            {(p.improvementFeedback.weaknesses || []).map((item, idx) => <li key={idx}>{item}</li>)}
                                          </ul>
                                        </div>
                                      )}
                                      {(p.improvementFeedback.improvementAdvice || []).length > 0 && (
                                        <div>
                                          <p className="text-[10px] font-bold text-amber-300 flex items-center gap-1"><Lightbulb className="w-3 h-3"/> Consejos:</p>
                                          <ul className="list-disc list-inside text-[10px] text-slate-400 pl-3">
                                            {(p.improvementFeedback.improvementAdvice || []).map((item, idx) => <li key={idx}>{item}</li>)}
                                          </ul>
                                        </div>
                                      )}
                                  </div>
                               )}
                             </div>
                         ))}
                         {(analysis.keyPerformers || []).filter(p => p.zone === 'ofensiva').length === 0 && (
                           <div className="col-span-full py-8 text-center bg-slate-900/40 rounded-3xl border border-slate-800/50 italic text-slate-600 text-[10px] uppercase font-bold tracking-widest">Sin registros destacados en esta zona</div>
                         )}
                      </div>
                   </div>
                </div>
            </div>


            {/* Estadísticas de Juego */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               <div className="lg:col-span-3 bg-slate-900/40 rounded-[3rem] border border-slate-800 p-12 shadow-xl">
                  <h4 className="text-xs font-black uppercase tracking-[0.4em] text-slate-500 mb-12 flex items-center gap-3">
                     <BarChart3 className="w-6 h-6 text-emerald-500" /> Estadísticas Master
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-20 gap-y-12">
                     {Object.keys(statLabels).map(key => 
                       renderStatRow(statLabels[key], key, key === 'possession' || key === 'passAccuracy' ? '%' : '')
                     )}
                  </div>
               </div>

               <div className="bg-slate-900/40 rounded-[2.5rem] border border-slate-800 p-10 shadow-xl flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
                    <Info className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h4 className="text-[11px] font-black uppercase text-emerald-500 mb-4 tracking-widest">Resumen Final</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-bold italic">
                    Auditoría de rendimiento integral segmentada por zonas tácticas para un análisis equilibrado del equipo.
                  </p>
               </div>
            </div>

            {/* Acciones Finales */}
            <div className="flex justify-center gap-6 pt-16">
                <button onClick={() => window.location.reload()} className="bg-slate-900 hover:bg-slate-800 text-slate-400 font-black py-5 px-16 rounded-[2rem] border border-slate-800 uppercase text-xs tracking-[0.3em] transition-all active:scale-95">
                  Nuevo Análisis
                </button>
                <button onClick={exportToPDF} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-5 px-16 rounded-[2rem] uppercase text-xs tracking-[0.3em] transition-all shadow-2xl shadow-emerald-500/30 flex items-center gap-3 active:scale-95">
                  <Download className="w-5 h-5" /> Descargar Dossier PDF
                </button>
            </div>
          </div>
        )}
      </main>

      <footer className="py-16 border-t border-slate-900 bg-[#020617] text-center">
         <div className="text-[10px] font-black text-slate-700 tracking-[0.8em] uppercase flex items-center justify-center gap-4">
            <Cpu className="w-4 h-4" /> ScoutVision PRO | Engine v10.3 | Auditoría por Zonas Tácticas
         </div>
      </footer>
    </div>
  );
};

export default App;