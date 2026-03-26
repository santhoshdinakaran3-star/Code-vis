import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ExecutionStep {
    line: number;
    variables: Record<string, { value: any; type: string }>;
    stdout: string;
    callStack: Array<{ funcName: string; line: number }>;
    event: string;
}

export type Language = 'javascript' | 'python' | 'java';
export type Status = 'idle' | 'loading' | 'playing' | 'paused' | 'done' | 'error';

interface VisualizationState {
    steps: ExecutionStep[];
    currentStep: number;
    status: Status;
    output: string;
    error: string;
    errorLine: number | null;
    playbackSpeed: number; // ms per step
    language: Language;
}

const initialState: VisualizationState = {
    steps: [],
    currentStep: -1,
    status: 'idle',
    output: '',
    error: '',
    errorLine: null,
    playbackSpeed: 800,
    language: 'javascript',
};

export const visualizationSlice = createSlice({
    name: 'visualization',
    initialState,
    reducers: {
        setSteps(state, action: PayloadAction<ExecutionStep[]>) {
            state.steps = action.payload;
            state.currentStep = action.payload.length > 0 ? 0 : -1;
        },
        setCurrentStep(state, action: PayloadAction<number>) {
            const idx = Math.max(0, Math.min(action.payload, state.steps.length - 1));
            state.currentStep = idx;
        },
        nextStep(state) {
            if (state.currentStep < state.steps.length - 1) {
                state.currentStep += 1;
            } else {
                state.status = 'done';
            }
        },
        prevStep(state) {
            if (state.currentStep > 0) {
                state.currentStep -= 1;
            }
        },
        setStatus(state, action: PayloadAction<Status>) {
            state.status = action.payload;
        },
        setOutput(state, action: PayloadAction<string>) {
            state.output = action.payload;
        },
        setError(state, action: PayloadAction<{ error: string; errorLine?: number | null }>) {
            state.error = action.payload.error;
            state.errorLine = action.payload.errorLine ?? null;
            state.status = 'error';
        },
        setSpeed(state, action: PayloadAction<number>) {
            state.playbackSpeed = action.payload;
        },
        setLanguage(state, action: PayloadAction<Language>) {
            state.language = action.payload;
            // Reset on language change
            state.steps = [];
            state.currentStep = -1;
            state.status = 'idle';
            state.output = '';
            state.error = '';
            state.errorLine = null;
        },
        reset(state) {
            state.steps = [];
            state.currentStep = -1;
            state.status = 'idle';
            state.output = '';
            state.error = '';
            state.errorLine = null;
        },
    },
});

export const {
    setSteps, setCurrentStep, nextStep, prevStep,
    setStatus, setOutput, setError, setSpeed, setLanguage, reset,
} = visualizationSlice.actions;

export default visualizationSlice.reducer;
