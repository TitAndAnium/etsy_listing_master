export type ValidationLevel = 'ok' | 'warn' | 'error';

export type FieldStatus = 'ok' | 'warn' | 'error';

export interface FieldState {
  label: string;
  content: string;
  isValid: boolean;
  warnings: number;
  status: ValidationLevel;
}

export interface ValidationResult {
  isValid?: boolean;
  isSoftFail?: boolean;
  warnings?: Array<{
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
