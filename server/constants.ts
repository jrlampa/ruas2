
export const LAYERS = {
  BUILDINGS: { name: 'BUILDINGS', color: 2 },
  BLD_WALLS: { name: 'BLD_WALLS', color: 9 }, // Grey for vertical faces
  BLD_ROOF: { name: 'BLD_ROOF', color: 2 }, // Yellow for top face
  
  // Zoning colors
  BLD_RESIDENTIAL: { name: 'BLD_RESIDENTIAL', color: 2 }, // Yellow
  BLD_COMMERCIAL: { name: 'BLD_COMMERCIAL', color: 4 }, // Cyan
  BLD_INDUSTRIAL: { name: 'BLD_INDUSTRIAL', color: 30 }, // Orange
  BLD_PUBLIC: { name: 'BLD_PUBLIC', color: 3 }, // Green
  
  ROADS_CENTER: { name: 'ROADS_CENTER', color: 1 },
  ROADS_STATIONING: { name: 'ROADS_STATIONING', color: 7 }, // White for ticks/text
  ROADS_CURBS: { name: 'ROADS_CURBS', color: 8 }, // Dark Grey for curbs
  ROADS_SIDEWALKS: { name: 'ROADS_SIDEWALKS', color: 253 }, // Very Light Grey
  ROADS_MAJOR: { name: 'ROADS_MAJOR', color: 1 },
  ROADS_MINOR: { name: 'ROADS_MINOR', color: 7 },
  ROADS_SERVICE: { name: 'ROADS_SERVICE', color: 252 },
  ROADS_CROSSWALK: { name: 'ROADS_CROSSWALK', color: 7 }, // White for zebra stripes
  
  SIGNALS: { name: 'SIGNALS', color: 1 },
  FURNITURE: { name: 'FURNITURE', color: 34 },
  URBAN_EQUIPMENT: { name: 'URBAN_EQUIPMENT', color: 4 }, 
  
  // Utilities
  INFRA_WATER: { name: 'INFRA_WATER', color: 5 },
  INFRA_SEWER: { name: 'INFRA_SEWER', color: 30 },
  INFRA_SEWER_MH: { name: 'INFRA_SEWER_MH', color: 30 },
  INFRA_FLOW_DIR: { name: 'INFRA_FLOW_DIR', color: 8 },
  
  // Electrical
  INFRA_POWER_MT: { name: 'INFRA_POWER_MT', color: 10 },
  INFRA_POWER_BT: { name: 'INFRA_POWER_BT', color: 50 },
  INFRA_POWER_POLES: { name: 'INFRA_POWER_POLES', color: 7 },
  INFRA_POWER_CABLES: { name: 'INFRA_POWER_CABLES', color: 8 }, 
  
  // Landscape
  VEGETATION_TREE: { name: 'VEGETATION_TREE', color: 3 },
  VEGETATION_GRASS: { name: 'VEGETATION_GRASS', color: 112 },
  
  TERRAIN: { name: 'TERRAIN', color: 9 },
  CONTOURS: { name: 'CONTOURS', color: 8 },
  
  LABELS: { name: 'LABELS', color: 7 },
  METADATA: { name: 'DATA_ATTRIBUTES', color: 253 },
  DEFAULT: { name: '0', color: 7 }
};

export const ROAD_WIDTHS: Record<string, number> = {
  motorway: 20,
  trunk: 16,
  primary: 14,
  secondary: 12,
  tertiary: 10,
  residential: 8,
  service: 5,
  footway: 2,
  path: 2
};
