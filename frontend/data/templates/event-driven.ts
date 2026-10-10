import { Node, Edge } from 'reactflow';
const n = (id: string, label: string, sub: string, layer: string, color: string, icon: string, x: number, y: number): Node => ({ id, type: 'systemNode', position: { x, y }, data: { label, subtitle: sub, layer, category: layer, color, icon, nodeWidth: 182, nodeHeight: 82 }});
const e = (id: string,s:string,t:string,l:string,c:'sync'|'async'|'event'|'stream'|'dep'='sync'): Edge => ({ id, source:s, target:t, type:'simpleFloating', animated:c!=='sync', label:l, data:{label:l, edgeType:c, connectionType:c, pathType:'Smoothstep'}, style:{strokeWidth:1.5}});
export const eventDrivenNodes: Node[] = [
  n('ed_client','Client','Trigger','client','#64748b','Monitor',0,300),
  n('ed_api','API Service','Command handler','compute','#0d9488','Cpu',320,300),
  n('ed_store','Event Store','Append only','data','#334155','Database',640,300),
  n('ed_bus','Event Bus','Kafka','async','#b45309','MessagesSquare',960,300),
  n('ed_consumer_a','Inventory Service','Consumer A','compute','#0d9488','Boxes',1280,120),
  n('ed_consumer_b','Email Service','Consumer B','compute','#0d9488','Mail',1280,300),
  n('ed_consumer_c','Analytics','Consumer C','observe','#475569','BarChart',1280,480),
];
export const eventDrivenEdges: Edge[] = [
  e('ed_e1','ed_client','ed_api','command'),
  e('ed_e2','ed_api','ed_store','store event','event'),
  e('ed_e3','ed_store','ed_bus','publish','event'),
  e('ed_e4','ed_bus','ed_consumer_a','InventoryUpdated','event'),
  e('ed_e5','ed_bus','ed_consumer_b','OrderCreated','event'),
  e('ed_e6','ed_bus','ed_consumer_c','OrderCreated','event'),
];
