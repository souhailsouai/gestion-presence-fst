begin;

with cycle as (
  select id from public.v515_cycles
  where academic_year='2026/2027' and semester=1
  limit 1
)
update public.v515_sessions s
set is_teaching_session=true,
    non_teaching_reason=null,
    class_name=x.class_name,
    effective_session_index=x.effective_index,
    class_occurrence=x.class_occurrence,
    updated_at=now()
from cycle c
join (values
  (date '2026-10-15','MPI1-C',5,3),
  (date '2026-10-22','MPI1-D',6,3),
  (date '2026-10-29','MPI1-C',7,4),
  (date '2026-11-12','MPI1-D',8,4),
  (date '2026-11-19','MPI1-C',9,5),
  (date '2026-11-26','MPI1-D',10,5),
  (date '2026-12-03','MPI1-C',11,6)
) as x(session_date,class_name,effective_index,class_occurrence) on true
where s.cycle_id=c.id and s.session_date=x.session_date;

commit;
