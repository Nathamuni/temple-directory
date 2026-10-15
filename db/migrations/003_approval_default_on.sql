-- Volunteer edits now wait for admin approval by default. An admin can still switch approval off (bypass) at #admin.
UPDATE settings SET value = 'true' WHERE key = 'require_approval';
