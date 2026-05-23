// Type declaration for React Native-specific Firebase Auth exports
// These are available at runtime via Metro's "rn" field resolution
// but TypeScript resolves to the web build by default.

declare module '@firebase/auth' {
  export function getReactNativePersistence(storage: any): any;
  export function initializeAuth(app: any, deps?: any): any;
}
