// Inspect the public WebP container without decoding or exposing metadata.
export function inspectSceneArtwork(bytes){
  if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP'||bytes.readUInt32LE(4)+8!==bytes.length)throw new Error('Invalid WebP container');
  const metadata=[];let width=0,height=0;
  for(let offset=12;offset<bytes.length;){
    if(offset+8>bytes.length)throw new Error('Truncated WebP chunk');
    const tag=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4),start=offset+8;
    if(start+size>bytes.length)throw new Error('Truncated WebP payload');
    if(['EXIF','XMP ','ICCP','C2PA','JUMB'].includes(tag))metadata.push(tag.trim());
    if(tag==='VP8 '&&size>=10){width=bytes.readUInt16LE(start+6)&0x3fff;height=bytes.readUInt16LE(start+8)&0x3fff;}
    if(tag==='VP8X'&&size>=10){width=bytes.readUIntLE(start+4,3)+1;height=bytes.readUIntLE(start+7,3)+1;}
    if(tag==='VP8L'&&size>=5){const bits=bytes.readUInt32LE(start+1);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;}
    offset=start+size+(size%2);
    if(offset>bytes.length)throw new Error('Invalid WebP padding');
  }
  if(!width||!height)throw new Error('WebP has no image dimensions');
  return{width,height,metadata};
}
