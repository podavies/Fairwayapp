// Reexport the native module. On web, it will be resolved to ScorecardOcrModule.web.ts
// and on native platforms to ScorecardOcrModule.ts
export { default } from './src/ScorecardOcrModule';
export { default as ScorecardOcrView } from './src/ScorecardOcrView';
export * from  './src/ScorecardOcr.types';
