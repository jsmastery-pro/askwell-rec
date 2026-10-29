import { z } from "zod";

/**
 * `<Route>Request` is the query (GET) or JSON body; path params are always `IdParams`.
 */

/** Path params of every `/:id` route. */
export const IdParamsSchema = z.object({ id: z.uuid() });
export type IdParams = z.infer<typeof IdParamsSchema>;

/** For routes with no query or body. */
export const EmptyRequestSchema = z.object({});
export type EmptyRequest = z.infer<typeof EmptyRequestSchema>;

/** Response of every DELETE route. */
export const DeletedResponseSchema = z.object({ id: z.uuid() });
export type DeletedResponse = z.infer<typeof DeletedResponseSchema>;
