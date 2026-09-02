begin;
-- Executed after CI bootstrap creates one admin profile, six roster classes, and one academic year.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);

-- Rotation formula must cover every manipulation exactly once for each group count 1..6.
do $$
declare
  gc integer;
  g integer;
  s integer;
  vals text[];
begin
  for gc in 1..6 loop
    for g in 1..gc loop
      vals := array[]::text[];
      for s in 1..6 loop
        vals := vals || ('M' || (mod(g+s-2,6)+1)::text);
      end loop;
      if (select count(distinct x) from unnest(vals) x) <> 6 then
        raise exception 'rotation incomplete for group_count %, group %',gc,g;
      end if;
    end loop;
  end loop;
end $$;

-- Four-group canonical matrix.
do $$
declare expected text[][] := array[
  array['M1','M2','M3','M4'],
  array['M2','M3','M4','M5'],
  array['M3','M4','M5','M6'],
  array['M4','M5','M6','M1'],
  array['M5','M6','M1','M2'],
  array['M6','M1','M2','M3']
];
declare s integer; g integer; actual text;
begin
  for s in 1..6 loop
    for g in 1..4 loop
      actual := 'M' || (mod(g+s-2,6)+1)::text;
      if actual <> expected[s][g] then
        raise exception 'matrix mismatch at session %, group %: %',s,g,actual;
      end if;
    end loop;
  end loop;
end $$;

rollback;
