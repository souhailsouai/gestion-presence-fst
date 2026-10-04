const fs=require('node:fs');
const path=require('node:path');
global.XLSX=require('xlsx');
global.FSTV31Domain=require('../../web/v31-domain.js');
global.FSTV31Config=require('../../web/v31-config.js');
const X=require('../../web/v31-tracking-xlsx.js');

const out=process.argv[2]||'artifacts/v31-xlsx';
fs.mkdirSync(out,{recursive:true});
process.chdir(out);

const classes=['MPI1-A','MPI1-B','MPI1-C','MPI1-D','MPI1-E','PC1-A'];
const makeModel=(className,i)=>({
  environment:'MPI1_PC1',
  className,
  students:[
    {id:className+'-s1',last_name:'Ben Ali',first_name:'Amine',groupName:className+'-G1'},
    {id:className+'-s2',last_name:'Trabelsi',first_name:'Sara',groupName:className+'-G1'}
  ],
  rows:[
    {studentId:className+'-s1',status:'present',environment:'MPI1_PC1',manipulationCode:'M1',grade:15,gradeOrigin:'manual'},
    {studentId:className+'-s1',status:'absent',environment:'MPI1_PC1',manipulationCode:'M2',grade:0,gradeOrigin:'absence_auto'},
    {studentId:className+'-s2',status:'retard',environment:'MPI1_PC1',manipulationCode:'M1',grade:12,gradeOrigin:'manual'},
    {studentId:className+'-s2',status:'justifie',environment:'MPI1_PC1',manipulationCode:'M2',grade:null,gradeOrigin:null}
  ]
});
const mpi=classes.map(makeModel);
const globalResult=X.generate(mpi,{environment:'MPI1_PC1'});
const perClass=X.generatePerClass(mpi,{environment:'MPI1_PC1'});
const lpc=X.generate({
  environment:'LPC3',
  className:'LPC3',
  students:[
    {id:'lpc-s1',last_name:'Etudiant',first_name:'LPC3',groupName:'LPC3-G1'}
  ],
  rows:[
    {studentId:'lpc-s1',status:'absent',environment:'LPC3',manipulationCode:'M1',grade:0,gradeOrigin:'absence_auto'},
    {studentId:'lpc-s1',status:'justifie',environment:'LPC3',manipulationCode:'M2',grade:null,gradeOrigin:null}
  ]
},{environment:'LPC3'});
fs.writeFileSync('manifest.json',JSON.stringify({globalResult,perClass,lpc},null,2));
console.log(JSON.stringify({globalResult,perClass,lpc},null,2));
