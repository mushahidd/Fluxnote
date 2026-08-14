-- Fix token encoding issue - change from base64url to hex
-- base64url is not supported in older PostgreSQL versions

ALTER TABLE public.room_shares 
  ALTER COLUMN token SET DEFAULT encode(gen_random_bytes(24), 'hex');
