import { z } from 'zod';
import { InlineTagTextSchema, TagsSchema } from './tags.js';

export const ActorSchema = z.enum(['odile', 'rocco', 'pim']);
export const LanguageSchema = z.enum(['en', 'es', 'hi', 'zh']);
const IdSchema = z.string().regex(/^[a-z][a-z0-9_-]*$/, 'Expected a stable lowercase identifier');

const LineSchema = z
  .object({
    id: IdSchema,
    actor: ActorSchema,
    lang: LanguageSchema,
    tags: TagsSchema,
    text: InlineTagTextSchema.min(1).max(300),
  })
  .strict();

const VariantTextSchema = InlineTagTextSchema.min(1).max(300);
const CueSchema = z
  .object({
    at: IdSchema,
    tool: z.literal('change_set'),
    args: z
      .object({
        effect: z.string().min(1),
        intensity: z.number().min(0).max(1).optional(),
      })
      .strict(),
  })
  .strict();

export const SceneSchema = z
  .object({
    id: IdSchema,
    title: z.string().min(1),
    notes: z.string().optional(),
    actors: z.array(ActorSchema).min(1),
    lines: z.array(LineSchema).min(1),
    variants: z.partialRecord(LanguageSchema, z.record(IdSchema, VariantTextSchema)).default({}),
    cues: z.array(CueSchema).default([]),
  })
  .strict()
  .superRefine((scene, ctx) => {
    const ids = new Set<string>();
    const declaredActors = new Set<string>();
    scene.actors.forEach((actor, index) => {
      if (declaredActors.has(actor)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate declared actor: ${actor}`,
          path: ['actors', index],
        });
      }
      declaredActors.add(actor);
    });
    scene.lines.forEach((line, index) => {
      if (ids.has(line.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate line id: ${line.id}`,
          path: ['lines', index, 'id'],
        });
      }
      ids.add(line.id);
      if (!scene.actors.includes(line.actor)) {
        ctx.addIssue({
          code: 'custom',
          message: `Actor ${line.actor} is not declared in scene.actors`,
          path: ['lines', index, 'actor'],
        });
      }
    });
    for (const [language, entries] of Object.entries(scene.variants)) {
      for (const lineId of Object.keys(entries)) {
        if (!ids.has(lineId)) {
          ctx.addIssue({
            code: 'custom',
            message: `Variant ${language} references unknown line id: ${lineId}`,
            path: ['variants', language, lineId],
          });
        }
      }
    }
    scene.cues.forEach((cue, index) => {
      if (!ids.has(cue.at)) {
        ctx.addIssue({
          code: 'custom',
          message: `Cue references unknown line id: ${cue.at}`,
          path: ['cues', index, 'at'],
        });
      }
    });
  });

export type Actor = z.infer<typeof ActorSchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type SceneLine = Scene['lines'][number];
