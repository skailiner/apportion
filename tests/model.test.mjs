import assert from 'node:assert/strict';
import {METHODS,allocate,configure,newGroup,initialState,scanHouseSizes,exportJSON,exportCSV,csvCell,validateState} from '../lib/apportion.ts';
let count=0;
const test=(label,fn)=>{fn();count++;console.log('PASS '+label);};
const groups=weights=>weights.map((weight,i)=>({id:String.fromCharCode(65+i),name:'Group '+i,weight,priority:i+1}));
const seats=(weights,house,method)=>allocate({groups:groups(weights),house,method},false).rows.map(g=>g.seats);
const fixture=(weights,house,expected)=>METHODS.forEach((m,i)=>assert.deepEqual(seats(weights,house,m),expected[i],m));
test('Independent small and published-example allocation fixtures',()=>{
  fixture([1,1,1],2,[[1,1,0],[1,1,0],[1,1,0]]);
  fixture([3,2,1],6,[[3,2,1],[3,2,1],[3,2,1]]);
  fixture([1,1,4],3,[[1,0,2],[0,0,3],[1,0,2]]);
  fixture([20,12,3],8,[[4,3,1],[5,3,0],[4,3,1]]);
  fixture([2560,3315,995,5012],20,[[4,6,2,8],[4,6,1,9],[4,6,2,8]]);
  fixture([1,1,1,3],4,[[1,1,0,2],[1,1,0,2],[1,1,1,1]]);
});
test('25 to 26 paradox includes precisely D and E, independent of cutoff ties',()=>{
  const state=initialState(),a=allocate(state),b=allocate({...state,house:26});
  assert.deepEqual(a.rows.map(g=>g.seats),[7,7,4,3,3,1]);
  assert.deepEqual(b.rows.map(g=>g.seats),[8,8,5,2,2,1]);
  assert.deepEqual(a.baseAllocation.map(g=>g.seats),[7,7,4,2,2,0]);
  assert.deepEqual(a.trace.filter(t=>t.awarded).map(t=>t.id),['F','D','E']);
  assert.deepEqual(b.trace.filter(t=>t.awarded).map(t=>t.id),['A','B','C']);
  assert.equal(a.cutoffTie.length,0);assert.equal(b.cutoffTie.length,0);
  const event=scanHouseSizes(state.groups,'hamilton').find(e=>e.from===25);
  assert.deepEqual(event.losses.map(g=>g.id),['D','E']);
});
let seed=4271; const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
const cases=Array.from({length:160},()=>({groups:groups(Array.from({length:2+random()%11},()=>1+random()%10000)),house:1+random()%200}));
test('160 grids: integer totals, Hamilton quota and exact fractions',()=>{
  for(const c of cases)for(const method of METHODS){
    const r=allocate({...c,method},false);
    assert.equal(r.rows.reduce((s,g)=>s+g.seats,0),c.house);
    r.rows.forEach(g=>{
      assert.ok(Number.isInteger(g.seats)&&g.seats>=0);
      if(method==='hamilton')assert.equal(g.quotaStatus,'within');
      assert.equal(BigInt(g.quota.numerator),BigInt(c.house)*BigInt(g.weight));
      assert.equal(BigInt(g.deviation.numerator),BigInt(g.seats)*BigInt(r.totalWeight)-BigInt(g.quota.numerator));
    });
  }
});
test('Scale invariance and row-order invariance with fixed priority',()=>{
  for(const c of cases.slice(0,45))for(const method of METHODS){
    const a=allocate({...c,method},false),b=allocate({...c,groups:c.groups.map(g=>({...g,weight:g.weight*13})),method},false),d=allocate({...c,groups:[...c.groups].reverse(),method},false);
    assert.deepEqual(a.rows.map(g=>g.seats),b.rows.map(g=>g.seats));
    for(const g of a.rows)assert.equal(g.seats,d.rows.find(x=>x.id===g.id).seats);
  }
});
test('Divisor allocations agree with independently ranked quotient sequences',()=>{
  for(const c of cases.slice(0,50))for(const method of ['dhondt','sainte-lague']){
    const priorities=c.groups.flatMap(g=>Array.from({length:c.house},(_,k)=>({id:g.id,priority:g.priority,p:BigInt(g.weight),d:BigInt(method==='dhondt'?k+1:2*k+1)})));
    priorities.sort((a,b)=>a.p*b.d===b.p*a.d?a.priority-b.priority:a.p*b.d>b.p*a.d?-1:1);
    const expected=priorities.slice(0,c.house);
    for(const g of allocate({...c,method},false).rows)assert.equal(g.seats,expected.filter(x=>x.id===g.id).length);
  }
});
test('Both divisor rules keep their allocation prefix across H=1..200',()=>{
  for(const c of [initialState(),...cases.slice(0,6)])for(const m of ['dhondt','sainte-lague'])assert.equal(scanHouseSizes(c.groups,m).length,0);
});
test('Trace reconstructs allocations and identifies cutoff versus intermediate ties',()=>{
  for(const method of METHODS){
    const state={groups:groups([1,1,1]),house:2,method},r=allocate(state);
    const reconstructed=Object.fromEntries(r.baseAllocation.map(g=>[g.id,g.seats]));
    r.trace.filter(t=>t.awarded).forEach(t=>reconstructed[t.id]++);
    r.rows.forEach(g=>assert.equal(g.seats,reconstructed[g.id]));
    assert.deepEqual(r.cutoffTie,['A','B','C']);
    assert.deepEqual(allocate(state,false).cutoffTie,['A','B','C']);
  }
  assert.equal(allocate({groups:groups([1,1]),house:2,method:'dhondt'}).cutoffTie.length,0);
});
test('Upper and lower quota violations are detected without rounded comparisons',()=>{
  const a=allocate({groups:groups([1,1,4]),house:3,method:'dhondt'});
  assert.equal(a.rows[2].quotaStatus,'above');assert.equal(a.cutoffTie.length,0);
  const b=allocate({groups:groups([1,1,1,3]),house:4,method:'sainte-lague'});
  assert.equal(b.rows[3].quotaStatus,'below');
  const c=allocate({groups:groups([1,1,3,12,18,32]),house:23,method:'sainte-lague'});
  assert.equal(c.rows[5].seats,12);assert.equal(c.rows[5].upperQuota,11);assert.equal(c.rows[5].quotaStatus,'above');assert.equal(c.cutoffTie.length,0);
});
test('Boundary inputs, exact large integer cross-products and atomic rejection',()=>{
  for(const method of METHODS)assert.equal(allocate({groups:groups(Array(12).fill(1_000_000_000)),house:200,method}).rows.reduce((s,g)=>s+g.seats,0),200);
  const state=initialState(),before=JSON.stringify(state);
  for(const patch of [null,[],{house:0},{house:201},{house:2.5},{house:'25'},{house:NaN},{method:'unknown'},{house:26,bad:1},{house:26,groups:[]},{groups:[{...state.groups[0]}, {...state.groups[0]}]},{groups:state.groups.map((g,i)=>({...g,weight:i?g.weight:0}))},{groups:state.groups.map((g,i)=>({...g,name:i?g.name:'\n'}))}])assert.throws(()=>configure(state,patch));
  assert.equal(JSON.stringify(state),before);
  const changed=configure(state,{house:26});assert.equal(changed.house,26);assert.notEqual(changed.groups,state.groups);
  assert.throws(()=>validateState({...state,groups:state.groups.map(g=>({...g,extra:true}))}));
});
test('Exports are deterministic, exact, complete and CSV-formula-safe',()=>{
  const state=initialState(),json=exportJSON(state),payload=JSON.parse(json);
  assert.equal(json,exportJSON(state));assert.equal(payload.schema,'apportion/v1');assert.equal(payload.sources.length,3);assert.equal(payload.comparison.length,3);
  assert.equal(typeof payload.selected.rows[0].quota.numerator,'string');
  assert.deepEqual(payload.configuration,state);
  for(const prefix of ['=','+','-','@'])assert.ok(csvCell(prefix+'test').startsWith('"\''));
  assert.equal(csvCell(-2),'"-2"');assert.equal(csvCell('a"b'),'"a""b"');
  assert.equal(exportCSV(state).split('\r\n').length,8);
});
test('New-group IDs remain unique when fixed priority is independent of ID',()=>{
  const existing=[{id:'A',priority:2},{id:'B',priority:3}];
  const added=newGroup(existing);assert.equal(added.id,'C');assert.equal(added.priority,1);
  assert.equal(new Set([...existing,added].map(g=>g.id)).size,3);
  assert.throws(()=>newGroup(groups(Array(12).fill(1))));
});
console.log('\n'+count+' groups passed; 160 generated allocation cases across three methods plus independent oracle comparisons.');
