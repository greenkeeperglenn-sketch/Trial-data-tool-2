import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are placeholder values
const isPlaceholder = (value) => {
  return !value ||
         value.includes('your-project-id') ||
         value.includes('your_anon_key_here') ||
         value === 'undefined';
};

// Validate environment variables
export const hasValidCredentials = () => {
  return supabaseUrl &&
         supabaseAnonKey &&
         !isPlaceholder(supabaseUrl) &&
         !isPlaceholder(supabaseAnonKey);
};

if (!hasValidCredentials()) {
  console.error('⚠️ Invalid or missing Supabase credentials!');
  console.error('Please update your .env file with real values from Supabase dashboard');
  console.error('Current URL:', supabaseUrl);
  console.error('Current Key:', supabaseAnonKey ? 'Set but appears to be placeholder' : 'Not set');
}

// Create Supabase client (will work even with placeholder values, but operations will fail)
export const supabase = hasValidCredentials()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });

// Helper function to check if user is authenticated
export const isAuthenticated = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
};

// Helper function to get current user
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Helper function to sign out
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};
