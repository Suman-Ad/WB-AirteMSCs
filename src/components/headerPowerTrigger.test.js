/** @jest-environment node */
import { assessHeaderPower } from "./headerPowerTrigger";
import { advanceChangeover, initialChangeoverState } from "../pages/energyChangeoverTrigger";
const config={enabled:true,mainMeterId:"main",dg1MeterId:"dg"};
const m=(id,v,a,time=100000)=>({id,status:"OK",voltage_ll:v,current:a,observedAt:{toMillis:()=>time}});
const assess=(main,dg,source="EB",cache=false)=>assessHeaderPower(config,[main,dg].filter(Boolean),100000,cache,source);
test("EB to DG requires zero voltage and current plus loaded live DG",()=>{
 expect(assess(m("main",0,0),m("dg",415,100))).toMatchObject({kind:"candidate",dg:"DG-1"});
 for(const main of [m("main",0,1),m("main",1,0),m("main",0,undefined),undefined]) expect(assess(main,m("dg",415,100)).kind).not.toBe("candidate");
 for(const dg of [m("dg",300,100),m("dg",415,0),m("dg",415,undefined),m("dg",415,100,1)]) expect(assess(m("main",0,0),dg).kind).not.toBe("candidate");
});
test("offline incomer can fail over using distinct fresh DG timestamps but cache cannot",()=>{
 for(const main of [m("main",415,100,1),{...m("main",415,100),communicationState:"OFFLINE"},{...m("main",415,100),status:"ERROR"}]) expect(assess(main,m("dg",415,100))).toMatchObject({kind:"candidate",mainTime:100000,dgTime:100000});
 expect(assess(m("main",0,0),m("dg",415,100),"EB",true).kind).toBe("waiting");
 expect(assess({...m("main",0,0),observedAt:null},m("dg",415,100)).kind).toBe("waiting");
});
test("DG to EB needs recovered loaded incomer and stopped or unloaded DG",()=>{
 expect(assess(m("main",415,100),m("dg",0,0),"DG")).toMatchObject({kind:"candidate",dg:"EB"});
 expect(assess(m("main",415,100),m("dg",0,0),"DG").kind).toBe("candidate");
 for(const v of [1,300,415,undefined]) expect(assess(m("main",415,100),m("dg",v,10),"DG").kind).toBe("waiting");
 expect(assess(m("main",415,0),m("dg",415,0),"DG").kind).toBe("waiting");
 expect(assess(m("main",415,100),m("dg",0,0,1),"DG").kind).toBe("waiting");
});
test("partial and disagreeing phases do not substitute aggregate readings",()=>{
 expect(assess({...m("main",0,0),R_current:0},m("dg",415,100)).kind).toBe("waiting");
 expect(assess({...m("main",0,0),R_voltage_ll:0,Y_voltage_ll:415,B_voltage_ll:0},m("dg",415,100)).kind).toBe("waiting");
});
test("all mapped DGs must be stopped or unloaded",()=>{
 const cfg={...config,dg2MeterId:"dg2"};
 expect(assessHeaderPower(cfg,[m("main",415,100),m("dg",0,0),m("dg2",415,10)],100000,false,"DG").kind).toBe("waiting");
 expect(assessHeaderPower({...config,dg1MeterId:"main"},[],100000,false).kind).toBe("unconfigured");
});

test("restoration waits through DG load and requires two distinct healthy reading pairs",()=>{
 let state=initialChangeoverState();
 const step=(time,voltage,current=100,dgCurrent=0)=>{
   const assessment=assessHeaderPower(config,[m("main",415,current,time),m("dg",voltage,dgCurrent,time)],time,false,"DG");
   state=advanceChangeover(state,assessment,2);
   return state.fired;
 };
 expect(step(100000,415,100,10)).toBe(false);
 expect(step(110000,0)).toBe(false);
 expect(step(110000,0)).toBe(false);
 expect(step(120000,0,0)).toBe(false);
 expect(step(130000,0)).toBe(false);
 expect(step(140000,0)).toBe(true);
});

