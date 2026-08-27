import { Node, Edge } from 'reactflow';
const n=(id:string,l:string,s:string,ly:string,c:string,i:string,x:number,y:number):Node=>({id, type:'systemNode', position:{x,y}, data:{label:l, subtitle:s, layer:ly, category:ly, color:c, icon:i, nodeWidth:182, nodeHeight:82}});
const e=(id:string,s:string,t:string,l:string,c:'sync'|'async'|'event'|'stream'|'dep'='sync'):Edge=>({id, source:s, target:t, type:'simpleFloating', animated:c!=='sync', label:l, data:{label:l, edgeType:c, connectionType:c, pathType:'Smoothstep'}, style:{strokeWidth:1.5}});
export const searchNodes: Node[] = [
  n('se_client','Client','Typeahead','client','#64748b','Search',0,200),
  n('se_api','Search API','Query','compute','#0d9488','Search',320,200),
  n('se_trie','Trie Cache','Redis','data','#334155','Zap',640,100),
  n('se_index','Search Index','Elasticsearch','data','#334155','Layers',640,300),
  n('se_db','Primary DB','Postgres','data','#334155','Database',960,300),
  n('se_queue','Queue','Kafka','async','#b45309','MessagesSquare',1280,300),
  n('se_worker','Indexer','Kafka consumer','compute','#0d9488','Timer',1280,100),
];
export const searchEdges: Edge[] = [
  e('se_e1','se_client','se_api','autocomplete'),
  e('se_e2','se_api','se_trie','lookup'),
  e('se_e3','se_api','se_index','search'),
  e('se_e4','se_index','se_db','sync','event'),
  e('se_e5','se_db','se_queue','CDC','event'),
  e('se_e6','se_queue','se_worker','consume','event'),
  e('se_e7','se_worker','se_index','reindex','async'),
  e('se_e8','se_worker','se_trie','rebuild','async'),
];
