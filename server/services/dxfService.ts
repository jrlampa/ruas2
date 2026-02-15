
import { OsmElement, GeoLocation, TerrainGrid, ProjectionType, LayerConfig } from '../../types';
import { LAYERS, ROAD_WIDTHS } from '../constants';

// --- Math & Geometry Helpers ---

const distance = (p1: {x:number, y:number}, p2: {x:number, y:number}) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

const getAngle = (p1: {x:number, y:number}, p2: {x:number, y:number}) => {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
};

const interpolatePoint = (p1: {x:number, y:number}, p2: {x:number, y:number}, d: number) => {
    const totalDist = distance(p1, p2);
    const t = d / totalDist;
    return {
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t
    };
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

/**
 * Adiciona Metadados OSM como XData (Extended Data)
 * Código 1001 define a App, 1000 são strings.
 */
const generateXData = (tags: Record<string, string>) => {
    let s = `1001\nOSM_ATTRIBUTES\n`;
    Object.entries(tags).forEach(([k, v]) => {
        const cleanV = v.toString().replace(/\n/g, ' ');
        s += `1000\n${k}=${cleanV}\n`;
    });
    return s;
};

const generate3DFace = (p1: any, p2: any, p3: any, p4: any, layer: string, tags?: Record<string, string>) => {
    let s = `0\n3DFACE\n8\n${layer}\n10\n${p1.x}\n20\n${p1.y}\n30\n${p1.z}\n11\n${p2.x}\n21\n${p2.y}\n31\n${p2.z}\n12\n${p3.x}\n22\n${p3.y}\n32\n${p3.z}\n13\n${p4.x}\n23\n${p4.y}\n33\n${p4.z}\n`;
    if (tags) s += generateXData(tags);
    return s;
};

/**
 * Gera estaqueamento (marks a cada 20m) ao longo de uma via.
 */
const generateStationing = (points: {x:number, y:number}[], interval: number = 20) => {
    let s = '';
    let accumulatedDist = 0;
    let nextStationDist = 0;
    const layer = LAYERS.ROADS_STATIONING.name;

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i+1];
        const segDist = distance(p1, p2);
        const angle = getAngle(p1, p2);
        const perp = angle + Math.PI / 2;

        while (nextStationDist <= accumulatedDist + segDist) {
            const distInSeg = nextStationDist - accumulatedDist;
            const pt = interpolatePoint(p1, p2, distInSeg);
            const tickLen = 1.0;
            const t1 = { x: pt.x + Math.cos(perp) * tickLen, y: pt.y + Math.sin(perp) * tickLen };
            const t2 = { x: pt.x - Math.cos(perp) * tickLen, y: pt.y - Math.sin(perp) * tickLen };
            
            // Desenha o Tick (traço da estaca)
            s += `0\nLINE\n8\n${layer}\n10\n${t1.x}\n20\n${t1.y}\n11\n${t2.x}\n21\n${t2.y}\n`;
            
            // Texto da Estaca (ex: 0+020)
            const km = Math.floor(nextStationDist / 1000);
            const m = nextStationDist % 1000;
            const label = `${km}+${m.toString().padStart(3, '0')}`;
            s += `0\nTEXT\n8\n${layer}\n10\n${t1.x + 0.5}\n20\n${t1.y + 0.5}\n40\n0.5\n50\n${angle * 180 / Math.PI}\n1\n${label}\n`;
            
            nextStationDist += interval;
        }
        accumulatedDist += segDist;
    }
    return s;
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

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const total = elements.length;

  for (let index = 0; index < total; index++) {
    const el = elements[index];
    if (index % 250 === 0) {
        if (onProgress) onProgress(70 + (index / total) * 20, "Modelando infraestrutura inteligente...");
        await new Promise(r => setTimeout(r, 0));
    }

    if (el.type === 'way' && el.geometry && el.tags) {
        const projected = el.geometry.map(p => {
            const pt = project(p.lat, p.lon, center, config.projection, forcedZone);
            if (pt.x < minX) minX = pt.x; if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y; if (pt.y > maxY) maxY = pt.y;
            return pt;
        });
        
        // 1. Edificações com XData
        if (el.tags.building) {
            const height = parseFloat(el.tags.height || (el.tags['building:levels'] ? (parseFloat(el.tags['building:levels']) * 3.2).toString() : '3.5'));
            for (let i = 0; i < projected.length - 1; i++) {
                entities += generate3DFace(
                    { ...projected[i], z: 0 },
                    { ...projected[i+1], z: 0 },
                    { ...projected[i+1], z: height },
                    { ...projected[i], z: height },
                    LAYERS.BLD_WALLS.name,
                    el.tags // Adiciona metadados à face
                );
            }
        }
        
        // 2. Vias com Estaqueamento Automático
        if (el.tags.highway && options.layers?.roads) {
            // Eixo da Via
            entities += `0\nLWPOLYLINE\n8\n${LAYERS.ROADS_CENTER.name}\n90\n${projected.length}\n70\n0\n` +
                        projected.map(p => `10\n${p.x}\n20\n${p.y}\n`).join('');
            
            // Se for via principal, gera estacas a cada 20m
            if (['primary', 'secondary', 'tertiary', 'trunk'].includes(el.tags.highway)) {
                entities += generateStationing(projected, config.stationInterval);
            }
        }
    }

    // 3. Blocos Simbólicos (Mobiliário/Vegetação)
    if (el.type === 'node' && el.tags) {
        const pt = project(el.lat, el.lon, center, config.projection, forcedZone);
        let blockName = '';
        let layer = LAYERS.DEFAULT.name;

        if (el.tags.natural === 'tree') {
            blockName = 'TREE_BLOCK';
            layer = LAYERS.VEGETATION_TREE.name;
        } else if (el.tags.highway === 'traffic_signals') {
            blockName = 'SIGNAL_BLOCK';
            layer = LAYERS.SIGNALS.name;
        } else if (el.tags.emergency === 'fire_hydrant') {
            blockName = 'HYDRANT_BLOCK';
            layer = LAYERS.URBAN_EQUIPMENT.name;
        } else if (el.tags.man_made === 'utility_pole' || el.tags.power === 'pole') {
            blockName = 'POLE_BLOCK';
            layer = LAYERS.INFRA_POWER_POLES.name;
        }

        if (blockName) {
            entities += `0\nINSERT\n2\n${blockName}\n8\n${layer}\n10\n${pt.x}\n20\n${pt.y}\n30\n0\n`;
            entities += generateXData(el.tags);
        }
    }
  }

  // Finalização: Seções de Header, Tabelas e Definição de Blocos
  const header = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n`;
  const tables = `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${Object.keys(LAYERS).length}\n` + 
                 Object.values(LAYERS).map(l => `0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS\n`).join('') + 
                 `0\nENDTAB\n0\nENDSEC\n`;
  
  const blocks = `0\nSECTION\n2\nBLOCKS\n` +
                 // HYDRANT
                 `0\nBLOCK\n8\n0\n2\nHYDRANT_BLOCK\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n0\nCIRCLE\n8\n0\n10\n0.0\n20\n0.0\n40\n0.4\n0\nLINE\n8\n0\n10\n-0.4\n20\n-0.4\n11\n0.4\n21\n0.4\n0\nENDBLK\n` +
                 // TREE
                 `0\nBLOCK\n8\n0\n2\nTREE_BLOCK\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n0\nCIRCLE\n8\n0\n10\n0.0\n20\n0.0\n40\n1.2\n0\nLINE\n8\n0\n10\n0\n20\n-1.2\n11\n0\n21\n1.2\n0\nLINE\n8\n0\n10\n-1.2\n20\n0\n11\n1.2\n21\n0\n0\nENDBLK\n` +
                 // POLE
                 `0\nBLOCK\n8\n0\n2\nPOLE_BLOCK\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n0\nCIRCLE\n8\n0\n10\n0.0\n20\n0.0\n40\n0.15\n0\nLWPOLYLINE\n8\n0\n90\n4\n70\n1\n10\n-0.2\n20\n-0.2\n10\n0.2\n20\n-0.2\n10\n0.2\n20\n0.2\n10\n-0.2\n20\n0.2\n0\nENDBLK\n` +
                 // SIGNAL
                 `0\nBLOCK\n8\n0\n2\nSIGNAL_BLOCK\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n0\nCIRCLE\n8\n0\n10\n0.0\n20\n0.0\n40\n0.3\n0\nCIRCLE\n8\n0\n10\n0.0\n20\n0.0\n40\n0.5\n0\nENDBLK\n` +
                 `0\nENDSEC\n`;

  return `${header}${tables}${blocks}${entities}0\nENDSEC\n0\nEOF\n`;
};
