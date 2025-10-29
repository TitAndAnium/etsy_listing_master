export type ValidationLevel = 'ok' | 'warn' | 'error';
export type FieldStatus = 'ok' | 'warn' | 'error';

export interface FieldState {
  label: string;
  content: string;
  warnings: number;
  status: 'ok' | 'warn' | 'error';
  isValid?: boolean;
  message?: string;
}
export interface ValidationResult {
  isValid?: boolean;
  isSoftFail?: boolean;
  issues?: Array<{
    type: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
    validator?: string;
  }>;
  metrics?: {
    totalWarnings: number;
    highSeverityWarnings: number;
    mediumSeverityWarnings: number;
    lowSeverityWarnings: number;
    processingTimeMs: number;
  };
}

export interface ApiResponse {
  title: string;
  tags: string[];
  description: string;
  validation?: ValidationResult;
}
