
import { OsmElement, GeoLocation, TerrainGrid, ProjectionType, TerrainPoint } from '../../types';
import { LAYERS, ROAD_WIDTHS } from '../constants';

// --- Math & Geometry Utils ---

const distance = (p1: {x:number, y:number}, p2: {x:number, y:number}) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

const getCentroid = (points: {x:number, y:number}[]) => {
    let x = 0, y = 0;
    points.forEach(p => { x += p.x; y += p.y; });
    return { x: x / points.length, y: y / points.length };
};

const getElevationAt = (x: number, y: number, terrain: TerrainGrid | undefined, center: GeoLocation, projection: string, zone?: number): number => {
    if (!terrain || terrain.length === 0) return 0;
    // Simplificado: Busca o ponto mais próximo na malha
    let minD = Infinity;
    let elev = 0;
    const flat = terrain.flat();
    for (const p of flat) {
        const pt = project(p.lat, p.lng, center, projection as any, zone);
        const d = distance({x, y}, pt);
        if (d < minD) {
            minD = d;
            elev = p.elevation;
        }
    }
    return elev;
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

const generateRoadCurb = (points: {x:number, y:number}[], width: number, layer: string): string => {
    let s = '';
    const offset = width / 2;
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i+1];
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const perp = angle + Math.PI / 2;
        
        const L1 = { x: p1.x + Math.cos(perp) * offset, y: p1.y + Math.sin(perp) * offset };
        const L2 = { x: p2.x + Math.cos(perp) * offset, y: p2.y + Math.sin(perp) * offset };
        const R1 = { x: p1.x - Math.cos(perp) * offset, y: p1.y - Math.sin(perp) * offset };
        const R2 = { x: p2.x - Math.cos(perp) * offset, y: p2.y - Math.sin(perp) * offset };
        
        s += `0\nLINE\n8\n${layer}\n10\n${L1.x}\n20\n${L1.y}\n11\n${L2.x}\n21\n${L2.y}\n`;
        s += `0\nLINE\n8\n${layer}\n10\n${R1.x}\n20\n${R1.y}\n11\n${R2.x}\n21\n${R2.y}\n`;
    }
    return s;
};

const generateCrosswalk = (centerPt: {x:number, y:number}, angle: number, roadWidth: number): string => {
    let s = '';
    const stripeCount = 6;
    const stripeWidth = 0.5;
    const stripeLen = 4.0;
    const perp = angle + Math.PI / 2;
    
    for (let i = -stripeCount/2; i < stripeCount/2; i++) {
        const shift = i * 0.8;
        const stripeCenter = {
            x: centerPt.x + Math.cos(perp) * shift,
            y: centerPt.y + Math.sin(perp) * shift
        };
        const p1 = { x: stripeCenter.x + Math.cos(angle) * (stripeLen/2), y: stripeCenter.y + Math.sin(angle) * (stripeLen/2) };
        const p2 = { x: stripeCenter.x - Math.cos(angle) * (stripeLen/2), y: stripeCenter.y - Math.sin(angle) * (stripeLen/2) };
        s += `0\nLINE\n8\n${LAYERS.ROADS_CROSSWALK.name}\n10\n${p1.x}\n20\n${p1.y}\n11\n${p2.x}\n21\n${p2.y}\n`;
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

  const config = { projection: 'local', stationInterval: 20, extrudeBuildings: true, ...options };
  const forcedZone = config.projection === 'utm' ? latLonToUTM(center.lat, center.lng).zone : undefined;
  let entities = `0\nSECTION\n2\nENTITIES\n`;

  const total = elements.length;
  for (let index = 0; index < total; index++) {
    const el = elements[index];
    if (index % 100 === 0) {
        if (onProgress) onProgress(70 + (index / total) * 30, "Gerando infraestrutura detalhada...");
        await new Promise(r => setTimeout(r, 0));
    }

    if (el.type === 'way' && el.geometry && el.tags) {
        const projected = el.geometry.map(p => project(p.lat, p.lon, center, config.projection, forcedZone));
        
        // 1. Edificações integradas ao terreno
        if (el.tags.building && config.extrudeBuildings) {
            const centerPt = getCentroid(projected);
            const baseElev = getElevationAt(centerPt.x, centerPt.y, terrain, center, config.projection, forcedZone);
            const height = parseFloat(el.tags.height || (el.tags['building:levels'] ? (parseFloat(el.tags['building:levels']) * 3.2).toString() : '3.5'));
            
            const wallLayer = el.tags.amenity === 'school' || el.tags.building === 'hospital' ? LAYERS.BLD_PUBLIC.name : LAYERS.BLD_WALLS.name;

            for (let i = 0; i < projected.length - 1; i++) {
                entities += generate3DFace(
                    { ...projected[i], z: baseElev },
                    { ...projected[i+1], z: baseElev },
                    { ...projected[i+1], z: baseElev + height },
                    { ...projected[i], z: baseElev + height },
                    wallLayer
                );
            }
            // Cobertura
            if (projected.length <= 5) {
                entities += generate3DFace(
                    { ...projected[0], z: baseElev + height },
                    { ...projected[1], z: baseElev + height },
                    { ...projected[2], z: baseElev + height },
                    { ...projected[3] ? { ...projected[3], z: baseElev + height } : { ...projected[0], z: baseElev + height } },
                    LAYERS.BLD_ROOF.name
                );
            }
        }

        // 2. Vias com Guias e Sarjetas
        if (el.tags.highway) {
            const width = ROAD_WIDTHS[el.tags.highway] || 6;
            entities += generateRoadCurb(projected, width, LAYERS.ROADS_CURBS.name);
            
            // Faixas de Pedestre em cruzamentos
            if (el.tags.highway === 'footway' && el.tags.footway === 'crossing') {
                const mid = Math.floor(projected.length / 2);
                const angle = Math.atan2(projected[mid+1]?.y - projected[mid]?.y || 0, projected[mid+1]?.x - projected[mid]?.x || 1);
                entities += generateCrosswalk(projected[mid], angle, 10);
            }
        }
    }
  }

  // Header & Tables
  const header = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n`;
  const tables = `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${Object.keys(LAYERS).length}\n` + 
                 Object.values(LAYERS).map(l => `0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS\n`).join('') + 
                 `0\nENDTAB\n0\nENDSEC\n`;

  return `${header}${tables}${entities}0\nENDSEC\n0\nEOF\n`;
};
