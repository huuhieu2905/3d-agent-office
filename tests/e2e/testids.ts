// data-testid values shared by e2e specs (specs/002-realistic-ui-refresh/contracts/ui-interactions.md U-6).
export const TID = {
  officeFloor: 'office-floor',
  buildToggle: 'build-toggle',
  item: (id: string) => `item-${id}`,
  employee: (conversationId: string) => `employee-${conversationId}`,
  deskDrop: (deskId: string) => `desk-drop-${deskId}`,
  floorWidthInput: 'floor-width-input',
  floorDepthInput: 'floor-depth-input',
  resizeHandleEast: 'resize-handle-east',
  resizeHandleSouth: 'resize-handle-south',
  modelPicker: 'model-picker',
  modelUnavailable: 'model-unavailable',
} as const;
