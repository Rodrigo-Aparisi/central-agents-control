CREATE TYPE "public"."artifact_operation" AS ENUM('created', 'modified', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('assistant_message', 'tool_use', 'tool_result', 'thinking', 'usage', 'system', 'error', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'running', 'completed', 'cancelled', 'failed', 'timeout');--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"root_path" text NOT NULL,
	"description" text,
	"claude_config" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"prompt" text NOT NULL,
	"params" jsonb,
	"usage" jsonb,
	"exit_code" integer,
	"duration_ms" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "run_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"type" "event_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_artifacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"file_path" text NOT NULL,
	"operation" "artifact_operation" NOT NULL,
	"diff" text,
	"content_after" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_artifacts" ADD CONSTRAINT "run_artifacts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_created_at_idx" ON "projects" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "runs_project_id_idx" ON "runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "runs_status_idx" ON "runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "runs_created_at_idx" ON "runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "runs_project_created_idx" ON "runs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "run_events_run_id_idx" ON "run_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "run_events_run_seq_idx" ON "run_events" USING btree ("run_id","seq");--> statement-breakpoint
CREATE INDEX "run_artifacts_run_id_idx" ON "run_artifacts" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "run_artifacts_run_path_idx" ON "run_artifacts" USING btree ("run_id","file_path");