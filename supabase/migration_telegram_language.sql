-- =============================================================================
-- TELEGRAM BOT LANGUAGE
-- Safe to run multiple times. Run AFTER migration_integrations.sql.
--
-- The language the company's bot writes its notifications in (sale, new
-- order, low stock, debt paid, subscription warning, test message). It is a
-- per-company choice, not a per-user one: the messages go to the company's own
-- chat or group, which everyone there reads. Chosen in Settings → Integrations
-- (src/components/settings/telegram-integration-form.tsx).
--
-- Until this runs, the app reads every company's bot language as 'uz' and the
-- settings card saves everything except the language.
-- =============================================================================

ALTER TABLE integration_settings
  ADD COLUMN IF NOT EXISTS telegram_language TEXT NOT NULL DEFAULT 'uz';

ALTER TABLE integration_settings
  DROP CONSTRAINT IF EXISTS integration_settings_telegram_language_check;
ALTER TABLE integration_settings
  ADD CONSTRAINT integration_settings_telegram_language_check
  CHECK (telegram_language IN ('uz', 'ru', 'en'));
