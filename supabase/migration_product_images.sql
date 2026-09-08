-- =============================================================================
-- PRODUCT IMAGES — Supabase Storage bucket + policies
-- Safe to run multiple times.
--
-- `products.image_url` has existed since the original schema but nothing ever
-- wrote to it: there was no bucket and no upload UI. This creates the bucket the
-- product form uploads to (src/components/shared/image-upload.tsx) and stores a
-- public URL in that column.
--
-- Public bucket on purpose: a product photo is shown in the product list, the
-- detail page and the POS grid, all of which render plain <img> tags. A private
-- bucket would need a signed URL minted per render and would break as soon as
-- the signature expired. Nothing confidential lives here.
--
-- Objects are laid out as `<tenant_id>/<file>.<ext>`, so a tenant only ever
-- writes inside its own prefix — that is what the policies below enforce.
-- Reads are open (the bucket is public anyway).
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB, mirrored client-side in image-upload.tsx
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- The first path segment must be the caller's own tenant id.
DO $$ BEGIN
  CREATE POLICY "product_images_insert_own_tenant" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'product-images'
      AND (storage.foldername(name))[1] = (SELECT tenant_id::text FROM profiles WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "product_images_update_own_tenant" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'product-images'
      AND (storage.foldername(name))[1] = (SELECT tenant_id::text FROM profiles WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "product_images_delete_own_tenant" ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'product-images'
      AND (storage.foldername(name))[1] = (SELECT tenant_id::text FROM profiles WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "product_images_public_read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN null; END $$;
