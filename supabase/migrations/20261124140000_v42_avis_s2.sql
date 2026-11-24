-- V42 — Avis officiels du semestre 2 (MPI1 et PC1), affichés à partir du 12/12/2026
-- (lendemain de la dernière séance du S1, choix de l'administrateur du 24/11/2026).
-- Les avis du S1 restent visibles jusqu'au 11/12/2026. Dates reprises du planning S2 et des dates exclues validées.

create table if not exists backup_20261122_enseignants_s1.v21_notices_v42 as table public.v21_notices;

update public.v21_notices set ends_on = date '2026-12-11', updated_at = now()
 where starts_on is null and ends_on is null;

insert into public.v21_notices (cycle_id, title, body, starts_on, ends_on, active, sort_order)
select n.cycle_id, x.title, x.body, date '2026-12-12', date '2027-04-30', true, x.sort_order
  from (select cycle_id from public.v21_notices order by sort_order limit 1) n,
  (values
    (110, 'S2 — Horaire officiel',
     E'Les TP de Physique du semestre 2 commencent le **lundi 11/01/2027** et ont lieu de **14h00 à 17h00**.\nSalles A, B, C et D — rez-de-chaussée, à l''entrée du Département de Physique.\n5 groupes par classe, 5 manipulations par étudiant.'),
    (120, 'S2 — Démarrage des TP MPI1',
     E'**Lundi** (une semaine sur deux) : **MPI1-A** le 11/01/2027 · **MPI1-E** le 18/01/2027.\n**Jeudi** (une semaine sur deux) : **MPI1-C** le 14/01/2027 · **MPI1-D** le 21/01/2027.\n**Vendredi** : **MPI1-B** le 15/01/2027, cinq séances consécutives jusqu''au 12/02/2027.'),
    (130, 'S2 — Démarrage des TP PC1',
     E'**PC1-A** : vendredi **19/02/2027**, après les séances de MPI1-B.\nDernière séance : vendredi 30/04/2027.'),
    (140, 'S2 — Dates sans TP',
     E'Semaine des DS : du 22/02 au 28/02/2027.\nSemaines sans TP : du 08/03 au 13/03 et du 15/03 au 20/03/2027.\nVacances de printemps : du 20/03 au 04/04/2027.\nJour férié : vendredi 09/04/2027.')
  ) as x(sort_order, title, body)
 where not exists (select 1 from public.v21_notices where title = 'S2 — Horaire officiel');
