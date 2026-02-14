
import { GoogleGenAI, Type } from "@google/genai";
import { MatchAnalysis, SelectedPlayerInfo, InitialMatchData, Player } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const sanitizeJsonResponse = (text: string): string => {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : text;
};

export const getInitialMatchLineups = async (
  actaPart: { mimeType: string, data: string },
): Promise<InitialMatchData> => {
  const systemInstruction = `ERES UN ANALISTA TÁCTICO Y SCOUT PROFESIONAL.
TU MISIÓN ES EXTRAER LA INFORMACIÓN INICIAL DE UN PARTIDO DE FÚTBOL A PARTIR DE UN ACTA OFICIAL (PDF).

1. IDENTIFICACIÓN DE EQUIPOS:
   - El equipo que aparece a la IZQUIERDA en el acta es el LOCAL (teamA).
   - El equipo que aparece a la DERECHA en el acta es el VISITANTE (teamB).
   - DEBES EXTRAER los nombres REALES de ambos equipos del PDF.

2. EXTRACCIÓN DE ALINEACIONES Y SUPLENTES:
   - Para CADA EQUIPO (LOCAL y VISITANTE), DEBES EXTRAER la lista completa de jugadores de la **alineación inicial (titulares)** y la lista de **suplentes**, incluyendo su nombre y dorsal.
   - Si una formación inicial está visible (ej. '4-3-3'), extráela. Si no, déjala vacía.

TODO EN ESPAÑOL.`;

  const parts: any[] = [
    { inlineData: actaPart },
    { text: `Extrae los nombres de los equipos, su formación inicial, la alineación completa (nombre y dorsal) de los titulares y la lista de suplentes de ambos equipos del acta del partido. Genera el JSON según el esquema proporcionado.` }
  ];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [{ parts }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            teamA: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                initialFormation: { type: Type.STRING },
                lineup: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, dorsal: { type: Type.NUMBER } }, required: ["name", "dorsal"] } },
                subs: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, dorsal: { type: Type.NUMBER } }, required: ["name", "dorsal"] } } // Added subs
              },
              required: ["name", "lineup", "subs"]
            },
            teamB: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                initialFormation: { type: Type.STRING },
                lineup: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, dorsal: { type: Type.NUMBER } }, required: ["name", "dorsal"] } },
                subs: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, dorsal: { type: Type.NUMBER } }, required: ["name", "dorsal"] } } // Added subs
              },
              required: ["name", "lineup", "subs"]
            },
          },
          required: ["teamA", "teamB"]
        }
      }
    });

    const parsed = JSON.parse(sanitizeJsonResponse(response.text || '{}'));
    return parsed as InitialMatchData;
  } catch (error) {
    console.error("Fallo al obtener datos iniciales del acta:", error);
    throw error;
  }
};


