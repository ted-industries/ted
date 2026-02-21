import { create } from "zustand";
import { Breakpoint, StackFrame, Scope, Variable } from "../services/dap/types";
import { dapService } from "../services/dap/dap-service";

interface DebugState {
    isActive: boolean;
    isPaused: boolean;
    activeThreadId: number | null;
    breakpoints: Breakpoint[];
    stackFrames: StackFrame[];
    scopes: Scope[];
    variables: Record<number, Variable[]>; // Keyed by variablesReference

    // Actions
    setSessionActive: (active: boolean) => void;
    setPaused: (paused: boolean) => void;
    setBreakpoints: (breakpoints: Breakpoint[]) => void;
    setStackFrames: (frames: StackFrame[]) => void;
    setScopes: (scopes: Scope[]) => void;
    setVariables: (ref: number, vars: Variable[]) => void;
    toggleBreakpoint: (path: string, line: number) => void;
    clearSession: () => void;
}

export const useDebugStore = create<DebugState>((set) => ({
    isActive: false,
    isPaused: false,
    activeThreadId: null,
    breakpoints: [],
    stackFrames: [],
    scopes: [],
    variables: {},

    setSessionActive: (active) => set({ isActive: active }),
    setPaused: (paused) => set({ isPaused: paused }),
    setBreakpoints: (breakpoints) => set({ breakpoints }),
    setStackFrames: (stackFrames) => set({ stackFrames }),
    setScopes: (scopes) => set({ scopes }),
    setVariables: (ref, vars) => set((state) => ({
        variables: { ...state.variables, [ref]: vars }
    })),
    toggleBreakpoint: (path, line) => set((state) => {
        const exists = state.breakpoints.find(b => b.source?.path === path && b.line === line);
        let nextBreakpoints;
        if (exists) {
            nextBreakpoints = state.breakpoints.filter(b => b !== exists);
        } else {
            nextBreakpoints = [...state.breakpoints, {
                verified: false,
                line,
                source: { path }
            }];
        }

        if (state.isActive) {
            const fileLines = nextBreakpoints
                .filter(b => b.source?.path === path)
                .map(b => b.line);
            dapService.setBreakpoints(path, fileLines).then(res => {
                if (res.success && res.body?.breakpoints) {
                    // Update verified status if provided by DAP
                    set(s => ({
                        breakpoints: s.breakpoints.map(bp => {
                            if (bp.source?.path === path) {
                                const found = res.body.breakpoints.find((b: any) => b.line === bp.line);
                                if (found) return { ...bp, verified: found.verified, id: found.id };
                            }
                            return bp;
                        })
                    }));
                }
            });
        }

        return { breakpoints: nextBreakpoints };
    }),
    clearSession: () => set({
        isActive: false,
        isPaused: false,
        activeThreadId: null,
        stackFrames: [],
        scopes: [],
        variables: {}
    }),
}));
