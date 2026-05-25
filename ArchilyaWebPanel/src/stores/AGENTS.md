# Store guidance

## Pattern

- Stores here are React Context providers (`createContext`, provider component, guarded `use{Name}Context` hook), not Zustand/Redux.
- Provider files are `.tsx`; tests usually render small harness components with Testing Library.
