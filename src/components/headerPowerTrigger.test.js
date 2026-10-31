import { assessHeaderPower } from "./headerPowerTrigger";
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
test("DG to EB needs recovered loaded incomer and DG strictly below 50 A",()=>{
 expect(assess(m("main",415,100),m("dg",415,49),"DG")).toMatchObject({kind:"candidate",dg:"EB"});
 expect(assess(m("main",415,100),m("dg",0,0),"DG").kind).toBe("candidate");
 for(const a of [50,100,undefined]) expect(assess(m("main",415,100),m("dg",415,a),"DG").kind).toBe("waiting");
 expect(assess(m("main",415,0),m("dg",415,0),"DG").kind).toBe("waiting");
 expect(assess(m("main",415,100),m("dg",0,0,1),"DG").kind).toBe("waiting");
});
test("partial and disagreeing phases do not substitute aggregate readings",()=>{
 expect(assess({...m("main",0,0),R_current:0},m("dg",415,100)).kind).toBe("waiting");
 expect(assess({...m("main",0,0),R_voltage_ll:0,Y_voltage_ll:415,B_voltage_ll:0},m("dg",415,100)).kind).toBe("waiting");
});
test("all mapped DGs must be below restoration threshold",()=>{
 const cfg={...config,dg2MeterId:"dg2"};
 expect(assessHeaderPower(cfg,[m("main",415,100),m("dg",415,0),m("dg2",415,100)],100000,false,"DG").kind).toBe("waiting");
 expect(assessHeaderPower({...config,dg1MeterId:"main"},[],100000,false).kind).toBe("unconfigured");
});
