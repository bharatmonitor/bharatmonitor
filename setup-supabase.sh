#!/bin/bash
# ============================================================
# BharatMonitor — Supabase Setup
# Add your keys below before running
# ============================================================

PROJECT_REF="bmxrsfyaujcppaqvtnfx"

echo "Linking to Supabase project..."
supabase link --project-ref $PROJECT_REF

echo "Setting secrets — edit this file first with your keys..."
# supabase secrets set GEMINI_API_KEY=your_key_here
# supabase secrets set GROQ_API_KEY=your_key_here
# supabase secrets set YOUTUBE_API_KEY=your_key_here
# supabase secrets set HUGGINGFACE_API_KEY=your_key_here
# supabase secrets set SERPAPI_KEY=your_key_here
# supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key_here

echo "Running database migrations..."
supabase db push

echo "Deploying edge functions..."
supabase functions deploy rss-proxy --no-verify-jwt
supabase functions deploy social-monitor --no-verify-jwt
supabase functions deploy ai-classifier --no-verify-jwt
supabase functions deploy ai-brief --no-verify-jwt
supabase functions deploy contradiction-engine --no-verify-jwt
supabase functions deploy quick-scan --no-verify-jwt
supabase functions deploy youtube-monitor --no-verify-jwt
supabase functions deploy scheduler --no-verify-jwt

echo "Done!"
