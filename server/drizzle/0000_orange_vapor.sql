CREATE TABLE "log_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"source_ip" varchar(64) NOT NULL,
	"method" varchar(16) NOT NULL,
	"endpoint" varchar(512) NOT NULL,
	"status_code" integer NOT NULL,
	"actor_id" varchar(64),
	"actor_role" varchar(32),
	"request_id" varchar(64) NOT NULL,
	"source_app" varchar(64) DEFAULT 'attendance-portal' NOT NULL,
	"message" text NOT NULL,
	"duration_ms" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedup_id" varchar(128) NOT NULL,
	"is_suspicious" boolean DEFAULT false NOT NULL,
	"is_synthetic" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "detection_rules" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(64) NOT NULL,
	"severity" varchar(32) NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text NOT NULL,
	"severity" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"primary_source_ip" varchar(64) NOT NULL,
	"targeted_asset" varchar(256) NOT NULL,
	"risk_score" integer NOT NULL,
	"risk_breakdown" jsonb NOT NULL,
	"first_seen" timestamp with time zone NOT NULL,
	"last_seen" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_synthetic" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"rule_id" varchar(32) NOT NULL,
	"incident_id" varchar(32),
	"title" varchar(256) NOT NULL,
	"description" text NOT NULL,
	"severity" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"source_ip" varchar(64) NOT NULL,
	"actor_id" varchar(64),
	"evidence_strength" varchar(32) NOT NULL,
	"evidence_summary" text NOT NULL,
	"supporting_event_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"detected_at" timestamp with time zone NOT NULL,
	"is_synthetic" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_app" varchar(64) NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"total_records" integer NOT NULL,
	"accepted_records" integer NOT NULL,
	"rejected_records" integer NOT NULL,
	"status" varchar(32) NOT NULL,
	"error_summary" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_rule_id_detection_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."detection_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_log_events_timestamp" ON "log_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_log_events_source_ip" ON "log_events" USING btree ("source_ip");--> statement-breakpoint
CREATE INDEX "idx_log_events_event_type" ON "log_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_log_events_dedup_id" ON "log_events" USING btree ("dedup_id");