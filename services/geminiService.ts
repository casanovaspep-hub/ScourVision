
import { GoogleGenAI, Type } from "@google/genai";
import { MatchAnalysis, SelectedPlayerInfo, InitialMatchData, Player, PlayerPerformanceMetrics, IndividualPlayerReport, PlayerImprovementFeedback } from "../types";

const sanitizeJsonResponse = (text: string): string => {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    let jsonString = text.substring(firstBrace, lastBrace + 1);

    // Eliminar comentarios de JavaScript /* ... */ y // ...
    jsonString = jsonString.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

    // Específicamente, eliminar cualquier ' as Type' que pueda haber sido añadido por error
    // Se ha mejorado la robustez para capturar más patrones de tipo,
    // incluyendo corchetes para arrays y puntos para referencias de enum.
    jsonString = jsonString.replace(/\s+as\s+[a-zA-Z0-9_\[\]\.]+/g, '');

    // Eliminar comas finales si existen en objetos o arrays (problemático para algunos parsers)
    // Esto es un regex más específico para comas después de un valor antes de un corchete/llave de cierre
    jsonString = jsonString.replace(/,(\s*[\]}])/g, '$1');

    return jsonString;
  }
  console.warn("No se pudo extraer JSON válido del texto:", text);
  return '{}'; // Retorna un objeto JSON vacío o maneja este caso como un error
};

