
import { OsmElement, GeoLocation, TerrainGrid, ProjectionType, LayerConfig } from '../../types';
import { LAYERS, ROAD_WIDTHS } from '../constants';

// --- Math & Geometry Helpers ---

const distance = (p1: {x:number, y:number}, p2: {x:number, y:number}) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

const getAngle = (p1: {x:number, y:number}, p2: {x:number, y:number}) => {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
};

// --- Projection Logic ---

const toRadians = (deg: number) => deg * Math.PI / 180;

const latLonToUTM = (lat: number, lon: number, forceZone?: number) => {
  const a = 6378137.0; 
  const f = 1 / 298.257223563; 
  const k0 = 0.9996; 
  const phi = toRadians(lat);
  const lambda = toRadians(lon);
  const zoneNumber = forceZone || (Math.floor((lon + 180) / 6) + 1);
  const lambda0 = toRadians(((zoneNumber - 1) * 6 - 180) + 3); 
  const e = Math.sqrt(f * (2 - f)); 
  const e2 = e * e;
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) * Math.sin(phi));
  const T = Math.tan(phi) * Math.tan(phi);
  const C = (e2 / (1 - e2)) * Math.cos(phi) * Math.cos(phi);
  const A = (lambda - lambda0) * Math.cos(phi);
  const M = a * ((1 - e2 / 4) * phi - (3 * e2 / 8) * Math.sin(2 * phi) + (15 * Math.pow(e,4) / 256) * Math.sin(4 * phi));
  const x = 500000 + k0 * N * (A + (1 - T + C) * Math.pow(A, 3) / 6 + (5 - 18 * T + Math.pow(T, 2)) * Math.pow(A, 5) / 120);
  const y = k0 * (M + N * Math.tan(phi) * (Math.pow(A, 2) / 2 + (5 - T + 9 * C + 4 * Math.pow(C, 2)) * Math.pow(A, 4) / 24));
  return { x, y: lat < 0 ? y + 10000000 : y, zone: zoneNumber };
};

const project = (lat: number, lon: number, center: GeoLocation, type: ProjectionType, forceZone?: number) => {
  if (type === 'utm') return latLonToUTM(lat, lon, forceZone);
  const R = 6378137; 
  const dLat = (lat - center.lat) * (Math.PI / 180);
  const dLon = (lon - center.lng) * (Math.PI / 180);
  const latRad = center.lat * (Math.PI / 180);
  return { x: R * dLon * Math.cos(latRad), y: R * dLat };
};

// --- Entities Generators ---

const generate3DFace = (p1: any, p2: any, p3: any, p4: any, layer: string) => {
    return `0\n3DFACE\n8\n${layer}\n10\n${p1.x}\n20\n${p1.y}\n30\n${p1.z}\n11\n${p2.x}\n21\n${p2.y}\n31\n${p2.z}\n12\n${p3.x}\n22\n${p3.y}\n32\n${p3.z}\n13\n${p4.x}\n23\n${p4.y}\n33\n${p4.z}\n`;
};

const generateDimension = (p1: {x:number, y:number}, p2: {x:number, y:number}, z: number = 0) => {
    const dist = distance(p1, p2);
    if (dist < 1.0) return ''; // Ignora segmentos muito pequenos
    const angle = getAngle(p1, p2);
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const offset = 0.5; // Distância da parede
    const tx = midX + Math.cos(angle + Math.PI/2) * offset;
    const ty = midY + Math.sin(angle + Math.PI/2) * offset;
    return `0\nTEXT\n8\n${LAYERS.DIMENSIONS.name}\n10\n${tx}\n20\n${ty}\n30\n${z}\n40\n0.35\n50\n${(angle * 180 / Math.PI)}\n1\n${dist.toFixed(2)}m\n`;
};

const generateGrid = (projectedBounds: {minX: number, maxX: number, minY: number, maxY: number}, interval: number = 50) => {
    let s = '';
    const layer = LAYERS.GRID.name;
    const startX = Math.floor(projectedBounds.minX / interval) * interval;
    const startY = Math.floor(projectedBounds.minY / interval) * interval;

    for (let x = startX; x <= projectedBounds.maxX; x += interval) {
        s += `0\nLINE\n8\n${layer}\n10\n${x}\n20\n${projectedBounds.minY}\n11\n${x}\n21\n${projectedBounds.maxY}\n`;
        s += `0\nTEXT\n8\n${layer}\n10\n${x + 1}\n20\n${projectedBounds.minY + 1}\n40\n1.5\n1\nE:${x.toFixed(0)}\n`;
    }
    for (let y = startY; y <= projectedBounds.maxY; y += interval) {
        s += `0\nLINE\n8\n${layer}\n10\n${projectedBounds.minX}\n20\n${y}\n11\n${projectedBounds.maxX}\n21\n${y}\n`;
        s += `0\nTEXT\n8\n${layer}\n10\n${projectedBounds.minX + 1}\n20\n${y + 1}\n40\n1.5\n1\nN:${y.toFixed(0)}\n`;
    }
    return s;
};

