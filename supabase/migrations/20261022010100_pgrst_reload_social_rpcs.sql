-- Non-destructive: nudge PostgREST schema cache after social RPC installs/overloads.
-- Does not grant EXECUTE to anon/authenticated; service_role remains the only app caller.
SELECT pg_notify('pgrst', 'reload schema');
