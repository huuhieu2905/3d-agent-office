// data-testid values shared by e2e specs (specs/002-realistic-ui-refresh/contracts/ui-interactions.md U-6).
// Only DOM elements carry test ids; 3D objects are found through window.__agentOffice and name tags.
export const TID = {
  buildToggle: 'build-toggle',
  floorWidthInput: 'floor-width-input',
  floorDepthInput: 'floor-depth-input',
  modelPicker: 'model-picker',
  modelUnavailable: 'model-unavailable',
  // 004 (contracts/ui-interactions.md U4-1…U4-3)
  legendToggle: 'legend-toggle',
  legendList: 'legend-list',
  employeeDelete: 'employee-delete',
  confirmDelete: 'confirm-delete',
  confirmDeleteOk: 'confirm-delete-ok',
  confirmDeleteError: 'confirm-delete-error',
  fpHint: 'fp-hint',
} as const;
