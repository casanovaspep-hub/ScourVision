
export interface Player {
  name: string;
  dorsal: number;
  performanceAnalysis?: {
    strengths: string[];
    weaknesses: string[];
    tacticalAdvice: string;
  };
}

export interface TacticalShift {
  minute: number;
  team: string;
  previousFormation: string;
  newFormation: string;
  reason: string;
}

export interface TechnicalPhase {
  description: string;
  keyAspects: string[];
}

export interface TechnicalReport {
  offensivePhase: TechnicalPhase;
  defensivePhase: TechnicalPhase;
  transitions: TechnicalPhase;
  setPieces: TechnicalPhase;
}

export interface GoalEvent {
  minute: number;
  player: string;
  assistant: string | null;
  team: string;
  description: string;
  dorsal: number;
  assistantDorsal?: number | null;
  isOwnGoal?: boolean;
}

export interface CardEvent {
  minute: number;
  player: string;
  team: string;
  type: 'amarilla' | 'roja';
  dorsal: number;
  reason?: string;
}

export interface MatchStats {
  goals: { teamA: number; teamB: number };
  assists: { teamA: number; teamB: number };
  possession: { teamA: number; teamB: number };
  shots: { teamA: number; teamB: number };
  shotsOnTarget: { teamA: number; teamB: number };
  saves: { teamA: number; teamB: number };
  offsides: { teamA: number; teamB: number };
  passAccuracy: { teamA: number; teamB: number };
  keyPasses: { teamA: number; teamB: number };
  duelsWon: { teamA: number; teamB: number };
  fouls: { teamA: number; teamB: number };
  corners: { teamA: number; teamB: number };
  freeKicks: { teamA: number; teamB: number };
  penalties: { teamA: number; teamB: number };
}

export interface SelectedPlayerInfo {
  name: string;
  dorsal: number;
}

export interface InitialMatchData {
  teamA: {
    name: string;
    initialFormation?: string;
    lineup: SelectedPlayerInfo[];
    subs: SelectedPlayerInfo[];
  };
  teamB: {
    name: string;
    initialFormation?: string;
    lineup: SelectedPlayerInfo[];
    subs: SelectedPlayerInfo[];
  };
}

// Nueva interfaz para métricas de rendimiento de jugadores
export interface PlayerPerformanceMetrics {
  // Métricas comunes (aplicables a varias posiciones, pero se solicitarán por zona para mayor precisión)
  goals?: number;
  shots?: number;
  shotsOnTarget?: number;
  passesCompleted?: number; // pases realizados
  assists?: number;
  freeKicks?: number; // tiros libres

  // Métricas de Duelos (comunes a defensiva, construcción, ofensiva)
  duelsAerialWonPercentage?: string; // Ej: "65%"
  duelsGroundWonPercentage?: string; // Ej: "70%"

  // Métricas específicas de Portero
  savesCount?: number;
  saveEfficiency?: string; // Ej: "75% (PSxG - GA: +0.5)"
  passAccuracyLongPercentage?: string; // Ej: "70%"
  passAccuracyShortPercentage?: string; // Ej: "90%"
  passesUnderPressureGoalkeeper?: string; // Ej: "8/10 completados"
  aerialExitsSuccessful?: number;
  sweeperKeeperActions?: number; // Intervenciones fuera del área

  // Métricas específicas de Defensa
  interceptions?: number;
  clearances?: number;
  blocks?: number;
  passesToFinalThird?: number;
  progressiveCarries?: number;
  ballRecoveriesDefense?: number; // Recuperaciones de balón en bloque defensivo
  passAccuracyDefensePercentage?: string; // % de acierto en pases en zona defensiva
  passesUnderPressureDefense?: string; // Pases completados bajo presión en zona defensiva

  // Métricas específicas de Mediocampista (Construcción)
  touchesPerGame?: number;
  passAccuracyMidfieldPercentage?: string; // Precisión de pase general en zona de construcción
  ballLossesOwnHalf?: number;
  passesUnderPressureMidfield?: string; // Pases completados bajo acoso en zona de construcción
  throughBalls?: number;
  changesOfPlay?: number;

  // Métricas específicas de Delantero (Ofensiva)
  expectedGoals?: string; // Ej: "0.75 xG"
  expectedAssists?: string; // Ej: "0.3 xA"
  dribblesCompletedPercentage?: string; // Ej: "60%"
  foulsSufferedDangerZone?: number;
  goalsPer90?: string; // Ej: "0.5 G/90"
  shotsOnTargetToGoalRatio?: string; // Ej: "30% (3/10)"
  interceptionsFinalThird?: number;
  recoveriesAfterLoss?: number; // Recuperaciones tras pérdida (general para ofensiva)
  successfulTacklesOffensive?: number; // Tackleadas exitosas en ofensiva
  passAccuracyOffensivePercentage?: string; // % de acierto en pases en zona ofensiva
  passesUnderPressureOffensive?: string; // Pases completados bajo presión en zona ofensiva
}

export interface PlayerImprovementFeedback {
  strengths: string[];
  weaknesses: string[];
  improvementAdvice: string[];
}

// Nueva interfaz para el informe de un jugador individual (respuesta de la IA)
export interface IndividualPlayerReport {
  player: string;
  team: string; // The team of this player
  dorsal: number;
  individualAnalysis: string;
  zone: 'portero' | 'defensiva' | 'media' | 'ofensiva';
  improvementFeedback: PlayerImprovementFeedback;
  performanceMetrics: PlayerPerformanceMetrics;
}

export interface MatchAnalysis {
  id: string; // Añadido para guardar análisis
  timestamp: number; // Añadido para guardar análisis
  teamA: {
    name: string;
    color?: string;
    isHome?: boolean;
    initialFormation: string;
    lineup: Player[];
    subs?: Player[];
  };
  teamB: {
    name: string;
    color?: string;
    isHome?: boolean;
    initialFormation: string;
    lineup: Player[];
    subs?: Player[];
  };
  score: {
    teamA: number;
    teamB: number;
  };
  stats: MatchStats;
  events: GoalEvent[];
  cards: CardEvent[];
  tacticalShifts?: TacticalShift[];
  technicalReport: TechnicalReport;
  tacticalSummary: string;
  keyPerformers: IndividualPlayerReport[]; // Ahora usa la interfaz de reporte individual
  targetTeamSide: 'local' | 'visitante';
}

export type AppStage = 'upload' | 'selection' | 'playerSelection' | 'analyzing' | 'report' | 'savedAnalysesList';
