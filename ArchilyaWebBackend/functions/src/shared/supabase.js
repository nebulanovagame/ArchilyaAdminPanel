const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function readLocalEnv() {
  const candidates = [
    path.resolve(__dirname, '..', '..', '.env'),            // functions/
    path.resolve(__dirname, '..', '..', '..', '.env'),      // ArchilyaWebBackend/
    path.resolve(__dirname, '..', '..', '..', '..', '.env'),// Archilya/
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

readLocalEnv();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = { supabase };
