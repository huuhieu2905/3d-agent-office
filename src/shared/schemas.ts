import { z } from 'zod';
import { MODEL_ID_RE } from './model';
import { CITIES, FLOOR_MAX, FLOOR_MIN, ITEM_TYPES, PLACEABLE_TYPES } from './domain';

// Validation for data crossing the local API and for persisted JSON files.

export const mentionSchema = z.object({
  kind: z.enum(['file', 'directory']),
  uri: z.string().startsWith('file://'),
  label: z.string().max(500),
});

export const userInputSchema = z.object({
  parts: z
    .array(z.union([z.object({ text: z.string().max(100_000) }), z.object({ mention: mentionSchema })]))
    .min(1),
  model: z.string().min(1).max(200),
});

export const newConversationSchema = userInputSchema.extend({
  // FR-032: a conversation is always created inside a project.
  projectId: z.string().min(1).max(200),
  deskId: z.string().max(200).optional(),
});

export const permissionDecisionSchema = z.object({ decision: z.enum(['allow', 'deny']) });

export const settingsSchema = z.object({
  schemaVersion: z.literal(1),
  city: z.enum(CITIES),
  theme: z.enum(['light', 'dark']),
  detailLevel: z.enum(['low', 'medium', 'high']),
  autoLowerDetail: z.boolean(),
  camera: z.enum(['overview', 'first_person']),
  defaultModel: z.string().max(200).nullable(),
});

const rotationSchema = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);
const ID = z.string().min(1).max(100);

/** Layout v1 (feature 001), read only for migration. */
export const placedItemV1Schema = z.object({
  id: ID,
  type: z.enum(ITEM_TYPES),
  cell: z.object({ x: z.number().int().min(0), z: z.number().int().min(0) }),
  rotation: rotationSchema,
});

export const officeLayoutV1Schema = z.object({
  schemaVersion: z.literal(1),
  floor: z.object({
    widthCells: z.number().int().min(4).max(200),
    depthCells: z.number().int().min(4).max(200),
    cellSize: z.literal(0.5),
  }),
  items: z.array(placedItemV1Schema).max(2000),
});

/** Layout v2 (002 data-model §3). Step and range rules beyond the shape live in layout-validation.ts. */
export const placedItemSchema = z.object({
  id: ID,
  type: z.enum(PLACEABLE_TYPES as [string, ...string[]]),
  pos: z.object({ x: z.number().min(0).max(FLOOR_MAX), z: z.number().min(0).max(FLOOR_MAX) }),
  rotation: rotationSchema,
});

export const officeLayoutSchema = z.object({
  schemaVersion: z.literal(2),
  floor: z.object({ width: z.number().min(FLOOR_MIN).max(FLOOR_MAX), depth: z.number().min(FLOOR_MIN).max(FLOOR_MAX) }),
  shell: z.object({
    glassSide: z.literal('north'),
    door: z.object({ side: z.enum(['south', 'east', 'west']), offset: z.number().min(0).max(FLOOR_MAX) }),
  }),
  items: z.array(placedItemSchema).max(2000),
});

/** PUT /api/layout body (contracts/local-api.md L2-2): { layout, seating? } or a bare v1/v2 layout. */
export const layoutPutSchema = z.union([
  z.object({
    layout: z.union([officeLayoutSchema, officeLayoutV1Schema]),
    seating: z.record(ID, ID.nullable()).optional(),
  }),
  officeLayoutSchema,
  officeLayoutV1Schema,
]);

export const employeeProfileSchema = z.object({
  appearance: z.string().max(100),
  deskId: z.string().max(100).nullable(),
  lastSeenAt: z.string(),
  preferredModel: z.object({ modelId: z.string().regex(MODEL_ID_RE), chosenAt: z.string() }).nullable().optional(),
});

export const employeeProfilesFileSchema = z.object({
  schemaVersion: z.literal(1),
  profiles: z.record(z.string(), employeeProfileSchema),
});

export const profilePatchSchema = z.object({
  deskId: z.string().max(100).nullable().optional(),
  appearance: z.string().max(100).optional(),
  preferredModel: z.string().regex(MODEL_ID_RE).nullable().optional(),
});

export const usageFileSchema = z.object({
  schemaVersion: z.literal(1),
  days: z.record(z.string(), z.object({ sentViaOffice: z.number().int(), userInputsTotal: z.number().int() })),
});
