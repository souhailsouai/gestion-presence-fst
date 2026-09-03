begin;

grant insert,update on public.v515_requests to authenticated;
grant insert,update,delete on public.v515_assignments to authenticated;
grant insert,update,delete on public.v515_teacher_constraints to authenticated;
grant insert,update,delete on public.v515_waivers to authenticated;
grant insert,update,delete on public.v515_class_pairs to authenticated;
grant insert,update,delete on public.v515_groups to authenticated;
grant insert,update,delete on public.v515_sessions to authenticated;
grant insert,update on public.v515_cycles to authenticated;
grant insert,update on public.v515_manipulations to authenticated;
revoke all on public.v515_audit_log from anon,authenticated;

commit;
