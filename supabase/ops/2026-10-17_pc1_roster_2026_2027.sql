begin;

create temporary table pc1_roster_2026_2027(
  last_name text not null,
  first_name text not null,
  group_no integer not null check(group_no between 1 and 6)
) on commit drop;

insert into pc1_roster_2026_2027(last_name,first_name,group_no) values
('Adalia','Ahd',1),
('Aissaoui','Mariem',1),
('Ayari','Anas',1),
('Azizi','Med Skander',1),
('Azizi','Rayen',1),
('Ben Ali','Maram',1),
('Ben Said','Zeineb',1),
('Bahloul','Mahdi',1),
('Tliba','Eya',1),
('Bennaceur','Hayder',2),
('Boudellaa','Fatma',2),
('Bouhachem','Med Aziz',2),
('Boumakhla','Samia',2),
('Brinis','Samar',2),
('Dhaouadi','Emna',2),
('Bouaziz','Sara',2),
('Zouari','Malek',2),
('Gharbi','Asma',3),
('Greri','Ines',3),
('Habbachi','Rahma',3),
('Hamdi','Alaa',3),
('Harrane','Khadija',3),
('Hassin','Ghofrane',3),
('Hmaidi','Mohamed Yacine',3),
('Houimli','Jinen',4),
('Jlassi','Zeineb',4),
('Laamouri','Ghofrane',4),
('Matar Basha','Zaineb',4),
('Mbarki','Mohamed Nidhal',4),
('Miaoui','Mariem',4),
('Jelassi','Rawaa',4),
('Missaoui','Mustapha',5),
('Ouertani','Malek',5),
('Oun','Ahmed',5),
('Ounissi','Hanine',5),
('Ourari','Islam',5),
('Ouslati','Eya',5),
('Messali','Emna',5),
('Rezgui','Amal',6),
('Saied','Khadija',6),
('Selmi','Ghofran',6),
('Touihri','Amira',6),
('Yousfi','Nour',6),
('Zeddini','Mariem',6),
('Messaoudi','Omar',6);

do $$
declare
  v_target_count integer;
  v_class_count integer;
  v_unexpected integer;
begin
  select count(*) into v_target_count from pc1_roster_2026_2027;
  if v_target_count <> 45 then
    raise exception 'PC1 roster must contain 45 students, got %', v_target_count;
  end if;

  select count(*) into v_class_count
  from public.classes
  where name ~ '^PC1-A-G[1-6]$' and deleted_at is null;
  if v_class_count <> 6 then
    raise exception 'Expected 6 active PC1-A groups, got %', v_class_count;
  end if;

  select count(*) into v_unexpected
  from public.students s
  join public.classes c on c.id=s.class_id
  where c.name ~ '^PC1-A-G[1-6]$'
    and s.deleted_at is null
    and not exists(
      select 1
      from pc1_roster_2026_2027 r
      where lower(regexp_replace(trim(concat_ws(' ',s.last_name,s.first_name)),'\\s+',' ','g')) in (
              lower(regexp_replace(trim(r.last_name||' '||r.first_name),'\\s+',' ','g')),
              lower(regexp_replace(trim(r.first_name||' '||r.last_name),'\\s+',' ','g'))
            )
    );
  if v_unexpected <> 0 then
    raise exception 'Refusing PC1 roster sync: % unexpected active student(s) found', v_unexpected;
  end if;
end $$;

with matched as (
  select
    s.id as student_id,
    r.last_name,
    r.first_name,
    r.group_no,
    c.id as target_class_id,
    c.teacher_id as target_teacher_id
  from pc1_roster_2026_2027 r
  join public.classes c
    on c.name='PC1-A-G'||r.group_no
   and c.deleted_at is null
  join public.students s
    on s.deleted_at is null
   and lower(regexp_replace(trim(concat_ws(' ',s.last_name,s.first_name)),'\\s+',' ','g')) in (
         lower(regexp_replace(trim(r.last_name||' '||r.first_name),'\\s+',' ','g')),
         lower(regexp_replace(trim(r.first_name||' '||r.last_name),'\\s+',' ','g'))
       )
)
update public.students s
set last_name=m.last_name,
    first_name=m.first_name,
    class_id=m.target_class_id,
    teacher_id=coalesce(m.target_teacher_id,s.teacher_id)
from matched m
where s.id=m.student_id;

insert into public.students(id,teacher_id,class_id,last_name,first_name,email)
select
  gen_random_uuid(),
  c.teacher_id,
  c.id,
  r.last_name,
  r.first_name,
  null
from pc1_roster_2026_2027 r
join public.classes c
  on c.name='PC1-A-G'||r.group_no
 and c.deleted_at is null
where not exists(
  select 1
  from public.students s
  join public.classes sc on sc.id=s.class_id
  where sc.name ~ '^PC1-A-G[1-6]$'
    and s.deleted_at is null
    and lower(regexp_replace(trim(concat_ws(' ',s.last_name,s.first_name)),'\\s+',' ','g')) in (
          lower(regexp_replace(trim(r.last_name||' '||r.first_name),'\\s+',' ','g')),
          lower(regexp_replace(trim(r.first_name||' '||r.last_name),'\\s+',' ','g'))
        )
);

do $$
declare
  v_total integer;
  v_bad_groups integer;
begin
  select count(*) into v_total
  from public.students s
  join public.classes c on c.id=s.class_id
  where c.name ~ '^PC1-A-G[1-6]$' and s.deleted_at is null;

  if v_total <> 45 then
    raise exception 'PC1 roster sync failed: expected 45 active students, got %', v_total;
  end if;

  select count(*) into v_bad_groups
  from (
    select c.group_number, count(*) as n
    from public.students s
    join public.classes c on c.id=s.class_id
    where c.name ~ '^PC1-A-G[1-6]$' and s.deleted_at is null
    group by c.group_number
  ) q
  where (group_number=1 and n<>9)
     or (group_number=2 and n<>8)
     or (group_number between 3 and 6 and n<>7);

  if v_bad_groups <> 0 then
    raise exception 'PC1 roster sync failed: group sizes do not match 9/8/7/7/7/7';
  end if;
end $$;

commit;
