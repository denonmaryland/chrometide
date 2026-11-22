// Store the distance to a glyph edge in each texel. The shader uses this
// outline for both the front face and the sides of an extruded title.
export function titleField(text) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', {willReadFrequently:true});
  const font = '900 88px "DejaVu Sans", sans-serif';
  ctx.font = font;
  const metrics = ctx.measureText(text);
  canvas.width = Math.min(2048, Math.ceil(metrics.width) + 28);
  canvas.height = 132;
  ctx.font = font;
  ctx.fillStyle = 'white';
  ctx.fillText(text, 14, 94, canvas.width - 28);
  const {width:w, height:h} = canvas;
  const pixels = ctx.getImageData(0,0,w,h).data;
  const distance = new Float32Array(w*h);
  const inside = i => pixels[i*4+3] >= 128;
  for (let i=0; i<distance.length; i++) {
    const alpha = pixels[i*4+3]/255;
    distance[i] = alpha>0 && alpha<1 ? Math.abs(alpha-.5) :
      (inside(i)!==inside(i-1) || inside(i)!==inside(i-w) ||
       inside(i)!==inside(i+1) || inside(i)!==inside(i+w)) ? .5 : 64;
  }
  for (const step of [1,-1]) {
    for (let k=0; k<w*h; k++) {
      const i = step===1 ? k : w*h-1-k;
      const x = i%w, row = i-step*w;
      if (x>0 && x<w-1 && row>=0 && row<w*h) {
        distance[i] = Math.min(distance[i],distance[i-step]+1,distance[row]+1,
          distance[row-1]+Math.SQRT2,distance[row+1]+Math.SQRT2);
      }
    }
  }
  const data = new Uint8Array(w*h);
  for (let i=0; i<data.length; i++) {
    data[i] = Math.round(128+(inside(i)?-1:1)*Math.min(31.75,distance[i])*4);
  }
  return {data,w,h};
}
