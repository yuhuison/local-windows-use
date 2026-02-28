import type { z } from 'zod';

/**
 * Simple zod-to-JSON-Schema converter for OpenAI tool definitions.
 * Handles the subset of zod types we use (object, string, number, enum, boolean, optional, default, describe).
 */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return convertZodType(schema);
}

function convertZodType(schema: z.ZodType): Record<string, unknown> {
  const def = (schema as any)._def;
  const typeName: string = def?.typeName;

  switch (typeName) {
    case 'ZodObject': {
      const shape = (schema as z.ZodObject<any>).shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = convertZodType(value as z.ZodType);
        if (!isOptional(value as z.ZodType)) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
      };
    }

    case 'ZodString': {
      const result: Record<string, unknown> = { type: 'string' };
      if (def.description) result.description = def.description;
      return result;
    }

    case 'ZodNumber': {
      const result: Record<string, unknown> = { type: 'number' };
      if (def.description) result.description = def.description;
      return result;
    }

    case 'ZodBoolean': {
      const result: Record<string, unknown> = { type: 'boolean' };
      if (def.description) result.description = def.description;
      return result;
    }

    case 'ZodEnum': {
      const result: Record<string, unknown> = {
        type: 'string',
        enum: def.values,
      };
      if (def.description) result.description = def.description;
      return result;
    }

    case 'ZodArray': {
      const result: Record<string, unknown> = {
        type: 'array',
        items: convertZodType(def.type),
      };
      if (def.description) result.description = def.description;
      return result;
    }

    case 'ZodOptional':
      return convertZodType(def.innerType);

    case 'ZodDefault':
      return convertZodType(def.innerType);

    case 'ZodEffects':
      return convertZodType(def.schema);

    case 'ZodUnknown':
      return {};

    default:
      return { type: 'string' };
  }
}

function isOptional(schema: z.ZodType): boolean {
  const def = (schema as any)._def;
  const typeName: string = def?.typeName;
  return typeName === 'ZodOptional' || typeName === 'ZodDefault';
}
