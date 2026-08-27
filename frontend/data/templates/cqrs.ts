import { Node, Edge } from 'reactflow';
const n=(id:string,label:string,sub:string,layer:string,color:string,icon:string,x:number,y:number):Node=>({id, type:'systemNode', position:{x,y}, data:{label, subtitle:sub, layer, category:layer, color, icon, nodeWidth:182, nodeHeight:82}});
const e=(id:string,s:string,t:string,l:string,c:'sync'|'async'|'event'|'stream'|'dep'='sync'):Edge=>({id, source:s, target:t, type:'simpleFloating', animated:c!=='sync', label:l, data:{label:l, edgeType:c, connectionType:c, pathType:'Smoothstep'}, style:{strokeWidth:1.5}});
export const cqrsNodes: Node[] = [
  n('cqrs_client','Client','Read + Write','client','#64748b','Monitor',0,300),
  n('cqrs_api','API Gateway','Routes','edge','#0f766e','Webhook',320,300),
  n('cqrs_command','Command API','Writes','compute','#0d9488','Edit',640,140),
  n('cqrs_query','Query API','Reads','compute','#0d9488','Search',640,460),
  n('cqrs_write_db','Write DB','Postgres','data','#334155','Database',960,140),
  n('cqrs_bus','Event Bus','Sync','async','#b45309','MessagesSquare',1120,220),
  n('cqrs_read_db','Read DB','Materialized','data','#334155','Layers',1280,460),
];
export const cqrsEdges: Edge[] = [
  e('cqrs_e1','cqrs_client','cqrs_api','request'),
  e('cqrs_e2','cqrs_api','cqrs_command','commands'),
  e('cqrs_e3','cqrs_api','cqrs_query','queries'),
  e('cqrs_e4','cqrs_command','cqrs_write_db','write'),
  e('cqrs_e5','cqrs_write_db','cqrs_bus','events','event'),
  e('cqrs_e6','cqrs_bus','cqrs_read_db','project','event'),
  e('cqrs_e7','cqrs_query','cqrs_read_db','read'),
];
