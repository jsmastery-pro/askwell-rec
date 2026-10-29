import { z } from "zod";
import { ProjectSchema } from "../entities";
import { DeletedResponseSchema, EmptyRequestSchema } from "./common";
import { WidgetConfigSchema } from "../widget";

export const PROJECT_NAME_MAX_LENGTH = 80;
const ProjectNameSchema = z.string().trim().min(1).max(PROJECT_NAME_MAX_LENGTH);

// GET /api/projects
export const ListProjectsRequestSchema = EmptyRequestSchema;
export type ListProjectsRequest = z.infer<typeof ListProjectsRequestSchema>;

export const ListProjectsResponseSchema = z.object({ projects: z.array(ProjectSchema) });
export type ListProjectsResponse = z.infer<typeof ListProjectsResponseSchema>;

// POST /api/projects
export const CreateProjectRequestSchema = z.object({ name: ProjectNameSchema });
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

export const CreateProjectResponseSchema = z.object({ project: ProjectSchema });
export type CreateProjectResponse = z.infer<typeof CreateProjectResponseSchema>;

// PATCH /api/projects/:id (rename only)
export const UpdateProjectRequestSchema = z.object({ name: ProjectNameSchema });
export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>;

export const UpdateProjectResponseSchema = z.object({ project: ProjectSchema });
export type UpdateProjectResponse = z.infer<typeof UpdateProjectResponseSchema>;

// DELETE /api/projects/:id
export const DeleteProjectRequestSchema = EmptyRequestSchema;
export type DeleteProjectRequest = z.infer<typeof DeleteProjectRequestSchema>;

export const DeleteProjectResponseSchema = DeletedResponseSchema;
export type DeleteProjectResponse = z.infer<typeof DeleteProjectResponseSchema>;

// PATCH /api/projects/:id/config (Pro only; Free gets 402 plan_required)
export const UpdateWidgetConfigRequestSchema = WidgetConfigSchema.partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, "Nothing to update");
export type UpdateWidgetConfigRequest = z.infer<typeof UpdateWidgetConfigRequestSchema>;

export const UpdateWidgetConfigResponseSchema = z.object({ config: WidgetConfigSchema });
export type UpdateWidgetConfigResponse = z.infer<typeof UpdateWidgetConfigResponseSchema>;
