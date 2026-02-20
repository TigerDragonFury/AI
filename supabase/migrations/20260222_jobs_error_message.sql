-- Add error_message column to jobs table for storing validation/pipeline failure reasons
alter table jobs add column if not exists error_message text;
