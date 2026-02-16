

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

export interface MatchAnalysis {
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
  keyPerformers: {
    player: string;
    team: string;
    impact?: string;
    dorsal: number;
    individualAnalysis?: string;
    zone: 'ofensiva' | 'media' | 'defensiva';
    improvementFeedback?: { // Nuevo: feedback de mejora para el jugador
      strengths: string[];
      weaknesses: string[];
      improvementAdvice: string[];
    };
  }[];
  targetTeamSide: 'local' | 'visitante';
}

export type AppStage = 'upload' | 'selection' | 'playerSelection' | 'analyzing' | 'report';