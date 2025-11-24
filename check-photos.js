// Quick script to check photo connections in Supabase
// Run with: node check-photos.js

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkPhotos() {
  console.log('Checking trial photos...\n');

  const trialId = '065cf4fb-74af-4458-bda0-74b988fad572';

  // Check if trial exists in database
  const { data: trial, error } = await supabase
    .from('trials')
    .select('id, name, photos')
    .eq('id', trialId)
    .single();

  if (error) {
    console.log('❌ Trial not found in database:', error.message);
    return;
  }

  console.log('✓ Trial found:', trial.name);
  console.log('\n📸 Photos in database:');
  console.log(JSON.stringify(trial.photos, null, 2));

  // List files in storage for this trial
  console.log('\n📁 Files in storage bucket:');
  const { data: files, error: listError } = await supabase.storage
    .from('plot-images')
    .list(trialId, {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (listError) {
    console.log('Error listing storage files:', listError);
  } else if (files && files.length > 0) {
    files.forEach(file => {
      console.log(`  - ${file.name}`);
    });

    // Check date folders
    for (const file of files) {
      if (file.id === null) { // It's a folder
        console.log(`\n  Checking folder: ${file.name}/`);
        const { data: dateFiles } = await supabase.storage
          .from('plot-images')
          .list(`${trialId}/${file.name}`);

        if (dateFiles) {
          dateFiles.forEach(f => console.log(`    - ${f.name}`));
        }
      }
    }
  } else {
    console.log('  No files found');
  }
}

checkPhotos().catch(console.error);
