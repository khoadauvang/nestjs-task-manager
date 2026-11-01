-- Runs once, when the PostgreSQL volume is first created.
-- The e2e tests use this separate database and wipe it on every run.
CREATE DATABASE taskmanager_test;
