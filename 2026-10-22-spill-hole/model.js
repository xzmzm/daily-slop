/* Qualitative vent/rocking comparison; deliberately not fitted to flight data. */
(function(root){
  const G=9.81,RHO=1.225,MASS=80,AREA=Math.PI*3.5**2,HEIGHT=120,DT=.02,END=30;
  function parameters(percent){
    const p=Math.max(0,Math.min(20,Number(percent)||0))/100;
    const dragArea=1.3*AREA*(1-p)*(1-.9*p);
    const vt=Math.sqrt(2*MASS*G/(RHO*dragArea));
    const landing=vt/G*Math.acosh(Math.exp(HEIGHT*G/(vt*vt)));
    return {p,vt,landing,dragArea};
  }
  function trajectory(percent){
    const q=parameters(percent),samples=[];let theta=.22,omega=0;
    for(let i=0;i<=Math.round(END/DT);i++){
      const t=i*DT,air=Math.min(t,q.landing),x=G*air/q.vt;
      // Stable log(cosh(x)); downward displacement in quadratic drag.
      const fallen=q.vt*q.vt/G*(x+Math.log1p(Math.exp(-2*x))-Math.LN2);
      samples.push({t,height:t>=q.landing?0:Math.max(0,HEIGHT-fallen),v:t>=q.landing?0:q.vt*Math.tanh(x),angle:theta});
      if(t<q.landing){const force=.12*(1-q.p/.25)**2*Math.sin(1.22*t);
        omega+=(-1.6*Math.sin(theta)-(.06+8*q.p)*omega+force)*DT;theta+=omega*DT;}
    }
    const tail=samples.filter(s=>s.t>=q.landing-8&&s.t<q.landing);
    const rms=Math.sqrt(tail.reduce((sum,s)=>sum+s.angle*s.angle,0)/tail.length)*180/Math.PI;
    return {...q,samples,rms};
  }
  function at(track,time){const t=Math.max(0,Math.min(END,Number(time)||0)),i=Math.min(track.samples.length-2,Math.floor(t/DT)),f=(t-i*DT)/DT,a=track.samples[i],b=track.samples[i+1];return {t,height:a.height+(b.height-a.height)*f,v:a.v+(b.v-a.v)*f,angle:a.angle+(b.angle-a.angle)*f};}
  const api={G,RHO,MASS,AREA,HEIGHT,DT,END,parameters,trajectory,at};
  if(typeof module!=='undefined')module.exports=api;root.SpillModel=api;
})(typeof window==='undefined'?globalThis:window);