test("restoration rejects cached, offline and incomplete DG current readings",()=>{
 const main=m("main",415,100), dg=m("dg",0,0);
 expect(assess(main,dg,"DG",true).kind).toBe("waiting");
 for(const invalid of [{...dg,communicationState:"OFFLINE"},{...dg,R_current:0},{...dg,R_voltage_ll:0,Y_voltage_ll:1,B_voltage_ll:0,current:10}]) {
   expect(assess(main,invalid,"DG").kind).toBe("waiting");
 }
 expect(assess(main,{...dg,R_voltage_ll:0,Y_voltage_ll:0,B_voltage_ll:0},"DG").kind).toBe("candidate");
});

test("cooldown voltage with zero DG current restores after two distinct reading pairs",()=>{
 let state=initialChangeoverState();
 const step=time=>{
  const assessment=assessHeaderPower(config,[m("main",415,100,time),m("dg",415,0,time)],time,false,"DG");
  state=advanceChangeover(state,assessment,2);return state.fired;
 };
 expect(step(100000)).toBe(false);expect(step(100000)).toBe(false);expect(step(110000)).toBe(true);
});
test("cooldown rejects load on any phase, incomplete current, stale data and cache",()=>{
 const main=m("main",415,100),dg=m("dg",415,0);
 expect(assess(main,dg,"DG")).toMatchObject({kind:"candidate",dg:"EB"});
 for(const blocked of [{...dg,current:1},{...dg,current:undefined},{...dg,R_current:0},{...dg,R_current:0,Y_current:1,B_current:0},{...dg,communicationState:"OFFLINE"},m("dg",415,0,1)]) expect(assess(main,blocked,"DG").kind).toBe("waiting");
 expect(assess(main,dg,"DG",true).kind).toBe("waiting");
 expect(assess({...main,current:0},dg,"DG").kind).toBe("waiting");
 expect(assess(main,{...dg,R_current:0,Y_current:0,B_current:0},"DG").kind).toBe("candidate");
});
test("cooldown checks every mapped DG and identifies the blocking generator",()=>{
 const cfg={...config,dg2MeterId:"dg2"};
 expect(assessHeaderPower(cfg,[m("main",415,100),m("dg",415,0),m("dg2",415,0)],100000,false,"DG","DG-1").kind).toBe("candidate");
 const blocked=assessHeaderPower(cfg,[m("main",415,100),m("dg",415,0),m("dg2",415,10)],100000,false,"DG","DG-1");
 expect(blocked.kind).toBe("waiting");expect(blocked.message).toContain("DG-2");
});

test("restoration status distinguishes actual DG load from unavailable readings",()=>{
 const main=m("main",415,100);
 expect(assess(main,m("dg",415,2),"DG").message).toContain("2 A");
 expect(assess(main,m("dg",415,2),"DG").message).not.toContain("unavailable");
 expect(assess(main,m("dg",415,0,1),"DG").message).toContain("offline, stale or in error");
 expect(assess(main,m("dg",415,undefined),"DG").message).toContain("current readings are missing");
});

test("DG-2 zero load switches after two fresh load readings despite offline standby and unchanged fresh mains timestamp",()=>{
 const cfg={...config,dg2MeterId:"dg2"};let state=initialChangeoverState();
 const step=(time,current=0)=>{
  const a=assessHeaderPower(cfg,[m("main",415,100,100000),{...m("dg",0,0,1),status:"ERROR"},m("dg2",415,current,time)],time,false,"DG","DG-2");
  state=advanceChangeover(state,a,2);return state;
 };
 expect(step(100000).fired).toBe(false);expect(step(100000).fired).toBe(false);
 const confirmed=step(110000);expect(confirmed.fired).toBe(true);expect(confirmed.transferAtMs).toBe(100000);
});
test("DG at zero voltage but nonzero or missing load cannot satisfy zero-load confirmation",()=>{
 for(const current of [1,undefined])expect(assess(m("main",415,100),m("dg",0,current),"DG").kind).toBe("waiting");
});

test("verified zero active power is zero load despite residual current, while real DG power blocks",()=>{
 const main=m("main",415,100),dg={...m("dg",415,2),powerUnits:"kilo",active_power:0};
 expect(assess(main,dg,"DG").kind).toBe("candidate");
 expect(assess(main,{...dg,active_power:1},"DG").kind).toBe("waiting");
 expect(assess(main,{...dg,R_active_power:0,Y_active_power:1,B_active_power:0},"DG").kind).toBe("waiting");
 expect(assess(main,{...dg,R_active_power:0},"DG").kind).toBe("waiting");
 expect(assess(main,{...dg,powerUnits:"raw"},"DG").kind).toBe("waiting");
});
