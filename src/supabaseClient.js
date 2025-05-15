import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from Vercel environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment variables.');
  // Optionally, throw an error or handle this case appropriately
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 