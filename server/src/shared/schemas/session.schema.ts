/** Public REST session input: reject malformed and excessive credentials before DB work. */
import { z } from "zod";

export const loginSchema = z.strictObject({
  email: z.email().max(254),
  password: z.string().min(1).max(1024),
});
