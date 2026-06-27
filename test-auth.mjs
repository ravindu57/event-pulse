import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) env[key] = val.join('=');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  console.log('Testing signup...');
  const { data, error } = await supabase.auth.signUp({
    email: 'test@example.com',
    password: 'password123'
  });
  
  if (error) {
    console.log('SignUp Error:', error);
    console.log('Is Error instance?', error instanceof Error);
    console.log('Error message:', error.message);
  } else {
    console.log('SignUp Success:', data);
  }
}

test();
