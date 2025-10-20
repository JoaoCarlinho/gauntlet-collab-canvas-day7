-- PostgreSQL initialization script for CollabCanvas local development
-- This script sets up the database with proper permissions and extensions

-- Create database if it doesn't exist (handled by POSTGRES_DB env var)
-- CREATE DATABASE collabcanvas_local;

-- Connect to the database
\c collabcanvas_local;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create a dedicated user for the application (optional, using default user)
-- CREATE USER collabcanvas_app WITH PASSWORD 'collabcanvas123';
-- GRANT ALL PRIVILEGES ON DATABASE collabcanvas_local TO collabcanvas_app;

-- Set timezone
SET timezone = 'UTC';

-- Create initial tables (these will be created by Flask-Migrate)
-- But we can set up some basic structure here if needed

-- Log the initialization
DO $$
BEGIN
    RAISE NOTICE 'CollabCanvas PostgreSQL database initialized successfully';
END $$;