const generateFlowArrow = (p: {x:number, y:number, z:number}, angle: number, layer: string) => {
    const len = 1.5;
    const p2 = { x: p.x + Math.cos(angle) * len, y: p.y + Math.sin(angle) * len };
    const a1 = angle + Math.PI + 0.4;
    const a2 = angle + Math.PI - 0.4;
    const head1 = { x: p2.x + Math.cos(a1) * 0.4, y: p2.y + Math.sin(a1) * 0.4 };
    const head2 = { x: p2.x + Math.cos(a2) * 0.4, y: p2.y + Math.sin(a2) * 0.4 };
    
    return `0\nLINE\n8\n${layer}\n10\n${p.x}\n20\n${p.y}\n30\n${p.z}\n11\n${p2.x}\n21\n${p2.y}\n31\n${p.z}\n` +
           `0\nLINE\n8\n${layer}\n10\n${p2.x}\n20\n${p2.y}\n30\n${p.z}\n11\n${head1.x}\n21\n${head1.y}\n31\n${p.z}\n` +
           `0\nLINE\n8\n${layer}\n10\n${p2.x}\n20\n${p2.y}\n30\n${p.z}\n11\n${head2.x}\n21\n${head2.y}\n31\n${p.z}\n`;
};

// --- Main Service ---

export const generateDXF = async (
  elements: OsmElement[], 
  center: GeoLocation, 
  terrain: TerrainGrid | undefined, 
  options: any = {},
  onProgress?: (progress: number, message: string) => void
): Promise<string> => {

  const config = { projection: 'local', stationInterval: 20, ...options };
  const forcedZone = config.projection === 'utm' ? latLonToUTM(center.lat, center.lng).zone : undefined;
  let entities = `0\nSECTION\n2\nENTITIES\n`;

  // 1. Cálculo de Bounds para o Grid
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  const total = elements.length;
  for (let index = 0; index < total; index++) {
    const el = elements[index];
    if (index % 200 === 0) {
        if (onProgress) onProgress(70 + (index / total) * 20, "Processando geometria BIM e cotagem...");
        await new Promise(r => setTimeout(r, 0));
    }

    if (el.type === 'way' && el.geometry && el.tags) {
        const projected = el.geometry.map(p => {
            const pt = project(p.lat, p.lon, center, config.projection, forcedZone);
            if (pt.x < minX) minX = pt.x; if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y; if (pt.y > maxY) maxY = pt.y;
            return pt;
        });
        
        // Cotagem e 3D de Edifícios
        if (el.tags.building) {
            const height = parseFloat(el.tags.height || (el.tags['building:levels'] ? (parseFloat(el.tags['building:levels']) * 3.2).toString() : '3.5'));
            for (let i = 0; i < projected.length - 1; i++) {
                // Cotagem Automática
                if (options.layers?.dimensions) {
                    entities += generateDimension(projected[i], projected[i+1], height);
                }
                // Paredes 3D
                entities += generate3DFace(
                    { ...projected[i], z: 0 },
                    { ...projected[i+1], z: 0 },
                    { ...projected[i+1], z: height },
                    { ...projected[i], z: height },
                    LAYERS.BLD_WALLS.name
                );
            }
        }
        
        // Vias (Simplificado para esta etapa)
        if (el.tags.highway && options.layers?.roads) {
            entities += `0\nLWPOLYLINE\n8\n${LAYERS.ROADS_CENTER.name}\n90\n${projected.length}\n70\n0\n` +
                        projected.map(p => `10\n${p.x}\n20\n${p.y}\n`).join('');
        }
    }

    // Inserção de Equipamentos Urbanos
    if (el.type === 'node' && el.tags) {
        const pt = project(el.lat, el.lon, center, config.projection, forcedZone);
        if (el.tags.emergency === 'fire_hydrant') {
            entities += `0\nINSERT\n2\nHYDRANT_BLOCK\n8\n${LAYERS.URBAN_EQUIPMENT.name}\n10\n${pt.x}\n20\n${pt.y}\n30\n0\n`;
        }
    }
  }

  // 2. Grid de Coordenadas
  if (options.layers?.grid) {
      entities += generateGrid({minX: minX-10, maxX: maxX+10, minY: minY-10, maxY: maxY+10}, 50);
  }

  // 3. Análise de Fluxo de Terreno
  if (terrain && options.layers?.terrain) {
      if (onProgress) onProgress(95, "Calculando vetores de escoamento...");
      for (let i = 0; i < terrain.length - 1; i++) {
          for (let j = 0; j < terrain[i].length - 1; j++) {
              const p = terrain[i][j];
              const pRight = terrain[i][j+1];
              const pDown = terrain[i+1][j];
              const dzdx = (pRight.elevation - p.elevation);
              const dzdy = (pDown.elevation - p.elevation);
              const angle = Math.atan2(-dzdy, -dzdx); // Direção da descida
              if (Math.abs(dzdx) > 0.1 || Math.abs(dzdy) > 0.1) {
                  const projP = project(p.lat, p.lng, center, config.projection, forcedZone);
                  entities += generateFlowArrow({ ...projP, z: p.elevation }, angle, LAYERS.INFRA_FLOW_DIR.name);
              }
          }
      }
  }

  // Finalização do Arquivo
  const header = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n`;
  const tables = `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${Object.keys(LAYERS).length}\n` + 
                 Object.values(LAYERS).map(l => `0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS\n`).join('') + 
                 `0\nENDTAB\n0\nENDSEC\n`;
  
  const blocks = `0\nSECTION\n2\nBLOCKS\n` +
                 `0\nBLOCK\n8\n0\n2\nHYDRANT_BLOCK\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n0\nCIRCLE\n8\n0\n10\n0.0\n20\n0.0\n40\n0.3\n0\nLINE\n8\n0\n10\n-0.3\n20\n-0.3\n11\n0.3\n21\n0.3\n0\nENDBLK\n` +
                 `0\nENDSEC\n`;

  return `${header}${tables}${blocks}${entities}0\nENDSEC\n0\nEOF\n`;
};
