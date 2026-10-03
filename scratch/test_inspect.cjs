const { createClient } = require('../backend/node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://wqvqqqyrrasjutghizmt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxdnFxcXlycmFzanV0Z2hpem10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNzQxNDksImV4cCI6MjEwNTY1MDE0OX0.pIde98LFuixIpX6-1OxwsCKKw2tnlce24CtpSf-FteE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data, error } = await supabase.from('sessions').insert([{ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }]);
  console.log('Insert UUID result:', { data, error });
}

inspect();
