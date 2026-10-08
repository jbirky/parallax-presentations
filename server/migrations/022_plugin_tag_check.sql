-- Versions the nightly check for new version tags imported
-- (services/plugin-tag-check.js), rather than someone under Publish. Its
-- imports go under the name of whoever imported the plugin's newest
-- version, so they see them under Your imports.
ALTER TABLE plugin_versions ADD COLUMN IF NOT EXISTS found_by_check BOOLEAN NOT NULL DEFAULT FALSE;
