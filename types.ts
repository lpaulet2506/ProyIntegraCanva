
export interface CanvaData {
  name: string;
  amount: string;
  address: string;
  templateId: string;
}

export interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AutofillResult {
  jobId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  resultUrl?: string;
}
