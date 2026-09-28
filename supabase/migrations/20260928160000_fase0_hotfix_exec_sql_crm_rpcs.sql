-- Fase 0 / BL-001 e BL-002 (SEC-01, SEC-08, CRM-20)
-- Hotfix ja aplicado em producao em 28/09/2026. Idempotente.
--
-- exec_sql era SECURITY DEFINER e executavel por anon: SQL arbitrario como postgres.
-- update_crm_password / verify_crm_login eram executaveis por anon: troca de senha
-- de qualquer usuario do CRM. So a crm-auth (service role) chama essas funcoes.

DROP FUNCTION IF EXISTS public.exec_sql(text);

REVOKE EXECUTE ON FUNCTION public.update_crm_password(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_crm_login(text, text) FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.update_crm_password(uuid, text) SET search_path = public, extensions;
ALTER FUNCTION public.verify_crm_login(text, text) SET search_path = public, extensions;

REVOKE EXECUTE ON FUNCTION public.fn_streak_daily_check() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_redistribute_pending_activities(uuid, date) FROM PUBLIC, anon;
