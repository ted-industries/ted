import { create, StateCreator } from "zustand";
import { Suggestion } from "../services/agent/types";
import { persist, PersistOptions } from "zustand/middleware";

interface SuggestionState {
    suggestions: Suggestion[];
    dismissedIds: string[]; // Persisted
    addSuggestion: (s: Suggestion) => void;
    dismissSuggestion: (id: string) => void;
    clearSuggestions: () => void;
}

type MyPersist = (
    config: StateCreator<SuggestionState>,
    options: PersistOptions<SuggestionState>
) => StateCreator<SuggestionState>;

export const useSuggestionStore = create<SuggestionState>((persist as MyPersist)(
    (set, get) => ({
        suggestions: [],
        dismissedIds: [],
        addSuggestion: (s) => {
            const { suggestions, dismissedIds } = get();
            if (dismissedIds.includes(s.id)) return; // Already dismissed
            if (suggestions.some((idx) => idx.id === s.id)) return; // Already visible

            set({ suggestions: [...suggestions, s] });
        },
        dismissSuggestion: (id) => {
            set((state) => ({
                suggestions: state.suggestions.filter((s) => s.id !== id),
                dismissedIds: [...state.dismissedIds, id],
            }));
        },
        clearSuggestions: () => set({ suggestions: [] }),
    }),
    {
        name: "suggestion-storage",
        partialize: (state) => ({ dismissedIds: state.dismissedIds } as SuggestionState),
    }
));

export const suggestionStore = useSuggestionStore;
