// data-testid values shared by e2e specs (specs/002-realistic-ui-refresh/contracts/ui-interactions.md U-6).
// Only DOM elements carry test ids; 3D objects are found through window.__agentOffice and name tags.
export const TID = {
  buildToggle: 'build-toggle',
  floorWidthInput: 'floor-width-input',
  floorDepthInput: 'floor-depth-input',
  modelPicker: 'model-picker',
  modelUnavailable: 'model-unavailable',
} as const;
