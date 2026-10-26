/* A uniformly sensitive, infinitesimal gap averaging a sinusoidal track. */
(function(root){
  const WIDTH = .0006, SLOW = .047625;
  function response(frequency, errorDegrees, speed=SLOW){
    const skew = WIDTH * Math.tan(errorDegrees * Math.PI / 180);
    const x = Math.PI * frequency * skew / speed;
    return Math.abs(x) < 1e-10 ? 1 : Math.sin(x) / x;
  }
  function db(frequency, errorDegrees, speed=SLOW){return 20*Math.log10(Math.max(1e-4,Math.abs(response(frequency,errorDegrees,speed))));}
  const api={WIDTH,SLOW,response,db};
  if(typeof module!=='undefined')module.exports=api;
  root.TapeModel=api;
})(typeof window!=='undefined'?window:globalThis);
