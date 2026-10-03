"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.ENV = {
    PORT: parseInt(process.env.PORT || '5000', 10),
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/labguard',
    JWT_SECRET: process.env.JWT_SECRET || 'labguard_dev_secret_key_change_in_production_8f3a92',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
    OFFLINE_TOKEN_SECRET: process.env.OFFLINE_TOKEN_SECRET || 'labguard_offline_cache_key_99x',
    NODE_ENV: process.env.NODE_ENV || 'development',
    SUPABASE_URL: process.env.SUPABASE_URL || 'https://wqvqqqyrrasjutghizmt.supabase.co',
    SUPABASE_KEY: process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxdnFxcXlycmFzanV0Z2hpem10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNzQxNDksImV4cCI6MjEwNTY1MDE0OX0.pIde98LFuixIpX6-1OxwsCKKw2tnlce24CtpSf-FteE',
    SUPABASE_SYNC_ENABLED: process.env.SUPABASE_SYNC_ENABLED !== 'false'
};
