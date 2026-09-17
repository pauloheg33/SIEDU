-- PHOTO remains the gallery category for compatibility with existing clients
-- and public-event. The MIME type distinguishes photos from videos.
-- Hosted projects also require a global Storage limit of at least 500 MB.
update storage.buckets
set file_size_limit = 524288000,
    allowed_mime_types = array['image/*', 'video/*']
where id = 'photos';
