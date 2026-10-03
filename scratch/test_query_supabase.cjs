const { createClient } = require('../backend/node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://wqvqqqyrrasjutghizmt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxdnFxcXlycmFzanV0Z2hpem10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNzQxNDksImV4cCI6MjEwNTY1MDE0OX0.pIde98LFuixIpX6-1OxwsCKKw2tnlce24CtpSf-FteE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testServiceRole() {
  const { data, error } = await supabase.from('sessions').insert([{}]);
  console.log('Insert empty error:', error);
}

testServiceRole();