export const analyzeFullMatch = async (
  matchData: {
    targetTeam: 'local' | 'visitante',
    side1: 'izquierda' | 'derecha',
    side2: 'izquierda' | 'derecha',
    videoParts: { mimeType: string, data: string }[],
    actaPart: { mimeType: string, data: string }
  },
  selectedPlayers: SelectedPlayerInfo[] = []
): Promise<MatchAnalysis> => {
  const { targetTeam, side1, side2, videoParts, actaPart } = matchData;
  
  let playerAnalysisInstruction = `
    3. ANÁLISIS INDIVIDUAL POR ZONAS (CRÍTICO):
       - DEBES identificar y realizar un análisis individual de los **JUGADORES MÁS INFLUYENTES Y CLAVE** del equipo objetivo.
       - Intenta proporcionar un análisis para **al menos 3-5 jugadores en total**, distribuyéndolos de forma representativa entre las TRES ÁREAS TÁCTICAS (defensiva, media, ofensiva).
       - Para CADA UNO de estos jugadores influyentes, DEBES asignarle su "zone" (defensiva, media, ofensiva) y generar un "individualAnalysis" detallado sobre su rendimiento en el partido. La "zone" debe ser inferida de su posición habitual y rol.
       - Si no puedes identificar jugadores clave en una zona específica con información útil, prioriza la calidad y veracidad del análisis.
  `;

  if (selectedPlayers && selectedPlayers.length > 0) {
    const playersList = selectedPlayers.map(p => `"${p.name} (Dorsal ${p.dorsal})"`).join(', ');
    playerAnalysisInstruction += `
       - **ADICIONALMENTE**, DEBES incluir un análisis individual para los siguientes jugadores, que han sido seleccionados específicamente: ${playersList}.
       - Si alguno de estos jugadores seleccionados por el usuario coincide (mismo nombre y dorsal) con un jugador que ya has identificado como influyente, **DEBES COMBINAR Y EXPANDIR el análisis en una única entrada para ese jugador en la lista 'keyPerformers'**. Asegúrate de que el análisis sea lo más completo posible y aparezca solo una vez.
       - Si un jugador seleccionado por el usuario no ha sido identificado previamente por ti como clave, simplemente añádelo con su "zone" inferida y un "individualAnalysis" detallado.
  `;
  }

  const systemInstruction = `ERES UN ANALISTA TÁCTICO Y SCOUT PROFESIONAL UEFA PRO.
TU MISIÓN ES REALIZAR UNA AUDITORÍA TÉCNICA Y TÁCTICA DE NIVEL ELITE.

1. IDENTIFICACIÓN DE EQUIPOS (ACTA PDF):
   - El equipo que aparece a la IZQUIERDA en el acta es el LOCAL (teamA).
   - El equipo que aparece a la DERECHA en el acta es el VISITANTE (teamB).
   - EXTRAE los nombres reales de ambos equipos.

2. EQUIPO OBJETIVO: Analiza con profundidad al equipo: ${targetTeam === 'local' ? 'LOCAL (teamA)' : 'VISITANTE (teamB)'}.

${playerAnalysisInstruction}

4. INFORME TÉCNICO COLECTIVO EXTENSO:
   - FASE OFENSIVA: Proporciona una descripción DETALLADA y extensa (al menos 3-5 frases) sobre la disposición, progresión, amplitud, profundidad, asociaciones, mecanismos de ruptura y creación de ocasiones. Incluye 3-5 'keyAspects' como FRASES CONCISAS.
   - FASE DEFENSIVA: Proporciona una descripción DETALLADA y extensa (al menos 3-5 frases) sobre la altura del bloque (bajo/medio/alto), la distancia entre líneas, la basculación defensiva, el comportamiento en la presión tras pérdida (Gegenpressing) y la gestión de duelos individuales/colectivos. Incluye 3-5 'keyAspects' como FRASES CONCISAS.
   - TRANSICIONES: Proporciona una descripción DETALLADA y extensa (al menos 3-5 frases) sobre la velocidad de reacción y toma de decisiones tras pérdida (transición defensiva) y tras recuperación (transición ofensiva), incluyendo la verticalidad, la organización y la vulnerabilidad. Incluye 3-5 'keyAspects' como FRASES CONCISAS.
   - BALÓN PARADO (SET PIECES): Proporciona una descripción DETALLADA y extensa (al menos 3-5 frases) sobre la estrategia en corners (ofensivos y defensivos), faltas laterales y frontales (ofensivas y defensivas), y lanzamientos de penalti. Analiza la organización, movimientos, bloqueos y efectividad. Incluye 3-5 'keyAspects' como FRASES CONCISAS.

5. ESTADÍSTICAS DEL PARTIDO: Genera las estadísticas master: Goles, Asistencias, Posesión, Disparos, Disparos a puerta, Paradas, Precisión de pases, Faltas, Córners.

6. ORIENTACIÓN ESPACIAL PARA ANÁLISIS DE VIDEO:
   - VIDEO 1 (1T): El equipo objetivo defiende portería ${side1.toUpperCase()}.
   - VIDEO 2 (2T): El equipo objetivo defiende portería ${side2.toUpperCase()}.

7. CONCLUSIONES TÁCTICAS CLAVE: Proporciona un resumen global y DETALLADO (al menos 3-5 frases) de los puntos más críticos y las tendencias tácticas generales del partido, destacando los aciertos y errores más significativos del equipo objetivo.

REPORTE EN ESPAÑOL TÉCNICO (Jerga: "salida lavolpiana", "basculación", "intervalos", "superioridad numérica/posicional", "tercer hombre", "bloque compacto", "línea de pase", etc.).`;

  const parts: any[] = [
    ...videoParts.map(vp => ({ inlineData: vp })),
    { inlineData: actaPart },
    { text: `Realiza el análisis táctico extenso y detallado del equipo ${targetTeam}. ${selectedPlayers && selectedPlayers.length > 0 ? `Además de identificar tus propios jugadores clave, incluye análisis para los jugadores seleccionados: ${selectedPlayers.map(p => `${p.name} (Dorsal ${p.dorsal})`).join(', ')}. Deduplica y combina los análisis si un jugador es tanto clave como seleccionado, asegurando una única entrada completa en 'keyPerformers'.` : 'Identifica a los jugadores clave para el análisis individual.'} Asegúrate de categorizar a los jugadores analizados en zonas defensiva, media y ofensiva, y de incluir todos los aspectos del 'technicalReport' solicitado para el cuerpo técnico y las estadísticas del partido, así como un 'tacticalSummary' detallado.` }
  ];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [{ parts }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { 
              type: Type.OBJECT, 
              properties: { teamA: { type: Type.NUMBER }, teamB: { type: Type.NUMBER } },
              required: ["teamA", "teamB"]
            },
            teamA: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                initialFormation: { type: Type.STRING },
                lineup: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, dorsal: { type: Type.NUMBER } } } }
              },
              required: ["name"]
            },
            teamB: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                initialFormation: { type: Type.STRING },
                lineup: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, dorsal: { type: Type.NUMBER } } } }
              },
              required: ["name"]
            },
            stats: { 
              type: Type.OBJECT, 
              properties: { 
                goals: { type: Type.OBJECT, properties: { teamA: { type: Type.NUMBER }, teamB: { type: Type.NUMBER } }, required: ["teamA", "teamB"] },
                assists: { type: Type.OBJECT, properties: { teamA: { type: Type.NUMBER }, teamB: { type: Type.NUMBER } }, required: ["teamA", "teamB"] },
                possession: { type: Type.OBJECT, properties: { teamA: { type: Type.NUMBER }, teamB: { type: Type.NUMBER } }, required: ["teamA", "teamB"] },
                shots: { type: Type.OBJECT, properties: { teamA: { type: Type.NUMBER }, teamB: { type: Type.NUMBER } }, required: ["teamA", "teamB"] },
                shotsOnTarget: { type: Type.OBJECT, properties: { teamA: { type: Type.NUMBER }, teamB: { type: Type.NUMBER } }, required: ["teamA", "teamB"] },
                saves: { type: Type.OBJECT, properties: { teamA: { type: Type.NUMBER }, teamB: { type: Type.NUMBER } }, required: ["teamA", "teamB"] },
                passAccuracy: { type: Type.OBJECT, properties: { teamA: { type: Type.NUMBER }, teamB: { type: Type.NUMBER } }, required: ["teamA", "teamB"] },
                fouls: { type: Type.OBJECT, properties: { teamA: { type: Type.NUMBER }, teamB: { type: Type.NUMBER } }, required: ["teamA", "teamB"] },
                corners: { type: Type.OBJECT, properties: { teamA: { type: Type.NUMBER }, teamB: { type: Type.NUMBER } }, required: ["teamA", "teamB"] }
              },
              required: ["goals", "assists", "possession", "shots", "shotsOnTarget", "saves", "passAccuracy", "fouls", "corners"]
            },
            events: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT, 
                properties: { 
                  minute: { type: Type.NUMBER }, 
                  player: { type: Type.STRING }, 
                  team: { type: Type.STRING }, 
                  dorsal: { type: Type.NUMBER }, 
                  description: { type: Type.STRING } ,
                  assistant: { type: Type.STRING },
                  assistantDorsal: { type: Type.NUMBER },
                  isOwnGoal: { type: Type.BOOLEAN }
                },
                required: ["minute", "player", "team", "dorsal", "description"]
              } 
            },
            technicalReport: {
              type: Type.OBJECT,
              properties: {
                offensivePhase: { type: Type.OBJECT, properties: { description: { type: Type.STRING }, keyAspects: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["description", "keyAspects"] },
                defensivePhase: { type: Type.OBJECT, properties: { description: { type: Type.STRING }, keyAspects: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["description", "keyAspects"] },
                transitions: { type: Type.OBJECT, properties: { description: { type: Type.STRING }, keyAspects: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["description", "keyAspects"] },
                setPieces: { type: Type.OBJECT, properties: { description: { type: Type.STRING }, keyAspects: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["description", "keyAspects"] }
              },
              required: ["offensivePhase", "defensivePhase", "transitions", "setPieces"]
            },
            tacticalSummary: { type: Type.STRING },
            keyPerformers: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT, 
                properties: { 
                  player: { type: Type.STRING }, 
                  team: { type: Type.STRING }, 
                  dorsal: { type: Type.NUMBER }, 
                  individualAnalysis: { type: Type.STRING },
                  zone: { type: Type.STRING, enum: ['defensiva', 'media', 'ofensiva'] }
                },
                required: ["player", "dorsal", "zone", "individualAnalysis"]
              } 
            }
          },
          required: ["score", "stats", "teamA", "teamB", "tacticalSummary", "events", "keyPerformers", "technicalReport"]
        }
      }
    });

    const parsed = JSON.parse(sanitizeJsonResponse(response.text || '{}'));
    return { ...parsed, targetTeamSide: targetTeam } as MatchAnalysis;
  } catch (error) {
    console.error("Análisis fallido en el servicio:", error);
    throw error;
  }
};
