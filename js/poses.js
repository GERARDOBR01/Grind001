'use strict';
/* =====================================================================
   Posturas de movilidad: ilustraciones propias (figura de articulaciones
   en un lienzo de 100×100, suelo en y = 90) e instrucciones.
   Coordenadas: h cabeza · s hombro · e/w codo/mano · p cadera · k/f rodilla/pie
   Lado 1 = el cercano (color), lado 2 = el lejano (tenue).
   front: vista de frente (hombros y caderas separados).
   ===================================================================== */
const ZONE = {
  cuello:'Cuello', hombros:'Hombros', pecho:'Pecho', espalda_alta:'Espalda alta', dorsales:'Dorsales',
  espalda_baja:'Espalda baja', cadera:'Cadera', gluteos:'Glúteos', isquios:'Isquiotibiales',
  cuadriceps:'Cuádriceps', aductores:'Aductores', pantorrillas:'Pantorrillas', tobillos:'Tobillos', munecas:'Muñecas'
};
// [id, nombre, zonas, segundos, bilateral, instrucciones, figura, extra]
const POSES = [
  ['nino','Postura del niño',['espalda_baja','dorsales','cadera'],60,false,
    'De rodillas, siéntate sobre los talones y baja el pecho hacia el piso. Estira los brazos al frente y deja caer la frente. Respira hacia la espalda baja.',
    {h:[80,85],s:[70,82],e1:[81,85],w1:[92,88],e2:[80,84],w2:[91,87],p:[40,80],k1:[62,89],f1:[38,90],k2:[60,89],f2:[37,90]}],
  ['gato_vaca','Gato-vaca',['espalda_alta','espalda_baja'],45,false,
    'En cuatro puntos, manos bajo hombros y rodillas bajo cadera. Al exhalar redondea la espalda y mete la barbilla; al inhalar arquea y mira al frente. Muévete lento.',
    {h:[79,73],s:[70,67],e1:[70,79],w1:[70,90],e2:[68,79],w2:[68,90],p:[38,67],k1:[38,89],f1:[18,90],k2:[36,89],f2:[16,90],arc:-6}],
  ['perro','Perro boca abajo',['pantorrillas','isquios','hombros','dorsales'],45,false,
    'Desde cuatro puntos, levanta la cadera hacia atrás y arriba formando una V invertida. Empuja el piso con las manos y lleva los talones hacia abajo sin forzar.',
    {h:[71,74],s:[66,68],e1:[72,79],w1:[78,90],e2:[70,79],w2:[76,90],p:[46,42],k1:[37,66],f1:[29,90],k2:[35,66],f2:[27,90]}],
  ['cobra','Cobra',['espalda_baja','cuadriceps'],40,false,
    'Boca abajo, manos bajo los hombros. Empuja suave para levantar el pecho manteniendo la cadera en el piso. Hombros lejos de las orejas.',
    {h:[73,60],s:[66,70],e1:[66,80],w1:[67,90],e2:[64,80],w2:[65,90],p:[44,87],k1:[28,89],f1:[10,89],k2:[27,89],f2:[9,89]}],
  ['esfinge','Esfinge',['espalda_baja'],60,false,
    'Boca abajo, apóyate en los antebrazos con los codos bajo los hombros. Deja que la espalda baja se relaje y el pecho se abra.',
    {h:[71,64],s:[63,75],e1:[63,89],w1:[79,89],e2:[61,89],w2:[77,89],p:[44,87],k1:[28,89],f1:[10,89],k2:[27,89],f2:[9,89]}],
  ['zancada','Zancada baja',['cadera','cuadriceps'],40,true,
    'Rodilla de atrás en el piso y pie de adelante plantado. Lleva la cadera al frente y abajo hasta sentir el frente de la cadera de atrás. Tronco erguido.',
    {h:[49,33],s:[49,43],e1:[56,56],w1:[64,64],e2:[54,56],w2:[62,64],p:[48,69],k1:[68,69],f1:[69,90],k2:[30,89],f2:[13,89]}],
  ['lagartija','Lagartija',['cadera','aductores','isquios'],40,true,
    'Desde la zancada baja, pon ambas manos por dentro del pie de adelante y baja la cadera. Si puedes, apoya los antebrazos.',
    {h:[73,66],s:[63,70],e1:[63,80],w1:[64,90],e2:[61,80],w2:[62,90],p:[46,72],k1:[70,70],f1:[72,90],k2:[29,89],f2:[12,89]}],
  ['paloma','Paloma',['gluteos','cadera'],60,true,
    'Pierna de adelante doblada frente a ti con la espinilla en el piso; pierna de atrás estirada. Cadera cuadrada al frente. Baja el tronco si se siente bien.',
    {h:[53,45],s:[52,56],e1:[56,73],w1:[60,89],e2:[54,73],w2:[58,89],p:[50,82],k1:[67,88],f1:[54,90],k2:[30,89],f2:[11,89]}],
  ['figura4','Figura 4 acostado',['gluteos','cadera'],45,true,
    'Boca arriba, cruza un tobillo sobre la rodilla contraria. Abraza la pierna de abajo y acércala al pecho hasta sentir el glúteo.',
    {h:[15,85],s:[27,87],e1:[42,76],w1:[56,71],e2:[40,77],w2:[54,72],p:[51,87],k1:[67,62],f1:[57,70],k2:[60,66],f2:[74,73]}],
  ['rodillas_pecho','Rodillas al pecho',['espalda_baja','gluteos'],45,false,
    'Boca arriba, abraza ambas rodillas y acércalas al pecho. Puedes mecerte suave de lado a lado.',
    {h:[16,85],s:[28,87],e1:[43,75],w1:[56,67],e2:[41,76],w2:[54,68],p:[53,87],k1:[55,65],f1:[69,69],k2:[53,66],f2:[67,70]}],
  ['torsion','Torsión acostado',['espalda_baja','espalda_alta','pecho'],45,true,
    'Boca arriba con las rodillas dobladas, déjalas caer hacia un lado. Brazos abiertos en cruz y mirada al lado contrario. Hombros en el piso.',
    {h:[16,85],s:[28,87],e1:[24,80],w1:[18,74],e2:[33,80],w2:[38,74],p:[53,87],k1:[69,82],f1:[60,90],k2:[67,85],f2:[58,90]}],
  ['bebe','Bebé feliz',['cadera','aductores','espalda_baja'],45,false,
    'Boca arriba, dobla las rodillas hacia las axilas y toma la parte de afuera de los pies. Deja que las rodillas bajen hacia el piso.',
    {h:[16,85],s:[28,87],e1:[42,70],w1:[59,55],e2:[40,71],w2:[57,56],p:[52,87],k1:[47,66],f1:[62,52],k2:[45,67],f2:[60,53]}],
  ['puente','Puente de glúteo',['cadera','gluteos'],40,false,
    'Boca arriba con rodillas dobladas. Aprieta glúteos y sube la cadera hasta formar una línea de hombros a rodillas. Sostén y baja lento.',
    {h:[15,85],s:[27,87],e1:[37,89],w1:[48,89],e2:[36,89],w2:[47,89],p:[48,71],k1:[64,64],f1:[71,90],k2:[62,65],f2:[69,90]}],
  ['isquio_sentado','Pinza sentado',['isquios','espalda_baja'],60,false,
    'Sentado con las piernas estiradas, inclínate desde la cadera hacia los pies. Espalda larga; llega hasta donde sientas el estiramiento, no hasta tocar.',
    {h:[64,62],s:[56,69],e1:[67,77],w1:[78,83],e2:[65,78],w2:[76,84],p:[32,87],k1:[56,87],f1:[80,84],k2:[55,88],f2:[79,85]}],
  ['isquio_pie','Isquios de pie',['isquios','pantorrillas'],40,true,
    'Talón de adelante en el piso con la punta arriba y rodilla estirada. Dobla la rodilla de atrás y lleva la cadera hacia atrás con la espalda recta.',
    {h:[72,33],s:[64,38],e1:[65,50],w1:[63,61],e2:[63,50],w2:[61,61],p:[45,54],k1:[61,73],f1:[73,88],k2:[42,72],f2:[41,90]}],
  ['pinza_pie','Pinza de pie',['isquios','espalda_baja','pantorrillas'],45,false,
    'De pie, dobla el tronco desde la cadera y deja colgar la cabeza y los brazos. Rodillas suaves; si no llegas abajo, apoya las manos en las espinillas.',
    {h:[61,78],s:[59,66],e1:[61,77],w1:[61,88],e2:[59,77],w2:[59,88],p:[41,48],k1:[46,69],f1:[49,90],k2:[44,69],f2:[47,90]}],
  ['cuadriceps_pie','Cuádriceps de pie',['cuadriceps','cadera'],40,true,
    'De pie sobre una pierna, toma el empeine de la otra y lleva el talón al glúteo. Rodillas juntas y cadera al frente. Apóyate en una pared si lo necesitas.',
    {h:[50,13],s:[50,24],e1:[45,40],w1:[41,58],e2:[59,26],w2:[69,26],p:[50,52],k1:[50,71],f1:[50,90],k2:[52,72],f2:[41,59]}],
  ['pantorrilla','Pantorrilla en pared',['pantorrillas','tobillos'],40,true,
    'Manos en la pared, una pierna atrás estirada con el talón en el piso. Inclínate hacia la pared hasta sentir la pantorrilla de atrás.',
    {h:[64,21],s:[60,31],e1:[70,30],w1:[80,28],e2:[69,32],w2:[79,30],p:[46,56],k1:[56,72],f1:[58,90],k2:[33,72],f2:[21,90],wall:82}],
  ['tobillo','Rodilla a la pared',['tobillos','pantorrillas'],40,true,
    'Medio arrodillado frente a una pared. Lleva la rodilla de adelante hacia la pared sin despegar el talón. Aléjate un poco cuando ya toque fácil.',
    {h:[53,35],s:[52,45],e1:[69,49],w1:[85,51],e2:[68,51],w2:[84,53],p:[52,71],k1:[76,69],f1:[70,90],k2:[35,89],f2:[19,89],wall:88}],
  ['sentadilla','Sentadilla profunda',['tobillos','cadera','aductores'],45,false,
    'Pies a lo ancho de hombros, baja la cadera lo más profundo que puedas con los talones en el piso. Codos por dentro de las rodillas empujándolas hacia afuera.',
    {h:[58,41],s:[54,51],e1:[65,64],w1:[62,57],e2:[63,65],w2:[60,58],p:[44,80],k1:[70,72],f1:[56,90],k2:[68,73],f2:[54,90]}],
  ['mariposa','Mariposa',['aductores','cadera'],60,false,
    'Sentado, junta las plantas de los pies y deja caer las rodillas hacia los lados. Toma los pies y alarga la espalda; inclínate al frente si quieres más.',
    {front:true,h:[50,47],s:[50,58],e1:[39,72],w1:[47,86],e2:[61,72],w2:[53,86],p:[50,86],k1:[27,81],f1:[47,89],k2:[73,81],f2:[53,89]}],
  ['rana','Rana',['aductores','cadera'],45,false,
    'En cuatro puntos, abre las rodillas todo lo cómodo con los tobillos alineados a las rodillas. Baja a los antebrazos y lleva la cadera atrás.',
    {front:true,h:[50,62],s:[50,70],e1:[41,85],w1:[45,90],e2:[59,85],w2:[55,90],p:[50,74],k1:[24,86],f1:[19,90],k2:[76,86],f2:[81,90]}],
  ['cosaco','Zancada lateral',['aductores','cadera','tobillos'],30,true,
    'Pies muy separados. Baja hacia un lado doblando esa rodilla y deja la otra pierna estirada con la punta arriba. Talón de la pierna doblada en el piso.',
    {front:true,h:[43,29],s:[43,40],e1:[40,52],w1:[46,57],e2:[52,52],w2:[46,57],p:[44,66],k1:[27,73],f1:[23,90],k2:[62,78],f2:[81,89]}],
  ['p9090','90/90',['cadera','gluteos'],45,true,
    'Sentado con una pierna doblada al frente y la otra doblada atrás, ambas a 90°. Pecho alto e inclínate sobre la pierna de adelante.',
    {h:[52,47],s:[51,58],e1:[45,73],w1:[41,88],e2:[57,73],w2:[61,88],p:[49,86],k1:[69,89],f1:[57,90],k2:[33,89],f2:[25,81]}],
  ['hilo_aguja','Hilo en la aguja',['espalda_alta','hombros'],40,true,
    'En cuatro puntos, pasa un brazo por debajo del otro y baja el hombro y la sien al piso. El brazo de apoyo puede estirarse al frente.',
    {h:[74,85],s:[66,81],e1:[60,86],w1:[51,89],e2:[78,84],w2:[90,88],p:[38,67],k1:[38,89],f1:[18,90],k2:[36,89],f2:[16,90]}],
  ['rotacion','Rotación torácica',['espalda_alta','pecho'],30,true,
    'En cuatro puntos, pon una mano detrás de la cabeza o estírala. Gira abriendo el codo hacia el techo y sigue la mano con la mirada. Regresa lento.',
    {h:[77,61],s:[70,67],e1:[67,53],w1:[63,40],e2:[70,79],w2:[70,90],p:[38,67],k1:[38,89],f1:[18,90],k2:[36,89],f2:[16,90]}],
  ['marco','Pecho en el marco',['pecho','hombros'],40,true,
    'Antebrazo apoyado en el marco de una puerta con el codo a la altura del hombro. Da un paso al frente y gira el pecho hacia afuera hasta sentir el pecho.',
    {h:[57,13],s:[54,24],e1:[39,25],w1:[38,12],e2:[57,37],w2:[59,49],p:[51,52],k1:[56,71],f1:[59,90],k2:[46,71],f2:[42,90],wall:35}],
  ['banco','Dorsales en banco',['dorsales','hombros','espalda_alta'],45,false,
    'De rodillas frente a un banco o silla, apoya los codos y deja caer el pecho hacia el piso. Manos juntas detrás de la cabeza.',
    {h:[70,75],s:[62,70],e1:[79,58],w1:[74,46],e2:[77,59],w2:[72,47],p:[34,66],k1:[34,89],f1:[14,90],k2:[32,89],f2:[12,90],bench:true}],
  ['cruzado','Hombro cruzado',['hombros','dorsales'],30,true,
    'Lleva un brazo estirado frente al pecho y presiónalo con la otra mano por encima del codo. Hombro abajo, lejos de la oreja.',
    {front:true,h:[50,13],s:[50,24],e1:[54,27],w1:[68,25],e2:[64,36],w2:[56,27],p:[50,52],k1:[45,71],f1:[45,90],k2:[55,71],f2:[55,90]}],
  ['triceps','Tríceps sobre la cabeza',['hombros','dorsales'],30,true,
    'Sube un brazo, dobla el codo y deja caer la mano entre los omóplatos. Con la otra mano empuja el codo suave hacia atrás.',
    {front:true,h:[50,13],s:[50,24],e1:[45,5],w1:[52,15],e2:[61,10],w2:[47,6],p:[50,52],k1:[45,71],f1:[45,90],k2:[55,71],f2:[55,90]}],
  ['lateral','Flexión lateral de pie',['dorsales','espalda_baja'],30,true,
    'De pie, sube un brazo por encima de la cabeza e inclínate hacia el lado contrario. Cadera quieta, siente todo el costado.',
    {front:true,h:[39,16],s:[43,26],e1:[45,10],w1:[33,4],e2:[35,40],w2:[31,52],p:[50,52],k1:[47,71],f1:[46,90],k2:[54,71],f2:[55,90]}],
  ['brazos_arriba','Alcance arriba',['hombros','dorsales','espalda_alta'],30,false,
    'De pie, entrelaza los dedos y estira los brazos hacia el techo. Crece hacia arriba sin arquear la espalda baja.',
    {front:true,h:[50,14],s:[50,25],e1:[45,11],w1:[48,0],e2:[55,11],w2:[52,0],p:[50,52],k1:[46,71],f1:[46,90],k2:[54,71],f2:[54,90]}],
  ['cuello_lateral','Cuello lateral',['cuello'],30,true,
    'Sentado o de pie, inclina la oreja hacia el hombro. Con la mano del mismo lado ayuda suave y deja el otro hombro caer.',
    {front:true,h:[43,15],s:[50,25],e1:[36,16],w1:[41,7],e2:[61,38],w2:[63,50],p:[50,52],k1:[46,71],f1:[46,90],k2:[54,71],f2:[54,90]}],
  ['cuello_flexion','Barbilla al pecho',['cuello','espalda_alta'],30,false,
    'Entrelaza las manos detrás de la cabeza y deja que su peso lleve la barbilla al pecho. Codos relajados hacia abajo.',
    {h:[56,21],s:[50,26],e1:[60,30],w1:[55,15],e2:[58,31],w2:[54,16],p:[50,52],k1:[51,71],f1:[51,90],k2:[49,71],f2:[49,90]}],
  ['munecas','Muñecas',['munecas'],30,false,
    'De rodillas, apoya las manos en el piso con los dedos hacia tus rodillas. Lleva el peso atrás poco a poco con los codos estirados.',
    {h:[69,51],s:[62,59],e1:[63,74],w1:[64,90],e2:[61,74],w2:[62,90],p:[40,64],k1:[40,89],f1:[20,90],k2:[38,89],f2:[18,90]}],
  ['circulos','Círculos de cadera',['cadera','gluteos'],30,true,
    'En cuatro puntos, levanta una rodilla y dibuja círculos grandes con ella: al frente, al lado y atrás. Mantén el tronco quieto.',
    {h:[79,73],s:[70,67],e1:[70,79],w1:[70,90],e2:[68,79],w2:[68,90],p:[38,67],k1:[47,73],f1:[30,71],k2:[36,89],f2:[16,90]}],
];

