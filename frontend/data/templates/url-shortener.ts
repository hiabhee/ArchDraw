import { Node, Edge } from 'reactflow';
const n=(id:string,l:string,s:string,ly:string,c:string,i:string,x:number,y:number):Node=>({id, type:'systemNode', position:{x,y}, data:{label:l, subtitle:s, layer:ly, category:ly, color:c, icon:i, nodeWidth:182, nodeHeight:82}});
const e=(id:string,s:string,t:string,l:string,c:'sync'|'async'|'event'|'stream'|'dep'='sync'):Edge=>({id, source:s, target:t, type:'simpleFloating', animated:c!=='sync', label:l, data:{label:l, edgeType:c, connectionType:c, pathType:'Smoothstep'}, style:{strokeWidth:1.5}});
export const urlShortenerNodes: Node[] = [
  n('us_client','Client','Browser','client','#64748b','Monitor',0,200),
  n('us_lb','Load Balancer','NGINX','edge','#0f766e','Scale',320,200),
  n('us_api','API Service','Create / Redirect','compute','#0d9488','Link',640,200),
  n('us_cache','Cache','Redis','data','#334155','Zap',960,100),
  n('us_db','Database','Cassandra','data','#334155','Database',960,300),
  n('us_worker','Worker','Async cleanup','compute','#0d9488','Timer',640,400),
];
export const urlShortenerEdges: Edge[] = [
  e('us_e1','us_client','us_lb','shorten / redirect'),
  e('us_e2','us_lb','us_api','route'),
  e('us_e3','us_api','us_cache','lookup'),
  e('us_e4','us_api','us_db','store / get'),
  e('us_e5','us_api','us_worker','enqueue','async'),
  e('us_e6','us_worker','us_db','purge expired','async'),
];
