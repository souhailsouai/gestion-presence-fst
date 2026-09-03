begin;

-- SECURITY INVOKER RPCs execute with the authenticated caller's SQL privileges.
-- RLS remains the authorization boundary; these grants only make the required
-- statements executable after the corresponding policy has allowed the row.
grant insert, update on public.v515_requests to authenticated;
grant insert, update, delete on public.v515_assignments to authenticated;
grant insert, update, delete on public.v515_teacher_constraints to authenticated;
grant insert, update, delete on public.v515_waivers to authenticated;
grant insert, update, delete on public.v515_class_pairs to authenticated;
grant insert, update, delete on public.v515_groups to authenticated;
grant insert, update, delete on public.v515_sessions to authenticated;
grant insert, update on public.v515_cycles to authenticated;
grant insert, update on public.v515_manipulations to authenticated;

-- Audit writes remain unavailable directly to authenticated clients; the
-- non-exposed private.v515_audit helper is the only application write path.
revoke insert, update, delete on public.v515_audit_log from authenticated;

commit;