/* figura SVG de una postura */
function poseSvg(fig, opt = {}){
  const sz = opt.size || 120, near = opt.near || 'var(--acc)', far = opt.far || 'var(--mut-2)';
  const F = fig, P = (a) => a.join(' ');
  const off = (pt, dx) => [pt[0] + dx, pt[1]];
  const sA = F.front ? [off(F.s, -7), off(F.s, 7)] : [F.s, F.s];
  const pA = F.front ? [off(F.p, -5), off(F.p, 5)] : [F.p, F.p];
  const limb = (a, b, c, col, w) => `<polyline points="${P(a)} ${P(b)} ${P(c)}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  // el cuello va del hombro hacia la cabeza, sin llegar al centro
  const dx = F.h[0] - F.s[0], dy = F.h[1] - F.s[1], L = Math.hypot(dx, dy) || 1, r = 5.4;
  const neck = [F.h[0] - dx/L*r, F.h[1] - dy/L*r];
  const torso = F.arc ? `<path d="M${P(F.s)} Q${(F.s[0]+F.p[0])/2} ${(F.s[1]+F.p[1])/2 + F.arc} ${P(F.p)}" stroke="${near}" stroke-width="5.2" fill="none" stroke-linecap="round"/>`
    : F.front ? `<polyline points="${P(sA[0])} ${P(sA[1])} ${P(pA[1])} ${P(pA[0])} ${P(sA[0])}" stroke="${near}" stroke-width="4" fill="${near}" fill-opacity=".18" stroke-linejoin="round"/>`
    : `<line x1="${F.s[0]}" y1="${F.s[1]}" x2="${F.p[0]}" y2="${F.p[1]}" stroke="${near}" stroke-width="5.2" stroke-linecap="round"/>`;
  return `<svg viewBox="-4 -4 108 100" width="${sz}" height="${sz*100/108}" class="pose" aria-hidden="true" style="flex:none">
    <line x1="-2" x2="102" y1="92.5" y2="92.5" stroke="var(--line)" stroke-width="1.5"/>
    ${F.wall ? `<line x1="${F.wall}" x2="${F.wall}" y1="-2" y2="92" stroke="var(--line)" stroke-width="2.5"/>` : ''}
    ${F.bench ? `<rect x="73" y="60" width="26" height="32" rx="2" fill="none" stroke="var(--line)" stroke-width="2"/>` : ''}
    ${F.front ? '' : limb(F.s, F.e2, F.w2, far, 4.2) + limb(F.p, F.k2, F.f2, far, 4.6)}
    ${torso}
    ${F.front ? limb(sA[0], F.e1, F.w1, near, 4.2) + limb(sA[1], F.e2, F.w2, near, 4.2) + limb(pA[0], F.k1, F.f1, near, 4.6) + limb(pA[1], F.k2, F.f2, near, 4.6)
      : limb(F.p, F.k1, F.f1, near, 4.8) + limb(F.s, F.e1, F.w1, near, 4.4)}
    <line x1="${F.s[0]}" y1="${F.s[1]}" x2="${neck[0].toFixed(1)}" y2="${neck[1].toFixed(1)}" stroke="${near}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="${F.h[0]}" cy="${F.h[1]}" r="${r}" fill="${near}"/>
  </svg>`;
}
