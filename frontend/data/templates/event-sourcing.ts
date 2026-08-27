import { Node, Edge } from 'reactflow';
const n=(id:string,l:string,s:string,layer:string,c:string,i:string,x:number,y:number):Node=>({id, type:'systemNode', position:{x,y}, data:{label:l, subtitle:s, layer, category:layer, color:c, icon:i, nodeWidth:182, nodeHeight:82}});
const e=(id:string,s:string,t:string,l:string,c:'sync'|'async'|'event'|'stream'|'dep'='sync'):Edge=>({id, source:s, target:t, type:'simpleFloating', animated:c!=='sync', label:l, data:{label:l, edgeType:c, connectionType:c, pathType:'Smoothstep'}, style:{strokeWidth:1.5}});
export const eventSourcingNodes: Node[] = [
  n('es_client','Client','Command','client','#64748b','Monitor',0,300),
  n('es_api','Command Handler','Validates','compute','#0d9488','Cpu',320,300),
  n('es_store','Event Store','Append log','data','#334155','Database',640,300),
  n('es_bus','Event Bus','Pub/Sub','async','#b45309','MessagesSquare',960,300),
  n('es_projection','Projection','Builds view','compute','#0d9488','Layers',1280,220),
  n('es_read','Read Model','Query optimized','data','#334155','Search',1280,380),
];
export const eventSourcingEdges: Edge[] = [
  e('es_e1','es_client','es_api','command'),
  e('es_e2','es_api','es_store','append event','event'),
  e('es_e3','es_store','es_bus','publish','event'),
  e('es_e4','es_bus','es_projection','project','event'),
  e('es_e5','es_projection','es_read','upsert'),
  e('es_e6','es_client','es_read','query'),
];
