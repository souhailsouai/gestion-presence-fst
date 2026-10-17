const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const opPath = path.join(__dirname,'../../supabase/ops/2026-10-17_pc1_roster_2026_2027.sql');
const expected = [
  {group:1,last:"Adalia",first:"Ahd"},
  {group:1,last:"Aissaoui",first:"Mariem"},
  {group:1,last:"Ayari",first:"Anas"},
  {group:1,last:"Azizi",first:"Med Skander"},
  {group:1,last:"Azizi",first:"Rayen"},
  {group:1,last:"Ben Ali",first:"Maram"},
  {group:1,last:"Ben Said",first:"Zeineb"},
  {group:1,last:"Bahloul",first:"Mahdi"},
  {group:1,last:"Tliba",first:"Eya"},
  {group:2,last:"Bennaceur",first:"Hayder"},
  {group:2,last:"Boudellaa",first:"Fatma"},
  {group:2,last:"Bouhachem",first:"Med Aziz"},
  {group:2,last:"Boumakhla",first:"Samia"},
  {group:2,last:"Brinis",first:"Samar"},
  {group:2,last:"Dhaouadi",first:"Emna"},
  {group:2,last:"Bouaziz",first:"Sara"},
  {group:2,last:"Zouari",first:"Malek"},
  {group:3,last:"Gharbi",first:"Asma"},
  {group:3,last:"Greri",first:"Ines"},
  {group:3,last:"Habbachi",first:"Rahma"},
  {group:3,last:"Hamdi",first:"Alaa"},
  {group:3,last:"Harrane",first:"Khadija"},
  {group:3,last:"Hassin",first:"Ghofrane"},
  {group:3,last:"Hmaidi",first:"Mohamed Yacine"},
  {group:4,last:"Houimli",first:"Jinen"},
  {group:4,last:"Jlassi",first:"Zeineb"},
  {group:4,last:"Laamouri",first:"Ghofrane"},
  {group:4,last:"Matar Basha",first:"Zaineb"},
  {group:4,last:"Mbarki",first:"Mohamed Nidhal"},
  {group:4,last:"Miaoui",first:"Mariem"},
  {group:4,last:"Jelassi",first:"Rawaa"},
  {group:5,last:"Missaoui",first:"Mustapha"},
  {group:5,last:"Ouertani",first:"Malek"},
  {group:5,last:"Oun",first:"Ahmed"},
  {group:5,last:"Ounissi",first:"Hanine"},
  {group:5,last:"Ourari",first:"Islam"},
  {group:5,last:"Ouslati",first:"Eya"},
  {group:5,last:"Messali",first:"Emna"},
  {group:6,last:"Rezgui",first:"Amal"},
  {group:6,last:"Saied",first:"Khadija"},
  {group:6,last:"Selmi",first:"Ghofran"},
  {group:6,last:"Touihri",first:"Amira"},
  {group:6,last:"Yousfi",first:"Nour"},
  {group:6,last:"Zeddini",first:"Mariem"},
  {group:6,last:"Messaoudi",first:"Omar"}
];

test('PC1 2026-2027 roster operation contains the validated 45 students in G1-G6',()=>{
  assert.equal(fs.existsSync(opPath),true,'PC1 roster SQL operation is missing');
  const sql=fs.readFileSync(opPath,'utf8');
  assert.equal(expected.length,45);
  const counts=new Map();
  for(const row of expected){
    counts.set(row.group,(counts.get(row.group)||0)+1);
    const tuple=`('${row.last.replaceAll("'","''")}','${row.first.replaceAll("'","''")}',${row.group})`;
    assert.ok(sql.includes(tuple),`Missing ${row.last} ${row.first} in G${row.group}`);
  }
  assert.deepEqual([...counts.entries()],[[1,9],[2,8],[3,7],[4,7],[5,7],[6,7]]);
  assert.match(sql,/PC1-A-G'\|\|r\.group_no/);
  assert.match(sql,/group_no between 1 and 6/);
  assert.doesNotMatch(sql,/delete\s+from\s+public\.students/i);
});
