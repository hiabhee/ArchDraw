import { Node, Edge } from 'reactflow';

export const archdrawNodes: Node[] = [
  // Subgraphs
  {
    "id": "UI",
    "type": "groupNode",
    "position": {
      "x": 50,
      "y": 50
    },
    "data": {
      "label": "User Interface",
      "groupLabel": "User Interface",
      "isGroup": true,
      "color": "#06b6d4"
    },
    "style": {
      "width": 1250,
      "height": 600
    },
    "zIndex": -1,
    "width": 1250,
    "height": 600
  },
  {
    "id": "AIP",
    "type": "groupNode",
    "position": {
      "x": 440,
      "y": 750
    },
    "data": {
      "label": "AI Pipeline (Single Stage)",
      "groupLabel": "AI Pipeline (Single Stage)",
      "isGroup": true,
      "color": "#ec4899"
    },
    "style": {
      "width": 300,
      "height": 220
    },
    "zIndex": -1,
    "width": 300,
    "height": 220
  },
  {
    "id": "PIP",
    "type": "groupNode",
    "position": {
      "x": 1450,
      "y": 380
    },
    "data": {
      "label": "Bidirectional Sync & Parsing",
      "groupLabel": "Bidirectional Sync & Parsing",
      "isGroup": true,
      "color": "#14b8a6"
    },
    "style": {
      "width": 300,
      "height": 220
    },
    "zIndex": -1,
    "width": 300,
    "height": 220
  },

  // Nodes inside UI Group
  {
    "id": "Web",
    "type": "shapeNode",
    "position": {
      "x": 60,
      "y": 245
    },
    "data": {
      "label": "Web UI Layer",
      "subtitle": "",
      "sublabel": "",
      "shape": "rounded-rectangle",
      "nodeWidth": 180,
      "nodeHeight": 110,
      "serviceType": "service",
      "typeId": "service",
      "color": "#4F46E5",
      "category": "compute",
      "icon": "Box"
    },
    "width": 180,
    "height": 110,
    "parentNode": "UI",
    "extent": "parent"
  },
  {
    "id": "RFW",
    "type": "shapeNode",
    "position": {
      "x": 600,
      "y": 80
    },
    "data": {
      "label": "React Flow Canvas",
      "subtitle": "",
      "sublabel": "",
      "shape": "rounded-rectangle",
      "nodeWidth": 180,
      "nodeHeight": 110,
      "serviceType": "service",
      "typeId": "service",
      "color": "#4F46E5",
      "category": "compute",
      "icon": "Box"
    },
    "width": 180,
    "height": 110,
    "parentNode": "UI",
    "extent": "parent"
  },
  {
    "id": "EDT",
    "type": "shapeNode",
    "position": {
      "x": 600,
      "y": 380
    },
    "data": {
      "label": "Code Editor Panel",
      "subtitle": "",
      "sublabel": "",
      "shape": "rounded-rectangle",
      "nodeWidth": 180,
      "nodeHeight": 110,
      "serviceType": "service",
      "typeId": "service",
      "color": "#4F46E5",
      "category": "compute",
      "icon": "Box"
    },
    "width": 180,
    "height": 110,
    "parentNode": "UI",
    "extent": "parent"
  },
  {
    "id": "ZST",
    "type": "shapeNode",
    "position": {
      "x": 1000,
      "y": 80
    },
    "data": {
      "label": "Zustand State Store",
      "subtitle": "",
      "sublabel": "",
      "shape": "cylinder",
      "nodeWidth": 180,
      "nodeHeight": 110,
      "serviceType": "database",
      "typeId": "database",
      "color": "#1e293b",
      "category": "data",
      "icon": "Database"
    },
    "width": 180,
    "height": 110,
    "parentNode": "UI",
    "extent": "parent"
  },

  // Nodes inside AIP Group
  {
    "id": "PLN",
    "type": "shapeNode",
    "position": {
      "x": 60,
      "y": 60
    },
    "data": {
      "label": "Stage 1 Planner",
      "subtitle": "",
      "sublabel": "",
      "shape": "rounded-rectangle",
      "nodeWidth": 180,
      "nodeHeight": 110,
      "serviceType": "service",
      "typeId": "service",
      "color": "#4F46E5",
      "category": "compute",
      "icon": "Box"
    },
    "width": 180,
    "height": 110,
    "parentNode": "AIP",
    "extent": "parent"
  },

  // Nodes inside PIP Group
  {
    "id": "PRS",
    "type": "shapeNode",
    "position": {
      "x": 60,
      "y": 60
    },
    "data": {
      "label": "Mermaid AST Parser",
      "subtitle": "",
      "sublabel": "",
      "shape": "rounded-rectangle",
      "nodeWidth": 180,
      "nodeHeight": 110,
      "serviceType": "service",
      "typeId": "service",
      "color": "#4F46E5",
      "category": "compute",
      "icon": "Box"
    },
    "width": 180,
    "height": 110,
    "parentNode": "PIP",
    "extent": "parent"
  }
];

export const archdrawEdges: Edge[] = [
  {
    "id": "Web-PLN-1. Prompts",
    "source": "Web",
    "target": "PLN",
    "sourceHandle": null,
    "targetHandle": null,
    "type": "simpleFloating",
    "label": "1. Prompts",
    "data": {
      "label": "1. Prompts",
      "connectionType": "sync",
      "edgeVariant": "solid"
    }
  },
  {
    "id": "PLN-PRS-2. Mermaid Code",
    "source": "PLN",
    "target": "PRS",
    "sourceHandle": null,
    "targetHandle": null,
    "type": "simpleFloating",
    "label": "2. Mermaid Code",
    "data": {
      "label": "2. Mermaid Code",
      "connectionType": "sync",
      "edgeVariant": "solid"
    }
  },
  {
    "id": "PRS-ZST-3. Sized & Layouted",
    "source": "PRS",
    "target": "ZST",
    "sourceHandle": null,
    "targetHandle": null,
    "type": "simpleFloating",
    "label": "3. Sized & Layouted",
    "data": {
      "label": "3. Sized & Layouted",
      "connectionType": "sync",
      "edgeVariant": "solid"
    }
  },
  {
    "id": "ZST-RFW-4. Nodes & Edges",
    "source": "ZST",
    "target": "RFW",
    "sourceHandle": null,
    "targetHandle": null,
    "type": "simpleFloating",
    "label": "4. Nodes & Edges",
    "data": {
      "label": "4. Nodes & Edges",
      "connectionType": "sync",
      "edgeVariant": "solid"
    }
  },
  {
    "id": "EDT-PRS-5. Custom Edits",
    "source": "EDT",
    "target": "PRS",
    "sourceHandle": null,
    "targetHandle": null,
    "type": "simpleFloating",
    "label": "5. Custom Edits",
    "data": {
      "label": "5. Custom Edits",
      "connectionType": "sync",
      "edgeVariant": "solid"
    }
  },
  {
    "id": "ZST-EDT-6. Serialized Code",
    "source": "ZST",
    "target": "EDT",
    "sourceHandle": null,
    "targetHandle": null,
    "type": "simpleFloating",
    "label": "6. Serialized Code",
    "data": {
      "label": "6. Serialized Code",
      "connectionType": "sync",
      "edgeVariant": "solid"
    }
  }
];