export const getInitialMatchLineups = async (
  actaPart: { mimeType: string, data: string },
): Promise<InitialMatchData> => {
  // Se inicializa GoogleGenAI justo antes de la llamada API
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `ERES UN ANALISTA TÁCTICO Y SCOUT PROFESIONAL.
DEBES PRODUCIR SIEMPRE UN JSON ESTRICTAMENTE VÁLIDO Y SIN ERRORES DE SINTAXIS. NO INCLUYAS COMENTARIOS, CÓDIGO FUERA DEL JSON, NI SINTAXIS DE TIPADO (ej. 'valor as tipo') DENTRO DEL JSON GENERADO.
TU MISIÓN ES EXTRAER LA INFORMACIÓN INICIAL DE UN PARTIDO DE FÚTBOL A PARTIR DE UN ACTA OFICIAL (PDF).

1. IDENTIFICACIÓN DE EQUIPOS:
   - El equipo que aparece a la IZQUIERDA en el acta es el LOCAL (teamA).
   - El equipo que aparece a la DERECHA en el acta es el VISITANTE (teamB).
   - DEBES EXTRAER los nombres REALES de ambos equipos del PDF.

2. EXTRACCIÓN EXHAUSTIVA DE JUGADORES DEL PARTIDO:
   - Para CADA EQUIPO (LOCAL y VISITANTE), DEBES EXTRAER **TODOS los jugadores listados en el acta que forman parte del equipo para el partido**, tanto los de la **alineación inicial (titulares)** como la lista de **suplentes**, incluyendo su nombre y dorsal.
   - Es CRÍTICO que no omitas NINGÚN jugador que aparezca en el listado del partido en el acta.
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

// Nueva función para analizar el rendimiento de un jugador individual
const analyzePlayerPerformance = async (
  playerInfo: SelectedPlayerInfo,
  targetTeam: 'local' | 'visitante',
  videoParts: { mimeType: string, data: string }[],
  tacticalSummary: string,
  teamName: string,
  fullTeamLineupAndSubs: SelectedPlayerInfo[] // Lista completa de jugadores del equipo objetivo para contexto
): Promise<IndividualPlayerReport | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY }); // Nueva instancia para cada llamada
  
  const allPlayersContext = fullTeamLineupAndSubs.map(p => `${p.name} (Dorsal ${p.dorsal})`).join(', ');

  const playerSystemInstruction = `ERES UN ANALISTA TÁCTICO Y SCOUT PROFESIONAL UEFA PRO.
DEBES PRODUCIR SIEMPRE UN JSON ESTRICTAMENTE VÁLIDO Y SIN ERRORES DE SINTAXIS. NO INCLUYAS COMENTARIOS, CÓDIGO FUERA DEL JSON, NI SINTAXIS DE TIPADO (ej. 'valor as tipo') DENTRO DEL JSON GENERADO.
TU MISIÓN ES REALIZAR UN ANÁLISIS INDIVIDUAL PROFUNDO DE UN JUGADOR ESPECÍFICO DE UN PARTIDO DE FÚTBOL.

JUGADOR A ANALIZAR: ${playerInfo.name} (Dorsal: ${playerInfo.dorsal}) del equipo ${teamName}.
CONTEXTO TÁCTICO DEL PARTIDO (Resumen General): "${tacticalSummary}"
LISTA DE JUGADORES DEL EQUIPO OBJETIVO EN EL PARTIDO (para inferir posiciones y roles): ${allPlayersContext}

DEBES GENERAR el análisis individual detallado para este jugador, incluyendo:
1.  'player': Nombre del jugador.
2.  'team': Nombre del equipo del jugador.
3.  'dorsal': Dorsal del jugador.
4.  'individualAnalysis': Un análisis profundo de su rendimiento, impacto y rol en el partido, considerando el contexto táctico general.
5.  'zone': La zona del campo donde el jugador fue más influyente (portero, defensiva, media, ofensiva).
6.  'improvementFeedback': Un objeto con:
    -   'strengths': 2-3 frases cortas destacando sus puntos fuertes.
    -   'weaknesses': 2-3 frases cortas identificando áreas de oportunidad.
    -   'improvementAdvice': 2-3 consejos específicos y accionables.
7.  'performanceMetrics': Un objeto con las métricas de rendimiento relevantes para su 'zone'. Si no hay datos disponibles o la métrica no es aplicable/observable, DEBE devolver 0 para valores numéricos o '0%' / '0 xG' para valores de cadena. Los valores de cadena deben ser SOLO el texto del valor.

TODO EN ESPAÑOL TÉCNICO.`;

  const playerPrompt = `Analiza el rendimiento del jugador ${playerInfo.name} (Dorsal ${playerInfo.dorsal}) del equipo ${teamName}, basándote en los videos. Incluye su análisis individual, feedback de mejora con fortalezas, debilidades y consejos específicos, y sus métricas de rendimiento.`;

  const parts: any[] = [
    ...videoParts.map(vp => ({ inlineData: vp })),
    { text: playerPrompt }
  ];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [{ parts }],
      config: {
        systemInstruction: playerSystemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            player: { type: Type.STRING },
            team: { type: Type.STRING },
            dorsal: { type: Type.NUMBER },
            individualAnalysis: { type: Type.STRING },
            zone: { type: Type.STRING, enum: ['portero', 'defensiva', 'media', 'ofensiva'] },
            improvementFeedback: {
              type: Type.OBJECT,
              properties: {
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                improvementAdvice: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["strengths", "weaknesses", "improvementAdvice"]
            },
            performanceMetrics: {
              type: Type.OBJECT,
              properties: {
                goals: { type: Type.NUMBER }, shots: { type: Type.NUMBER }, shotsOnTarget: { type: Type.NUMBER },
                passesCompleted: { type: Type.NUMBER }, assists: { type: Type.NUMBER }, freeKicks: { type: Type.NUMBER },
                duelsAerialWonPercentage: { type: Type.STRING }, duelsGroundWonPercentage: { type: Type.STRING },
                savesCount: { type: Type.NUMBER }, saveEfficiency: { type: Type.STRING }, passAccuracyLongPercentage: { type: Type.STRING },
                passAccuracyShortPercentage: { type: Type.STRING }, passesUnderPressureGoalkeeper: { type: Type.STRING },
                aerialExitsSuccessful: { type: Type.NUMBER }, sweeperKeeperActions: { type: Type.NUMBER },
                interceptions: { type: Type.NUMBER }, clearances: { type: Type.NUMBER }, blocks: { type: Type.NUMBER },
                passesToFinalThird: { type: Type.NUMBER }, progressiveCarries: { type: Type.NUMBER }, ballRecoveriesDefense: { type: Type.NUMBER },
                passAccuracyDefensePercentage: { type: Type.STRING }, passesUnderPressureDefense: { type: Type.STRING },
                touchesPerGame: { type: Type.NUMBER }, passAccuracyMidfieldPercentage: { type: Type.STRING },
                ballLossesOwnHalf: { type: Type.NUMBER }, passesUnderPressureMidfield: { type: Type.STRING },
                throughBalls: { type: Type.NUMBER }, changesOfPlay: { type: Type.NUMBER },
                expectedGoals: { type: Type.STRING }, expectedAssists: { type: Type.STRING }, dribblesCompletedPercentage: { type: Type.STRING },
                foulsSufferedDangerZone: { type: Type.NUMBER }, goalsPer90: { type: Type.STRING }, shotsOnTargetToGoalRatio: { type: Type.STRING },
                interceptionsFinalThird: { type: Type.NUMBER }, recoveriesAfterLoss: { type: Type.NUMBER }, successfulTacklesOffensive: { type: Type.NUMBER },
                passAccuracyOffensivePercentage: { type: Type.STRING }, passesUnderPressureOffensive: { type: Type.STRING },
              },
            },
          },
          required: ["player", "team", "dorsal", "individualAnalysis", "zone", "improvementFeedback", "performanceMetrics"]
        }
      }
    });

    const parsed = JSON.parse(sanitizeJsonResponse(response.text || '{}'));
    return parsed as IndividualPlayerReport;
  } catch (error) {
    console.error(`Fallo al analizar rendimiento del jugador ${playerInfo.name} (Dorsal ${playerInfo.dorsal}):`, error);
    return null; // Retorna null si el análisis de un jugador falla
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
  selectedPlayers: SelectedPlayerInfo[] = [],
): Promise<MatchAnalysis> => {
  const { targetTeam, side1, side2, videoParts, actaPart } = matchData;

  // --- PRIMER BLOQUE: Análisis Colectivo ---
  const collectiveSystemInstruction = `ERES UN ANALISTA TÁCTICO Y SCOUT PROFESIONAL UEFA PRO.
DEBES PRODUCIR SIEMPRE UN JSON ESTRICTAMENTE VÁLIDO Y SIN ERRORES DE SINTAXIS. NO INCLUYAS COMENTARIOS, CÓDIGO FUERA DEL JSON, NI SINTAXIS DE TIPADO (ej. 'valor as tipo') DENTRO DEL JSON GENERADO.
TU MISIÓN ES REALIZAR UNA AUDITORÍA TÉCNICA Y TÁCTICA COLECTIVA DE NIVEL ELITE.

1. IDENTIFICACIÓN DE EQUIPOS (ACTA PDF):
   - El equipo que aparece a la IZQUIERDA en el acta es el LOCAL (teamA).
   - El equipo que aparece a la DERECHA en el acta es el VISITANTE (teamB).
   - EXTRAE los nombres reales de ambos equipos.

2. EQUIPO OBJETIVO: Analiza con profundidad al equipo: ${targetTeam === 'local' ? 'LOCAL (teamA)' : 'VISITANTE (teamB)'}.

3. INFORME TÉCNICO COLECTIVO EXTENSO:
   - FASE OFENSIVA: Proporciona una descripción DETALLADA y extensa (al menos 3-5 frases) sobre la disposición, progresión, amplitud, profundidad, asociaciones, mecanismos de ruptura y creación de ocasiones. Incluye 3-5 'keyAspects' como FRASES CONCISAS.
   - FASE DEFENSIVA: Proporciona una descripción DETALLADA y extensa (al menos 3-5 frases) sobre la altura del bloque (bajo/medio/alto), la distancia entre líneas, el comportamiento en la presión tras pérdida (Gegenpressing) y la gestión de duelos individuales/colectivos. Incluye 3-5 'keyAspects' como FRASES CONCISAS.
   - TRANSICIONES: Proporciona una descripción DETALLADA y extensa (al menos 3-5 frases) sobre la velocidad de reacción y toma de decisiones tras pérdida (transición defensiva) y tras recuperación (transición ofensiva), incluyendo la verticalidad, la organización y la vulnerabilidad. Incluye 3-5 'keyAspects' como FRASES CONCISAS.
   - BALÓN PARADO (SET PIECES): Proporciona una descripción DETALLADA y extensa (al menos 3-5 frases) sobre la estrategia en corners (ofensivos y defensivos), faltas laterales y frontales (ofensivas y defensivas), y lanzamientos de penalti. Analiza la organización, movimientos, bloqueos y efectividad. Incluye 3-5 'keyAspects' como FRASES CONCISAS.

4. ESTADÍSTICAS DEL PARTIDO: Genera las estadísticas master: Goles, Asistencias, Posesión, Disparos, Disparos a puerta, Paradas, Precisión de pases, Faltas, Córners.

5. ORIENTACIÓN ESPACIAL PARA ANÁLISIS DE VIDEO:
   - VIDEO 1 (1T): El equipo objetivo defiende portería ${side1.toUpperCase()}.
   - VIDEO 2 (2T): El equipo objetivo defiende portería ${side2.toUpperCase()}.

6. CONCLUSIONES TÁCTICAS CLAVE: Proporciona un resumen global y DETALLADO (al menos 3-5 frases) de los puntos más críticos y las tendencias tácticas generales del partido, destacando los aciertos y errores más significativos del equipo objetivo.

REPORTE EN ESPAÑOL TÉCNICO (Jerga: "salida lavolpiana", "basculación", "intervalos", "superioridad numérica/posicional", "tercer hombre", "bloque compacto", "línea de pase", etc.).`;

  const collectivePrompt = `Realiza el análisis táctico colectivo y las estadísticas del partido para el equipo ${targetTeam}.`;

  const collectiveParts: any[] = [
    ...videoParts.map(vp => ({ inlineData: vp })),
    { inlineData: actaPart },
    { text: collectivePrompt }
  ];

  let collectiveAnalysisResult: Omit<MatchAnalysis, 'id' | 'timestamp' | 'keyPerformers' | 'targetTeamSide'>;

  try {
    const aiCollective = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await aiCollective.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [{ parts: collectiveParts }],
      config: {
        systemInstruction: collectiveSystemInstruction,
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
                lineup: { 
                  type: Type.ARRAY, 
                  items: { 
                    type: Type.OBJECT, 
                    properties: { name: { type: Type.STRING }, dorsal: { type: Type.NUMBER } }, 
                    required: ["name", "dorsal"] 
                  } 
                },
                subs: { 
                  type: Type.ARRAY, 
                  items: { 
                    type: Type.OBJECT, 
                    properties: { name: { type: Type.STRING }, dorsal: { type: Type.NUMBER } }, 
                    required: ["name", "dorsal"] 
                  } 
                }
              },
              required: ["name", "lineup", "subs"]
            },
            teamB: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                initialFormation: { type: Type.STRING },
                // CORREGIDO: `required` se mueve dentro de `items` para el array `lineup` de teamB
                lineup: { 
                  type: Type.ARRAY, 
                  items: { 
                    type: Type.OBJECT, 
                    properties: { name: { type: Type.STRING }, dorsal: { type: Type.NUMBER } }, 
                    required: ["name", "dorsal"] 
                  } 
                },
                subs: { 
                  type: Type.ARRAY, 
                  items: { 
                    type: Type.OBJECT, 
                    properties: { name: { type: Type.STRING }, dorsal: { type: Type.NUMBER } }, 
                    required: ["name", "dorsal"] 
                  } 
                }
              },
              required: ["name", "lineup", "subs"]
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
          },
          required: ["score", "stats", "teamA", "teamB", "tacticalSummary", "events", "technicalReport"]
        }
      }
    });

    collectiveAnalysisResult = JSON.parse(sanitizeJsonResponse(response.text || '{}'));
    
  } catch (error) {
    console.error("Fallo el análisis colectivo del servicio:", error);
    throw error;
  }

  // --- SEGUNDO BLOQUE: Análisis Individual por Jugador ---
  const keyPerformers: IndividualPlayerReport[] = [];
  const teamName = targetTeam === 'local' ? collectiveAnalysisResult.teamA.name : collectiveAnalysisResult.teamB.name;
  
  // Accede a .lineup y .subs, y usa un array vacío como fallback si 'subs' no existe o es null/undefined
  const fullTeamLineupAndSubs = targetTeam === 'local' 
    ? [...collectiveAnalysisResult.teamA.lineup, ...(collectiveAnalysisResult.teamA.subs || [])] 
    : [...collectiveAnalysisResult.teamB.lineup, ...(collectiveAnalysisResult.teamB.subs || [])];

  // Si no hay jugadores seleccionados, la IA deberá identificar algunos clave para el análisis
  const playersToAnalyze = selectedPlayers.length > 0 ? selectedPlayers : 
    // Si la IA no identificó 'keyPerformers' en la primera llamada (porque no se pidió),
    // o si el modelo falló en generarlos, usamos una heurística simple o un placeholder
    // para asegurar que al menos algunos jugadores pasen por el análisis individual.
    // Para este caso, vamos a tomar los primeros 3 jugadores de la alineación como "clave" si no se seleccionó ninguno.
    fullTeamLineupAndSubs.slice(0, 3); 

  for (const player of playersToAnalyze) {
    const individualReport = await analyzePlayerPerformance(
      player,
      targetTeam,
      videoParts,
      collectiveAnalysisResult.tacticalSummary,
      teamName,
      fullTeamLineupAndSubs
    );
    if (individualReport) {
      keyPerformers.push(individualReport);
    }
  }

  // --- TERCER BLOQUE: Combinar resultados ---
  const finalAnalysis: MatchAnalysis = {
    ...collectiveAnalysisResult,
    id: crypto.randomUUID(), // Se genera el ID y timestamp aquí, justo antes de combinar
    timestamp: Date.now(),
    keyPerformers: keyPerformers,
    targetTeamSide: targetTeam,
  };

  return finalAnalysis;
};
