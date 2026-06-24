'use server';

import { createClientOnServer } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const MAX_FILE_SIZE = 1024 * 1024; // 1MB limit for ESP8266 OTA partition

async function checkAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session')?.value;
  return session === 'authenticated';
}

export type UploadResult = {
  success: boolean;
  error?: string;
  release?: {
    version: string;
    compatible_model: string;
    sha256: string;
    firmware_size: number;
    firmware_url: string;
    is_stable: boolean;
    minimum_firmware_version: string | null;
  };
};

export async function uploadFirmwareRelease(formData: FormData): Promise<UploadResult> {
  if (!(await checkAuth())) {
    return { success: false, error: 'Access denied: Authentication required.' };
  }

  const version = formData.get('version') as string;
  const compatibleModel = formData.get('compatible_model') as string;
  const releaseNotes = formData.get('release_notes') as string;
  const file = formData.get('file') as File | null;
  const isStable = formData.get('is_stable') === 'true';
  const minimumFirmwareVersion = formData.get('minimum_firmware_version') as string;

  // 1. Validation
  if (!version || !compatibleModel || !file) {
    return { success: false, error: 'All fields are required.' };
  }

  const versionRegex = /^[0-9a-zA-Z.-]+$/;
  if (!versionRegex.test(version)) {
    return { success: false, error: 'Invalid version format. Use alphanumeric characters, dots, and hyphens (e.g., 1.0.0).' };
  }

  if (minimumFirmwareVersion && !versionRegex.test(minimumFirmwareVersion)) {
    return { success: false, error: 'Invalid minimum firmware version format. Use alphanumeric characters, dots, and hyphens (e.g., 1.0.0).' };
  }

  if (compatibleModel !== '2CH_RELAY' && compatibleModel !== '4CH_RELAY') {
    return { success: false, error: 'Invalid compatible model selected.' };
  }

  if (!file.name.endsWith('.bin')) {
    return { success: false, error: 'Only .bin files are accepted.' };
  }

  const size = file.size;
  if (size === 0) {
    return { success: false, error: 'Uploaded file is empty.' };
  }

  if (size > MAX_FILE_SIZE) {
    return { success: false, error: `Firmware exceeds the OTA partition limit of 1MB (size: ${size} bytes).` };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Calculate SHA256 hash
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  const supabase = await createClientOnServer();

  // 2. Check for duplicate versions for the same model
  const { data: existing, error: queryError } = await supabase
    .from('firmware_releases')
    .select('id')
    .eq('version', version)
    .eq('compatible_model', compatibleModel)
    .maybeSingle();

  if (queryError) {
    console.error('[Firmware Actions] Duplicate query failed:', queryError);
    return { success: false, error: 'Database check failed: ' + queryError.message };
  }

  if (existing) {
    return { success: false, error: `Version ${version} already exists for model ${compatibleModel}.` };
  }

  // 3. Ensure Storage Bucket exists
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.error('[Firmware Actions] List buckets error:', listError);
    } else {
      const exists = buckets.some((b) => b.name === 'firmware');
      if (!exists) {
        const { error: createError } = await supabase.storage.createBucket('firmware', {
          public: true,
          allowedMimeTypes: ['application/octet-stream', 'application/x-binary'],
          fileSizeLimit: MAX_FILE_SIZE
        });
        if (createError) {
          console.error('[Firmware Actions] Create bucket error:', createError);
        } else {
          console.log('[Firmware Actions] Created "firmware" public storage bucket');
        }
      }
    }
  } catch (err) {
    console.error('[Firmware Actions] Bucket check failed:', err);
  }

  // 4. Upload file to Supabase Storage
  const path = `${compatibleModel}/${version}.bin`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('firmware')
    .upload(path, buffer, {
      contentType: 'application/octet-stream',
      upsert: true
    });

  if (uploadError) {
    console.error('[Firmware Actions] Storage upload failed:', uploadError);
    return { success: false, error: 'Storage upload failed: ' + uploadError.message };
  }

  // 5. Get public URL
  const { data: urlData } = supabase.storage.from('firmware').getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  // 6. Insert metadata into database
  const { data: insertData, error: insertError } = await supabase
    .from('firmware_releases')
    .insert({
      version,
      firmware_url: publicUrl,
      sha256,
      firmware_size: size,
      compatible_model: compatibleModel,
      release_notes: releaseNotes || '',
      is_stable: isStable,
      minimum_firmware_version: minimumFirmwareVersion || null
    })
    .select()
    .single();

  if (insertError) {
    console.error('[Firmware Actions] Database insert failed:', insertError);
    // Cleanup uploaded storage file if db write fails
    await supabase.storage.from('firmware').remove([path]);
    return { success: false, error: 'Database insert failed: ' + insertError.message };
  }

  revalidatePath('/dashboard/firmware');
  revalidatePath('/dashboard'); // revalidate main dashboard to update latestRelease map

  return {
    success: true,
    release: {
      version,
      compatible_model: compatibleModel,
      sha256,
      firmware_size: size,
      firmware_url: publicUrl,
      is_stable: isStable,
      minimum_firmware_version: minimumFirmwareVersion || null
    }
  };
}
