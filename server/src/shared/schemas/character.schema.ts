import { z } from "zod";

export const characterNameSchema = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9]+$/);

export const createCharacterSchema = z.object({
  name: characterNameSchema,
  gender: z.enum(["M", "F"]),
  world: z.string().default("main"),
});
