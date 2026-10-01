// Creates an admin user (Supabase Auth user + profile row).
// Used to bootstrap the first Super Admins; later, Super Admins add users from the panel.
//
// Usage:
//   npm run admin:create -- --email someone@example.com --name "Full Name" --role super_admin
//   (role: super_admin | editor. A temporary password is generated and printed;
//    the user must change it on first login.)
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), all[i + 1]]);
    return acc;
  }, []),
);

const { email, name, role = 'editor' } = args;
if (!email || !name || !['super_admin', 'editor'].includes(role)) {
  console.error('Usage: npm run admin:create -- --email <email> --name "<full name>" --role <super_admin|editor>');
  process.exit(1);
}

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 16 chars, mixed case + digits, no ambiguous characters
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const tempPassword = Array.from(crypto.randomBytes(16), b => alphabet[b % alphabet.length]).join('');

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password: tempPassword,
  email_confirm: true,
  user_metadata: { full_name: name },
});
if (error) {
  console.error('Could not create auth user:', error.message);
  process.exit(1);
}

const { error: profileError } = await supabase.from('profiles').insert({
  id: data.user.id,
  email,
  full_name: name,
  role,
  must_change_password: true,
});
if (profileError) {
  await supabase.auth.admin.deleteUser(data.user.id);
  console.error('Could not create profile (auth user rolled back):', profileError.message);
  process.exit(1);
}

console.log(`Created ${role} ${name} <${email}>`);
console.log(`Temporary password: ${tempPassword}`);
console.log('They will be asked to set a new password on first login.');
